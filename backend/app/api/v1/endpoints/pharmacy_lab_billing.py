from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from app.db.session import get_db
from app.core.security import get_current_staff, require_billing_waive
from app.models.models import (
    Medicine, Prescription, PrescriptionItem,
    LabTest, LabOrder, LabOrderItem,
    Invoice, InvoiceItem, Staff, StockTransaction
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


@pharmacy_router.put("/medicines/{med_id}")
def edit_medicine(
    med_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    allowed = ['clinic_admin', 'pharmacist']
    if current.role not in allowed:
        raise HTTPException(status_code=403, detail="Access denied")
    med = db.query(Medicine).filter(Medicine.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")
    editable = [
        'name', 'generic_name', 'category', 'form', 'strength',
        'manufacturer', 'unit_price', 'mrp', 'hsn_code', 'schedule',
        'gst_rate', 'reorder_level', 'is_active',
    ]
    for field in editable:
        if field in body:
            setattr(med, field, body[field])
    db.commit()
    db.refresh(med)
    return {
        "id": med.id, "name": med.name, "generic_name": med.generic_name,
        "category": med.category, "form": med.form, "strength": med.strength,
        "manufacturer": med.manufacturer, "unit_price": float(med.unit_price) if med.unit_price else None,
        "mrp": float(med.mrp) if med.mrp else None, "hsn_code": med.hsn_code,
        "schedule": med.schedule, "gst_rate": float(med.gst_rate) if med.gst_rate else None,
        "stock_quantity": med.stock_quantity, "reorder_level": med.reorder_level,
        "is_active": med.is_active,
    }


@pharmacy_router.get("/medicines/search")
def search_medicines(
    q: str = Query(""),
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    effective_branch = branch_id or current.branch_id
    query = db.query(Medicine).filter(Medicine.is_active == True)
    if effective_branch:
        query = query.filter(Medicine.branch_id == effective_branch)
    if q:
        query = query.filter(
            Medicine.name.ilike(f"%{q}%") |
            Medicine.generic_name.ilike(f"%{q}%")
        )
    results = query.order_by(Medicine.name).limit(15).all()
    return [
        {
            "id": m.id,
            "name": m.name,
            "generic_name": m.generic_name,
            "form": m.form,
            "strength": m.strength,
            "unit_price": float(m.unit_price) if m.unit_price else None,
            "mrp": float(m.mrp) if m.mrp else None,
            "stock_quantity": m.stock_quantity,
            "schedule": m.schedule,
            "gst_rate": float(m.gst_rate) if m.gst_rate else None,
            "hsn_code": m.hsn_code,
            "in_stock": (m.stock_quantity or 0) > 0,
        }
        for m in results
    ]


@pharmacy_router.get("/medicines/suggest-generic")
def suggest_generic(
    name: str = Query(""),
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    source = db.query(Medicine).filter(
        Medicine.name.ilike(f"%{name}%"),
        Medicine.is_active == True,
    ).first()
    if not source or not source.generic_name:
        return []
    alternatives = db.query(Medicine).filter(
        Medicine.generic_name.ilike(f"%{source.generic_name}%"),
        Medicine.is_active == True,
        Medicine.id != source.id,
    ).all()
    result = []
    for m in alternatives:
        if m.unit_price and source.unit_price and m.unit_price < source.unit_price:
            result.append({
                "id": m.id, "name": m.name, "generic_name": m.generic_name,
                "unit_price": float(m.unit_price), "stock_quantity": m.stock_quantity,
            })
    return result


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


class StockUpdateBody(BaseModel):
    quantity: int
    operation: Optional[str] = "add"
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    notes: Optional[str] = None
    unit_cost: Optional[Decimal] = None
    supplier_name: Optional[str] = None


@pharmacy_router.put("/medicines/{med_id}/stock")
def update_stock(
    med_id: int,
    body: StockUpdateBody,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    med = db.query(Medicine).filter(Medicine.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")
    qty_before = med.stock_quantity or 0
    if body.operation == "set":
        med.stock_quantity = body.quantity
    elif body.operation == "subtract":
        if qty_before < body.quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock")
        med.stock_quantity = qty_before - body.quantity
    else:
        med.stock_quantity = qty_before + body.quantity
    qty_after = med.stock_quantity

    from datetime import date as dt_date
    expiry = None
    if body.expiry_date:
        try:
            expiry = dt_date.fromisoformat(body.expiry_date)
        except Exception:
            pass

    txn = StockTransaction(
        clinic_id=current.clinic_id,
        branch_id=current.branch_id,
        medicine_id=med.id,
        transaction_type=body.operation or "add",
        quantity=body.quantity,
        quantity_before=qty_before,
        quantity_after=qty_after,
        batch_number=body.batch_number,
        expiry_date=expiry,
        unit_cost=body.unit_cost,
        supplier_name=body.supplier_name,
        notes=body.notes,
        performed_by=current.id,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return {
        "id": med.id,
        "stock_quantity": med.stock_quantity,
        "transaction_id": txn.id,
        "quantity_before": qty_before,
        "quantity_after": qty_after,
    }


@pharmacy_router.get("/stock-transactions")
def list_stock_transactions(
    branch_id: Optional[int] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    q = db.query(StockTransaction).filter(
        StockTransaction.clinic_id == current.clinic_id
    )
    if branch_id:
        q = q.filter(StockTransaction.branch_id == branch_id)
    elif current.branch_id:
        q = q.filter(StockTransaction.branch_id == current.branch_id)
    txns = q.order_by(StockTransaction.created_at.desc()).limit(limit).all()
    result = []
    for t in txns:
        med = db.query(Medicine).filter(Medicine.id == t.medicine_id).first()
        staff = db.query(Staff).filter(Staff.id == t.performed_by).first() if t.performed_by else None
        result.append({
            "id": t.id,
            "medicine_name": med.name if med else "Unknown",
            "transaction_type": t.transaction_type,
            "quantity": t.quantity,
            "quantity_before": t.quantity_before,
            "quantity_after": t.quantity_after,
            "batch_number": t.batch_number,
            "expiry_date": str(t.expiry_date) if t.expiry_date else None,
            "unit_cost": float(t.unit_cost) if t.unit_cost else None,
            "supplier_name": t.supplier_name,
            "notes": t.notes,
            "performed_by_name": staff.full_name if staff else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })
    return result


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


@lab_router.get("/tests/search")
def search_lab_tests(
    q: str = Query(""),
    type: str = Query("lab"),
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    effective_branch = branch_id or current.branch_id
    query = db.query(LabTest).filter(LabTest.is_active == True)
    if effective_branch:
        query = query.filter(LabTest.branch_id == effective_branch)
    from sqlalchemy import or_
    imaging_keywords = ['imaging', 'radiology', 'scan', 'x-ray', 'xray', 'mri', 'ct', 'ultrasound']
    imaging_filter = or_(*[LabTest.category.ilike(f"%{kw}%") for kw in imaging_keywords])
    if type == "imaging":
        query = query.filter(imaging_filter)
    else:
        query = query.filter(~imaging_filter)
    if q:
        query = query.filter(
            LabTest.name.ilike(f"%{q}%") |
            LabTest.code.ilike(f"%{q}%")
        )
    results = query.order_by(LabTest.name).limit(15).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "code": t.code,
            "category": t.category,
            "price": float(t.price) if t.price else None,
            "available": True,
        }
        for t in results
    ]


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
    allowed = ['clinic_admin', 'receptionist', 'pharmacist']
    if current.role not in allowed:
        raise HTTPException(status_code=403, detail="Access denied")

    sale_type = payload.sale_type or 'prescription'
    if sale_type == 'prescription' and not payload.patient_id:
        raise HTTPException(status_code=400, detail="patient_id required for prescription sale")

    total_gst = Decimal("0")
    item_rows = []
    subtotal = Decimal("0")
    for item in payload.items:
        item_subtotal = item.unit_price * item.quantity
        item_disc = item.discount_amount or Decimal("0")
        taxable = item_subtotal - item_disc
        gst_rate = item.gst_rate or Decimal("0")
        item_gst = (taxable * gst_rate / 100).quantize(Decimal("0.01"))
        item_total = taxable + item_gst
        subtotal += item_subtotal
        total_gst += item_gst
        item_rows.append((item, item_gst, item_total))

    disc = payload.discount or Decimal("0")
    tax = payload.tax or Decimal("0")
    total = subtotal - disc + tax + total_gst

    inv = Invoice(
        clinic_id=current.clinic_id,
        branch_id=branch_id,
        patient_id=payload.patient_id,
        appointment_id=payload.appointment_id,
        invoice_number=_invoice_number(db, current.clinic_id),
        status='pending',
        subtotal=subtotal,
        discount=disc,
        tax=tax,
        total=total,
        payment_method=payload.payment_method,
        notes=payload.notes,
        customer_name=payload.customer_name,
        customer_mobile=payload.customer_mobile,
        sale_type=sale_type,
        gst_amount=total_gst,
        prescription_ref=payload.prescription_ref,
    )
    db.add(inv)
    db.flush()

    for item, item_gst, item_total in item_rows:
        db.add(InvoiceItem(
            invoice_id=inv.id,
            description=item.description,
            item_type=item.item_type,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total=item_total,
            hsn_code=item.hsn_code,
            gst_rate=item.gst_rate,
            gst_amount=item_gst,
            medicine_id=item.medicine_id,
            discount_amount=item.discount_amount or Decimal("0"),
            mrp=item.mrp,
        ))
        if item.medicine_id and sale_type == 'otc':
            med = db.query(Medicine).filter(Medicine.id == item.medicine_id).first()
            if med:
                qty_before = med.stock_quantity or 0
                med.stock_quantity = max(0, qty_before - item.quantity)
                db.add(StockTransaction(
                    clinic_id=current.clinic_id,
                    branch_id=branch_id,
                    medicine_id=med.id,
                    transaction_type='dispense',
                    quantity=item.quantity,
                    quantity_before=qty_before,
                    quantity_after=med.stock_quantity,
                    notes=f"OTC invoice {inv.invoice_number}",
                    performed_by=current.id,
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
        patient = db.query(Patient).filter(Patient.id == inv.patient_id).first() if inv.patient_id else None
        result.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "patient_id": inv.patient_id,
            "patient_name": patient.full_name if patient else (inv.customer_name or "Walk-in"),
            "customer_name": inv.customer_name,
            "customer_mobile": inv.customer_mobile,
            "sale_type": inv.sale_type,
            "status": str(inv.status) if inv.status else "pending",
            "payment_status": str(inv.status) if inv.status else "pending",
            "subtotal": float(inv.subtotal or 0),
            "discount": float(inv.discount or 0),
            "tax": float(inv.tax or 0),
            "gst_amount": float(inv.gst_amount or 0),
            "total": float(inv.total or 0),
            "total_amount": float(inv.total or 0),
            "amount_paid": float(inv.amount_paid or 0),
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
    from app.models.models import Patient
    patient = db.query(Patient).filter(Patient.id == inv.patient_id).first() if inv.patient_id else None
    items_out = []
    for i in inv.items:
        med = db.query(Medicine).filter(Medicine.id == i.medicine_id).first() if i.medicine_id else None
        items_out.append({
            "id": i.id, "description": i.description, "item_type": i.item_type,
            "quantity": i.quantity, "unit_price": float(i.unit_price) if i.unit_price else 0,
            "total": float(i.total) if i.total else 0,
            "hsn_code": i.hsn_code, "gst_rate": float(i.gst_rate) if i.gst_rate else 0,
            "gst_amount": float(i.gst_amount) if i.gst_amount else 0,
            "discount_amount": float(i.discount_amount) if i.discount_amount else 0,
            "mrp": float(i.mrp) if i.mrp else None,
            "medicine_id": i.medicine_id,
            "medicine_name": med.name if med else None,
        })
    gst_breakup = {}
    for i in inv.items:
        rate = str(float(i.gst_rate) if i.gst_rate else 0)
        if rate not in gst_breakup:
            gst_breakup[rate] = {"taxable": 0, "gst": 0}
        taxable = float(i.unit_price or 0) * (i.quantity or 1) - float(i.discount_amount or 0)
        gst_breakup[rate]["taxable"] += taxable
        gst_breakup[rate]["gst"] += float(i.gst_amount or 0)
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "patient_id": inv.patient_id,
        "patient_name": patient.full_name if patient else None,
        "patient_mobile": patient.mobile if patient else None,
        "customer_name": inv.customer_name,
        "customer_mobile": inv.customer_mobile,
        "sale_type": inv.sale_type,
        "prescription_ref": inv.prescription_ref,
        "status": str(inv.status),
        "subtotal": float(inv.subtotal or 0),
        "discount": float(inv.discount or 0),
        "tax": float(inv.tax or 0),
        "gst_amount": float(inv.gst_amount or 0),
        "total": float(inv.total or 0),
        "amount_paid": float(inv.amount_paid or 0),
        "payment_method": inv.payment_method,
        "notes": inv.notes,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
        "items": items_out,
        "gst_breakup": gst_breakup,
    }


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


WAIVER_REASONS = {'economic_hardship', 'bpl_card', 'procedure_adjustment', 'staff_family', 'other'}


class WaiverRequest(BaseModel):
    waiver_amount: Decimal
    reason:        str
    notes:         Optional[str] = None


@billing_router.post("/invoices/{inv_id}/waiver")
def apply_waiver(
    inv_id: int,
    body:   WaiverRequest,
    db:     Session = Depends(get_db),
    current: Staff = Depends(require_billing_waive),
):
    if body.reason not in WAIVER_REASONS:
        raise HTTPException(400, f'reason must be one of: {", ".join(WAIVER_REASONS)}')

    inv = db.query(Invoice).filter_by(id=inv_id, clinic_id=current.clinic_id).first()
    if not inv:
        raise HTTPException(404, 'Invoice not found')
    if str(inv.status) in ('paid',):
        raise HTTPException(400, 'Cannot waive a fully paid invoice')

    waiver = body.waiver_amount
    if waiver > inv.total:
        raise HTTPException(400, 'Waiver amount cannot exceed invoice total')

    from app.models.models import BillingWaiverLog
    inv.discount    = (inv.discount or Decimal('0')) + waiver
    inv.total       = inv.subtotal - inv.discount + (inv.tax or Decimal('0'))
    db.add(BillingWaiverLog(
        invoice_id    = inv.id,
        clinic_id     = current.clinic_id,
        waived_by     = current.id,
        waiver_amount = waiver,
        reason        = body.reason,
        notes         = body.notes or '',
    ))
    db.commit()
    return {
        'status': 'waiver_applied',
        'new_total': float(inv.total),
        'total_discount': float(inv.discount),
    }


@billing_router.get("/waivers")
def list_waivers(
    db:      Session = Depends(get_db),
    current: Staff = Depends(require_billing_waive),
):
    from app.models.models import BillingWaiverLog, Patient
    rows = db.query(BillingWaiverLog).filter_by(clinic_id=current.clinic_id)\
        .order_by(BillingWaiverLog.created_at.desc()).limit(200).all()
    result = []
    for r in rows:
        inv = db.query(Invoice).filter_by(id=r.invoice_id).first()
        patient = db.query(Patient).filter_by(id=inv.patient_id).first() if inv and inv.patient_id else None
        staff = db.query(Staff).filter_by(id=r.waived_by).first()
        result.append({
            'id':            r.id,
            'invoice_id':    r.invoice_id,
            'patient_name':  patient.full_name if patient else (inv.customer_name if inv else '—'),
            'waived_by':     staff.full_name if staff else '—',
            'waiver_amount': float(r.waiver_amount),
            'reason':        r.reason,
            'notes':         r.notes,
            'created_at':    r.created_at.isoformat() if r.created_at else None,
        })
    return result


@billing_router.get("/revenue")
def get_revenue(
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    from sqlalchemy import text
    params = {"clinic_id": current.clinic_id}
    date_filter = ""
    if month:
        params["month_start"] = f"{month}-01"
        params["month_end"]   = f"{month}-31"
        date_filter = " AND i.created_at BETWEEN :month_start AND :month_end"

    total_sql = text(f"""
        SELECT
            COALESCE(SUM(i.total), 0) as total_revenue,
            COALESCE(SUM(i.amount_paid), 0) as collected,
            COALESCE(SUM(i.total - COALESCE(i.amount_paid,0)), 0) as outstanding
        FROM invoices i
        WHERE i.clinic_id = :clinic_id{date_filter}
        AND i.status != 'cancelled'
    """)
    totals = db.execute(total_sql, params).fetchone()

    pay_sql = text(f"""
        SELECT i.payment_method, COUNT(*) as count, COALESCE(SUM(i.amount_paid),0) as revenue
        FROM invoices i
        WHERE i.clinic_id = :clinic_id{date_filter}
        AND i.status = 'paid' AND i.payment_method IS NOT NULL
        GROUP BY i.payment_method ORDER BY revenue DESC
    """)
    by_payment = [dict(r._mapping) for r in db.execute(pay_sql, params).fetchall()]

    return {
        "total_revenue":     float(totals.total_revenue) if totals else 0,
        "collected":         float(totals.collected) if totals else 0,
        "outstanding":       float(totals.outstanding) if totals else 0,
        "by_doctor":         [],
        "by_service":        [],
        "by_payment_method": by_payment,
        "top_patients":      [],
    }


# ── Lab orders list ───────────────────────────────────────────────

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


# ── Pharmacy pending list ──────────────────────────────────────────

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
                "id":            item.id,
                "medicine_name": med.name if med else "Unknown",
                "dosage":        item.dosage,
                "frequency":     item.frequency,
                "duration":      item.duration,
                "instructions":  item.instructions,
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
    rx.dispensed_at = datetime.utcnow()
    db.commit()
    return {"message": "Dispensed successfully"}


@pharmacy_router.get("/all")
def get_all_prescriptions(
    db: Session = Depends(get_db),
    current: Staff = Depends(get_current_staff),
):
    from sqlalchemy import text
    sql = text("""
        SELECT p.id, p.status, p.notes, p.created_at,
               pat.full_name as patient_name, pat.id as patient_id,
               s.full_name as doctor_name
        FROM prescriptions p
        JOIN patients pat ON p.patient_id = pat.id
        LEFT JOIN staff s ON p.prescribed_by = s.id
        WHERE p.clinic_id = :clinic_id
        ORDER BY p.created_at DESC
        LIMIT 100
    """)
    rows = db.execute(sql, {"clinic_id": current.clinic_id}).fetchall()
    return [dict(r._mapping) for r in rows]


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
    for field in ["status", "body_part", "modality", "clinical_notes"]:
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
        "id":             order.id,
        "patient_id":     order.patient_id,
        "patient_name":   patient.full_name if patient else None,
        "doctor_name":    doctor.full_name if doctor else None,
        "modality":       order.modality,
        "body_part":      order.body_part,
        "clinical_notes": order.clinical_notes,
        "status":         order.status,
        "created_at":     str(order.created_at),
    }
