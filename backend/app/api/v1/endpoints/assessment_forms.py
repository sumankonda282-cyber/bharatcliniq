"""
BharatCliniq — Smart Assessment Forms (PowerForms) API
Provides admin/platform form management and provider-facing submission endpoints.
"""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db

try:
    from app.core.security import get_current_staff
except ImportError:
    def get_current_staff():
        return None

from app.models.models import (
    AssessmentForm,
    AssessmentFormVersion,
    FormAlert,
    FormAssignment,
    FormCoSign,
    FormPool,
    FormSubmission,
    iViewFlowsheet,
)

router = APIRouter(tags=["Assessment Forms"])


# ---------------------------------------------------------------------------
# Scoring Engine
# ---------------------------------------------------------------------------

def run_scoring(
    form_id: int,
    schema: dict,
    data: dict,
    scoring_config: Optional[dict],
) -> dict:
    """
    Compute scores for well-known instruments and custom bands.

    Supported built-in types (detected via scoring_config['type'] or schema['scoring_type']):
        phq9, gad7, gcs, morse, apgar

    Returns a dict:
        {
            "total": <int|float>,
            "interpretation": <str>,
            "band": <str>,
            "recommended_action": <str>,
            "subscores": { ... }   # optional, instrument-specific
        }
    """
    if not scoring_config:
        return {}

    scoring_type = (scoring_config.get("type") or "").lower()

    # ── PHQ-9 ──────────────────────────────────────────────────────────────
    if scoring_type == "phq9":
        item_ids = scoring_config.get(
            "item_ids",
            ["phq1", "phq2", "phq3", "phq4", "phq5", "phq6", "phq7", "phq8", "phq9"],
        )
        try:
            total = sum(int(data.get(fid, 0) or 0) for fid in item_ids)
        except (TypeError, ValueError):
            total = 0

        if total <= 4:
            band, interpretation, action = "minimal", "Minimal depression", "Monitor; may not require treatment"
        elif total <= 9:
            band, interpretation, action = "mild", "Mild depression", "Watchful waiting; repeat PHQ-9 at follow-up"
        elif total <= 14:
            band, interpretation, action = "moderate", "Moderate depression", "Treatment plan; consider counselling/medication"
        elif total <= 19:
            band, interpretation, action = "moderately_severe", "Moderately severe depression", "Active treatment with medication and/or psychotherapy"
        else:
            band, interpretation, action = "severe", "Severe depression", "Immediate initiation of pharmacotherapy and expedited referral"

        return {"total": total, "band": band, "interpretation": interpretation, "recommended_action": action}

    # ── GAD-7 ──────────────────────────────────────────────────────────────
    if scoring_type == "gad7":
        item_ids = scoring_config.get(
            "item_ids",
            ["gad1", "gad2", "gad3", "gad4", "gad5", "gad6", "gad7"],
        )
        try:
            total = sum(int(data.get(fid, 0) or 0) for fid in item_ids)
        except (TypeError, ValueError):
            total = 0

        if total <= 4:
            band, interpretation, action = "minimal", "Minimal anxiety", "Monitor"
        elif total <= 9:
            band, interpretation, action = "mild", "Mild anxiety", "Watchful waiting"
        elif total <= 14:
            band, interpretation, action = "moderate", "Moderate anxiety", "Consider therapy or medication"
        else:
            band, interpretation, action = "severe", "Severe anxiety", "Active treatment recommended"

        return {"total": total, "band": band, "interpretation": interpretation, "recommended_action": action}

    # ── GCS (Glasgow Coma Scale) ───────────────────────────────────────────
    if scoring_type == "gcs":
        eye_id     = scoring_config.get("eye_id",    "gcs_eye")
        verbal_id  = scoring_config.get("verbal_id", "gcs_verbal")
        motor_id   = scoring_config.get("motor_id",  "gcs_motor")
        try:
            eye    = int(data.get(eye_id,    0) or 0)
            verbal = int(data.get(verbal_id, 0) or 0)
            motor  = int(data.get(motor_id,  0) or 0)
            total  = eye + verbal + motor
        except (TypeError, ValueError):
            eye = verbal = motor = total = 0

        if total <= 8:
            band, interpretation, action = "severe", "Severe TBI / coma", "Immediate neurosurgical review; airway management"
        elif total <= 12:
            band, interpretation, action = "moderate", "Moderate TBI", "Urgent CT; neurology consult"
        else:
            band, interpretation, action = "mild", "Mild TBI", "Observation; re-assess frequently"

        return {
            "total": total,
            "band": band,
            "interpretation": interpretation,
            "recommended_action": action,
            "subscores": {"eye": eye, "verbal": verbal, "motor": motor},
        }

    # ── Morse Fall Risk Scale ──────────────────────────────────────────────
    if scoring_type == "morse":
        item_ids = scoring_config.get(
            "item_ids",
            ["morse_history", "morse_diagnosis", "morse_ambulatory", "morse_iv", "morse_gait", "morse_mental"],
        )
        try:
            total = sum(int(data.get(fid, 0) or 0) for fid in item_ids)
        except (TypeError, ValueError):
            total = 0

        if total < 25:
            band, interpretation, action = "low", "Low fall risk", "Good basic nursing care"
        elif total < 45:
            band, interpretation, action = "medium", "Medium fall risk", "Implement standard fall prevention interventions"
        else:
            band, interpretation, action = "high", "High fall risk", "Implement high-risk fall prevention protocol"

        return {"total": total, "band": band, "interpretation": interpretation, "recommended_action": action}

    # ── APGAR Score ────────────────────────────────────────────────────────
    if scoring_type == "apgar":
        item_ids = scoring_config.get(
            "item_ids",
            ["apgar_appearance", "apgar_pulse", "apgar_grimace", "apgar_activity", "apgar_respiration"],
        )
        try:
            total = sum(int(data.get(fid, 0) or 0) for fid in item_ids)
        except (TypeError, ValueError):
            total = 0

        if total <= 3:
            band, interpretation, action = "severely_depressed", "Severely depressed neonate", "Immediate resuscitation required"
        elif total <= 6:
            band, interpretation, action = "moderately_depressed", "Moderately depressed neonate", "Requires close monitoring and possible resuscitation"
        else:
            band, interpretation, action = "normal", "Normal neonate", "Routine post-natal care"

        return {"total": total, "band": band, "interpretation": interpretation, "recommended_action": action}

    # ── Generic custom bands ───────────────────────────────────────────────
    item_ids = scoring_config.get("item_ids", [])
    if item_ids:
        try:
            total = sum(float(data.get(fid, 0) or 0) for fid in item_ids)
        except (TypeError, ValueError):
            total = 0.0

        bands = scoring_config.get("bands", [])
        band = interpretation = action = ""
        for b in bands:
            lo = b.get("min", float("-inf"))
            hi = b.get("max", float("inf"))
            if lo <= total <= hi:
                band          = b.get("band", "")
                interpretation = b.get("interpretation", "")
                action         = b.get("recommended_action", "")
                break

        return {"total": total, "band": band, "interpretation": interpretation, "recommended_action": action}

    return {}


