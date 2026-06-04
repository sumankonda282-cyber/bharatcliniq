"""
Lab Orders API — create, list, sign, upload PDF, collection sheet
Roles enforced at every endpoint using centralised security guards.
"""
import hashlib
import json
import secrets
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import (
    LabOrder, LabResult, Staff, Patient, Clinic, UnmatchedResult
)
from app.core.security import (
    get_current_staff, require_doctor_or_nurse, require_lab_access,
    require_lab_sign, require_any_staff,
)

router = APIRouter(prefix='/lab-orders', tags=['lab-orders'])


# ── ID generation ──────────────────────────────────────────────────────────────

def _next_lab_order_id(clinic_id: int, db: Session) -> str:
    count = db.query(LabOrder).filter_by(clinic_id=clinic_id).count()
    return f'LAB-{(count + 1):05d}'


# ── Schemas ────────────────────────────────────────────────────────────────────

class CreateLabOrderRequest(BaseModel):
    patient_id:     int
    appointment_id: Optional[int] = None
    test_names:     List[str]
    clinical_notes: Optional[str] = None
    priority:       str = 'routine'
    specimen_type:  Optional[str] = None


class SignLabReportRequest(BaseModel):
    interpretation: str
    order_id:       int   # lab_result.id


class ResolveUnmatchedRequest(BaseModel):
    unmatched_id:  int
    lab_order_id:  int


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post('')
def create_lab_order(
    body: CreateLabOrderRequest,
    db:   Session = Depends(get_db),
    current = Depends(require_doctor_or_nurse),
):
    patient = db.query(Patient).filter_by(id=body.patient_id, clinic_id=current.clinic_id).first()
    if not patient:
        raise HTTPException(404, 'Patient not found')

    order_id = _next_lab_order_id(current.clinic_id, db)

    order = LabOrder(
        order_id       = order_id,
        clinic_id      = current.clinic_id,
        patient_id     = body.patient_id,
        appointment_id = body.appointment_id,
        ordered_by     = current.id,
        test_names     = body.test_names,
        clinical_notes = body.clinical_notes,
        priority       = body.priority,
        specimen_type  = body.specimen_type,
        status         = 'pending',
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return _order_out(order, patient)


@router.get('')
def list_lab_orders(
    status:  Optional[str] = Query(None),
    db:      Session = Depends(get_db),
    current = Depends(require_lab_access),
):
    q = db.query(LabOrder).filter_by(clinic_id=current.clinic_id)
    if status:
        q = q.filter_by(status=status)
    orders = q.order_by(LabOrder.created_at.desc()).limit(200).all()
    patients = {
        p.id: p for p in db.query(Patient)
        .filter(Patient.id.in_([o.patient_id for o in orders])).all()
    }
    return [_order_out(o, patients.get(o.patient_id)) for o in orders]


@router.get('/unmatched')
def list_unmatched(
    db:      Session = Depends(get_db),
    current = Depends(require_lab_access),
):
    rows = db.query(UnmatchedResult)\
        .filter_by(clinic_id=current.clinic_id, resolved=False)\
        .filter(UnmatchedResult.source.in_(['bridge_hl7', 'bridge_astm', 'pdf_upload']))\
        .order_by(UnmatchedResult.created_at.desc()).all()
    return [_unmatched_out(r) for r in rows]


@router.post('/unmatched/resolve')
def resolve_unmatched(
    body:    ResolveUnmatchedRequest,
    db:      Session = Depends(get_db),
    current = Depends(require_lab_access),
):
    row = db.query(UnmatchedResult).filter_by(
        id=body.unmatched_id, clinic_id=current.clinic_id
    ).first()
    if not row:
        raise HTTPException(404, 'Unmatched result not found')

    order = db.query(LabOrder).filter_by(
        id=body.lab_order_id, clinic_id=current.clinic_id
    ).first()
    if not order:
        raise HTTPException(404, 'Lab order not found')

    # Create result from parsed data
    parsed = row.parsed_data or {}
    result = LabResult(
        order_id     = order.id,
        observations = parsed.get('observations', []),
        raw_format   = row.raw_format,
        source       = row.source,
        status       = 'pending_review',
    )
    db.add(result)
    order.status = 'pending_review'

    row.resolved              = True
    row.resolved_by           = current.id
    row.resolved_at           = datetime.utcnow()
    row.linked_lab_order_id   = order.id

    db.commit()
    return {'status': 'resolved'}


@router.get('/{order_id}')
def get_lab_order(
    order_id: str,
    db:       Session = Depends(get_db),
    current = Depends(require_lab_access),
):
    order = db.query(LabOrder).filter_by(
        order_id=order_id, clinic_id=current.clinic_id
    ).first()
    if not order:
        raise HTTPException(404, 'Order not found')
    patient = db.query(Patient).filter_by(id=order.patient_id).first()
    return {**_order_out(order, patient), 'result': _result_out(order.result)}


@router.post('/{order_id}/upload-pdf')
def upload_pdf(
    order_id: str,
    body:     dict,
    db:       Session = Depends(get_db),
    current = Depends(require_lab_access),
):
    """PDF upload fallback — body: {pdf_b64: '...'}"""
    order = db.query(LabOrder).filter_by(
        order_id=order_id, clinic_id=current.clinic_id
    ).first()
    if not order:
        raise HTTPException(404, 'Order not found')

    existing = order.result
    if existing and existing.status == 'signed':
        raise HTTPException(400, 'Cannot modify a signed report')

    if existing:
        existing.pdf_b64  = body.get('pdf_b64')
        existing.source   = 'pdf_upload'
        existing.status   = 'pending_review'
    else:
        db.add(LabResult(
            order_id   = order.id,
            pdf_b64    = body.get('pdf_b64'),
            source     = 'pdf_upload',
            raw_format = 'PDF',
            status     = 'pending_review',
        ))
    order.status = 'pending_review'
    db.commit()
    return {'status': 'uploaded'}


@router.post('/{order_id}/sign')
def sign_lab_report(
    order_id: str,
    body:     SignLabReportRequest,
    db:       Session = Depends(get_db),
    current = Depends(require_lab_sign),
):
    order = db.query(LabOrder).filter_by(
        order_id=order_id, clinic_id=current.clinic_id
    ).first()
    if not order:
        raise HTTPException(404, 'Order not found')

    result = order.result
    if not result:
        raise HTTPException(400, 'No result to sign')
    if result.status == 'signed':
        raise HTTPException(400, 'Report already signed')

    result.interpretation = body.interpretation
    result.signed_by      = current.id
    result.signed_at      = datetime.utcnow()
    result.status         = 'signed'

    # Tamper-evident hash
    content = json.dumps({
        'observations':   result.observations,
        'interpretation': result.interpretation,
        'signed_by':      current.id,
        'signed_at':      result.signed_at.isoformat(),
        'order_id':       order_id,
    }, sort_keys=True)
    result.report_hash = hashlib.sha256(content.encode()).hexdigest()

    order.status = 'signed'
    db.commit()
    return {'status': 'signed', 'report_hash': result.report_hash}


@router.get('/{order_id}/collection-sheet')
def collection_sheet(
    order_id: str,
    db:       Session = Depends(get_db),
    current = Depends(require_lab_access),
):
    """Return data needed to render/print the collection sheet."""
    order = db.query(LabOrder).filter_by(
        order_id=order_id, clinic_id=current.clinic_id
    ).first()
    if not order:
        raise HTTPException(404, 'Order not found')

    patient = db.query(Patient).filter_by(id=order.patient_id).first()
    clinic  = db.query(Clinic).filter_by(id=current.clinic_id).first()
    doctor  = db.query(Staff).filter_by(id=order.ordered_by).first()

    return {
        'order_id':      order.order_id,
        'patient_name':  patient.full_name if patient else '',
        'patient_age':   patient.age if patient else '',
        'patient_gender': patient.gender if patient else '',
        'clinic_name':   clinic.name if clinic else '',
        'doctor_name':   doctor.full_name if doctor else '',
        'tests':         order.test_names or [],
        'specimen':      order.specimen_type or '',
        'priority':      order.priority,
        'notes':         order.clinical_notes or '',
        'created_at':    order.created_at.isoformat() if order.created_at else '',
        'instruction':   'Enter the ORDER ID above into the analyser sample ID field before running.',
    }


# ── Serialisers ────────────────────────────────────────────────────────────────

def _order_out(order: LabOrder, patient) -> dict:
    return {
        'id':            order.id,
        'order_id':      order.order_id,
        'patient_id':    order.patient_id,
        'patient_name':  patient.full_name if patient else '',
        'patient_age':   getattr(patient, 'age', None),
        'patient_gender': getattr(patient, 'gender', None),
        'test_names':    order.test_names or [],
        'priority':      order.priority,
        'specimen_type': order.specimen_type,
        'status':        order.status,
        'clinical_notes': order.clinical_notes,
        'created_at':    order.created_at.isoformat() if order.created_at else None,
        'has_result':    order.result is not None,
        'result_status': order.result.status if order.result else None,
    }


def _result_out(result: Optional[LabResult]) -> Optional[dict]:
    if not result:
        return None
    return {
        'id':             result.id,
        'status':         result.status,
        'source':         result.source,
        'raw_format':     result.raw_format,
        'observations':   result.observations or [],
        'interpretation': result.interpretation,
        'signed_at':      result.signed_at.isoformat() if result.signed_at else None,
        'report_hash':    result.report_hash,
        'has_pdf':        bool(result.pdf_b64),
    }


def _unmatched_out(row: UnmatchedResult) -> dict:
    return {
        'id':           row.id,
        'source':       row.source,
        'raw_format':   row.raw_format,
        'patient_hint': row.patient_hint,
        'created_at':   row.created_at.isoformat() if row.created_at else None,
        'parsed':       row.parsed_data,
    }
