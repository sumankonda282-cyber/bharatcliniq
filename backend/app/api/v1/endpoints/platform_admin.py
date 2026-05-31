from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from app.db.session import get_db
from app.core.security import get_current_platform_admin, hash_password
from app.models.models import Clinic, Branch, Staff, Patient, Appointment, PlatformAdmin
from app.schemas.schemas import ClinicCreate
import re

router = APIRouter(prefix="/platform", tags=["platform-admin"])


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    text = re.sub(r'^-+|-+$', '', text)
    return text


@router.get("/dashboard")
def platform_dashboard(
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    return {
        "total_clinics":      db.query(func.count(Clinic.id)).scalar(),
        "active_clinics":     db.query(func.count(Clinic.id)).filter(Clinic.is_active == True).scalar(),
        "verified_clinics":   db.query(func.count(Clinic.id)).filter(Clinic.is_verified == True).scalar(),
        "pending_clinics":    db.query(func.count(Clinic.id)).filter(Clinic.is_verified == False).scalar(),
        "total_patients":     db.query(func.count(Patient.id)).scalar(),
        "total_appointments": db.query(func.count(Appointment.id)).scalar(),
        "total_staff":        db.query(func.count(Staff.id)).scalar(),
    }


@router.get("/clinics")
def list_all_clinics(
    search: Optional[str] = None,
    plan: Optional[str] = None,
    verified: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    q = db.query(Clinic)
    if search:
        q = q.filter(Clinic.name.ilike(f"%{search}%"))
    if plan:
        q = q.filter(Clinic.subscription_plan == plan)
    if verified is not None:
        q = q.filter(Clinic.is_verified == verified)
    clinics = q.order_by(Clinic.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for c in clinics:
        admin = db.query(Staff).filter(Staff.clinic_id == c.id, Staff.role == 'clinic_admin').first()
        result.append({
            "id":           c.id,
            "name":         c.name,
            "slug":         c.slug,
            "specialty":    c.specialty,
            "city":         c.city,
            "state":        c.state,
            "phone":        c.phone,
            "email":        c.email,
            "is_active":    c.is_active,
            "is_verified":  c.is_verified,
            "plan":         c.subscription_plan,
            "status":       c.subscription_status,
            "created_at":   str(c.created_at),
            "admin_name":   admin.full_name if admin else None,
            "admin_email":  admin.email if admin else None,
            "admin_mobile": admin.mobile if admin else None,
        })
    return result


@router.get("/clinics/pending")
def pending_clinics(
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    clinics = db.query(Clinic).filter(Clinic.is_verified == False).order_by(Clinic.created_at.desc()).all()
    result = []
    for c in clinics:
        admin = db.query(Staff).filter(Staff.clinic_id == c.id).first()
        result.append({
            "id":           c.id,
            "name":         c.name,
            "specialty":    c.specialty,
            "city":         c.city,
            "state":        c.state,
            "phone":        c.phone,
            "email":        c.email,
            "is_active":    c.is_active,
            "is_verified":  c.is_verified,
            "created_at":   str(c.created_at),
            "admin_name":   admin.full_name if admin else None,
            "admin_email":  admin.email if admin else None,
            "admin_mobile": admin.mobile if admin else None,
            "plan":         c.subscription_plan,
        })
    return result


@router.put("/clinics/{clinic_id}/verify")
def verify_clinic(
    clinic_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.is_verified = True
    clinic.is_active = True
    db.query(Staff).filter(Staff.clinic_id == clinic_id).update({"is_active": True})
    db.commit()
    return {"message": f"{clinic.name} approved and is now live"}


@router.put("/clinics/{clinic_id}/reject")
def reject_clinic(
    clinic_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.is_verified = False
    clinic.is_active = False
    db.commit()
    return {"message": f"{clinic.name} rejected"}


@router.put("/clinics/{clinic_id}/toggle")
def toggle_clinic(
    clinic_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Not found")
    clinic.is_active = not clinic.is_active
    if not clinic.is_active:
        db.query(Staff).filter(Staff.clinic_id == clinic_id).update({"is_active": False})
    db.commit()
    return {"is_active": clinic.is_active}


@router.put("/clinics/{clinic_id}/subscription")
def update_subscription(
    clinic_id: int,
    plan: str,
    status: str = "active",
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    valid_plans = ["free", "basic", "pro", "enterprise", "trial"]
    if plan not in valid_plans:
        raise HTTPException(status_code=400, detail=f"Plan must be one of {valid_plans}")
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.subscription_plan = plan
    clinic.subscription_status = status
    db.commit()
    return {"plan": plan, "status": status, "clinic": clinic.name}


@router.post("/platform-admin")
def create_platform_admin(
    full_name: str,
    email: str,
    password: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_platform_admin),
):
    existing = db.query(PlatformAdmin).filter(PlatformAdmin.email == email).first()
    if existing:
        raise HTTPException(400, "Email already registered")
    admin = PlatformAdmin(
        full_name=full_name,
        email=email,
        hashed_password=hash_password(password),
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return {"id": admin.id, "email": admin.email, "message": "Platform admin created"}
