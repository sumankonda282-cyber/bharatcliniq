# BharatCliniq v2 — Setup Guide

## Project Structure

```
bharatcliniq-v2/
├── backend/                  FastAPI API server
│   ├── app/
│   │   ├── main.py           Entry point
│   │   ├── models/models.py  All 23 SQLAlchemy tables
│   │   ├── schemas/schemas.py Pydantic schemas
│   │   ├── core/             Config + JWT security
│   │   ├── db/               SQLAlchemy session
│   │   └── api/v1/endpoints/ All route handlers
│   ├── alembic/              Database migrations
│   ├── requirements.txt
│   └── .env.example          → copy to .env
│
├── frontend/
│   ├── provider/             Provider Portal (port 5173) — clinic staff
│   ├── public/               Public Website (port 5174) — patients & owners
│   └── patient/              Patient Portal (port 5175) — patient self-service
│
└── SETUP.md                  This file
```

---

## Step 1: Backend Setup

### Prerequisites
- Python 3.11+
- PostgreSQL database (Supabase recommended)

### Install & Configure

```powershell
cd C:\BMH\bharatcliniq-v2\backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
Copy-Item .env.example .env
# Edit .env and set:
#   DATABASE_URL=postgresql://...
#   SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
```

### Database Migration (Supabase)

```powershell
# Run Alembic migration to create all 23 tables
alembic upgrade head
```

**Important:** If your Supabase DB already has tables from the old schema,
run this first to drop them, then run the migration.

### Create Platform Admin (first time)

```python
# Run from backend directory with venv activated
python -c "
from app.db.session import SessionLocal
from app.models.models import PlatformAdmin
from app.core.security import hash_password

db = SessionLocal()
admin = PlatformAdmin(
    full_name='BharatCliniq Admin',
    email='admin@bharatcliniq.com',
    hashed_password=hash_password('Admin@123'),
)
db.add(admin)
db.commit()
print('Platform admin created!')
"
```

### Start Backend

```powershell
# Development
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production (Render.com)
# Start command: gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
```

API docs available at: http://localhost:8000/api/docs

---

## Step 2: Frontend Setup

All three frontends use Node.js + Vite.

### Prerequisites
- Node.js 18+
- npm or yarn

### Provider Portal (Clinic Staff)

```powershell
cd C:\BMH\bharatcliniq-v2\frontend\provider

# Install dependencies
npm install

# Configure
Copy-Item .env.example .env
# Edit .env: VITE_API_URL=http://localhost:8000

# Start dev server (port 5173)
npm run dev
```

**Access at:** http://localhost:5173

### Public Website

```powershell
cd C:\BMH\bharatcliniq-v2\frontend\public
npm install
Copy-Item .env.example .env
npm run dev  # port 5174
```

**Access at:** http://localhost:5174

### Patient Portal

```powershell
cd C:\BMH\bharatcliniq-v2\frontend\patient
npm install
Copy-Item .env.example .env
npm run dev  # port 5175
```

**Access at:** http://localhost:5175

---

## Step 3: First Login Flow

1. **Register a clinic** at http://localhost:5174/register
2. **Approve the clinic** at http://localhost:5173 (login as platform admin → Platform tab)
3. **Clinic staff login** at http://localhost:5173 with the registered email/password

---

## User Roles & Access

| Role            | Portal         | Access |
|----------------|----------------|--------|
| `platform_admin` | Provider Portal | Platform tab — approve clinics, manage subscriptions |
| `clinic_admin`   | Provider Portal | Everything in their clinic |
| `doctor`         | Provider Portal | Doctor Desk, Queue, Prescriptions, Lab Orders |
| `receptionist`   | Provider Portal | Appointments, Patients, Billing |
| `pharmacist`     | Provider Portal | Pharmacy module |
| `lab_tech`       | Provider Portal | Lab module |
| `imaging_tech`   | Provider Portal | Imaging module |
| Patient          | Patient Portal  | Own health records |

---

## Deployment (Render.com + Vercel)

### Backend → Render.com
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`
- **Environment vars:** Set all vars from `.env.example`

### Frontends → Vercel
Each frontend is a separate Vercel project:
- **Framework:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment:** `VITE_API_URL=https://your-api.onrender.com`

### Domains
- `bharatcliniq.com` → Public Website
- `provider.bharatcliniq.com` → Provider Portal
- `my.bharatcliniq.com` → Patient Portal

---

## What Was Fixed in v2

### Backend Bug Fixes
1. ✅ **CRASH FIX:** `platform_admin.py:133` — `plan:,` syntax error (missing type annotation)
2. ✅ **Auth fix:** JWT `sub` stored as string, now correctly cast to `int` before DB query
3. ✅ **Enum removal:** `mode`, `gender`, `status` fields changed from Enum to String (simpler, no migration pain)
4. ✅ **clinic_admin.py:** Fixed 3 indentation/syntax errors, `mode=.online` → `mode='online'`
5. ✅ **doctor.py:** Removed all `.value` calls on non-Enum string fields
6. ✅ **doctor.py:** Fixed `specialization` → `specialty`, `registration_number` → `mci_number`
7. ✅ **Role check:** `'super_admin'` role replaced with `'clinic_admin'` (correct role name)

### Model Fixes
8. ✅ **Added:** `Appointment.token_number` column (was referenced in code but missing)
9. ✅ **Added:** `DoctorProfile.languages` column (was referenced in public.py)
10. ✅ **Added:** `PrescriptionItem.medicine_name` text column (free-text medicine entry)
11. ✅ **Added:** `LabOrderItem.test_name` text column
12. ✅ **Added:** `ImagingOrder` model (was in API but missing from models)
13. ✅ **Fixed:** `DoctorSchedule.day_of_week` → String (was Integer, but code used strings like "monday")
14. ✅ **Fixed:** `DoctorSchedule.start_time/end_time` → String "HH:MM" (simpler than Time type)
15. ✅ **Added:** `OnlineBooking.doctor` relationship
16. ✅ **Added:** `Branch.email` and `Branch.state` columns

### Frontend (New — Built from Scratch)
- ✅ Provider Portal: 12 modules, all pages functional
- ✅ Public Website: Landing, Clinic Finder, Booking, Registration
- ✅ Patient Portal: BHID Card, Appointments, Prescriptions, Lab Results, Bills
