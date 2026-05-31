from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/staff/login")
oauth2_scheme_patient = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/patient/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


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
    if user_id is None:
        raise exc
    user = db.query(Staff).filter(Staff.id == int(user_id)).first()
    if not user or not user.is_active:
        raise exc
    return user


def get_current_patient_user(token: str = Depends(oauth2_scheme_patient), db: Session = Depends(get_db)):
    from app.models.models import PatientUser
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    payload = decode_token(token)
    if not payload or payload.get("user_type") != "patient":
        raise exc
    user_id = payload.get("sub")
    if user_id is None:
        raise exc
    user = db.query(PatientUser).filter(PatientUser.id == int(user_id)).first()
    if not user or not user.is_active:
        raise exc
    return user


def get_current_platform_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from app.models.models import PlatformAdmin
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    payload = decode_token(token)
    if not payload or payload.get("user_type") != "platform_admin":
        raise exc
    user_id = payload.get("sub")
    if user_id is None:
        raise exc
    user = db.query(PlatformAdmin).filter(PlatformAdmin.id == int(user_id)).first()
    if not user or not user.is_active:
        raise exc
    return user
