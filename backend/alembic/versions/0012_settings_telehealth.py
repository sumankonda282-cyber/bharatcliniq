"""platform_settings + telehealth_sessions + telehealth_session_events

Revision ID: 0012_settings_telehealth
Revises: 0011_clinic_association
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = '0012_settings_telehealth'
down_revision = '0011_clinic_association'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS platform_settings (
            key        VARCHAR(100) PRIMARY KEY,
            value      JSONB NOT NULL DEFAULT '{}',
            updated_at TIMESTAMP DEFAULT NOW(),
            updated_by INTEGER REFERENCES platform_admins(id)
        )
    """))
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS telehealth_sessions (
            id              SERIAL PRIMARY KEY,
            appointment_id  INTEGER NOT NULL UNIQUE REFERENCES appointments(id),
            clinic_id       INTEGER NOT NULL REFERENCES clinics(id),
            room_name       VARCHAR(100) NOT NULL,
            state           VARCHAR(30) NOT NULL DEFAULT 'scheduled',
            slot_start      TIMESTAMP NOT NULL,
            slot_end        TIMESTAMP NOT NULL,
            room_expires_at TIMESTAMP,
            doctor_first_joined_at  TIMESTAMP,
            patient_first_joined_at TIMESTAMP,
            completed_at    TIMESTAMP,
            completed_by    INTEGER REFERENCES staff(id),
            reopen_count    INTEGER DEFAULT 0,
            reopened_until  TIMESTAMP,
            created_at      TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_telehealth_sessions_state ON telehealth_sessions(state)"
    ))
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS telehealth_session_events (
            id         SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES telehealth_sessions(id),
            event_type VARCHAR(50) NOT NULL,
            actor_type VARCHAR(20),
            actor_id   INTEGER,
            payload    JSONB,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_telehealth_session_events_session ON telehealth_session_events(session_id)"
    ))


def downgrade():
    op.execute("DROP TABLE IF EXISTS telehealth_session_events")
    op.execute("DROP TABLE IF EXISTS telehealth_sessions")
    op.execute("DROP TABLE IF EXISTS platform_settings")
