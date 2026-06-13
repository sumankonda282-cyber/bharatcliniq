from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.core.security import get_current_staff, get_current_patient_user
from app.models.models import (
    Prescription, PrescriptionItem, LabOrder, LabOrderItem,
    Invoice, Patient, Branch, Clinic, Staff
)
from app.services.pdf_service import (
    generate_prescription_pdf,
    generate_lab_report_pdf,
    generate_invoice_pdf,
)
from datetime import date

router = APIRouter(prefix="/pdf", tags=["pdf"])


def _clinic_data(patient: Patient, db: Session, doctor_staff_id: int = None) -> dict:
    branch = db.query(Branch).filter(Branch.id == patient.branch_id).first()
    clinic = db.query(Clinic).filter(Clinic.id == patient.clinic_id).first()
    doctor_name = ""
    if doctor_staff_id:
        doc = db.query(Staff).filter(Staff.id == doctor_staff_id).first()
        if doc:
            doctor_name = doc.full_name
    address = ", ".join(filter(None, [
        branch.address if branch else None,
        branch.city if branch else None,
        branch.state if branch else None,
    ]))
    return {
        "clinic_name":  clinic.name if clinic else "BHarath Health",
        "branch_name":  branch.name if branch else "",
        "address":      address,
        "doctor_name":  doctor_name,
    }


def _patient_data(patient: Patient) -> dict:
    age = None
    if patient.date_of_birth:
        age = (date.today() - patient.date_of_birth).days // 365
    return {
        "full_name": patient.full_name,
        "uhid":      patient.uhid,
        "age":       f"{age} yrs" if age else "—",
        "gender":    patient.gender or "—",      # String, not Enum
        "allergies": patient.allergies,
    }


# ── Staff-facing PDF routes ───────────────────────────────────────────────────

@router.get("/prescription/{pres_id}")
def download_prescription(
    pres_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    pres = db.query(Prescription).options(
        joinedload(Prescription.items).joinedload(PrescriptionItem.medicine)
    ).filter(Prescription.id == pres_id).first()
    if not pres:
        raise HTTPException(status_code=404, detail="Not found")

    patient = db.query(Patient).filter(Patient.id == pres.patient_id).first()
    clinic_data = _clinic_data(patient, db, pres.prescribed_by)
    pres_dict = {
        "notes": pres.notes,
        "items": [
            {
                "medicine_name": i.medicine_name or (i.medicine.name if i.medicine else "—"),
                "dosage":        i.dosage,
                "frequency":     i.frequency,
                "duration":      i.duration,
                "instructions":  i.instructions,
            }
            for i in pres.items
        ]
    }
    pdf = generate_prescription_pdf(pres_dict, _patient_data(patient), clinic_data)
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=prescription_{pres_id}.pdf"}
    )


@router.get("/lab-report/{order_id}")
def download_lab_report(
    order_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    order = db.query(LabOrder).options(
        joinedload(LabOrder.items).joinedload(LabOrderItem.test)
    ).filter(LabOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Not found")

    patient = db.query(Patient).filter(Patient.id == order.patient_id).first()
    clinic_data = _clinic_data(patient, db, order.ordered_by)
    order_dict = {
        "items": [
            {
                "test_name":    i.test_name or (i.test.name if i.test else "—"),
                "result_value": i.result_value or "Pending",
                "unit":         i.test.unit if i.test else "",
                "normal_range": i.test.normal_range if i.test else "",
                "is_abnormal":  i.is_abnormal,
            }
            for i in order.items
        ]
    }
    pdf = generate_lab_report_pdf(order_dict, _patient_data(patient), clinic_data)
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=lab_report_{order_id}.pdf"}
    )


@router.get("/invoice/{invoice_id}")
def download_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    inv = db.query(Invoice).options(joinedload(Invoice.items)).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Not found")

    patient = db.query(Patient).filter(Patient.id == inv.patient_id).first()
    clinic_data = _clinic_data(patient, db)
    inv_dict = {
        "invoice_number": inv.invoice_number,
        "date":           inv.created_at.strftime("%d %b %Y"),
        "payment_method": inv.payment_method or "",
        "subtotal":       float(inv.subtotal),
        "discount":       float(inv.discount),
        "tax":            float(inv.tax),
        "total":          float(inv.total),
        "amount_paid":    float(inv.amount_paid),
        "items": [
            {"description": i.description, "item_type": i.item_type,
             "quantity": i.quantity, "unit_price": float(i.unit_price or 0),
             "total": float(i.total or 0)}
            for i in inv.items
        ]
    }
    pdf = generate_invoice_pdf(inv_dict, _patient_data(patient), clinic_data)
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={inv.invoice_number or f'invoice_{invoice_id}'}.pdf"}
    )


