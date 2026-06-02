"""
BharatCliniq Seed Script — idempotent, safe to run on every deploy.
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
    print("[seed] Starting BharatCliniq seed...")

    # ── Platform Superadmin ───────────────────────────────────────────
    if not _exists(db, PlatformAdmin, email="superadmin@bharathealth.com"):
        db.add(PlatformAdmin(
            full_name="BharatCliniq Admin",
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
            description="A demo multi-specialty clinic on BharatCliniq platform.",
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
        dict(email="admin@apollodemo.com",    mobile="9000000001", full_name="Clinic Admin",      role="clinic_admin",  password="Admin@123"),
        dict(email="drpriya@apollodemo.com",  mobile="9000000002", full_name="Dr. Priya Sharma",  role="doctor",        password="Doctor@123"),
        dict(email="drrajan@apollodemo.com",  mobile="9000000006", full_name="Dr. Rajan Mehta",   role="doctor",        password="Doctor@123"),
        dict(email="ravi@apollodemo.com",     mobile="9000000003", full_name="Ravi Kumar",        role="receptionist",  password="Reception@123"),
        dict(email="meera@apollodemo.com",    mobile="9000000004", full_name="Meera Patel",       role="pharmacist",    password="Pharmacy@123"),
        dict(email="arjun@apollodemo.com",    mobile="9000000005", full_name="Arjun Singh",       role="lab_tech",      password="Lab@123"),
        dict(email="demo@bharatcliniq.com",   mobile="9000000099", full_name="Dr. Rajesh Kumar",  role="clinic_admin",  password="Demo@1234"),
    ]

    doctor1 = None
    doctor2 = None
    for s in staff_defs:
        existing = db.query(Staff).filter_by(email=s["email"]).first()
        if existing:
            existing.hashed_password = hash_password(s["password"])
            existing.is_active = True
        else:
            new_staff = Staff(
                clinic_id=clinic.id, branch_id=branch_main.id,
                full_name=s["full_name"], email=s["email"], mobile=s["mobile"],
                hashed_password=hash_password(s["password"]),
                role=s["role"], is_active=True,
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
            languages=["English", "Telugu", "Hindi"],
            accepts_online_booking=True, avg_consultation_minutes=15,
        ))

    if doctor2 and not _exists(db, DoctorProfile, staff_id=doctor2.id):
        db.add(DoctorProfile(
            staff_id=doctor2.id, specialty="Cardiology",
            qualification="MBBS, MD, DM (Cardiology)", mci_number="AP-MED-67890",
            experience_years=12, consultation_fee=800,
            bio="Dr. Rajan Mehta is a senior cardiologist.",
            languages=["English", "Telugu", "Hindi"],
            accepts_online_booking=True, avg_consultation_minutes=20,
        ))

    db.commit()

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
        print("  Demo Provider   : demo@bharatcliniq.com / Demo@1234")
        print("=" * 55)
    except Exception as e:
        db.rollback()
        print(f"[seed] FAILED: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
