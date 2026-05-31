# BharatCliniq SaaS — Windows Setup Guide

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Python | 3.10+ | https://python.org |
| Node.js | 18+ | https://nodejs.org |
| MySQL | 8.0+ | https://dev.mysql.com/downloads/ |
| Git | Any | https://git-scm.com |

---

## Step 1 — Create MySQL Database

Open MySQL command prompt or Workbench and run:

```sql
CREATE DATABASE bharatcliniq_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## Step 2 — Setup Backend

Open a terminal in the `bharatcliniq` folder:

```cmd
cd backend

:: Create virtual environment
python -m venv venv
venv\Scripts\activate

:: Install dependencies
pip install -r requirements.txt

:: Copy and configure environment
copy .env.example .env
```

Now edit `backend\.env` and set your MySQL password:
```
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/bharatcliniq_db
```

```cmd
:: Run database migrations
alembic upgrade head

:: Seed demo data
python seed.py
```

You should see: `✅ Seed completed successfully!`

---

## Step 3 — Setup Frontend Apps

Run these in separate terminals (or use the start script):

```cmd
:: Terminal 1 — Public website
cd frontend\website
npm install

:: Terminal 2 — Clinic staff app
cd frontend\clinic-app
npm install

:: Terminal 3 — Patient portal
cd frontend\patient-portal
npm install
```

---

## Step 4 — Start Everything

### Option A: One-click start (recommended)
```cmd
:: From the bharatcliniq root folder
scripts\start-all.bat
```

### Option B: Manual start (4 terminals)

**Terminal 1 — Backend:**
```cmd
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Website:**
```cmd
cd frontend\website
npm run dev
```

**Terminal 3 — Clinic App:**
```cmd
cd frontend\clinic-app
npm run dev
```

**Terminal 4 — Patient Portal:**
```cmd
cd frontend\patient-portal
npm run dev
```

---

## URLs

| Service | URL |
|---------|-----|
| API (FastAPI) | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Public Website | http://localhost:3000 |
| Clinic Staff App | http://localhost:3001 |
| Patient Portal | http://localhost:3002 |

---

## Demo Login Credentials

### Clinic Staff App (localhost:3001)

| Role | Email | Password |
|------|-------|----------|
| Platform Admin | superadmin@bharatcliniq.com | SuperAdmin@123 |
| Clinic Admin | admin@apollodemo.com | Admin@123 |
| Doctor (Dr. Priya) | drpriya@apollodemo.com | Doctor@123 |
| Doctor (Dr. Rajan) | drrajan@apollodemo.com | Doctor@123 |
| Receptionist | ravi@apollodemo.com | Reception@123 |
| Pharmacist | meera@apollodemo.com | Pharmacy@123 |
| Lab Technician | arjun@apollodemo.com | Lab@123 |

### Patient Portal (localhost:3002)

Login with OTP:
- Mobile: `9111111111` or `9222222222`
- OTP will print in the **backend terminal** (dev mode)

---

## Demo Clinic

- **Clinic name:** Apollo Demo Clinic
- **Public URL:** http://localhost:3000/clinics/apollo-demo-clinic
- **Plan:** Pro (fully enabled)
- **Location:** Hyderabad

---

## Platform Admin

- URL: http://localhost:3001 → login as superadmin@bharatcliniq.com
- Can: register clinics, verify clinics, change subscription plans

---

## Typical Workflow

### Receptionist Flow
1. Login to Clinic App → Appointments
2. Add walk-in patient OR confirm online booking
3. Patient shows in queue

### Doctor Flow
1. Login → Doctor Desk
2. Select patient from queue
3. Enter vitals, SOAP notes
4. Write prescription, order labs
5. Mark encounter as completed

### Pharmacy Flow
1. Login → Pharmacy
2. See pending prescriptions
3. Dispense medicines

### Lab Flow
1. Login → Lab
2. See pending orders
3. Enter test results, mark complete

### Patient Portal
1. Go to http://localhost:3002
2. Enter mobile → get OTP from backend console
3. View appointments, prescriptions, lab results, bills

### Online Booking
1. Go to http://localhost:3000
2. Search for clinic or browse
3. Select doctor → pick slot → fill details → confirm
4. Get confirmation code
5. Check status at /booking/status/CODE

---

## Troubleshooting

**`alembic upgrade head` fails:**
- Check `backend\.env` DB credentials
- Ensure MySQL is running
- Ensure `bharatcliniq_db` database exists

**`npm run dev` fails:**
- Run `npm install` first in that folder
- Check Node.js version: `node --version` (needs 18+)

**Backend 401 errors:**
- Re-run `python seed.py` to recreate demo users

**OTP not received:**
- Check backend terminal for printed OTP
- Production SMS requires Fast2SMS/MSG91 API key in `.env`

**Port already in use:**
- Kill existing process: `netstat -ano | findstr :8000` then `taskkill /PID <pid> /F`

---

## Environment Variables Reference

See `backend\.env.example` for all options. Key ones:

```env
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/bharatcliniq_db
SECRET_KEY=change-this-in-production
OTP_MOCK=true              # Set false in production
MOCK_OTP_VALUE=123456      # Fixed OTP for testing
```