# ---------------------------------------------------------------------------
# Alert Engine
# ---------------------------------------------------------------------------

def run_alerts(submission: FormSubmission, alert_rules: Optional[list], db: Session) -> list:
    """
    Evaluate alert_rules against submission data.

    alert_rules format:
        [{
            "field_id": str,
            "operator": "gt"|"lt"|"eq"|"gte"|"lte"|"neq",
            "value": number|str,
            "severity": "critical"|"high"|"warning",
            "message": str,
            "field_label": str   (optional)
        }]

    Creates FormAlert rows and returns a list of triggered rule dicts.
    """
    if not alert_rules:
        return []

    triggered = []
    data: dict = submission.data or {}

    for rule in alert_rules:
        try:
            field_id  = rule.get("field_id", "")
            operator  = rule.get("operator", "").lower()
            threshold = rule.get("value")
            severity  = rule.get("severity", "warning")
            message   = rule.get("message", f"Alert: {field_id}")
            field_label = rule.get("field_label", field_id)

            raw_value = data.get(field_id)
            if raw_value is None:
                continue

            # Attempt numeric comparison first
            try:
                num_val   = float(raw_value)
                num_thresh = float(threshold)
                fired = (
                    (operator == "gt"  and num_val >  num_thresh) or
                    (operator == "gte" and num_val >= num_thresh) or
                    (operator == "lt"  and num_val <  num_thresh) or
                    (operator == "lte" and num_val <= num_thresh) or
                    (operator == "eq"  and num_val == num_thresh) or
                    (operator == "neq" and num_val != num_thresh)
                )
            except (TypeError, ValueError):
                # Fall back to string equality
                fired = (
                    (operator == "eq"  and str(raw_value) == str(threshold)) or
                    (operator == "neq" and str(raw_value) != str(threshold))
                )

            if not fired:
                continue

            alert = FormAlert(
                submission_id = submission.id,
                clinic_id     = submission.clinic_id,
                patient_id    = submission.patient_id,
                field_id      = field_id,
                field_label   = field_label,
                value         = str(raw_value),
                severity      = severity,
                message       = message,
                notified_staff= [],
                created_at    = datetime.utcnow(),
            )
            db.add(alert)
            triggered.append({
                "field_id":    field_id,
                "field_label": field_label,
                "value":       str(raw_value),
                "severity":    severity,
                "message":     message,
            })
        except Exception:
            # Never let a malformed rule crash a submission
            continue

    if triggered:
        db.flush()   # get alert IDs without committing yet

    return triggered


