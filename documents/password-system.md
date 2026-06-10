# Password System — BHarath Health Systems

## Overview

All staff passwords are stored as bcrypt hashes. Passwords are **never** stored or logged in plain text. Every new staff account starts with a temporary password that **must** be changed on first login before the portal is accessible.

---

## 1. User Types and How Passwords Are Created

### Platform Admin
- Created directly by the engineering team with a permanent password.
- Uses **two-factor authentication** (password → OTP to registered email) for login.
- No temp password flow applies.
- Login endpoint: `POST /auth/platform/login`

### Clinic Manager
- Created by the **Platform Admin** via: Admin Portal → All Clinics → Clinic Detail → **Add Manager**
- Admin fills in: full name, email, mobile, and a temporary password.
- If no password is entered, the system generates one automatically.
- After creation, the modal displays **once**:
  - Username (auto-generated from full name)
  - Temporary password
  - Portal login URL
- The manager **must change the password on first login**.

### All Other Staff (Receptionist, Doctor, Nurse, Lab, Pharmacy, Imaging)
- Created by the **Clinic Manager or Clinic Admin** via: Receptionist Portal → Staff Management → **Add Staff**
- Same flow: admin sets or system generates a temp password.
- Credentials shown once in the creation modal.
- Staff **must change the password on first login**.

---

## 2. Temp Password Rules

| Rule | Value |
|------|-------|
| Expiry | 48 hours from account creation |
| Format | Auto-generated: 10 characters, alphanumeric + special |
| Storage | Bcrypt hash only — plain text shown once, then discarded |
| Display | Admin creation modal only — copy immediately |

If a staff member does not log in within 48 hours, their temp password expires. An admin must reset the password again via the Staff Management panel.

---

## 3. First Login Flow (step by step)

```
Admin creates staff account
    ↓
Modal shows username + temp password (copy immediately)
    ↓
Staff opens their portal URL
    ↓
Staff enters: username/mobile/email + temp password → Sign In
    ↓
Backend verifies credentials, returns: { force_reset: true, access_token: … }
    ↓
Portal detects force_reset = true
    ↓
"Create Your Password" screen appears — portal is fully locked
    ↓
Staff sees their username (reminder) + 4 live requirement checks
    ↓
Staff enters new password + confirms it
    ↓
All 4 requirements met + passwords match → Set Password & Continue
    ↓
Backend: hashes new password, clears is_first_login flag, clears temp_pw_expiry
    ↓
Portal loads fresh user data → staff lands on dashboard
```

The "Create Your Password" screen **cannot be dismissed, skipped, or navigated away from** — all routes redirect to it until the password is set.

---

## 4. Password Requirements

Every staff-set password must meet all four rules (shown live as the employee types):

| Requirement | Rule |
|-------------|------|
| Length | At least **8 characters** |
| Uppercase | At least **1 uppercase letter** (A–Z) |
| Number | At least **1 digit** (0–9) |
| Special | At least **1 special character** (`!@#$%^&*()-_=+[]{}|;:,.<>?`) |

The **Set Password & Continue** button stays disabled until all 4 requirements are met and the confirm field matches exactly.

---

## 5. Password Reset Flow (forgotten password)

When a staff member cannot log in:

1. Staff clicks **"Forgot password?"** on the portal login page.
2. Enters their username or mobile number + an optional note.
3. Request is sent to the clinic manager.
4. Manager opens: Receptionist Portal → Staff Management → find the staff member → **Reset Password**.
5. A new temp password is shown once in a modal (copy immediately).
6. Manager shares the temp password securely with the staff member (phone/message).
7. Staff logs in with the new temp password → First Login Flow runs again.

---

## 6. Portal Login URLs and Access

| Portal | Who Logs In | Allowed Roles |
|--------|-------------|---------------|
| Admin Portal | Platform super admins | `platform_admin` |
| Receptionist Portal | Reception, managers | `receptionist`, `clinic_admin`, `clinic_manager` |
| CareChart | Nurses, ward doctors | All staff except `platform_admin` |
| Lab Portal | Lab technicians | `lab_tech`, `clinic_admin` |
| Pharmacy Portal | Pharmacists | `pharmacist`, `clinic_admin` |
| Imaging Portal | Imaging/radiology staff | All staff except `platform_admin` |
| Provider Portal | Doctors | `doctor`, `clinic_admin`, `clinic_manager` |

Each portal rejects logins from roles it doesn't serve (returns "Access denied").

---

## 7. API Endpoints Reference

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/auth/staff/login` | POST | No | Staff login — returns `force_reset` flag |
| `/auth/staff/set-password` | POST | Yes (token) | Change temp password on first login |
| `/auth/staff/me` | GET | Yes (token) | Get current user info |
| `/auth/staff/forgot-password` | POST | No | Submit password reset request to manager |
| `/platform/clinics/{id}/create-manager` | POST | Platform admin | Create clinic manager |
| `/clinic/staff` | POST | Clinic admin/manager | Create any staff member |
| `/platform/staff/{id}/reset-password` | POST | Platform admin | Admin resets any staff password |

---

## 8. Security Details

- **Hashing:** bcrypt via `pwdlib` library (industry standard, salted)
- **Account lockout:** 5 failed login attempts → account locked for 30 minutes
- **Token versioning:** Changing password increments `token_version`, invalidating all existing sessions
- **Temp expiry enforcement:** Login fails if `is_first_login=True` and temp has expired — admin must reset
- **`force_reset` in token response only:** The flag is returned only at login, not from `/auth/staff/me` — this is intentional to prevent infinite redirect loops if the page is refreshed before completing the reset
- **No password in logs:** The backend `create-manager` endpoint comment explicitly states temp password is returned in response only, not logged

---

## 9. Credential Handoff Best Practices (for admins)

1. After creating a staff account, **immediately copy the temp password** — the modal is shown only once.
2. Share credentials via a **private channel** (phone call, secure message — not email).
3. Instruct the staff member to log in within **48 hours** before the temp expires.
4. Never share passwords over public channels or leave them in notes/documents.
5. If a staff member hasn't logged in and 48 hours have passed, use **Reset Password** to issue a fresh temp.
