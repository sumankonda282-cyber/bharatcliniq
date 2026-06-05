"""
Phase 0: Inpatient Foundation
Departments, Wards, Beds, Admissions (ADT), Atomic Token Generation, Referrals, BHID at reception.
"""
import random
import string
from datetime import datetime, date as dt, date as date_type
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.session import get_db
from app.core.security import get_current_staff
from app.models.models import (
    Clinic, Staff, Patient, Appointment,
    Department, Ward, Bed, Admission, AdmissionTransfer,
    StaffDepartment, AppointmentTokenSequence, InpatientReferral,
    PatientUser, BHProfile,
    VitalSign, NursingNote, MedicationAdministration, WardRound,
    DischargeSummary, ProgressNote,
    InpatientCharge, InpatientBill, Invoice,
)

router = APIRouter(prefix="/inpatient", tags=["inpatient"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _require_admin(current: Staff):
    if current.role not in ("clinic_admin", "admin"):
        raise HTTPException(status_code=403, detail="clinic_admin role required")


def _get_clinic(db: Session, clinic_id: int) -> Clinic:
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic


def _gen_referral_number(db: Session, clinic_id: int) -> str:
    while True:
        code = "REF-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
        exists = db.query(InpatientReferral).filter(InpatientReferral.referral_number == code).first()
        if not exists:
            return code


# ── Org Config ─────────────────────────────────────────────────────────────────

@router.get("/org-config")
def get_org_config(
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    clinic = _get_clinic(db, current.clinic_id)
    return {
        "org_type": getattr(clinic, "org_type", "clinic"),
        "wards_enabled": getattr(clinic, "wards_enabled", False),
        "clinic_prefix": clinic.clinic_prefix,
        "patient_id_counter": clinic.patient_id_counter,
        "admission_sequence": getattr(clinic, "admission_sequence", 0),
    }


@router.put("/org-config")
def update_org_config(
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    _require_admin(current)
    clinic = _get_clinic(db, current.clinic_id)
    if "org_type" in body:
        clinic.org_type = body["org_type"]
    if "wards_enabled" in body:
        clinic.wards_enabled = body["wards_enabled"]
    if "mrn_prefix" in body:
        clinic.clinic_prefix = body["mrn_prefix"]
    db.commit()
    return {"detail": "org config updated"}


# ── Departments ────────────────────────────────────────────────────────────────

@router.get("/departments")
def list_departments(
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    depts = db.query(Department).filter(
        Department.clinic_id == current.clinic_id,
        Department.is_active == True,
    ).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "code": d.code,
            "dept_type": d.dept_type,
            "head_doctor_id": d.head_doctor_id,
            "color_hex": d.color_hex,
            "is_active": d.is_active,
        }
        for d in depts
    ]


@router.post("/departments")
def create_department(
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    _require_admin(current)
    dept = Department(
        clinic_id=current.clinic_id,
        name=body["name"],
        code=body.get("code"),
        dept_type=body.get("dept_type", "clinical"),
        head_doctor_id=body.get("head_doctor_id"),
        color_hex=body.get("color_hex"),
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return {"id": dept.id, "name": dept.name}


@router.put("/departments/{dept_id}")
def update_department(
    dept_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    _require_admin(current)
    dept = db.query(Department).filter(
        Department.id == dept_id,
        Department.clinic_id == current.clinic_id,
    ).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    for field in ("name", "code", "dept_type", "head_doctor_id", "color_hex", "is_active"):
        if field in body:
            setattr(dept, field, body[field])
    db.commit()
    return {"detail": "updated"}


@router.delete("/departments/{dept_id}")
def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    _require_admin(current)
    dept = db.query(Department).filter(
        Department.id == dept_id,
        Department.clinic_id == current.clinic_id,
    ).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.is_active = False
    db.commit()
    return {"detail": "deleted"}


# ── Wards ──────────────────────────────────────────────────────────────────────

@router.get("/wards")
def list_wards(
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    q = db.query(Ward).filter(
        Ward.clinic_id == current.clinic_id,
        Ward.is_active == True,
    )
    if department_id:
        q = q.filter(Ward.department_id == department_id)
    wards = q.all()
    return [
        {
            "id": w.id,
            "name": w.name,
            "department_id": w.department_id,
            "floor": w.floor,
            "wing": w.wing,
            "ward_type": w.ward_type,
            "total_beds": w.total_beds,
        }
        for w in wards
    ]


@router.post("/wards")
def create_ward(
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    _require_admin(current)
    ward = Ward(
        clinic_id=current.clinic_id,
        department_id=body["department_id"],
        name=body["name"],
        floor=body.get("floor"),
        wing=body.get("wing"),
        ward_type=body.get("ward_type", "general"),
        total_beds=body.get("total_beds", 0),
    )
    db.add(ward)
    db.commit()
    db.refresh(ward)
    return {"id": ward.id, "name": ward.name}


@router.put("/wards/{ward_id}")
def update_ward(
    ward_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    _require_admin(current)
    ward = db.query(Ward).filter(
        Ward.id == ward_id,
        Ward.clinic_id == current.clinic_id,
    ).first()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")
    for field in ("name", "floor", "wing", "ward_type", "total_beds", "is_active"):
        if field in body:
            setattr(ward, field, body[field])
    db.commit()
    return {"detail": "updated"}


@router.delete("/wards/{ward_id}")
def delete_ward(
    ward_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    _require_admin(current)
    ward = db.query(Ward).filter(
        Ward.id == ward_id,
        Ward.clinic_id == current.clinic_id,
    ).first()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")
    ward.is_active = False
    db.commit()
    return {"detail": "deleted"}


# ── Beds ───────────────────────────────────────────────────────────────────────

@router.get("/beds")
def list_beds(
    ward_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    q = db.query(Bed).filter(Bed.clinic_id == current.clinic_id)
    if ward_id:
        q = q.filter(Bed.ward_id == ward_id)
    beds = q.all()
    return [
        {
            "id": b.id,
            "ward_id": b.ward_id,
            "bed_number": b.bed_number,
            "bed_type": b.bed_type,
            "status": b.status,
            "current_admission_id": b.current_admission_id,
        }
        for b in beds
    ]


@router.post("/beds")
def create_bed(
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    _require_admin(current)
    bed = Bed(
        clinic_id=current.clinic_id,
        ward_id=body["ward_id"],
        bed_number=body["bed_number"],
        bed_type=body.get("bed_type", "general"),
    )
    db.add(bed)
    db.commit()
    db.refresh(bed)
    return {"id": bed.id, "bed_number": bed.bed_number}


@router.put("/beds/{bed_id}")
def update_bed(
    bed_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    bed = db.query(Bed).filter(
        Bed.id == bed_id,
        Bed.clinic_id == current.clinic_id,
    ).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    for field in ("bed_type", "status", "current_admission_id"):
        if field in body:
            setattr(bed, field, body[field])
    db.commit()
    return {"detail": "updated"}


@router.get("/bed-board")
def bed_board(
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Full bed board: all depts → wards → beds → current patient name."""
    depts = db.query(Department).filter(
        Department.clinic_id == current.clinic_id,
        Department.is_active == True,
    ).all()

    result = []
    for dept in depts:
        dept_data = {"id": dept.id, "name": dept.name, "wards": []}
        for ward in dept.wards:
            if not ward.is_active:
                continue
            ward_data = {"id": ward.id, "name": ward.name, "beds": []}
            for bed in ward.beds:
                bed_info = {
                    "id": bed.id,
                    "bed_number": bed.bed_number,
                    "status": bed.status,
                    "patient_name": None,
                }
                if bed.current_admission_id:
                    adm = db.query(Admission).filter(Admission.id == bed.current_admission_id).first()
                    if adm:
                        pat = db.query(Patient).filter(Patient.id == adm.patient_id).first()
                        if pat:
                            bed_info["patient_name"] = pat.full_name
                ward_data["beds"].append(bed_info)
            dept_data["wards"].append(ward_data)
        result.append(dept_data)
    return result


# ── Admissions (ADT) ───────────────────────────────────────────────────────────

@router.get("/admissions/pending")
def pending_admissions(
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Admissions waiting for bed assignment."""
    adms = db.query(Admission).filter(
        Admission.clinic_id == current.clinic_id,
        Admission.status == "pending_bed",
    ).all()
    return [_admission_dict(a) for a in adms]


@router.get("/admissions")
def list_admissions(
    status: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    ward_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    q = db.query(Admission).filter(Admission.clinic_id == current.clinic_id)
    if status:
        q = q.filter(Admission.status == status)
    if department_id:
        q = q.filter(Admission.department_id == department_id)
    if ward_id:
        q = q.filter(Admission.ward_id == ward_id)
    return [_admission_dict(a) for a in q.all()]


@router.post("/admissions")
def create_admission(
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Create new admission with atomic admission_number generation."""
    clinic = _get_clinic(db, current.clinic_id)

    # Atomic sequence increment
    clinic.admission_sequence = (clinic.admission_sequence or 0) + 1
    db.flush()

    prefix = clinic.clinic_prefix or "ADM"
    admission_number = f"{prefix}-ADM-{datetime.now().year}-{str(clinic.admission_sequence).zfill(6)}"

    patient_id = body.get("patient_id")
    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id required")

    admitting_doctor_id = body.get("admitting_doctor_id") or current.id

    adm = Admission(
        clinic_id=current.clinic_id,
        patient_id=patient_id,
        admission_number=admission_number,
        admission_sequence=clinic.admission_sequence,
        department_id=body.get("department_id"),
        ward_id=body.get("ward_id"),
        bed_id=body.get("bed_id"),
        admission_type=body.get("admission_type", "opd_referred"),
        source_appointment_id=body.get("source_appointment_id"),
        admitting_doctor_id=admitting_doctor_id,
        primary_diagnosis=body.get("primary_diagnosis"),
        expected_discharge=body.get("expected_discharge"),
        status=body.get("status", "active"),
        tpa_id=body.get("tpa_id"),
        insurance_company=body.get("insurance_company"),
        policy_number=body.get("policy_number"),
        pre_auth_number=body.get("pre_auth_number"),
        created_by=current.id,
    )
    db.add(adm)

    # Mark bed as occupied
    if body.get("bed_id"):
        bed = db.query(Bed).filter(Bed.id == body["bed_id"]).first()
        if bed:
            bed.status = "occupied"
            bed.current_admission_id = adm.id

    db.commit()
    db.refresh(adm)
    return _admission_dict(adm)


@router.get("/admissions/{admission_id}")
def get_admission(
    admission_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")
    result = _admission_dict(adm)
    result["transfers"] = [
        {
            "id": t.id,
            "from_department_id": t.from_department_id,
            "from_ward_id": t.from_ward_id,
            "from_bed_id": t.from_bed_id,
            "to_department_id": t.to_department_id,
            "to_ward_id": t.to_ward_id,
            "to_bed_id": t.to_bed_id,
            "transferred_at": t.transferred_at,
            "reason": t.reason,
        }
        for t in adm.transfers
    ]
    return result


@router.post("/admissions/{admission_id}/transfer")
def transfer_admission(
    admission_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    transfer = AdmissionTransfer(
        admission_id=adm.id,
        from_department_id=adm.department_id,
        from_ward_id=adm.ward_id,
        from_bed_id=adm.bed_id,
        to_department_id=body.get("department_id"),
        to_ward_id=body.get("ward_id"),
        to_bed_id=body.get("bed_id"),
        transferred_by=current.id,
        reason=body.get("reason"),
    )
    db.add(transfer)

    # Free old bed
    if adm.bed_id:
        old_bed = db.query(Bed).filter(Bed.id == adm.bed_id).first()
        if old_bed:
            old_bed.status = "vacant"
            old_bed.current_admission_id = None

    # Assign new bed
    if body.get("bed_id"):
        new_bed = db.query(Bed).filter(Bed.id == body["bed_id"]).first()
        if new_bed:
            new_bed.status = "occupied"
            new_bed.current_admission_id = adm.id

    adm.department_id = body.get("department_id", adm.department_id)
    adm.ward_id = body.get("ward_id", adm.ward_id)
    adm.bed_id = body.get("bed_id", adm.bed_id)

    db.commit()
    return {"detail": "transfer recorded"}


@router.post("/admissions/{admission_id}/discharge")
def discharge_admission(
    admission_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    adm.status = "discharged"
    adm.discharged_at = datetime.utcnow()
    if body.get("outcome_notes"):
        adm.primary_diagnosis = body.get("outcome_notes", adm.primary_diagnosis)

    # Free bed
    if adm.bed_id:
        bed = db.query(Bed).filter(Bed.id == adm.bed_id).first()
        if bed:
            bed.status = "vacant"
            bed.current_admission_id = None

    db.commit()
    return {"detail": "discharged", "discharged_at": adm.discharged_at}


def _admission_dict(a: Admission) -> dict:
    return {
        "id": a.id,
        "admission_number": a.admission_number,
        "patient_id": a.patient_id,
        "department_id": a.department_id,
        "ward_id": a.ward_id,
        "bed_id": a.bed_id,
        "admission_type": a.admission_type,
        "admitting_doctor_id": a.admitting_doctor_id,
        "primary_diagnosis": a.primary_diagnosis,
        "admitted_at": a.admitted_at,
        "discharged_at": a.discharged_at,
        "expected_discharge": a.expected_discharge,
        "status": a.status,
        "tpa_id": a.tpa_id,
        "insurance_company": a.insurance_company,
        "policy_number": a.policy_number,
        "pre_auth_number": a.pre_auth_number,
    }


# ── Atomic Token Generation ────────────────────────────────────────────────────

@router.post("/token/next")
def next_token(
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Atomically assign the next token number for a doctor/branch/date slot."""
    clinic_id  = body.get("clinic_id") or current.clinic_id
    branch_id  = body.get("branch_id") or current.branch_id or 1
    doctor_id  = body.get("doctor_id")
    token_date = body.get("date")

    if not doctor_id or not token_date:
        raise HTTPException(status_code=400, detail="doctor_id and date required")

    result = db.execute(text("""
        INSERT INTO appointment_token_sequences (clinic_id, branch_id, doctor_id, date, last_token)
        VALUES (:clinic_id, :branch_id, :doctor_id, :date, 1)
        ON CONFLICT (clinic_id, branch_id, doctor_id, date)
        DO UPDATE SET last_token = appointment_token_sequences.last_token + 1
        RETURNING last_token
    """), {
        "clinic_id": clinic_id,
        "branch_id": branch_id,
        "doctor_id": doctor_id,
        "date": token_date,
    })
    db.commit()
    token = result.fetchone()[0]
    return {"token": token, "doctor_id": doctor_id, "date": token_date}


# ── Referrals ──────────────────────────────────────────────────────────────────

@router.get("/referrals/incoming")
def incoming_referrals(
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    refs = db.query(InpatientReferral).filter(
        InpatientReferral.referred_to_clinic_id == current.clinic_id,
    ).order_by(InpatientReferral.referred_at.desc()).all()
    return [_referral_dict(r) for r in refs]


@router.get("/referrals")
def list_referrals(
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    refs = db.query(InpatientReferral).filter(
        InpatientReferral.clinic_id == current.clinic_id,
    ).order_by(InpatientReferral.referred_at.desc()).all()
    return [_referral_dict(r) for r in refs]


@router.post("/referrals")
def create_referral(
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    patient_id = body.get("patient_id")
    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id required")

    referral_number = _gen_referral_number(db, current.clinic_id)

    ref = InpatientReferral(
        clinic_id=current.clinic_id,
        patient_id=patient_id,
        bhid=body.get("bhid"),
        referral_number=referral_number,
        referring_type=body.get("referring_type", "internal"),
        referring_doctor_id=body.get("referring_doctor_id") or current.id,
        referring_doctor_name=body.get("referring_doctor_name"),
        referring_doctor_reg=body.get("referring_doctor_reg"),
        referring_org_name=body.get("referring_org_name"),
        referred_to_type=body.get("referred_to_type", "external_outside"),
        referred_to_clinic_id=body.get("referred_to_clinic_id"),
        referred_to_doctor_id=body.get("referred_to_doctor_id"),
        referred_to_doctor_name=body.get("referred_to_doctor_name"),
        referred_to_specialty=body.get("referred_to_specialty"),
        referred_to_org_name=body.get("referred_to_org_name"),
        urgency=body.get("urgency", "routine"),
        reason=body.get("reason"),
        clinical_summary=body.get("clinical_summary"),
        current_medications=body.get("current_medications"),
        relevant_investigations=body.get("relevant_investigations"),
        source_appointment_id=body.get("source_appointment_id"),
        source_admission_id=body.get("source_admission_id"),
        status=body.get("status", "draft"),
        created_by=current.id,
    )
    db.add(ref)
    db.commit()
    db.refresh(ref)
    return _referral_dict(ref)


@router.put("/referrals/{referral_id}")
def update_referral(
    referral_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    ref = db.query(InpatientReferral).filter(InpatientReferral.id == referral_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Referral not found")

    for field in (
        "status", "outcome_notes", "rejection_reason", "resulted_in_admission",
        "destination_admission_id", "accepted_at", "completed_at",
    ):
        if field in body:
            setattr(ref, field, body[field])

    db.commit()
    return _referral_dict(ref)


def _referral_dict(r: InpatientReferral) -> dict:
    return {
        "id": r.id,
        "referral_number": r.referral_number,
        "clinic_id": r.clinic_id,
        "patient_id": r.patient_id,
        "bhid": r.bhid,
        "referring_type": r.referring_type,
        "referring_doctor_id": r.referring_doctor_id,
        "referring_doctor_name": r.referring_doctor_name,
        "referred_to_type": r.referred_to_type,
        "referred_to_clinic_id": r.referred_to_clinic_id,
        "referred_to_doctor_name": r.referred_to_doctor_name,
        "referred_to_specialty": r.referred_to_specialty,
        "referred_to_org_name": r.referred_to_org_name,
        "urgency": r.urgency,
        "reason": r.reason,
        "status": r.status,
        "referred_at": r.referred_at,
        "source_appointment_id": r.source_appointment_id,
        "source_admission_id": r.source_admission_id,
        "resulted_in_admission": r.resulted_in_admission,
        "destination_admission_id": r.destination_admission_id,
    }


# ── BHID at Reception ──────────────────────────────────────────────────────────

@router.get("/bhid/lookup")
def bhid_lookup(
    mobile: str = Query(...),
    dob: str = Query(...),
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Find BHProfile by mobile + DOB for receptionist use."""
    user = db.query(PatientUser).filter(PatientUser.mobile == mobile).first()
    if not user:
        raise HTTPException(status_code=404, detail="No patient found with that mobile")

    from datetime import date as dtdate
    try:
        dob_parsed = dtdate.fromisoformat(dob)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dob format, use YYYY-MM-DD")

    profile = db.query(BHProfile).filter(
        BHProfile.patient_user_id == user.id,
        BHProfile.date_of_birth == dob_parsed,
        BHProfile.is_active == True,
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="No BHProfile found for that mobile+dob")

    return {
        "bh_id": profile.bh_id,
        "full_name": profile.full_name,
        "date_of_birth": profile.date_of_birth,
        "gender": profile.gender,
        "mobile": user.mobile,
        "profile_id": profile.id,
        "patient_user_id": user.id,
    }


@router.post("/bhid/assign")
def bhid_assign(
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Assign a BHProfile to an existing patient record."""
    patient_id = body.get("patient_id")
    profile_id = body.get("profile_id")

    if not patient_id or not profile_id:
        raise HTTPException(status_code=400, detail="patient_id and profile_id required")

    patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current.clinic_id,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    profile = db.query(BHProfile).filter(BHProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="BHProfile not found")

    patient.bhid_profile_id = profile_id
    if not patient.bh_id:
        patient.bh_id = profile.bh_id
    db.commit()

    return {"detail": "BHProfile assigned", "bh_id": profile.bh_id, "patient_id": patient_id}


# ── Phase 2: Vital Signs ───────────────────────────────────────────────────────

@router.post("/admissions/{admission_id}/vitals")
def record_vitals(
    admission_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    v = VitalSign(
        admission_id=admission_id,
        clinic_id=current.clinic_id,
        recorded_by=current.id,
        temperature=body.get("temperature"),
        pulse=body.get("pulse"),
        respiration_rate=body.get("respiration_rate"),
        bp_systolic=body.get("bp_systolic"),
        bp_diastolic=body.get("bp_diastolic"),
        spo2=body.get("spo2"),
        weight=body.get("weight"),
        height=body.get("height"),
        pain_score=body.get("pain_score"),
        notes=body.get("notes"),
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return _vital_dict(v)


@router.get("/admissions/{admission_id}/vitals")
def list_vitals(
    admission_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    vitals = db.query(VitalSign).filter(
        VitalSign.admission_id == admission_id,
        VitalSign.clinic_id == current.clinic_id,
    ).order_by(VitalSign.recorded_at.desc()).limit(50).all()
    return [_vital_dict(v) for v in vitals]


def _vital_dict(v: VitalSign) -> dict:
    return {
        "id": v.id,
        "admission_id": v.admission_id,
        "recorded_by": v.recorded_by,
        "recorded_at": v.recorded_at,
        "temperature": float(v.temperature) if v.temperature is not None else None,
        "pulse": v.pulse,
        "respiration_rate": v.respiration_rate,
        "bp_systolic": v.bp_systolic,
        "bp_diastolic": v.bp_diastolic,
        "spo2": float(v.spo2) if v.spo2 is not None else None,
        "weight": float(v.weight) if v.weight is not None else None,
        "height": float(v.height) if v.height is not None else None,
        "pain_score": v.pain_score,
        "notes": v.notes,
        "created_at": v.created_at,
    }


# ── Phase 2: Nursing Notes ─────────────────────────────────────────────────────

@router.post("/admissions/{admission_id}/notes")
def create_nursing_note(
    admission_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")
    if not body.get("note_text"):
        raise HTTPException(status_code=400, detail="note_text required")

    note = NursingNote(
        admission_id=admission_id,
        clinic_id=current.clinic_id,
        note_text=body["note_text"],
        note_type=body.get("note_type", "general"),
        shift=body.get("shift"),
        is_handoff=body.get("is_handoff", False),
        written_by=current.id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_dict(note, db)


@router.get("/admissions/{admission_id}/notes")
def list_nursing_notes(
    admission_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    notes = db.query(NursingNote).filter(
        NursingNote.admission_id == admission_id,
        NursingNote.clinic_id == current.clinic_id,
    ).order_by(NursingNote.written_at.desc()).limit(100).all()
    return [_note_dict(n, db) for n in notes]


def _note_dict(n: NursingNote, db: Session) -> dict:
    staff = db.query(Staff).filter(Staff.id == n.written_by).first()
    name = staff.full_name if staff else "Unknown"
    return {
        "id": n.id,
        "admission_id": n.admission_id,
        "note_type": n.note_type,
        "note_text": n.note_text,
        "written_by": n.written_by,
        "written_by_name": name,
        "written_at": n.written_at,
        "shift": n.shift,
        "is_handoff": n.is_handoff,
        "created_at": n.created_at,
    }


# ── Phase 2: Medication Administration Record (MAR) ───────────────────────────

@router.get("/admissions/{admission_id}/mar")
def list_mar(
    admission_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    entries = db.query(MedicationAdministration).filter(
        MedicationAdministration.admission_id == admission_id,
        MedicationAdministration.clinic_id == current.clinic_id,
    ).order_by(MedicationAdministration.scheduled_time).all()
    return [_mar_dict(e) for e in entries]


@router.post("/admissions/{admission_id}/mar")
def create_mar(
    admission_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")
    if not body.get("medicine_name"):
        raise HTTPException(status_code=400, detail="medicine_name required")

    entry = MedicationAdministration(
        admission_id=admission_id,
        clinic_id=current.clinic_id,
        medicine_name=body["medicine_name"],
        dose=body.get("dose"),
        route=body.get("route"),
        scheduled_time=body.get("scheduled_time"),
        status=body.get("status", "scheduled"),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _mar_dict(entry)


@router.patch("/mar/{mar_id}")
def update_mar(
    mar_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    entry = db.query(MedicationAdministration).filter(
        MedicationAdministration.id == mar_id,
        MedicationAdministration.clinic_id == current.clinic_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="MAR entry not found")

    if "administered_at" in body:
        entry.administered_at = body["administered_at"]
    if "status" in body:
        entry.status = body["status"]
    if "reason_held" in body:
        entry.reason_held = body["reason_held"]
    if "notes" in body:
        entry.notes = body["notes"]
    if body.get("status") in ("given",) and entry.administered_by is None:
        entry.administered_by = current.id

    db.commit()
    db.refresh(entry)
    return _mar_dict(entry)


def _mar_dict(e: MedicationAdministration) -> dict:
    return {
        "id": e.id,
        "admission_id": e.admission_id,
        "medicine_name": e.medicine_name,
        "dose": e.dose,
        "route": e.route,
        "scheduled_time": e.scheduled_time,
        "administered_at": e.administered_at,
        "administered_by": e.administered_by,
        "status": e.status,
        "reason_held": e.reason_held,
        "notes": e.notes,
        "created_at": e.created_at,
    }


# ── Phase 2: Ward Rounds ───────────────────────────────────────────────────────

@router.post("/admissions/{admission_id}/rounds")
def create_ward_round(
    admission_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")
    if not body.get("round_date"):
        raise HTTPException(status_code=400, detail="round_date required")

    rnd = WardRound(
        admission_id=admission_id,
        clinic_id=current.clinic_id,
        doctor_id=body.get("doctor_id") or current.id,
        round_date=body["round_date"],
        subjective=body.get("subjective"),
        objective=body.get("objective"),
        assessment=body.get("assessment"),
        plan=body.get("plan"),
    )
    db.add(rnd)
    db.commit()
    db.refresh(rnd)
    return _round_dict(rnd, db)


@router.get("/admissions/{admission_id}/rounds")
def list_ward_rounds(
    admission_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    rounds = db.query(WardRound).filter(
        WardRound.admission_id == admission_id,
        WardRound.clinic_id == current.clinic_id,
    ).order_by(WardRound.round_date.desc()).all()
    return [_round_dict(r, db) for r in rounds]


def _round_dict(r: WardRound, db: Session) -> dict:
    doctor = db.query(Staff).filter(Staff.id == r.doctor_id).first()
    doctor_name = doctor.full_name if doctor else "Unknown"
    return {
        "id": r.id,
        "admission_id": r.admission_id,
        "doctor_id": r.doctor_id,
        "doctor_name": doctor_name,
        "round_date": r.round_date,
        "subjective": r.subjective,
        "objective": r.objective,
        "assessment": r.assessment,
        "plan": r.plan,
        "created_at": r.created_at,
    }


# ── Phase 2: Shift Handoff Summary ────────────────────────────────────────────

@router.get("/wards/{ward_id}/handoff")
def shift_handoff(
    ward_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Shift handoff briefing: active admissions in ward with latest vitals,
    latest nursing note, and today's MAR summary."""
    ward = db.query(Ward).filter(
        Ward.id == ward_id,
        Ward.clinic_id == current.clinic_id,
    ).first()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")

    admissions = db.query(Admission).filter(
        Admission.ward_id == ward_id,
        Admission.clinic_id == current.clinic_id,
        Admission.status == "active",
    ).all()

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    result = []
    for adm in admissions:
        patient = db.query(Patient).filter(Patient.id == adm.patient_id).first()

        # Latest vitals
        latest_vital = db.query(VitalSign).filter(
            VitalSign.admission_id == adm.id,
        ).order_by(VitalSign.recorded_at.desc()).first()

        # Latest nursing note
        latest_note = db.query(NursingNote).filter(
            NursingNote.admission_id == adm.id,
        ).order_by(NursingNote.written_at.desc()).first()

        # Today's MAR summary
        today_mar = db.query(MedicationAdministration).filter(
            MedicationAdministration.admission_id == adm.id,
            MedicationAdministration.scheduled_time >= today_start,
        ).all()
        mar_given = sum(1 for m in today_mar if m.status == "given")
        mar_missed = sum(1 for m in today_mar if m.status == "missed")
        mar_scheduled = sum(1 for m in today_mar if m.status == "scheduled")

        result.append({
            "admission_id": adm.id,
            "admission_number": adm.admission_number,
            "patient_id": adm.patient_id,
            "patient_name": patient.full_name if patient else "Unknown",
            "bed_id": adm.bed_id,
            "primary_diagnosis": adm.primary_diagnosis,
            "admitted_at": adm.admitted_at,
            "latest_vitals": _vital_dict(latest_vital) if latest_vital else None,
            "latest_note": _note_dict(latest_note, db) if latest_note else None,
            "mar_today": {
                "given": mar_given,
                "missed": mar_missed,
                "scheduled": mar_scheduled,
                "total": len(today_mar),
            },
        })
    return result


# ── Phase 3: Discharge Summary ─────────────────────────────────────────────────

def _summary_dict(s: DischargeSummary, db: Session) -> dict:
    writer = db.query(Staff).filter(Staff.id == s.written_by).first()
    writer_name = writer.full_name if writer else "Unknown"
    return {
        "id": s.id,
        "admission_id": s.admission_id,
        "status": s.status,
        "admission_diagnosis": s.admission_diagnosis,
        "final_diagnosis": s.final_diagnosis,
        "procedures_done": s.procedures_done,
        "hospital_course": s.hospital_course,
        "condition_at_discharge": s.condition_at_discharge,
        "discharge_instructions": s.discharge_instructions,
        "follow_up_date": str(s.follow_up_date) if s.follow_up_date else None,
        "follow_up_with": s.follow_up_with,
        "diet_advice": s.diet_advice,
        "activity_restrictions": s.activity_restrictions,
        "discharge_medications": s.discharge_medications,
        "finalized_at": s.finalized_at.isoformat() if s.finalized_at else None,
        "written_by_name": writer_name,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("/admissions/{admission_id}/discharge-summary")
def get_discharge_summary(
    admission_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    s = db.query(DischargeSummary).filter(DischargeSummary.admission_id == admission_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Discharge summary not found")
    return _summary_dict(s, db)


@router.post("/admissions/{admission_id}/discharge-summary")
def create_discharge_summary(
    admission_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    existing = db.query(DischargeSummary).filter(DischargeSummary.admission_id == admission_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Discharge summary already exists, use PATCH to update")

    s = DischargeSummary(
        admission_id=admission_id,
        clinic_id=current.clinic_id,
        written_by=current.id,
        status="draft",
        admission_diagnosis=body.get("admission_diagnosis"),
        final_diagnosis=body.get("final_diagnosis"),
        procedures_done=body.get("procedures_done"),
        hospital_course=body.get("hospital_course"),
        condition_at_discharge=body.get("condition_at_discharge"),
        discharge_instructions=body.get("discharge_instructions"),
        follow_up_date=body.get("follow_up_date"),
        follow_up_with=body.get("follow_up_with"),
        diet_advice=body.get("diet_advice"),
        activity_restrictions=body.get("activity_restrictions"),
        discharge_medications=body.get("discharge_medications"),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _summary_dict(s, db)


@router.patch("/admissions/{admission_id}/discharge-summary")
def update_discharge_summary(
    admission_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    s = db.query(DischargeSummary).filter(DischargeSummary.admission_id == admission_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Discharge summary not found")

    for field in (
        "admission_diagnosis", "final_diagnosis", "procedures_done", "hospital_course",
        "condition_at_discharge", "discharge_instructions", "follow_up_date", "follow_up_with",
        "diet_advice", "activity_restrictions", "discharge_medications",
    ):
        if field in body:
            setattr(s, field, body[field])
    s.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(s)
    return _summary_dict(s, db)


@router.post("/admissions/{admission_id}/discharge-summary/finalize")
def finalize_discharge_summary(
    admission_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    s = db.query(DischargeSummary).filter(DischargeSummary.admission_id == admission_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Discharge summary not found")

    s.status = "finalized"
    s.finalized_at = datetime.utcnow()
    s.finalized_by = current.id
    s.updated_at = datetime.utcnow()

    if adm.status == "active":
        adm.status = "discharge_pending"

    db.commit()
    db.refresh(s)
    return _summary_dict(s, db)


# ── Phase 3: Progress Notes ────────────────────────────────────────────────────

def _progress_note_dict(n: ProgressNote, db: Session) -> dict:
    staff = db.query(Staff).filter(Staff.id == n.written_by).first()
    name = staff.full_name if staff else "Unknown"
    return {
        "id": n.id,
        "note_date": str(n.note_date),
        "note_time": n.note_time.isoformat(),
        "note_type": n.note_type,
        "is_significant": n.is_significant,
        "subjective": n.subjective,
        "objective": n.objective,
        "assessment": n.assessment,
        "plan": n.plan,
        "written_by_name": name,
        "created_at": n.created_at.isoformat(),
    }


@router.get("/admissions/{admission_id}/progress-notes")
def list_progress_notes(
    admission_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    notes = db.query(ProgressNote).filter(
        ProgressNote.admission_id == admission_id,
        ProgressNote.clinic_id == current.clinic_id,
    ).order_by(ProgressNote.note_date.desc(), ProgressNote.note_time.desc()).all()
    return [_progress_note_dict(n, db) for n in notes]


@router.post("/admissions/{admission_id}/progress-notes")
def create_progress_note(
    admission_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    note_date = body.get("note_date") or dt.today().isoformat()

    n = ProgressNote(
        admission_id=admission_id,
        clinic_id=current.clinic_id,
        written_by=current.id,
        note_date=note_date,
        subjective=body.get("subjective"),
        objective=body.get("objective"),
        assessment=body.get("assessment"),
        plan=body.get("plan"),
        note_type=body.get("note_type", "progress"),
        is_significant=body.get("is_significant", False),
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return _progress_note_dict(n, db)


# ── Phase 3: Patient Inpatient Timeline ───────────────────────────────────────

@router.get("/admissions/{admission_id}/timeline")
def admission_timeline(
    admission_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Merged chronological feed of all clinical events for an admission."""
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == current.clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    events = []

    # Vitals
    vitals = db.query(VitalSign).filter(VitalSign.admission_id == admission_id).all()
    for v in vitals:
        recorder = db.query(Staff).filter(Staff.id == v.recorded_by).first()
        events.append({
            "type": "vitals",
            "timestamp": v.recorded_at,
            "summary": f"Vitals recorded — BP {v.bp_systolic}/{v.bp_diastolic}, Temp {v.temperature}, SpO2 {v.spo2}",
            "written_by_name": recorder.full_name if recorder else "Unknown",
        })

    # Nursing notes
    nursing_notes = db.query(NursingNote).filter(NursingNote.admission_id == admission_id).all()
    for n in nursing_notes:
        writer = db.query(Staff).filter(Staff.id == n.written_by).first()
        events.append({
            "type": "nursing_note",
            "timestamp": n.written_at,
            "summary": n.note_text[:200] if n.note_text else "",
            "written_by_name": writer.full_name if writer else "Unknown",
        })

    # Progress notes
    progress_notes = db.query(ProgressNote).filter(ProgressNote.admission_id == admission_id).all()
    for n in progress_notes:
        writer = db.query(Staff).filter(Staff.id == n.written_by).first()
        summary = " | ".join(filter(None, [n.assessment, n.plan]))[:200]
        events.append({
            "type": "progress_note",
            "timestamp": n.note_time,
            "summary": summary or f"{n.note_type} note",
            "written_by_name": writer.full_name if writer else "Unknown",
        })

    # Ward rounds
    rounds = db.query(WardRound).filter(WardRound.admission_id == admission_id).all()
    for r in rounds:
        doctor = db.query(Staff).filter(Staff.id == r.doctor_id).first()
        summary = " | ".join(filter(None, [r.assessment, r.plan]))[:200]
        events.append({
            "type": "ward_round",
            "timestamp": r.created_at,
            "summary": summary or "Ward round",
            "written_by_name": doctor.full_name if doctor else "Unknown",
        })

    # Transfers
    transfers = db.query(AdmissionTransfer).filter(AdmissionTransfer.admission_id == admission_id).all()
    for t in transfers:
        mover = db.query(Staff).filter(Staff.id == t.transferred_by).first()
        events.append({
            "type": "transfer",
            "timestamp": t.transferred_at,
            "summary": t.reason or "Patient transferred",
            "written_by_name": mover.full_name if mover else "Unknown",
        })

    events.sort(key=lambda e: e["timestamp"] or datetime.min, reverse=True)
    return events[:100]


# ── Phase 4: Inpatient Billing ─────────────────────────────────────────────────

def _money(val) -> float:
    return round(float(val or 0), 2)


def _charge_dict(c: InpatientCharge) -> dict:
    return {
        "id": c.id,
        "admission_id": c.admission_id,
        "clinic_id": c.clinic_id,
        "charge_date": c.charge_date,
        "charge_type": c.charge_type,
        "description": c.description,
        "quantity": _money(c.quantity),
        "unit_price": _money(c.unit_price),
        "total": _money(c.total),
        "gst_rate": _money(c.gst_rate),
        "gst_amount": _money(c.gst_amount),
        "added_by": c.added_by,
        "is_voided": c.is_voided,
        "void_reason": c.void_reason,
        "created_at": c.created_at,
    }


def _bill_dict(b: InpatientBill) -> dict:
    return {
        "id": b.id,
        "admission_id": b.admission_id,
        "clinic_id": b.clinic_id,
        "invoice_id": b.invoice_id,
        "bill_number": b.bill_number,
        "room_charges": _money(b.room_charges),
        "procedure_charges": _money(b.procedure_charges),
        "consultation_charges": _money(b.consultation_charges),
        "lab_charges": _money(b.lab_charges),
        "imaging_charges": _money(b.imaging_charges),
        "pharmacy_charges": _money(b.pharmacy_charges),
        "misc_charges": _money(b.misc_charges),
        "subtotal": _money(b.subtotal),
        "gst_amount": _money(b.gst_amount),
        "discount": _money(b.discount),
        "total": _money(b.total),
        "insurance_claim_amount": _money(b.insurance_claim_amount),
        "tpa_approved_amount": _money(b.tpa_approved_amount),
        "patient_payable": _money(b.patient_payable),
        "amount_paid": _money(b.amount_paid),
        "payment_method": b.payment_method,
        "status": b.status,
        "notes": b.notes,
        "generated_by": b.generated_by,
        "finalized_at": b.finalized_at,
        "created_at": b.created_at,
        "updated_at": b.updated_at,
    }


def _get_admission_or_404(db: Session, admission_id: int, clinic_id: int) -> Admission:
    adm = db.query(Admission).filter(
        Admission.id == admission_id,
        Admission.clinic_id == clinic_id,
    ).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")
    return adm


def _compute_charge_summary(charges) -> dict:
    summary = {t: 0.0 for t in ("room", "procedure", "consultation", "lab", "imaging", "pharmacy", "misc")}
    total_gst = 0.0
    for c in charges:
        key = c.charge_type if c.charge_type in summary else "misc"
        summary[key] += _money(c.total)
        total_gst += _money(c.gst_amount)
    subtotal = sum(summary.values())
    return {
        **summary,
        "subtotal": round(subtotal, 2),
        "gst_amount": round(total_gst, 2),
        "total": round(subtotal + total_gst, 2),
    }


# ── Running Charges ────────────────────────────────────────────────────────────

@router.get("/admissions/{admission_id}/charges")
def list_charges(
    admission_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = _get_admission_or_404(db, admission_id, current.clinic_id)
    charges = db.query(InpatientCharge).filter(
        InpatientCharge.admission_id == admission_id,
        InpatientCharge.clinic_id == current.clinic_id,
        InpatientCharge.is_voided == False,
    ).order_by(InpatientCharge.charge_date.desc(), InpatientCharge.created_at.desc()).all()

    summary = _compute_charge_summary(charges)

    # Compute days admitted
    admitted_at = adm.admitted_at or datetime.utcnow()
    discharged_at = adm.discharged_at or datetime.utcnow()
    days = max(1, (discharged_at.date() - admitted_at.date()).days)
    summary["days_admitted"] = days

    return {
        "charges": [_charge_dict(c) for c in charges],
        "summary": summary,
    }


@router.post("/admissions/{admission_id}/charges")
def add_charge(
    admission_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    _get_admission_or_404(db, admission_id, current.clinic_id)

    charge_type = body.get("charge_type")
    description = body.get("description")
    if not charge_type or not description:
        raise HTTPException(status_code=400, detail="charge_type and description required")

    quantity = Decimal(str(body.get("quantity", 1)))
    unit_price = Decimal(str(body.get("unit_price", 0)))
    gst_rate = Decimal(str(body.get("gst_rate", 0)))
    total = quantity * unit_price
    gst_amount = total * gst_rate / 100

    charge_date_raw = body.get("charge_date")
    if charge_date_raw:
        charge_date = dt.fromisoformat(str(charge_date_raw))
    else:
        charge_date = dt.today()

    c = InpatientCharge(
        admission_id=admission_id,
        clinic_id=current.clinic_id,
        charge_date=charge_date,
        charge_type=charge_type,
        description=description,
        quantity=quantity,
        unit_price=unit_price,
        total=total,
        gst_rate=gst_rate,
        gst_amount=gst_amount,
        added_by=current.id,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _charge_dict(c)


@router.delete("/charges/{charge_id}")
def void_charge(
    charge_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    c = db.query(InpatientCharge).filter(
        InpatientCharge.id == charge_id,
        InpatientCharge.clinic_id == current.clinic_id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Charge not found")

    c.is_voided = True
    c.void_reason = body.get("void_reason", "")
    db.commit()
    db.refresh(c)
    return _charge_dict(c)


# ── Room Daily Charge ─────────────────────────────────────────────────────────

@router.post("/admissions/{admission_id}/charges/room-daily")
def add_room_daily_charge(
    admission_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    _get_admission_or_404(db, admission_id, current.clinic_id)

    bed_type = body.get("bed_type", "general")
    rate_per_day = Decimal(str(body.get("rate_per_day", 0)))
    today = dt.today()

    existing = db.query(InpatientCharge).filter(
        InpatientCharge.admission_id == admission_id,
        InpatientCharge.clinic_id == current.clinic_id,
        InpatientCharge.charge_type == "room",
        InpatientCharge.charge_date == today,
        InpatientCharge.is_voided == False,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Room charge for today already added.")

    description = f"{bed_type.title()} Room - {today}"
    c = InpatientCharge(
        admission_id=admission_id,
        clinic_id=current.clinic_id,
        charge_date=today,
        charge_type="room",
        description=description,
        quantity=Decimal("1"),
        unit_price=rate_per_day,
        total=rate_per_day,
        gst_rate=Decimal("0"),
        gst_amount=Decimal("0"),
        added_by=current.id,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _charge_dict(c)


# ── Bill Generation ───────────────────────────────────────────────────────────

@router.get("/admissions/{admission_id}/bill")
def get_bill(
    admission_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    _get_admission_or_404(db, admission_id, current.clinic_id)
    bill = db.query(InpatientBill).filter(
        InpatientBill.admission_id == admission_id,
        InpatientBill.clinic_id == current.clinic_id,
    ).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return _bill_dict(bill)


@router.post("/admissions/{admission_id}/bill/generate")
def generate_bill(
    admission_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = _get_admission_or_404(db, admission_id, current.clinic_id)

    charges = db.query(InpatientCharge).filter(
        InpatientCharge.admission_id == admission_id,
        InpatientCharge.clinic_id == current.clinic_id,
        InpatientCharge.is_voided == False,
    ).all()

    # Group by type
    type_totals = {t: Decimal("0") for t in ("room", "procedure", "consultation", "lab", "imaging", "pharmacy", "misc")}
    total_gst = Decimal("0")
    for c in charges:
        key = c.charge_type if c.charge_type in type_totals else "misc"
        type_totals[key] += (c.total or Decimal("0"))
        total_gst += (c.gst_amount or Decimal("0"))

    subtotal = sum(type_totals.values())
    total = subtotal + total_gst

    # Insurance deduction
    tpa_approved = Decimal("0")
    if adm.tpa_id:
        tpa_approved = Decimal(str(body.get("tpa_approved_amount", 0)))

    patient_payable = total - tpa_approved

    bill_number = f"IPB-{current.clinic_id}-{admission_id}-{dt.today().strftime('%Y%m%d')}"

    # Find or create
    bill = db.query(InpatientBill).filter(
        InpatientBill.admission_id == admission_id,
        InpatientBill.clinic_id == current.clinic_id,
    ).first()

    if bill and bill.status != "draft":
        raise HTTPException(status_code=409, detail="Bill is already finalized and cannot be regenerated.")

    if not bill:
        bill = InpatientBill(
            admission_id=admission_id,
            clinic_id=current.clinic_id,
            bill_number=bill_number,
            generated_by=current.id,
        )
        db.add(bill)

    bill.room_charges = type_totals["room"]
    bill.procedure_charges = type_totals["procedure"]
    bill.consultation_charges = type_totals["consultation"]
    bill.lab_charges = type_totals["lab"]
    bill.imaging_charges = type_totals["imaging"]
    bill.pharmacy_charges = type_totals["pharmacy"]
    bill.misc_charges = type_totals["misc"]
    bill.subtotal = subtotal
    bill.gst_amount = total_gst
    bill.discount = Decimal(str(body.get("discount", 0)))
    bill.total = total - bill.discount
    bill.tpa_approved_amount = tpa_approved
    bill.patient_payable = bill.total - tpa_approved
    bill.notes = body.get("notes")
    bill.status = "draft"
    bill.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(bill)
    return _bill_dict(bill)


@router.post("/admissions/{admission_id}/bill/finalize")
def finalize_bill(
    admission_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    adm = _get_admission_or_404(db, admission_id, current.clinic_id)
    bill = db.query(InpatientBill).filter(
        InpatientBill.admission_id == admission_id,
        InpatientBill.clinic_id == current.clinic_id,
    ).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found. Generate it first.")
    if bill.status not in ("draft",):
        raise HTTPException(status_code=409, detail="Bill is already finalized.")

    bill.status = "finalized"
    bill.finalized_at = datetime.utcnow()
    bill.updated_at = datetime.utcnow()

    # Create a standard Invoice linked to this admission
    patient = db.query(Patient).filter(Patient.id == adm.patient_id).first()
    inv = Invoice(
        clinic_id=current.clinic_id,
        patient_id=adm.patient_id,
        invoice_number=f"INV-{bill.bill_number}",
        sale_type="inpatient",
        customer_name=patient.full_name if patient else None,
        subtotal=bill.subtotal,
        gst_amount=bill.gst_amount,
        discount=bill.discount,
        total=bill.total,
        amount_paid=bill.amount_paid,
        payment_method=bill.payment_method,
        notes=f"IPD Bill: {bill.bill_number}",
        status="pending",
    )
    db.add(inv)
    db.flush()  # get inv.id

    bill.invoice_id = inv.id

    db.commit()
    db.refresh(bill)
    return _bill_dict(bill)


@router.post("/admissions/{admission_id}/bill/record-payment")
def record_bill_payment(
    admission_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    _get_admission_or_404(db, admission_id, current.clinic_id)
    bill = db.query(InpatientBill).filter(
        InpatientBill.admission_id == admission_id,
        InpatientBill.clinic_id == current.clinic_id,
    ).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found.")
    if bill.status == "draft":
        raise HTTPException(status_code=409, detail="Finalize the bill before recording payment.")

    amount_paid = Decimal(str(body.get("amount_paid", 0)))
    payment_method = body.get("payment_method")

    bill.amount_paid = amount_paid
    bill.payment_method = payment_method
    if amount_paid >= (bill.patient_payable or Decimal("0")):
        bill.status = "paid"
    else:
        bill.status = "partially_paid"
    bill.updated_at = datetime.utcnow()

    # Also update linked invoice
    if bill.invoice_id:
        inv = db.query(Invoice).filter(Invoice.id == bill.invoice_id).first()
        if inv:
            inv.amount_paid = amount_paid
            inv.payment_method = payment_method
            inv.status = "paid" if bill.status == "paid" else "partially_paid"

    db.commit()
    db.refresh(bill)
    return _bill_dict(bill)
