from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from typing import Optional
from datetime import date as dt

from app.db.session import get_db
from app.core.security import get_current_staff
from app.models.models import (
    Staff, Patient, Appointment, DoctorProfile,
    Vitals, SoapNote, Prescription, PrescriptionItem,
    LabOrder, LabOrderItem, Medicine, LabTest
)

router = APIRouter(prefix="/doctor", tags=["doctor-desk"])

DOCTOR_ROLES = ['doctor', 'clinic_admin']


def require_doctor(current=Depends(get_current_staff)):
    if current.role not in DOCTOR_ROLES:
        raise HTTPException(status_code=403, detail="Doctor access required")
    return current


def _age(patient):
    if patient.date_of_birth:
        return (dt.today() - patient.date_of_birth).days // 365
    return None


@router.get("/queue")
def get_queue(
    date: Optional[str] = None,
    db: Session = Depends(get_db),
    current: Staff = Depends(require_doctor),
):
    target = dt.fromisoformat(date) if date else dt.today()
    profile = db.query(DoctorProfile).filter(DoctorProfile.staff_id == current.id).first()

    q = db.query(Appointment).options(
        joinedload(Appointment.patient),
        joinedload(Appointment.vitals),
    ).filter(
        Appointment.clinic_id == current.clinic_id,
        Appointment.appointment_date == target,
    )
    if profile:
        q = q.filter(Appointment.doctor_id == profile.id)
    if current.branch_id:
        q = q.filter(Appointment.branch_id == current.branch_id)

    appointments = q.order_by(Appointment.token_number).all()
    return [
        {
            "id":               a.id,
            "token_number":     a.token_number,
            "appointment_time": a.appointment_time,
            "appointment_date": str(a.appointment_date),
            "status":           a.status,
            "mode":             a.mode,
            "reason":           a.reason,
            "vitals_recorded":  a.vitals is not None,
            "patient_name":     a.patient.full_name if a.patient else None,
            "patient": {
                "id":          a.patient.id,
                "uhid":        a.patient.uhid,
                "full_name":   a.patient.full_name,
                "mobile":      a.patient.mobile,
                "gender":      a.patient.gender,
                "blood_group": a.patient.blood_group,
                "allergies":   a.patient.allergies,
                "age":         _age(a.patient),
            } if a.patient else None,
        }
        for a in appointments
    ]


