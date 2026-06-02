#!/bin/bash
set -e

echo "[startup] Syncing database schema..."
# If tables already exist, stamp current migration state then upgrade
# This handles the case where DB was created manually without alembic tracking
python -c "
from sqlalchemy import text
from app.db.session import engine
try:
    with engine.connect() as conn:
        result = conn.execute(text(\"SELECT COUNT(*) FROM alembic_version\"))
        count = result.scalar()
        print(f'[startup] alembic_version has {count} row(s)')
except Exception:
    print('[startup] No alembic_version table — will let alembic create it')
"

# Try upgrade; if it fails due to existing tables, stamp head and retry
alembic upgrade head || {
    echo "[startup] Migration failed (tables may already exist) — stamping head..."
    alembic stamp head
    alembic upgrade head
}

echo "[startup] Seeding database..."
python seed.py

echo "[startup] Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1
