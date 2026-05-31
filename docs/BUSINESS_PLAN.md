# BharatCliniq — 4-Stage Deployment & Business Plan

**Platform:** SaaS EHR + Telehealth for Indian Clinics  
**Domain:** bharatcliniq.com  
**Stack:** React + FastAPI + MySQL  
**Logo:** India map silhouette with medical plus sign inside  

---

## CURRENT STATUS (Pre-Stage 1)

### ✅ Already Built (Local)
- Backend: FastAPI, 16 DB tables, 12 API modules, PDF generation
- Website: Public clinic search, online booking, booking status tracker
- Clinic App: Dashboard, patients, appointments, doctor desk, pharmacy, lab, billing, admin
- Patient Portal: OTP login, multilingual (EN/TE/HI/TA/KN), prescriptions, lab results, bills
- Seed data: Apollo Demo Clinic, 7 staff users, demo patients

### 🆕 Added in This Plan
- **PatientReferral table** — cross-clinic referral with referral code, urgency, clinical notes
- **Referral API** — create, accept, complete, network clinic search
- **Telehealth** (Stage 1 addition)
- **Logo** — India map + plus sign (assets/logo.svg)

---

## STAGE 1 — Public Launch (Months 1–3)
**Goal:** Get website live, acquire first 10 paying clinics

### What to Deploy
1. **bharatcliniq.com** — Public marketing website + online booking
2. **app.bharatcliniq.com** — Clinic staff dashboard
3. **my.bharatcliniq.com** — Patient portal
4. **Telehealth** — Video consult via Daily.co or Jitsi (free tier)

### Telehealth — What to Add

**Add to appointment mode enum (models.py):**
```python
class AppointmentMode(str, enum.Enum):
    walk_in   = "walk_in"
    online    = "online"
    telehealth = "telehealth"   # ADD THIS
```

**How it works:**
- Doctor sets schedule to allow telehealth slots
- Patient books telehealth appointment on website
- At appointment time → both get a room link: `https://bharatcliniq.daily.co/{appointment_id}`
- Use Daily.co free plan (10,000 mins/month free) or open-source Jitsi

**Files to create for telehealth:**
- `backend/app/api/v1/endpoints/telehealth.py` — generate room token
- `frontend/clinic-app/src/pages/TelehealthRoom.jsx` — doctor video UI
- `frontend/website/src/pages/TelehealthRoom.jsx` — patient video UI

### Infrastructure Setup (Stage 1)

| Service | Provider | Cost |
|---------|----------|------|
| VPS Server | DigitalOcean / Hetzner | ₹800–2000/mo |
| Domain | GoDaddy / Namecheap | ₹1000/yr |
| SSL | Let's Encrypt (free) | Free |
| Email | Zoho Mail / Gmail Workspace | ₹150/mo |
| OTP SMS | Fast2SMS or MSG91 | ₹0.10/SMS |
| Video | Daily.co free tier | Free |
| DB Backup | DigitalOcean Spaces | ₹150/mo |

**Total Stage 1 infrastructure cost: ~₹2,000–3,000/month**

### Deployment Steps (Stage 1)

```bash
# On Ubuntu 22.04 VPS
sudo apt update && sudo apt install -y nginx mysql-server python3-pip nodejs npm certbot

# Backend
git clone your-repo /var/www/bharatcliniq
cd /var/www/bharatcliniq/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Set production .env (DB, JWT secret, SMS API keys)
alembic upgrade head
python seed.py

# Run with PM2 or systemd
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Frontend build
cd frontend/website && npm install && npm run build   # → dist/
cd frontend/clinic-app && npm install && npm run build
cd frontend/patient-portal && npm install && npm run build

# Nginx: serve dist/ folders, proxy /api to :8000
```

### Nginx Config (nginx.conf snippet)
```nginx
server {
    server_name bharatcliniq.com;
    root /var/www/bharatcliniq/frontend/website/dist;
    index index.html;
    location /api/ { proxy_pass http://127.0.0.1:8000/api/; }
    location / { try_files $uri $uri/ /index.html; }
}
server {
    server_name app.bharatcliniq.com;
    root /var/www/bharatcliniq/frontend/clinic-app/dist;
    location /api/ { proxy_pass http://127.0.0.1:8000/api/; }
    location / { try_files $uri $uri/ /index.html; }
}
server {
    server_name my.bharatcliniq.com;
    root /var/www/bharatcliniq/frontend/patient-portal/dist;
    location /api/ { proxy_pass http://127.0.0.1:8000/api/; }
    location / { try_files $uri $uri/ /index.html; }
}
```

### Stage 1 Revenue Targets
- **Free plan:** 5 clinics (brand awareness, feedback)
- **Basic plan ₹999/mo:** 5 clinics = ₹4,995 MRR
- **Target by end of Stage 1:** ₹5,000 MRR

---

