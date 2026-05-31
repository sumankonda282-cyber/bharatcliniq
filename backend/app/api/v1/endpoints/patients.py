from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from app.db.session import get_db
from app.core.security import get_current_staff, verify_password
from app.models.models import (
    Patient, Staff, PatientUser,
    Appointment, SoapNote, Prescription, PrescriptionItem,
    LabOrder, LabOrderItem, DoctorProfile, Clinic
)
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

    import random
    uhid = 'BC-' + ''.join([str(random.randint(0, 9)) for _ in range(6)])
    patient = Patient(
        clinic_id=current.clinic_id,
        branch_id=branch_id or current.branch_id,
        uhid=uhid,
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
            Patient.uhid.ilike(f"%{search}%")
        )
    if gender:
        q = q.filter(Patient.gender == gender)

    patients = q.order_by(Patient.created_at.desc()).offset(skip).limit(limit).all()
    return [{
        "id":            p.id,
        "uhid":          p.uhid,
        "bh_id":         p.bh_id,
        "full_name":     p.full_name,
        "mobile":        p.mobile,
        "email":         p.email,
        "date_of_birth": str(p.date_of_birth) if p.date_of_birth else None,
        "age":           _age(p),
        "gender":        p.gender,
        "blood_group":   p.blood_group,
        "allergies":     p.allergies,
        "branch_id":     p.branch_id,
        "is_active":     p.is_active,
        "created_at":    str(p.created_at),
    } for p in patients]


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
def bhid_lookup(
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
        raise HTTPException(status_code=400, detail="No disclosure PIN set for this patient")

    if not verify_password(payload.pin, portal_user.disclosure_pin):
        raise HTTPException(status_code=401, detail="Invalid PIN")

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
