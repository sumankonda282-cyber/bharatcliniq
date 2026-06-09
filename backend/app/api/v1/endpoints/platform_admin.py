from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel, EmailStr
from app.db.session import get_db
from app.core.security import get_current_platform_admin, hash_password
from app.models.models import Clinic, Branch, Staff, Patient, Appointment, PlatformAdmin, AuditLog, Invoice, AssessmentTemplate, TemplateAssignment, Department, Ward, Bed, PasswordResetRequest

import re
import secrets
import string as _string

router = APIRouter(prefix="/platform", tags=["platform-admin"])


def _generate_temp_password() -> str:
    """8 chars: 3 upper + 2 lower + 2 digits + 1 special. Always meets complexity."""
    special = "!@#$%^&*"
    while True:
        pwd = (
            ''.join(secrets.choice(_string.ascii_uppercase) for _ in range(3)) +
            ''.join(secrets.choice(_string.ascii_lowercase) for _ in range(2)) +
            ''.join(secrets.choice(_string.digits) for _ in range(2)) +
            secrets.choice(special)
        )
        # Shuffle to avoid predictable pattern
        chars = list(pwd)
        secrets.SystemRandom().shuffle(chars)
        result = ''.join(chars)
        # Verify it still meets requirements after shuffle
        if (any(c.isupper() for c in result) and
            any(c.islower() for c in result) and
            any(c.isdigit() for c in result) and
            any(c in special for c in result)):
            return result


def _generate_username(full_name: str, db) -> str:
    """4 letters of first name + 2 random digits. Retries on collision."""
    first = ''.join(c for c in full_name.strip().split()[0].lower() if c.isalpha())[:4]
    first = first.ljust(4, 'x')  # pad if name shorter than 4 chars
    for _ in range(20):
        suffix = ''.join(secrets.choice(_string.digits) for _ in range(2))
        username = first + suffix
        exists = db.query(Staff).filter(Staff.username == username).first()
        if not exists:
            return username
    # Fallback: 4 digit suffix
    for _ in range(20):
        suffix = ''.join(secrets.choice(_string.digits) for _ in range(4))
        username = first + suffix
        if not db.query(Staff).filter(Staff.username == username).first():
            return username
    raise Exception("Could not generate unique username")

# ── Rate Card (fallback defaults — live values come from platform_settings) ──
RATE_CARD = {
    "free":       {"price_per_doctor": 0,    "max_doctors": 2,   "label": "Free"},
    "basic":      {"price_per_doctor": 999,  "max_doctors": 10,  "label": "Basic"},
    "pro":        {"price_per_doctor": 799,  "max_doctors": 999, "label": "Pro"},
    "enterprise": {"price_per_doctor": 0,    "max_doctors": 999, "label": "Enterprise"},
}

# Full pricing config — editable in the admin portal (Plans & Pricing page).
# Stored in platform_settings under key "pricing"; this is the seed/fallback.
DEFAULT_PRICING = {
    "plans": {
        "clinic": [
            {"key": "free",       "label": "Free",       "model": "per_doctor", "price_per_doctor": 0,   "max_doctors": 2},
            {"key": "basic",      "label": "Basic",      "model": "per_doctor", "price_per_doctor": 999, "max_doctors": 10},
            {"key": "pro",        "label": "Pro",        "model": "per_doctor", "price_per_doctor": 799, "max_doctors": 999},
            {"key": "enterprise", "label": "Enterprise", "model": "custom",     "price_per_doctor": 0,   "max_doctors": 999},
        ],
        "hospital": [
            {"key": "standard", "label": "Standard", "model": "base_plus_doctor",
             "base_monthly": 4999, "included_doctors": 5, "price_per_extra_doctor": 599,
             "modules": {"pharmacy": 1499, "lab": 1499, "imaging": 1999}},
            {"key": "enterprise", "label": "Enterprise", "model": "custom"},
        ],
        "pharmacy": [
            {"key": "free",     "label": "Free",     "model": "flat", "monthly": 0,    "note": "1 user · 100 bills/mo"},
            {"key": "standard", "label": "Standard", "model": "flat", "monthly": 799,  "note": "Single store"},
            {"key": "pro",      "label": "Pro",      "model": "flat", "monthly": 1499, "note": "Multi-user / branch + analytics"},
        ],
        "diagnostic": [
            {"key": "standard", "label": "Standard", "model": "flat", "monthly": 1499, "note": "Lab"},
            {"key": "pro",      "label": "Pro",      "model": "flat", "monthly": 2499, "note": "Lab + Imaging + NABL formats"},
        ],
    },
    "telehealth": {"patient_fee": 5, "provider_fee": 5, "gst_percent": 18},
    "cycle_discounts": {"monthly": 0, "quarterly": 5, "half_yearly": 10, "yearly": 15},
}


def get_pricing(db) -> dict:
    """Live pricing config: platform_settings['pricing'] with seed fallback."""
    from app.models.models import PlatformSetting
    row = db.query(PlatformSetting).filter(PlatformSetting.key == "pricing").first()
    if row and isinstance(row.value, dict) and row.value.get("plans"):
        return row.value
    return DEFAULT_PRICING


def get_rate_card(db) -> dict:
    """Clinic plans in the legacy RATE_CARD shape (used by MRR / billing summaries)."""
    card = {}
    for p in get_pricing(db).get("plans", {}).get("clinic", []):
        card[p["key"]] = {
            "price_per_doctor": p.get("price_per_doctor", 0),
            "max_doctors":      p.get("max_doctors", 999),
            "label":            p.get("label", p["key"].title()),
        }
    return card or RATE_CARD

ROLES_NEEDING_VERIFICATION = ['pharmacist', 'lab_technician', 'imaging_tech', 'nurse']

