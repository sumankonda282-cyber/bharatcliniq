"""
Patient Referral API
Allows doctors to refer patients across clinics on BharatHealth network.
15-day expiry on pending referrals.
"""
import random, string
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.db.session import get_db
from app.core.security import get_current_staff
from app.models.models import (
    PatientReferral, Clinic, DoctorProfile,
    Patient, Staff, Appointment, Prescription, LabOrder,
    SoapNote, PrescriptionItem, LabOrderItem, LabTest
)

router = APIRouter(prefix="/referrals", tags=["referrals"])

REFERRAL_TYPES = ["doctor", "lab", "imaging", "pharmacy"]
EXPIRY_DAYS = 15


def gen_referral_code(db):
    while True:
        code = "REF-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
        if not db.query(PatientReferral).filter(PatientReferral.referral_code == code).first():
            return code


def _auto_expire(db):
    """Mark referrals older than 15 days with no visit as cancelled."""
    cutoff = datetime.utcnow() - timedelta(days=EXPIRY_DAYS)
    db.query(PatientReferral).filter(
        PatientReferral.status == 'pending',
        PatientReferral.created_at < cutoff
    ).update({"status": 'cancelled'})
    db.commit()


@router.post("/")
def create_referral(body: dict, db: Session = Depends(get_db), staff: Staff = Depends(get_current_staff)):
    """Doctor creates a referral. to_clinic_id is optional (can refer to external clinics by name)."""
    patient = db.query(Patient).filter(
        Patient.id == body.get("patient_id"),
        Patient.clinic_id == staff.clinic_id
    ).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    from_doctor = db.query(DoctorProfile).filter(DoctorProfile.staff_id == staff.id).first()
    # Allow clinic_admin to create referrals too
    to_clinic_id = body.get("to_clinic_id")
    if to_clinic_id:
        to_clinic = db.query(Clinic).filter(Clinic.id == to_clinic_id, Clinic.is_active == True).first()
        if not to_clinic:
            raise HTTPException(404, "Target clinic not found on BharatCliniq network")

    referral = PatientReferral(
        from_clinic_id = staff.clinic_id,
        from_doctor_id = from_doctor.id if from_doctor else None,
        patient_id     = body["patient_id"],
        appointment_id = body.get("appointment_id"),
        to_clinic_id   = to_clinic_id,
        to_doctor_id   = body.get("to_doctor_id"),
        reason         = body.get("reason", ""),
        urgency        = body.get("urgency", "routine"),
        clinical_notes = body.get("clinical_notes"),
        referral_code  = gen_referral_code(db),
    )
    db.add(referral)
    db.commit()
    db.refresh(referral)
    return _format(referral, db)


@router.get("/sent")
def get_sent_referrals(
    status: Optional[str] = None,
    month: Optional[str] = None,
    to_clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    staff: Staff = Depends(get_current_staff)
):
    """Referrals sent BY this doctor."""
    _auto_expire(db)
    from_doctor = db.query(DoctorProfile).filter(DoctorProfile.staff_id == staff.id).first()
    if not from_doctor:
        return []

    q = db.query(PatientReferral).filter(PatientReferral.from_doctor_id == from_doctor.id)
    if status:
        q = q.filter(PatientReferral.status == status)
    if to_clinic_id:
        q = q.filter(PatientReferral.to_clinic_id == to_clinic_id)
    if month:
        try:
            y, m = int(month.split("-")[0]), int(month.split("-")[1])
            from datetime import date
            import calendar
            first = date(y, m, 1)
            last  = date(y, m, calendar.monthrange(y, m)[1])
            q = q.filter(PatientReferral.created_at >= first, PatientReferral.created_at <= last)
        except Exception:
            pass

    return [_format(r, db) for r in q.order_by(PatientReferral.created_at.desc()).limit(100).all()]


@router.get("/received")
def get_received_referrals(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    staff: Staff = Depends(get_current_staff)
):
    """Referrals received BY this clinic."""
    _auto_expire(db)
    q = db.query(PatientReferral).filter(PatientReferral.to_clinic_id == staff.clinic_id)
    if status:
        q = q.filter(PatientReferral.status == status)
    return [_format(r, db) for r in q.order_by(PatientReferral.created_at.desc()).limit(100).all()]


