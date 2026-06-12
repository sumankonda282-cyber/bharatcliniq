"""
Idempotent loader for the medical terminology library.

Loads on every boot but skips any section that is already populated, so a
normal restart adds nothing. Sources:
  - Full WHO ICD-10 reference (~12k codes) from the `simple-icd-10` package
  - Curated India-priority data from app/seed_data/* (diseases, symptoms,
    allergies, drugs, interactions, dose ranges, contraindications)

Every curated ICD-10 code is validated against the package before insert;
invalid codes are skipped and logged, never inserted.
"""
import re
from sqlalchemy import text
from app.db.session import engine

ICD10_URI = "http://hl7.org/fhir/sid/icd-10"
SNOMED_URI = "http://snomed.info/sct"
BATCH = 500


def _count(conn, sql, **params):
    return conn.execute(text(sql), params).scalar() or 0


def _batched_insert(conn, sql, rows):
    for i in range(0, len(rows), BATCH):
        conn.execute(text(sql), rows[i:i + BATCH])


def _ensure_trgm(conn):
    """Best-effort fuzzy-search support; search degrades to ILIKE without it."""
    for sql in [
        "CREATE EXTENSION IF NOT EXISTS pg_trgm",
        "CREATE INDEX IF NOT EXISTS idx_medterms_display_trgm ON medical_terms USING gin (display gin_trgm_ops)",
        "CREATE INDEX IF NOT EXISTS idx_medterms_syn_trgm ON medical_terms USING gin (synonyms gin_trgm_ops)",
    ]:
        try:
            conn.execute(text(sql))
        except Exception as e:
            print(f"[medlib] trgm setup skipped: {e}")


def seed_icd10_reference():
    import simple_icd_10 as icd
    with engine.begin() as conn:
        existing = _count(conn, "SELECT count(*) FROM medical_terms WHERE tier='reference'")
        if existing >= 10000:
            print(f"[medlib] ICD-10 reference already loaded ({existing} rows) — skipping")
            return
        codes = [c for c in icd.get_all_codes(True) if re.match(r"^[A-Z]\d{2}", c)]
        rows = [
            {"system": ICD10_URI, "code": c, "display": icd.get_description(c)[:300]}
            for c in codes
        ]
        _batched_insert(
            conn,
            "INSERT INTO medical_terms (system, code, display, category, tier, is_active) "
            "VALUES (:system, :code, :display, 'condition', 'reference', TRUE)",
            rows,
        )
        print(f"[medlib] ICD-10 reference loaded: {len(rows)} codes")


