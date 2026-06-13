from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from datetime import date as dt
from app.db.session import get_db
from app.core.security import get_current_staff
from app.models.models import (
    Appointment, OnlineBooking, Patient, Staff, DoctorProfile,
    Vitals, SoapNote
)
from app.schemas.schemas import (
    AppointmentCreate, AppointmentUpdate, AppointmentOut,
    VitalsCreate, SoapNoteCreate
)

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _next_token(db, doctor_id, appt_date, branch_id) -> int:
    count = db.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == appt_date,
        Appointment.branch_id == branch_id,
    ).count()
    return count + 1


@router.post("/", response_model=AppointmentOut)
def create_appointment(
    payload: AppointmentCreate,
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    # Default branch_id to staff's branch
    if not branch_id:
        branch_id = current.branch_id or 1

    # Resolve doctor_id: if it's a staff_id, find the DoctorProfile
    if payload.doctor_id:
        from app.models.models import DoctorProfile as DP
        dp = db.query(DP).filter(DP.staff_id == payload.doctor_id).first()
        if dp:
            payload.doctor_id = dp.id

    patient = db.query(Patient).filter(
        Patient.id == payload.patient_id,
        Patient.clinic_id == current.clinic_id,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.id == payload.doctor_id).first()
    doctor_name = doctor_profile.staff.full_name if doctor_profile and doctor_profile.staff else ""

    token = _next_token(db, payload.doctor_id, payload.appointment_date, branch_id)
    appt = Appointment(
        clinic_id=current.clinic_id,
        branch_id=branch_id,
        token_number=token,
        patient_name=patient.full_name,
        doctor_name=doctor_name,
        **payload.model_dump(),
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return appt


@router.get("/", response_model=List[AppointmentOut])
def list_appointments(
    branch_id: Optional[int] = None,
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    appointment_date: Optional[dt] = None,
    date: Optional[dt] = None,
    date_from: Optional[dt] = None,
    date_to: Optional[dt] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    # Accept either 'date' or 'appointment_date' query param
    filter_date = appointment_date or date

    q = db.query(Appointment).options(
        joinedload(Appointment.patient),
        joinedload(Appointment.doctor).joinedload(DoctorProfile.staff),
    ).filter(Appointment.clinic_id == current.clinic_id)
    if branch_id:
        q = q.filter(Appointment.branch_id == branch_id)
    elif current.branch_id:
        q = q.filter(Appointment.branch_id == current.branch_id)
    if doctor_id:
        q = q.filter(Appointment.doctor_id == doctor_id)
    if patient_id:
        q = q.filter(Appointment.patient_id == patient_id)
    if filter_date:
        q = q.filter(Appointment.appointment_date == filter_date)
    if date_from:
        q = q.filter(Appointment.appointment_date >= date_from)
    if date_to:
        q = q.filter(Appointment.appointment_date <= date_to)
    if status:
        q = q.filter(Appointment.status == status)
    appts = q.order_by(Appointment.appointment_date, Appointment.token_number).offset(skip).limit(limit).all()

    # Enrich with patient/doctor names and demographics
    result = []
    for a in appts:
        out = AppointmentOut.model_validate(a)
        if a.patient:
            out.patient_name = a.patient.full_name
            out.bh_id = a.patient.bh_id
            out.clinic_patient_id = a.patient.clinic_patient_id
            out.gender = a.patient.gender
            if a.patient.date_of_birth:
                from datetime import date as _date
                dob = a.patient.date_of_birth
                today = _date.today()
                out.age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        if a.doctor and a.doctor.staff:
            out.doctor_name = a.doctor.staff.full_name
        result.append(out)
    return result


@router.put("/{appt_id}", response_model=AppointmentOut)
def update_appointment(
    appt_id: int,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    appt = db.query(Appointment).filter(
        Appointment.id == appt_id, Appointment.clinic_id == current.clinic_id
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    data = payload.model_dump(exclude_unset=True)
    # doctor_id may arrive as staff_id — resolve to DoctorProfile like create does
    if data.get("doctor_id"):
        dp = db.query(DoctorProfile).filter(DoctorProfile.staff_id == data["doctor_id"]).first()
        if not dp:
            dp = db.query(DoctorProfile).filter(DoctorProfile.id == data["doctor_id"]).first()
        if dp:
            data["doctor_id"] = dp.id
            appt.doctor_name = dp.staff.full_name if dp.staff else appt.doctor_name
    for k, v in data.items():
        setattr(appt, k, v)
    db.commit()
    db.refresh(appt)
    return appt


# ── Online booking management (for receptionists) ─────────────────────────────

@router.get("/online-bookings")
def list_online_bookings(
    status: Optional[str] = "pending",
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """See all online bookings made via the public website."""
    q = db.query(OnlineBooking).filter(OnlineBooking.clinic_id == current.clinic_id)
    if status:
        q = q.filter(OnlineBooking.status == status)
    bookings = q.order_by(OnlineBooking.booking_date, OnlineBooking.booking_time).all()
    result = []
    for b in bookings:
        doc_name = None
        if b.doctor and b.doctor.staff:
            doc_name = b.doctor.staff.full_name
        result.append({
            "id": b.id,
            "clinic_id": b.clinic_id,
            "doctor_id": b.doctor_id,
            "doctor_name": doc_name,
            "patient_name": b.patient_name,
            "patient_mobile": b.patient_mobile,
            "booking_date": str(b.booking_date),
            "booking_time": b.booking_time,
            "reason": b.reason,
            "status": b.status,
            "confirmation_code": b.confirmation_code,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        })
    return result


@router.post("/online-bookings/{booking_id}/confirm")
def confirm_online_booking(
    booking_id: int,
    patient_id: Optional[int] = Query(None, description="Existing patient ID; omit to auto-match by mobile or auto-register"),
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """
    Confirm an online booking and convert it to a proper appointment.
    If no patient_id is given, the patient is matched by mobile number
    within this clinic, or auto-registered from the booking details.
    The patient record is linked to their portal account (by mobile) so the
    appointment appears in their My Health Portal.
    """
    from app.models.models import PatientUser

    booking = db.query(OnlineBooking).filter(
        OnlineBooking.id == booking_id,
        OnlineBooking.clinic_id == current.clinic_id,
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "pending":
        raise HTTPException(status_code=400, detail=f"Booking is already {booking.status}")

    portal_user = db.query(PatientUser).filter(
        PatientUser.mobile == booking.patient_mobile
    ).first() if booking.patient_mobile else None

    conf_patient = None
    if patient_id:
        conf_patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not conf_patient and booking.patient_mobile:
        conf_patient = db.query(Patient).filter(
            Patient.clinic_id == current.clinic_id,
            Patient.mobile == booking.patient_mobile,
        ).first()
    if not conf_patient:
        conf_patient = Patient(
            clinic_id=current.clinic_id,
            branch_id=booking.branch_id,
            full_name=booking.patient_name or "Patient",
            mobile=booking.patient_mobile,
            email=booking.patient_email,
            portal_user_id=portal_user.id if portal_user else None,
        )
        db.add(conf_patient)
        db.flush()
    elif portal_user and not conf_patient.portal_user_id:
        conf_patient.portal_user_id = portal_user.id

    patient_id = conf_patient.id
    if portal_user and not booking.patient_user_id:
        booking.patient_user_id = portal_user.id

    conf_doc_profile = db.query(DoctorProfile).filter(DoctorProfile.id == booking.doctor_id).first()
    conf_patient_name = conf_patient.full_name if conf_patient else booking.patient_name or ""
    conf_doctor_name = conf_doc_profile.staff.full_name if conf_doc_profile and conf_doc_profile.staff else ""

    token = _next_token(db, booking.doctor_id, booking.booking_date, booking.branch_id)
    appt = Appointment(
        clinic_id=current.clinic_id,
        branch_id=booking.branch_id,
        patient_id=patient_id,
        doctor_id=booking.doctor_id,
        appointment_date=booking.booking_date,
        appointment_time=booking.booking_time,
        token_number=token,
        status='confirmed',
        mode='online',
        reason=booking.reason,
        online_booking_id=booking.id,
        patient_name=conf_patient_name,
        doctor_name=conf_doctor_name,
    )
    db.add(appt)
    booking.status = "confirmed"
    db.commit()
    db.refresh(appt)
    return {"message": "Booking confirmed", "appointment_id": appt.id, "token": token}


@router.post("/online-bookings/{booking_id}/cancel")
def cancel_online_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    booking = db.query(OnlineBooking).filter(
        OnlineBooking.id == booking_id,
        OnlineBooking.clinic_id == current.clinic_id,
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking.status = "cancelled"
    db.commit()
    return {"message": "Booking cancelled"}


# ── Vitals & SOAP ─────────────────────────────────────────────────────────────

@router.post("/vitals")
def record_vitals(
    payload: VitalsCreate,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    existing = db.query(Vitals).filter(
        Vitals.appointment_id == payload.appointment_id
    ).first()
    if existing:
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(existing, k, v)
        db.commit()
        return existing
    vitals = Vitals(**payload.model_dump())
    db.add(vitals)
    db.commit()
    db.refresh(vitals)
    return vitals


@router.post("/soap-note")
def save_soap_note(
    payload: SoapNoteCreate,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    if current.role not in ['doctor', 'clinic_admin']:
        raise HTTPException(status_code=403, detail="Only doctors can write SOAP notes")
    existing = db.query(SoapNote).filter(
        SoapNote.appointment_id == payload.appointment_id
    ).first()
    if existing:
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(existing, k, v)
        db.commit()
        return existing
    note = SoapNote(**payload.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note
