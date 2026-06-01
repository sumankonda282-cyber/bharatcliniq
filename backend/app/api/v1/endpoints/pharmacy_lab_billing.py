from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from app.db.session import get_db
from app.core.security import get_current_staff
from app.models.models import (
    Medicine, Prescription, PrescriptionItem,
    LabTest, LabOrder, LabOrderItem,
    Invoice, InvoiceItem, Staff
)
from app.schemas.schemas import (
    MedicineCreate, MedicineOut,
    LabTestCreate,
    InvoiceCreate, InvoiceOut, LabResultUpdate
)

# ── Pharmacy ──────────────────────────────────────────────────────────────────
pharmacy_router = APIRouter(prefix="/pharmacy", tags=["pharmacy"])


@pharmacy_router.post("/medicines", response_model=MedicineOut)
def add_medicine(
    payload: MedicineCreate,
    branch_id: int = Query(...),
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    allowed = ['clinic_admin', 'pharmacist']
    if current.role not in allowed:
        raise HTTPException(status_code=403, detail="Access denied")
    med = Medicine(branch_id=branch_id, **payload.model_dump())
    db.add(med)
    db.commit()
    db.refresh(med)
    return med


@pharmacy_router.get("/medicines", response_model=List[MedicineOut])
def list_medicines(
    search: Optional[str] = None,
    low_stock: bool = False,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    q = db.query(Medicine).filter(Medicine.is_active == True)
    if branch_id:
        q = q.filter(Medicine.branch_id == branch_id)
    elif current.branch_id:
        q = q.filter(Medicine.branch_id == current.branch_id)
    if search:
        q = q.filter(
            Medicine.name.ilike(f"%{search}%") |
            Medicine.generic_name.ilike(f"%{search}%")
        )
    if low_stock:
        q = q.filter(Medicine.stock_quantity <= Medicine.reorder_level)
    return q.order_by(Medicine.name).all()


@pharmacy_router.put("/medicines/{med_id}/stock")
def update_stock(
    med_id: int,
    quantity: int,
    operation: str = Query("add"),
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    med = db.query(Medicine).filter(Medicine.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")
    if operation == "add":
        med.stock_quantity += quantity
    else:
        if med.stock_quantity < quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock")
        med.stock_quantity -= quantity
    db.commit()
    return {"id": med.id, "stock_quantity": med.stock_quantity}


@pharmacy_router.get("/prescriptions/{pres_id}")
def get_prescription(pres_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    pres = db.query(Prescription).options(
        joinedload(Prescription.items).joinedload(PrescriptionItem.medicine)
    ).filter(Prescription.id == pres_id).first()
    if not pres:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "id": pres.id, "status": str(pres.status), "notes": pres.notes,
        "patient_id": pres.patient_id, "created_at": pres.created_at,
        "items": [
            {"id": i.id, "medicine_name": i.medicine.name if i.medicine else "?",
             "medicine_id": i.medicine_id, "dosage": i.dosage, "frequency": i.frequency,
             "duration": i.duration, "instructions": i.instructions,
             "quantity_prescribed": i.quantity_prescribed, "quantity_dispensed": i.quantity_dispensed}
            for i in pres.items
        ]
    }


@pharmacy_router.post("/prescriptions/{pres_id}/dispense")
def dispense_prescription(pres_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    allowed = ['clinic_admin', 'pharmacist']
    if current.role not in allowed:
        raise HTTPException(status_code=403, detail="Only pharmacists can dispense")
    pres = db.query(Prescription).options(
        joinedload(Prescription.items).joinedload(PrescriptionItem.medicine)
    ).filter(Prescription.id == pres_id).first()
    if not pres:
        raise HTTPException(status_code=404, detail="Not found")
    if pres.status == 'dispensed':
        raise HTTPException(status_code=400, detail="Already dispensed")
    for item in pres.items:
        med = item.medicine
        if med:
            if med.stock_quantity < item.quantity_prescribed:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {med.name}")
            med.stock_quantity -= item.quantity_prescribed
            item.quantity_dispensed = item.quantity_prescribed
    pres.status = 'dispensed'
    pres.dispensed_at = datetime.utcnow()
    db.commit()
    return {"message": "Dispensed successfully"}


# ── Lab ───────────────────────────────────────────────────────────────────────
lab_router = APIRouter(prefix="/lab", tags=["laboratory"])


@lab_router.post("/tests")
def add_lab_test(
    payload: LabTestCreate,
    branch_id: int = Query(...),
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    if current.role not in ['clinic_admin']:
        raise HTTPException(status_code=403, detail="Access denied")
    test = LabTest(branch_id=branch_id, **payload.model_dump())
    db.add(test)
    db.commit()
    db.refresh(test)
    return test


@lab_router.get("/tests")
def list_lab_tests(
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    q = db.query(LabTest).filter(LabTest.is_active == True)
    if branch_id:
        q = q.filter(LabTest.branch_id == branch_id)
    elif current.branch_id:
        q = q.filter(LabTest.branch_id == current.branch_id)
    return q.order_by(LabTest.name).all()


@lab_router.get("/orders/{order_id}")
def get_lab_order(order_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    order = db.query(LabOrder).options(
        joinedload(LabOrder.items).joinedload(LabOrderItem.test)
    ).filter(LabOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "id": order.id, "patient_id": order.patient_id,
        "status": str(order.status), "notes": order.notes,
        "created_at": order.created_at,
        "items": [
            {"id": i.id, "test_id": i.test_id,
             "test_name": i.test.name if i.test else "?",
             "normal_range": i.test.normal_range if i.test else None,
             "unit": i.test.unit if i.test else None,
             "result_value": i.result_value, "result_notes": i.result_notes,
             "is_abnormal": i.is_abnormal, "completed_at": i.completed_at}
            for i in order.items
        ]
    }


@lab_router.put("/orders/{order_id}/status")
def update_order_status(
    order_id: int, status: str,
    db: Session = Depends(get_db), current: Staff = Depends(get_current_staff),
):
    order = db.query(LabOrder).filter(LabOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Not found")
    order.status = status
    if status == 'sample_collected':
        order.sample_collected_at = datetime.utcnow()
    db.commit()
    return {"message": f"Status → {str(status)}"}


@lab_router.put("/orders/{order_id}/items/{item_id}/result")
def enter_result(
    order_id: int, item_id: int,
    payload: LabResultUpdate,
    db: Session = Depends(get_db), current: Staff = Depends(get_current_staff),
):
    allowed = ['lab_technician', 'clinic_admin']
    if current.role not in allowed:
        raise HTTPException(status_code=403, detail="Access denied")
    item = db.query(LabOrderItem).filter(
        LabOrderItem.id == item_id, LabOrderItem.order_id == order_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    item.result_value = payload.result_value
    item.result_notes = payload.result_notes
    item.is_abnormal = payload.is_abnormal
    item.completed_at = datetime.utcnow()
    order = db.query(LabOrder).filter(LabOrder.id == order_id).first()
    if all(i.completed_at for i in order.items):
        order.status = 'completed'
    db.commit()
    return {"message": "Result saved"}


# ── Billing ───────────────────────────────────────────────────────────────────
billing_router = APIRouter(prefix="/billing", tags=["billing"])


def _invoice_number(db, clinic_id):
    from datetime import datetime as dtt
    prefix = f"INV{dtt.now().year}{dtt.now().month:02d}"
    count = db.query(Invoice).filter(Invoice.invoice_number.like(f"{prefix}%")).count()
    return f"{prefix}{count + 1:04d}"


@billing_router.post("/invoices", response_model=InvoiceOut)
def create_invoice(
    payload: InvoiceCreate,
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    if not branch_id:
        branch_id = current.branch_id or 1
    allowed = ['clinic_admin', 'receptionist']
    if current.role not in allowed:
        raise HTTPException(status_code=403, detail="Access denied")
    subtotal = sum(i.unit_price * i.quantity for i in payload.items)
    disc = payload.discount or Decimal("0")
    tax = payload.tax or Decimal("0")
    total = subtotal - disc + tax
    inv = Invoice(
        clinic_id=current.clinic_id,
        branch_id=branch_id,
        invoice_number=_invoice_number(db, current.clinic_id),
        subtotal=subtotal, discount=disc, tax=tax, total=total,
        **{k: v for k, v in payload.model_dump().items() if k not in ("items", "discount", "tax")},
    )
    db.add(inv)
    db.flush()
    for item in payload.items:
        db.add(InvoiceItem(
            invoice_id=inv.id, total=item.unit_price * item.quantity,
            **item.model_dump()
        ))
    db.commit()
    db.refresh(inv)
    return inv


@billing_router.get("/invoices", response_model=List[InvoiceOut])
def list_invoices(
    patient_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0, limit: int = 50,
    db: Session = Depends(get_db), current: Staff = Depends(get_current_staff),
):
    q = db.query(Invoice).filter(Invoice.clinic_id == current.clinic_id)
    if patient_id:
        q = q.filter(Invoice.patient_id == patient_id)
    if status:
        q = q.filter(Invoice.status == status)
    invoices = q.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for inv in invoices:
        from app.models.models import Patient
        patient = db.query(Patient).filter(Patient.id == inv.patient_id).first()
        result.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "patient_id": inv.patient_id,
            "patient_name": patient.full_name if patient else "-",
            "status": str(inv.status) if inv.status else "pending",
            "payment_status": str(inv.status) if inv.status else "pending",
            "subtotal": float(inv.subtotal),
            "discount": float(inv.discount),
            "tax": float(inv.tax),
            "total": float(inv.total),
            "total_amount": float(inv.total),
            "amount_paid": float(inv.amount_paid),
            "payment_method": inv.payment_method,
            "created_at": str(inv.created_at),
        })
    return result


@billing_router.get("/invoices/{inv_id}")
def get_invoice(inv_id: int, db: Session = Depends(get_db), current: Staff = Depends(get_current_staff)):
    inv = db.query(Invoice).options(joinedload(Invoice.items)).filter(
        Invoice.id == inv_id, Invoice.clinic_id == current.clinic_id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Not found")
    return {**{c.name: getattr(inv, c.name) for c in inv.__table__.columns},
            "items": [{c.name: getattr(i, c.name) for c in i.__table__.columns} for i in inv.items]}


@billing_router.post("/invoices/{inv_id}/pay")
def record_payment(
    inv_id: int, amount: float, payment_method: str,
    db: Session = Depends(get_db), current: Staff = Depends(get_current_staff),
):
    inv = db.query(Invoice).filter(
        Invoice.id == inv_id, Invoice.clinic_id == current.clinic_id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Not found")
    inv.amount_paid = Decimal(str(amount))
    inv.payment_method = payment_method
    inv.status = 'paid' if inv.amount_paid >= inv.total else 'partially_paid'
    if inv.status == 'paid':
        inv.paid_at = datetime.utcnow()
    db.commit()
    return {"status": str(inv.status)}


# ── Lab orders list (missing endpoint) ───────────────────────────

@lab_router.get("/orders")
def list_lab_orders(
    status: str = None,
    limit: int = 30,
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    from app.models.models import LabOrder, LabOrderItem, LabTest, Patient, Staff, DoctorProfile
    q = db.query(LabOrder).filter(LabOrder.clinic_id == current.clinic_id)
    if status:
        q = q.filter(LabOrder.status == status)
    orders = q.order_by(LabOrder.created_at.desc()).limit(limit).all()
    result = []
    for lo in orders:
        patient = db.query(Patient).filter(Patient.id == lo.patient_id).first()
        staff = db.query(Staff).filter(Staff.id == lo.ordered_by).first()
        items = []
        for item in lo.items:
            test = db.query(LabTest).filter(LabTest.id == item.test_id).first()
            items.append({
                "id":              item.id,
                "test_name":       test.name if test else "Unknown",
                "result":          item.result_value,
                "reference_range": test.normal_range if test else None,
                "unit":            test.unit if test else None,
                "is_abnormal":     item.is_abnormal,
            })
        result.append({
            "id":           lo.id,
            "patient_name": patient.full_name if patient else "Unknown",
            "patient_uhid": patient.uhid if patient else None,
            "doctor_name":  staff.full_name if staff else "Unknown",
            "status":       str(lo.status),
            "created_at":   str(lo.created_at),
            "items":        items,
        })
    return result


@lab_router.put("/orders/{order_id}/results")
def save_lab_results(
    order_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    from app.models.models import LabOrder, LabOrderItem
    order = db.query(LabOrder).filter(
        LabOrder.id == order_id,
        LabOrder.clinic_id == current.clinic_id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    for r in body.get("results", []):
        item = db.query(LabOrderItem).filter(LabOrderItem.id == r.get("item_id")).first()
        if item:
            item.result_value = r.get("result", "")
            item.result_notes = r.get("reference_range", "")
            item.is_abnormal = bool(r.get("is_abnormal", False))

    order.status = 'completed'
    db.commit()
    return {"message": "Results saved"}


@lab_router.put("/orders/{order_id}/complete")
def complete_lab_order(
    order_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    from app.models.models import LabOrder
    order = db.query(LabOrder).filter(
        LabOrder.id == order_id,
        LabOrder.clinic_id == current.clinic_id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = 'completed'
    db.commit()
    return {"message": "Order completed"}


# ── Pharmacy pending list (missing endpoint) ──────────────────────

@pharmacy_router.get("/pending")
def list_pending_prescriptions(
    limit: int = 30,
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    from app.models.models import Prescription, PrescriptionItem, Medicine, Patient, Staff
    prescriptions = db.query(Prescription).filter(
        Prescription.clinic_id == current.clinic_id,
        Prescription.status == 'pending',
    ).order_by(Prescription.created_at.desc()).limit(limit).all()

    result = []
    for rx in prescriptions:
        patient = db.query(Patient).filter(Patient.id == rx.patient_id).first()
        staff = db.query(Staff).filter(Staff.id == rx.prescribed_by).first()
        items = []
        for item in rx.items:
            med = db.query(Medicine).filter(Medicine.id == item.medicine_id).first()
            items.append({
                "id":           item.id,
                "medicine_name": med.name if med else "Unknown",
                "dosage":       item.dosage,
                "frequency":    item.frequency,
                "duration":     item.duration,
                "instructions": item.instructions,
            })
        result.append({
            "id":           rx.id,
            "patient_name": patient.full_name if patient else "Unknown",
            "patient_uhid": patient.uhid if patient else None,
            "doctor_name":  staff.full_name if staff else "Unknown",
            "status":       str(rx.status),
            "created_at":   str(rx.created_at),
            "items":        items,
        })
    return result


@pharmacy_router.put("/prescriptions/{pres_id}/dispense")
def dispense_prescription_by_id(
    pres_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    from app.models.models import Prescription
    rx = db.query(Prescription).filter(
        Prescription.id == pres_id,
        Prescription.clinic_id == current.clinic_id,
    ).first()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    rx.status = 'dispensed'
    from datetime import datetime
    rx.dispensed_at = datetime.utcnow()
    db.commit()
    return {"message": "Dispensed successfully"}


# ══════════════════════════════════════════════════════════════
# Imaging Router — /imaging
# ══════════════════════════════════════════════════════════════
imaging_router = APIRouter(prefix="/imaging", tags=["imaging"])


@imaging_router.get("/orders")
def list_imaging_orders(
    status: Optional[str] = None,
    patient_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    from app.models.models import ImagingOrder, Patient as Pt, Staff as St
    q = db.query(ImagingOrder).filter(ImagingOrder.clinic_id == current.clinic_id)
    if status:
        q = q.filter(ImagingOrder.status == status)
    if patient_id:
        q = q.filter(ImagingOrder.patient_id == patient_id)
    orders = q.order_by(ImagingOrder.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for o in orders:
        patient = db.query(Pt).filter(Pt.id == o.patient_id).first()
        doctor  = db.query(St).filter(St.id == o.ordered_by).first()
        result.append({
            "id":               o.id,
            "patient_id":       o.patient_id,
            "patient_name":     patient.full_name if patient else "Unknown",
            "patient_uhid":     patient.uhid if patient else None,
            "doctor_name":      doctor.full_name if doctor else None,
            "modality":         o.modality,
            "body_part":        o.body_part,
            "clinical_notes":   o.clinical_notes,
            "report":           o.report,
            "report_url":       o.report_url,
            "findings":         o.findings,
            "impression":       o.impression,
            "recommendation":   o.recommendation,
            "technique":        o.technique,
            "radiologist_name": o.radiologist_name,
            "report_status":    o.report_status,
            "status":           o.status,
            "created_at":       str(o.created_at),
        })
    return result


@imaging_router.post("/orders")
def create_imaging_order(
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    from app.models.models import ImagingOrder, Patient as Pt
    patient = db.query(Pt).filter(
        Pt.id == body.get("patient_id"),
        Pt.clinic_id == current.clinic_id
    ).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    order = ImagingOrder(
        clinic_id      = current.clinic_id,
        patient_id     = body["patient_id"],
        appointment_id = body.get("appointment_id"),
        ordered_by     = current.id,
        modality       = body.get("modality", "X-Ray"),
        body_part      = body.get("body_part"),
        clinical_notes = body.get("clinical_notes"),
        status         = "ordered",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return {"id": order.id, "message": "Imaging order created"}


@imaging_router.put("/orders/{order_id}")
def update_imaging_order(
    order_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    from app.models.models import ImagingOrder
    order = db.query(ImagingOrder).filter(
        ImagingOrder.id == order_id,
        ImagingOrder.clinic_id == current.clinic_id,
    ).first()
    if not order:
        raise HTTPException(404, "Order not found")
    for field in ["status", "report", "report_url", "body_part", "modality",
                  "findings", "impression", "recommendation", "technique",
                  "radiologist_name", "report_status", "clinical_notes"]:
        if field in body:
            setattr(order, field, body[field])
    db.commit()
    return {"message": "Updated successfully"}


@imaging_router.get("/orders/{order_id}")
def get_imaging_order(
    order_id: int,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    from app.models.models import ImagingOrder, Patient as Pt, Staff as St
    order = db.query(ImagingOrder).filter(
        ImagingOrder.id == order_id,
        ImagingOrder.clinic_id == current.clinic_id,
    ).first()
    if not order:
        raise HTTPException(404, "Order not found")
    patient = db.query(Pt).filter(Pt.id == order.patient_id).first()
    doctor  = db.query(St).filter(St.id == order.ordered_by).first()
    return {
        "id":               order.id,
        "patient_id":       order.patient_id,
        "patient_name":     patient.full_name if patient else None,
        "doctor_name":      doctor.full_name if doctor else None,
        "modality":         order.modality,
        "body_part":        order.body_part,
        "clinical_notes":   order.clinical_notes,
        "report":           order.report,
        "report_url":       order.report_url,
        "findings":         order.findings,
        "impression":       order.impression,
        "recommendation":   order.recommendation,
        "technique":        order.technique,
        "radiologist_name": order.radiologist_name,
        "report_status":    order.report_status,
        "status":           order.status,
        "created_at":       str(order.created_at),
    }




@pharmacy_router.get("/all")
def get_all_prescriptions(
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Get all prescriptions including dispensed ones."""
    from sqlalchemy import text
    sql = text("""
        SELECT p.id, p.status, p.notes, p.created_at,
               pat.full_name as patient_name, pat.id as patient_id,
               s.full_name as doctor_name
        FROM prescriptions p
        JOIN patients pat ON p.patient_id = pat.id
        LEFT JOIN staff s ON p.doctor_id = s.id
        WHERE pat.clinic_id = :clinic_id
        ORDER BY p.created_at DESC
        LIMIT 100
    """)
    rows = db.execute(sql, {"clinic_id": current.clinic_id}).fetchall()
    return [dict(r._mapping) for r in rows]


@billing_router.get("/revenue")
def get_revenue(
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    """Revenue analytics for clinic."""
    from sqlalchemy import text
    params = {"clinic_id": current.clinic_id}
    date_filter = ""
    if month:
        params["month_start"] = f"{month}-01"
        params["month_end"]   = f"{month}-31"
        date_filter = " AND i.created_at BETWEEN :month_start AND :month_end"

    # Total revenue
    total_sql = text(f"""
        SELECT
            COALESCE(SUM(i.total_amount), 0) as total_revenue,
            COALESCE(SUM(i.amount_paid), 0) as collected,
            COALESCE(SUM(i.total_amount - COALESCE(i.amount_paid,0)), 0) as outstanding
        FROM invoices i
        JOIN patients p ON i.patient_id = p.id
        WHERE p.clinic_id = :clinic_id{date_filter}
        AND i.status != 'cancelled'
    """)
    totals = db.execute(total_sql, params).fetchone()

    # By doctor
    doc_sql = text(f"""
        SELECT s.full_name as doctor_name, COALESCE(SUM(i.total_amount),0) as revenue
        FROM invoices i
        JOIN patients p ON i.patient_id = p.id
        LEFT JOIN staff s ON i.doctor_id = s.id
        WHERE p.clinic_id = :clinic_id{date_filter}
        AND i.status != 'cancelled' AND s.full_name IS NOT NULL
        GROUP BY s.full_name ORDER BY revenue DESC LIMIT 10
    """)
    by_doctor = [dict(r._mapping) for r in db.execute(doc_sql, params).fetchall()]

    # By service type
    svc_sql = text(f"""
        SELECT ii.service_type, COALESCE(SUM(ii.amount),0) as revenue
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
        JOIN patients p ON i.patient_id = p.id
        WHERE p.clinic_id = :clinic_id{date_filter}
        AND i.status != 'cancelled'
        GROUP BY ii.service_type ORDER BY revenue DESC
    """)
    by_service = [dict(r._mapping) for r in db.execute(svc_sql, params).fetchall()]

    # By payment method
    pay_sql = text(f"""
        SELECT i.payment_method, COUNT(*) as count, COALESCE(SUM(i.amount_paid),0) as revenue
        FROM invoices i
        JOIN patients p ON i.patient_id = p.id
        WHERE p.clinic_id = :clinic_id{date_filter}
        AND i.status = 'paid' AND i.payment_method IS NOT NULL
        GROUP BY i.payment_method ORDER BY revenue DESC
    """)
    by_payment = [dict(r._mapping) for r in db.execute(pay_sql, params).fetchall()]

    # Top patients
    pat_sql = text(f"""
        SELECT p.full_name as patient_name, COALESCE(SUM(i.total_amount),0) as total_billed
        FROM invoices i
        JOIN patients p ON i.patient_id = p.id
        WHERE p.clinic_id = :clinic_id{date_filter}
        AND i.status != 'cancelled'
        GROUP BY p.full_name ORDER BY total_billed DESC LIMIT 5
    """)
    top_patients = [dict(r._mapping) for r in db.execute(pat_sql, params).fetchall()]

    return {
        "total_revenue":      float(totals.total_revenue) if totals else 0,
        "collected":          float(totals.collected) if totals else 0,
        "outstanding":        float(totals.outstanding) if totals else 0,
        "by_doctor":          by_doctor,
        "by_service":         by_service,
        "by_payment_method":  by_payment,
        "top_patients":       top_patients,
    }
