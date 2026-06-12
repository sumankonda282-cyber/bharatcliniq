from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24h

    OTP_MOCK: bool = True
    FAST2SMS_API_KEY: str = ""

    CORS_ORIGINS: str = (
        "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175,"
        "https://bharatcliniq.com,https://www.bharatcliniq.com,"
        "https://provider.bharathhealthsystems.com,https://my.bharatcliniq.com,"
        "https://lab.bharatcliniq.com,https://pharmacy.bharatcliniq.com,"
        "https://receptionist.bharatcliniq.com,https://staff.bharatcliniq.com,"
        "https://admin.bharatcliniq.com,https://doctor.bharatcliniq.com,"
        "https://imaging.bharatcliniq.com,"
        "https://bharatcliniq-public.vercel.app,https://bharatcliniq-provider.vercel.app,"
        "https://bharatcliniq-patient.vercel.app,https://bharatcliniq-lab.vercel.app,"
        "https://bharatcliniq-imaging.vercel.app,https://bharatcliniq-pharmacy.vercel.app,"
        "https://bharatcliniq-receptionist.vercel.app,https://bharatcliniq-admin.vercel.app,"
        "https://bharatcliniq-staff.vercel.app,"
        "https://bharathhealthsystems.com,https://www.bharathhealthsystems.com,"
        "https://staff.bharathhealthsystems.com,https://provider.bharathhealthsystems.com,"
        "https://my.bharathhealthsystems.com,https://admin.bharathhealthsystems.com,"
        "https://lab.bharathhealthsystems.com,https://pharmacy.bharathhealthsystems.com,"
        "https://imaging.bharathhealthsystems.com"
    )

    DEBUG: bool = False
    FREE_PLAN_MAX_DOCTORS: int = 2
    FREE_PLAN_MAX_BRANCHES: int = 1
    UPLOAD_DIR: str = "uploads"
    APP_NAME: str = "BHarath Health"
    APP_VERSION: str = "2.0.0"

    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    DAILY_API_KEY: str = ""
    DAILY_DOMAIN: str = "bharatcliniq.daily.co"

    @property
    def cors_origins_list(self) -> List[str]:
        defaults = [
            "https://bharatcliniq.com",
            "https://www.bharatcliniq.com",
            "https://bharatcliniq-provider.vercel.app",
            "https://bharatcliniq-patient.vercel.app",
            "https://bharatcliniq-admin.vercel.app",
            "https://bharatcliniq-public.vercel.app",
            "https://bharatcliniq-pharmacy.vercel.app",
            "https://bharatcliniq-lab.vercel.app",
            "https://bharatcliniq-receptionist.vercel.app",
            "https://bharatcliniq-imaging.vercel.app",
            "https://bharathhealthsystems.com",
            "https://www.bharathhealthsystems.com",
            "https://staff.bharathhealthsystems.com",
            "https://provider.bharathhealthsystems.com",
            "https://my.bharathhealthsystems.com",
            "https://admin.bharathhealthsystems.com",
            "https://lab.bharathhealthsystems.com",
            "https://pharmacy.bharathhealthsystems.com",
            "https://imaging.bharathhealthsystems.com",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://localhost:5176",
            "http://localhost:5177",
            "http://localhost:5178",
            "http://localhost:5179",
        ]
        if self.CORS_ORIGINS:
            extras = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
            return list(set(defaults + extras))
        return defaults

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
