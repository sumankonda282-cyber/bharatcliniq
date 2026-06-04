#!/bin/bash
set -e

echo "[startup] Applying safe column additions (idempotent)..."
python -c "
from sqlalchemy import text
from app.db.session import engine

safe_cols = [
    \"ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS otp_token_expiry TIMESTAMP WITHOUT TIME ZONE\",
    \"ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS disclosure_pin VARCHAR(255)\",
    \"ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS disclosure_pin_expiry TIMESTAMP WITHOUT TIME ZONE\",
    \"ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(20) DEFAULT 'en'\",
    \"ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE\",
    \"ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1\",
    \"ALTER TABLE patients ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(200)\",
    \"ALTER TABLE patients ADD COLUMN IF NOT EXISTS guardian_mobile VARCHAR(20)\",
    \"ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telehealth_room VARCHAR(100)\",
    \"ALTER TABLE staff ADD COLUMN IF NOT EXISTS username VARCHAR(30)\",
    \"ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT FALSE\",
    \"ALTER TABLE staff ADD COLUMN IF NOT EXISTS temp_pw_expiry TIMESTAMP WITHOUT TIME ZONE\",
    \"ALTER TABLE staff ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1\",
    \"ALTER TABLE staff ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0\",
    \"ALTER TABLE staff ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITHOUT TIME ZONE\",
    \"UPDATE staff SET is_first_login = FALSE WHERE is_first_login IS NULL\",
    \"ALTER TABLE clinics ADD COLUMN IF NOT EXISTS bridge_api_key VARCHAR(64)\",
    "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS brand_name VARCHAR(200)",
    \"ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS input_mode VARCHAR(20) DEFAULT 'type'\",
    "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS brand_color VARCHAR(20)",
    \"CREATE TABLE IF NOT EXISTS lab_orders (id SERIAL PRIMARY KEY, order_id VARCHAR(20) UNIQUE NOT NULL, clinic_id INTEGER REFERENCES clinics(id), patient_id INTEGER REFERENCES patients(id), appointment_id INTEGER REFERENCES appointments(id), ordered_by INTEGER REFERENCES staff(id), test_names JSONB DEFAULT '[]', clinical_notes TEXT, priority VARCHAR(20) DEFAULT 'routine', specimen_type VARCHAR(100), status VARCHAR(30) DEFAULT 'pending', collected_at TIMESTAMP, abha_id VARCHAR(50), created_at TIMESTAMP DEFAULT NOW())\",
    \"CREATE TABLE IF NOT EXISTS lab_results (id SERIAL PRIMARY KEY, order_id INTEGER UNIQUE REFERENCES lab_orders(id), raw_format VARCHAR(20), observations JSONB DEFAULT '[]', fhir_report JSONB, pdf_b64 TEXT, interpretation TEXT, status VARCHAR(30) DEFAULT 'pending_review', signed_by INTEGER REFERENCES staff(id), signed_at TIMESTAMP, report_hash VARCHAR(64), source VARCHAR(30) DEFAULT 'bridge', created_at TIMESTAMP DEFAULT NOW())\",
    \"CREATE TABLE IF NOT EXISTS imaging_orders (id SERIAL PRIMARY KEY, order_id VARCHAR(20) UNIQUE NOT NULL, clinic_id INTEGER REFERENCES clinics(id), patient_id INTEGER REFERENCES patients(id), appointment_id INTEGER REFERENCES appointments(id), ordered_by INTEGER REFERENCES staff(id), modality VARCHAR(10), body_part VARCHAR(100), study_description TEXT, clinical_notes TEXT, priority VARCHAR(20) DEFAULT 'routine', status VARCHAR(30) DEFAULT 'pending', abha_id VARCHAR(50), created_at TIMESTAMP DEFAULT NOW())\",
    \"CREATE TABLE IF NOT EXISTS imaging_results (id SERIAL PRIMARY KEY, order_id INTEGER UNIQUE REFERENCES imaging_orders(id), modality VARCHAR(10), study_uid VARCHAR(200), series_uid VARCHAR(200), dicom_metadata JSONB, fhir_report JSONB, key_image_paths JSONB DEFAULT '[]', pdf_b64 TEXT, findings TEXT, impression TEXT, status VARCHAR(30) DEFAULT 'pending_review', signed_by INTEGER REFERENCES staff(id), signed_at TIMESTAMP, report_hash VARCHAR(64), source VARCHAR(30) DEFAULT 'bridge', created_at TIMESTAMP DEFAULT NOW())\",
    \"CREATE TABLE IF NOT EXISTS unmatched_results (id SERIAL PRIMARY KEY, clinic_id INTEGER REFERENCES clinics(id), source VARCHAR(30), raw_format VARCHAR(20), parsed_data JSONB, patient_hint VARCHAR(200), resolved BOOLEAN DEFAULT FALSE, resolved_by INTEGER REFERENCES staff(id), resolved_at TIMESTAMP, linked_lab_order_id INTEGER REFERENCES lab_orders(id), linked_imaging_order_id INTEGER REFERENCES imaging_orders(id), created_at TIMESTAMP DEFAULT NOW())\",
    "CREATE TABLE IF NOT EXISTS billing_waiver_logs (id SERIAL PRIMARY KEY, invoice_id INTEGER REFERENCES invoices(id), clinic_id INTEGER REFERENCES clinics(id), waived_by INTEGER REFERENCES staff(id), waiver_amount NUMERIC(10,2) NOT NULL, reason VARCHAR(50) NOT NULL, notes TEXT, created_at TIMESTAMP DEFAULT NOW())",
    \"ALTER TABLE medicines ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20)\",
    \"ALTER TABLE medicines ADD COLUMN IF NOT EXISTS schedule VARCHAR(10)\",
    \"ALTER TABLE medicines ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2)\",
    \"ALTER TABLE medicines ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2)\",
    \"ALTER TABLE clinics ADD COLUMN IF NOT EXISTS drug_license_number VARCHAR(100)\",
    \"ALTER TABLE clinics ADD COLUMN IF NOT EXISTS gstin VARCHAR(20)\",
    \"ALTER TABLE invoices ALTER COLUMN patient_id DROP NOT NULL\",
    \"ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200)\",
    \"ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_mobile VARCHAR(20)\",
    \"ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sale_type VARCHAR(20) DEFAULT 'prescription'\",
    \"ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(10,2) DEFAULT 0\",
    \"ALTER TABLE invoices ADD COLUMN IF NOT EXISTS prescription_ref VARCHAR(100)\",
    \"ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20)\",
    \"ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2)\",
    \"ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(10,2)\",
    \"ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS medicine_id INTEGER REFERENCES medicines(id)\",
    \"ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0\",
    \"ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2)\",
    \"CREATE TABLE IF NOT EXISTS stock_transactions (id SERIAL PRIMARY KEY, clinic_id INTEGER REFERENCES clinics(id), branch_id INTEGER REFERENCES branches(id), medicine_id INTEGER REFERENCES medicines(id) NOT NULL, transaction_type VARCHAR(20) NOT NULL, quantity INTEGER NOT NULL, quantity_before INTEGER NOT NULL, quantity_after INTEGER NOT NULL, batch_number VARCHAR(50), expiry_date DATE, unit_cost NUMERIC(10,2), supplier_name VARCHAR(200), notes TEXT, performed_by INTEGER REFERENCES staff(id), created_at TIMESTAMP DEFAULT NOW())\",
]
try:
    with engine.begin() as conn:
        for sql in safe_cols:
            conn.execute(text(sql))
    print('[startup] Safe column additions complete.')
except Exception as e:
    print(f'[startup] Safe column additions failed: {e}')
"

echo "[startup] Syncing database schema..."
# Try upgrade; if it fails due to existing tables, stamp head and retry
alembic upgrade head || {
    echo "[startup] Migration failed (tables may already exist) — stamping head..."
    alembic stamp head
    alembic upgrade head || echo "[startup] Upgrade after stamp also failed — continuing anyway"
}

echo "[startup] Seeding database..."
python seed.py || echo "[startup] Seed failed (non-fatal) — continuing with existing data"

echo "[startup] Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1