@router.get("/performance")
def referral_performance(
    month: Optional[str] = None,
    to_clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    staff: Staff = Depends(get_current_staff)
):
    """Performance dashboard for the referring doctor."""
    _auto_expire(db)
    from_doctor = db.query(DoctorProfile).filter(DoctorProfile.staff_id == staff.id).first()
    if not from_doctor:
        return {"total": 0, "visited": 0, "pending": 0, "expired": 0, "referrals": []}

    q = db.query(PatientReferral).filter(PatientReferral.from_doctor_id == from_doctor.id)
    if to_clinic_id:
        q = q.filter(PatientReferral.to_clinic_id == to_clinic_id)
    if month:
        try:
            y, m = int(month.split("-")[0]), int(month.split("-")[1])
            from datetime import date
            import calendar
            first = date(y, m, 1)
            last  = date(y, m, calendar.monthrange(y, m)[1])
            q = q.filter(PatientReferral.created_at >= first, PatientReferral.created_at <= last)
        except Exception:
            pass

    referrals = q.order_by(PatientReferral.created_at.desc()).all()

    total   = len(referrals)
    visited = sum(1 for r in referrals if r.status == 'completed')
    pending = sum(1 for r in referrals if r.status == 'pending')
    expired = sum(1 for r in referrals if r.status == 'cancelled')

    # Get unique clinics referred to (for filter dropdown)
    clinic_ids = list(set(r.to_clinic_id for r in referrals))
    clinics = db.query(Clinic).filter(Clinic.id.in_(clinic_ids)).all()
    clinic_options = [{"id": c.id, "name": c.name, "city": c.city} for c in clinics]

    return {
        "total":          total,
        "visited":        visited,
        "pending":        pending,
        "expired":        expired,
        "clinic_options": clinic_options,
        "referrals":      [_format(r, db) for r in referrals],
    }


@router.get("/patient/{referral_id}/records")
def get_referred_patient_records(
    referral_id: int,
    db: Session = Depends(get_db),
    staff: Staff = Depends(get_current_staff)
):
    """
    Get patient records for a referral.
    - Referred doctor (to_clinic) can see referring doctor's records IF patient visited.
    - Referring doctor (from_clinic) can see referred doctor's records IF patient visited.
    - No billing shown to either.
    """
    _auto_expire(db)
    referral = db.query(PatientReferral).filter(PatientReferral.id == referral_id).first()
    if not referral:
        raise HTTPException(404, "Referral not found")

    is_from = referral.from_clinic_id == staff.clinic_id
    is_to   = referral.to_clinic_id == staff.clinic_id

    if not is_from and not is_to:
        raise HTTPException(403, "Access denied")

    # Only show records if patient has visited the referred clinic
    if referral.status not in ['completed', 'accepted']:
        raise HTTPException(403, "Patient has not yet visited. Records not accessible.")

    # Referred doctor sees FROM doctor's records
    # Referring doctor sees TO clinic's records
    if is_to:
        source_clinic_id = referral.from_clinic_id
        source_doctor_id = referral.from_doctor_id
    else:
        source_clinic_id = referral.to_clinic_id
        source_doctor_id = None  # any doctor at to_clinic

    patient = db.query(Patient).filter(Patient.id == referral.patient_id).first()

    # Get appointments (no billing)
    appt_q = db.query(Appointment).filter(
        Appointment.patient_id == referral.patient_id,
        Appointment.clinic_id == source_clinic_id,
    )
    if source_doctor_id:
        appt_q = appt_q.filter(Appointment.doctor_id == source_doctor_id)
    appointments = appt_q.order_by(Appointment.appointment_date.desc()).limit(20).all()

    visits = []
    for a in appointments:
        soap = db.query(SoapNote).filter(SoapNote.appointment_id == a.id).first()
        rxs  = db.query(Prescription).filter(Prescription.appointment_id == a.id).all()
        labs = db.query(LabOrder).filter(LabOrder.appointment_id == a.id).all()

        rx_items = []
        for rx in rxs:
            for item in rx.items:
                med = item.medicine
                rx_items.append({
                    "drug":     med.name if med else "Unknown",
                    "dosage":   item.dosage,
                    "frequency": item.frequency,
                    "duration": item.duration,
                })

        lab_items = []
        for lo in labs:
            for item in lo.items:
                test = db.query(LabTest).filter(LabTest.id == item.test_id).first()
                lab_items.append({
                    "test":   test.name if test else "Unknown",
                    "result": item.result_value,
                })

        visits.append({
            "date":        str(a.appointment_date),
            "symptoms":    soap.subjective if soap else a.reason,
            "diagnosis":   soap.assessment if soap else None,
            "plan":        soap.plan if soap else None,
            "prescription": rx_items,
            "lab_orders":  lab_items,
        })

    return {
        "patient": {
            "full_name":      patient.full_name if patient else None,
            "uhid":           patient.uhid if patient else None,
            "gender":         patient.gender if patient else None,
            "blood_group":    patient.blood_group if patient else None,
            "allergies":      patient.allergies if patient else None,
        },
        "referral_code":  referral.referral_code,
        "referral_reason": referral.reason,
        "visits":         visits,
    }