SUSPENSION_REASONS = [
    "license_cancelled",
    "payment_failed",
    "compliance_issue",
    "other",
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def _sync_clinic_status(clinic: Clinic):
    """Keep is_active/is_verified in sync with status for backward compat."""
    if clinic.status == "active":
        clinic.is_active = True
        clinic.is_verified = True
    elif clinic.status == "pending":
        clinic.is_active = True
        clinic.is_verified = False
    else:  # suspended | revoked
        clinic.is_active = False
        clinic.is_verified = False


def _log(db, action, target_type, target_id, target_name, admin, reason=None, comment=None):
    entry = AuditLog(
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_name=target_name,
        admin_id=admin.id if admin else None,
        admin_name=admin.full_name if admin else "System",
        reason=reason,
        comment=comment,
    )
    db.add(entry)


def _doctor_count(db, clinic_id):
    return db.query(func.count(Staff.id)).filter(
        Staff.clinic_id == clinic_id,
        Staff.role == "doctor",
        Staff.is_active == True,
    ).scalar()


def _clinic_summary(c, db):
    admin = db.query(Staff).filter(Staff.clinic_id == c.id, Staff.role == "clinic_admin").first()
    doctors = _doctor_count(db, c.id)
    plan = c.subscription_plan or "free"
    card = get_rate_card(db)
    rate = card.get(plan, card.get("free", RATE_CARD["free"]))
    monthly_bill = doctors * rate["price_per_doctor"]
    return {
        "id":            c.id,
        "name":          c.name,
        "slug":          c.slug,
        "specialty":     c.specialty,
        "city":          c.city,
        "state":         c.state,
        "phone":         c.phone,
        "email":         c.email,
        "status":        c.status or ("active" if c.is_verified else "pending"),
        "plan":          plan,
        "doctor_count":  doctors,
        "monthly_bill":  monthly_bill,
        "is_active":     c.is_active,
        "is_verified":   c.is_verified,
        "suspension_reason":  c.suspension_reason,
        "suspension_comment": c.suspension_comment,
        "rejection_reason":   c.rejection_reason,
        "license_document_url": c.license_document_url,
        "created_at":    str(c.created_at),
        "admin_name":    admin.full_name if admin else None,
        "admin_email":   admin.email if admin else None,
        "admin_mobile":  admin.mobile if admin else None,
    }


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/dashboard")
def platform_dashboard(db: Session = Depends(get_db), current=Depends(get_current_platform_admin)):
    total     = db.query(func.count(Clinic.id)).scalar()
    active    = db.query(func.count(Clinic.id)).filter(Clinic.status == "active").scalar()
    pending   = db.query(func.count(Clinic.id)).filter(Clinic.status == "pending").scalar()
    suspended = db.query(func.count(Clinic.id)).filter(Clinic.status == "suspended").scalar()
    revoked   = db.query(func.count(Clinic.id)).filter(Clinic.status == "revoked").scalar()

    total_doctors  = db.query(func.count(Staff.id)).filter(Staff.role == "doctor", Staff.is_active == True).scalar()
    total_patients = db.query(func.count(Patient.id)).scalar()

    # Pending staff verifications
    pending_staff = db.query(func.count(Staff.id)).filter(
        Staff.role.in_(ROLES_NEEDING_VERIFICATION), Staff.is_active == False
    ).scalar()

    # This month's new registrations
    month_start = date.today().replace(day=1)
    new_this_month = db.query(func.count(Clinic.id)).filter(
        Clinic.created_at >= month_start
    ).scalar()

    # Estimated MRR across all active clinics
    clinics = db.query(Clinic).filter(Clinic.status == "active").all()
    card = get_rate_card(db)
    mrr = 0
    for c in clinics:
        plan = c.subscription_plan or "free"
        rate = card.get(plan, card.get("free", RATE_CARD["free"]))
        doctors = _doctor_count(db, c.id)
        mrr += doctors * rate["price_per_doctor"]

    return {
        "total_clinics":    total,
        "active_clinics":   active,
        "pending_clinics":  pending,
        "suspended_clinics": suspended,
        "revoked_clinics":  revoked,
        "total_doctors":    total_doctors,
        "total_patients":   total_patients,
        "pending_staff":    pending_staff,
        "new_this_month":   new_this_month,
        "mrr":              mrr,
        "rate_card":        card,
    }


# ── Clinics ───────────────────────────────────────────────────────────────────

@router.get("/clinics/pending")
def pending_clinics(db: Session = Depends(get_db), current=Depends(get_current_platform_admin)):
    clinics = db.query(Clinic).filter(
        Clinic.status == "pending"
    ).order_by(Clinic.created_at.desc()).all()
    return [_clinic_summary(c, db) for c in clinics]


@router.get("/clinics")
def list_all_clinics(
    status: Optional[str] = None,
    search: Optional[str] = None,
    plan: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    q = db.query(Clinic)
    if status:
        q = q.filter(Clinic.status == status)
    if search:
        q = q.filter(Clinic.name.ilike(f"%{search}%") | Clinic.city.ilike(f"%{search}%"))
    if plan:
        q = q.filter(Clinic.subscription_plan == plan)
    clinics = q.order_by(Clinic.created_at.desc()).offset(skip).limit(limit).all()
    return [_clinic_summary(c, db) for c in clinics]


@router.get("/clinics/{clinic_id}")
def get_clinic_detail(
    clinic_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(404, "Clinic not found")

    summary = _clinic_summary(clinic, db)

    # All staff
    staff_list = db.query(Staff).filter(Staff.clinic_id == clinic_id).order_by(Staff.role).all()
    summary["staff"] = [{
        "id":            s.id,
        "full_name":     s.full_name,
        "email":         s.email,
        "mobile":        s.mobile,
        "role":          s.role,
        "is_active":     s.is_active,
        "license_number": s.license_number,
        "created_at":    str(s.created_at),
    } for s in staff_list]

    # Branches
    branches = db.query(Branch).filter(Branch.clinic_id == clinic_id).all()
    summary["branches"] = [{"id": b.id, "name": b.name, "city": b.city, "is_active": b.is_active} for b in branches]

    # Billing breakdown
    plan = clinic.subscription_plan or "free"
    _card = get_rate_card(db)
    rate = _card.get(plan, _card.get("free", RATE_CARD["free"]))
    doctor_count = _doctor_count(db, clinic_id)
    summary["billing"] = {
        "plan":              plan,
        "price_per_doctor":  rate["price_per_doctor"],
        "active_doctors":    doctor_count,
        "monthly_total":     doctor_count * rate["price_per_doctor"],
        "rate_card":         _card,
    }

    # Audit log for this clinic
    logs = db.query(AuditLog).filter(
        AuditLog.target_type == "clinic", AuditLog.target_id == clinic_id
    ).order_by(AuditLog.created_at.desc()).limit(20).all()
    summary["audit_log"] = [{
        "action":     l.action,
        "admin_name": l.admin_name,
        "reason":     l.reason,
        "comment":    l.comment,
        "created_at": str(l.created_at),
    } for l in logs]

    return summary


# ── Clinic Actions ────────────────────────────────────────────────────────────

@router.post("/clinics/{clinic_id}/create-manager")
def create_clinic_manager(
    clinic_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    """Super admin creates a Clinic Manager account for an approved clinic."""
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(404, "Clinic not found")

    email  = body.get("email")
    mobile = body.get("mobile")
    if not body.get("full_name"):
        raise HTTPException(400, "full_name is required")
    if email and db.query(Staff).filter(Staff.email == email).first():
        raise HTTPException(400, "Email already registered")
    if mobile and db.query(Staff).filter(Staff.mobile == mobile).first():
        raise HTTPException(400, "Mobile already registered")

    temp_password = _generate_temp_password()

    manager = Staff(
        clinic_id       = clinic_id,
        full_name       = body["full_name"],
        email           = email,
        mobile          = mobile,
        hashed_password = hash_password(temp_password),
        role            = "clinic_manager",
        is_active       = True,
        is_first_login  = True,
        temp_pw_expiry  = datetime.utcnow() + timedelta(hours=48),
    )
    db.add(manager)
    db.flush()
    manager.username = _generate_username(body["full_name"], db)
    _log(db, "created_manager", "staff", clinic_id, body["full_name"], current)
    db.commit()
    db.refresh(manager)

    # Temp password returned in response only — not logged

    return {
        "id":            manager.id,
        "full_name":     manager.full_name,
        "email":         manager.email,
        "role":          manager.role,
        "username":      manager.username,
        "temp_password": temp_password,
        "message":       "Clinic Manager created. Share credentials immediately — shown only once.",
    }


@router.put("/clinics/{clinic_id}/approve")
def approve_clinic(clinic_id: int, db: Session = Depends(get_db), current=Depends(get_current_platform_admin)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(404, "Clinic not found")
    clinic.status = "active"
    _sync_clinic_status(clinic)

    # Issue credentials to clinic_admin (first doctor/owner)
    admin_staff = db.query(Staff).filter(
        Staff.clinic_id == clinic_id,
        Staff.role == "clinic_admin",
    ).first()

    issued = None
    if admin_staff:
        if not admin_staff.username:
            admin_staff.username = _generate_username(admin_staff.full_name, db)
        temp_password = _generate_temp_password()
        admin_staff.hashed_password = hash_password(temp_password)
        admin_staff.is_first_login  = True
        admin_staff.temp_pw_expiry  = datetime.utcnow() + timedelta(hours=48)
        admin_staff.is_active       = True
        issued = {"username": admin_staff.username, "temp_password": temp_password, "staff_name": admin_staff.full_name}
        pass  # temp_password returned in response only — not logged

    _log(db, "approved_clinic", "clinic", clinic_id, clinic.name, current)
    db.commit()

    response = {"message": f"{clinic.name} approved and is now live"}
    if issued:
        response["credentials"] = issued
        response["note"] = "Share these credentials with the clinic owner. Temp password expires in 48 hours."
    return response


@router.put("/clinics/{clinic_id}/reject")
def reject_clinic(
    clinic_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(404, "Clinic not found")
    clinic.status = "revoked"
    clinic.rejection_reason = body.get("reason", "")
    _sync_clinic_status(clinic)
    _log(db, "rejected_clinic", "clinic", clinic_id, clinic.name, current,
         reason=body.get("reason"), comment=body.get("comment"))
    db.commit()
    return {"message": f"{clinic.name} rejected"}


@router.put("/clinics/{clinic_id}/suspend")
def suspend_clinic(
    clinic_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(404, "Clinic not found")
    reason = body.get("reason", "")
    if reason not in SUSPENSION_REASONS:
        raise HTTPException(400, f"reason must be one of {SUSPENSION_REASONS}")
    clinic.status = "suspended"
    clinic.suspension_reason = reason
    clinic.suspension_comment = body.get("comment", "")
    _sync_clinic_status(clinic)
    db.query(Staff).filter(Staff.clinic_id == clinic_id).update({"is_active": False})
    _log(db, "suspended_clinic", "clinic", clinic_id, clinic.name, current,
         reason=reason, comment=body.get("comment"))
    db.commit()
    return {"message": f"{clinic.name} suspended"}


@router.put("/clinics/{clinic_id}/revoke")
def revoke_clinic(
    clinic_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(404, "Clinic not found")
    clinic.status = "revoked"
    clinic.suspension_reason = body.get("reason", "")
    clinic.suspension_comment = body.get("comment", "")
    _sync_clinic_status(clinic)
    db.query(Staff).filter(Staff.clinic_id == clinic_id).update({"is_active": False})
    _log(db, "revoked_clinic", "clinic", clinic_id, clinic.name, current,
         reason=body.get("reason"), comment=body.get("comment"))
    db.commit()
    return {"message": f"{clinic.name} revoked"}


@router.put("/clinics/{clinic_id}/reactivate")
def reactivate_clinic(clinic_id: int, db: Session = Depends(get_db), current=Depends(get_current_platform_admin)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(404, "Clinic not found")
    clinic.status = "active"
    clinic.suspension_reason = None
    clinic.suspension_comment = None
    _sync_clinic_status(clinic)
    roles_auto_activate = ['clinic_admin', 'clinic_manager', 'doctor', 'receptionist']
    db.query(Staff).filter(
        Staff.clinic_id == clinic_id, Staff.role.in_(roles_auto_activate)
    ).update({"is_active": True})
    _log(db, "reactivated_clinic", "clinic", clinic_id, clinic.name, current)
    db.commit()
    return {"message": f"{clinic.name} reactivated"}


@router.put("/clinics/{clinic_id}/plan")
def change_plan(
    clinic_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    plan = body.get("plan")
    card = get_rate_card(db)
    if plan not in card:
        raise HTTPException(400, f"Plan must be one of {list(card.keys())}")
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(404, "Clinic not found")
    old_plan = clinic.subscription_plan
    active_doctors = _doctor_count(db, clinic_id)
    max_allowed = card[plan]["max_doctors"]
    if active_doctors > max_allowed:
        raise HTTPException(400,
            f"Cannot downgrade to {plan}: clinic has {active_doctors} active doctors "
            f"but {plan} plan allows max {max_allowed}. Deactivate excess doctors first.")
    clinic.subscription_plan = plan
    clinic.subscription_status = "active"
    _log(db, "changed_plan", "clinic", clinic_id, clinic.name, current,
         reason=f"{old_plan} → {plan}")
    db.commit()
    return {"message": f"Plan changed to {plan}", "monthly_bill": active_doctors * card[plan]["price_per_doctor"]}


# ── Staff Verification ────────────────────────────────────────────────────────

@router.get("/staff/pending")
def pending_staff(db: Session = Depends(get_db), current=Depends(get_current_platform_admin)):
    staff_list = db.query(Staff).filter(
        Staff.role.in_(ROLES_NEEDING_VERIFICATION), Staff.is_active == False
    ).order_by(Staff.created_at.desc()).all()
    result = []
    for s in staff_list:
        clinic = db.query(Clinic).filter(Clinic.id == s.clinic_id).first()
        result.append({
            "id":            s.id,
            "full_name":     s.full_name,
            "email":         s.email,
            "mobile":        s.mobile,
            "role":          s.role,
            "clinic_id":     s.clinic_id,
            "clinic_name":   clinic.name if clinic else "—",
            "license_number": s.license_number,
            "license_document_url": s.license_document_url,
            "created_at":    str(s.created_at),
        })
    return result


@router.put("/staff/{staff_id}/verify")
def verify_staff(staff_id: int, db: Session = Depends(get_db), current=Depends(get_current_platform_admin)):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(404, "Staff not found")

    # Generate username if not already set
    if not staff.username:
        staff.username = _generate_username(staff.full_name, db)

    # Issue temporary password
    temp_password = _generate_temp_password()
    staff.hashed_password = hash_password(temp_password)
    staff.is_first_login  = True
    staff.temp_pw_expiry  = datetime.utcnow() + timedelta(hours=48)
    staff.is_active = True

    _log(db, "verified_staff", "staff", staff_id, staff.full_name, current)
    db.commit()

    # Log credentials to console (email/SMS to be wired in Phase 2)
    # Temp password returned in response only — not logged

    return {
        "message":      f"{staff.full_name} ({staff.role}) verified",
        "username":     staff.username,
        "temp_password": temp_password,
        "note":         "Share these credentials with the staff member. Temp password expires in 48 hours.",
    }


@router.post("/staff/{staff_id}/reset-password")
def reset_staff_password(
    staff_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    """Reissue temporary password. Forces password reset on next login. Old password immediately invalidated."""
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    temp_password = _generate_temp_password()
    staff.hashed_password = hash_password(temp_password)
    staff.is_first_login  = True
    staff.temp_pw_expiry  = datetime.utcnow() + timedelta(hours=48)
    db.commit()
    _log(db, "reset_password", "staff", staff_id, staff.full_name, current)

    # Temp password returned in response only — not logged

    return {
        "message":       f"New temporary password issued for {staff.full_name}",
        "username":      staff.username,
        "temp_password": temp_password,
        "note":          "Share this immediately. It expires in 48 hours and is invalidated after first use.",
    }


@router.post("/platform-admin/reset-password")
def reset_platform_admin_password(
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    """Reset own platform admin password."""
    temp_password = (
        secrets.choice(_string.ascii_uppercase) +
        ''.join(secrets.choice(_string.ascii_lowercase) for _ in range(4)) +
        '-' +
        ''.join(secrets.choice(_string.digits) for _ in range(4)) +
        '-' +
        secrets.choice(_string.ascii_uppercase) +
        ''.join(secrets.choice(_string.ascii_lowercase) for _ in range(4))
    )
    current.hashed_password = hash_password(temp_password)
    db.commit()
    return {"temp_password": temp_password, "note": "Save this immediately."}


@router.put("/staff/{staff_id}/reject")
def reject_staff(
    staff_id: int,
    body: dict = {},
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(404, "Staff not found")
    staff.is_active = False
    _log(db, "rejected_staff", "staff", staff_id, staff.full_name, current,
         reason=body.get("reason"), comment=body.get("comment"))
    db.commit()
    return {"message": f"{staff.full_name} rejected"}


# ── Audit Log ─────────────────────────────────────────────────────────────────

@router.get("/audit-log")
def get_audit_log(
    target_type: Optional[str] = None,
    action: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    q = db.query(AuditLog)
    if target_type:
        q = q.filter(AuditLog.target_type == target_type)
    if action:
        q = q.filter(AuditLog.action == action)
    if date_from:
        q = q.filter(AuditLog.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.filter(AuditLog.created_at <= datetime.fromisoformat(date_to))
    logs = q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return [{
        "id":          l.id,
        "action":      l.action,
        "target_type": l.target_type,
        "target_id":   l.target_id,
        "target_name": l.target_name,
        "admin_name":  l.admin_name,
        "reason":      l.reason,
        "comment":     l.comment,
        "created_at":  str(l.created_at),
    } for l in logs]


# ── Reports ───────────────────────────────────────────────────────────────────

@router.get("/reports")
def get_reports(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    # Default: last 30 days
    end = datetime.utcnow()
    start = end - timedelta(days=30)
    if date_from:
        start = datetime.fromisoformat(date_from)
    if date_to:
        end = datetime.fromisoformat(date_to)

    # Clinics registered over time (by month)
    all_clinics = db.query(Clinic).all()
    monthly_reg = {}
    for c in all_clinics:
        if c.created_at:
            key = c.created_at.strftime("%Y-%m")
            monthly_reg[key] = monthly_reg.get(key, 0) + 1

    # Status distribution
    status_dist = {
        "active":    db.query(func.count(Clinic.id)).filter(Clinic.status == "active").scalar(),
        "pending":   db.query(func.count(Clinic.id)).filter(Clinic.status == "pending").scalar(),
        "suspended": db.query(func.count(Clinic.id)).filter(Clinic.status == "suspended").scalar(),
        "revoked":   db.query(func.count(Clinic.id)).filter(Clinic.status == "revoked").scalar(),
    }

    # Plan distribution
    _card = get_rate_card(db)
    plan_dist = {}
    for plan in _card:
        plan_dist[plan] = db.query(func.count(Clinic.id)).filter(
            Clinic.subscription_plan == plan, Clinic.status == "active"
        ).scalar()

    # Top cities
    cities_raw = db.query(Clinic.city, func.count(Clinic.id)).filter(
        Clinic.status == "active", Clinic.city != None
    ).group_by(Clinic.city).order_by(func.count(Clinic.id).desc()).limit(10).all()
    top_cities = [{"city": c, "count": n} for c, n in cities_raw]

    # Billing summary per active clinic
    active_clinics = db.query(Clinic).filter(Clinic.status == "active").all()
    billing_rows = []
    total_mrr = 0
    for c in active_clinics:
        plan = c.subscription_plan or "free"
        rate = _card.get(plan, _card.get("free", RATE_CARD["free"]))
        doctors = _doctor_count(db, c.id)
        bill = doctors * rate["price_per_doctor"]
        total_mrr += bill
        billing_rows.append({
            "clinic_name": c.name,
            "city":        c.city,
            "plan":        plan,
            "doctors":     doctors,
            "monthly_bill": bill,
        })
    billing_rows.sort(key=lambda x: x["monthly_bill"], reverse=True)

    # Staff verified this period
    verified_count = db.query(func.count(AuditLog.id)).filter(
        AuditLog.action == "verified_staff",
        AuditLog.created_at >= start,
        AuditLog.created_at <= end,
    ).scalar()

    return {
        "period":          {"from": str(start.date()), "to": str(end.date())},
        "monthly_registrations": sorted(monthly_reg.items()),
        "status_distribution":   status_dist,
        "plan_distribution":     plan_dist,
        "top_cities":            top_cities,
        "billing_summary":       billing_rows[:20],
        "total_mrr":             total_mrr,
        "staff_verified_period": verified_count,
    }


# ── Direct Clinic Creation (superadmin) ──────────────────────────────────────────

def _make_slug(name: str, db: Session) -> str:
    base = re.sub(r'[^a-z0-9]+', '-', name.strip().lower()).strip('-')[:60]
    slug = base
    n = 2
    while db.query(Clinic).filter(Clinic.slug == slug).first():
        slug = f"{base}-{n}"
        n += 1
    return slug


@router.post("/clinics/create-direct")
def create_clinic_direct(
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    """Superadmin creates a clinic directly (already active). Also creates a clinic_admin account."""
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    phone = (body.get("phone") or "").strip()
    if not name or not email or not phone:
        raise HTTPException(status_code=400, detail="Name, email, and phone are required")

    if db.query(Clinic).filter(Clinic.email == email).first():
        raise HTTPException(status_code=409, detail="A clinic with this email already exists")

    clinic = Clinic(
        name=name,
        slug=_make_slug(name, db),
        phone=phone,
        email=email,
        city=body.get("city", ""),
        state=body.get("state", ""),
        specialty=body.get("specialty", ""),
        subscription_plan=body.get("plan", "free"),
        status="active",
        is_active=True,
        is_verified=True,
    )
    db.add(clinic)
    db.flush()  # get clinic.id before creating staff

    temp_pw = _generate_temp_password()
    username = _generate_username(name, db)
    admin_staff = Staff(
        clinic_id=clinic.id,
        full_name=f"{name} Admin",
        email=email,
        hashed_password=hash_password(temp_pw),
        role="clinic_admin",
        username=username,
        is_active=True,
        is_first_login=True,
        temp_pw_expiry=datetime.utcnow() + timedelta(days=7),
        token_version=1,
    )
    db.add(admin_staff)

    log = AuditLog(
        actor_id=current.id, actor_type="platform_admin",
        action="create_clinic_direct",
        target_type="clinic", target_id=clinic.id,
        details=f"Direct clinic creation: {name} ({email}). Admin account: {username}",
    )
    db.add(log)
    db.commit()
    db.refresh(clinic)

    return {
        "clinic": {
            "id":       clinic.id,
            "name":     clinic.name,
            "slug":     clinic.slug,
            "email":    clinic.email,
            "phone":    clinic.phone,
            "city":     clinic.city,
            "state":    clinic.state,
            "specialty": clinic.specialty,
            "plan":     clinic.subscription_plan,
            "status":   clinic.status,
        },
        "credentials": {
            "username":      username,
            "email":         email,
            "temp_password": temp_pw,
            "note":          "Temp password expires in 7 days. Staff must change on first login.",
        },
    }


@router.get("/bhid/{bh_id}")
def platform_bhid_lookup(
    bh_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    """Look up a patient by BH ID across all clinics."""
    from app.models.models import Patient, PatientUser

    patients = db.query(Patient).filter(
        Patient.bh_id == bh_id.upper()
    ).all()

    if not patients:
        patients = db.query(Patient).filter(
            Patient.uhid == bh_id.upper()
        ).all()

    if not patients:
        raise HTTPException(status_code=404, detail="No patient found with this BH ID")

    result = []
    for p in patients:
        clinic = db.query(Clinic).filter(Clinic.id == p.clinic_id).first()
        portal_user = db.query(PatientUser).filter(PatientUser.mobile == p.mobile).first() if p.mobile else None
        result.append({
            "patient_id": p.id,
            "bh_id": p.bh_id,
            "uhid": p.uhid,
            "full_name": p.full_name,
            "mobile": p.mobile,
            "email": p.email,
            "gender": p.gender,
            "date_of_birth": str(p.date_of_birth) if p.date_of_birth else None,
            "clinic_name": clinic.name if clinic else "Unknown",
            "clinic_id": p.clinic_id,
            "has_portal_account": portal_user is not None,
            "portal_active": portal_user.is_active if portal_user else False,
            "created_at": str(p.created_at),
        })

    return {"bh_id": bh_id.upper(), "records": result, "total": len(result)}


@router.get("/clinics/{clinic_id}/staff")
def get_clinic_staff(
    clinic_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    """Get all staff members for a clinic."""
    staff = db.query(Staff).filter(Staff.clinic_id == clinic_id).order_by(Staff.role, Staff.full_name).all()
    return [
        {
            "id": s.id,
            "full_name": s.full_name,
            "email": s.email,
            "mobile": s.mobile,
            "role": s.role,
            "is_active": s.is_active,
            "branch_id": s.branch_id,
            "created_at": str(s.created_at),
        }
        for s in staff
    ]


# ── Assessment Templates ──────────────────────────────────────────────────────

def _template_dict(t: AssessmentTemplate, db: Session) -> dict:
    assignments = db.query(TemplateAssignment).filter(TemplateAssignment.template_id == t.id).all()
    assignment_list = []
    for a in assignments:
        entry = {"id": a.id, "scope": a.scope, "clinic_id": a.clinic_id, "department_id": a.department_id}
        if a.clinic_id:
            c = db.query(Clinic).filter(Clinic.id == a.clinic_id).first()
            entry["clinic_name"] = c.name if c else None
        if a.department_id:
            d = db.query(Department).filter(Department.id == a.department_id).first()
            entry["department_name"] = d.name if d else None
        assignment_list.append(entry)
    return {
        "id": t.id,
        "name": t.name,
        "specialty": t.specialty,
        "description": t.description,
        "fields": t.fields or [],
        "scope": t.scope,
        "clinic_id": t.clinic_id,
        "is_active": t.is_active,
        "assignments": assignment_list,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("/assessment-templates")
def list_assessment_templates(
    specialty: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    q = db.query(AssessmentTemplate)
    if specialty:
        q = q.filter(AssessmentTemplate.specialty == specialty)
    templates = q.order_by(AssessmentTemplate.created_at.desc()).all()
    return [_template_dict(t, db) for t in templates]


@router.post("/assessment-templates")
def create_assessment_template(
    body: dict,
    db: Session = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    t = AssessmentTemplate(
        name=body["name"],
        specialty=body["specialty"],
        description=body.get("description"),
        fields=body.get("fields", []),
        scope="platform",
        is_active=True,
        created_by_admin=admin.id,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _template_dict(t, db)


@router.put("/assessment-templates/{template_id}")
def update_assessment_template(
    template_id: int,
    body: dict,
    db: Session = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    t = db.query(AssessmentTemplate).filter(AssessmentTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    for field in ["name", "specialty", "description", "fields", "is_active"]:
        if field in body:
            setattr(t, field, body[field])
    t.updated_at = datetime.utcnow()
    db.commit()
    return _template_dict(t, db)


@router.delete("/assessment-templates/{template_id}")
def delete_assessment_template(
    template_id: int,
    db: Session = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    t = db.query(AssessmentTemplate).filter(AssessmentTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    t.is_active = False
    t.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Template deactivated"}


@router.post("/assessment-templates/{template_id}/assign")
def assign_template(
    template_id: int,
    body: dict,
    db: Session = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    """
    Assign a template to multiple targets in one call.
    body: {
      "assignments": [
        {"scope": "all"},
        {"scope": "clinic", "clinic_id": 5},
        {"scope": "clinic", "clinic_id": 8},
        {"scope": "department", "clinic_id": 5, "department_id": 12},
      ]
    }
    Replaces all existing assignments for this template.
    """
    t = db.query(AssessmentTemplate).filter(AssessmentTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    # Remove existing assignments and replace with new ones
    db.query(TemplateAssignment).filter(TemplateAssignment.template_id == template_id).delete()

    for a in body.get("assignments", []):
        ta = TemplateAssignment(
            template_id=template_id,
            scope=a["scope"],
            clinic_id=a.get("clinic_id"),
            department_id=a.get("department_id"),
            assigned_by=admin.id,
        )
        db.add(ta)

    db.commit()
    return _template_dict(t, db)


@router.get("/assessment-templates/for-clinic/{clinic_id}")
def get_templates_for_clinic(
    clinic_id: int,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    """Preview which templates a specific clinic/department would see."""
    return _fetch_templates_for_clinic(clinic_id, department_id, db)


def _fetch_templates_for_clinic(clinic_id: int, department_id: Optional[int], db: Session):
    assigned_ids = set()
    assignments = db.query(TemplateAssignment).all()
    for a in assignments:
        if a.scope == "all":
            assigned_ids.add(a.template_id)
        elif a.scope == "clinic" and a.clinic_id == clinic_id:
            assigned_ids.add(a.template_id)
        elif a.scope == "department" and a.clinic_id == clinic_id:
            if department_id is None or a.department_id == department_id:
                assigned_ids.add(a.template_id)
    templates = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id.in_(assigned_ids),
        AssessmentTemplate.is_active == True,
    ).all()
    return [{"id": t.id, "name": t.name, "specialty": t.specialty,
             "description": t.description, "fields": t.fields or []} for t in templates]
# ── Superadmin Security Overrides ─────────────────────────────────────────────

@router.get("/staff/{staff_id}/security")
def platform_staff_security_profile(
    staff_id: int, db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin)
):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    logs = db.query(AuditLog).filter(AuditLog.target_id == staff_id, AuditLog.target_type == "staff"
    ).order_by(AuditLog.created_at.desc()).limit(20).all()

    return {
        "staff_id": staff.id,
        "full_name": staff.full_name,
        "role": staff.role,
        "is_active": staff.is_active,
        "clinic_id": staff.clinic_id,
        "token_version": staff.token_version,
        "has_pin": bool(getattr(staff, 'pin_hash', None)),
        "pin_reset_required": getattr(staff, 'pin_reset_required', False),
        "first_login": staff.is_first_login,
        "audit_log": [
            {"id": l.id, "action": l.action, "actor_id": l.actor_id, "details": l.details, "created_at": l.created_at}
            for l in logs
        ]
    }


@router.post("/staff/{staff_id}/override-reset-password")
def platform_override_reset_password(
    staff_id: int, body: dict, db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin)
):
    reason = (body.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is mandatory for superadmin overrides")

    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    temp_pw = _generate_temp_password()
    staff.hashed_password = hash_password(temp_pw)
    staff.token_version = (staff.token_version or 1) + 1
    staff.is_first_login = True

    log = AuditLog(
        actor_id=current.id, actor_type="platform_admin",
        action="superadmin_override_reset_password",
        target_type="staff", target_id=staff_id,
        clinic_id=staff.clinic_id,
        details=f"SUPERADMIN OVERRIDE. Reason: {reason}"
    )
    db.add(log)
    db.commit()
    return {"message": "Password overridden.", "temp_password": temp_pw}


@router.post("/staff/{staff_id}/override-revoke-access")
def platform_override_revoke_access(
    staff_id: int, body: dict, db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin)
):
    reason = (body.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is mandatory for superadmin overrides")

    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    staff.is_active = False
    staff.token_version = (staff.token_version or 1) + 1
    staff.pin_hash = None

    log = AuditLog(
        actor_id=current.id, actor_type="platform_admin",
        action="superadmin_override_revoke_access",
        target_type="staff", target_id=staff_id,
        clinic_id=staff.clinic_id,
        details=f"SUPERADMIN OVERRIDE. Reason: {reason}"
    )
    db.add(log)
    db.commit()
    return {"message": f"Access revoked for staff {staff_id}"}


@router.post("/staff/{staff_id}/override-reset-pin")
def platform_override_reset_pin(
    staff_id: int, body: dict, db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin)
):
    reason = (body.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is mandatory for superadmin overrides")

    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    staff.pin_hash = None
    staff.pin_set_at = None
    staff.pin_reset_required = True

    log = AuditLog(
        actor_id=current.id, actor_type="platform_admin",
        action="superadmin_override_reset_pin",
        target_type="staff", target_id=staff_id,
        clinic_id=staff.clinic_id,
        details=f"SUPERADMIN OVERRIDE. Reason: {reason}"
    )
    db.add(log)
    db.commit()
    return {"message": "PIN cleared for staff"}


@router.post("/staff/{staff_id}/override-change-role")
def platform_override_change_role(
    staff_id: int, body: dict, db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin)
):
    reason = (body.get("reason") or "").strip()
    new_role = (body.get("role") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is mandatory for superadmin overrides")
    if not new_role:
        raise HTTPException(status_code=400, detail="Role is required")

    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    old_role = staff.role
    staff.role = new_role
    staff.token_version = (staff.token_version or 1) + 1

    log = AuditLog(
        actor_id=current.id, actor_type="platform_admin",
        action="superadmin_override_change_role",
        target_type="staff", target_id=staff_id,
        clinic_id=staff.clinic_id,
        details=f"SUPERADMIN OVERRIDE. Role changed from {old_role} to {new_role}. Reason: {reason}"
    )
    db.add(log)
    db.commit()
    return {"message": f"Role changed from {old_role} to {new_role}"}


@router.get("/password-reset-requests")
def platform_all_reset_requests(
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin)
):
    """All pending forgot-password requests across all clinics."""
    requests = db.query(PasswordResetRequest).filter(
        PasswordResetRequest.status == "pending"
    ).order_by(PasswordResetRequest.requested_at.desc()).limit(100).all()

    result = []
    for r in requests:
        staff = db.query(Staff).filter(Staff.id == r.staff_id).first()
        result.append({
            "id": r.id,
            "staff_id": r.staff_id,
            "clinic_id": r.clinic_id,
            "staff_name": staff.full_name if staff else "Unknown",
            "requested_at": r.requested_at,
            "note": r.note,
        })
    return result


# ── Superadmin Clinic Edit ────────────────────────────────────────────────────

@router.put("/clinics/{clinic_id}/edit")
def superadmin_edit_clinic(
    clinic_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin)
):
    """Superadmin can edit any clinic field post-registration — modules, beds, departments, profile."""
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    EDITABLE = [
        "name", "phone", "email", "address", "city", "state", "pincode",
        "website", "operating_hours", "description", "specialty",
        "brand_name", "brand_color", "gstin", "drug_license_number",
        "reg_number", "accreditation",
        # Module flags
        "has_pharmacy", "has_lab", "has_imaging", "has_inpatient",
        "has_emergency", "has_blood_bank", "has_ambulance", "has_telehealth",
        "wards_enabled",
        # Capacity
        "total_beds", "icu_beds", "ot_count",
        # Diagnostic
        "nabl_accredited", "nabl_number",
    ]

    changes = []
    for field in EDITABLE:
        if field in body:
            old_val = getattr(clinic, field, None)
            new_val = body[field]
            if old_val != new_val:
                setattr(clinic, field, new_val)
                changes.append(f"{field}: {old_val} → {new_val}")

    if not changes:
        return {"message": "No changes made"}

    log = AuditLog(
        actor_id=current.id, actor_type="platform_admin",
        action="superadmin_edit_clinic",
        target_type="clinic", target_id=clinic_id,
        details=f"Fields updated: {'; '.join(changes)}"
    )
    db.add(log)
    db.commit()
    return {"message": f"Clinic updated. {len(changes)} field(s) changed.", "changes": changes}


# ── Platform Admin Team Management ───────────────────────────────────────────

class CreateAdminRequest(BaseModel):
    full_name: str
    email: str


@router.get("/admins")
def list_platform_admins(
    current=Depends(get_current_platform_admin),
    db: Session = Depends(get_db),
):
    """List all platform admin accounts."""
    admins = db.query(PlatformAdmin).order_by(PlatformAdmin.created_at.asc()).all()
    return [
        {
            "id":         a.id,
            "full_name":  a.full_name,
            "email":      a.email,
            "is_active":  a.is_active,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in admins
    ]


@router.post("/admins")
def create_platform_admin(
    body: CreateAdminRequest,
    current=Depends(get_current_platform_admin),
    db: Session = Depends(get_db),
):
    """Create a new platform admin. Returns a one-time temp password."""
    existing = db.query(PlatformAdmin).filter(
        PlatformAdmin.email == body.email.lower().strip()
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="An admin with this email already exists")

    temp_pw = _generate_temp_password()
    admin = PlatformAdmin(
        full_name=body.full_name.strip(),
        email=body.email.lower().strip(),
        hashed_password=hash_password(temp_pw),
        is_active=True,
        token_version=1,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    log = AuditLog(
        actor_id=current.id, actor_type="platform_admin",
        action="create_platform_admin",
        target_type="platform_admin", target_id=admin.id,
        details=f"Created admin: {admin.email}",
    )
    db.add(log)
    db.commit()

    return {
        "id":           admin.id,
        "full_name":    admin.full_name,
        "email":        admin.email,
        "temp_password": temp_pw,
        "message":      "Admin created. Share the temp password securely — it won't be shown again.",
    }


@router.patch("/admins/{admin_id}/toggle")
def toggle_platform_admin(
    admin_id: int,
    current=Depends(get_current_platform_admin),
    db: Session = Depends(get_db),
):
    """Activate or deactivate a platform admin account."""
    if admin_id == current.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    admin = db.query(PlatformAdmin).filter(PlatformAdmin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    admin.is_active = not admin.is_active
    db.commit()
    action = "activated" if admin.is_active else "deactivated"
    log = AuditLog(
        actor_id=current.id, actor_type="platform_admin",
        action=f"platform_admin_{action}",
        target_type="platform_admin", target_id=admin_id,
        details=f"{admin.email} {action}",
    )
    db.add(log)
    db.commit()
    return {"id": admin_id, "is_active": admin.is_active, "message": f"Admin {action}"}


# ── Hospital Setup (Platform Admin) ──────────────────────────────────────────────

def _get_clinic_or_404(clinic_id: int, db: Session) -> Clinic:
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic


@router.get("/clinics/{clinic_id}/org-config")
def platform_get_org_config(
    clinic_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    clinic = _get_clinic_or_404(clinic_id, db)
    return {
        "org_type": getattr(clinic, "org_type", "clinic"),
        "wards_enabled": getattr(clinic, "wards_enabled", False),
        "clinic_prefix": clinic.clinic_prefix,
        "patient_id_counter": clinic.patient_id_counter,
        "admission_sequence": getattr(clinic, "admission_sequence", 0),
    }


@router.put("/clinics/{clinic_id}/org-config")
def platform_update_org_config(
    clinic_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    clinic = _get_clinic_or_404(clinic_id, db)
    if "org_type" in body:
        clinic.org_type = body["org_type"]
    if "wards_enabled" in body:
        clinic.wards_enabled = body["wards_enabled"]
    if "clinic_prefix" in body:
        clinic.clinic_prefix = body["clinic_prefix"]
    db.commit()
    return {"detail": "org config updated"}


@router.get("/clinics/{clinic_id}/departments")
def platform_list_departments(
    clinic_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    _get_clinic_or_404(clinic_id, db)
    depts = db.query(Department).filter(Department.clinic_id == clinic_id).all()
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


@router.post("/clinics/{clinic_id}/departments")
def platform_create_department(
    clinic_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    _get_clinic_or_404(clinic_id, db)
    dept = Department(
        clinic_id=clinic_id,
        name=body["name"],
        code=body.get("code"),
        dept_type=body.get("dept_type", "clinical"),
        head_doctor_id=body.get("head_doctor_id"),
        color_hex=body.get("color_hex"),
        is_active=body.get("is_active", True),
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return {"id": dept.id, "name": dept.name}


@router.put("/clinics/{clinic_id}/departments/{dept_id}")
def platform_update_department(
    clinic_id: int,
    dept_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    dept = db.query(Department).filter(
        Department.id == dept_id,
        Department.clinic_id == clinic_id,
    ).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    for field in ("name", "code", "dept_type", "head_doctor_id", "color_hex", "is_active"):
        if field in body:
            setattr(dept, field, body[field])
    db.commit()
    return {"detail": "updated"}


@router.delete("/clinics/{clinic_id}/departments/{dept_id}")
def platform_delete_department(
    clinic_id: int,
    dept_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    dept = db.query(Department).filter(
        Department.id == dept_id,
        Department.clinic_id == clinic_id,
    ).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.is_active = False
    db.commit()
    return {"detail": "deleted"}


@router.get("/clinics/{clinic_id}/wards")
def platform_list_wards(
    clinic_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    _get_clinic_or_404(clinic_id, db)
    wards = db.query(Ward).filter(Ward.clinic_id == clinic_id, Ward.is_active == True).all()
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


@router.post("/clinics/{clinic_id}/wards")
def platform_create_ward(
    clinic_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    _get_clinic_or_404(clinic_id, db)
    ward = Ward(
        clinic_id=clinic_id,
        department_id=body.get("department_id"),
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


@router.put("/clinics/{clinic_id}/wards/{ward_id}")
def platform_update_ward(
    clinic_id: int,
    ward_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    ward = db.query(Ward).filter(Ward.id == ward_id, Ward.clinic_id == clinic_id).first()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")
    for field in ("name", "floor", "wing", "ward_type", "total_beds", "is_active"):
        if field in body:
            setattr(ward, field, body[field])
    db.commit()
    return {"detail": "updated"}


@router.delete("/clinics/{clinic_id}/wards/{ward_id}")
def platform_delete_ward(
    clinic_id: int,
    ward_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    ward = db.query(Ward).filter(Ward.id == ward_id, Ward.clinic_id == clinic_id).first()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")
    ward.is_active = False
    db.commit()
    return {"detail": "deleted"}


@router.get("/clinics/{clinic_id}/beds")
def platform_list_beds(
    clinic_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    _get_clinic_or_404(clinic_id, db)
    beds = db.query(Bed).filter(Bed.clinic_id == clinic_id).all()
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


@router.post("/clinics/{clinic_id}/beds")
def platform_create_bed(
    clinic_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    _get_clinic_or_404(clinic_id, db)
    bed = Bed(
        clinic_id=clinic_id,
        ward_id=body["ward_id"],
        bed_number=body["bed_number"],
        bed_type=body.get("bed_type", "general"),
    )
    db.add(bed)
    db.commit()
    db.refresh(bed)
    return {"id": bed.id, "bed_number": bed.bed_number}


@router.put("/clinics/{clinic_id}/beds/{bed_id}")
def platform_update_bed(
    clinic_id: int,
    bed_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    bed = db.query(Bed).filter(Bed.id == bed_id, Bed.clinic_id == clinic_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    for field in ("bed_type", "status", "current_admission_id"):
        if field in body:
            setattr(bed, field, body[field])
    db.commit()
    return {"detail": "updated"}


# ── Direct Clinic Creation ────────────────────────────────────────────────────

import re as _re


def _make_slug(name: str, db) -> str:
    base = _re.sub(r'[^a-z0-9]+', '-', name.strip().lower()).strip('-')[:60]
    slug, n = base, 2
    while db.query(Clinic).filter(Clinic.slug == slug).first():
        slug = f"{base}-{n}"; n += 1
    return slug


@router.post("/clinics/create-direct")
async def create_clinic_direct(
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    """
    Register a new clinic/hospital/pharmacy/diagnostic directly.
    Creates org as active + verified, generates admin account, emails credentials.
    """
    from app.utils.email import send_clinic_credentials

    name  = (body.get("name")  or "").strip()
    email = (body.get("email") or "").strip().lower()
    phone = (body.get("phone") or "").strip()
    if not name or not email or not phone:
        raise HTTPException(400, "Name, email and phone are required")
    if db.query(Clinic).filter(Clinic.email == email).first():
        raise HTTPException(409, "An organisation with this email already exists")

    org_type = body.get("org_type", "hospital")
    if org_type not in ("clinic", "hospital", "pharmacy", "diagnostic"):
        org_type = "hospital"

    parent_id = body.get("parent_clinic_id")
    if parent_id:
        if not db.query(Clinic).filter(Clinic.id == int(parent_id)).first():
            raise HTTPException(404, "Parent clinic/hospital not found")

    clinic = Clinic(
        name=name, slug=_make_slug(name, db), phone=phone, email=email,
        city=body.get("city", ""), state=body.get("state", ""),
        specialty=body.get("specialty", ""),
        subscription_plan=body.get("plan", "free"),
        org_type=org_type,
        status="active", is_active=True, is_verified=True,
        drug_license_number=body.get("drug_license_number") or None,
        nabl_accredited=bool(body.get("nabl_accredited", False)),
        nabl_number=body.get("nabl_number") or None,
        parent_clinic_id=int(parent_id) if parent_id else None,
    )
    db.add(clinic); db.flush()

    temp_pw  = _generate_temp_password()
    username = _generate_username(name, db)
    admin = Staff(
        clinic_id=clinic.id, full_name=f"{name} Admin", email=email,
        hashed_password=hash_password(temp_pw), role="clinic_admin",
        username=username, is_active=True, is_first_login=True,
        temp_pw_expiry=datetime.utcnow() + timedelta(days=7), token_version=1,
    )
    db.add(admin)
    db.add(AuditLog(
        actor_id=current.id, actor_type="platform_admin",
        action="create_clinic_direct", target_type="clinic", target_id=clinic.id,
        details=f"Direct creation [{org_type}]: {name} ({email}). Admin: {username}",
    ))
    db.commit(); db.refresh(clinic)

    await send_clinic_credentials(email, name, username, temp_pw)

    return {
        "clinic": {
            "id": clinic.id, "name": clinic.name, "slug": clinic.slug,
            "email": clinic.email, "phone": clinic.phone,
            "city": clinic.city, "state": clinic.state,
            "specialty": clinic.specialty, "plan": str(clinic.subscription_plan),
            "org_type": clinic.org_type,
        },
        "credentials": {
            "username": username, "email": email, "temp_password": temp_pw,
            "note": "Credentials emailed to the admin. Temp password expires in 7 days.",
        },
    }


# ── Plans & Pricing (editable from admin portal) ──────────────────────────────

@router.get("/pricing")
def get_pricing_config(
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    """Full pricing config: per-org-type plans, telehealth fees, cycle discounts."""
    return get_pricing(db)


@router.put("/pricing")
def update_pricing_config(
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    """
    Replace the pricing config. Takes effect immediately across MRR,
    billing summaries, plan validation, and the public pricing endpoint.
    """
    from app.models.models import PlatformSetting

    if not isinstance(body, dict) or not isinstance(body.get("plans"), dict):
        raise HTTPException(400, "Body must contain a 'plans' object")
    for org_type, plans in body["plans"].items():
        if org_type not in ("clinic", "hospital", "pharmacy", "diagnostic"):
            raise HTTPException(400, f"Unknown org type: {org_type}")
        if not isinstance(plans, list) or not all(isinstance(p, dict) and p.get("key") for p in plans):
            raise HTTPException(400, f"plans.{org_type} must be a list of plan objects with a 'key'")

    row = db.query(PlatformSetting).filter(PlatformSetting.key == "pricing").first()
    if row:
        row.value = body
        row.updated_by = current.id
    else:
        db.add(PlatformSetting(key="pricing", value=body, updated_by=current.id))

    _log(db, "update_pricing", "platform", 0, "Plans & Pricing", current)
    db.commit()
    return get_pricing(db)


@router.post("/pricing/reset")
def reset_pricing_config(
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    """Restore the default pricing (removes the stored override)."""
    from app.models.models import PlatformSetting
    db.query(PlatformSetting).filter(PlatformSetting.key == "pricing").delete()
    _log(db, "reset_pricing", "platform", 0, "Plans & Pricing", current)
    db.commit()
    return DEFAULT_PRICING
