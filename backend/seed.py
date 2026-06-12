"""
BHarath Health Seed Script — idempotent, safe to run on every deploy.
Commits in stages so a failure in demo data never rolls back critical auth records.
Run: python seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.db.session import SessionLocal, engine, Base
from app.models.models import (
    PlatformAdmin, Clinic, Branch, Staff, DoctorProfile,
    DoctorSchedule, Patient, Medicine, LabTest
)
from app.core.security import hash_password
from datetime import date, datetime, timedelta


def _exists(db, model, **filters):
    return db.query(model).filter_by(**filters).first() is not None


def _seed_critical(db):
    """Platform admin + clinic staff. Committed independently."""
    print("[seed] Starting BHarath Health seed...")

    # ── Platform Superadmin ───────────────────────────────────────────
    if not _exists(db, PlatformAdmin, email="superadmin@bharathealth.com"):
        db.add(PlatformAdmin(
            full_name="BHarath Health Admin",
            email="superadmin@bharathealth.com",
            hashed_password=hash_password("SuperAdmin@123"),
            is_active=True,
        ))
        print("[seed]   ✓ Platform admin created")
    else:
        admin = db.query(PlatformAdmin).filter_by(email="superadmin@bharathealth.com").first()
        admin.hashed_password = hash_password("SuperAdmin@123")
        admin.is_active = True
        print("[seed]   ✓ Platform admin password refreshed")

    db.commit()

    # ── Demo Clinic ───────────────────────────────────────────────────
    clinic = db.query(Clinic).filter_by(slug="apollo-demo-clinic").first()
    if not clinic:
        clinic = Clinic(
            name="Apollo Demo Clinic",
            slug="apollo-demo-clinic",
            specialty="Multi-Specialty",
            description="A demo multi-specialty clinic on BHarath Health platform.",
            email="info@apollodemo.com",
            phone="040-12345678",
            address="123 Jubilee Hills",
            city="Hyderabad",
            state="Telangana",
            pincode="500033",
            is_active=True,
            is_verified=True,
            subscription_plan='pro',
            subscription_status='active',
            subscription_expiry=datetime.now() + timedelta(days=365),
        )
        db.add(clinic)
        db.commit()
        db.refresh(clinic)
        print("[seed]   ✓ Demo clinic created")

    # ── Branches ──────────────────────────────────────────────────────
    branch_main = db.query(Branch).filter_by(clinic_id=clinic.id, name="Main Branch - Jubilee Hills").first()
    if not branch_main:
        branch_main = Branch(
            clinic_id=clinic.id,
            name="Main Branch - Jubilee Hills",
            address="123 Jubilee Hills Road",
            city="Hyderabad", state="Telangana", pincode="500033",
            phone="040-12345678", email="main@apollodemo.com",
        )
        db.add(branch_main)
        db.commit()
        db.refresh(branch_main)
        print("[seed]   ✓ Main branch created")

    # ── Staff ─────────────────────────────────────────────────────────
    staff_defs = [
        dict(email="drpriya@apollodemo.com",  mobile="9000000002", full_name="Dr. Priya Sharma",  role="clinic_admin",       password="Doctor@123",    username="priy17"),  # Owner (founding doctor)
        dict(email="drrajan@apollodemo.com",  mobile="9000000006", full_name="Dr. Rajan Mehta",   role="doctor",             password="Doctor@123",    username="raja83"),
        dict(email="manager@apollodemo.com",  mobile="9000000007", full_name="Sunita Verma",      role="clinic_manager",     password="Manager@123",   username="suni42"),
        dict(email="ravi@apollodemo.com",     mobile="9000000003", full_name="Ravi Kumar",        role="receptionist",       password="Reception@123", username="ravi56"),
        dict(email="meera@apollodemo.com",    mobile="9000000004", full_name="Meera Patel",       role="pharmacist",         password="Pharmacy@123",  username="meer29"),
        dict(email="arjun@apollodemo.com",    mobile="9000000005", full_name="Arjun Singh",       role="lab_tech",           password="Lab@123",       username="arju74"),
        dict(email="kiran@apollodemo.com",    mobile="9000000008", full_name="Kiran Rao",         role="imaging_technician", password="Imaging@123",   username="kira38"),
        dict(email="drsuresh@apollodemo.com", mobile="9000000009", full_name="Dr. Suresh Nair",   role="radiologist",        password="Radio@123",     username="sure91"),
        dict(email="demo@bharathhealthsystems.com",   mobile="9000000099", full_name="Dr. Rajesh Kumar",  role="clinic_admin",       password="Demo@1234",     username="raje61"),
    ]

    doctor1 = None
    doctor2 = None
    for s in staff_defs:
        existing = db.query(Staff).filter_by(email=s["email"]).first()
        if existing:
            existing.hashed_password = hash_password(s["password"])
            existing.is_active = True
            existing.is_first_login = False
            if s.get("username") and not existing.username:
                existing.username = s["username"]
        else:
            new_staff = Staff(
                clinic_id=clinic.id, branch_id=branch_main.id,
                full_name=s["full_name"], email=s["email"], mobile=s["mobile"],
                hashed_password=hash_password(s["password"]),
                role=s["role"], is_active=True,
                username=s.get("username"), is_first_login=False,
            )
            db.add(new_staff)
            db.flush()
            existing = new_staff
        if s["email"] == "drpriya@apollodemo.com":
            doctor1 = existing
        if s["email"] == "drrajan@apollodemo.com":
            doctor2 = existing

    db.commit()
    print("[seed]   ✓ All staff passwords set/refreshed")

    # ── Doctor Profiles ───────────────────────────────────────────────
    if doctor1 and not _exists(db, DoctorProfile, staff_id=doctor1.id):
        db.add(DoctorProfile(
            staff_id=doctor1.id, specialty="General Medicine",
            qualification="MBBS, MD (Internal Medicine)", mci_number="AP-MED-12345",
            experience_years=8, consultation_fee=500,
            bio="Dr. Priya Sharma is an experienced general physician.",
            languages="English, Telugu, Hindi",
            accepts_online_booking=True, avg_consultation_minutes=15,
            telehealth_enabled=True, telehealth_fee=400,
            mci_verified=True,
        ))
    else:
        dp1 = db.query(DoctorProfile).filter_by(staff_id=doctor1.id).first() if doctor1 else None
        if dp1:
            dp1.telehealth_enabled = True
            dp1.telehealth_fee = 400
            dp1.mci_verified = True

    if doctor2 and not _exists(db, DoctorProfile, staff_id=doctor2.id):
        db.add(DoctorProfile(
            staff_id=doctor2.id, specialty="Cardiology",
            qualification="MBBS, MD, DM (Cardiology)", mci_number="AP-MED-67890",
            experience_years=12, consultation_fee=800,
            bio="Dr. Rajan Mehta is a senior cardiologist.",
            languages="English, Telugu, Hindi",
            accepts_online_booking=True, avg_consultation_minutes=20,
            telehealth_enabled=True, telehealth_fee=600,
            mci_verified=True,
        ))
    else:
        dp2 = db.query(DoctorProfile).filter_by(staff_id=doctor2.id).first() if doctor2 else None
        if dp2:
            dp2.telehealth_enabled = True
            dp2.telehealth_fee = 600
            dp2.mci_verified = True

    db.commit()

    # Add Mon–Sat schedules for Apollo demo doctors
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    for doc in [doctor1, doctor2]:
        if not doc:
            continue
        dp = db.query(DoctorProfile).filter_by(staff_id=doc.id).first()
        if not dp:
            continue
        for day in days:
            if not db.query(DoctorSchedule).filter_by(doctor_id=dp.id, day_of_week=day).first():
                db.add(DoctorSchedule(doctor_id=dp.id, branch_id=branch_main.id, day_of_week=day,
                                      start_time="09:00", end_time="12:00", slot_minutes=30, max_patients=6))
                db.add(DoctorSchedule(doctor_id=dp.id, branch_id=branch_main.id, day_of_week=day,
                                      start_time="16:00", end_time="19:00", slot_minutes=30, max_patients=6))
    db.commit()

    # ── Additional sample clinics for testing ─────────────────────────
    _seed_sample_clinics(db)

    # ── Demo Patients ─────────────────────────────────────────────────
    if not _exists(db, Patient, uhid="BH202400001"):
        db.add(Patient(
            clinic_id=clinic.id, branch_id=branch_main.id,
            uhid="BH202400001", full_name="Amit Verma",
            date_of_birth=date(1985, 5, 20), gender='male',
            mobile="9111111111", email="amit.verma@email.com",
            blood_group="B+", city="Hyderabad", state="Telangana",
        ))
    if not _exists(db, Patient, uhid="BH202400002"):
        db.add(Patient(
            clinic_id=clinic.id, branch_id=branch_main.id,
            uhid="BH202400002", full_name="Sunita Devi",
            date_of_birth=date(1992, 8, 15), gender='female',
            mobile="9222222222", blood_group="O+",
            city="Hyderabad", state="Telangana", allergies="Penicillin",
        ))
    db.commit()

    return branch_main


def _seed_sample_clinics(db):
    """Seed 4 sample clinics with diverse doctors across cities for public portal testing."""

    sample_clinics = [
        {
            "clinic": dict(
                name="MediCare Health Center", slug="medicare-health-center",
                specialty="General Medicine & Pediatrics",
                description="Trusted family health center serving Mumbai since 2010.",
                email="info@medicaremumbai.com", phone="022-98765432",
                address="45 Bandra West", city="Mumbai", state="Maharashtra", pincode="400050",
            ),
            "doctors": [
                dict(name="Dr. Ananya Desai",    email="ananya@medicaremumbai.com",  mobile="9811000001", username="anan01",
                     specialty="Pediatrics",      qualification="MBBS, MD (Pediatrics)", experience_years=9,
                     consultation_fee=600,        telehealth_fee=500, mci_number="MH-PED-1001"),
                dict(name="Dr. Vikram Joshi",    email="vikram@medicaremumbai.com",  mobile="9811000002", username="vikr02",
                     specialty="General Medicine",qualification="MBBS, DNB", experience_years=14,
                     consultation_fee=500,        telehealth_fee=400, mci_number="MH-MED-1002"),
            ],
        },
        {
            "clinic": dict(
                name="HeartCare Cardiac Center", slug="heartcare-cardiac-bangalore",
                specialty="Cardiology",
                description="Advanced cardiac care with state-of-the-art diagnostics in Bangalore.",
                email="info@heartcare.in", phone="080-44556677",
                address="12 Koramangala 5th Block", city="Bangalore", state="Karnataka", pincode="560095",
            ),
            "doctors": [
                dict(name="Dr. Suresh Babu",     email="suresh@heartcare.in",        mobile="9811000003", username="sure03",
                     specialty="Cardiology",      qualification="MBBS, MD, DM (Cardiology)", experience_years=18,
                     consultation_fee=1200,       telehealth_fee=900, mci_number="KA-CAR-2001"),
                dict(name="Dr. Kavitha Reddy",   email="kavitha@heartcare.in",       mobile="9811000004", username="kavi04",
                     specialty="Internal Medicine",qualification="MBBS, MD (Internal Medicine)", experience_years=11,
                     consultation_fee=800,        telehealth_fee=600, mci_number="KA-MED-2002"),
            ],
        },
        {
            "clinic": dict(
                name="SkinGlow Dermatology Clinic", slug="skinglow-dermatology-delhi",
                specialty="Dermatology",
                description="Expert skin and hair care specialists in South Delhi.",
                email="hello@skinglow.in", phone="011-40001234",
                address="89 Hauz Khas Village", city="Delhi", state="Delhi", pincode="110016",
            ),
            "doctors": [
                dict(name="Dr. Neha Kapoor",     email="neha@skinglow.in",           mobile="9811000005", username="neha05",
                     specialty="Dermatology",     qualification="MBBS, MD (Dermatology)", experience_years=7,
                     consultation_fee=900,        telehealth_fee=700, mci_number="DL-DER-3001"),
                dict(name="Dr. Arjun Malhotra",  email="arjun@skinglow.in",          mobile="9811000006", username="arjun06",
                     specialty="Cosmetology",     qualification="MBBS, DVD", experience_years=5,
                     consultation_fee=700,        telehealth_fee=550, mci_number="DL-COS-3002"),
            ],
        },
        {
            "clinic": dict(
                name="OrthoPlus Joint Care", slug="orthoplus-joint-care-chennai",
                specialty="Orthopedics",
                description="Specialized orthopedic and sports medicine center in Chennai.",
                email="care@orthoplus.in", phone="044-33445566",
                address="22 Anna Nagar East", city="Chennai", state="Tamil Nadu", pincode="600040",
            ),
            "doctors": [
                dict(name="Dr. Rajasekar M",     email="raja@orthoplus.in",          mobile="9811000007", username="rajas07",
                     specialty="Orthopedics",     qualification="MBBS, MS (Ortho)", experience_years=15,
                     consultation_fee=1000,       telehealth_fee=800, mci_number="TN-ORT-4001"),
                dict(name="Dr. Preethi Nathan",  email="preethi@orthoplus.in",       mobile="9811000008", username="preet08",
                     specialty="Physiotherapy",   qualification="BPT, MPT", experience_years=8,
                     consultation_fee=600,        telehealth_fee=450, mci_number="TN-PHY-4002"),
            ],
        },
    ]

    for item in sample_clinics:
        cd = item["clinic"]
        clinic = db.query(Clinic).filter_by(slug=cd["slug"]).first()
        if not clinic:
            clinic = Clinic(
                **cd,
                is_active=True, is_verified=True,
                subscription_plan='pro', subscription_status='active',
                subscription_expiry=datetime.now() + timedelta(days=365),
            )
            db.add(clinic)
            db.flush()
            print(f"[seed]   ✓ Sample clinic: {cd['name']}")
        else:
            clinic.is_active = True
            clinic.is_verified = True

        branch = db.query(Branch).filter_by(clinic_id=clinic.id).first()
        if not branch:
            branch = Branch(
                clinic_id=clinic.id, name="Main Branch",
                address=cd.get("address"), city=cd.get("city"),
                state=cd.get("state"), pincode=cd.get("pincode"),
                phone=cd.get("phone"), email=cd.get("email"),
            )
            db.add(branch)
            db.flush()

        for dd in item["doctors"]:
            staff = db.query(Staff).filter_by(email=dd["email"]).first()
            if not staff:
                staff = Staff(
                    clinic_id=clinic.id, branch_id=branch.id,
                    full_name=dd["name"], email=dd["email"],
                    mobile=dd["mobile"], username=dd["username"],
                    hashed_password=hash_password("Doctor@123"),
                    role="doctor", is_active=True, is_first_login=False,
                )
                db.add(staff)
                db.flush()

            if not _exists(db, DoctorProfile, staff_id=staff.id):
                dp = DoctorProfile(
                    staff_id=staff.id,
                    clinic_id=clinic.id,
                    specialty=dd["specialty"],
                    qualification=dd["qualification"],
                    mci_number=dd["mci_number"],
                    experience_years=dd["experience_years"],
                    consultation_fee=dd["consultation_fee"],
                    telehealth_enabled=True,
                    telehealth_fee=dd["telehealth_fee"],
                    accepts_online_booking=True,
                    mci_verified=True,
                    languages="English, Hindi",
                    bio=f"{dd['name']} is a specialist with {dd['experience_years']} years of experience.",
                )
                db.add(dp)
                db.flush()
            else:
                dp = db.query(DoctorProfile).filter_by(staff_id=staff.id).first()
                dp.telehealth_enabled = True
                dp.mci_verified = True
                db.flush()

            # Add Mon–Sat schedules for online booking slots (morning + evening)
            days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
            for day in days:
                if not db.query(DoctorSchedule).filter_by(doctor_id=dp.id, day_of_week=day).first():
                    db.add(DoctorSchedule(doctor_id=dp.id, branch_id=branch.id, day_of_week=day,
                                          start_time="09:00", end_time="12:00", slot_minutes=30, max_patients=6))
                    db.add(DoctorSchedule(doctor_id=dp.id, branch_id=branch.id, day_of_week=day,
                                          start_time="16:00", end_time="19:00", slot_minutes=30, max_patients=6))

        db.commit()

    print("[seed]   ✓ Sample clinics seeded (4 cities, 8 doctors)")


def _seed_demo_data(db, branch_main):
    """Medicines and lab tests — non-critical, failures are logged but ignored."""

    medicine_defs = [
        dict(name="Paracetamol 500mg",  generic_name="Paracetamol",  category="Analgesic",        form="Tablet",  strength="500mg", unit_price=2.50,  stock_quantity=500, reorder_level=50),
        dict(name="Amoxicillin 500mg",  generic_name="Amoxicillin",  category="Antibiotic",       form="Capsule", strength="500mg", unit_price=12.00, stock_quantity=200, reorder_level=30),
        dict(name="Metformin 500mg",    generic_name="Metformin",    category="Antidiabetic",     form="Tablet",  strength="500mg", unit_price=3.50,  stock_quantity=300, reorder_level=40),
        dict(name="Atorvastatin 10mg",  generic_name="Atorvastatin", category="Cardiac",          form="Tablet",  strength="10mg",  unit_price=8.00,  stock_quantity=150, reorder_level=20),
        dict(name="Omeprazole 20mg",    generic_name="Omeprazole",   category="Antacid",          form="Capsule", strength="20mg",  unit_price=5.00,  stock_quantity=180, reorder_level=25),
        dict(name="Cetirizine 10mg",    generic_name="Cetirizine",   category="Antihistamine",    form="Tablet",  strength="10mg",  unit_price=4.00,  stock_quantity=200, reorder_level=25),
        dict(name="Amlodipine 5mg",     generic_name="Amlodipine",   category="Antihypertensive", form="Tablet",  strength="5mg",   unit_price=6.50,  stock_quantity=120, reorder_level=20),
    ]
    try:
        for m in medicine_defs:
            if not _exists(db, Medicine, branch_id=branch_main.id, name=m["name"]):
                db.add(Medicine(branch_id=branch_main.id, **m))
        db.commit()
        print("[seed]   ✓ Medicines seeded")
    except Exception as e:
        db.rollback()
        print(f"[seed]   ⚠ Medicines skipped: {e}")

    lab_defs = [
        dict(name="Complete Blood Count",        code="CBC",    category="Haematology",   price=250, normal_range="Various", turnaround_hours=4),
        dict(name="Blood Glucose Fasting",       code="FBS",    category="Biochemistry",  price=80,  normal_range="70-100",  unit="mg/dL", turnaround_hours=2),
        dict(name="HbA1c",                       code="HBA1C",  category="Biochemistry",  price=350, normal_range="< 5.7",   unit="%", turnaround_hours=6),
        dict(name="Lipid Profile",               code="LIPID",  category="Biochemistry",  price=400, normal_range="Various", turnaround_hours=4),
        dict(name="Urine Routine",               code="URE",    category="Urology",       price=60,  normal_range="Normal",  turnaround_hours=2),
        dict(name="Thyroid Profile (T3/T4/TSH)", code="TFT",    category="Endocrinology", price=500, normal_range="Various", turnaround_hours=6),
        dict(name="ECG",                         code="ECG",    category="Cardiology",    price=150, normal_range="Normal sinus rhythm", turnaround_hours=1),
    ]
    try:
        for t in lab_defs:
            if not _exists(db, LabTest, branch_id=branch_main.id, code=t["code"]):
                db.add(LabTest(branch_id=branch_main.id, **t))
        db.commit()
        print("[seed]   ✓ Lab tests seeded")
    except Exception as e:
        db.rollback()
        print(f"[seed]   ⚠ Lab tests skipped: {e}")


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        branch_main = _seed_critical(db)
        _seed_demo_data(db, branch_main)
        print("[seed] ✓ Seed complete!")
        print("=" * 55)
        print("  LOGIN CREDENTIALS")
        print("=" * 55)
        print("  Platform Admin  : superadmin@bharathealth.com / SuperAdmin@123")
        print("  Clinic Admin    : admin@apollodemo.com / Admin@123")
        print("  Doctor          : drpriya@apollodemo.com / Doctor@123")
        print("  Receptionist    : ravi@apollodemo.com / Reception@123")
        print("  Pharmacist      : meera@apollodemo.com / Pharmacy@123")
        print("  Lab Technician  : arjun@apollodemo.com / Lab@123")
        print("  Demo Provider   : demo@bharathhealthsystems.com / Demo@1234")
        print("=" * 55)
    except Exception as e:
        db.rollback()
        print(f"[seed] FAILED: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
