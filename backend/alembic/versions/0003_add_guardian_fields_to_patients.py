"""add guardian fields to patients

Revision ID: 0003_guardian_fields
Revises: 0006_staff_credentials
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

revision = '0003_guardian_fields'
down_revision = '0006_staff_credentials'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE patients ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(200)")
    op.execute("ALTER TABLE patients ADD COLUMN IF NOT EXISTS guardian_mobile VARCHAR(20)")


def downgrade():
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS guardian_name")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS guardian_mobile")
