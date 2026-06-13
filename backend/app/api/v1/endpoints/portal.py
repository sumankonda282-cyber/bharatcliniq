from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from app.db.session import get_db
from app.core.config import settings
from app.models.models import PatientUser, Patient, BHProfile, DrugCounselling

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
    from app.models.models import Appointment, DoctorProfile, Clinic, OnlineBooking
    patients = db.query(Patient).filter(Patient.portal_user_id == current.id).all()
    patient_ids = [p.id for p in patients]

    result = []
    converted_booking_ids = set()

    if patient_ids:
        appts = db.query(Appointment).filter(
            Appointment.patient_id.in_(patient_ids)
        ).order_by(Appointment.appointment_date.desc()).limit(50).all()
        for a in appts:
            if a.online_booking_id:
                converted_booking_ids.add(a.online_booking_id)
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
                "source": "clinic",
                "doctor_profile_id": a.doctor_id,
            })

    # Online bookings made via the public website or this portal, matched by
    # account or mobile number — visible even before the health center confirms
    bookings = db.query(OnlineBooking).filter(
        (OnlineBooking.patient_user_id == current.id) |
        (OnlineBooking.patient_mobile == current.mobile)
    ).order_by(OnlineBooking.booking_date.desc()).limit(50).all()
    for b in bookings:
        if b.id in converted_booking_ids:
            continue  # already shown as a clinic-confirmed appointment
        doc = db.query(DoctorProfile).filter(DoctorProfile.id == b.doctor_id).first() if b.doctor_id else None
        clinic = db.query(Clinic).filter(Clinic.id == b.clinic_id).first()
        result.append({
            "id": f"ob-{b.id}",
            "date": str(b.booking_date),
            "time": b.booking_time,
            "status": b.status or "pending",
            "doctor_name": doc.staff.full_name if doc and doc.staff else "Doctor",
            "clinic_name": clinic.name if clinic else "Unknown",
            "clinic_address": clinic.address if clinic else None,
            "clinic_city": clinic.city if clinic else None,
            "reason": b.reason,
            "token_number": None,
            "mode": "online",
            "source": "online_booking",
            "confirmation_code": b.confirmation_code,
            "patient_name": b.patient_name,
            "doctor_profile_id": b.doctor_id,
            "booking_id": b.id,
        })

    result.sort(key=lambda x: ((x["date"] or ""), (x["time"] or "")), reverse=True)
    return {"appointments": result}


@router.get("/clinical-history")
def portal_clinical_history(current=Depends(get_current_patient), db: Session = Depends(get_db)):
    """Full clinical record of every completed visit — SOAP notes, vitals,
    tests, prescriptions — one call, chronological, newest first."""
    from app.models.models import (
        Appointment, DoctorProfile, Clinic, SoapNote, Vitals,
        Prescription, PrescriptionItem, LabOrder,
    )
    patient_ids = [
        p.id for p in db.query(Patient).filter(Patient.portal_user_id == current.id).all()
    ]
    if not patient_ids:
        return {"visits": []}

    appts = db.query(Appointment).filter(
        Appointment.patient_id.in_(patient_ids)
    ).order_by(Appointment.appointment_date.desc()).limit(200).all()

    visits = []
    for a in appts:
        doc = db.query(DoctorProfile).filter(DoctorProfile.id == a.doctor_id).first()
        clinic = db.query(Clinic).filter(Clinic.id == a.clinic_id).first()
        soap = db.query(SoapNote).filter(SoapNote.appointment_id == a.id).first()
        vit = db.query(Vitals).filter(Vitals.appointment_id == a.id).first()

        vitals = None
        if vit:
            vitals = {
                "bp": f"{vit.blood_pressure_systolic}/{vit.blood_pressure_diastolic}"
                      if vit.blood_pressure_systolic and vit.blood_pressure_diastolic else None,
                "pulse": vit.pulse_rate,
                "temperature": float(vit.temperature) if vit.temperature else None,
                "weight_kg": float(vit.weight_kg) if vit.weight_kg else None,
                "height_cm": float(vit.height_cm) if vit.height_cm else None,
                "spo2": vit.oxygen_saturation,
                "blood_sugar": float(vit.blood_sugar) if vit.blood_sugar else None,
            }
            if not any(vitals.values()):
                vitals = None

        medications = []
        rxs = db.query(Prescription).filter(Prescription.appointment_id == a.id).all()
        for rx in rxs:
            for item in db.query(PrescriptionItem).filter(
                PrescriptionItem.prescription_id == rx.id
            ).all():
                medications.append({
                    "name": item.medicine_name or (item.medicine.name if item.medicine else "Medicine"),
                    "dosage": item.dosage,
                    "frequency": item.frequency,
                    "duration": item.duration,
                    "instructions": item.instructions,
                })

        tests = []
        for order in db.query(LabOrder).filter(LabOrder.appointment_id == a.id).all():
            tests.append({
                "order_id": order.order_id,
                "test_names": order.test_names or [],
                "status": order.status,
                "clinical_notes": order.clinical_notes,
            })

        note = None
        if soap:
            note = {
                "reason_for_visit": soap.reason_for_visit,
                "complaints": soap.patient_complaints or soap.subjective,
                "past_history": soap.past_history,
                "examination": soap.objective,
                "investigations": soap.investigations_findings,
                "assessment": soap.discharge_assessment or soap.assessment,
                "medications_text": soap.medications_prescribed,
                "plan_counselling": soap.cautions_followup or soap.plan,
                "follow_up_days": soap.follow_up_days,
            }
            if not any(v for v in note.values()):
                note = None

        visits.append({
            "appointment_id": a.id,
            "date": str(a.appointment_date),
            "time": a.appointment_time,
            "status": str(a.status) if a.status else None,
            "mode": a.mode or "offline",
            "visit_type": a.visit_type,
            "reason": a.reason,
            "doctor_name": doc.staff.full_name if doc and doc.staff else "Unknown",
            "doctor_specialty": doc.specialty if doc else None,
            "clinic_name": clinic.name if clinic else "Unknown",
            "clinic_city": clinic.city if clinic else None,
            "vitals": vitals,
            "note": note,
            "medications": medications,
            "tests": tests,
            "has_documentation": bool(note or vitals or medications or tests),
        })

    return {"visits": visits}


