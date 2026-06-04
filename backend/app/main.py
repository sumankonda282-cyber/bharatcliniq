from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.api.v1.endpoints.auth             import router as auth_router
from app.api.v1.endpoints.otp              import router as otp_router
from app.api.v1.endpoints.public           import router as public_router
from app.api.v1.endpoints.platform_admin   import router as platform_router
from app.api.v1.endpoints.clinic_admin     import router as clinic_router
from app.api.v1.endpoints.patients         import router as patients_router
from app.api.v1.endpoints.appointments     import router as appointments_router
from app.api.v1.endpoints.doctor           import router as doctor_router
from app.api.v1.endpoints.pharmacy_lab_billing import (
    pharmacy_router, lab_router, billing_router, imaging_router
)
from app.api.v1.endpoints.portal           import router as portal_router
from app.api.v1.endpoints.pdf_routes       import router as pdf_router
from app.api.v1.endpoints.referrals        import router as referrals_router
from app.api.v1.endpoints.encounters       import router as encounters_router

app = FastAPI(
    title="BharatCliniq API v2",
    description="India's clinic management and patient booking platform",
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"

app.include_router(auth_router,         prefix=PREFIX)
app.include_router(otp_router,          prefix=PREFIX)
app.include_router(public_router,       prefix=PREFIX)
app.include_router(platform_router,     prefix=PREFIX)
app.include_router(clinic_router,       prefix=PREFIX)
app.include_router(patients_router,     prefix=PREFIX)
app.include_router(appointments_router, prefix=PREFIX)
app.include_router(doctor_router,       prefix=PREFIX)
app.include_router(pharmacy_router,     prefix=PREFIX)
app.include_router(lab_router,          prefix=PREFIX)
app.include_router(billing_router,      prefix=PREFIX)
app.include_router(imaging_router,      prefix=PREFIX)
app.include_router(portal_router,       prefix=PREFIX)
app.include_router(pdf_router,          prefix=PREFIX)
app.include_router(referrals_router,    prefix=PREFIX)
app.include_router(encounters_router,   prefix=PREFIX)

uploads_dir = settings.UPLOAD_DIR
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.get("/")
def root():
    return {"status": "ok", "app": "BharatCliniq API", "version": settings.APP_VERSION}


@app.get("/health")
def health():
    return {"status": "healthy"}
