"""
Imaging Orders API — create, list, sign, DICOM preview request, PDF fallback
"""
import hashlib
import json
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import (
    ImagingOrder, ImagingResult, Staff, Patient, Clinic, UnmatchedResult
)
from app.core.security import (
    get_current_staff, require_doctor_or_nurse, require_imaging_access,
    require_imaging_sign,
)

router = APIRouter(prefix='/imaging-orders', tags=['imaging-orders'])

MODALITY_LABELS = {
    'CR': 'X-Ray', 'DX': 'X-Ray (Digital)', 'CT': 'CT Scan',
    'MR': 'MRI', 'US': 'Ultrasound', 'NM': 'Nuclear Medicine',
    'PT': 'PET Scan', 'MG': 'Mammography', 'RF': 'Fluoroscopy',
    'XA': 'Angiography', 'OT': 'Other',
}


def _next_imaging_order_id(clinic_id: int, db: Session) -> str:
    count = db.query(ImagingOrder).filter_by(clinic_id=clinic_id).count()
    return f'IMG-{(count + 1):05d}'


class CreateImagingOrderRequest(BaseModel):
    patient_id:        int
    appointment_id:    Optional[int] = None
    modality:          Optional[str] = None
    body_part:         Optional[str] = None
    study_description: Optional[str] = None
    clinical_notes:    Optional[str] = None
    priority:          str = 'routine'


class SignImagingReportRequest(BaseModel):
    findings:   str
    impression: str


class MarkKeyImagesRequest(BaseModel):
    file_paths: List[str]


