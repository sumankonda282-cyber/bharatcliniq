from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from app.db.session import get_db
from app.core.config import settings
from app.models.models import PatientUser, Patient

router = APIRouter(prefix="/portal", tags=["patient-portal"])
security = HTTPBearer()

def get_current_patient(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        if payload.get("user_type") != "patient":
            raise HTTPException(status_code=401, detail="Not a patient token")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="No user ID in token")
        user = db.query(PatientUser).filter(
            PatientUser.id == int(user_id)
        ).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token error: {str(e)}")

@router.get("/me")
def portal_me(
    current: PatientUser = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    patients = db.query(Patient).filter(
        Patient.portal_user_id == current.id
    ).all()
    return {
        "id": current.id,
        "full_name": current.full_name,
        "mobile": current.mobile,
        "email": current.email,
        "preferred_language": current.preferred_language,
        "bh_id": patients[0].uhid if patients else None,
        "linked_clinics": len(patients),
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
            "reason": a.reason,
            "token_number": a.token_number,
            "mode": a.mode or "offline",
        })
    return {"appointments": result}


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
    from app.models.models import LabOrder, DoctorProfile, Clinic
    patients = db.query(Patient).filter(Patient.portal_user_id == current.id).all()
    patient_ids = [p.id for p in patients]
    if not patient_ids:
        return {"lab_results": []}
    orders = db.query(LabOrder).filter(
        LabOrder.patient_id.in_(patient_ids)
    ).order_by(LabOrder.created_at.desc()).limit(30).all()
    result = []
    for lo in orders:
        doc = db.query(DoctorProfile).filter(DoctorProfile.id == lo.ordered_by).first() if lo.ordered_by else None
        clinic = db.query(Clinic).filter(Clinic.id == lo.clinic_id).first()
        items = [{"test_name": i.test_name, "result_value": i.result_value,
                  "is_abnormal": i.is_abnormal, "result_notes": i.result_notes} for i in lo.items]
        result.append({
            "id": lo.id,
            "date": str(lo.created_at.date()) if lo.created_at else None,
            "doctor_name": doc.staff.full_name if doc and doc.staff else "Unknown",
            "clinic_name": clinic.name if clinic else "Unknown",
            "status": str(lo.status) if lo.status else "pending",
            "items": items,
        })
    return {"lab_results": result}


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
        db.commit()

    db.refresh(current)
    return {"message": "Profile updated successfully"}

import random
from app.core.security import hash_password, verify_password

def _generate_pin():
    return str(random.randint(100000, 999999))

@router.get("/pin")
def get_pin(current: PatientUser = Depends(get_current_patient), db: Session = Depends(get_db)):
    if not current.disclosure_pin:
        raw = _generate_pin()
        current.disclosure_pin = hash_password(raw)
        current.disclosure_pin_plain = raw
        db.commit()
    return {"pin": current.disclosure_pin_plain or "------", "has_pin": bool(current.disclosure_pin)}

@router.post("/pin/generate")
def generate_new_pin(current: PatientUser = Depends(get_current_patient), db: Session = Depends(get_db)):
    raw = _generate_pin()
    current.disclosure_pin = hash_password(raw)
    current.disclosure_pin_plain = raw
    db.commit()
    return {"pin": raw}

@router.post("/pin/set")
def set_custom_pin(body: dict, current: PatientUser = Depends(get_current_patient), db: Session = Depends(get_db)):
    from fastapi import HTTPException
    pin = str(body.get("pin", "")).strip()
    if not pin.isdigit() or len(pin) != 6:
        raise HTTPException(status_code=400, detail="PIN must be exactly 6 digits")
    current.disclosure_pin = hash_password(pin)
    current.disclosure_pin_plain = pin
    db.commit()
    return {"message": "PIN updated successfully"}