@router.put("/{referral_id}/complete")
def complete_referral(
    referral_id: int,
    body: dict = {},
    db: Session = Depends(get_db),
    staff: Staff = Depends(get_current_staff)
):
    """Mark referral as completed — patient visited."""
    r = db.query(PatientReferral).filter(PatientReferral.id == referral_id).first()
    if not r:
        raise HTTPException(404, "Referral not found")
    if r.from_clinic_id != staff.clinic_id and r.to_clinic_id != staff.clinic_id:
        raise HTTPException(403, "Access denied")
    r.status       = 'completed'
    r.response_notes = body.get("response_notes", r.response_notes)
    r.completed_at = datetime.utcnow()
    db.commit()
    return _format(r, db)


@router.get("/network/clinics")
def list_network_clinics(
    q: str = "",
    db: Session = Depends(get_db),
    staff: Staff = Depends(get_current_staff)
):
    """Search verified BharatCliniq clinics to refer to."""
    query = db.query(Clinic).filter(
        Clinic.is_active == True,
        Clinic.id != staff.clinic_id
    )
    if q:
        query = query.filter(
            Clinic.name.ilike(f"%{q}%") |
            Clinic.city.ilike(f"%{q}%") |
            Clinic.specialty.ilike(f"%{q}%")
        )
    clinics = query.limit(20).all()
    result = []
    for c in clinics:
        doctors = db.query(DoctorProfile).filter(DoctorProfile.staff_id.in_(
            db.query(Staff.id).filter(Staff.clinic_id == c.id, Staff.is_active == True)
        )).all()
        result.append({
            "id":       c.id,
            "name":     c.name,
            "specialty": c.specialty,
            "city":     c.city,
            "state":    c.state,
            "doctors":  [{"id": d.id, "name": d.staff.full_name if d.staff else "Dr.", "specialty": d.specialty} for d in doctors],
        })
    return result


def _format(r: PatientReferral, db=None):
    return {
        "id":             r.id,
        "referral_code":  r.referral_code,
        "status":         r.status or "pending",
        "urgency":        r.urgency,
        "reason":         r.reason,
        "clinical_notes": r.clinical_notes,
        "response_notes": r.response_notes,
        "from_clinic_id": r.from_clinic_id,
        "to_clinic_id":   r.to_clinic_id,
        "from_clinic":    r.from_clinic.name if r.from_clinic else None,
        "to_clinic":      r.to_clinic.name if r.to_clinic else None,
        "patient_id":     r.patient_id,
        "patient_name":   r.patient.full_name if r.patient else None,
        "patient_uhid":   r.patient.uhid if r.patient else None,
        "from_doctor":    r.from_doctor.staff.full_name if r.from_doctor and r.from_doctor.staff else None,
        "to_doctor":      r.to_doctor.staff.full_name if r.to_doctor and r.to_doctor.staff else None,
        "to_doctor_id":   r.to_doctor_id,
        "created_at":     str(r.created_at),
        "completed_at":   str(r.completed_at) if r.completed_at else None,
        "expires_at":     str(r.created_at + timedelta(days=EXPIRY_DAYS)) if r.created_at else None,
    }