## STAGE 2 — Growth & Referral Network (Months 4–9)
**Goal:** 50 clinics, launch referral network, telehealth expansion

### New Features to Build
1. **Referral Module** (already in codebase)
   - Doctor creates referral → receiving clinic notified by email/SMS
   - Patient gets referral code → books appointment at receiving clinic
   - Referral report: track referral outcomes across network

2. **Referral Reports Page** (new frontend page)
   - File: `frontend/clinic-app/src/pages/ReferralsPage.jsx`
   - Sent referrals tab: status, outcome, receiving clinic
   - Received referrals tab: accept/decline, assign doctor
   - Network map: visual of which clinics refer to which

3. **Analytics Dashboard** (clinic admin)
   - Patient visit trends by month
   - Revenue per doctor
   - Top diagnoses
   - Referral conversion rate

4. **WhatsApp Integration**
   - Appointment reminders via WhatsApp Business API
   - Lab result notifications
   - Cost: ₹1–2 per message

5. **Prescription Delivery** (partner with PharmEasy/1MG API)
   - Patient clicks "Order Medicines" on portal
   - Affiliate commission: 5–8% of order value

### Infrastructure Upgrades (Stage 2)
| Upgrade | Reason | Cost |
|---------|--------|------|
| Managed MySQL (PlanetScale or RDS) | Reliability, backups | ₹2,000/mo |
| Load balancer | Multi-server | ₹500/mo |
| Redis cache | Session, OTP | ₹300/mo |
| CDN (Cloudflare free) | Static assets | Free |

### Stage 2 Revenue Targets
- **Basic ₹999/mo:** 30 clinics = ₹29,970
- **Pro ₹2,499/mo:** 20 clinics = ₹49,980
- **Target by end of Stage 2:** ₹80,000 MRR

---

## STAGE 3 — Scale & Verticals (Months 10–18)
**Goal:** 200 clinics, add diagnostic centers, insurance integration

### New Features
1. **Diagnostic Center Module**
   - Standalone lab/radiology centers register on BharatCliniq
   - Clinics refer patients to diagnostic centers
   - Results flow back to clinic automatically

2. **Insurance / TPA Integration**
   - ABDM (Ayushman Bharat Digital Mission) Health ID linkage
   - Insurance claim pre-authorization
   - Cashless claim workflow

3. **ABDM Compliance**
   - Generate ABHA (Ayushman Bharat Health Account) for patients
   - FHIR-compatible health records export
   - This unlocks government hospital partnerships

4. **Mobile Apps**
   - React Native app for clinic staff (iOS + Android)
   - Patient app with push notifications
   - Estimated dev time: 3 months

5. **AI Features**
   - Drug interaction checker on prescriptions
   - Symptom-based triage chatbot on website
   - Auto-fill ICD-10 diagnosis codes from SOAP notes

### Stage 3 Revenue Targets
- **Basic ₹999/mo:** 80 clinics = ₹79,920
- **Pro ₹2,499/mo:** 80 clinics = ₹1,99,920
- **Enterprise ₹9,999/mo:** 10 hospital groups = ₹99,990
- **Target by end of Stage 3:** ₹3,80,000 MRR (~₹45 lakh/year)

---

## STAGE 4 — Platform & Marketplace (Month 19+)
**Goal:** BharatCliniq becomes the healthcare OS for tier-2/3 India

### What This Looks Like
1. **Open API Platform**
   - Third-party developers build integrations
   - Pharmacy chains, insurance companies, diagnostic labs pay to integrate
   - Revenue: API usage fees + integration fees

2. **BharatCliniq Marketplace**
   - Clinics list services (telehealth, home visits, health packages)
   - Patients book and pay directly on bharatcliniq.com
   - BharatCliniq takes 10–15% commission

3. **Franchise / White-label**
   - Hospital chains get white-labeled version
   - Revenue: ₹50,000–5,00,000 setup + ₹20,000/mo license

4. **Health Data Insights (B2B)**
   - Anonymized, aggregated health trend data
   - Sold to pharma companies, insurance companies
   - Requires strict compliance (DPDP Act 2023)

5. **BharatCliniq Credit**
   - Patients pay medical bills on EMI via BNPL partners
   - BharatCliniq earns referral fee from lending partner

### Stage 4 Revenue Targets
- SaaS subscriptions: ₹15–20 lakh/mo
- Marketplace commissions: ₹5–8 lakh/mo
- White-label licenses: ₹10 lakh/mo
- **Target: ₹3 crore+ ARR**

---

## REVENUE MODEL SUMMARY

### Subscription Plans (Primary Revenue)

| Plan | Price | Limits | Target Clinic |
|------|-------|--------|---------------|
| Free | ₹0 | 2 doctors, 1 branch, 100 patients/mo | Solo practitioners |
| Basic | ₹999/mo | 5 doctors, 2 branches, unlimited patients | Small clinics |
| Pro | ₹2,499/mo | Unlimited doctors, branches, patients + telehealth | Mid-size clinics |
| Enterprise | ₹9,999/mo | Multi-location, API access, priority support | Hospital groups |

