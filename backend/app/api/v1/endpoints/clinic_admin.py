from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import os, shutil, calendar, secrets, string
from datetime import date

def _generate_temp_password() -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    while True:
        pwd = ''.join(secrets.choice(alphabet) for _ in range(12))
        if (any(c.isupper() for c in pwd) and any(c.islower() for c in pwd)
                and any(c.isdigit() for c in pwd) and any(c in "!@#$%" for c in pwd)):
            return pwd

from app.db.session import get_db
from app.core.security import get_current_staff, hash_password
from app.core.config import settings
from app.models.models import (
    Clinic, Branch, Staff, DoctorProfile, DoctorSchedule,
    Appointment, Invoice, Patient, OnlineBooking, DoctorDeskAssignment
)
from app.schemas.schemas import (
    ClinicUpdate, BranchCreate, BranchOut,
    StaffCreate, StaffOut, DoctorProfileCreate,
    DoctorProfileOut, DoctorScheduleCreate
)

router = APIRouter(prefix="/clinic", tags=["clinic-admin"])

CLINIC_ADMIN_ROLES = ["clinic_admin", "clinic_manager"]
ADMIN_OR_RECEPTIONIST = ["clinic_admin", "clinic_manager", "receptionist"]


def require_clinic_admin(current=Depends(get_current_staff)):
    if current.role not in CLINIC_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Clinic manager access required")
    return current


def require_admin_or_receptionist(current=Depends(get_current_staff)):
    if current.role not in ADMIN_OR_RECEPTIONIST:
        raise HTTPException(status_code=403, detail="Access denied")
    return current


# ── Clinic Profile ────────────────────────────────────────────────────────────

@router.get("/profile")
def get_clinic_profile(db: Session = Depends(get_db), current=Depends(get_current_staff)):
    clinic = db.query(Clinic).filter(Clinic.id == current.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return {
        "id":                clinic.id,
        "name":              clinic.name,
        "slug":              clinic.slug,
        "specialty":         clinic.specialty,
        "phone":             clinic.phone,
        "email":             clinic.email,
        "address":           clinic.address,
        "city":              clinic.city,
        "state":             clinic.state,
        "pincode":           clinic.pincode,
        "description":       clinic.description,
        "logo_url":          clinic.logo_url,
        "brand_name":        clinic.brand_name,
        "brand_color":       clinic.brand_color,
        "is_active":         clinic.is_active,
        "is_verified":       clinic.is_verified,
        "subscription_plan": clinic.subscription_plan,
        "subscription_status": clinic.subscription_status,
    }


@router.put("/profile")
def update_clinic_profile(
    payload: ClinicUpdate,
    db: Session = Depends(get_db),
    current=Depends(require_clinic_admin),
):
    clinic = db.query(Clinic).filter(Clinic.id == current.clinic_id).first()
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(clinic, key, val)
    db.commit()
    db.refresh(clinic)
    return clinic


@router.post("/profile/logo")
def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(require_clinic_admin),
):
    os.makedirs(f"{settings.UPLOAD_DIR}/logos", exist_ok=True)
    ext = file.filename.split(".")[-1].lower()
    if ext not in ["jpg", "jpeg", "png", "webp"]:
        raise HTTPException(400, "Only JPG/PNG/WEBP allowed")
    filename = f"clinic_{current.clinic_id}.{ext}"
    path = f"{settings.UPLOAD_DIR}/logos/{filename}"
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    clinic = db.query(Clinic).filter(Clinic.id == current.clinic_id).first()
    clinic.logo_url = f"/uploads/logos/{filename}"
    db.commit()
    return {"logo_url": clinic.logo_url}


# ── Branches ──────────────────────────────────────────────────────────────────

@router.get("/branches", response_model=List[BranchOut])
def list_branches(db: Session = Depends(get_db), current=Depends(get_current_staff)):
    return db.query(Branch).filter(
        Branch.clinic_id == current.clinic_id,
        Branch.is_active == True
    ).all()


