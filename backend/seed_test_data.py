#!/usr/bin/env python3
"""
BharatCliniq — Test Data Seed Script
Creates a fully set-up test clinic with admin, doctor, and receptionist accounts.
Run once against the live backend. Safe to re-run (skips if email already exists).

Usage:
    python seed_test_data.py
    python seed_test_data.py --api https://bharatcliniq-api.onrender.com
"""
import sys
import json
import urllib.request
import urllib.error
import argparse

API_BASE = "https://bharatcliniq-api.onrender.com"


def post(url, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read()), e.code


def put(url, data, token):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="PUT"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read()), e.code


def get(url, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read()), e.code


def ok(label, res, status):
    if status in (200, 201):
        print(f"  ✅ {label}")
        return True
    else:
        print(f"  ⚠️  {label} — {status}: {res.get('detail', res)}")
        return False


def main(api_base):
    print(f"\n🏥  BharatCliniq Seed Script")
    print(f"    API: {api_base}\n")

    # ── Step 1: Register test clinic ────────────────────────────────
    print("1. Registering test clinic...")
    res, status = post(f"{api_base}/api/v1/public/register-clinic", {
        "clinic": {
            "name":      "BharatCliniq Test Clinic",
            "specialty": "General Medicine",
            "phone":     "9876543210",
            "email":     "clinic@test.bharatcliniq.com",
            "address":   "123 MG Road",
            "city":      "Bangalore",
            "state":     "Karnataka",
            "pincode":   "560001",
        },
        "doctor": {
            "full_name": "Test Admin",
        },
        "admin_email":    "admin@test.bharatcliniq.com",
        "admin_password": "Test@1234",
    })

    if status in (200, 201):
        print("  ✅ Clinic registered")
    elif "already exists" in str(res.get("detail", "")):
        print("  ℹ️  Clinic/admin already exists — continuing")
    else:
        print(f"  ❌ Clinic registration failed: {res.get('detail', res)}")
        print("     Make sure the backend is running and accessible.")
        sys.exit(1)

    # ── Step 2: Login as platform admin to verify clinic ────────────
    print("\n2. Logging in as platform admin...")
    res, status = post(f"{api_base}/api/v1/auth/platform/login", {
        "identifier": "admin@bharatcliniq.com",
        "password":   "Admin@1234",
    })

    platform_token = None
    if status == 200:
        platform_token = res.get("access_token")
        print("  ✅ Platform admin logged in")
    else:
        print(f"  ⚠️  Platform admin login failed ({res.get('detail', res)})")
        print("     Skipping clinic verification — you can verify manually in platform admin portal")

    # ── Step 3: Login as clinic admin ───────────────────────────────
    print("\n3. Logging in as clinic admin...")
    res, status = post(f"{api_base}/api/v1/auth/staff/login", {
        "identifier": "admin@test.bharatcliniq.com",
        "password":   "Test@1234",
    })

    if status != 200:
        print(f"  ❌ Admin login failed: {res.get('detail', res)}")
        sys.exit(1)

    admin_token = res["access_token"]
    clinic_id   = res.get("clinic_id")
    print(f"  ✅ Logged in — clinic_id={clinic_id}")

    # ── Step 4: Get branches ─────────────────────────────────────────
    res, status = get(f"{api_base}/api/v1/clinic/branches", admin_token)
    branches = res if isinstance(res, list) else res.get("branches", [])
    branch_id = branches[0]["id"] if branches else None
    print(f"\n4. Branch ID: {branch_id}")

    # ── Step 5: Add doctor ──────────────────────────────────────────
    print("\n5. Adding test doctor...")
    res, status = post(f"{api_base}/api/v1/clinic/staff", {
        "full_name":   "Dr. Priya Sharma",
        "email":       "doctor@test.bharatcliniq.com",
        "mobile":      "9000000001",
        "password":    "Test@1234",
        "role":        "doctor",
        "branch_id":   branch_id,
        "specialty":   "General Medicine",
        "qualification": "MBBS, MD",
        "mci_number":  "MCI123456",
        "experience_years": 8,
        "consultation_fee": 500,
        "bio":         "Experienced general physician with 8 years of practice.",
    })

    if status in (200, 201):
        print("  ✅ Doctor created")
    elif "already exists" in str(res.get("detail", "")):
        print("  ℹ️  Doctor already exists")
    else:
        print(f"  ⚠️  Doctor: {res.get('detail', res)}")

    # ── Step 6: Add receptionist ────────────────────────────────────
    print("\n6. Adding test receptionist...")
    res, status = post(f"{api_base}/api/v1/clinic/staff", {
        "full_name": "Ravi Kumar",
        "email":     "reception@test.bharatcliniq.com",
        "mobile":    "9000000002",
        "password":  "Test@1234",
        "role":      "receptionist",
        "branch_id": branch_id,
    })

    if status in (200, 201):
        print("  ✅ Receptionist created")
    elif "already exists" in str(res.get("detail", "")):
        print("  ℹ️  Receptionist already exists")
    else:
        print(f"  ⚠️  Receptionist: {res.get('detail', res)}")

    # ── Step 7: Add pharmacist ──────────────────────────────────────
    print("\n7. Adding test pharmacist...")
    res, status = post(f"{api_base}/api/v1/clinic/staff", {
        "full_name": "Meena Patel",
        "email":     "pharmacy@test.bharatcliniq.com",
        "mobile":    "9000000003",
        "password":  "Test@1234",
        "role":      "pharmacist",
        "branch_id": branch_id,
    })

    if status in (200, 201):
        print("  ✅ Pharmacist created")
    elif "already exists" in str(res.get("detail", "")):
        print("  ℹ️  Pharmacist already exists")
    else:
        print(f"  ⚠️  Pharmacist: {res.get('detail', res)}")

    # ── Step 8: Add lab technician ──────────────────────────────────
    print("\n8. Adding test lab technician...")
    res, status = post(f"{api_base}/api/v1/clinic/staff", {
        "full_name": "Arjun Singh",
        "email":     "lab@test.bharatcliniq.com",
        "mobile":    "9000000004",
        "password":  "Test@1234",
        "role":      "lab_technician",
        "branch_id": branch_id,
    })

    if status in (200, 201):
        print("  ✅ Lab technician created")
    elif "already exists" in str(res.get("detail", "")):
        print("  ℹ️  Lab technician already exists")
    else:
        print(f"  ⚠️  Lab tech: {res.get('detail', res)}")

    # ── Step 9: Verify clinic via platform admin ─────────────────────
    if platform_token and clinic_id:
        print("\n9. Verifying clinic...")
        res, status = put(
            f"{api_base}/api/v1/platform/clinics/{clinic_id}/verify",
            {}, platform_token
        )
        if status == 200:
            print("  ✅ Clinic verified — will appear in public search")
        else:
            print(f"  ⚠️  Could not verify: {res.get('detail', res)}")
    else:
        print("\n9. Skipping verification (no platform token)")

    # ── Done ─────────────────────────────────────────────────────────
    print("\n" + "="*55)
    print("✅  SEED COMPLETE — Test credentials:")
    print("="*55)
    print(f"\n  Provider Portal ({api_base.replace('api.', 'provider.')})")
    print(f"  ┌─ Clinic Admin")
    print(f"  │  Email:    admin@test.bharatcliniq.com")
    print(f"  │  Password: Test@1234")
    print(f"  ├─ Doctor")
    print(f"  │  Email:    doctor@test.bharatcliniq.com")
    print(f"  │  Password: Test@1234")
    print(f"  ├─ Receptionist")
    print(f"  │  Email:    reception@test.bharatcliniq.com")
    print(f"  │  Password: Test@1234")
    print(f"  ├─ Pharmacist")
    print(f"  │  Email:    pharmacy@test.bharatcliniq.com")
    print(f"  │  Password: Test@1234")
    print(f"  └─ Lab Technician")
    print(f"     Email:    lab@test.bharatcliniq.com")
    print(f"     Password: Test@1234")
    print(f"\n  Patient Portal — use OTP login with any mobile")
    print(f"  OTP in dev mode is always: 1234")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default=API_BASE, help="Backend API base URL")
    args = parser.parse_args()
    main(args.api.rstrip("/"))
