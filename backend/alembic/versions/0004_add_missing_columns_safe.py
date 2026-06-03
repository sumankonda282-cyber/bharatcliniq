"""Add missing columns safely with IF NOT EXISTS

Revision ID: 0004_add_missing_columns_safe
Revises: 0003_add_guardian_fields_to_patients
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

revision = '0004_add_missing_columns_safe'
down_revision = '0002_add_disclosure_pin'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # patient_users — columns added in 0002 (disclosure_pin) that may be missing
    conn.execute(sa.text("ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS otp_token_expiry TIMESTAMP WITHOUT TIME ZONE"))
    conn.execute(sa.text("ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS disclosure_pin VARCHAR(255)"))
    conn.execute(sa.text("ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS disclosure_pin_plain VARCHAR(10)"))
    conn.execute(sa.text("ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS disclosure_pin_expiry TIMESTAMP WITHOUT TIME ZONE"))
    conn.execute(sa.text("ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(20) DEFAULT 'en'"))
    conn.execute(sa.text("ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE"))
    conn.execute(sa.text("ALTER TABLE patient_users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1"))

    # patients — columns added in 0003 (guardian fields) that may be missing
    conn.execute(sa.text("ALTER TABLE patients ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(200)"))
    conn.execute(sa.text("ALTER TABLE patients ADD COLUMN IF NOT EXISTS guardian_mobile VARCHAR(20)"))

    # appointments — telehealth room column
    conn.execute(sa.text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telehealth_room VARCHAR(100)"))


def downgrade():
    pass
