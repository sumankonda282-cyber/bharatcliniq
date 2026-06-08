from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.types import ASGIApp, Scope, Receive, Send
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
import os

from app.core.config import settings
from app.core.limiter import limiter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.otp import router as otp_router
from app.api.v1.endpoints.public import router as public_router
from app.api.v1.endpoints.platform_admin import router as platform_router
from app.api.v1.endpoints.clinic_admin import router as clinic_router
from app.api.v1.endpoints.patients import router as patients_router
from app.api.v1.endpoints.appointments import router as appointments_router
from app.api.v1.endpoints.doctor import router as doctor_router
from app.api.v1.endpoints.pharmacy_lab_billing import (
    pharmacy_router, lab_router, billing_router, imaging_router
)
from app.api.v1.endpoints.portal import router as portal_router
from app.api.v1.endpoints.pdf_routes import router as pdf_router
from app.api.v1.endpoints.referrals import router as referrals_router
from app.api.v1.endpoints.encounters import router as encounters_router
from app.api.v1.endpoints.bridge import router as bridge_router
from app.api.v1.endpoints.lab_orders import router as lab_orders_router
from app.api.v1.endpoints.imaging_orders import router as imaging_orders_router
from app.api.v1.endpoints.chat import router as chat_router
from app.api.v1.endpoints.inpatient import router as inpatient_router

app = FastAPI(
    title="BharatCliniq API v2",
    description="India's clinic management and patient booking platform",
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# -----------------------------
# Path Normalizer (pure ASGI — must wrap the entire app)
# Render's proxy can introduce // at the start of paths, causing 404s.
# -----------------------------
class PathNormalizeMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path.startswith("//"):
                scope = dict(scope)
                scope["path"] = "/" + path.lstrip("/")
                raw = scope.get("raw_path", b"")
                if isinstance(raw, bytes) and raw.startswith(b"//"):
                    scope["raw_path"] = b"/" + raw.lstrip(b"/")
        await self.app(scope, receive, send)

# -----------------------------
# CORS — explicit origins + regex covers all Vercel preview URLs
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://bharatcliniq-[a-z0-9-]+-sumankonda282-cybers-projects\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Security Headers Middleware
# -----------------------------
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# -----------------------------
# Routers
# -----------------------------
PREFIX = "/api/v1"

app.include_router(auth_router, prefix=PREFIX)
app.include_router(otp_router, prefix=PREFIX)
app.include_router(public_router, prefix=PREFIX)
app.include_router(platform_router, prefix=PREFIX)
app.include_router(clinic_router, prefix=PREFIX)
app.include_router(patients_router, prefix=PREFIX)
app.include_router(appointments_router, prefix=PREFIX)
app.include_router(doctor_router, prefix=PREFIX)
app.include_router(pharmacy_router, prefix=PREFIX)
app.include_router(lab_router, prefix=PREFIX)
app.include_router(billing_router, prefix=PREFIX)
app.include_router(imaging_router, prefix=PREFIX)
app.include_router(portal_router, prefix=PREFIX)
app.include_router(pdf_router, prefix=PREFIX)
app.include_router(referrals_router, prefix=PREFIX)
app.include_router(encounters_router, prefix=PREFIX)
app.include_router(bridge_router, prefix=PREFIX)
app.include_router(lab_orders_router, prefix=PREFIX)
app.include_router(imaging_orders_router, prefix=PREFIX)
app.include_router(chat_router, prefix=PREFIX)
app.include_router(inpatient_router, prefix=PREFIX)

# -----------------------------
# Static Uploads
# -----------------------------
uploads_dir = settings.UPLOAD_DIR
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# -----------------------------
# Health + Root
# -----------------------------
@app.get("/")
def root():
    return {"status": "ok", "app": "BharatCliniq API", "version": settings.APP_VERSION}

@app.get("/health")
def health():
    return {"status": "healthy"}

# Wrap the entire app so path normalization runs before everything else
app = PathNormalizeMiddleware(app)
