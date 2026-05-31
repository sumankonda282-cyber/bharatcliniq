import random
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import settings
from app.core.security import create_access_token
from app.models.models import PatientUser

router = APIRouter(prefix="/otp", tags=["otp"])

_otp_store: dict = {}

@router.post("/send")
async def send_otp(body: dict, db: Session = Depends(get_db)):
    mobile = str(body.get("mobile", "")).strip()
    if not mobile or len(mobile) != 10 or not mobile.isdigit():
        raise HTTPException(400, "Enter a valid 10-digit mobile number")

    if settings.OTP_MOCK:
        otp = "1234"
    else:
        otp = str(random.randint(100000, 999999))

    _otp_store[mobile] = otp
    print(f"\n==== OTP for {mobile}: {otp} ====\n")

    if not settings.OTP_MOCK and settings.FAST2SMS_API_KEY:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    "https://www.fast2sms.com/dev/bulkV2",
                    headers={"authorization": settings.FAST2SMS_API_KEY},
                    data={"variables_values": otp, "route": "otp", "numbers": mobile},
                    timeout=10.0,
                )
        except Exception as e:
            print(f"SMS failed: {e}")

    return {"message": "OTP sent", "mobile": mobile, "dev_otp": otp if settings.OTP_MOCK else None}

@router.post("/verify")
def verify_otp(body: dict, db: Session = Depends(get_db)):
    mobile = str(body.get("mobile", "")).strip()
    otp = str(body.get("otp", "")).strip()

    print(f"\n==== Verify: mobile={mobile}, otp={otp} ====\n")

    if settings.OTP_MOCK:
        if otp != "1234":
            raise HTTPException(400, "Invalid OTP. Use 1234 in testing mode.")
    else:
        stored = _otp_store.get(mobile)
        if not stored or stored != otp:
            raise HTTPException(400, "Invalid or expired OTP")
        del _otp_store[mobile]

    patient_user = db.query(PatientUser).filter(PatientUser.mobile == mobile).first()
    if not patient_user:
        patient_user = PatientUser(
            full_name=f"Patient ({mobile[-4:]})",
            mobile=mobile,
            is_active=True,
            is_verified=True,
        )
        db.add(patient_user)
        db.commit()
        db.refresh(patient_user)

    token = create_access_token({
        "sub": str(patient_user.id),
        "user_type": "patient",
        "mobile": mobile,
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "is_new_user": False,
    }