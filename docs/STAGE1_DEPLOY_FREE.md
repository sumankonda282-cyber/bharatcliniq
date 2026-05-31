# Stage 1 — Go Live Guide (Free Hosting)
## Railway (Backend) + Vercel (3 Frontends) + Hostinger (Domain)
## Total cost: ₹699/year for domain only

---

## OVERVIEW

```
bharatcliniq.in          → Vercel (website frontend)
app.bharatcliniq.in      → Vercel (clinic app)
my.bharatcliniq.in       → Vercel (patient portal)
bharatcliniq.in/api      → Railway (FastAPI backend + MySQL)
```

Everything free except the domain (₹699/year on Hostinger).

---

## PART A — BUY THE DOMAIN (15 minutes)

### Step 1: Go to hostinger.in
1. Open **hostinger.in** in browser
2. In search bar type: `bharatcliniq.in`
3. If available → click **Add to Cart**
4. Also search `bharatcliniq.co.in` → add that too
5. Proceed to checkout
6. **IMPORTANT**: Remove any add-ons (hosting, SSL, website builder) — you don't need them
7. Pay via UPI / Net Banking: ~₹1,400 for both domains for 1 year
8. Create Hostinger account with your email

**After purchase:** You'll get access to Hostinger hPanel where you can manage DNS settings. You'll need this in Part D.

---

## PART B — UPLOAD CODE TO GITHUB (30 minutes)

Railway and Vercel deploy from GitHub. You need to push your code there first.

### Step 1: Create GitHub Account
1. Go to **github.com** → Sign up (free)
2. Verify your email

### Step 2: Install Git on Windows
1. Download from **git-scm.com** → install with all defaults
2. Open Anaconda Prompt and run:
```cmd
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### Step 3: Create GitHub Repository
1. On github.com → click **New** (green button)
2. Repository name: `bharatcliniq`
3. Set to **Private** (important — your code is private)
4. Click **Create repository**

### Step 4: Push Your Code
In Anaconda Prompt:
```cmd
cd C:\BMH\bharatcliniq_SaaS
git init
git add .
git commit -m "Initial commit - BharatCliniq Stage 1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bharatcliniq.git
git push -u origin main
```

When asked for password: use a **GitHub Personal Access Token** (not your password):
- GitHub → Settings → Developer settings → Personal access tokens → Generate new token
- Select: repo scope → Generate → copy the token
- Paste as password when git asks

---

## PART C — DEPLOY BACKEND ON RAILWAY (20 minutes)

### Step 1: Sign up for Railway
1. Go to **railway.app**
2. Click **Login with GitHub** — connect your GitHub account
3. Free tier: 500 hours/month + 1GB RAM (enough for Stage 1)

### Step 2: Create New Project
1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Select your `bharatcliniq` repo
4. Railway will auto-detect it's a Python project

### Step 3: Add MySQL Database
1. In your Railway project → click **New** → **Database** → **MySQL**
2. Railway creates a free MySQL 1GB instance
3. Click on the MySQL service → **Variables** tab
4. Note down these values (you'll need them):
   - `MYSQL_URL` (full connection string)
   - `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`

### Step 4: Set Environment Variables
Click on your backend service → **Variables** tab → Add these:

```
DATABASE_URL = mysql+pymysql://USER:PASSWORD@HOST:PORT/railway
SECRET_KEY = generate-any-random-64-character-string-here
ALGORITHM = HS256
ACCESS_TOKEN_EXPIRE_MINUTES = 1440
OTP_MOCK = true
MOCK_OTP_VALUE = 123456
CORS_ORIGINS = https://bharatcliniq.in,https://app.bharatcliniq.in,https://my.bharatcliniq.in
```

**For DATABASE_URL**: Use the MYSQL_URL Railway gave you, but change the start from `mysql://` to `mysql+pymysql://`

**For SECRET_KEY**: Go to this site: **randomkeygen.com** → copy a 256-bit WEP key

### Step 5: Set Start Command
In Railway service → **Settings** → **Deploy** → **Start Command**:
```
cd backend && pip install gunicorn && gunicorn app.main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
```

### Step 6: Run Database Migration
After first deploy succeeds:
1. Railway service → **Settings** → click **New Deployment** first to get the service running
2. Then go to **Shell** (in Railway dashboard)
3. Run:
```bash
cd backend && alembic upgrade head && python seed.py
```

### Step 7: Get Your Backend URL
Railway gives you a URL like: `bharatcliniq-production.up.railway.app`
Note this down — you'll use it when setting up Vercel.

**Test it:** Open `https://bharatcliniq-production.up.railway.app/api/v1/docs` — you should see Swagger UI.

---

## PART D — DEPLOY FRONTENDS ON VERCEL (30 minutes)

You'll create 3 separate Vercel projects — one for each frontend.

### Step 1: Sign up for Vercel
1. Go to **vercel.com**
2. Click **Continue with GitHub** → connect your GitHub account
3. Free forever for hobby/startup use

### Step 2: Deploy Website (bharatcliniq.in)
1. Vercel dashboard → **New Project**
2. Import your `bharatcliniq` repo
3. **Root Directory**: `frontend/website`
4. Framework: **Vite** (auto-detected)
5. **Environment Variables** → Add:
   ```
   VITE_API_URL = https://bharatcliniq-production.up.railway.app/api/v1
   ```
