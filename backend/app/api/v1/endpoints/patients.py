from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime

from app.db.session import get_db
from app.core.security import get_current_staff, verify_password
from app.core.limiter import limiter
from app.models.models import (
    Patient, Staff, PatientUser,
    Appointment, SoapNote, Prescription, PrescriptionItem,
    LabOrder, DoctorProfile, Clinic,
    BHStateGroup, BHIDSequence, PatientTag, AuditLog,
)
from app.api.v1.endpoints.encounters import _assign_clinic_patient_id
from app.schemas.schemas import PatientCreate, PatientUpdate, PatientOut

router = APIRouter(prefix="/patients", tags=["patients"])

ALLOWED = ['clinic_admin', 'doctor', 'receptionist']


def _age(p):
    if p.date_of_birth:
        return (date.today() - p.date_of_birth).days // 365
    return None


@router.post("/", response_model=PatientOut)
def create_patient(
    payload: PatientCreate,
    branch_id: int = Query(None),
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    if current.role not in ALLOWED:
        raise HTTPException(status_code=403, detail="Access denied")

    if payload.mobile:
        existing = db.query(Patient).filter(
            Patient.mobile == payload.mobile,
            Patient.clinic_id == current.clinic_id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Patient with this mobile already exists in this clinic")

    from app.api.v1.endpoints.auth import _get_state_digit, _next_bh_seq, _make_bh_id

    # Generate BH ID based on patient state
    state = payload.state or ""
    digit = _get_state_digit(state, db) if state else 9
    seq = _next_bh_seq(digit, db)
    bh_id = _make_bh_id(digit, seq)

    clinic = db.query(Clinic).filter(Clinic.id == current.clinic_id).first()
    clinic_patient_id = _assign_clinic_patient_id(clinic, db)

    patient = Patient(
        clinic_id         = current.clinic_id,
        branch_id         = branch_id or current.branch_id,
        clinic_patient_id = clinic_patient_id,
        bh_id             = bh_id,
        **payload.model_dump()
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/")
def list_patients(
    search: Optional[str] = Query(None),
    branch_id: Optional[int] = None,
    gender: Optional[str] = None,
    skip: int = 0,
    limit: int = 25,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    if current.role not in ALLOWED:
        raise HTTPException(status_code=403, detail="Access denied")

    q = db.query(Patient).filter(
        Patient.clinic_id == current.clinic_id,
        Patient.is_active == True,
    )
    if branch_id:
        q = q.filter(Patient.branch_id == branch_id)
    if search:
        q = q.filter(
            Patient.full_name.ilike(f"%{search}%") |
            Patient.mobile.ilike(f"%{search}%") |
            Patient.clinic_patient_id.ilike(f"%{search}%")
        )
    if gender:
        q = q.filter(Patient.gender == gender)

    patients = q.order_by(Patient.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for p in patients:
        tags = db.query(PatientTag).filter(
            PatientTag.patient_id == p.id,
            PatientTag.clinic_id  == current.clinic_id,
        ).all()
        result.append({
            "id":                p.id,
            "clinic_patient_id": p.clinic_patient_id or p.uhid or f"#{p.id}",
            "bh_id":             p.bh_id,
            "full_name":         p.full_name,
            "mobile":            p.mobile,
            "email":             p.email,
            "date_of_birth":     str(p.date_of_birth) if p.date_of_birth else None,
            "age":               _age(p),
            "gender":            p.gender,
            "blood_group":       p.blood_group,
            "allergies":         p.allergies,
            "branch_id":         p.branch_id,
            "is_active":         p.is_active,
            "created_at":        str(p.created_at),
            "tags":              [{"id": t.id, "tag_name": t.tag_name, "icd10_code": t.icd10_code} for t in tags],
        })
    return result


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current.clinic_id,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: int,
    payload: PatientUpdate,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    if current.role not in ALLOWED:
        raise HTTPException(status_code=403, detail="Access denied")
    patient = db.query(Patient).filter(
        Patient.id == patient_id, Patient.clinic_id == current.clinic_id
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(patient, k, v)
    db.commit()
    db.refresh(patient)
    return patient


# ── BHID Lookup (cross-clinic, PIN-gated) ─────────────────────────────────────

class BhidLookupRequest(BaseModel):
    uhid: str
    pin: str


@router.post("/bhid-lookup")
@limiter.limit("5/minute")
def bhid_lookup(
    request: Request,
    payload: BhidLookupRequest,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Look up a patient by UHID + disclosure PIN. Returns visit history across all clinics."""
    patient = db.query(Patient).filter(
        Patient.uhid == payload.uhid.strip().upper(),
        Patient.is_active == True,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="BHID not found")

    portal_user = patient.portal_user
    if not portal_user or not portal_user.disclosure_pin:
        raise HTTPException(status_code=400, detail="Patient has not generated a disclosure PIN")

    # Check expiry
    if not portal_user.disclosure_pin_expiry or portal_user.disclosure_pin_expiry < datetime.utcnow():
        raise HTTPException(status_code=401, detail="PIN has expired. Ask the patient to generate a new one.")

    if not verify_password(payload.pin, portal_user.disclosure_pin):
        raise HTTPException(status_code=401, detail="Invalid PIN")

    # Burn PIN after successful use — one-time only
    portal_user.disclosure_pin        = None
    portal_user.disclosure_pin_expiry = None
    db.commit()

    patient_out = {
        "id":            patient.id,
        "full_name":     patient.full_name,
        "uhid":          patient.uhid,
        "gender":        patient.gender,
        "date_of_birth": str(patient.date_of_birth) if patient.date_of_birth else None,
        "phone":         patient.mobile,
        "blood_group":   patient.blood_group,
        "allergies":     patient.allergies,
        "age":           _age(patient),
    }

    appts = db.query(Appointment).filter(
        Appointment.patient_id == patient.id
    ).order_by(Appointment.appointment_date.desc()).limit(30).all()

    visits = []
    for appt in appts:
        doc_profile = db.query(DoctorProfile).filter(DoctorProfile.id == appt.doctor_id).first()
        doctor_name = doc_profile.staff.full_name if doc_profile and doc_profile.staff else "Unknown"
        clinic = db.query(Clinic).filter(Clinic.id == appt.clinic_id).first()
        soap = db.query(SoapNote).filter(SoapNote.appointment_id == appt.id).first()

        rx_list = []
        for rx in db.query(Prescription).filter(Prescription.appointment_id == appt.id).all():
            for item in rx.items:
                rx_list.append({
                    "drug":     item.medicine_name,
                    "dose":     item.dosage,
                    "duration": item.duration,
                    "notes":    item.instructions,
                })

        lab_list = []
        for lo in db.query(LabOrder).filter(LabOrder.appointment_id == appt.id).all():
            for item in lo.items:
                lab_list.append({
                    "test":   item.test_name,
                    "result": item.result_value,
                })

        visits.append({
            "visit_date":   str(appt.appointment_date),
            "doctor_name":  doctor_name,
            "clinic_name":  clinic.name if clinic else "Unknown",
            "symptoms":     soap.subjective if soap else appt.reason,
            "diagnosis":    soap.assessment if soap else None,
            "notes":        soap.plan if soap else appt.notes,
            "prescription": rx_list,
            "lab_orders":   lab_list,
        })

    return {"patient": patient_out, "visits": visits}


@router.get("/{id}/results")
def patient_results_timeline(
    id: int,
    db: Session = Depends(get_db),
    current = Depends(get_current_staff),
):
    """Return all lab + imaging orders (with signed results) for a patient — for provider results timeline."""
    from app.core.security import _require_roles, CLINICAL_ROLES, LAB_ROLES, IMAGING_ROLES
    _require_roles(current, CLINICAL_ROLES | LAB_ROLES | IMAGING_ROLES, 'Access denied')

    from app.models.models import LabOrder, LabResult, ImagingOrder, ImagingResult
    MODALITY_LABELS = {
        'CR': 'X-Ray', 'DX': 'X-Ray (Digital)', 'CT': 'CT Scan',
        'MR': 'MRI', 'US': 'Ultrasound', 'NM': 'Nuclear Medicine',
        'PT': 'PET Scan', 'MG': 'Mammography', 'OT': 'Other',
    }

    patient = db.query(Patient).filter_by(id=id, clinic_id=current.clinic_id).first()
    if not patient:
        raise HTTPException(404, 'Patient not found')

    lab_orders = db.query(LabOrder).filter_by(
        patient_id=id, clinic_id=current.clinic_id
    ).order_by(LabOrder.created_at.desc()).limit(50).all()

    imaging_orders = db.query(ImagingOrder).filter_by(
        patient_id=id, clinic_id=current.clinic_id
    ).order_by(ImagingOrder.created_at.desc()).limit(50).all()

    def _lab_out(o):
        res = o.result
        doc = db.query(Staff).filter_by(id=o.ordered_by).first() if o.ordered_by else None
        return {
            'type': 'lab',
            'id': o.id, 'order_id': o.order_id,
            'test_names': o.test_names or [],
            'priority': o.priority, 'status': o.status,
            'ordered_by': doc.full_name if doc else '—',
            'created_at': o.created_at.isoformat() if o.created_at else None,
            'result': {
                'observations': res.observations or [],
                'interpretation': res.interpretation,
                'signed_at': res.signed_at.isoformat() if res.signed_at else None,
                'report_hash': res.report_hash,
                'has_pdf': bool(res.pdf_b64),
                'status': res.status,
            } if res else None,
        }

    def _img_out(o):
        res = o.result
        doc = db.query(Staff).filter_by(id=o.ordered_by).first() if o.ordered_by else None
        return {
            'type': 'imaging',
            'id': o.id, 'order_id': o.order_id,
            'modality': o.modality,
            'modality_label': MODALITY_LABELS.get(o.modality or '', o.modality or ''),
            'body_part': o.body_part,
            'study_description': o.study_description,
            'priority': o.priority, 'status': o.status,
            'ordered_by': doc.full_name if doc else '—',
            'created_at': o.created_at.isoformat() if o.created_at else None,
            'result': {
                'findings': res.findings,
                'impression': res.impression,
                'signed_at': res.signed_at.isoformat() if res.signed_at else None,
                'report_hash': res.report_hash,
                'has_pdf': bool(res.pdf_b64),
                'status': res.status,
            } if res else None,
        }

    return {
        'lab_orders': [_lab_out(o) for o in lab_orders],
        'imaging_orders': [_img_out(o) for o in imaging_orders],
    }


# ── Tiered editing ────────────────────────────────────────────────────────────

TIER1_FIELDS = {
    "address", "city", "state", "pincode", "email",
    "blood_group", "allergies", "emergency_contact_name",
    "emergency_contact_phone", "guardian_name", "guardian_mobile",
}


class Tier1EditRequest(BaseModel):
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    email: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_mobile: Optional[str] = None


class CorrectionRequest(BaseModel):
    field: str
    new_value: str
    reason: str


@router.patch("/{patient_id}/edit-tier1")
def edit_tier1(
    patient_id: int,
    payload: Tier1EditRequest,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Free edit of non-identity fields. Any clinic staff. Logs to AuditLog."""
    if current.role not in ALLOWED:
        raise HTTPException(status_code=403, detail="Access denied")

    patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current.clinic_id,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    changes = {}
    for field, new_val in payload.model_dump(exclude_unset=True).items():
        if field not in TIER1_FIELDS:
            continue
        old_val = getattr(patient, field, None)
        setattr(patient, field, new_val)
        changes[field] = {"old": old_val, "new": new_val}

    if not changes:
        return {"message": "No changes provided"}

    log = AuditLog(
        action="patient_tier1_edit",
        target_type="patient",
        target_id=patient.id,
        target_name=patient.full_name,
        admin_name=current.full_name,
        comment=str(changes),
    )
    db.add(log)
    db.commit()
    db.refresh(patient)

    return {
        "message": "Saved",
        "updated_by": current.full_name,
        "updated_at": datetime.utcnow().isoformat(),
        "changes": changes,
    }


@router.patch("/{patient_id}/request-correction")
def request_correction(
    patient_id: int,
    payload: CorrectionRequest,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Submit a Tier-3 correction request for identity fields (full_name, date_of_birth).
    Stored as AuditLog with action='correction_request'. Returns 202 Accepted."""
    if current.role not in ALLOWED:
        raise HTTPException(status_code=403, detail="Access denied")

    TIER3_FIELDS = {"full_name", "date_of_birth"}
    if payload.field not in TIER3_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Field '{payload.field}' is not a Tier-3 field. Allowed: {sorted(TIER3_FIELDS)}",
        )

    patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current.clinic_id,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    old_value = str(getattr(patient, payload.field, None) or "")

    log = AuditLog(
        action="correction_request",
        target_type="patient",
        target_id=patient.id,
        target_name=patient.full_name,
        admin_name=current.full_name,
        reason="pending",
        comment=str({
            "field": payload.field,
            "old_value": old_value,
            "new_value": payload.new_value,
            "reason": payload.reason,
            "requested_by_staff_id": current.id,
            "requested_by": current.full_name,
            "status": "pending",
        }),
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=202,
        content={
            "message": "Correction request submitted — pending clinic admin approval",
            "request_id": log.id,
        },
    )


@router.get("/{patient_id}/correction-requests")
def list_correction_requests(
    patient_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Clinic admin views all pending correction requests for a patient."""
    if current.role != "clinic_admin":
        raise HTTPException(status_code=403, detail="Only clinic admins can view correction requests")

    patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current.clinic_id,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    logs = db.query(AuditLog).filter(
        AuditLog.action == "correction_request",
        AuditLog.target_type == "patient",
        AuditLog.target_id == patient_id,
        AuditLog.reason == "pending",
    ).order_by(AuditLog.created_at.desc()).all()

    import ast
    result = []
    for log in logs:
        try:
            details = ast.literal_eval(log.comment or "{}")
        except Exception:
            details = {}
        result.append({
            "request_id": log.id,
            "field": details.get("field"),
            "old_value": details.get("old_value"),
            "new_value": details.get("new_value"),
            "reason": details.get("reason"),
            "requested_by": details.get("requested_by"),
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "status": details.get("status", "pending"),
        })

    return {"correction_requests": result}


@router.patch("/{patient_id}/approve-correction/{request_id}")
def approve_correction(
    patient_id: int,
    request_id: int,
    action: str = Query("approve", description="approve or reject"),
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Clinic admin approves or rejects a correction request."""
    if current.role != "clinic_admin":
        raise HTTPException(status_code=403, detail="Only clinic admins can approve corrections")

    patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current.clinic_id,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    log = db.query(AuditLog).filter(
        AuditLog.id == request_id,
        AuditLog.action == "correction_request",
        AuditLog.target_id == patient_id,
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Correction request not found")
    if log.reason != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {log.reason}")

    import ast
    try:
        details = ast.literal_eval(log.comment or "{}")
    except Exception:
        details = {}

    if action == "approve":
        field = details.get("field")
        new_value = details.get("new_value")
        if field and new_value:
            if field == "date_of_birth":
                try:
                    from datetime import date as _date
                    setattr(patient, field, _date.fromisoformat(new_value))
                except Exception:
                    pass
            else:
                setattr(patient, field, new_value)
        details["status"] = "approved"
        log.reason = "approved"
    else:
        details["status"] = "rejected"
        log.reason = "rejected"

    details["reviewed_by"] = current.full_name
    log.comment = str(details)
    db.commit()

    return {"message": f"Correction request {log.reason}"}