@router.get("/encounter/{appointment_id}")
def get_encounter(
    appointment_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(require_doctor),
):
    appt = db.query(Appointment).options(
        joinedload(Appointment.patient),
        joinedload(Appointment.vitals),
        joinedload(Appointment.soap_note),
        joinedload(Appointment.prescriptions).joinedload(Prescription.items),
        joinedload(Appointment.lab_orders).joinedload(LabOrder.items),
    ).filter(
        Appointment.id == appointment_id,
        Appointment.clinic_id == current.clinic_id,
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    p = appt.patient
    return {
        "id":               appt.id,
        "appointment_date": str(appt.appointment_date),
        "appointment_time": appt.appointment_time,
        "status":           appt.status,
        "mode":             appt.mode,
        "reason":           appt.reason,
        "patient": {
            "id":            p.id, "uhid": p.uhid, "bh_id": p.bh_id,
            "full_name":     p.full_name, "mobile": p.mobile, "email": p.email,
            "gender":        p.gender, "blood_group": p.blood_group,
            "allergies":     p.allergies,
            "date_of_birth": str(p.date_of_birth) if p.date_of_birth else None,
            "age":           _age(p),
        } if p else None,
        "vitals": {
            "blood_pressure_systolic":  appt.vitals.blood_pressure_systolic,
            "blood_pressure_diastolic": appt.vitals.blood_pressure_diastolic,
            "pulse_rate":               appt.vitals.pulse_rate,
            "temperature":              str(appt.vitals.temperature) if appt.vitals.temperature else None,
            "weight_kg":                str(appt.vitals.weight_kg) if appt.vitals.weight_kg else None,
            "height_cm":                str(appt.vitals.height_cm) if appt.vitals.height_cm else None,
            "oxygen_saturation":        appt.vitals.oxygen_saturation,
            "blood_sugar":              str(appt.vitals.blood_sugar) if appt.vitals.blood_sugar else None,
        } if appt.vitals else None,
        "soap_note": {
            "subjective":    appt.soap_note.subjective,
            "objective":     appt.soap_note.objective,
            "assessment":    appt.soap_note.assessment,
            "plan":          appt.soap_note.plan,
            "follow_up_days":appt.soap_note.follow_up_days,
        } if appt.soap_note else None,
        "prescriptions": [
            {
                "id":     pr.id,
                "status": pr.status,
                "items":  [{"medicine_name": i.medicine_name, "dosage": i.dosage, "frequency": i.frequency, "duration": i.duration, "instructions": i.instructions} for i in pr.items]
            } for pr in appt.prescriptions
        ],
        "lab_orders": [
            {
                "id":     lo.id,
                "status": lo.status,
                "items":  [{"test_name": i.test_name, "result_value": i.result_value, "is_abnormal": i.is_abnormal} for i in lo.items]
            } for lo in appt.lab_orders
        ],
    }


@router.post("/encounter/{appointment_id}/complete")
def complete_encounter(
    appointment_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(require_doctor),
):
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.clinic_id == current.clinic_id,
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Not found")

    # Accept both "soap" and "soap_note" keys
    soap_data = body.get("soap") or body.get("soap_note")
    if soap_data:
        allowed = ["subjective", "objective", "assessment", "plan", "follow_up_days"]
        existing = db.query(SoapNote).filter(SoapNote.appointment_id == appointment_id).first()
        if existing:
            for k in allowed:
                if k in soap_data:
                    setattr(existing, k, soap_data[k])
        else:
            db.add(SoapNote(appointment_id=appointment_id, **{k: soap_data.get(k) for k in allowed}))

    # Prescription
    rx_data = body.get("prescription")
    if rx_data and rx_data.get("items"):
        rx = Prescription(
            clinic_id=appt.clinic_id,
            patient_id=appt.patient_id,
            appointment_id=appointment_id,
            prescribed_by=current.id,
            notes=rx_data.get("notes"),
        )
        db.add(rx)
        db.flush()
        for item in rx_data["items"]:
            med_name = (item.get("medicine_name") or "").strip()
            if med_name:
                db.add(PrescriptionItem(
                    prescription_id=rx.id,
                    medicine_name=med_name,
                    dosage=item.get("dosage", ""),
                    frequency=item.get("frequency", ""),
                    duration=item.get("duration", ""),
                    instructions=item.get("instructions", ""),
                ))

    # Lab order — accept "items" or "tests"
    lab_data = body.get("lab_order")
    if lab_data:
        tests = lab_data.get("items") or lab_data.get("tests") or []
        if tests:
            lo = LabOrder(
                clinic_id=appt.clinic_id,
                patient_id=appt.patient_id,
                appointment_id=appointment_id,
                ordered_by=current.id,
                notes=lab_data.get("notes"),
            )
            db.add(lo)
            db.flush()
            for t in tests:
                test_name = (t.get("test_name") or "").strip()
                if test_name:
                    db.add(LabOrderItem(order_id=lo.id, test_name=test_name))

    appt.status = "completed"
    db.commit()
    return {"message": "Encounter completed successfully"}


@router.get("/patient/{patient_id}/chart")
def patient_chart(
    patient_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(require_doctor),
):
    patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current.clinic_id,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    visits = db.query(Appointment).options(
        joinedload(Appointment.vitals),
        joinedload(Appointment.soap_note),
    ).filter(Appointment.patient_id == patient_id).order_by(desc(Appointment.appointment_date)).limit(20).all()

    prescriptions = db.query(Prescription).options(
        joinedload(Prescription.items)
    ).filter(Prescription.patient_id == patient_id).order_by(desc(Prescription.created_at)).limit(10).all()

    lab_orders = db.query(LabOrder).options(
        joinedload(LabOrder.items)
    ).filter(LabOrder.patient_id == patient_id).order_by(desc(LabOrder.created_at)).limit(10).all()

    return {
        "patient": {
            "id": patient.id, "uhid": patient.uhid, "full_name": patient.full_name,
            "age": _age(patient), "gender": patient.gender,
            "blood_group": patient.blood_group, "allergies": patient.allergies,
        },
        "visits": [
            {"id": v.id, "date": str(v.appointment_date), "status": v.status, "reason": v.reason,
             "soap": {"assessment": v.soap_note.assessment, "plan": v.soap_note.plan} if v.soap_note else None}
            for v in visits
        ],
        "prescriptions": [
            {"id": p.id, "date": str(p.created_at.date()), "status": p.status,
             "items": [{"medicine": i.medicine_name, "dosage": i.dosage, "duration": i.duration} for i in p.items]}
            for p in prescriptions
        ],
        "lab_orders": [
            {"id": lo.id, "date": str(lo.created_at.date()), "status": lo.status,
             "tests": [{"name": i.test_name, "result": i.result_value, "abnormal": i.is_abnormal} for i in lo.items]}
            for lo in lab_orders
        ],
    }


@router.get("/profile")
def get_my_doctor_profile(db: Session = Depends(get_db), current: Staff = Depends(require_doctor)):
    profile = db.query(DoctorProfile).filter(DoctorProfile.staff_id == current.id).first()
    return {
        "id":                 current.id,
        "full_name":          current.full_name,
        "email":              current.email,
        "mobile":             current.mobile,
        "specialty":          profile.specialty if profile else None,
        "qualification":      profile.qualification if profile else None,
        "mci_number":         profile.mci_number if profile else None,
        "experience_years":   profile.experience_years if profile else None,
        "consultation_fee":   float(profile.consultation_fee) if profile and profile.consultation_fee else 0,
        "bio":                profile.bio if profile else None,
        "languages":          profile.languages if profile else None,
        "telehealth_enabled": profile.telehealth_enabled if profile else False,
        "doctor_profile_id":  profile.id if profile else None,
        "input_mode":         profile.input_mode if profile else 'type',
    }


@router.put("/profile")
def update_my_doctor_profile(body: dict, db: Session = Depends(get_db), current: Staff = Depends(require_doctor)):
    if body.get("full_name"):
        current.full_name = body["full_name"]
    profile = db.query(DoctorProfile).filter(DoctorProfile.staff_id == current.id).first()
    if not profile:
        profile = DoctorProfile(staff_id=current.id, clinic_id=current.clinic_id)
        db.add(profile)
    for field in ["specialty", "qualification", "mci_number", "experience_years", "consultation_fee", "bio", "languages", "telehealth_enabled", "input_mode"]:
        if field in body:
            setattr(profile, field, body[field])
    db.commit()
    return {"message": "Profile updated"}


@router.post("/encounter/{appointment_id}/join-telehealth")
def log_telehealth_join(
    appointment_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(require_doctor),
):
    """Log when a doctor joins a telehealth session — compliance requirement (Telemedicine Guidelines 2020)."""
    from datetime import datetime as _dt
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.clinic_id == current.clinic_id,
    ).first()
    if not appt:
        raise HTTPException(404, "Appointment not found")
    if appt.mode != "telehealth":
        raise HTTPException(400, "This is not a telehealth appointment")
    appt.telehealth_joined_at = _dt.utcnow()
    appt.status = "in_progress"
    db.commit()
    return {
        "room": f"bharatcliniq-appt-{appointment_id}",
        "url":  f"https://meet.jit.si/bharatcliniq-appt-{appointment_id}",
        "joined_at": appt.telehealth_joined_at.isoformat(),
    }