# ── Patient portal PDF routes ─────────────────────────────────────────────────

@router.get("/portal/prescription/{pres_id}")
def patient_download_prescription(
    pres_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_patient_user),
):
    pres = db.query(Prescription).options(
        joinedload(Prescription.items)
    ).filter(Prescription.id == pres_id).first()
    if not pres:
        raise HTTPException(status_code=404, detail="Not found")

    patient = db.query(Patient).filter(
        Patient.id == pres.patient_id,
        Patient.portal_user_id == current.id
    ).first()
    if not patient:
        raise HTTPException(status_code=403, detail="Access denied")

    clinic_data = _clinic_data(patient, db, pres.prescribed_by)
    pres_dict = {
        "notes": pres.notes,
        "items": [
            {"medicine_name": i.medicine_name, "dosage": i.dosage,
             "frequency": i.frequency, "duration": i.duration,
             "instructions": i.instructions}
            for i in pres.items
        ]
    }
    pdf = generate_prescription_pdf(pres_dict, _patient_data(patient), clinic_data)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=prescription_{pres_id}.pdf"})


@router.get("/portal/lab-report/{order_id}")
def patient_download_lab_report(
    order_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_patient_user),
):
    order = db.query(LabOrder).options(
        joinedload(LabOrder.items)
    ).filter(LabOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Not found")

    patient = db.query(Patient).filter(
        Patient.id == order.patient_id,
        Patient.portal_user_id == current.id
    ).first()
    if not patient:
        raise HTTPException(status_code=403, detail="Access denied")

    clinic_data = _clinic_data(patient, db, order.ordered_by)
    order_dict = {
        "items": [
            {"test_name": i.test_name, "result_value": i.result_value or "Pending",
             "unit": "", "normal_range": "", "is_abnormal": i.is_abnormal}
            for i in order.items
        ]
    }
    pdf = generate_lab_report_pdf(order_dict, _patient_data(patient), clinic_data)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=lab_report_{order_id}.pdf"})


@router.get("/portal/invoice/{invoice_id}")
def patient_download_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_patient_user),
):
    inv = db.query(Invoice).options(joinedload(Invoice.items)).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Not found")
    patient = db.query(Patient).filter(
        Patient.id == inv.patient_id,
        Patient.portal_user_id == current.id
    ).first()
    if not patient:
        raise HTTPException(status_code=403, detail="Access denied")
    clinic_data = _clinic_data(patient, db)
    inv_dict = {
        "invoice_number": inv.invoice_number,
        "date":           inv.created_at.strftime("%d %b %Y") if inv.created_at else "",
        "payment_method": inv.payment_method or "",
        "subtotal":       float(inv.subtotal or 0),
        "discount":       float(inv.discount or 0),
        "tax":            float(inv.tax or 0),
        "total":          float(inv.total or 0),
        "amount_paid":    float(inv.amount_paid or 0),
        "items": [
            {"description": i.description, "item_type": i.item_type,
             "quantity": i.quantity, "unit_price": float(i.unit_price or 0),
             "total": float(i.total or 0)}
            for i in inv.items
        ]
    }
    pdf = generate_invoice_pdf(inv_dict, _patient_data(patient), clinic_data)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=invoice_{inv.invoice_number or invoice_id}.pdf"})
