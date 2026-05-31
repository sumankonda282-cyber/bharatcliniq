from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.models import Patient


def generate_bhid(db: Session) -> str:
    """
    Generate a GLOBAL BH ID across ALL clinics on the platform.
    Format: BH + 7-digit sequential number
    Example: BH0000001, BH0000002, BH0000003 ...
    One patient = one BH ID for life, regardless of which clinic they visit.
    """
    last = (
        db.query(Patient)
        .filter(Patient.uhid.like("BH%"))
        .order_by(Patient.id.desc())
        .first()
    )
    if last and last.uhid and last.uhid.startswith("BH"):
        try:
            seq = int(last.uhid[2:]) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    return f"BH{seq:07d}"


# Keep old name as alias so existing code doesn't break
def generate_uhid(db: Session, clinic_id: int = None) -> str:
    return generate_bhid(db)