@router.post("/branches", response_model=BranchOut)
def create_branch(
    payload: BranchCreate,
    db: Session = Depends(get_db),
    current=Depends(require_clinic_admin),
):
    clinic = db.query(Clinic).filter(Clinic.id == current.clinic_id).first()
    if clinic.subscription_plan == "free":
        count = db.query(Branch).filter(
            Branch.clinic_id == current.clinic_id, Branch.is_active == True
        ).count()
        if count >= settings.FREE_PLAN_MAX_BRANCHES:
            raise HTTPException(403, f"Free plan allows {settings.FREE_PLAN_MAX_BRANCHES} branch. Upgrade to add more.")
    branch = Branch(clinic_id=current.clinic_id, **payload.model_dump())
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


# ── Staff Management ──────────────────────────────────────────────────────────

@router.get("/staff")
def list_staff(
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current=Depends(require_clinic_admin),
):
    q = db.query(Staff).filter(Staff.clinic_id == current.clinic_id)
    if role:
        q = q.filter(Staff.role == role)
    rows = q.order_by(Staff.full_name).all()
    return [{
        "id": s.id, "full_name": s.full_name, "email": s.email,
        "mobile": s.mobile, "role": s.role, "is_active": s.is_active,
        "branch_id": s.branch_id, "created_at": s.created_at,
        "employee_id": s.employee_id, "designation": s.designation,
        "department": s.department, "ward": s.ward,
        "reporting_manager_id": s.reporting_manager_id,
        "employment_type": s.employment_type,
        "join_date": str(s.join_date) if s.join_date else None,
        "date_of_birth": str(s.date_of_birth) if s.date_of_birth else None,
        "gender": s.gender,
        "emergency_contact_name": s.emergency_contact_name,
        "emergency_contact_mobile": s.emergency_contact_mobile,
        "qualification": s.qualification,
        "registration_number": s.registration_number,
        "license_expiry_date": str(s.license_expiry_date) if s.license_expiry_date else None,
        "address": s.address, "modules": s.modules,
        "avatar_url": s.avatar_url,
        "secondary_roles": s.secondary_roles,
        "scheduled_removal_date": str(s.scheduled_removal_date) if s.scheduled_removal_date else None,
        "removal_reason": s.removal_reason,
    } for s in rows]


@router.post("/staff")
def create_staff(
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(require_clinic_admin),
):
    clinic = db.query(Clinic).filter(Clinic.id == current.clinic_id).first()
    if body.get("role") == "doctor" and clinic.subscription_plan == "free":
        doc_count = db.query(Staff).filter(
            Staff.clinic_id == current.clinic_id,
            Staff.role == "doctor",
            Staff.is_active == True,
        ).count()
        if doc_count >= settings.FREE_PLAN_MAX_DOCTORS:
            raise HTTPException(403, f"Free plan allows {settings.FREE_PLAN_MAX_DOCTORS} doctors. Upgrade to add more.")

    email = body.get("email")
    mobile = body.get("mobile")
    if email and db.query(Staff).filter(Staff.email == email).first():
        raise HTTPException(400, "Email already registered")
    if mobile and db.query(Staff).filter(Staff.mobile == mobile).first():
        raise HTTPException(400, "Mobile already registered")

    new_staff = Staff(
        clinic_id       = current.clinic_id,
        branch_id       = body.get("branch_id") or current.branch_id,
        full_name       = body.get("full_name"),
        email           = email,
        mobile          = mobile,
        hashed_password = hash_password(body.get("password") or _generate_temp_password()),
        role            = body.get("role", "receptionist"),
        is_active       = body.get("role") not in ['pharmacist', 'lab_technician', 'imaging_tech'],
        employee_id              = body.get("employee_id"),
        designation              = body.get("designation"),
        department               = body.get("department"),
        ward                     = body.get("ward"),
        reporting_manager_id     = body.get("reporting_manager_id"),
        employment_type          = body.get("employment_type"),
        join_date                = body.get("join_date"),
        date_of_birth            = body.get("date_of_birth"),
        gender                   = body.get("gender"),
        emergency_contact_name   = body.get("emergency_contact_name"),
        emergency_contact_mobile = body.get("emergency_contact_mobile"),
        qualification            = body.get("qualification"),
        registration_number      = body.get("registration_number"),
        license_expiry_date      = body.get("license_expiry_date"),
        address                  = body.get("address"),
        modules                  = body.get("modules"),
        secondary_roles          = body.get("secondary_roles") or [],
        scheduled_removal_date   = body.get("scheduled_removal_date") or None,
        removal_reason           = body.get("removal_reason"),
    )
    db.add(new_staff)
    db.flush()

    if body.get("role") == "doctor":
        dp = DoctorProfile(
            staff_id         = new_staff.id,
            clinic_id        = current.clinic_id,
            specialty        = body.get("specialty", "General Medicine"),
            qualification    = body.get("qualification"),
            mci_number       = body.get("mci_number"),
            experience_years = int(body.get("experience_years") or 0),
            consultation_fee = float(body.get("consultation_fee") or 500),
            is_active        = True,
        )
        db.add(dp)

    db.commit()
    return {
        "id":        new_staff.id,
        "full_name": new_staff.full_name,
        "email":     new_staff.email,
        "role":      new_staff.role,
        "message":   "Staff added successfully",
    }


