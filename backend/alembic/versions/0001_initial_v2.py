"""initial v2 schema

Revision ID: 0001_initial_v2
Revises:
Create Date: 2026-05-31
"""
from alembic import op
import sqlalchemy as sa

revision = '0001_initial_v2'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('platform_admins',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('full_name', sa.String(200), nullable=False),
        sa.Column('email', sa.String(150), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )

    op.create_table('clinics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('specialty', sa.String(200)),
        sa.Column('description', sa.Text()),
        sa.Column('phone', sa.String(20)),
        sa.Column('email', sa.String(150)),
        sa.Column('address', sa.Text()),
        sa.Column('city', sa.String(100)),
        sa.Column('state', sa.String(100)),
        sa.Column('pincode', sa.String(10)),
        sa.Column('google_maps_url', sa.Text()),
        sa.Column('logo_url', sa.String(500)),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('is_verified', sa.Boolean(), server_default='false'),
        sa.Column('subscription_plan', sa.String(20), server_default='free'),
        sa.Column('subscription_status', sa.String(20), server_default='active'),
        sa.Column('subscription_expires_at', sa.DateTime()),
        sa.Column('subscription_expiry', sa.DateTime()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
    )

    op.create_table('branches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('address', sa.Text()),
        sa.Column('city', sa.String(100)),
        sa.Column('state', sa.String(100)),
        sa.Column('phone', sa.String(20)),
        sa.Column('email', sa.String(150)),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('patient_users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('full_name', sa.String(200), nullable=False),
        sa.Column('mobile', sa.String(20), nullable=False),
        sa.Column('email', sa.String(150)),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('preferred_language', sa.String(20), server_default='en'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('is_verified', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('mobile'),
        sa.UniqueConstraint('email'),
    )

    op.create_table('staff',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id')),
        sa.Column('full_name', sa.String(200), nullable=False),
        sa.Column('email', sa.String(150)),
        sa.Column('mobile', sa.String(20)),
        sa.Column('phone', sa.String(20)),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('role', sa.String(30), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('avatar_url', sa.String(500)),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('mobile'),
    )

    op.create_table('doctor_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('staff_id', sa.Integer(), sa.ForeignKey('staff.id'), nullable=False),
        sa.Column('clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('specialty', sa.String(200)),
        sa.Column('qualification', sa.Text()),
        sa.Column('mci_number', sa.String(100)),
        sa.Column('experience_years', sa.Integer(), server_default='0'),
        sa.Column('consultation_fee', sa.Numeric(10, 2), server_default='500'),
        sa.Column('bio', sa.Text()),
        sa.Column('languages', sa.String(500)),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('telehealth_enabled', sa.Boolean(), server_default='false'),
        sa.Column('telehealth_fee', sa.Numeric(10, 2)),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('staff_id'),
    )

    op.create_table('doctor_schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('doctor_id', sa.Integer(), sa.ForeignKey('doctor_profiles.id'), nullable=False),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id')),
        sa.Column('day_of_week', sa.String(10), nullable=False),
        sa.Column('start_time', sa.String(8), nullable=False),
        sa.Column('end_time', sa.String(8), nullable=False),
        sa.Column('slot_minutes', sa.Integer(), server_default='15'),
        sa.Column('max_patients', sa.Integer(), server_default='20'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('patients',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id')),
        sa.Column('portal_user_id', sa.Integer(), sa.ForeignKey('patient_users.id')),
        sa.Column('uhid', sa.String(50)),
        sa.Column('bh_id', sa.String(50)),
        sa.Column('full_name', sa.String(200), nullable=False),
        sa.Column('date_of_birth', sa.Date()),
        sa.Column('gender', sa.String(10)),
        sa.Column('mobile', sa.String(20)),
        sa.Column('email', sa.String(150)),
        sa.Column('address', sa.Text()),
        sa.Column('city', sa.String(100)),
        sa.Column('state', sa.String(100)),
        sa.Column('pincode', sa.String(10)),
        sa.Column('blood_group', sa.String(5)),
        sa.Column('allergies', sa.Text()),
        sa.Column('emergency_contact_name', sa.String(200)),
        sa.Column('emergency_contact_phone', sa.String(20)),
        sa.Column('abha_id', sa.String(20)),
        sa.Column('abha_linked', sa.Boolean(), server_default='false'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('online_bookings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id')),
        sa.Column('doctor_id', sa.Integer(), sa.ForeignKey('doctor_profiles.id')),
        sa.Column('patient_user_id', sa.Integer(), sa.ForeignKey('patient_users.id')),
        sa.Column('patient_name', sa.String(200), nullable=False),
        sa.Column('patient_mobile', sa.String(20), nullable=False),
        sa.Column('patient_email', sa.String(150)),
        sa.Column('booking_date', sa.Date(), nullable=False),
        sa.Column('booking_time', sa.String(8), nullable=False),
        sa.Column('reason', sa.Text()),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('confirmation_code', sa.String(20)),
        sa.Column('notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('appointments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id')),
        sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('doctor_id', sa.Integer(), sa.ForeignKey('doctor_profiles.id'), nullable=False),
        sa.Column('staff_id', sa.Integer(), sa.ForeignKey('staff.id')),
        sa.Column('appointment_date', sa.Date(), nullable=False),
        sa.Column('appointment_time', sa.String(8), nullable=False),
        sa.Column('token_number', sa.Integer()),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('mode', sa.String(50), server_default='offline'),
        sa.Column('reason', sa.Text()),
        sa.Column('notes', sa.Text()),
        sa.Column('fee', sa.Numeric(10, 2)),
        sa.Column('online_booking_id', sa.Integer(), sa.ForeignKey('online_bookings.id')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('vitals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('appointment_id', sa.Integer(), sa.ForeignKey('appointments.id')),
        sa.Column('blood_pressure_systolic', sa.Integer()),
        sa.Column('blood_pressure_diastolic', sa.Integer()),
        sa.Column('pulse_rate', sa.Integer()),
        sa.Column('temperature', sa.Numeric(4, 1)),
        sa.Column('weight_kg', sa.Numeric(5, 2)),
        sa.Column('height_cm', sa.Numeric(5, 2)),
        sa.Column('oxygen_saturation', sa.Integer()),
        sa.Column('blood_sugar', sa.Numeric(6, 2)),
        sa.Column('recorded_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('soap_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('appointment_id', sa.Integer(), sa.ForeignKey('appointments.id'), nullable=False),
        sa.Column('subjective', sa.Text()),
        sa.Column('objective', sa.Text()),
        sa.Column('assessment', sa.Text()),
        sa.Column('plan', sa.Text()),
        sa.Column('diagnosis_codes', sa.JSON()),
        sa.Column('follow_up_days', sa.Integer()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('medicines',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id')),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('generic_name', sa.String(200)),
        sa.Column('category', sa.String(100)),
        sa.Column('form', sa.String(50)),
        sa.Column('strength', sa.String(50)),
        sa.Column('manufacturer', sa.String(200)),
        sa.Column('unit_price', sa.Numeric(10, 2)),
        sa.Column('stock_quantity', sa.Integer(), server_default='0'),
        sa.Column('reorder_level', sa.Integer(), server_default='10'),
        sa.Column('expiry_date', sa.Date()),
        sa.Column('batch_number', sa.String(50)),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('prescriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('appointment_id', sa.Integer(), sa.ForeignKey('appointments.id')),
        sa.Column('prescribed_by', sa.Integer(), sa.ForeignKey('staff.id')),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('dispensed_at', sa.DateTime()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('prescription_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('prescription_id', sa.Integer(), sa.ForeignKey('prescriptions.id'), nullable=False),
        sa.Column('medicine_id', sa.Integer(), sa.ForeignKey('medicines.id')),
        sa.Column('medicine_name', sa.String(200)),
        sa.Column('dosage', sa.String(100)),
        sa.Column('frequency', sa.String(100)),
        sa.Column('duration', sa.String(100)),
        sa.Column('instructions', sa.Text()),
        sa.Column('quantity_prescribed', sa.Integer()),
        sa.Column('quantity_dispensed', sa.Integer()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('lab_tests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id')),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('code', sa.String(50)),
        sa.Column('category', sa.String(100)),
        sa.Column('price', sa.Numeric(10, 2)),
        sa.Column('normal_range', sa.String(200)),
        sa.Column('unit', sa.String(50)),
        sa.Column('turnaround_hours', sa.Integer()),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('lab_orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('appointment_id', sa.Integer(), sa.ForeignKey('appointments.id')),
        sa.Column('ordered_by', sa.Integer(), sa.ForeignKey('staff.id')),
        sa.Column('status', sa.String(50), server_default='ordered'),
        sa.Column('sample_collected_at', sa.DateTime()),
        sa.Column('notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('lab_order_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('lab_orders.id'), nullable=False),
        sa.Column('test_id', sa.Integer(), sa.ForeignKey('lab_tests.id')),
        sa.Column('test_name', sa.String(200)),
        sa.Column('result_value', sa.Text()),
        sa.Column('result_notes', sa.Text()),
        sa.Column('is_abnormal', sa.Boolean(), server_default='false'),
        sa.Column('completed_at', sa.DateTime()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('imaging_orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('appointment_id', sa.Integer(), sa.ForeignKey('appointments.id')),
        sa.Column('ordered_by', sa.Integer(), sa.ForeignKey('staff.id')),
        sa.Column('modality', sa.String(50)),
        sa.Column('body_part', sa.String(200)),
        sa.Column('clinical_notes', sa.Text()),
        sa.Column('report', sa.Text()),
        sa.Column('report_url', sa.String(500)),
        sa.Column('status', sa.String(50), server_default='ordered'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('invoices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id')),
        sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('appointment_id', sa.Integer(), sa.ForeignKey('appointments.id')),
        sa.Column('invoice_number', sa.String(50)),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('subtotal', sa.Numeric(10, 2), server_default='0'),
        sa.Column('discount', sa.Numeric(10, 2), server_default='0'),
        sa.Column('tax', sa.Numeric(10, 2), server_default='0'),
        sa.Column('total', sa.Numeric(10, 2), server_default='0'),
        sa.Column('amount_paid', sa.Numeric(10, 2), server_default='0'),
        sa.Column('payment_method', sa.String(50)),
        sa.Column('notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('paid_at', sa.DateTime()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('invoice_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('invoice_id', sa.Integer(), sa.ForeignKey('invoices.id'), nullable=False),
        sa.Column('description', sa.String(500)),
        sa.Column('item_type', sa.String(50)),
        sa.Column('quantity', sa.Integer(), server_default='1'),
        sa.Column('unit_price', sa.Numeric(10, 2)),
        sa.Column('total', sa.Numeric(10, 2)),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('patient_referrals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('from_clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('from_doctor_id', sa.Integer(), sa.ForeignKey('doctor_profiles.id')),
        sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('appointment_id', sa.Integer(), sa.ForeignKey('appointments.id')),
        sa.Column('to_clinic_id', sa.Integer(), sa.ForeignKey('clinics.id')),
        sa.Column('to_doctor_id', sa.Integer(), sa.ForeignKey('doctor_profiles.id')),
        sa.Column('reason', sa.Text()),
        sa.Column('urgency', sa.String(50)),
        sa.Column('clinical_notes', sa.Text()),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('referral_code', sa.String(50)),
        sa.Column('response_notes', sa.Text()),
        sa.Column('responded_at', sa.DateTime()),
        sa.Column('completed_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('doctor_ratings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('doctor_id', sa.Integer(), sa.ForeignKey('doctor_profiles.id'), nullable=False),
        sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('appointment_id', sa.Integer(), sa.ForeignKey('appointments.id')),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('review', sa.Text()),
        sa.Column('is_visible', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('doctor_ratings')
    op.drop_table('patient_referrals')
    op.drop_table('invoice_items')
    op.drop_table('invoices')
    op.drop_table('imaging_orders')
    op.drop_table('lab_order_items')
    op.drop_table('lab_orders')
    op.drop_table('lab_tests')
    op.drop_table('prescription_items')
    op.drop_table('prescriptions')
    op.drop_table('medicines')
    op.drop_table('soap_notes')
    op.drop_table('vitals')
    op.drop_table('appointments')
    op.drop_table('online_bookings')
    op.drop_table('patients')
    op.drop_table('doctor_schedules')
    op.drop_table('doctor_profiles')
    op.drop_table('staff')
    op.drop_table('patient_users')
    op.drop_table('branches')
    op.drop_table('clinics')
    op.drop_table('platform_admins')