# ===========================================================================
# PLATFORM / ADMIN ENDPOINTS   (prefix: /platform/forms)
# ===========================================================================

# ── Create form ────────────────────────────────────────────────────────────
@router.post("/platform/forms", status_code=201)
def create_form(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """Create a new assessment form (draft)."""
    try:
        title = payload.get("title")
        if not title:
            raise HTTPException(status_code=400, detail="title is required")

        schema = payload.get("schema", {})
        if not isinstance(schema, dict):
            raise HTTPException(status_code=400, detail="schema must be a JSON object")

        form = AssessmentForm(
            title              = title,
            description        = payload.get("description"),
            category           = payload.get("category", "general"),
            subcategory        = payload.get("subcategory"),
            icon               = payload.get("icon"),
            schema             = schema,
            scoring_config     = payload.get("scoring_config"),
            iview_config       = payload.get("iview_config"),
            alert_rules        = payload.get("alert_rules"),
            translations       = payload.get("translations"),
            status             = "draft",
            version            = 1,
            is_template        = bool(payload.get("is_template", False)),
            is_iview_enabled   = bool(payload.get("is_iview_enabled", False)),
            requires_cosign    = bool(payload.get("requires_cosign", False)),
            time_limit_minutes = payload.get("time_limit_minutes"),
            created_by_admin   = payload.get("created_by_admin"),
            clinic_id          = payload.get("clinic_id"),
            created_at         = datetime.utcnow(),
            updated_at         = datetime.utcnow(),
        )
        db.add(form)
        db.commit()
        db.refresh(form)
        return _form_dict(form)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


# ── List forms ─────────────────────────────────────────────────────────────
@router.get("/platform/forms")
def list_forms(
    status_filter: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = Query(None),
    is_template: Optional[bool] = Query(None),
    clinic_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List all assessment forms with optional filters."""
    try:
        q = db.query(AssessmentForm)
        if status_filter:
            q = q.filter(AssessmentForm.status == status_filter)
        if category:
            q = q.filter(AssessmentForm.category == category)
        if is_template is not None:
            q = q.filter(AssessmentForm.is_template == is_template)
        if clinic_id is not None:
            q = q.filter(
                (AssessmentForm.clinic_id == clinic_id) | (AssessmentForm.clinic_id.is_(None))
            )
        total = q.count()
        forms = q.order_by(AssessmentForm.id.desc()).offset(skip).limit(limit).all()
        return {"total": total, "items": [_form_dict(f) for f in forms]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Get form ───────────────────────────────────────────────────────────────
@router.get("/platform/forms/templates")
def list_templates(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List all system template forms."""
    try:
        q = db.query(AssessmentForm).filter(AssessmentForm.is_template == True)
        if category:
            q = q.filter(AssessmentForm.category == category)
        forms = q.order_by(AssessmentForm.id.desc()).all()
        return {"items": [_form_dict(f) for f in forms]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/platform/forms/{form_id}")
def get_form(form_id: int, db: Session = Depends(get_db)):
    """Get a single assessment form with full schema."""
    form = db.query(AssessmentForm).filter(AssessmentForm.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return _form_dict(form)


# ── Update form ────────────────────────────────────────────────────────────
@router.put("/platform/forms/{form_id}")
def update_form(
    form_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """Update a form's schema, config, or metadata."""
    try:
        form = db.query(AssessmentForm).filter(AssessmentForm.id == form_id).first()
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        if form.status == "retired":
            raise HTTPException(status_code=400, detail="Cannot update a retired form")

        updatable = [
            "title", "description", "category", "subcategory", "icon",
            "schema", "scoring_config", "iview_config", "alert_rules",
            "translations", "is_template", "is_iview_enabled",
            "requires_cosign", "time_limit_minutes", "clinic_id",
        ]
        for field in updatable:
            if field in payload:
                setattr(form, field, payload[field])

        form.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(form)
        return _form_dict(form)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


# ── Publish form ───────────────────────────────────────────────────────────
@router.post("/platform/forms/{form_id}/publish")
def publish_form(
    form_id: int,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
):
    """
    Publish a form:
    - Sets status = 'published'
    - Bumps version counter
    - Creates an AssessmentFormVersion snapshot
    """
    try:
        form = db.query(AssessmentForm).filter(AssessmentForm.id == form_id).first()
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        if form.status == "retired":
            raise HTTPException(status_code=400, detail="Cannot publish a retired form")

        form.status       = "published"
        form.version      = (form.version or 1)
        form.published_at = datetime.utcnow()
        form.updated_at   = datetime.utcnow()

        snapshot = AssessmentFormVersion(
            form_id        = form.id,
            version        = form.version,
            schema         = form.schema,
            scoring_config = form.scoring_config,
            published_by   = payload.get("published_by"),
            published_at   = datetime.utcnow(),
        )
        db.add(snapshot)
        db.commit()
        db.refresh(form)
        return {"message": "Form published", "form": _form_dict(form)}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


# ── Retire form ────────────────────────────────────────────────────────────
@router.post("/platform/forms/{form_id}/retire")
def retire_form(form_id: int, db: Session = Depends(get_db)):
    """Retire a published form so it can no longer be assigned."""
    try:
        form = db.query(AssessmentForm).filter(AssessmentForm.id == form_id).first()
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")

        form.status     = "retired"
        form.retired_at = datetime.utcnow()
        form.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(form)
        return {"message": "Form retired", "form": _form_dict(form)}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


# ── Clone form ─────────────────────────────────────────────────────────────
@router.post("/platform/forms/{form_id}/clone", status_code=201)
def clone_form(
    form_id: int,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
):
    """Clone an existing form into a new draft with parent_form_id set."""
    try:
        source = db.query(AssessmentForm).filter(AssessmentForm.id == form_id).first()
        if not source:
            raise HTTPException(status_code=404, detail="Source form not found")

        clone = AssessmentForm(
            title              = payload.get("title", f"Copy of {source.title}"),
            description        = source.description,
            category           = source.category,
            subcategory        = source.subcategory,
            icon               = source.icon,
            schema             = source.schema,
            scoring_config     = source.scoring_config,
            iview_config       = source.iview_config,
            alert_rules        = source.alert_rules,
            translations       = source.translations,
            status             = "draft",
            version            = 1,
            is_template        = False,
            is_iview_enabled   = source.is_iview_enabled,
            requires_cosign    = source.requires_cosign,
            time_limit_minutes = source.time_limit_minutes,
            created_by_admin   = payload.get("created_by_admin"),
            clinic_id          = payload.get("clinic_id", source.clinic_id),
            parent_form_id     = source.id,
            created_at         = datetime.utcnow(),
            updated_at         = datetime.utcnow(),
        )
        db.add(clone)
        db.commit()
        db.refresh(clone)
        return _form_dict(clone)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


# ── Pool: assign form ──────────────────────────────────────────────────────
@router.post("/platform/pool/assign", status_code=201)
def assign_to_pool(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """Add a published form to the pool (globally or for a specific clinic)."""
    try:
        form_id   = payload.get("form_id")
        clinic_id = payload.get("clinic_id")   # None = all clinics

        if not form_id:
            raise HTTPException(status_code=400, detail="form_id is required")

        form = db.query(AssessmentForm).filter(AssessmentForm.id == form_id).first()
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        if form.status != "published":
            raise HTTPException(status_code=400, detail="Only published forms can be added to the pool")

        # Check duplicate
        existing = (
            db.query(FormPool)
            .filter(FormPool.form_id == form_id, FormPool.clinic_id == clinic_id)
            .first()
        )
        if existing:
            existing.is_active   = True
            existing.assigned_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return _pool_dict(existing)

        entry = FormPool(
            form_id     = form_id,
            clinic_id   = clinic_id,
            assigned_by = payload.get("assigned_by"),
            assigned_at = datetime.utcnow(),
            is_active   = True,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return _pool_dict(entry)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


# ── Pool: list ─────────────────────────────────────────────────────────────
@router.get("/platform/pool")
def list_pool(
    clinic_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List all pool entries."""
    try:
        q = db.query(FormPool)
        if clinic_id is not None:
            q = q.filter(
                (FormPool.clinic_id == clinic_id) | (FormPool.clinic_id.is_(None))
            )
        if is_active is not None:
            q = q.filter(FormPool.is_active == is_active)

        total = q.count()
        items = q.order_by(FormPool.id.desc()).offset(skip).limit(limit).all()
        return {"total": total, "items": [_pool_dict(p) for p in items]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ===========================================================================
# PROVIDER ENDPOINTS   (prefix: /provider/forms)
# ===========================================================================

# ── Pool: available to this clinic ────────────────────────────────────────
@router.get("/provider/forms/pool")
def provider_pool(
    clinic_id: int = Query(...),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    """List forms available to a clinic from the pool."""
    try:
        q = (
            db.query(FormPool)
            .join(AssessmentForm, AssessmentForm.id == FormPool.form_id)
            .filter(FormPool.is_active == True)
            .filter(
                (FormPool.clinic_id == clinic_id) | (FormPool.clinic_id.is_(None))
            )
            .filter(AssessmentForm.status == "published")
        )
        if category:
            q = q.filter(AssessmentForm.category == category)

        items = q.all()
        result = []
        for pool_entry in items:
            form = db.query(AssessmentForm).filter(AssessmentForm.id == pool_entry.form_id).first()
            if form:
                d = _form_dict(form)
                d["pool_id"]     = pool_entry.id
                d["assigned_at"] = _dt(pool_entry.assigned_at)
                result.append(d)
        return {"items": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Assign form to patient ─────────────────────────────────────────────────
@router.post("/provider/forms/assign", status_code=201)
def assign_form(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    """Assign a form to a patient encounter or admission."""
    try:
        required = ["form_id", "clinic_id", "patient_id", "assigned_by"]
        for field in required:
            if not payload.get(field):
                raise HTTPException(status_code=400, detail=f"{field} is required")

        form = db.query(AssessmentForm).filter(AssessmentForm.id == payload["form_id"]).first()
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        if form.status != "published":
            raise HTTPException(status_code=400, detail="Only published forms can be assigned")

        due_at = None
        if payload.get("due_at"):
            try:
                due_at = datetime.fromisoformat(payload["due_at"])
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid due_at format — use ISO-8601")

        assignment = FormAssignment(
            form_id          = form.id,
            form_version     = form.version or 1,
            clinic_id        = payload["clinic_id"],
            patient_id       = payload["patient_id"],
            appointment_id   = payload.get("appointment_id"),
            admission_id     = payload.get("admission_id"),
            assigned_by      = payload["assigned_by"],
            assigned_to_role = payload.get("assigned_to_role"),
            due_at           = due_at,
            status           = "pending",
            priority         = payload.get("priority", "routine"),
            notes            = payload.get("notes"),
            assigned_at      = datetime.utcnow(),
        )
        db.add(assignment)
        db.commit()
        db.refresh(assignment)
        return _assignment_dict(assignment)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


# ── List assignments ───────────────────────────────────────────────────────
@router.get("/provider/forms/assignments")
def list_assignments(
    patient_id: Optional[int] = Query(None),
    clinic_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    admission_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    """List form assignments, optionally filtered by patient."""
    try:
        q = db.query(FormAssignment)
        if patient_id:
            q = q.filter(FormAssignment.patient_id == patient_id)
        if clinic_id:
            q = q.filter(FormAssignment.clinic_id == clinic_id)
        if status_filter:
            q = q.filter(FormAssignment.status == status_filter)
        if admission_id:
            q = q.filter(FormAssignment.admission_id == admission_id)

        total = q.count()
        items = q.order_by(FormAssignment.id.desc()).offset(skip).limit(limit).all()
        return {"total": total, "items": [_assignment_dict(a) for a in items]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Get single assignment with schema ─────────────────────────────────────
@router.get("/provider/forms/assignments/{assignment_id}")
def get_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    """Get a single assignment including the associated form schema."""
    assignment = db.query(FormAssignment).filter(FormAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    form = db.query(AssessmentForm).filter(AssessmentForm.id == assignment.form_id).first()
    result = _assignment_dict(assignment)
    result["form"] = _form_dict(form) if form else None
    return result


# ── Submit form ────────────────────────────────────────────────────────────
@router.post("/provider/forms/submit", status_code=201)
def submit_form(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    """
    Submit a completed form.
    Runs the scoring engine and alert engine automatically.
    """
    try:
        required = ["form_id", "clinic_id", "patient_id", "submitted_by", "data"]
        for field in required:
            if payload.get(field) is None:
                raise HTTPException(status_code=400, detail=f"{field} is required")

        form = db.query(AssessmentForm).filter(AssessmentForm.id == payload["form_id"]).first()
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")

        data: dict = payload["data"]
        if not isinstance(data, dict):
            raise HTTPException(status_code=400, detail="data must be a JSON object")

        # ── Scoring ────────────────────────────────────────────────────────
        scores = {}
        try:
            scores = run_scoring(form.id, form.schema or {}, data, form.scoring_config)
        except Exception:
            scores = {}

        charted_at = None
        if payload.get("charted_at"):
            try:
                charted_at = datetime.fromisoformat(payload["charted_at"])
            except ValueError:
                pass

        submission = FormSubmission(
            form_id        = form.id,
            form_version   = form.version or 1,
            assignment_id  = payload.get("assignment_id"),
            clinic_id      = payload["clinic_id"],
            patient_id     = payload["patient_id"],
            appointment_id = payload.get("appointment_id"),
            admission_id   = payload.get("admission_id"),
            submitted_by   = payload["submitted_by"],
            data           = data,
            scores         = scores if scores else None,
            alerts_fired   = [],
            is_draft       = False,
            submitted_at   = datetime.utcnow(),
            charted_at     = charted_at,
            source         = payload.get("source", "provider"),
            created_at     = datetime.utcnow(),
        )
        db.add(submission)
        db.flush()  # get submission.id before alerts

        # ── Alerts ─────────────────────────────────────────────────────────
        triggered = []
        try:
            triggered = run_alerts(submission, form.alert_rules, db)
        except Exception:
            triggered = []
        submission.alerts_fired = triggered

        # ── Mark assignment complete ───────────────────────────────────────
        if payload.get("assignment_id"):
            assignment = db.query(FormAssignment).filter(
                FormAssignment.id == payload["assignment_id"]
            ).first()
            if assignment:
                assignment.status       = "completed"
                assignment.completed_at = datetime.utcnow()

        db.commit()
        db.refresh(submission)
        return _submission_dict(submission)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


# ── List submissions ───────────────────────────────────────────────────────
@router.get("/provider/forms/submissions")
def list_submissions(
    patient_id: Optional[int] = Query(None),
    form_id: Optional[int] = Query(None),
    clinic_id: Optional[int] = Query(None),
    admission_id: Optional[int] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    is_draft: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    """List form submissions with optional filters."""
    try:
        q = db.query(FormSubmission)
        if patient_id:
            q = q.filter(FormSubmission.patient_id == patient_id)
        if form_id:
            q = q.filter(FormSubmission.form_id == form_id)
        if clinic_id:
            q = q.filter(FormSubmission.clinic_id == clinic_id)
        if admission_id:
            q = q.filter(FormSubmission.admission_id == admission_id)
        if is_draft is not None:
            q = q.filter(FormSubmission.is_draft == is_draft)
        if from_date:
            try:
                q = q.filter(FormSubmission.submitted_at >= datetime.fromisoformat(from_date))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid from_date format")
        if to_date:
            try:
                q = q.filter(FormSubmission.submitted_at <= datetime.fromisoformat(to_date))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid to_date format")

        total = q.count()
        items = q.order_by(FormSubmission.id.desc()).offset(skip).limit(limit).all()
        return {"total": total, "items": [_submission_dict(s) for s in items]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Get single submission ──────────────────────────────────────────────────
@router.get("/provider/forms/submissions/{submission_id}")
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    """Get a single submission with scores and fired alerts."""
    submission = db.query(FormSubmission).filter(FormSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    alerts = (
        db.query(FormAlert)
        .filter(FormAlert.submission_id == submission_id)
        .all()
    )
    result = _submission_dict(submission)
    result["alerts"] = [_alert_dict(a) for a in alerts]
    return result


# ── Save draft ─────────────────────────────────────────────────────────────
@router.post("/provider/forms/submissions/{submission_id}/draft")
def save_draft(
    submission_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    """Update a submission draft with partial data."""
    try:
        submission = db.query(FormSubmission).filter(FormSubmission.id == submission_id).first()
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        if not submission.is_draft:
            raise HTTPException(status_code=400, detail="Submission has already been finalised")

        if "data" in payload:
            submission.data = payload["data"]
        submission.is_draft = True
        db.commit()
        db.refresh(submission)
        return _submission_dict(submission)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


# ── Co-sign: request ───────────────────────────────────────────────────────
@router.post("/provider/forms/cosign/{submission_id}", status_code=201)
def request_cosign(
    submission_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    """Request a co-sign on a submission from another staff member."""
    try:
        submission = db.query(FormSubmission).filter(FormSubmission.id == submission_id).first()
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")

        requested_by   = payload.get("requested_by")
        requested_from = payload.get("requested_from")
        if not requested_by or not requested_from:
            raise HTTPException(status_code=400, detail="requested_by and requested_from are required")

        cosign = FormCoSign(
            submission_id  = submission_id,
            requested_by   = requested_by,
            requested_from = requested_from,
            status         = "pending",
            note           = payload.get("note"),
            created_at     = datetime.utcnow(),
        )
        db.add(cosign)
        db.commit()
        db.refresh(cosign)
        return _cosign_dict(cosign)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


# ── Alerts: list unacknowledged ────────────────────────────────────────────
@router.get("/provider/forms/alerts")
def list_alerts(
    clinic_id: int = Query(...),
    patient_id: Optional[int] = Query(None),
    severity: Optional[str] = Query(None),
    acknowledged: Optional[bool] = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    """List form alerts for a clinic, defaulting to unacknowledged."""
    try:
        q = db.query(FormAlert).filter(FormAlert.clinic_id == clinic_id)
        if patient_id:
            q = q.filter(FormAlert.patient_id == patient_id)
        if severity:
            q = q.filter(FormAlert.severity == severity)
        if not acknowledged:
            q = q.filter(FormAlert.acknowledged_by.is_(None))
        else:
            q = q.filter(FormAlert.acknowledged_by.isnot(None))

        total = q.count()
        items = q.order_by(FormAlert.id.desc()).offset(skip).limit(limit).all()
        return {"total": total, "items": [_alert_dict(a) for a in items]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Alerts: acknowledge ────────────────────────────────────────────────────
@router.post("/provider/forms/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    """Acknowledge a form alert."""
    try:
        alert = db.query(FormAlert).filter(FormAlert.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        staff_id = payload.get("staff_id")
        if not staff_id:
            raise HTTPException(status_code=400, detail="staff_id is required")

        alert.acknowledged_by = staff_id
        alert.acknowledged_at = datetime.utcnow()
        db.commit()
        db.refresh(alert)
        return _alert_dict(alert)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


# ── iView Flowsheet ────────────────────────────────────────────────────────
@router.get("/provider/forms/iview/{form_id}")
def get_iview_flowsheet(
    form_id: int,
    patient_id: int = Query(...),
    admission_id: Optional[int] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    band: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current=Depends(get_current_staff),
):
    """
    Get iView flowsheet config and time-banded submission data for a patient.

    Returns the flowsheet row configuration alongside submissions grouped by
    time band, suitable for rendering a real-time clinical flowsheet.
    """
    try:
        flowsheet = (
            db.query(iViewFlowsheet)
            .filter(iViewFlowsheet.form_id == form_id)
            .first()
        )

        form = db.query(AssessmentForm).filter(AssessmentForm.id == form_id).first()
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        if not form.is_iview_enabled:
            raise HTTPException(status_code=400, detail="iView is not enabled for this form")

        # ── Fetch submissions ──────────────────────────────────────────────
        q = (
            db.query(FormSubmission)
            .filter(
                FormSubmission.form_id    == form_id,
                FormSubmission.patient_id == patient_id,
                FormSubmission.is_draft   == False,
            )
        )
        if admission_id:
            q = q.filter(FormSubmission.admission_id == admission_id)
        if from_date:
            try:
                q = q.filter(FormSubmission.submitted_at >= datetime.fromisoformat(from_date))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid from_date format")
        if to_date:
            try:
                q = q.filter(FormSubmission.submitted_at <= datetime.fromisoformat(to_date))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid to_date format")

        submissions = q.order_by(FormSubmission.submitted_at.asc()).all()

        # ── Determine time-band interval in hours ──────────────────────────
        effective_band = band or (flowsheet.time_band if flowsheet else "4h")
        band_hours = _parse_band_hours(effective_band)

        # ── Group submissions into time slots ──────────────────────────────
        time_slots: Dict[str, list] = {}
        for sub in submissions:
            slot_key = _slot_key(sub.submitted_at, band_hours)
            if slot_key not in time_slots:
                time_slots[slot_key] = []
            time_slots[slot_key].append(_submission_dict(sub))

        row_config = (flowsheet.row_config if flowsheet else None) or _default_row_config(form.schema or {})

        return {
            "form_id":      form_id,
            "form_title":   form.title,
            "band":         effective_band,
            "row_config":   row_config,
            "flowsheet_id": flowsheet.id if flowsheet else None,
            "time_slots":   time_slots,
            "total_submissions": len(submissions),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ===========================================================================
# Internal helpers
# ===========================================================================

def _dt(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _form_dict(form: AssessmentForm) -> dict:
    return {
        "id":                 form.id,
        "title":              form.title,
        "description":        form.description,
        "category":           form.category,
        "subcategory":        form.subcategory,
        "icon":               form.icon,
        "schema":             form.schema,
        "scoring_config":     form.scoring_config,
        "iview_config":       form.iview_config,
        "alert_rules":        form.alert_rules,
        "translations":       form.translations,
        "status":             form.status,
        "version":            form.version,
        "is_template":        form.is_template,
        "is_iview_enabled":   form.is_iview_enabled,
        "requires_cosign":    form.requires_cosign,
        "time_limit_minutes": form.time_limit_minutes,
        "created_by":         form.created_by,
        "created_by_admin":   form.created_by_admin,
        "clinic_id":          form.clinic_id,
        "parent_form_id":     form.parent_form_id,
        "published_at":       _dt(form.published_at),
        "retired_at":         _dt(form.retired_at),
        "created_at":         _dt(form.created_at),
        "updated_at":         _dt(form.updated_at),
    }


def _pool_dict(p: FormPool) -> dict:
    return {
        "id":          p.id,
        "form_id":     p.form_id,
        "clinic_id":   p.clinic_id,
        "assigned_by": p.assigned_by,
        "assigned_at": _dt(p.assigned_at),
        "is_active":   p.is_active,
    }


def _assignment_dict(a: FormAssignment) -> dict:
    return {
        "id":               a.id,
        "form_id":          a.form_id,
        "form_version":     a.form_version,
        "clinic_id":        a.clinic_id,
        "patient_id":       a.patient_id,
        "appointment_id":   a.appointment_id,
        "admission_id":     a.admission_id,
        "assigned_by":      a.assigned_by,
        "assigned_to_role": a.assigned_to_role,
        "due_at":           _dt(a.due_at),
        "status":           a.status,
        "priority":         a.priority,
        "notes":            a.notes,
        "assigned_at":      _dt(a.assigned_at),
        "completed_at":     _dt(a.completed_at),
    }


def _submission_dict(s: FormSubmission) -> dict:
    return {
        "id":            s.id,
        "form_id":       s.form_id,
        "form_version":  s.form_version,
        "assignment_id": s.assignment_id,
        "clinic_id":     s.clinic_id,
        "patient_id":    s.patient_id,
        "appointment_id":s.appointment_id,
        "admission_id":  s.admission_id,
        "submitted_by":  s.submitted_by,
        "cosigned_by":   s.cosigned_by,
        "cosigned_at":   _dt(s.cosigned_at),
        "data":          s.data,
        "scores":        s.scores,
        "alerts_fired":  s.alerts_fired,
        "is_draft":      s.is_draft,
        "submitted_at":  _dt(s.submitted_at),
        "charted_at":    _dt(s.charted_at),
        "source":        s.source,
        "created_at":    _dt(s.created_at),
    }


def _alert_dict(a: FormAlert) -> dict:
    return {
        "id":              a.id,
        "submission_id":   a.submission_id,
        "clinic_id":       a.clinic_id,
        "patient_id":      a.patient_id,
        "field_id":        a.field_id,
        "field_label":     a.field_label,
        "value":           a.value,
        "severity":        a.severity,
        "message":         a.message,
        "notified_staff":  a.notified_staff,
        "acknowledged_by": a.acknowledged_by,
        "acknowledged_at": _dt(a.acknowledged_at),
        "created_at":      _dt(a.created_at),
    }


def _cosign_dict(c: FormCoSign) -> dict:
    return {
        "id":             c.id,
        "submission_id":  c.submission_id,
        "requested_by":   c.requested_by,
        "requested_from": c.requested_from,
        "status":         c.status,
        "note":           c.note,
        "responded_at":   _dt(c.responded_at),
        "created_at":     _dt(c.created_at),
    }


def _parse_band_hours(band: str) -> int:
    """Convert band string like '4h', '12h', '1h' to integer hours."""
    band = band.lower().strip()
    try:
        if band.endswith("h"):
            return max(1, int(band[:-1]))
    except (ValueError, TypeError):
        pass
    return 4


def _slot_key(dt_value: Optional[datetime], band_hours: int) -> str:
    """Return a string slot key for a given datetime rounded down to the band interval."""
    if not dt_value:
        return "unknown"
    from math import floor
    floored_hour = floor(dt_value.hour / band_hours) * band_hours
    return dt_value.replace(
        hour=floored_hour, minute=0, second=0, microsecond=0
    ).isoformat()


def _default_row_config(schema: dict) -> list:
    """
    Generate a minimal row_config from the form schema's fields array
    when no explicit iViewFlowsheet row_config has been configured.
    """
    fields = schema.get("fields", [])
    result = []
    for field in fields:
        if isinstance(field, dict):
            result.append({
                "field_id":  field.get("id", ""),
                "label":     field.get("label", ""),
                "unit":      field.get("unit", ""),
                "ref_range": field.get("ref_range", ""),
            })
    return result