@router.post('')
def create_imaging_order(
    body:    CreateImagingOrderRequest,
    db:      Session = Depends(get_db),
    current = Depends(require_doctor_or_nurse),
):
    patient = db.query(Patient).filter_by(id=body.patient_id, clinic_id=current.clinic_id).first()
    if not patient:
        raise HTTPException(404, 'Patient not found')

    order_id = _next_imaging_order_id(current.clinic_id, db)
    order = ImagingOrder(
        order_id          = order_id,
        clinic_id         = current.clinic_id,
        patient_id        = body.patient_id,
        appointment_id    = body.appointment_id,
        ordered_by        = current.id,
        modality          = body.modality,
        body_part         = body.body_part,
        study_description = body.study_description,
        clinical_notes    = body.clinical_notes,
        priority          = body.priority,
        status            = 'pending',
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return _order_out(order, patient)


@router.get('')
def list_imaging_orders(
    status:  Optional[str] = Query(None),
    db:      Session = Depends(get_db),
    current = Depends(require_imaging_access),
):
    q = db.query(ImagingOrder).filter_by(clinic_id=current.clinic_id)
    if status:
        q = q.filter_by(status=status)
    orders  = q.order_by(ImagingOrder.created_at.desc()).limit(200).all()
    patients = {
        p.id: p for p in db.query(Patient)
        .filter(Patient.id.in_([o.patient_id for o in orders])).all()
    }
    return [_order_out(o, patients.get(o.patient_id)) for o in orders]


@router.get('/{order_id}')
def get_imaging_order(
    order_id: str,
    db:       Session = Depends(get_db),
    current = Depends(require_imaging_access),
):
    order = db.query(ImagingOrder).filter_by(
        order_id=order_id, clinic_id=current.clinic_id
    ).first()
    if not order:
        raise HTTPException(404, 'Order not found')
    patient = db.query(Patient).filter_by(id=order.patient_id).first()
    return {**_order_out(order, patient), 'result': _result_out(order.result)}


@router.post('/{order_id}/mark-key-images')
def mark_key_images(
    order_id: str,
    body:     MarkKeyImagesRequest,
    db:       Session = Depends(get_db),
    current = Depends(require_imaging_sign),
):
    """Radiologist marks which DICOM file paths are key images for doctor preview."""
    order = db.query(ImagingOrder).filter_by(
        order_id=order_id, clinic_id=current.clinic_id
    ).first()
    if not order:
        raise HTTPException(404, 'Order not found')

    result = order.result
    if not result:
        raise HTTPException(400, 'No result received yet')

    result.key_image_paths = body.file_paths
    db.commit()
    return {'status': 'marked', 'count': len(body.file_paths)}


@router.post('/{order_id}/upload-pdf')
def upload_pdf(
    order_id: str,
    body:     dict,
    db:       Session = Depends(get_db),
    current = Depends(require_imaging_access),
):
    order = db.query(ImagingOrder).filter_by(
        order_id=order_id, clinic_id=current.clinic_id
    ).first()
    if not order:
        raise HTTPException(404, 'Order not found')

    existing = order.result
    if existing and existing.status == 'signed':
        raise HTTPException(400, 'Cannot modify a signed report')

    if existing:
        existing.pdf_b64 = body.get('pdf_b64')
        existing.source  = 'pdf_upload'
        existing.status  = 'pending_review'
    else:
        db.add(ImagingResult(
            order_id   = order.id,
            pdf_b64    = body.get('pdf_b64'),
            source     = 'pdf_upload',
            status     = 'pending_review',
        ))
    order.status = 'pending_review'
    db.commit()
    return {'status': 'uploaded'}


@router.post('/{order_id}/sign')
def sign_imaging_report(
    order_id: str,
    body:     SignImagingReportRequest,
    db:       Session = Depends(get_db),
    current = Depends(require_imaging_sign),
):
    order = db.query(ImagingOrder).filter_by(
        order_id=order_id, clinic_id=current.clinic_id
    ).first()
    if not order:
        raise HTTPException(404, 'Order not found')

    result = order.result
    if not result:
        raise HTTPException(400, 'No result to sign')
    if result.status == 'signed':
        raise HTTPException(400, 'Report already signed')

    result.findings    = body.findings
    result.impression  = body.impression
    result.signed_by   = current.id
    result.signed_at   = datetime.utcnow()
    result.status      = 'signed'

    content = json.dumps({
        'findings':   result.findings,
        'impression': result.impression,
        'signed_by':  current.id,
        'signed_at':  result.signed_at.isoformat(),
        'order_id':   order_id,
    }, sort_keys=True)
    result.report_hash = hashlib.sha256(content.encode()).hexdigest()

    order.status = 'signed'
    db.commit()
    return {'status': 'signed', 'report_hash': result.report_hash}


@router.get('/{order_id}/collection-sheet')
def collection_sheet(
    order_id: str,
    db:       Session = Depends(get_db),
    current = Depends(require_imaging_access),
):
    order   = db.query(ImagingOrder).filter_by(order_id=order_id, clinic_id=current.clinic_id).first()
    if not order:
        raise HTTPException(404, 'Order not found')
    patient = db.query(Patient).filter_by(id=order.patient_id).first()
    clinic  = db.query(Clinic).filter_by(id=current.clinic_id).first()
    doctor  = db.query(Staff).filter_by(id=order.ordered_by).first()
    return {
        'order_id':         order.order_id,
        'modality':         order.modality or '',
        'modality_label':   MODALITY_LABELS.get(order.modality or '', order.modality or ''),
        'body_part':        order.body_part or '',
        'study_description': order.study_description or '',
        'patient_name':     patient.full_name if patient else '',
        'patient_age':      getattr(patient, 'age', ''),
        'patient_gender':   getattr(patient, 'gender', ''),
        'clinic_name':      clinic.name if clinic else '',
        'doctor_name':      doctor.full_name if doctor else '',
        'priority':         order.priority,
        'notes':            order.clinical_notes or '',
        'created_at':       order.created_at.isoformat() if order.created_at else '',
        'instruction':      'Enter the ORDER ID above into the AccessionNumber field before scanning.',
    }


def _order_out(order: ImagingOrder, patient) -> dict:
    return {
        'id':               order.id,
        'order_id':         order.order_id,
        'patient_id':       order.patient_id,
        'patient_name':     patient.full_name if patient else '',
        'modality':         order.modality,
        'modality_label':   MODALITY_LABELS.get(order.modality or '', order.modality or ''),
        'body_part':        order.body_part,
        'study_description': order.study_description,
        'priority':         order.priority,
        'status':           order.status,
        'created_at':       order.created_at.isoformat() if order.created_at else None,
        'has_result':       order.result is not None,
        'result_status':    order.result.status if order.result else None,
    }


def _result_out(result: Optional[ImagingResult]) -> Optional[dict]:
    if not result:
        return None
    return {
        'id':              result.id,
        'status':          result.status,
        'source':          result.source,
        'modality':        result.modality,
        'findings':        result.findings,
        'impression':      result.impression,
        'key_images_count': len(result.key_image_paths or []),
        'signed_at':       result.signed_at.isoformat() if result.signed_at else None,
        'report_hash':     result.report_hash,
        'has_pdf':         bool(result.pdf_b64),
    }
