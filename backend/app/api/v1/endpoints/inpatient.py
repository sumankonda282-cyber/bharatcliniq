"""
Phase 0: Inpatient Foundation
Departments, Wards, Beds, Admissions (ADT), Atomic Token Generation, Referrals, BHID at reception.
"""
import random
import string
from datetime import datetime, date as dt, timedelta
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
    MedicationOrder, ClinicalOrder, MedicationAdministration,
    ProgressNote, WardRound, VitalSign,
    DischargeSummary, InpatientCharge, InpatientBill,
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


# ── CPOE helpers ────────────────────────────────────────────────────────────────

FREQ_TIMES = {
    "OD":   ["08:00"],
    "BD":   ["08:00", "20:00"],
    "TDS":  ["08:00", "14:00", "20:00"],
    "QID":  ["06:00", "12:00", "18:00", "24:00"],
    "Q4H":  ["06:00", "10:00", "14:00", "18:00", "22:00", "02:00"],
    "Q6H":  ["06:00", "12:00", "18:00", "24:00"],
    "Q8H":  ["06:00", "14:00", "22:00"],
    "Q12H": ["08:00", "20:00"],
    "HS":   ["22:00"],
    "AC":   ["07:30", "12:30", "18:30"],
    "PC":   ["08:30", "13:30", "19:30"],
    "STAT": [], "PRN": [], "CONT": [],
}


