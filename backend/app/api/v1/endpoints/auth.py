from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
import random, string, secrets
from datetime import datetime, timedelta
from app.db.session import get_db
from app.models.models import Staff, PatientUser, PlatformAdmin, Clinic, BHProfile, BHStateGroup, BHIDSequence
from app.schemas.schemas import StaffLoginRequest, TokenResponse, ChangePasswordRequest
from app.core.security import (
    verify_password, hash_password,
    create_access_token, create_refresh_token,
    get_current_staff, get_current_patient_user,
    get_current_platform_admin
)
from app.core.limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])


# ── BH ID state-digit lookup ─────────────────────────────────────────────────
_STATE_DIGIT_MAP: dict[str, int] = {}

def _get_state_digit(state: str, db: Session) -> int:
    """Return digit (0-9) for a given state name. Lazy-loads from DB."""
    global _STATE_DIGIT_MAP
    if not _STATE_DIGIT_MAP:
        groups = db.query(BHStateGroup).all()
        for g in groups:
            for s in (g.states or []):
                _STATE_DIGIT_MAP[s.lower()] = g.digit
    return _STATE_DIGIT_MAP.get(state.strip().lower(), 9)  # default digit 9


def _next_bh_seq(digit: int, db: Session) -> int:
    """Atomically increment and return next sequence for the given state digit."""
    row = db.query(BHIDSequence).filter(BHIDSequence.digit == digit).with_for_update().first()
    if not row:
        row = BHIDSequence(digit=digit, next_seq=2)
        db.add(row)
        db.flush()
        return 1
    seq = row.next_seq
    row.next_seq = seq + 1
    db.flush()
    return seq


def _make_bh_id(digit: int, seq: int) -> str:
    return f"BH{digit}{str(seq).zfill(8)}"


def _generate_otp() -> str:
    return ''.join(random.choices(string.digits, k=6))


@router.post("/staff/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def staff_login(request: Request, payload: StaffLoginRequest, db: Session = Depends(get_db)):
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
                  "clinic_id": user.clinic_id, "token_version": user.token_version or 1}
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
@limiter.limit("5/minute")
def patient_login(request: Request, payload: StaffLoginRequest, db: Session = Depends(get_db)):
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

    token_data = {"sub": str(user.id), "user_type": "patient", "token_version": user.token_version or 1}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user_type="patient",
        user_id=user.id,
        full_name=user.full_name,
    )


