# BharatCliniq — Production Deployment Guide
## Stack: Render (Backend) + Supabase (Database) + Vercel (3 Frontends)

---

## PART A — SUPABASE DATABASE

1. Go to **supabase.com** → New Project
2. Name: `bharatcliniq-production`
3. Region: **Southeast Asia (Singapore)** — closest to India
4. Set a strong database password → **save it**
5. Wait ~2 minutes for project to provision

6. Get your connection string:
   - Supabase dashboard → **Settings** → **Database**
   - Scroll to **Connection string** → select **URI**
   - Copy the URL (looks like: `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`)

---

## PART B — RENDER BACKEND

1. Go to **render.com** → New → **Web Service**
2. Connect GitHub → select `bharatcliniq` repo
3. Settings:
   - **Name:** `bharatcliniq-api`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app.main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 120`
   - **Instance Type:** Free

4. Environment Variables (add each one):
   ```
   DATABASE_URL     = postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
   SECRET_KEY       = [generate at randomkeygen.com → 256-bit WEP]
   ALGORITHM        = HS256
   ACCESS_TOKEN_EXPIRE_MINUTES = 1440
   OTP_MOCK         = false
   FAST2SMS_API_KEY = [from fast2sms.com]
   CORS_ORIGINS     = https://bharatcliniq.com,https://www.bharatcliniq.com,https://provider.bharatcliniq.com,https://my.bharatcliniq.com
   DEBUG            = false
   ```

5. Click **Create Web Service** → wait 3-5 minutes

6. Once deployed, go to **Shell** tab and run:
   ```bash
   cd backend && alembic upgrade head
   ```
   This creates all database tables in Supabase.

7. Note your Render URL: `bharatcliniq-api.onrender.com`

---

## PART C — VERCEL FRONTENDS (3 deployments)

Go to **vercel.com** → Login with GitHub

### Deployment 1 — Public Website (bharatcliniq.com)
1. New Project → Import `bharatcliniq` repo
2. **Root Directory:** `frontend/website`
3. **Environment Variables:**
   ```
   VITE_API_URL = https://bharatcliniq-api.onrender.com/api/v1
   VITE_PROVIDER_URL = https://provider.bharatcliniq.com
   VITE_PATIENT_PORTAL_URL = https://my.bharatcliniq.com
   ```
4. Deploy

### Deployment 2 — Provider Portal (provider.bharatcliniq.com)
1. New Project → same repo
2. **Root Directory:** `frontend/clinic-app`
3. **Environment Variables:**
   ```
   VITE_API_URL = https://bharatcliniq-api.onrender.com/api/v1
   VITE_WEBSITE_URL = https://bharatcliniq.com
   VITE_PATIENT_PORTAL_URL = https://my.bharatcliniq.com
   ```
4. Deploy

### Deployment 3 — Patient Portal (my.bharatcliniq.com)
1. New Project → same repo
2. **Root Directory:** `frontend/patient-portal`
3. **Environment Variables:**
   ```
   VITE_API_URL = https://bharatcliniq-api.onrender.com/api/v1
   VITE_WEBSITE_URL = https://bharatcliniq.com
   VITE_PROVIDER_URL = https://provider.bharatcliniq.com
   ```
4. Deploy

---

## PART D — CONNECT DOMAIN (Porkbun)

### In Vercel — Add Domains
- Website project → Settings → Domains → Add `bharatcliniq.com` and `www.bharatcliniq.com`
- Provider project → Settings → Domains → Add `provider.bharatcliniq.com`
- Patient portal → Settings → Domains → Add `my.bharatcliniq.com`

### In Porkbun — DNS Records
Go to porkbun.com → Domains → bharatcliniq.com → DNS

Delete any existing A/CNAME records, then add:

| Type  | Host     | Answer                  |
|-------|----------|-------------------------|
| A     | @        | 76.76.21.21             |
| CNAME | www      | cname.vercel-dns.com    |
| CNAME | provider | cname.vercel-dns.com    |
| CNAME | my       | cname.vercel-dns.com    |

Wait 30–60 minutes for DNS to propagate.

---

## PART E — SMS OTP SETUP (Fast2SMS)

1. Register at **fast2sms.com** (free, no documents needed)
2. Add ₹100 balance
3. Go to Dashboard → API → Dev API → copy your API key
4. In Render → your service → Environment → update:
   ```
   OTP_MOCK = false
   FAST2SMS_API_KEY = your-actual-key
   ```
5. Service auto-redeploys

---

## PART F — VERIFY EVERYTHING

Test these URLs after deployment:

| URL | Expected |
|-----|---------|
| https://bharatcliniq.com | Public website — search page |
| https://provider.bharatcliniq.com | Provider login page |
| https://my.bharatcliniq.com | Patient portal OTP login |
| https://bharatcliniq-api.onrender.com/health | `{"status":"healthy"}` |

---

## UPDATING CODE AFTER CHANGES

```cmd
cd C:\BMH\BharatCliniq
git add .
git commit -m "Description of change"
git push
```

Render and Vercel auto-redeploy within 2–3 minutes.

---

## SUBDOMAIN SUMMARY

| Subdomain | Purpose | Hosting |
|-----------|---------|---------|
| bharatcliniq.com | Public booking site | Vercel |
| provider.bharatcliniq.com | Doctor/admin portal | Vercel |
| my.bharatcliniq.com | Patient portal | Vercel |
| (Render URL) | Backend API | Render |

No extra domain purchase needed. All subdomains are free.
