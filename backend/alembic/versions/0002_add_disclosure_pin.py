"""add disclosure pin to patient_users

Revision ID: 0002_add_disclosure_pin
Revises: 0001_initial_v2
Create Date: 2026-05-31
"""
from alembic import op
import sqlalchemy as sa

revision = '0002_add_disclosure_pin'
down_revision = '0001_initial_v2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('patient_users', sa.Column('disclosure_pin', sa.String(255), nullable=True))
    op.add_column('patient_users', sa.Column('disclosure_pin_plain', sa.String(10), nullable=True))


def downgrade():
    op.drop_column('patient_users', 'disclosure_pin_plain')
    op.drop_column('patient_users', 'disclosure_pin')