@router.post("/platform/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def platform_admin_login(request: Request, payload: StaffLoginRequest, db: Session = Depends(get_db)):
    """Login for BharatHealth platform superadmins."""
    admin = db.query(PlatformAdmin).filter(
        PlatformAdmin.email == payload.identifier.lower()
    ).first()
    if not admin or not verify_password(payload.password, admin.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token_data = {"sub": str(admin.id), "user_type": "platform_admin", "token_version": admin.token_version or 1}
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


class PatientRegisterRequest(BaseModel):
    full_name: str
    mobile: str
    password: str
    email: Optional[str] = None


@router.post("/patient/register", response_model=TokenResponse)
def patient_register(payload: PatientRegisterRequest, db: Session = Depends(get_db)):
    """Self-service patient registration for the patient portal."""
    if db.query(PatientUser).filter(PatientUser.mobile == payload.mobile).first():
        raise HTTPException(status_code=400, detail="An account with this mobile already exists. Please login.")
    if payload.email and db.query(PatientUser).filter(PatientUser.email == payload.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user = PatientUser(
        full_name=payload.full_name,
        mobile=payload.mobile,
        email=payload.email or None,
        hashed_password=hash_password(payload.password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token_data = {"sub": str(user.id), "user_type": "patient"}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user_type="patient",
        user_id=user.id,
        full_name=user.full_name,
    )


# ── Patient OTP auth ─────────────────────────────────────────────────────────

class OTPSendRequest(BaseModel):
    mobile: str

class OTPVerifyRequest(BaseModel):
    mobile: str
    otp: str

class OTPLookupRequest(BaseModel):
    identifier: str   # email address or BH ID
    type: str         # "email" | "bh_id"

class ProfileSelectRequest(BaseModel):
    verified_token: str
    bh_profile_id: int

class ProfileCreateRequest(BaseModel):
    verified_token: str
    first_name: str
    last_name: str
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None  # "YYYY-MM-DD"
    state: Optional[str] = None


@router.post("/patient/lookup")
def patient_lookup(payload: OTPLookupRequest, db: Session = Depends(get_db)):
    """Lookup patient by email or BH ID → send OTP to their registered mobile."""
    identifier = payload.identifier.strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Please enter a valid email or BH ID.")

    user = None
    if payload.type == "email":
        user = db.query(PatientUser).filter(
            PatientUser.email == identifier.lower()
        ).first()
    elif payload.type == "bh_id":
        profile = db.query(BHProfile).filter(
            BHProfile.bh_id == identifier.upper(), BHProfile.is_active == True
        ).first()
        if profile:
            user = db.query(PatientUser).filter(PatientUser.id == profile.patient_user_id).first()
    else:
        raise HTTPException(status_code=400, detail="Invalid lookup type.")

    if not user or not user.mobile:
        raise HTTPException(status_code=404, detail="No account found. Check your entry or sign in with mobile number.")

    otp = _generate_otp()
    user.otp_code   = otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    m = user.mobile
    masked = f"+91 {m[:2]}***{m[-4:]}" if len(m) == 10 else f"***{m[-4:]}"
    return {"masked_mobile": masked, "mobile": user.mobile, "dev_otp": otp}


@router.post("/patient/send-otp")
def patient_send_otp(payload: OTPSendRequest, db: Session = Depends(get_db)):
    """Step 1: Send OTP to mobile. Creates PatientUser row if it doesn't exist."""
    mobile = payload.mobile.strip()
    if not mobile or len(mobile) < 10:
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit mobile number.")

    user = db.query(PatientUser).filter(PatientUser.mobile == mobile).first()
    if not user:
        user = PatientUser(mobile=mobile, is_active=True, full_name="")
        db.add(user)
        db.flush()

    otp = _generate_otp()
    user.otp_code   = otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    # In production: integrate SMS gateway (e.g. MSG91, Twilio) here.
    # For development: return OTP in response.
    return {"message": "OTP sent successfully.", "dev_otp": otp}


@router.post("/patient/verify-otp")
def patient_verify_otp(payload: OTPVerifyRequest, db: Session = Depends(get_db)):
    """Step 2: Verify OTP. Returns list of profiles + a short-lived verified_token."""
    mobile = payload.mobile.strip()
    user = db.query(PatientUser).filter(PatientUser.mobile == mobile).first()
    if not user:
        raise HTTPException(status_code=400, detail="Mobile not found. Please send OTP first.")
    if not user.otp_code or not user.otp_expiry:
        raise HTTPException(status_code=400, detail="No OTP pending. Please request a new OTP.")
    if datetime.utcnow() > user.otp_expiry:
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    if payload.otp.strip() != user.otp_code:
        raise HTTPException(status_code=400, detail="Incorrect OTP. Please try again.")

    user.otp_code = None
    user.otp_expiry = None
    user.is_verified = True

    verified_token = secrets.token_urlsafe(32)
    user.otp_verified_token = verified_token
    user.otp_token_expiry = datetime.utcnow() + timedelta(minutes=15)
    db.commit()

    profiles = db.query(BHProfile).filter(
        BHProfile.patient_user_id == user.id, BHProfile.is_active == True
    ).all()

    return {
        "verified_token": verified_token,
        "profiles": [
            {
                "id": p.id,
                "bh_id": p.bh_id,
                "full_name": f"{p.first_name} {p.last_name}",
                "gender": p.gender,
                "date_of_birth": str(p.date_of_birth) if p.date_of_birth else None,
            }
            for p in profiles
        ],
        "can_add_profile": len(profiles) < 5,
    }


def _resolve_verified_token(token: str, db: Session) -> PatientUser:
    user = db.query(PatientUser).filter(PatientUser.otp_verified_token == token).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please re-verify OTP.")
    if not user.otp_token_expiry or datetime.utcnow() > user.otp_token_expiry:
        raise HTTPException(status_code=401, detail="Session expired. Please re-verify OTP.")
    return user


@router.post("/patient/select-profile")
def patient_select_profile(payload: ProfileSelectRequest, db: Session = Depends(get_db)):
    """Step 3a: Select existing BH profile → issue final JWT."""
    user = _resolve_verified_token(payload.verified_token, db)
    profile = db.query(BHProfile).filter(
        BHProfile.id == payload.bh_profile_id,
        BHProfile.patient_user_id == user.id,
        BHProfile.is_active == True,
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    user.otp_verified_token = None
    user.otp_token_expiry   = None
    db.commit()

    token_data = {"sub": str(user.id), "user_type": "patient", "bh_profile_id": profile.id}
    return {
        "access_token": create_access_token(token_data),
        "token_type": "bearer",
        "user_type": "patient",
        "user_id": user.id,
        "bh_profile_id": profile.id,
        "bh_id": profile.bh_id,
        "full_name": f"{profile.first_name} {profile.last_name}",
    }


@router.post("/patient/create-profile")
def patient_create_profile(payload: ProfileCreateRequest, db: Session = Depends(get_db)):
    """Step 3b: Create new BH profile for this phone → assign BH ID → issue final JWT."""
    user = _resolve_verified_token(payload.verified_token, db)

    existing = db.query(BHProfile).filter(
        BHProfile.patient_user_id == user.id, BHProfile.is_active == True
    ).count()
    if existing >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 profiles allowed per mobile number.")

    state = (payload.state or "").strip()
    digit = _get_state_digit(state, db) if state else 9

    seq    = _next_bh_seq(digit, db)
    bh_id  = _make_bh_id(digit, seq)

    from datetime import date as date_type
    dob = None
    if payload.date_of_birth:
        try:
            dob = date_type.fromisoformat(payload.date_of_birth)
        except ValueError:
            pass

    profile = BHProfile(
        patient_user_id=user.id,
        bh_id=bh_id,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        gender=payload.gender,
        date_of_birth=dob,
        state=state,
        state_digit=digit,
    )
    db.add(profile)

    if not user.full_name:
        user.full_name = f"{payload.first_name.strip()} {payload.last_name.strip()}"

    user.otp_verified_token = None
    user.otp_token_expiry   = None
    db.commit()
    db.refresh(profile)

    token_data = {"sub": str(user.id), "user_type": "patient", "bh_profile_id": profile.id}
    return {
        "access_token": create_access_token(token_data),
        "token_type": "bearer",
        "user_type": "patient",
        "user_id": user.id,
        "bh_profile_id": profile.id,
        "bh_id": profile.bh_id,
        "full_name": f"{profile.first_name} {profile.last_name}",
    }


@router.get("/patient/me")
def patient_me_v2(current=Depends(get_current_patient_user), db: Session = Depends(get_db)):
    """Returns active patient user info. bh_profile_id injected from JWT if present."""
    return {
        "id": current.id,
        "full_name": current.full_name,
        "email": current.email,
        "mobile": current.mobile,
        "preferred_language": current.preferred_language,
    }


@router.get("/platform/me")
def platform_admin_me(admin=Depends(get_current_platform_admin)):
    return {"id": admin.id, "full_name": admin.full_name, "email": admin.email, "user_type": "platform_admin"}


@router.get("/bh/{bh_id}")
def lookup_bh_id(bh_id: str, db: Session = Depends(get_db)):
    """Public lookup: given a BH ID, return basic info (name, state digit). Used for patient verification."""
    profile = db.query(BHProfile).filter(
        BHProfile.bh_id == bh_id.upper(), BHProfile.is_active == True
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="BH ID not found.")
    return {
        "bh_id":     profile.bh_id,
        "full_name": f"{profile.first_name} {profile.last_name}",
        "gender":    profile.gender,
        "state":     profile.state,
    }


class AdminPhoneChangeRequest(BaseModel):
    bh_id: str
    new_mobile: str
    reason: str


@router.post("/admin/patient/change-phone")
def admin_change_patient_phone(
    payload: AdminPhoneChangeRequest,
    db: Session = Depends(get_db),
    admin=Depends(get_current_platform_admin),
):
    """Platform admin endpoint: change the mobile number linked to a BH ID (lost phone workflow)."""
    profile = db.query(BHProfile).filter(
        BHProfile.bh_id == payload.bh_id.upper(), BHProfile.is_active == True
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="BH ID not found.")

    old_user = db.query(PatientUser).filter(PatientUser.id == profile.patient_user_id).first()
    if not old_user:
        raise HTTPException(status_code=404, detail="Patient account not found.")

    new_mobile = payload.new_mobile.strip()

    other_profiles = db.query(BHProfile).filter(
        BHProfile.patient_user_id == old_user.id,
        BHProfile.id != profile.id,
        BHProfile.is_active == True,
    ).count()

    if other_profiles > 0:
        new_user = PatientUser(mobile=new_mobile, is_active=True, full_name=f"{profile.first_name} {profile.last_name}")
        db.add(new_user)
        db.flush()
        profile.patient_user_id = new_user.id
    else:
        old_user.mobile = new_mobile

    db.commit()
    return {"message": f"Mobile updated for BH ID {payload.bh_id}.", "bh_id": payload.bh_id}


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
