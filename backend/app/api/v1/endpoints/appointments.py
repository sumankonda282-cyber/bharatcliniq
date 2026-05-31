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

    token = _next_token(db, payload.doctor_id, payload.appointment_date, branch_id)
    appt = Appointment(
        clinic_id=current.clinic_id,
        branch_id=branch_id,
        token_number=token,
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
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    q = db.query(Appointment).filter(Appointment.clinic_id == current.clinic_id)
    if branch_id:
        q = q.filter(Appointment.branch_id == branch_id)
    elif current.branch_id:
        q = q.filter(Appointment.branch_id == current.branch_id)
    if doctor_id:
        q = q.filter(Appointment.doctor_id == doctor_id)
    if patient_id:
        q = q.filter(Appointment.patient_id == patient_id)
    if appointment_date:
        q = q.filter(Appointment.appointment_date == appointment_date)
    if status:
        q = q.filter(Appointment.status == status)
    return q.order_by(Appointment.appointment_date, Appointment.token_number).offset(skip).limit(limit).all()


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
    for k, v in payload.model_dump(exclude_unset=True).items():
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
    return q.order_by(OnlineBooking.booking_date, OnlineBooking.booking_time).all()


@router.post("/online-bookings/{booking_id}/confirm")
def confirm_online_booking(
    booking_id: int,
    patient_id: int = Query(..., description="Existing patient ID or newly registered"),
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """
    Confirm an online booking and convert it to a proper appointment.
    Receptionist links it to an existing or new patient.
    """
    booking = db.query(OnlineBooking).filter(
        OnlineBooking.id == booking_id,
        OnlineBooking.clinic_id == current.clinic_id,
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "pending":
        raise HTTPException(status_code=400, detail=f"Booking is already {booking.status}")

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