def seed_curated_terms():
    import simple_icd_10 as icd

    def valid(code):
        try:
            return bool(code) and icd.is_valid_item(code)
        except Exception:
            return False

    sections = []
    try:
        from app.seed_data.diseases import DISEASES
        sections.append(("condition", DISEASES, True))
    except ImportError as e:
        print(f"[medlib] diseases seed missing: {e}")
    try:
        from app.seed_data.symptoms import SYMPTOMS
        sections.append(("symptom", SYMPTOMS, False))
    except ImportError as e:
        print(f"[medlib] symptoms seed missing: {e}")

    with engine.begin() as conn:
        for category, items, code_required in sections:
            existing = _count(
                conn,
                "SELECT count(*) FROM medical_terms WHERE tier='curated' AND category=:c",
                c=category,
            )
            if existing >= min(50, len(items) // 2):
                print(f"[medlib] curated {category}s already loaded ({existing}) — skipping")
                continue
            rows, skipped = [], 0
            for it in items:
                code = (it.get("icd10") or "").strip() or None
                if code and not valid(code):
                    skipped += 1
                    code = None
                if code_required and code is None:
                    continue
                rows.append({
                    "system": ICD10_URI if code else "custom",
                    "code": code,
                    "display": it["display"][:300],
                    "category": category,
                    "specialty": it.get("specialty"),
                    "synonyms": it.get("synonyms"),
                })
            _batched_insert(
                conn,
                "INSERT INTO medical_terms (system, code, display, category, specialty, synonyms, tier, is_active) "
                "VALUES (:system, :code, :display, :category, :specialty, :synonyms, 'curated', TRUE)",
                rows,
            )
            print(f"[medlib] curated {category}s loaded: {len(rows)} (invalid ICD-10 dropped/kept-uncoded: {skipped})")

    try:
        from app.seed_data.allergies import ALLERGENS
    except ImportError as e:
        print(f"[medlib] allergies seed missing: {e}")
        return
    with engine.begin() as conn:
        existing = _count(conn, "SELECT count(*) FROM medical_terms WHERE category='allergy'")
        if existing >= 40:
            print(f"[medlib] allergens already loaded ({existing}) — skipping")
            return
        rows = [{
            "system": SNOMED_URI if a.get("snomed") else "custom",
            "code": a.get("snomed"),
            "display": a["display"][:300],
            "group_label": a.get("group"),
        } for a in ALLERGENS]
        _batched_insert(
            conn,
            "INSERT INTO medical_terms (system, code, display, category, group_label, tier, is_active) "
            "VALUES (:system, :code, :display, 'allergen', :group_label, 'curated', TRUE)",
            rows,
        )
        print(f"[medlib] allergens loaded: {len(rows)}")


def seed_drug_data():
    loaders = []
    try:
        from app.seed_data.drugs import DRUGS
        loaders.append((
            "drugs", DRUGS, 100,
            "INSERT INTO drugs (generic, atc, drug_class, routes, brands, rx_only) "
            "VALUES (:generic, :atc, :drug_class, :routes, :brands, :rx_only)",
            lambda d: {
                "generic": d["generic"][:200], "atc": d.get("atc"),
                "drug_class": d.get("drug_class"), "routes": d.get("routes"),
                "brands": d.get("brands"), "rx_only": d.get("rx_only", True),
            },
        ))
    except ImportError as e:
        print(f"[medlib] drugs seed missing: {e}")
    try:
        from app.seed_data.interactions import INTERACTIONS
        loaders.append((
            "drug_interactions", INTERACTIONS, 50,
            "INSERT INTO drug_interactions (drug_a, drug_b, severity, effect, management) "
            "VALUES (:drug_a, :drug_b, :severity, :effect, :management)",
            lambda d: {
                "drug_a": d["drug_a"][:200], "drug_b": d["drug_b"][:200],
                "severity": d["severity"], "effect": d.get("effect"),
                "management": d.get("management"),
            },
        ))
    except ImportError as e:
        print(f"[medlib] interactions seed missing: {e}")
    try:
        from app.seed_data.dose_ranges import DOSE_RANGES
        loaders.append((
            "drug_dose_ranges", DOSE_RANGES, 40,
            "INSERT INTO drug_dose_ranges (generic, route, population, max_single_mg, max_daily_mg, unit, note) "
            "VALUES (:generic, :route, :population, :max_single_mg, :max_daily_mg, :unit, :note)",
            lambda d: {
                "generic": d["generic"][:200], "route": d.get("route", "oral"),
                "population": d.get("population", "adult"),
                "max_single_mg": d.get("max_single_mg"), "max_daily_mg": d.get("max_daily_mg"),
                "unit": d.get("unit", "mg"), "note": d.get("note"),
            },
        ))
    except ImportError as e:
        print(f"[medlib] dose ranges seed missing: {e}")
    try:
        from app.seed_data.contraindications import CONTRAINDICATIONS
        loaders.append((
            "drug_contraindications", CONTRAINDICATIONS, 40,
            "INSERT INTO drug_contraindications (generic, icd10_prefix, condition, severity, reason) "
            "VALUES (:generic, :icd10_prefix, :condition, :severity, :reason)",
            lambda d: {
                "generic": d["generic"][:200], "icd10_prefix": d["icd10_prefix"][:10],
                "condition": d.get("condition"), "severity": d.get("severity", "serious"),
                "reason": d.get("reason"),
            },
        ))
    except ImportError as e:
        print(f"[medlib] contraindications seed missing: {e}")

    for table, items, floor, sql, mapper in loaders:
        with engine.begin() as conn:
            existing = _count(conn, f"SELECT count(*) FROM {table}")
            if existing >= floor:
                print(f"[medlib] {table} already loaded ({existing}) — skipping")
                continue
            rows = [mapper(d) for d in items]
            _batched_insert(conn, sql, rows)
            print(f"[medlib] {table} loaded: {len(rows)}")


def main():
    steps = [
        ("icd10 reference", seed_icd10_reference),
        ("curated terms", seed_curated_terms),
        ("drug data", seed_drug_data),
    ]
    for name, fn in steps:
        try:
            fn()
        except Exception as e:
            print(f"[medlib] {name} failed (non-fatal): {e}")
    try:
        with engine.begin() as conn:
            _ensure_trgm(conn)
    except Exception as e:
        print(f"[medlib] trgm setup failed (non-fatal): {e}")
    print("[medlib] Medical library load complete.")


if __name__ == "__main__":
    main()
