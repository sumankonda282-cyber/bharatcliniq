"""Add missing indexes on FK columns and frequently filtered columns

Revision ID: 0007_add_missing_indexes
Revises: 0006_staff_credentials
Create Date: 2026-06-05
"""
from alembic import op

revision = '0007_add_missing_indexes'
down_revision = '0006_staff_credentials'
branch_labels = None
depends_on = None


def upgrade():
    # Staff
    op.execute("CREATE INDEX IF NOT EXISTS ix_staff_clinic_id ON staff (clinic_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_staff_branch_id ON staff (branch_id)")

    # Doctor profiles
    op.execute("CREATE INDEX IF NOT EXISTS ix_doctor_profiles_clinic_id ON doctor_profiles (clinic_id)")

    # Patients
    op.execute("CREATE INDEX IF NOT EXISTS ix_patients_clinic_id ON patients (clinic_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_patients_branch_id ON patients (branch_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_patients_portal_user_id ON patients (portal_user_id)")

    # Appointments — most queried table in the system
    op.execute("CREATE INDEX IF NOT EXISTS ix_appointments_clinic_id ON appointments (clinic_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_appointments_patient_id ON appointments (patient_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_appointments_doctor_id ON appointments (doctor_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_appointments_appointment_date ON appointments (appointment_date)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_appointments_status ON appointments (status)")
    # Composite: clinic + date (most common dashboard query)
    op.execute("CREATE INDEX IF NOT EXISTS ix_appointments_clinic_date ON appointments (clinic_id, appointment_date)")

    # Lab orders
    op.execute("CREATE INDEX IF NOT EXISTS ix_lab_orders_clinic_id ON lab_orders (clinic_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_lab_orders_patient_id ON lab_orders (patient_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_lab_orders_status ON lab_orders (status)")

    # Imaging orders
    op.execute("CREATE INDEX IF NOT EXISTS ix_imaging_orders_clinic_id ON imaging_orders (clinic_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_imaging_orders_patient_id ON imaging_orders (patient_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_imaging_orders_status ON imaging_orders (status)")

    # Invoices
    op.execute("CREATE INDEX IF NOT EXISTS ix_invoices_clinic_id ON invoices (clinic_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invoices_patient_id ON invoices (patient_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invoices_status ON invoices (status)")

    # BHProfile
    op.execute("CREATE INDEX IF NOT EXISTS ix_bh_profiles_patient_user_id ON bh_profiles (patient_user_id)")

    # Encounters / clinical notes (patient history queries)
    op.execute("CREATE INDEX IF NOT EXISTS ix_encounters_patient_id ON encounters (patient_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_encounters_clinic_id ON encounters (clinic_id)")

    # Prescriptions
    op.execute("CREATE INDEX IF NOT EXISTS ix_prescriptions_patient_id ON prescriptions (patient_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_prescriptions_appointment_id ON prescriptions (appointment_id)")

    # Referrals
    op.execute("CREATE INDEX IF NOT EXISTS ix_referrals_patient_id ON referrals (patient_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_referrals_from_clinic_id ON referrals (from_clinic_id)")


def downgrade():
    indexes = [
        "ix_staff_clinic_id", "ix_staff_branch_id",
        "ix_doctor_profiles_clinic_id",
        "ix_patients_clinic_id", "ix_patients_branch_id", "ix_patients_portal_user_id",
        "ix_appointments_clinic_id", "ix_appointments_patient_id", "ix_appointments_doctor_id",
        "ix_appointments_appointment_date", "ix_appointments_status", "ix_appointments_clinic_date",
        "ix_lab_orders_clinic_id", "ix_lab_orders_patient_id", "ix_lab_orders_status",
        "ix_imaging_orders_clinic_id", "ix_imaging_orders_patient_id", "ix_imaging_orders_status",
        "ix_invoices_clinic_id", "ix_invoices_patient_id", "ix_invoices_status",
        "ix_bh_profiles_patient_user_id",
        "ix_encounters_patient_id", "ix_encounters_clinic_id",
        "ix_prescriptions_patient_id", "ix_prescriptions_appointment_id",
        "ix_referrals_patient_id", "ix_referrals_from_clinic_id",
    ]
    for ix in indexes:
        op.execute(f"DROP INDEX IF EXISTS {ix}")