def _get_adm_or_404(db, admission_id, clinic_id):
    a = db.query(Admission).filter(Admission.id == admission_id, Admission.clinic_id == clinic_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Admission not found")
    return a


def _gen_mar(db, order, start_date, end_date):
    times = FREQ_TIMES.get(order.frequency, [])
    if not times:
        return
    day = start_date
    stop = end_date if end_date else (start_date + timedelta(days=6))
    while day <= stop:
        for t in times:
            h, m = map(int, t.split(":"))
            db.add(MedicationAdministration(
                clinic_id    = order.clinic_id,
                admission_id = order.admission_id,
                patient_id   = order.patient_id,
                order_id     = order.id,
                drug_name    = order.drug_name,
                dose         = order.dose,
                route        = order.route,
                scheduled_at = datetime(day.year, day.month, day.day, h, m),
                status       = "scheduled",
            ))
        day += timedelta(days=1)


# ── Medication Orders ───────────────────────────────────────────────────────────

@router.get("/admissions/{admission_id}/orders")
def list_med_orders(admission_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    _get_adm_or_404(db, admission_id, current.clinic_id)
    orders = db.query(MedicationOrder).filter(
        MedicationOrder.admission_id == admission_id,
        MedicationOrder.clinic_id == current.clinic_id,
    ).order_by(MedicationOrder.ordered_at.desc()).all()
    return [_med_dict(o) for o in orders]


@router.post("/admissions/{admission_id}/orders")
def create_med_order(admission_id: int, body: dict, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    adm = _get_adm_or_404(db, admission_id, current.clinic_id)
    start = dt.fromisoformat(body["start_date"]) if body.get("start_date") else dt.today()
    dur = body.get("duration_days")
    end = (start + timedelta(days=int(dur) - 1)) if dur else None
    o = MedicationOrder(
        clinic_id=current.clinic_id, admission_id=admission_id, patient_id=adm.patient_id,
        drug_name=body["drug_name"], generic_name=body.get("generic_name"),
        dose=body["dose"], route=body["route"], frequency=body["frequency"],
        duration_days=dur, start_date=start, end_date=end,
        instructions=body.get("instructions"), is_prn=body.get("is_prn", False),
        prn_reason=body.get("prn_reason"), is_stat=body.get("is_stat", False),
        is_continuous=body.get("is_continuous", False), iv_rate=body.get("iv_rate"),
        iv_fluid=body.get("iv_fluid"), iv_volume_ml=body.get("iv_volume_ml"),
        notes=body.get("notes"), ordered_by=current.id, status="active",
    )
    db.add(o); db.flush()
    _gen_mar(db, o, start, end)
    db.commit(); db.refresh(o)
    return _med_dict(o)


@router.patch("/orders/{order_id}")
def update_med_order(order_id: int, body: dict, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    o = db.query(MedicationOrder).filter(MedicationOrder.id == order_id, MedicationOrder.clinic_id == current.clinic_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    for k in ["dose", "route", "frequency", "instructions", "iv_rate", "iv_fluid", "iv_volume_ml", "notes", "status"]:
        if k in body:
            setattr(o, k, body[k])
    db.commit()
    return _med_dict(o)


@router.post("/orders/{order_id}/discontinue")
def discontinue_med_order(order_id: int, body: dict, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    o = db.query(MedicationOrder).filter(MedicationOrder.id == order_id, MedicationOrder.clinic_id == current.clinic_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    o.status = "discontinued"; o.discontinued_by = current.id
    o.discontinued_at = datetime.utcnow(); o.discontinue_reason = body.get("reason", "")
    db.commit()
    return {"detail": "Order discontinued"}


def _med_dict(o):
    return {
        "id": o.id, "drug_name": o.drug_name, "generic_name": o.generic_name,
        "dose": o.dose, "route": o.route, "frequency": o.frequency,
        "duration_days": o.duration_days,
        "start_date": o.start_date.isoformat() if o.start_date else None,
        "end_date": o.end_date.isoformat() if o.end_date else None,
        "instructions": o.instructions, "is_prn": o.is_prn, "prn_reason": o.prn_reason,
        "is_stat": o.is_stat, "is_continuous": o.is_continuous,
        "iv_rate": o.iv_rate, "iv_fluid": o.iv_fluid, "iv_volume_ml": o.iv_volume_ml,
        "status": o.status, "ordered_by": o.ordered_by,
        "orderer_name": o.orderer.full_name if o.orderer else None,
        "ordered_at": o.ordered_at.isoformat() if o.ordered_at else None,
        "discontinued_at": o.discontinued_at.isoformat() if o.discontinued_at else None,
        "discontinue_reason": o.discontinue_reason, "notes": o.notes,
    }


# ── Clinical Orders ─────────────────────────────────────────────────────────────

@router.get("/admissions/{admission_id}/clinical-orders")
def list_clinical_orders(admission_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    _get_adm_or_404(db, admission_id, current.clinic_id)
    orders = db.query(ClinicalOrder).filter(
        ClinicalOrder.admission_id == admission_id,
        ClinicalOrder.clinic_id == current.clinic_id,
    ).order_by(ClinicalOrder.ordered_at.desc()).all()
    return [_clin_dict(o) for o in orders]


@router.post("/admissions/{admission_id}/clinical-orders")
def create_clinical_order(admission_id: int, body: dict, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    adm = _get_adm_or_404(db, admission_id, current.clinic_id)
    o = ClinicalOrder(
        clinic_id=current.clinic_id, admission_id=admission_id, patient_id=adm.patient_id,
        order_type=body["order_type"], order_detail=body["order_detail"],
        priority=body.get("priority", "routine"), instructions=body.get("instructions"),
        notes=body.get("notes"), ordered_by=current.id, status="pending",
    )
    db.add(o); db.commit(); db.refresh(o)
    return _clin_dict(o)


@router.post("/clinical-orders/{order_id}/acknowledge")
def ack_clinical_order(order_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    o = db.query(ClinicalOrder).filter(ClinicalOrder.id == order_id, ClinicalOrder.clinic_id == current.clinic_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    o.status = "acknowledged"; o.acknowledged_by = current.id; o.acknowledged_at = datetime.utcnow()
    db.commit()
    return _clin_dict(o)


@router.post("/clinical-orders/{order_id}/complete")
def complete_clinical_order(order_id: int, body: dict, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    o = db.query(ClinicalOrder).filter(ClinicalOrder.id == order_id, ClinicalOrder.clinic_id == current.clinic_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    o.status = "completed"; o.completed_by = current.id; o.completed_at = datetime.utcnow()
    o.result_notes = body.get("result_notes", "")
    db.commit()
    return _clin_dict(o)


def _clin_dict(o):
    return {
        "id": o.id, "order_type": o.order_type, "order_detail": o.order_detail,
        "priority": o.priority, "instructions": o.instructions, "status": o.status,
        "ordered_by": o.ordered_by,
        "orderer_name": o.orderer.full_name if o.orderer else None,
        "ordered_at": o.ordered_at.isoformat() if o.ordered_at else None,
        "acknowledged_at": o.acknowledged_at.isoformat() if o.acknowledged_at else None,
        "completed_at": o.completed_at.isoformat() if o.completed_at else None,
        "result_notes": o.result_notes, "notes": o.notes,
    }


# ── MAR ─────────────────────────────────────────────────────────────────────────

@router.get("/admissions/{admission_id}/mar")
def get_mar(admission_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    _get_adm_or_404(db, admission_id, current.clinic_id)
    entries = db.query(MedicationAdministration).filter(
        MedicationAdministration.admission_id == admission_id,
        MedicationAdministration.clinic_id == current.clinic_id,
    ).order_by(MedicationAdministration.scheduled_at.asc()).all()
    return [_mar_dict(e) for e in entries]


@router.patch("/mar/{entry_id}/administer")
def administer_mar(entry_id: int, body: dict, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    e = db.query(MedicationAdministration).filter(MedicationAdministration.id == entry_id, MedicationAdministration.clinic_id == current.clinic_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="MAR entry not found")
    e.status = body.get("status", "given")
    if e.status == "given":
        e.administered_at = datetime.utcnow()
        e.administered_by = body.get("administered_by", current.id)
    e.reason_held = body.get("reason_held")
    e.site = body.get("site")
    e.notes = body.get("notes")
    db.commit()
    return _mar_dict(e)


def _mar_dict(e):
    return {
        "id": e.id, "order_id": e.order_id, "drug_name": e.drug_name,
        "dose": e.dose, "route": e.route,
        "scheduled_at": e.scheduled_at.isoformat() if e.scheduled_at else None,
        "administered_at": e.administered_at.isoformat() if e.administered_at else None,
        "status": e.status, "reason_held": e.reason_held, "site": e.site, "notes": e.notes,
    }


# ── Progress Notes ──────────────────────────────────────────────────────────────

@router.get("/admissions/{admission_id}/notes")
def list_notes(admission_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    _get_adm_or_404(db, admission_id, current.clinic_id)
    notes = db.query(ProgressNote).filter(
        ProgressNote.admission_id == admission_id, ProgressNote.clinic_id == current.clinic_id
    ).order_by(ProgressNote.created_at.desc()).all()
    return [_note_dict(n) for n in notes]


@router.post("/admissions/{admission_id}/notes")
def create_note(admission_id: int, body: dict, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    adm = _get_adm_or_404(db, admission_id, current.clinic_id)
    n = ProgressNote(
        clinic_id=current.clinic_id, admission_id=admission_id, patient_id=adm.patient_id,
        content=body["content"], note_type=body.get("note_type", "progress"), created_by=current.id,
    )
    db.add(n); db.commit(); db.refresh(n)
    return _note_dict(n)


@router.post("/notes/{note_id}/sign")
def sign_note(note_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    n = db.query(ProgressNote).filter(ProgressNote.id == note_id, ProgressNote.clinic_id == current.clinic_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Note not found")
    n.is_signed = True; n.signed_by = current.id; n.signed_at = datetime.utcnow()
    n.signer_credentials = current.role
    db.commit()
    return _note_dict(n)


def _note_dict(n):
    return {
        "id": n.id, "note_type": n.note_type, "content": n.content,
        "is_signed": n.is_signed, "signer_credentials": n.signer_credentials,
        "signed_at": n.signed_at.isoformat() if n.signed_at else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


# ── Ward Rounds ─────────────────────────────────────────────────────────────────

@router.get("/admissions/{admission_id}/rounds")
def list_rounds(admission_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    _get_adm_or_404(db, admission_id, current.clinic_id)
    rounds = db.query(WardRound).filter(
        WardRound.admission_id == admission_id, WardRound.clinic_id == current.clinic_id
    ).order_by(WardRound.created_at.desc()).all()
    return [_round_dict(r) for r in rounds]


@router.post("/admissions/{admission_id}/rounds")
def create_round(admission_id: int, body: dict, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    adm = _get_adm_or_404(db, admission_id, current.clinic_id)
    r = WardRound(
        clinic_id=current.clinic_id, admission_id=admission_id, patient_id=adm.patient_id,
        round_type=body.get("round_type", "ward_round"), subjective=body.get("subjective"),
        objective=body.get("objective"), assessment=body.get("assessment"), plan=body.get("plan"),
        created_by=current.id,
    )
    db.add(r); db.commit(); db.refresh(r)
    return _round_dict(r)


@router.post("/rounds/{round_id}/sign")
def sign_round(round_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    r = db.query(WardRound).filter(WardRound.id == round_id, WardRound.clinic_id == current.clinic_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Round not found")
    r.is_signed = True; r.signed_by = current.id; r.signed_at = datetime.utcnow()
    r.signer_credentials = current.role
    db.commit()
    return _round_dict(r)


def _round_dict(r):
    return {
        "id": r.id, "round_type": r.round_type, "subjective": r.subjective,
        "objective": r.objective, "assessment": r.assessment, "plan": r.plan,
        "is_signed": r.is_signed, "signer_credentials": r.signer_credentials,
        "signed_at": r.signed_at.isoformat() if r.signed_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


# ── Vitals ──────────────────────────────────────────────────────────────────────

@router.get("/admissions/{admission_id}/vitals")
def list_vitals(admission_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    _get_adm_or_404(db, admission_id, current.clinic_id)
    vs = db.query(VitalSign).filter(
        VitalSign.admission_id == admission_id, VitalSign.clinic_id == current.clinic_id
    ).order_by(VitalSign.recorded_at.desc()).all()
    return [_vital_dict(v) for v in vs]


@router.post("/admissions/{admission_id}/vitals")
def create_vital(admission_id: int, body: dict, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    adm = _get_adm_or_404(db, admission_id, current.clinic_id)
    v = VitalSign(
        clinic_id=current.clinic_id, admission_id=admission_id, patient_id=adm.patient_id,
        temperature=body.get("temperature"), pulse=body.get("pulse"),
        respiratory_rate=body.get("respiratory_rate"), bp_systolic=body.get("bp_systolic"),
        bp_diastolic=body.get("bp_diastolic"), spo2=body.get("spo2"),
        weight=body.get("weight"), height=body.get("height"),
        pain_score=body.get("pain_score"), blood_glucose=body.get("blood_glucose"),
        notes=body.get("notes"), recorded_by=current.id,
    )
    db.add(v); db.commit(); db.refresh(v)
    return _vital_dict(v)


def _vital_dict(v):
    return {
        "id": v.id,
        "temperature": float(v.temperature) if v.temperature else None,
        "pulse": v.pulse, "respiratory_rate": v.respiratory_rate,
        "bp_systolic": v.bp_systolic, "bp_diastolic": v.bp_diastolic, "spo2": v.spo2,
        "pain_score": v.pain_score,
        "blood_glucose": float(v.blood_glucose) if v.blood_glucose else None,
        "recorded_at": v.recorded_at.isoformat() if v.recorded_at else None,
    }


# ── Discharge Summary ───────────────────────────────────────────────────────────

@router.get("/admissions/{admission_id}/discharge-summary")
def get_ds(admission_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    _get_adm_or_404(db, admission_id, current.clinic_id)
    ds = db.query(DischargeSummary).filter(DischargeSummary.admission_id == admission_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="No discharge summary")
    return _ds_dict(ds)


@router.post("/admissions/{admission_id}/discharge-summary")
def upsert_ds(admission_id: int, body: dict, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    adm = _get_adm_or_404(db, admission_id, current.clinic_id)
    ds = db.query(DischargeSummary).filter(DischargeSummary.admission_id == admission_id).first()
    if not ds:
        ds = DischargeSummary(clinic_id=current.clinic_id, admission_id=admission_id,
                              patient_id=adm.patient_id, created_by=current.id)
        db.add(ds)
    for f in ["presenting_complaint","history","examination","investigations","diagnosis",
              "hospital_course","procedures_performed","discharge_condition",
              "discharge_instructions","follow_up","medications_at_discharge"]:
        if f in body:
            setattr(ds, f, body[f])
    db.commit(); db.refresh(ds)
    return _ds_dict(ds)


@router.post("/admissions/{admission_id}/discharge-summary/sign")
def sign_ds(admission_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    ds = db.query(DischargeSummary).filter(DischargeSummary.admission_id == admission_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="No discharge summary to sign")
    ds.is_signed = True; ds.signed_by = current.id; ds.signed_at = datetime.utcnow()
    ds.signer_credentials = current.role
    db.commit()
    return _ds_dict(ds)


def _ds_dict(ds):
    return {
        "id": ds.id, "presenting_complaint": ds.presenting_complaint, "history": ds.history,
        "examination": ds.examination, "investigations": ds.investigations, "diagnosis": ds.diagnosis,
        "hospital_course": ds.hospital_course, "procedures_performed": ds.procedures_performed,
        "discharge_condition": ds.discharge_condition, "discharge_instructions": ds.discharge_instructions,
        "follow_up": ds.follow_up, "medications_at_discharge": ds.medications_at_discharge,
        "is_signed": ds.is_signed, "signer_credentials": ds.signer_credentials,
        "signed_at": ds.signed_at.isoformat() if ds.signed_at else None,
        "created_at": ds.created_at.isoformat() if ds.created_at else None,
    }


# ── Inpatient Charges ───────────────────────────────────────────────────────────

@router.get("/admissions/{admission_id}/charges")
def list_charges(admission_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    _get_adm_or_404(db, admission_id, current.clinic_id)
    charges = db.query(InpatientCharge).filter(
        InpatientCharge.admission_id == admission_id, InpatientCharge.clinic_id == current.clinic_id
    ).order_by(InpatientCharge.charge_date.desc()).all()
    return [
        {"id": c.id, "charge_type": c.charge_type, "description": c.description,
         "quantity": c.quantity, "unit_price": float(c.unit_price), "total": float(c.total),
         "charge_date": c.charge_date.isoformat() if c.charge_date else None}
        for c in charges
    ]
