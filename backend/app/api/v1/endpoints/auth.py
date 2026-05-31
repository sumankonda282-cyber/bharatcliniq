from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.models import Staff, PatientUser, PlatformAdmin, Clinic
from app.schemas.schemas import StaffLoginRequest, TokenResponse, ChangePasswordRequest
from app.core.security import (
    verify_password, hash_password,
    create_access_token, create_refresh_token,
    get_current_staff, get_current_patient_user
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/staff/login", response_model=TokenResponse)
def staff_login(payload: StaffLoginRequest, db: Session = Depends(get_db)):
    """Login for clinic staff - doctors, receptionists, pharmacists etc."""
    ident = payload.identifier.strip().lower()
    user = (
        db.query(Staff).filter(Staff.email == ident).first()
        or db.query(Staff).filter(Staff.mobile == ident).first()
    )
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your account is pending verification. You will receive an email within 24-48 hours once approved.")

    token_data = {"sub": str(user.id), "role": str(user.role), "user_type": "staff",
                  "clinic_id": user.clinic_id}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user_type="staff",
        user_id=user.id,
        role=str(user.role),
        full_name=user.full_name,
        clinic_id=user.clinic_id,
        branch_id=user.branch_id,
    )


@router.post("/patient/login", response_model=TokenResponse)
def patient_login(payload: StaffLoginRequest, db: Session = Depends(get_db)):
    """Login for patients via email or mobile + password."""
    ident = payload.identifier.strip().lower()
    user = (
        db.query(PatientUser).filter(PatientUser.email == ident).first()
        or db.query(PatientUser).filter(PatientUser.mobile == ident).first()
    )
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is suspended")

    token_data = {"sub": str(user.id), "user_type": "patient"}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user_type="patient",
        user_id=user.id,
        full_name=user.full_name,
    )


@router.post("/platform/login", response_model=TokenResponse)
def platform_admin_login(payload: StaffLoginRequest, db: Session = Depends(get_db)):
    """Login for BharatHealth platform superadmins."""
    admin = db.query(PlatformAdmin).filter(
        PlatformAdmin.email == payload.identifier.lower()
    ).first()
    if not admin or not verify_password(payload.password, admin.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token_data = {"sub": str(admin.id), "user_type": "platform_admin"}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user_type="platform_admin",
        user_id=admin.id,
        full_name=admin.full_name,
    )


@router.get("/staff/me")
def staff_me(current=Depends(get_current_staff), db: Session = Depends(get_db)):
    clinic = db.query(Clinic).filter(Clinic.id == current.clinic_id).first()
    return {
        "id":          current.id,
        "full_name":   current.full_name,
        "email":       current.email,
        "mobile":      current.mobile,
        "role":        current.role if isinstance(current.role, str) else str(current.role),
        "clinic_id":   current.clinic_id,
        "branch_id":   current.branch_id,
        "clinic_name": clinic.name if clinic else None,
        "clinic_verified": clinic.is_verified if clinic else False,
        "clinic_plan": str(clinic.subscription_plan) if clinic else "free",
    }


@router.get("/patient/me")
def patient_me(current=Depends(get_current_patient_user)):
    return {
        "id": current.id,
        "full_name": current.full_name,
        "email": current.email,
        "mobile": current.mobile,
        "preferred_language": current.preferred_language,
    }


@router.post("/staff/change-password")
def change_staff_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current=Depends(get_current_staff)
):
    if not verify_password(payload.current_password, current.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully"}
