#!/bin/bash
set -e

echo "[startup] Applying safe column additions (idempotent)..."
python -c "
from sqlalchemy import text
from app.db.session import engine

safe_cols = [
    \"ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS otp_token_expiry TIMESTAMP WITHOUT TIME ZONE\",
    \"ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS disclosure_pin VARCHAR(255)\",
    \"ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS disclosure_pin_plain VARCHAR(10)\",
    \"ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS disclosure_pin_expiry TIMESTAMP WITHOUT TIME ZONE\",
    \"ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(20) DEFAULT 'en'\",
    \"ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE\",
    \"ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1\",
    \"ALTER TABLE patients ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(200)\",
    \"ALTER TABLE patients ADD COLUMN IF NOT EXISTS guardian_mobile VARCHAR(20)\",
    \"ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telehealth_room VARCHAR(100)\",
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