@router.put("/staff/{staff_id}")
def update_staff(
    staff_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(require_clinic_admin),
):
    s = db.query(Staff).filter(Staff.id == staff_id, Staff.clinic_id == current.clinic_id).first()
    if not s:
        raise HTTPException(404, "Staff not found")
    updatable = [
        "full_name", "mobile", "is_active", "branch_id", "role",
        "employee_id", "designation", "department", "ward",
        "reporting_manager_id", "employment_type", "join_date",
        "date_of_birth", "gender", "emergency_contact_name",
        "emergency_contact_mobile", "qualification", "registration_number",
        "license_expiry_date", "address", "modules",
        "secondary_roles", "scheduled_removal_date", "removal_reason",
    ]
    for field in updatable:
        if field in body:
            setattr(s, field, body[field])
    db.commit()
    return {"message": "Updated successfully"}


@router.put("/staff/{staff_id}/toggle")
def toggle_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    current=Depends(require_clinic_admin),
):
    staff = db.query(Staff).filter(Staff.id == staff_id, Staff.clinic_id == current.clinic_id).first()
    if not staff:
        raise HTTPException(404, "Staff not found")
    staff.is_active = not staff.is_active
    db.commit()
    return {"id": staff.id, "is_active": staff.is_active}


# ── Doctor Profiles & Schedules ───────────────────────────────────────────────

@router.get("/doctors")
def list_doctors(db: Session = Depends(get_db), current=Depends(get_current_staff)):
    doctors = db.query(Staff).filter(
        Staff.clinic_id == current.clinic_id,
        Staff.role == "doctor",
        Staff.is_active == True,
    ).all()
    return [{
        "id":                 d.id,
        "full_name":          d.full_name,
        "email":              d.email,
        "mobile":             d.mobile,
        "specialty":          d.doctor_profile.specialty if d.doctor_profile else None,
        "profile_id":         d.doctor_profile.id if d.doctor_profile else None,
        "consultation_fee":   float(d.doctor_profile.consultation_fee) if d.doctor_profile and d.doctor_profile.consultation_fee else 0,
        "telehealth_enabled": d.doctor_profile.telehealth_enabled if d.doctor_profile else False,
        "telehealth_fee":     float(d.doctor_profile.telehealth_fee) if d.doctor_profile and d.doctor_profile.telehealth_fee else None,
        "accepting_appointments": d.doctor_profile.accepting_appointments if d.doctor_profile and d.doctor_profile.accepting_appointments is not None else True,
    } for d in doctors]


@router.put("/doctors/{doctor_profile_id}/accepting")
def toggle_doctor_accepting(
    doctor_profile_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(require_admin_or_receptionist),
):
    """Enable/block new bookings for a doctor (receptionist control)."""
    profile = db.query(DoctorProfile).filter(
        DoctorProfile.id == doctor_profile_id,
        DoctorProfile.clinic_id == current.clinic_id,
    ).first()
    if not profile:
        raise HTTPException(404, "Doctor profile not found")
    profile.accepting_appointments = bool(body.get("accepting", True))
    db.commit()
    return {"doctor_id": profile.id, "accepting_appointments": profile.accepting_appointments}


# ── Doctor Slot Board ─────────────────────────────────────────────────────────

ACTIVE_APPT_STATUSES = ('cancelled', 'no_show')  # excluded = slot consumed


