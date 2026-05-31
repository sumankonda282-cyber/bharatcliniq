"""
Public Website API — no authentication required.
Powers: bharathealth.com landing page, clinic finder, doctor search,
        available slot listing, online appointment booking.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, List
from datetime import date, datetime, timedelta

from app.db.session import get_db
from app.models.models import (
    Clinic, Branch, Staff, DoctorProfile, DoctorSchedule,
    Appointment, OnlineBooking
)
from app.schemas.schemas import OnlineBookingCreate, OnlineBookingOut
from app.core.security import hash_password
import random
import string

def __slugify(text):
    import re
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    text = re.sub(r'^-+|-+$', '', text)
    return text

router = APIRouter(prefix="/public", tags=["public-website"])


def _gen_confirmation_code() -> str:
    return "BH" + "".join(random.choices(string.digits, k=6))


# ── Clinic Discovery ──────────────────────────────────────────────────────────

@router.get("/clinics")
def search_clinics(
    city: Optional[str] = None,
    specialty: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """Search verified active clinics - shown on public website."""
    q = db.query(Clinic).filter(
        Clinic.is_active == True,
        Clinic.is_verified == True,
    )
    if city:
        q = q.filter(Clinic.city.ilike(f"%{city}%"))
    if specialty:
        q = q.filter(Clinic.specialty.ilike(f"%{specialty}%"))
    if search:
        q = q.filter(
            Clinic.name.ilike(f"%{search}%") |
            Clinic.specialty.ilike(f"%{search}%")
        )
    clinics = q.offset(skip).limit(limit).all()
    result = []
    for c in clinics:
        # Get doctors for this clinic
        from app.models.models import DoctorProfile as DP, Staff as ST
        doctors = db.query(DP).join(ST, DP.staff_id == ST.id).filter(
            ST.clinic_id == c.id, ST.is_active == True
        ).all()
        result.append({
            "id":          c.id,
            "name":        c.name,
            "slug":        c.slug,
            "specialty":   c.specialty,
            "description": c.description,
            "logo_url":    c.logo_url,
            "city":        c.city,
            "state":       c.state,
            "phone":       c.phone,
            "email":       c.email,
            "address":     c.address,
            "doctor_count": len(doctors),
            "doctors": [{
                "id":             d.id,
                "name":           d.staff.full_name if d.staff else "Doctor",
                "specialization": d.specialty,
                "qualification":  d.qualification,
                "experience_years": d.experience_years,
                "consultation_fee": float(d.consultation_fee) if d.consultation_fee else 0,
                "telehealth_enabled": d.telehealth_enabled or False,
            } for d in doctors[:5]],
        })
    return result


@router.get("/clinics/{slug}")
def get_clinic_public(slug: str, db: Session = Depends(get_db)):
    """Public clinic profile page."""
    clinic = db.query(Clinic).filter(
        Clinic.slug == slug,
        Clinic.is_active == True,
        Clinic.is_verified == True,
    ).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    branches = db.query(Branch).filter(
        Branch.clinic_id == clinic.id, Branch.is_active == True
    ).all()

    doctors = (
        db.query(Staff, DoctorProfile)
        .join(DoctorProfile, DoctorProfile.staff_id == Staff.id)
        .filter(
            Staff.clinic_id == clinic.id,
            Staff.is_active == True,
        )
        .all()
    )

    return {
        "id": clinic.id,
        "name": clinic.name,
        "slug": clinic.slug,
        "specialty": clinic.specialty,
        "description": clinic.description,
        "logo_url": clinic.logo_url,
        "city": clinic.city,
        "state": clinic.state,
        "address": clinic.address,
        "phone": clinic.phone,
        "email": clinic.email,
        "branches": [
            {"id": b.id, "name": b.name, "address": b.address, "city": b.city, "phone": b.phone}
            for b in branches
        ],
        "doctors": [
            {
                "profile_id": dp.id,
                "staff_id": s.id,
                "name": s.full_name,
                "specialization": dp.specialty,
                "qualification": dp.qualification,
                "experience_years": dp.experience_years,
                "consultation_fee": float(dp.consultation_fee) if dp.consultation_fee else 0,
                "bio": dp.bio,
                "languages": dp.languages,

            }
            for s, dp in doctors
        ],
    }


# ── Doctor Slot Availability ──────────────────────────────────────────────────

@router.get("/doctors/{doctor_profile_id}/slots")
def get_available_slots(
    doctor_profile_id: int,
    branch_id: int,
    booking_date: date = Query(...),
    db: Session = Depends(get_db),
):
    """
    Returns all time slots for a doctor on a given date.
    Each slot is marked available or booked.
    """
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_profile_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Get schedule for this day
    day_name = booking_date.strftime("%A").lower()
    schedule = db.query(DoctorSchedule).filter(
        DoctorSchedule.doctor_id == doctor_profile_id,
        DoctorSchedule.branch_id == branch_id,
        DoctorSchedule.day_of_week == day_name,
        DoctorSchedule.is_active == True,
    ).first()

    if not schedule:
        return {"available": False, "reason": "Doctor not available on this day", "slots": []}

    # Generate all possible slots
    from datetime import datetime as dt
    start = dt.strptime(schedule.start_time, "%H:%M")
    end = dt.strptime(schedule.end_time, "%H:%M")
    slots = []
    current = start
    while current < end:
        slots.append(current.strftime("%H:%M"))
        current += timedelta(minutes=schedule.slot_minutes)

    # Check booked slots from appointments
    booked_appts = db.query(Appointment.appointment_time).filter(
        Appointment.doctor_id == doctor_profile_id,
        Appointment.appointment_date == booking_date,
        Appointment.branch_id == branch_id,
        Appointment.status.in_([
            'confirmed',
            'pending',
            'in_progress',
        ])
    ).all()
    booked_online = db.query(OnlineBooking.booking_time).filter(
        OnlineBooking.doctor_id == doctor_profile_id,
        OnlineBooking.booking_date == booking_date,
        OnlineBooking.branch_id == branch_id,
        OnlineBooking.status.in_(["pending", "confirmed"]),
    ).all()

    booked_times = {r[0] for r in booked_appts} | {r[0] for r in booked_online}

    return {
        "available": True,
        "doctor_id": doctor_profile_id,
        "branch_id": branch_id,
        "date": str(booking_date),
        "slot_duration_minutes": schedule.slot_minutes,
        "slots": [
            {
                "time": slot,
                "available": slot not in booked_times,
            }
            for slot in slots
        ],
    }


# ── Online Booking ────────────────────────────────────────────────────────────

@router.post("/book", response_model=OnlineBookingOut)
def book_appointment_online(
    payload: OnlineBookingCreate,
    db: Session = Depends(get_db),
):
    """
    Book an appointment from the public website.
    No login required — patient just fills name + mobile.
    Clinic staff will confirm it.
    """
    # Validate slot is still available
    slot_data = get_available_slots(
        payload.doctor_id, payload.branch_id, payload.booking_date, db
    )
    if not slot_data["available"]:
        raise HTTPException(status_code=400, detail="Doctor not available on this day")

    slot = next((s for s in slot_data["slots"] if s["time"] == payload.booking_time), None)
    if not slot:
        raise HTTPException(status_code=400, detail="Invalid time slot")
    if not slot["available"]:
        raise HTTPException(status_code=400, detail="This slot is already booked. Please choose another.")

    # Check for duplicate booking by same mobile
    existing = db.query(OnlineBooking).filter(
        OnlineBooking.patient_mobile == payload.patient_mobile,
        OnlineBooking.doctor_id == payload.doctor_id,
        OnlineBooking.booking_date == payload.booking_date,
        OnlineBooking.status.in_(["pending", "confirmed"]),
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have a booking with this doctor on this date."
        )

    booking = OnlineBooking(
        clinic_id=payload.clinic_id,
        branch_id=payload.branch_id,
        doctor_id=payload.doctor_id,
        patient_name=payload.patient_name,
        patient_mobile=payload.patient_mobile,
        patient_email=payload.patient_email,
        booking_date=payload.booking_date,
        booking_time=payload.booking_time,
        reason=payload.reason,
        status="pending",
        confirmation_code=_gen_confirmation_code(),
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/booking/{confirmation_code}")
def get_booking_status(confirmation_code: str, db: Session = Depends(get_db)):
    """Check booking status using confirmation code."""
    booking = db.query(OnlineBooking).filter(
        OnlineBooking.confirmation_code == confirmation_code
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    clinic = db.query(Clinic).filter(Clinic.id == booking.clinic_id).first()
    branch = db.query(Branch).filter(Branch.id == booking.branch_id).first()
    doctor_profile = db.query(DoctorProfile).filter(
        DoctorProfile.id == booking.doctor_id
    ).first()
    doctor_staff = db.query(Staff).filter(
        Staff.id == doctor_profile.staff_id
    ).first() if doctor_profile else None

    return {
        "confirmation_code": booking.confirmation_code,
        "status": booking.status,
        "patient_name": booking.patient_name,
        "booking_date": str(booking.booking_date),
        "booking_time": booking.booking_time,
        "clinic_name": clinic.name if clinic else "",
        "branch_name": branch.name if branch else "",
        "branch_address": branch.address if branch else "",
        "doctor_name": doctor_staff.full_name if doctor_staff else "",
        "created_at": str(booking.created_at),
    }


@router.get("/cities")
def get_active_cities(db: Session = Depends(get_db)):
    """Return distinct cities that have active clinics."""
    cities = db.query(Clinic.city).filter(
        Clinic.is_active == True,
        Clinic.is_verified == True,
        Clinic.city != None,
    ).distinct().all()
    return {"cities": [c[0] for c in cities if c[0]]}


@router.get("/stats")
def platform_stats(db: Session = Depends(get_db)):
    """Public stats for homepage."""
    clinics = db.query(func.count(Clinic.id)).filter(Clinic.is_active == True).scalar()
    doctors = db.query(func.count(DoctorProfile.id)).scalar()
    bookings = db.query(func.count(OnlineBooking.id)).scalar()
    return {
        "total_clinics": clinics,
        "total_doctors": doctors,
        "total_bookings": bookings,
    }


@router.post("/register-clinic")
def register_clinic(body: dict, db: Session = Depends(get_db)):
    """
    Self-service clinic registration from public website.
    Creates: Clinic + Branch + Staff (clinic_admin) + DoctorProfile
    """
    import random, string, re
    def _slugify(text):
        text = text.lower().strip()
        text = re.sub(r'[^\w\s-]', '', text)
        text = re.sub(r'[\s_-]+', '-', text)
        text = re.sub(r'^-+|-+$', '', text)
        return text

    clinic_data   = body.get("clinic", {})
    doctor_data   = body.get("doctor", {})
    admin_email   = body.get("admin_email", "")
    admin_password = body.get("admin_password", "")

    # Validate
    if not clinic_data.get("name") or not admin_email or not admin_password:
        raise HTTPException(400, "Clinic name, email and password are required")

    # Check email not already used
    existing = db.query(Staff).filter(Staff.email == admin_email).first()
    if existing:
        raise HTTPException(400, "An account with this email already exists. Please login.")

    # Generate unique slug
    base_slug = _slugify(clinic_data["name"])
    slug = base_slug
    counter = 1
    while db.query(Clinic).filter(Clinic.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Create clinic
    clinic = Clinic(
        name                = clinic_data["name"],
        slug                = slug,
        specialty           = clinic_data.get("specialty", "General Medicine"),
        phone               = clinic_data.get("phone"),
        email               = clinic_data.get("email"),
        address             = clinic_data.get("address"),
        city                = clinic_data.get("city"),
        state               = clinic_data.get("state"),
        pincode             = clinic_data.get("pincode"),
        is_active           = False,  # Inactive until platform admin verifies
        is_verified         = False,
        subscription_plan   = 'free',
        subscription_status = 'active',
    )
    db.add(clinic)
    db.flush()

    # Create default branch
    branch = Branch(
        clinic_id = clinic.id,
        name      = "Main Branch",
        address   = clinic_data.get("address"),
        city      = clinic_data.get("city"),
        phone     = clinic_data.get("phone"),
        is_active = True,
    )
    db.add(branch)
    db.flush()

    # Create clinic admin / doctor staff
    staff = Staff(
        clinic_id       = clinic.id,
        branch_id       = branch.id,
        full_name       = doctor_data.get("full_name", "Clinic Admin"),
        email           = admin_email,
        hashed_password = hash_password(admin_password),
        role            = 'clinic_admin',
        is_active       = False,  # Activated when clinic approved
    )
    db.add(staff)
    db.flush()

    # Create doctor profile
    doctor_profile = DoctorProfile(
        staff_id         = staff.id,
        clinic_id        = clinic.id,
        specialty           = clinic_data.get("specialty", "General Medicine"),
        qualification    = doctor_data.get("qualification"),
        mci_number          = doctor_data.get("registration_number"),
        experience_years = int(doctor_data.get("experience_years") or 0),
        consultation_fee = float(doctor_data.get("consultation_fee", 500)),
        is_active        = True,
    )
    db.add(doctor_profile)
    db.commit()

    return {
        "success": True,
        "clinic_name": clinic.name,
        "clinic_slug": clinic.slug,
        "public_url": f"/clinics/{clinic.slug}",
        "login_email": admin_email,
        "message": "Registration successful! Your clinic is pending approval. Login at provider.bharatcliniq.com once approved."
    }