@router.post("/appointments/{appointment_id}/join")
async def portal_join_telehealth(
    appointment_id: int,
    current=Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    """Patient joins their telehealth visit — gated by session state machine."""
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


@router.post("/book")
def portal_book_appointment(
    body: dict,
    current: PatientUser = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    """
    Book an appointment from inside the patient portal.
    Reuses the public booking flow, with name/mobile taken from the
    logged-in account so the booking is always linked to it.
    """
    from app.schemas.schemas import OnlineBookingCreate
    from app.api.v1.endpoints.public import book_appointment_online

    try:
        payload = OnlineBookingCreate(
            clinic_id=body.get("clinic_id"),
            branch_id=body.get("branch_id"),
            doctor_id=body.get("doctor_id"),
            patient_name=(body.get("patient_name") or current.full_name or "Patient").strip(),
            patient_mobile=current.mobile,
            patient_email=body.get("patient_email") or current.email or None,
            booking_date=body.get("booking_date"),
            booking_time=body.get("booking_time"),
            reason=body.get("reason"),
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid booking details: {e}")

    booking = book_appointment_online(payload, db)
    if not booking.patient_user_id:
        booking.patient_user_id = current.id
        db.commit()
        db.refresh(booking)
    return {
        "id": booking.id,
        "confirmation_code": booking.confirmation_code,
        "status": booking.status,
        "booking_date": str(booking.booking_date),
        "booking_time": booking.booking_time,
    }


@router.post("/bookings/{booking_id}/cancel")
def portal_cancel_booking(
    booking_id: int,
    current: PatientUser = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    from app.models.models import OnlineBooking, Appointment
    # Try online booking first
    booking = db.query(OnlineBooking).filter(
        OnlineBooking.id == booking_id,
        (OnlineBooking.patient_user_id == current.id) | (OnlineBooking.patient_mobile == current.mobile)
    ).first()
    if booking:
        if booking.status in ('pending', 'confirmed'):
            booking.status = 'cancelled'
            db.commit()
            return {"cancelled": True, "type": "online_booking"}
        raise HTTPException(status_code=400, detail="Cannot cancel this booking")
    raise HTTPException(status_code=404, detail="Booking not found")

@router.post("/appointments/{appointment_id}/cancel")
def portal_cancel_appointment(
    appointment_id: int,
    current: PatientUser = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    from app.models.models import Appointment, Patient
    patients = db.query(Patient).filter(Patient.portal_user_id == current.id).all()
    patient_ids = [p.id for p in patients]
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.patient_id.in_(patient_ids)
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.status in ('pending', 'confirmed'):
        appt.status = 'cancelled'
        db.commit()
        return {"cancelled": True}
    raise HTTPException(status_code=400, detail="Cannot cancel this appointment")

@router.put("/bookings/{booking_id}/reschedule")
def portal_reschedule_booking(
    booking_id: int,
    body: dict,
    current: PatientUser = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    from app.models.models import OnlineBooking
    booking = db.query(OnlineBooking).filter(
        OnlineBooking.id == booking_id,
        (OnlineBooking.patient_user_id == current.id) | (OnlineBooking.patient_mobile == current.mobile)
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status not in ('pending', 'confirmed'):
        raise HTTPException(status_code=400, detail="Cannot reschedule this booking")
    if body.get("booking_date"):
        booking.booking_date = body["booking_date"]
    if body.get("booking_time"):
        booking.booking_time = body["booking_time"]
    db.commit()
    return {"rescheduled": True, "booking_date": str(booking.booking_date), "booking_time": booking.booking_time}


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

@router.get("/drug-counselling")
def portal_drug_counselling(
    generic: str,
    current: PatientUser = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    """Return patient counselling tips for a drug generic name."""
    rows = (
        db.query(DrugCounselling)
        .filter(DrugCounselling.generic.ilike(generic.strip()))
        .order_by(DrugCounselling.sort_order)
        .all()
    )
    return {"generic": generic, "tips": [r.tip for r in rows]}
