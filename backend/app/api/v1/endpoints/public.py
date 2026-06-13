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
    Appointment, OnlineBooking, Feedback, PatientUser
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
    q: Optional[str] = None,
    available_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """Search verified active clinics - shown on public website."""
    keyword = search or q
    stmt = db.query(Clinic).filter(
        Clinic.is_active == True,
        Clinic.is_verified == True,
    )
    if city:
        stmt = stmt.filter(Clinic.city.ilike(f"%{city}%"))
    if specialty:
        stmt = stmt.filter(Clinic.specialty.ilike(f"%{specialty}%"))
    if keyword:
        stmt = stmt.filter(
            Clinic.name.ilike(f"%{keyword}%") |
            Clinic.specialty.ilike(f"%{keyword}%")
        )
    clinics = stmt.offset(skip).limit(limit).all()

    # Day-of-week filter when available_date provided
    day_name = available_date.strftime("%A").lower() if available_date else None

    result = []
    for c in clinics:
        from app.models.models import DoctorProfile as DP, Staff as ST
        doctors_q = db.query(DP).join(ST, DP.staff_id == ST.id).filter(
            ST.clinic_id == c.id, ST.is_active == True
        )
        doctors = doctors_q.all()

        if day_name:
            # Keep only doctors who have a schedule on that day of week
            available_ids = {
                row[0] for row in db.query(DoctorSchedule.doctor_id).filter(
                    DoctorSchedule.doctor_id.in_([d.id for d in doctors]),
                    DoctorSchedule.day_of_week == day_name,
                    DoctorSchedule.is_active == True,
                ).all()
            }
            doctors = [d for d in doctors if d.id in available_ids]
            if not doctors:
                continue  # skip clinic entirely if no available doctors that day

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
                "id":               d.id,
                "name":             d.staff.full_name if d.staff else "Doctor",
                "specialty":        d.specialty,
                "qualification":    d.qualification,
                "experience_years": d.experience_years,
                "fee":              float(d.consultation_fee) if d.consultation_fee else 0,
                "telehealth_enabled": d.telehealth_enabled or False,
                "available_day":    day_name,
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
    # Fallback: if no doctor profiles, return staff with role=doctor
    if not doctors:
        doctor_staff = db.query(Staff).filter(
            Staff.clinic_id == clinic.id,
            Staff.role == 'doctor',
            Staff.is_active == True,
        ).all()
        doctors = [(s, None) for s in doctor_staff]

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
        "default_branch_id": branches[0].id if branches else None,
        "branches": [
            {"id": b.id, "name": b.name, "address": b.address, "city": b.city, "phone": b.phone}
            for b in branches
        ],
        "doctors": [
            {
                "id":               dp.id if dp else s.id,
                "staff_id":         s.id,
                "name":             s.full_name,
                "specialty":        dp.specialty if dp else "General Medicine",
                "qualification":    dp.qualification if dp else "",
                "experience_years": dp.experience_years if dp else 0,
                "fee":              float(dp.consultation_fee) if dp and dp.consultation_fee else 0,
                "bio":              dp.bio if dp else "",
                "languages":        dp.languages if dp else [],
                "mci_verified":     dp.mci_verified if dp else False,
                "telehealth_enabled": dp.telehealth_enabled if dp else False,
                "telehealth_fee":   float(dp.telehealth_fee) if dp and dp.telehealth_fee else None,
                "accepting":        (dp.accepting_appointments if dp.accepting_appointments is not None else True) if dp else True,
            }
            for s, dp in doctors
        ],
    }


# ── Doctor Slot Availability ──────────────────────────────────────────────────