def _slot_count(schedule) -> int:
    from datetime import datetime as _dt
    try:
        start = _dt.strptime(schedule.start_time, "%H:%M")
        end = _dt.strptime(schedule.end_time, "%H:%M")
        mins = max(int((end - start).total_seconds() // 60), 0)
        return mins // (schedule.slot_minutes or 15)
    except Exception:
        return 0


@router.get("/slot-board")
def slot_board(
    date_from: date = None,
    date_to: date = None,
    db: Session = Depends(get_db),
    current=Depends(require_admin_or_receptionist),
):
    """
    Per-doctor, per-day slot summary over a date range.
    Powers the receptionist Doctor Slot Board: totals, booked, requested, open,
    live status (today), accepting flag, pin/lock assignments, advance requests.
    """
    from datetime import timedelta as _td
    today = date.today()
    if not date_from:
        date_from = today
    if not date_to:
        date_to = date_from
    if date_to < date_from:
        date_from, date_to = date_to, date_from
    if (date_to - date_from).days > 31:
        date_to = date_from + _td(days=31)

    days = []
    d = date_from
    while d <= date_to:
        days.append(d)
        d += _td(days=1)

    doctors = db.query(Staff).filter(
        Staff.clinic_id == current.clinic_id,
        Staff.role == "doctor",
        Staff.is_active == True,
    ).all()
    profile_ids = [s.doctor_profile.id for s in doctors if s.doctor_profile]

    # Bulk fetch everything once
    schedules = db.query(DoctorSchedule).filter(
        DoctorSchedule.doctor_id.in_(profile_ids or [0]),
        DoctorSchedule.is_active == True,
    ).all()
    sched_map = {}
    for s in schedules:
        sched_map.setdefault((s.doctor_id, s.day_of_week), s)

    appts = db.query(
        Appointment.doctor_id, Appointment.appointment_date,
        Appointment.status,
    ).filter(
        Appointment.clinic_id == current.clinic_id,
        Appointment.doctor_id.in_(profile_ids or [0]),
        Appointment.appointment_date >= date_from,
        Appointment.appointment_date <= date_to,
    ).all()

    pending_bookings = db.query(OnlineBooking).filter(
        OnlineBooking.clinic_id == current.clinic_id,
        OnlineBooking.status == "pending",
    ).all()

    assignments = db.query(DoctorDeskAssignment).filter(
        DoctorDeskAssignment.clinic_id == current.clinic_id,
    ).all()
    staff_names = {s.id: s.full_name for s in db.query(Staff).filter(Staff.clinic_id == current.clinic_id).all()}

    out = []
    for s in doctors:
        dp = s.doctor_profile
        if not dp:
            continue
        day_rows, tot_total, tot_booked, tot_requested = [], 0, 0, 0
        waiting_today = in_progress_today = completed_today = 0
        for d in days:
            day_name = d.strftime("%A").lower()
            sched = sched_map.get((dp.id, day_name))
            total = _slot_count(sched) if sched else 0
            booked = sum(1 for a in appts if a.doctor_id == dp.id and a.appointment_date == d
                         and a.status not in ACTIVE_APPT_STATUSES)
            requested = sum(1 for b in pending_bookings if b.doctor_id == dp.id and b.booking_date == d)
            if d == today:
                waiting_today = sum(1 for a in appts if a.doctor_id == dp.id and a.appointment_date == d
                                    and a.status in ('scheduled', 'waiting', 'confirmed', 'pending'))
                in_progress_today = sum(1 for a in appts if a.doctor_id == dp.id and a.appointment_date == d
                                        and a.status == 'in_progress')
                completed_today = sum(1 for a in appts if a.doctor_id == dp.id and a.appointment_date == d
                                      and a.status == 'completed')
            open_slots = max(total - booked - requested, 0)
            day_rows.append({
                "date": str(d), "total": total, "booked": booked,
                "requested": requested, "open": open_slots,
                "no_schedule": sched is None,
            })
            tot_total += total; tot_booked += booked; tot_requested += requested

        # Live status (today)
        if in_progress_today > 0:
            live = "busy"
        elif waiting_today > 0:
            live = "waiting"
        elif completed_today > 0:
            live = "done"
        else:
            live = "available"

        advance = sum(1 for b in pending_bookings if b.doctor_id == dp.id and b.booking_date > today)
        my_assign = next((a for a in assignments if a.doctor_id == dp.id and a.staff_id == current.id), None)
        lock_row = next((a for a in assignments if a.doctor_id == dp.id and a.locked), None)

        out.append({
            "staff_id": s.id,
            "profile_id": dp.id,
            "full_name": s.full_name,
            "specialty": dp.specialty or "General",
            "accepting": dp.accepting_appointments if dp.accepting_appointments is not None else True,
            "live_status": live,
            "waiting_today": waiting_today,
            "in_progress_today": in_progress_today,
            "days": day_rows,
            "totals": {
                "total": tot_total, "booked": tot_booked,
                "requested": tot_requested,
                "open": max(tot_total - tot_booked - tot_requested, 0),
            },
            "advance_requests": advance,
            "pinned": bool(my_assign and my_assign.pinned),
            "locked_by": {
                "staff_id": lock_row.staff_id,
                "name": staff_names.get(lock_row.staff_id, "Staff"),
                "me": lock_row.staff_id == current.id,
            } if lock_row else None,
        })

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "doctors": out,
        "pending_requests": [{
            "id": b.id,
            "doctor_id": b.doctor_id,
            "patient_name": b.patient_name,
            "patient_mobile": b.patient_mobile,
            "booking_date": str(b.booking_date),
            "booking_time": b.booking_time,
            "reason": b.reason,
        } for b in sorted(pending_bookings, key=lambda b: (b.booking_date, b.booking_time or ""))],
    }


@router.post("/desk-assignments")
def set_desk_assignment(
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(require_admin_or_receptionist),
):
    """Pin a doctor to my list, or lock/unlock a doctor (shared across receptionists)."""
    doctor_id = body.get("doctor_id")
    profile = db.query(DoctorProfile).filter(
        DoctorProfile.id == doctor_id,
        DoctorProfile.clinic_id == current.clinic_id,
    ).first()
    if not profile:
        raise HTTPException(404, "Doctor profile not found")

    row = db.query(DoctorDeskAssignment).filter(
        DoctorDeskAssignment.doctor_id == doctor_id,
        DoctorDeskAssignment.staff_id == current.id,
    ).first()
    if not row:
        row = DoctorDeskAssignment(
            clinic_id=current.clinic_id, doctor_id=doctor_id,
            staff_id=current.id, pinned=False, locked=False,
        )
        db.add(row)

    if "pinned" in body:
        row.pinned = bool(body["pinned"])

    if "locked" in body:
        want = bool(body["locked"])
        other_lock = db.query(DoctorDeskAssignment).filter(
            DoctorDeskAssignment.doctor_id == doctor_id,
            DoctorDeskAssignment.locked == True,
            DoctorDeskAssignment.staff_id != current.id,
        ).first()
        if want and other_lock:
            if current.role in CLINIC_ADMIN_ROLES:
                other_lock.locked = False  # manager override steals the lock
            else:
                raise HTTPException(409, f"Already locked by {staff_name_of(db, other_lock.staff_id)}")
        if not want and other_lock and current.role in CLINIC_ADMIN_ROLES:
            other_lock.locked = False  # manager unlock for someone else
        row.locked = want

    db.commit()
    return {"doctor_id": doctor_id, "pinned": row.pinned, "locked": row.locked}


def staff_name_of(db, staff_id: int) -> str:
    s = db.query(Staff).filter(Staff.id == staff_id).first()
    return s.full_name if s else "another receptionist"


@router.put("/doctors/{doctor_profile_id}/telehealth")
def update_doctor_telehealth(
    doctor_profile_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(require_clinic_admin),
):
    profile = db.query(DoctorProfile).filter(
        DoctorProfile.id == doctor_profile_id,
        DoctorProfile.clinic_id == current.clinic_id,
    ).first()
    if not profile:
        raise HTTPException(404, "Doctor profile not found")
    if "telehealth_enabled" in body:
        profile.telehealth_enabled = bool(body["telehealth_enabled"])
    if "telehealth_fee" in body:
        profile.telehealth_fee = body["telehealth_fee"] if body["telehealth_fee"] else None
    db.commit()
    return {"message": "Telehealth settings updated"}


@router.post("/staff/{staff_id}/doctor-profile", response_model=DoctorProfileOut)
def upsert_doctor_profile(
    staff_id: int,
    payload: DoctorProfileCreate,
    db: Session = Depends(get_db),
    current=Depends(require_clinic_admin),
):
    staff = db.query(Staff).filter(
        Staff.id == staff_id,
        Staff.clinic_id == current.clinic_id,
        Staff.role == "doctor",
    ).first()
    if not staff:
        raise HTTPException(404, "Doctor staff member not found")

    existing = db.query(DoctorProfile).filter(DoctorProfile.staff_id == staff_id).first()
    if existing:
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(existing, k, v)
        db.commit()
        return existing

    profile = DoctorProfile(staff_id=staff_id, clinic_id=current.clinic_id, **payload.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/doctors/{doctor_profile_id}/schedule")
def set_doctor_schedule(
    doctor_profile_id: int,
    payload: DoctorScheduleCreate,
    db: Session = Depends(get_db),
    current=Depends(require_clinic_admin),
):
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_profile_id).first()
    if not doctor:
        raise HTTPException(404, "Doctor profile not found")

    existing = db.query(DoctorSchedule).filter(
        DoctorSchedule.doctor_id == doctor_profile_id,
        DoctorSchedule.branch_id == payload.branch_id,
        DoctorSchedule.day_of_week == payload.day_of_week,
    ).first()

    if existing:
        for k, v in payload.model_dump().items():
            setattr(existing, k, v)
        existing.is_active = payload.is_active
        db.commit()
        return existing

    schedule = DoctorSchedule(doctor_id=doctor_profile_id, **payload.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.get("/doctors/{doctor_profile_id}/schedules")
def get_doctor_schedules(
    doctor_profile_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    return db.query(DoctorSchedule).filter(DoctorSchedule.doctor_id == doctor_profile_id).all()


# ── Subscription ──────────────────────────────────────────────────────────────

@router.get("/subscription")
def get_subscription(db: Session = Depends(get_db), current=Depends(get_current_staff)):
    clinic = db.query(Clinic).filter(Clinic.id == current.clinic_id).first()
    doc_count = db.query(Staff).filter(
        Staff.clinic_id == current.clinic_id, Staff.role == "doctor", Staff.is_active == True
    ).count()
    branch_count = db.query(Branch).filter(
        Branch.clinic_id == current.clinic_id, Branch.is_active == True
    ).count()
    plan = clinic.subscription_plan or "free"
    limits = {
        "free":       {"doctors": 2,   "branches": 1,   "patients": 100},
        "basic":      {"doctors": 10,  "branches": 3,   "patients": 1000},
        "pro":        {"doctors": 999, "branches": 999, "patients": 999999},
        "enterprise": {"doctors": 999, "branches": 999, "patients": 999999},
        "trial":      {"doctors": 2,   "branches": 1,   "patients": 50},
    }
    return {
        "plan":    plan,
        "status":  clinic.subscription_status,
        "expiry":  clinic.subscription_expiry,
        "usage":   {"doctors": doc_count, "branches": branch_count},
        "limits":  limits.get(plan, limits["free"]),
    }


# ── Revenue Analytics ─────────────────────────────────────────────────────────

@router.get("/revenue")
def get_revenue(
    month: str,
    db: Session = Depends(get_db),
    current=Depends(require_clinic_admin),
):
    try:
        year, mon = int(month.split("-")[0]), int(month.split("-")[1])
    except Exception:
        raise HTTPException(400, "Invalid month format. Use YYYY-MM")

    last_day = calendar.monthrange(year, mon)[1]
    date_from = date(year, mon, 1)
    date_to = date(year, mon, last_day)

    invoices = db.query(Invoice).filter(
        Invoice.clinic_id == current.clinic_id,
        Invoice.status == "paid",
        Invoice.paid_at >= date_from,
        Invoice.paid_at <= date_to,
    ).all()

    total = sum(float(inv.total) for inv in invoices)
    count = len(invoices)
    avg = round(total / count, 2) if count else 0

    doctor_map = {}
    for inv in invoices:
        if not inv.appointment_id:
            continue
        appt = db.query(Appointment).filter(Appointment.id == inv.appointment_id).first()
        if not appt:
            continue
        dp = db.query(DoctorProfile).filter(DoctorProfile.id == appt.doctor_id).first()
        if not dp:
            continue
        doc_name = dp.staff.full_name if dp.staff else "Unknown"
        did = appt.doctor_id
        if did not in doctor_map:
            doctor_map[did] = {"doctor_name": doc_name, "total": 0.0, "count": 0}
        doctor_map[did]["total"] += float(inv.total)
        doctor_map[did]["count"] += 1

    billing = []
    for inv in sorted(invoices, key=lambda x: x.paid_at or date_from, reverse=True):
        patient = db.query(Patient).filter(Patient.id == inv.patient_id).first()
        doctor_name = None
        if inv.appointment_id:
            appt = db.query(Appointment).filter(Appointment.id == inv.appointment_id).first()
            if appt:
                dp = db.query(DoctorProfile).filter(DoctorProfile.id == appt.doctor_id).first()
                if dp and dp.staff:
                    doctor_name = dp.staff.full_name
        billing.append({
            "invoice_number": inv.invoice_number,
            "patient_name":   patient.full_name if patient else "-",
            "doctor_name":    doctor_name or "-",
            "payment_mode":   inv.payment_method,
            "amount":         float(inv.total),
            "billed_at":      str(inv.paid_at.date()) if inv.paid_at else str(date_from),
        })

    return {
        "month":     month,
        "totals":    {"total": total, "count": count, "avg": avg},
        "by_doctor": sorted(doctor_map.values(), key=lambda x: x["total"], reverse=True),
        "billing":   billing,
    }


# ── Online Bookings ───────────────────────────────────────────────────────────

@router.get("/online-bookings")
def list_online_bookings(
    status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current=Depends(require_admin_or_receptionist),
):
    q = db.query(OnlineBooking).filter(OnlineBooking.clinic_id == current.clinic_id)
    if status:
        q = q.filter(OnlineBooking.status == status)
    bookings = q.order_by(OnlineBooking.created_at.desc()).limit(limit).all()
    return [{
        "id":                b.id,
        "patient_name":      b.patient_name,
        "mobile":            b.patient_mobile,
        "email":             b.patient_email,
        "booking_date":      str(b.booking_date),
        "booking_time":      b.booking_time,
        "reason":            b.reason,
        "status":            b.status,
        "confirmation_code": b.confirmation_code,
        "doctor_name":       b.doctor.staff.full_name if b.doctor and b.doctor.staff else "Unknown",
        "created_at":        str(b.created_at),
    } for b in bookings]


@router.put("/online-bookings/{booking_id}")
def update_online_booking(
    booking_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(require_admin_or_receptionist),
):
    booking = db.query(OnlineBooking).filter(
        OnlineBooking.id == booking_id,
        OnlineBooking.clinic_id == current.clinic_id,
    ).first()
    if not booking:
        raise HTTPException(404, "Booking not found")

    new_status = body.get("status")
    if new_status not in ["confirmed", "cancelled", "pending"]:
        raise HTTPException(400, "Invalid status")

    booking.status = new_status
    if body.get("notes"):
        booking.notes = body["notes"]

    if new_status == "confirmed":
        patient = db.query(Patient).filter(
            Patient.mobile == booking.patient_mobile,
            Patient.clinic_id == current.clinic_id,
        ).first()
        if not patient:
            import random, string
            uhid = "BC-" + "".join(random.choices(string.digits, k=6))
            patient = Patient(
                clinic_id  = current.clinic_id,
                branch_id  = booking.branch_id,
                full_name  = booking.patient_name,
                mobile     = booking.patient_mobile,
                email      = booking.patient_email,
                uhid       = uhid,
                is_active  = True,
            )
            db.add(patient)
            db.flush()
        existing_count = db.query(Appointment).filter(
            Appointment.doctor_id == booking.doctor_id,
            Appointment.appointment_date == booking.booking_date,
            Appointment.branch_id == booking.branch_id,
        ).count()
        appt = Appointment(
            clinic_id        = current.clinic_id,
            branch_id        = booking.branch_id,
            patient_id       = patient.id,
            doctor_id        = booking.doctor_id,
            appointment_date = booking.booking_date,
            appointment_time = booking.booking_time,
            token_number     = existing_count + 1,
            status           = "confirmed",
            mode             = "online",
            reason           = booking.reason,
            online_booking_id = booking.id,
        )
        db.add(appt)

    db.commit()
    return {"message": f"Booking {new_status}", "id": booking_id}
