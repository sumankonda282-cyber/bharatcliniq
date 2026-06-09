"""
Razorpay payment integration.

Flow:
  1. Staff/receptionist creates Razorpay order for an invoice  →  POST /payments/invoice/{id}/order
  2. Frontend loads Razorpay checkout (web SDK) with order_id + key
  3. Patient pays via UPI (0% MDR), card (2%), netbanking etc.
  4. Razorpay fires webhook  →  POST /payments/webhook/razorpay  →  invoice marked paid

UPI note: Razorpay charges 0% platform fee on UPI transactions — prefer UPI in checkout.
Gateway charges are passed to the customer (not absorbed by the clinic).
"""

import hmac
import hashlib
import json
import logging
from datetime import datetime

import razorpay
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_staff
from app.db.session import get_db
from app.models.models import Invoice

router = APIRouter(prefix="/payments", tags=["payments"])
log = logging.getLogger(__name__)


def _rz():
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(503, "Payment gateway not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.")
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


# ── Create Razorpay order ─────────────────────────────────────────────────────

@router.post("/invoice/{invoice_id}/order")
def create_payment_order(
    invoice_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    """
    Create a Razorpay order for a pending invoice.
    Returns order details the frontend needs to launch Razorpay Checkout.
    Preferred method: UPI (0% MDR). Cards/netbanking: 2%.
    """
    inv = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.clinic_id == current.clinic_id,
    ).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if inv.status == "paid":
        raise HTTPException(400, "Invoice is already paid")

    amount_paise = int(float(inv.total or 0) * 100)
    if amount_paise <= 0:
        raise HTTPException(400, "Invoice total must be greater than zero")

    client = _rz()
    try:
        order = client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": inv.invoice_number or f"INV-{invoice_id}",
            "notes": {
                "invoice_id": str(invoice_id),
                "clinic_id": str(inv.clinic_id),
                "patient": inv.customer_name or "",
            },
        })
    except Exception as e:
        log.error(f"[razorpay] order creation failed for invoice {invoice_id}: {e}")
        raise HTTPException(502, "Payment gateway error. Please try again.")

    inv.razorpay_order_id = order["id"]
    db.commit()

    return {
        "order_id":       order["id"],
        "amount":         amount_paise,
        "currency":       "INR",
        "key":            settings.RAZORPAY_KEY_ID,
        "invoice_number": inv.invoice_number,
        "customer_name":  inv.customer_name or "",
        "customer_mobile": inv.customer_mobile or "",
        "preferred_method": "upi",  # UPI = 0% fee for customer
    }


# ── Razorpay webhook ──────────────────────────────────────────────────────────

@router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Razorpay fires this on payment.captured.
    Verifies HMAC-SHA256 signature then marks the invoice as paid.
    Configure this URL in Razorpay Dashboard → Webhooks:
      https://bharatcliniq-api.onrender.com/api/v1/payments/webhook/razorpay
    """
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(503, "Webhook secret not configured")

    body = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")

    expected = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode(),
        body,
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        log.warning("[razorpay] webhook signature mismatch")
        raise HTTPException(400, "Invalid signature")

    event = json.loads(body)
    event_type = event.get("event")

    if event_type != "payment.captured":
        return {"status": "ignored", "event": event_type}

    payment = event["payload"]["payment"]["entity"]
    order_id = payment.get("order_id")

    inv = db.query(Invoice).filter(Invoice.razorpay_order_id == order_id).first()
    if not inv:
        log.warning(f"[razorpay] no invoice found for order {order_id}")
        return {"status": "ok", "note": "invoice not found"}

    if inv.status == "paid":
        return {"status": "ok", "note": "already paid"}

    method = payment.get("method", "")
    inv.razorpay_payment_id = payment["id"]
    inv.status              = "paid"
    inv.amount_paid         = float(payment["amount"]) / 100
    inv.payment_method      = f"online_upi" if method == "upi" else f"online_{method}"
    inv.paid_at             = datetime.utcnow()
    db.commit()

    log.info(f"[razorpay] invoice {inv.id} paid via {method} — ₹{inv.amount_paid}")
    return {"status": "ok"}


# ── Patient-facing: verify payment after checkout ─────────────────────────────

@router.post("/invoice/{invoice_id}/verify")
def verify_payment(
    invoice_id: int,
    body: dict,
    db: Session = Depends(get_db),
):
    """
    Client-side verification after Razorpay Checkout completes.
    Frontend calls this with razorpay_order_id, razorpay_payment_id, razorpay_signature.
    This is a belt-and-suspenders check alongside the webhook.
    """
    if not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(503, "Payment gateway not configured")

    order_id   = body.get("razorpay_order_id", "")
    payment_id = body.get("razorpay_payment_id", "")
    signature  = body.get("razorpay_signature", "")

    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{order_id}|{payment_id}".encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(400, "Payment verification failed")

    inv = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.razorpay_order_id == order_id,
    ).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")

    if inv.status != "paid":
        inv.razorpay_payment_id = payment_id
        inv.status              = "paid"
        inv.amount_paid         = float(inv.total or 0)
        inv.payment_method      = "online"
        inv.paid_at             = datetime.utcnow()
        db.commit()

    return {"status": "paid", "invoice_number": inv.invoice_number}