@router.get("/doctors/{doctor_profile_id}/slots")
def get_available_slots(
    doctor_profile_id: int,
    booking_date: date = Query(...),
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Returns all time slots for a doctor on a given date.
    Each slot is marked available or booked.
    """
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_profile_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Auto-resolve branch_id from doctor's clinic if not provided
    if not branch_id:
        branch = db.query(Branch).filter(
            Branch.clinic_id == doctor.clinic_id, Branch.is_active == True
        ).first()
        if branch:
            branch_id = branch.id

    # Get schedule for this day — try with branch first, then without
    day_name = booking_date.strftime("%A").lower()
    schedule = None
    if branch_id:
        schedule = db.query(DoctorSchedule).filter(
            DoctorSchedule.doctor_id == doctor_profile_id,
            DoctorSchedule.branch_id == branch_id,
            DoctorSchedule.day_of_week == day_name,
            DoctorSchedule.is_active == True,
        ).first()
    if not schedule:
        # Fallback: any active schedule for this doctor on this day
        schedule = db.query(DoctorSchedule).filter(
            DoctorSchedule.doctor_id == doctor_profile_id,
            DoctorSchedule.day_of_week == day_name,
            DoctorSchedule.is_active == True,
        ).first()
        if schedule and not branch_id:
            branch_id = schedule.branch_id

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
            'scheduled',
            'waiting',
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
        "accepting": doctor.accepting_appointments if doctor.accepting_appointments is not None else True,
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
    # Auto-resolve branch_id if not provided
    branch_id = payload.branch_id
    if not branch_id:
        branch = db.query(Branch).filter(
            Branch.clinic_id == payload.clinic_id, Branch.is_active == True
        ).first()
        if branch:
            branch_id = branch.id

    # Doctor may be blocked from new bookings by reception
    _doc = db.query(DoctorProfile).filter(DoctorProfile.id == payload.doctor_id).first()
    if _doc and _doc.accepting_appointments is False:
        raise HTTPException(status_code=400, detail="This doctor is not accepting new bookings right now. Please choose another doctor or call the clinic.")

    # Validate slot is still available
    slot_data = get_available_slots(
        payload.doctor_id, payload.booking_date, branch_id, db
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

    # Link to a patient portal account if one exists for this mobile,
    # so the booking shows up in their "My Appointments" immediately
    portal_user = db.query(PatientUser).filter(
        PatientUser.mobile == payload.patient_mobile
    ).first()

    booking = OnlineBooking(
        clinic_id=payload.clinic_id,
        branch_id=branch_id,
        doctor_id=payload.doctor_id,
        patient_user_id=portal_user.id if portal_user else None,
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
    clinics  = db.query(func.count(Clinic.id)).filter(Clinic.is_active == True, Clinic.is_verified == True).scalar()
    doctors  = db.query(func.count(DoctorProfile.id)).scalar()
    bookings = db.query(func.count(OnlineBooking.id)).scalar()
    cities   = db.query(func.count(func.distinct(Clinic.city))).filter(
        Clinic.is_active == True, Clinic.is_verified == True, Clinic.city != None
    ).scalar()
    return {
        "clinics":  clinics  or 0,
        "doctors":  doctors  or 0,
        "bookings": bookings or 0,
        "cities":   cities   or 0,
    }


@router.get("/doctors/{doctor_profile_id}")
def get_doctor_public(doctor_profile_id: int, db: Session = Depends(get_db)):
    """Public doctor profile page."""
    row = (
        db.query(DoctorProfile, Staff, Clinic)
        .join(Staff, DoctorProfile.staff_id == Staff.id)
        .join(Clinic, DoctorProfile.clinic_id == Clinic.id)
        .filter(DoctorProfile.id == doctor_profile_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Doctor not found")
    dp, s, c = row
    branches = db.query(Branch).filter(Branch.clinic_id == c.id, Branch.is_active == True).all()
    return {
        "id": dp.id,
        "staff_id": s.id,
        "name": s.full_name,
        "specialty": dp.specialty,
        "qualification": dp.qualification,
        "experience_years": dp.experience_years,
        "fee": float(dp.consultation_fee) if dp.consultation_fee else 0,
        "bio": dp.bio,
        "languages": dp.languages,
        "mci_verified": dp.mci_verified,
        "telehealth_enabled": dp.telehealth_enabled,
        "telehealth_fee": float(dp.telehealth_fee) if dp.telehealth_fee else None,
        "photo_url": s.photo_url if hasattr(s, 'photo_url') else None,
        "clinic": {
            "id": c.id,
            "name": c.name,
            "slug": c.slug,
            "specialty": c.specialty,
            "city": c.city,
            "state": c.state,
            "address": c.address,
            "phone": c.phone,
            "default_branch_id": branches[0].id if branches else None,
        }
    }


@router.get("/telehealth-doctors")
def get_telehealth_doctors(
    city: Optional[str] = None,
    specialty: Optional[str] = None,
    available_date: Optional[date] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """Returns doctors with telehealth enabled — powers the public Telehealth section."""
    q = (
        db.query(DoctorProfile, Staff, Clinic)
        .join(Staff, DoctorProfile.staff_id == Staff.id)
        .join(Clinic, DoctorProfile.clinic_id == Clinic.id)
        .filter(
            DoctorProfile.telehealth_enabled == True,
            DoctorProfile.is_active == True,
            Staff.is_active == True,
            Clinic.is_active == True,
            Clinic.is_verified == True,
        )
    )
    if city:
        q = q.filter(Clinic.city.ilike(f"%{city}%"))
    if specialty:
        q = q.filter(DoctorProfile.specialty.ilike(f"%{specialty}%"))
    if available_date:
        day_name = available_date.strftime("%A").lower()
        available_ids = {
            row[0] for row in db.query(DoctorSchedule.doctor_id).filter(
                DoctorSchedule.day_of_week == day_name,
                DoctorSchedule.is_active == True,
            ).all()
        }
        q = q.filter(DoctorProfile.id.in_(available_ids))
    rows = q.limit(limit).all()
    return [
        {
            "doctor_profile_id": dp.id,
            "name":              s.full_name,
            "specialty":         dp.specialty,
            "qualification":     dp.qualification,
            "experience_years":  dp.experience_years,
            "telehealth_fee":    float(dp.telehealth_fee) if dp.telehealth_fee else float(dp.consultation_fee or 0),
            "clinic_name":       c.name,
            "clinic_slug":       c.slug,
            "city":              c.city,
            "state":             c.state,
            "logo_url":          c.logo_url,
        }
        for dp, s, c in rows
    ]


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
        is_active           = True,   # Clinic is active so admin can login
        is_verified         = False,  # Not verified = not visible publicly yet
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
        is_active       = True,   # Clinic admin can login immediately
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
    db.flush()

    # Auto-create default Mon–Fri schedule so patients can book immediately
    for day in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']:
        db.add(DoctorSchedule(
            doctor_id    = doctor_profile.id,
            branch_id    = branch.id,
            day_of_week  = day,
            start_time   = "09:00",
            end_time     = "17:00",
            slot_minutes = 30,
            max_patients = 20,
            is_active    = True,
        ))
    db.commit()

    return {
        "success": True,
        "clinic_name": clinic.name,
        "clinic_slug": clinic.slug,
        "public_url": f"/clinics/{clinic.slug}",
        "login_email": admin_email,
        "message": "Registration successful! Your clinic is pending approval. Login at provider.bharathhealthsystems.com once approved."
    }


@router.post("/feedback")
def submit_feedback(body: dict, db: Session = Depends(get_db)):
    """Submit platform feedback — no auth required."""
    name = (body.get("name") or "").strip()
    message = (body.get("message") or "").strip()
    if not name:
        raise HTTPException(400, "name is required")
    if not message:
        raise HTTPException(400, "message is required")
    feedback_type = body.get("type", "general")
    if feedback_type not in ("suggestion", "bug", "general"):
        feedback_type = "general"
    entry = Feedback(
        name=name,
        email=(body.get("email") or "").strip() or None,
        message=message,
        type=feedback_type,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"success": True, "id": entry.id}


@router.get("/branding/{clinic_id}")
def get_clinic_branding(clinic_id: int, db: Session = Depends(get_db)):
    """Public endpoint — returns clinic branding for portal headers."""
    from app.models.models import Clinic
    clinic = db.query(Clinic).filter_by(id=clinic_id, is_active=True).first()
    if not clinic:
        raise HTTPException(404, 'Clinic not found')
    return {
        'clinic_id':   clinic.id,
        'name':        clinic.name,
        'brand_name':  clinic.brand_name or clinic.name,
        'brand_color': clinic.brand_color or '#0F2557',
        'logo_url':    clinic.logo_url,
    }
