"""
BharatCliniq Seed Script
Run: python seed.py
Creates: platform admin, demo clinic, branches, staff, patients, medicines, lab tests
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal, engine, Base
from app.models.models import *
from app.core.security import hash_password
from datetime import date, datetime, timedelta
import re

def slugify(text):
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return re.sub(r'^-+|-+$', '', text)


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if db.query(PlatformAdmin).first():
            print("Already seeded. Skipping.")
            db.close()
            return

        print("Seeding BharatCliniq database...")

        # ── Platform Superadmin ───────────────────────────────────────────
        platform_admin = PlatformAdmin(
            full_name="BharatCliniq Admin",
            email="superadmin@bharathealth.com",
            hashed_password=hash_password("SuperAdmin@123"),
        )
        db.add(platform_admin)
        db.flush()
        print("  ✓ Platform admin created")

        # ── Demo Clinic ───────────────────────────────────────────────────
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
        db.flush()

        # ── Branches ──────────────────────────────────────────────────────
        branch_main = Branch(
            clinic_id=clinic.id,
            name="Main Branch - Jubilee Hills",
            address="123 Jubilee Hills Road",
            city="Hyderabad",
            state="Telangana",
            pincode="500033",
            phone="040-12345678",
            email="main@apollodemo.com",
        )
        branch_north = Branch(
            clinic_id=clinic.id,
            name="North Branch - Secunderabad",
            address="45 MG Road, Secunderabad",
            city="Hyderabad",
            state="Telangana",
            pincode="500003",
            phone="040-87654321",
            email="north@apollodemo.com",
        )
        db.add_all([branch_main, branch_north])
        db.flush()
        print("  ✓ Clinic + 2 branches created")

        # ── Staff ─────────────────────────────────────────────────────────
        clinic_admin = Staff(
            clinic_id=clinic.id, branch_id=branch_main.id,
            full_name="Clinic Admin",
            email="admin@apollodemo.com",
            mobile="9000000001",
            hashed_password=hash_password("Admin@123"),
            role='clinic_admin',
        )
        doctor1 = Staff(
            clinic_id=clinic.id, branch_id=branch_main.id,
            full_name="Dr. Priya Sharma",
            email="drpriya@apollodemo.com",
            mobile="9000000002",
            hashed_password=hash_password("Doctor@123"),
            role='doctor',
        )
        doctor2 = Staff(
            clinic_id=clinic.id, branch_id=branch_main.id,
            full_name="Dr. Rajan Mehta",
            email="drrajan@apollodemo.com",
            mobile="9000000006",
            hashed_password=hash_password("Doctor@123"),
            role='doctor',
        )
        receptionist = Staff(
            clinic_id=clinic.id, branch_id=branch_main.id,
            full_name="Ravi Kumar",
            email="ravi@apollodemo.com",
            mobile="9000000003",
            hashed_password=hash_password("Reception@123"),
            role='receptionist',
        )
        pharmacist = Staff(
            clinic_id=clinic.id, branch_id=branch_main.id,
            full_name="Meera Patel",
            email="meera@apollodemo.com",
            mobile="9000000004",
            hashed_password=hash_password("Pharmacy@123"),
            role='pharmacist',
        )
        lab_tech = Staff(
            clinic_id=clinic.id, branch_id=branch_main.id,
            full_name="Arjun Singh",
            email="arjun@apollodemo.com",
            mobile="9000000005",
            hashed_password=hash_password("Lab@123"),
            role='lab_tech',
        )
        
        demo_doctor = Staff(
            clinic_id=clinic.id, branch_id=branch_main.id,
            full_name="Dr. Rajesh Kumar",
            email="demo@bharatcliniq.com",
            mobile="9000000099",
            hashed_password=hash_password("Demo@1234"),
            role='clinic_admin',
            is_active=True,
        )
        db.add_all([demo_doctor, clinic_admin, doctor1, doctor2, receptionist, pharmacist, lab_tech])
        db.flush()

        # ── Doctor Profiles ───────────────────────────────────────────────
        dp1 = DoctorProfile(
            staff_id=doctor1.id,
            specialty="General Medicine",
            qualification="MBBS, MD (Internal Medicine)",
            mci_number="AP-MED-12345",
            experience_years=8,
            consultation_fee=500,
            
            bio="Dr. Priya Sharma is an experienced general physician specializing in diabetes and hypertension management.",
            languages=["English", "Telugu", "Hindi"],
            accepts_online_booking=True,
            avg_consultation_minutes=15,
        )
        dp2 = DoctorProfile(
            staff_id=doctor2.id,
            specialty="Cardiology",
            qualification="MBBS, MD, DM (Cardiology)",
            mci_number="AP-MED-67890",
            experience_years=12,
            consultation_fee=800,
            
            bio="Dr. Rajan Mehta is a senior cardiologist with expertise in interventional cardiology.",
            languages=["English", "Telugu", "Hindi"],
            accepts_online_booking=True,
            avg_consultation_minutes=20,
        )
        db.add_all([dp1, dp2])
        db.flush()

        # ── Doctor Schedules (for online booking slots) ───────────────────
        days = [DayOfWeek.monday, DayOfWeek.tuesday, DayOfWeek.wednesday,
                DayOfWeek.thursday, DayOfWeek.friday, DayOfWeek.saturday]
        for day in days:
            db.add(DoctorSchedule(
                doctor_id=dp1.id, branch_id=branch_main.id,
                day_of_week=day, start_time="09:00", end_time="13:00",
                slot_minutes=15, max_patients=16
            ))
            db.add(DoctorSchedule(
                doctor_id=dp1.id, branch_id=branch_main.id,
                day_of_week=day, start_time="17:00", end_time="20:00",
                slot_minutes=15, max_patients=12
            )) if day not in [DayOfWeek.saturday] else None
            db.add(DoctorSchedule(
                doctor_id=dp2.id, branch_id=branch_main.id,
                day_of_week=day, start_time="10:00", end_time="14:00",
                slot_minutes=20, max_patients=12
            ))
        db.flush()
        print("  ✓ Staff + doctor profiles + schedules created")

        # ── Demo Patients ─────────────────────────────────────────────────
        p1 = Patient(
            clinic_id=clinic.id, branch_id=branch_main.id,
            uhid="BH202400001",
            full_name="Amit Verma",
            date_of_birth=date(1985, 5, 20),
            gender='male', mobile="9111111111",
            email="amit.verma@email.com",
            blood_group="B+", city="Hyderabad", state="Telangana",
        )
        p2 = Patient(
            clinic_id=clinic.id, branch_id=branch_main.id,
            uhid="BH202400002",
            full_name="Sunita Devi",
            date_of_birth=date(1992, 8, 15),
            gender='female', mobile="9222222222",
            blood_group="O+", city="Hyderabad", state="Telangana",
            allergies="Penicillin",
        )
        db.add_all([p1, p2])
        db.flush()
        print("  ✓ 2 demo patients created")

        # ── Medicines ─────────────────────────────────────────────────────
        medicines = [
            Medicine(branch_id=branch_main.id, name="Paracetamol 500mg",
                     generic_name="Paracetamol", category="Analgesic",
                     form="Tablet", strength="500mg", unit_price=2.50,
                     stock_quantity=500, reorder_level=50),
            Medicine(branch_id=branch_main.id, name="Amoxicillin 500mg",
                     generic_name="Amoxicillin", category="Antibiotic",
                     form="Capsule", strength="500mg", unit_price=12.00,
                     stock_quantity=200, reorder_level=30),
            Medicine(branch_id=branch_main.id, name="Metformin 500mg",
                     generic_name="Metformin", category="Antidiabetic",
                     form="Tablet", strength="500mg", unit_price=3.50,
                     stock_quantity=300, reorder_level=40),
            Medicine(branch_id=branch_main.id, name="Atorvastatin 10mg",
                     generic_name="Atorvastatin", category="Cardiac",
                     form="Tablet", strength="10mg", unit_price=8.00,
                     stock_quantity=150, reorder_level=20),
            Medicine(branch_id=branch_main.id, name="Omeprazole 20mg",
                     generic_name="Omeprazole", category="Antacid",
                     form="Capsule", strength="20mg", unit_price=5.00,
                     stock_quantity=180, reorder_level=25),
            Medicine(branch_id=branch_main.id, name="Cetirizine 10mg",
                     generic_name="Cetirizine", category="Antihistamine",
                     form="Tablet", strength="10mg", unit_price=4.00,
                     stock_quantity=200, reorder_level=25),
            Medicine(branch_id=branch_main.id, name="Amlodipine 5mg",
                     generic_name="Amlodipine", category="Antihypertensive",
                     form="Tablet", strength="5mg", unit_price=6.50,
                     stock_quantity=120, reorder_level=20),
        ]
        db.add_all(medicines)

        # ── Lab Tests ─────────────────────────────────────────────────────
        tests = [
            LabTest(branch_id=branch_main.id, name="Complete Blood Count",
                    code="CBC", category="Haematology", price=250,
                    normal_range="Various", turnaround_hours=4),
            LabTest(branch_id=branch_main.id, name="Blood Glucose Fasting",
                    code="FBS", category="Biochemistry", price=80,
                    normal_range="70-100", unit="mg/dL", turnaround_hours=2),
            LabTest(branch_id=branch_main.id, name="HbA1c",
                    code="HBA1C", category="Biochemistry", price=350,
                    normal_range="< 5.7", unit="%", turnaround_hours=6),
            LabTest(branch_id=branch_main.id, name="Lipid Profile",
                    code="LIPID", category="Biochemistry", price=400,
                    normal_range="Various", turnaround_hours=4),
            LabTest(branch_id=branch_main.id, name="Urine Routine",
                    code="URE", category="Urology", price=60,
                    normal_range="Normal", turnaround_hours=2),
            LabTest(branch_id=branch_main.id, name="Thyroid Profile (T3/T4/TSH)",
                    code="TFT", category="Endocrinology", price=500,
                    normal_range="Various", turnaround_hours=6),
            LabTest(branch_id=branch_main.id, name="ECG",
                    code="ECG", category="Cardiology", price=150,
                    normal_range="Normal sinus rhythm", turnaround_hours=1),
        ]
        db.add_all(tests)

        db.commit()
        print("\n  SEED COMPLETE!")
        print("=" * 55)
        print("  LOGIN CREDENTIALS")
        print("=" * 55)
        print("  Platform Admin  : superadmin@bharathealth.com / SuperAdmin@123")
        print("  Clinic Admin    : admin@apollodemo.com / Admin@123")
        print("  Doctor (Priya)  : drpriya@apollodemo.com / Doctor@123")
        print("  Doctor (Rajan)  : drrajan@apollodemo.com / Doctor@123")
        print("  Receptionist    : ravi@apollodemo.com / Reception@123")
        print("  Pharmacist      : meera@apollodemo.com / Pharmacy@123")
        print("  Lab Technician  : arjun@apollodemo.com / Lab@123")
        print("=" * 55)
        print("  Demo patients: mobile 9111111111 / 9222222222")
        print("  Public clinic URL: /api/v1/public/clinics/apollo-demo-clinic")
        print("=" * 55)

    except Exception as e:
        db.rollback()
        print(f"  SEED FAILED: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