6. Click **Deploy**

After deploy → Vercel gives URL like `bharatcliniq-website.vercel.app`

### Step 3: Deploy Clinic App
1. **New Project** again → same repo
2. Root Directory: `frontend/clinic-app`
3. Environment Variables:
   ```
   VITE_API_URL = https://bharatcliniq-production.up.railway.app/api/v1
   ```
4. Deploy → Note the Vercel URL

### Step 4: Deploy Patient Portal
1. **New Project** again → same repo
2. Root Directory: `frontend/patient-portal`
3. Environment Variables:
   ```
   VITE_API_URL = https://bharatcliniq-production.up.railway.app/api/v1
   ```
4. Deploy → Note the Vercel URL

---

## PART E — CONNECT DOMAIN TO VERCEL (20 minutes)

### Step 1: Add Domain to Each Vercel Project

**For website project (bharatcliniq.in):**
1. Vercel → your website project → **Settings** → **Domains**
2. Add: `bharatcliniq.in`
3. Add: `www.bharatcliniq.in`
4. Vercel shows you DNS records to add

**For clinic app (app.bharatcliniq.in):**
1. Vercel → clinic-app project → **Settings** → **Domains**
2. Add: `app.bharatcliniq.in`

**For patient portal (my.bharatcliniq.in):**
1. Vercel → patient-portal project → **Settings** → **Domains**
2. Add: `my.bharatcliniq.in`

### Step 2: Add DNS Records in Hostinger

1. Login to **hostinger.in** → hPanel → **Domains** → bharatcliniq.in → **DNS Zone**
2. Delete all existing A records and CNAME records
3. Add these records (Vercel tells you exactly what to add, but typically):

| Type | Name | Value |
|------|------|-------|
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |
| CNAME | app | cname.vercel-dns.com |
| CNAME | my | cname.vercel-dns.com |

4. Wait 30–60 minutes for DNS to propagate

### Step 3: SSL is Automatic
Vercel automatically gives you free HTTPS on all domains. No setup needed. 🔒

---

## PART F — TEST EVERYTHING

Once DNS propagates, test these URLs:

| URL | Expected |
|-----|---------|
| https://bharatcliniq.in | Public website with search |
| https://app.bharatcliniq.in | Clinic login page |
| https://my.bharatcliniq.in | Patient OTP login |
| https://bharatcliniq-production.up.railway.app/api/v1/docs | API docs |

**Test the full booking flow:**
1. Go to bharatcliniq.in
2. Click on Apollo Demo Clinic
3. Select a doctor → pick a date → pick a time slot
4. Fill patient details → confirm
5. Note your BH ID (should be BH0000001 or similar)
6. Go to app.bharatcliniq.in → login as `admin@apollodemo.com` / `Admin@123`
7. Check if the booking appears under Appointments

---

## PART G — SMS OTP FOR PRODUCTION (Optional for Stage 1)

Currently OTP prints to Railway logs (mock mode). To enable real SMS:

1. Register at **fast2sms.com** (Indian SMS, no documents needed)
2. Add ₹100 balance → get API key
3. In Railway → your backend service → **Variables**:
   ```
   OTP_MOCK = false
   FAST2SMS_API_KEY = your-key-here
   ```
4. Railway auto-redeploys

Cost: ~₹0.20 per OTP. ₹100 = 500 OTPs.

---

## UPDATING CODE AFTER CHANGES

Whenever you fix a bug or add a feature on your laptop:
```cmd
cd C:\BMH\bharatcliniq_SaaS
git add .
git commit -m "Fix: describe what you changed"
git push
```

Railway and Vercel automatically detect the push and redeploy within 2–3 minutes. Zero manual steps.

---

## FREE TIER LIMITS — WHEN TO UPGRADE

| Platform | Free Limit | When to Upgrade |
|----------|-----------|-----------------|
| Railway | 500 hrs/month, 1GB RAM | When you have 20+ active clinics |
| Vercel | Unlimited deployments, 100GB bandwidth | Almost never for this use case |
| Railway MySQL | 1GB storage | After ~50,000 patient records |

**Upgrade cost when needed:** Railway Starter = $5/month (~₹420). Still very cheap.

---

## COST SUMMARY

| Item | Cost |
|------|------|
| bharatcliniq.in domain | ₹699/year = ₹58/month |
| bharatcliniq.co.in | ₹699/year = ₹58/month |
| Railway (backend + DB) | FREE |
| Vercel (3 frontends) | FREE |
| SMS OTP | ₹100 recharge (lasts months) |
| SSL certificate | FREE (Vercel) |
| **Total per month** | **~₹116/month** |

**Break-even: Just 1 clinic paying ₹999/month covers everything.**

---

## QUICK REFERENCE AFTER GOING LIVE

| Task | Where |
|------|-------|
| View backend logs / errors | Railway dashboard → your service → Logs |
| Redeploy after code change | Auto — just `git push` |
| Change environment variables | Railway → Variables tab |
| Add new domain | Vercel → project → Settings → Domains |
| Check database | Railway → MySQL service → Data tab |
| Scale up server | Railway → Settings → increase RAM/CPU |