### Additional Revenue Streams

| Stream | How | Commission/Fee |
|--------|-----|----------------|
| **SMS OTP** | Charge clinics ₹0.50/OTP (buy at ₹0.10) | ₹0.40 margin |
| **Telehealth** | ₹99/consult on Pro plan | ₹99 per session |
| **Medicine Ordering** | Affiliate with PharmEasy/1MG | 5–8% of order |
| **Lab Referrals** | Partner labs pay ₹50–200 per referred test | Per test |
| **Payment Gateway** | Razorpay: charge clinics 2%, pay 1.8% | 0.2% margin |
| **Insurance TPA** | Claim processing fee | ₹50–100/claim |
| **ABDM Integration** | Gov health scheme onboarding fee | ₹5,000 setup |
| **Data Analytics** | B2B anonymized trend reports | ₹50,000–5,00,000/report |

### Break-Even Analysis
- Monthly costs (Stage 1): ~₹25,000 (server + SMS + support)
- Break-even: 25 Basic clinics OR 10 Pro clinics
- **Very achievable by Month 3**

---

## REFERRAL SYSTEM — How It Works

### Cross-Clinic Referral Flow
```
Doctor A (Clinic A) sees patient
  → Creates referral (reason, urgency, clinical notes)
  → Selects Clinic B from BharatCliniq network
  → System generates referral code REF-XXXXXXXX
  → Patient and Clinic B notified by SMS/email

Clinic B receives referral
  → Reviews clinical notes
  → Accepts referral, assigns doctor
  → Patient books appointment at Clinic B using referral code

Appointment at Clinic B
  → Doctor sees referral history, clinical notes from Clinic A
  → Completes appointment
  → Marks referral as completed
  → Clinic A doctor can see outcome

Referral Report (visible to both clinics)
  → Total referrals sent/received
  → Acceptance rate
  → Outcome tracking
  → Network visualization
```

### Revenue from Referrals
- **Referral fee (future):** Receiving clinic pays ₹50–100 per accepted referral
- **Network effect:** More clinics → more referrals → more value → more signups

---

## FILES ADDED IN THIS PLAN

| File | Description |
|------|-------------|
| `backend/app/models/models.py` | Added PatientReferral model + ReferralStatus enum |
| `backend/app/api/v1/endpoints/referrals.py` | Full referral CRUD API |
| `backend/app/main.py` | Registered referrals router |
| `assets/logo.svg` | India map + plus sign logo |
| `docs/BUSINESS_PLAN.md` | This document |

### Files Still Needed (Stage 1)
| File | Description |
|------|-------------|
| `frontend/clinic-app/src/pages/ReferralsPage.jsx` | Referrals UI |
| `backend/app/api/v1/endpoints/telehealth.py` | Video room token API |
| `frontend/website/src/pages/TelehealthPage.jsx` | Public telehealth booking |
| `scripts/deploy.sh` | Production deployment script |
| `nginx.conf` | Nginx configuration |

---

## WHAT TO DO RIGHT NOW (Next Steps)

### Today
1. ✅ Finish local testing (you're doing this now)
2. Add referral table to DB: in Anaconda Prompt, run `python seed.py` again after updating models
3. Test all pages at localhost:3001

### This Week
1. Buy domain: bharatcliniq.com (GoDaddy ~₹800)
2. Create account: DigitalOcean (get $200 free credit)
3. Set up VPS: Ubuntu 22.04, 2 CPU, 4GB RAM
4. Deploy backend + all 3 frontends
5. Configure SSL via Let's Encrypt

### This Month
1. Reach out to 10 local clinics (friends/family doctors)
2. Offer 3 months free Pro plan in exchange for feedback
3. Record demo video for YouTube/WhatsApp
4. Create Instagram page: @bharatcliniq

### Pricing Page (website)
Add `/pricing` page to website showing the 4 plans with features comparison table.

---

## COMPETITIVE ADVANTAGE

| Feature | BharatCliniq | Practo | Clinikk |
|---------|-------------|--------|---------|
| Price | ₹999–2499/mo | ₹8,000+/mo | ₹5,000+/mo |
| Language support | 5 Indian languages | English only | English only |
| Cross-clinic referrals | ✅ | ❌ | ❌ |
| Open booking website | ✅ | Extra cost | ❌ |
| Patient portal | ✅ | ✅ | Limited |
| Telehealth | ✅ Stage 1 | ✅ | ❌ |
| Offline capable | Planned Stage 3 | ❌ | ❌ |

**BharatCliniq wins on:** Price, Indian language support, referral network, and being purpose-built for tier-2/3 India clinics.

---

*Document version: Stage 1 Launch Plan | Updated: 2026*
