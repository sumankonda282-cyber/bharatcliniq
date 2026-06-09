from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from app.db.session import get_db
from app.core.config import settings
from app.models.models import PatientUser, Patient, BHProfile

router = APIRouter(prefix="/portal", tags=["patient-portal"])
security = HTTPBearer()


def _decode_patient_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("user_type") != "patient":
            raise HTTPException(status_code=401, detail="Not a patient token")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_patient(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    payload = _decode_patient_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="No user ID in token")
    user = db.query(PatientUser).filter(PatientUser.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_current_patient_with_profile(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Returns (PatientUser, BHProfile|None) tuple."""
    payload = _decode_patient_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="No user ID in token")
    user = db.query(PatientUser).filter(PatientUser.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    profile = None
    bh_profile_id = payload.get("bh_profile_id")
    if bh_profile_id:
        profile = db.query(BHProfile).filter(
            BHProfile.id == int(bh_profile_id),
            BHProfile.patient_user_id == user.id,
        ).first()
    return user, profile


@router.get("/me")
def portal_me(
    auth=Depends(get_current_patient_with_profile),
    db: Session = Depends(get_db)
):
    from datetime import date
    current, bh_profile = auth
    patients = db.query(Patient).filter(Patient.portal_user_id == current.id).all()

    full_name = current.full_name or ""
    bh_id = None
    if bh_profile:
        full_name = f"{bh_profile.first_name} {bh_profile.last_name}"
        bh_id = bh_profile.bh_id
    elif patients:
        bh_id = patients[0].bh_id

    # Patients for whom this user is registered as guardian
    guardian_patients = db.query(Patient).filter(
        Patient.guardian_mobile == current.mobile
    ).all()

    def _age(p):
        if p.date_of_birth:
            return (date.today() - p.date_of_birth).days // 365
        return None

    return {
        "id": current.id,
        "full_name": full_name,
        "mobile": current.mobile,
        "email": current.email,
        "preferred_language": current.preferred_language,
        "bh_id": bh_id,
        "linked_clinics": len(patients),
        "guardian_of": [
            {
                "id": p.id,
                "full_name": p.full_name,
                "bh_id": p.bh_id,
                "age": _age(p),
                "gender": p.gender,
            }
            for p in guardian_patients
        ],
    }

@router.get("/appointments")
def portal_appointments(current=Depends(get_current_patient), db: Session = Depends(get_db)):
    from app.models.models import Appointment, DoctorProfile, Clinic
    patients = db.query(Patient).filter(Patient.portal_user_id == current.id).all()
    patient_ids = [p.id for p in patients]
    if not patient_ids:
        return {"appointments": []}
    appts = db.query(Appointment).filter(
        Appointment.patient_id.in_(patient_ids)
    ).order_by(Appointment.appointment_date.desc()).limit(50).all()
    result = []
    for a in appts:
        doc = db.query(DoctorProfile).filter(DoctorProfile.id == a.doctor_id).first()
        clinic = db.query(Clinic).filter(Clinic.id == a.clinic_id).first()
        result.append({
            "id": a.id,
            "date": str(a.appointment_date),
            "time": a.appointment_time,
            "status": str(a.status) if a.status else None,
            "doctor_name": doc.staff.full_name if doc and doc.staff else "Unknown",
            "clinic_name": clinic.name if clinic else "Unknown",
            "clinic_address": clinic.address if clinic else None,
            "clinic_city": clinic.city if clinic else None,
            "reason": a.reason,
            "token_number": a.token_number,
            "mode": a.mode or "offline",
        })
    return {"appointments": result}


@router.post("/appointments/{appointment_id}/join")
async def portal_join_telehealth(
    appointment_id: int,
    current=Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    """
    Patient joins their telehealth visit. Gated by the session state machine:
    opens 15 min before the slot, closes 30 min after, dies at completion,
    revives only inside a doctor-approved rejoin window. Patient gets a
    non-owner token and waits in the knocking lobby until the doctor admits.
    """
    from app.models.models import Appointment
    from app.api.v1.endpoints.telehealth import issue_join

    patient_ids = [
        p.id for p in db.query(Patient).filter(Patient.portal_user_id == current.id).all()
    ]
    if not patient_ids:
        raise HTTPException(404, "Appointment not found")
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.patient_id.in_(patient_ids),
    ).first()
    if not appt:
        raise HTTPException(404, "Appointment not found")

    return await issue_join(db, appt, role="patient", actor_id=current.id)


@router.get("/prescriptions")
def portal_prescriptions(current=Depends(get_current_patient), db: Session = Depends(get_db)):
    from app.models.models import Prescription, DoctorProfile, Clinic
    patients = db.query(Patient).filter(Patient.portal_user_id == current.id).all()
    patient_ids = [p.id for p in patients]
    if not patient_ids:
        return {"prescriptions": []}
    prescriptions = db.query(Prescription).filter(
        Prescription.patient_id.in_(patient_ids)
    ).order_by(Prescription.created_at.desc()).limit(50).all()
    result = []
    for rx in prescriptions:
        doc = db.query(DoctorProfile).filter(DoctorProfile.id == rx.prescribed_by).first() if rx.prescribed_by else None
        clinic = db.query(Clinic).filter(Clinic.id == rx.clinic_id).first()
        items = [{"drug": i.medicine_name, "dose": i.dosage, "frequency": i.frequency,
                  "duration": i.duration, "instructions": i.instructions} for i in rx.items]
        result.append({
            "id": rx.id,
            "date": str(rx.created_at.date()) if rx.created_at else None,
            "doctor_name": doc.staff.full_name if doc and doc.staff else "Unknown",
            "clinic_name": clinic.name if clinic else "Unknown",
            "items": items,
            "notes": rx.notes,
        })
    return {"prescriptions": result}


@router.get("/bills")
def portal_bills(current=Depends(get_current_patient), db: Session = Depends(get_db)):
    from app.models.models import Invoice, Clinic
    patients = db.query(Patient).filter(Patient.portal_user_id == current.id).all()
    patient_ids = [p.id for p in patients]
    if not patient_ids:
        return {"bills": []}
    invoices = db.query(Invoice).filter(
        Invoice.patient_id.in_(patient_ids)
    ).order_by(Invoice.created_at.desc()).limit(30).all()
    result = []
    for inv in invoices:
        clinic = db.query(Clinic).filter(Clinic.id == inv.clinic_id).first()
        items = [{"description": i.description, "amount": float(i.total)} for i in inv.items]
        result.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "date": str(inv.created_at.date()) if inv.created_at else None,
            "clinic_name": clinic.name if clinic else "Unknown",
            "total": float(inv.total),
            "amount_paid": float(inv.amount_paid),
            "status": str(inv.status) if inv.status else "pending",
            "payment_method": inv.payment_method,
            "items": items,
        })
    return {"bills": result}


@router.get("/lab-results")
def portal_lab_results(current=Depends(get_current_patient), db: Session = Depends(get_db)):
    from app.models.models import LabOrder, LabResult, Staff, Clinic
    patients = db.query(Patient).filter(Patient.portal_user_id == current.id).all()
    patient_ids = [p.id for p in patients]
    if not patient_ids:
        return {"lab_results": []}
    orders = db.query(LabOrder).filter(
        LabOrder.patient_id.in_(patient_ids),
        LabOrder.status == 'signed',
    ).order_by(LabOrder.created_at.desc()).limit(30).all()
    result = []
    for lo in orders:
        doc = db.query(Staff).filter(Staff.id == lo.ordered_by).first() if lo.ordered_by else None
        clinic = db.query(Clinic).filter(Clinic.id == lo.clinic_id).first()
        res = lo.result
        result.append({
            "id": lo.id,
            "order_id": lo.order_id,
            "date": str(lo.created_at.date()) if lo.created_at else None,
            "doctor_name": doc.full_name if doc else "Unknown",
            "clinic_name": clinic.name if clinic else "Unknown",
            "status": lo.status,
            "test_names": lo.test_names or [],
            "result": {
                "observations": res.observations or [],
                "interpretation": res.interpretation,
                "signed_at": res.signed_at.isoformat() if res.signed_at else None,
                "report_hash": res.report_hash,
                "has_pdf": bool(res.pdf_b64),
            } if res else None,
        })
    return {"lab_results": result}


@router.get("/imaging-results")
def portal_imaging_results(current=Depends(get_current_patient), db: Session = Depends(get_db)):
    from app.models.models import ImagingOrder, ImagingResult, Staff, Clinic
    MODALITY_LABELS = {
        'CR': 'X-Ray', 'DX': 'X-Ray (Digital)', 'CT': 'CT Scan',
        'MR': 'MRI', 'US': 'Ultrasound', 'NM': 'Nuclear Medicine',
        'PT': 'PET Scan', 'MG': 'Mammography', 'RF': 'Fluoroscopy',
        'XA': 'Angiography', 'OT': 'Other',
    }
    patients = db.query(Patient).filter(Patient.portal_user_id == current.id).all()
    patient_ids = [p.id for p in patients]
    if not patient_ids:
        return {"imaging_results": []}
    orders = db.query(ImagingOrder).filter(
        ImagingOrder.patient_id.in_(patient_ids),
        ImagingOrder.status == 'signed',
    ).order_by(ImagingOrder.created_at.desc()).limit(30).all()
    result = []
    for io in orders:
        doc = db.query(Staff).filter(Staff.id == io.ordered_by).first() if io.ordered_by else None
        clinic = db.query(Clinic).filter(Clinic.id == io.clinic_id).first()
        res = io.result
        result.append({
            "id": io.id,
            "order_id": io.order_id,
            "date": str(io.created_at.date()) if io.created_at else None,
            "doctor_name": doc.full_name if doc else "Unknown",
            "clinic_name": clinic.name if clinic else "Unknown",
            "modality": io.modality,
            "modality_label": MODALITY_LABELS.get(io.modality or '', io.modality or ''),
            "body_part": io.body_part,
            "study_description": io.study_description,
            "status": io.status,
            "result": {
                "findings": res.findings,
                "impression": res.impression,
                "signed_at": res.signed_at.isoformat() if res.signed_at else None,
                "report_hash": res.report_hash,
                "has_pdf": bool(res.pdf_b64),
            } if res else None,
        })
    return {"imaging_results": result}


@router.put("/profile")
def update_profile(
    body: dict,
    current: PatientUser = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    from app.models.models import Patient
    from datetime import date

    if body.get("full_name"):
        current.full_name = body["full_name"]
    if body.get("email"):
        current.email = body["email"]
    if body.get("preferred_language"):
        current.preferred_language = body["preferred_language"]
    db.commit()

    patient = db.query(Patient).filter(
        Patient.portal_user_id == current.id
    ).first()

    if patient:
        if body.get("date_of_birth"):
            try:
                patient.date_of_birth = date.fromisoformat(body["date_of_birth"])
            except Exception:
                pass
        if body.get("gender"):
            patient.gender = body["gender"]
        if body.get("blood_group"):
            patient.blood_group = body["blood_group"]
        if body.get("emergency_contact"):
            patient.emergency_contact_phone = body["emergency_contact"]
        if body.get("allergies"):
            patient.allergies = body["allergies"]
        if body.get("address"):
            patient.address = body["address"]
        if body.get("abha_id"):
            patient.abha_id = body["abha_id"]
        db.commit()

    db.refresh(current)
    return {"message": "Profile updated successfully"}

import random
from datetime import timedelta
from app.core.security import hash_password, verify_password

PIN_TTL_MINUTES = 60

def _generate_pin():
    return str(random.randint(100000, 999999))

def _fresh_expiry():
    from datetime import datetime
    return datetime.utcnow() + timedelta(minutes=PIN_TTL_MINUTES)

@router.get("/pin")
def get_pin(current: PatientUser = Depends(get_current_patient), db: Session = Depends(get_db)):
    """
    Always generates a fresh PIN (plaintext never stored in DB).
    Returns PIN in response only — patient must note it down immediately.
    """
    raw = _generate_pin()
    current.disclosure_pin        = hash_password(raw)
    current.disclosure_pin_expiry = _fresh_expiry()
    db.commit()
    from datetime import datetime
    expires_in = PIN_TTL_MINUTES * 60
    return {
        "pin":              raw,
        "expires_at":       current.disclosure_pin_expiry.isoformat(),
        "expires_in_seconds": expires_in,
    }

@router.post("/pin/generate")
def generate_new_pin(current: PatientUser = Depends(get_current_patient), db: Session = Depends(get_db)):
    """Generate a fresh one-time PIN valid for 60 minutes. Plaintext never stored."""
    raw = _generate_pin()
    current.disclosure_pin        = hash_password(raw)
    current.disclosure_pin_expiry = _fresh_expiry()
    db.commit()
    return {
        "pin":              raw,
        "expires_at":       current.disclosure_pin_expiry.isoformat(),
        "expires_in_seconds": PIN_TTL_MINUTES * 60,
    }
