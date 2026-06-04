from datetime import datetime, timedelta
from typing import Optional, List
from jose import JWTError, jwt
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db

_pwd_hasher = PasswordHash((BcryptHasher(),))


def hash_password(password: str) -> str:
    return _pwd_hasher.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_hasher.verify(plain, hashed)


oauth2_scheme         = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/staff/login")
oauth2_scheme_patient = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/patient/login")

# ── Role definitions ───────────────────────────────────────────────────────────

CLINICAL_ROLES      = {'doctor', 'nurse', 'pathologist', 'radiologist'}
LAB_ROLES           = {'doctor', 'nurse', 'pathologist', 'lab_technician', 'lab_tech'}
IMAGING_ROLES       = {'doctor', 'nurse', 'radiologist', 'imaging_tech'}
PHARMACY_ROLES      = {'doctor', 'nurse', 'pharmacist'}
SIGN_LAB_ROLES      = {'pathologist', 'doctor'}       # who can sign lab reports
SIGN_IMAGING_ROLES  = {'radiologist', 'doctor'}       # who can sign imaging reports
ADMIN_ROLES         = {'clinic_admin', 'clinic_manager'}
ALL_STAFF_ROLES     = CLINICAL_ROLES | LAB_ROLES | IMAGING_ROLES | PHARMACY_ROLES | ADMIN_ROLES

# Roles that must NEVER see clinical data
NON_CLINICAL_ROLES  = {'receptionist', 'clinic_manager', 'clinic_admin'}


def _role(user) -> str:
    return str(user.role) if user.role else ''


def _require_roles(user, allowed: set, detail: str = 'Access denied'):
    if _role(user) not in allowed:
        raise HTTPException(status_code=403, detail=detail)
    return user


# ── Convenience role guards (use as FastAPI Depends) ──────────────────────────

def get_current_staff(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from app.models.models import Staff
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if not payload or payload.get("user_type") != "staff":
        raise exc
    user_id = payload.get("sub")
    if not user_id:
        raise exc
    user = db.query(Staff).filter(Staff.id == int(user_id)).first()
    if not user or not user.is_active:
        raise exc
    return user


def require_clinical(current=Depends(get_current_staff)):
    """Doctor, nurse, pathologist, radiologist."""
    return _require_roles(current, CLINICAL_ROLES | {'pathologist', 'radiologist', 'lab_technician', 'lab_tech', 'imaging_tech'},
                          'Clinical data access denied. Your role does not permit viewing patient records.')


def require_doctor(current=Depends(get_current_staff)):
    """Doctor only — encounters, prescriptions, ordering tests."""
    return _require_roles(current, {'doctor'},
                          'This action requires doctor access.')


def require_doctor_or_nurse(current=Depends(get_current_staff)):
    return _require_roles(current, {'doctor', 'nurse'},
                          'Doctor or nurse access required.')


def require_lab_access(current=Depends(get_current_staff)):
    """Roles that can view/manage lab orders and results."""
    return _require_roles(current, LAB_ROLES | {'lab_technician', 'lab_tech'},
                          'Lab access denied.')


def require_lab_sign(current=Depends(get_current_staff)):
    """Only pathologist or doctor can sign lab reports."""
    return _require_roles(current, SIGN_LAB_ROLES,
                          'Only a pathologist or doctor can sign lab reports.')


def require_imaging_access(current=Depends(get_current_staff)):
    return _require_roles(current, IMAGING_ROLES | {'imaging_tech'},
                          'Imaging access denied.')


def require_imaging_sign(current=Depends(get_current_staff)):
    return _require_roles(current, SIGN_IMAGING_ROLES,
                          'Only a radiologist or doctor can sign imaging reports.')


def require_pharmacy(current=Depends(get_current_staff)):
    return _require_roles(current, PHARMACY_ROLES,
                          'Pharmacy access denied.')


def require_admin(current=Depends(get_current_staff)):
    """Clinic admin only — staff management, settings."""
    return _require_roles(current, {'clinic_admin'},
                          'Clinic admin access required.')


def require_admin_or_manager(current=Depends(get_current_staff)):
    return _require_roles(current, ADMIN_ROLES,
                          'Admin or manager access required.')


def require_billing_view(current=Depends(get_current_staff)):
    """Everyone except lab/imaging/pharmacy techs can view billing."""
    return _require_roles(current, {'clinic_admin', 'clinic_manager', 'doctor', 'receptionist'},
                          'Billing access denied.')


def require_billing_waive(current=Depends(get_current_staff)):
    """Only doctor or manager can apply waivers/discounts."""
    return _require_roles(current, {'doctor', 'clinic_admin', 'clinic_manager'},
                          'Only doctors or managers can apply fee waivers.')


def require_any_staff(current=Depends(get_current_staff)):
    """Any authenticated staff member."""
    return current


# ── Token helpers ──────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict):
    return create_access_token(data, expires_delta=timedelta(days=7))


def decode_token(token: str):
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def get_current_patient_user(token: str = Depends(oauth2_scheme_patient), db: Session = Depends(get_db)):
    from app.models.models import PatientUser
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    payload = decode_token(token)
    if not payload or payload.get("user_type") != "patient":
        raise exc
    user_id = payload.get("sub")
    if not user_id:
        raise exc
    user = db.query(PatientUser).filter(PatientUser.id == int(user_id)).first()
    if not user or not user.is_active:
        raise exc
    return user


def get_current_platform_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from app.models.models import PlatformAdmin
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    payload = decode_token(token)
    if not payload or payload.get("user_type") != "platform_admin":
        raise exc
    user_id = payload.get("sub")
    if not user_id:
        raise exc
    user = db.query(PlatformAdmin).filter(PlatformAdmin.id == int(user_id)).first()
    if not user or not user.is_active:
        raise exc
    return user

