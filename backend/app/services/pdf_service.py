from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table,
    TableStyle, HRFlowable
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from io import BytesIO
from datetime import datetime

PRIMARY    = colors.HexColor("#1a73e8")
LIGHT_BLUE = colors.HexColor("#e8f0fe")
DARK       = colors.HexColor("#1a1a2e")
GRAY       = colors.HexColor("#6c757d")
RED        = colors.HexColor("#dc3545")
GREEN      = colors.HexColor("#198754")


def _base_doc(buffer) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=15*mm, leftMargin=15*mm,
        topMargin=15*mm, bottomMargin=15*mm
    )


def _styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle("AppName",   fontSize=18, fontName="Helvetica-Bold", textColor=PRIMARY))
    s.add(ParagraphStyle("Clinic",    fontSize=11, fontName="Helvetica-Bold", textColor=DARK))
    s.add(ParagraphStyle("Sub",       fontSize=8,  textColor=GRAY))
    s.add(ParagraphStyle("DocTitle",  fontSize=13, fontName="Helvetica-Bold", textColor=DARK, alignment=TA_CENTER))
    s.add(ParagraphStyle("Label",     fontSize=8,  fontName="Helvetica-Bold", textColor=DARK))
    s.add(ParagraphStyle("Body",      fontSize=9,  textColor=DARK))
    s.add(ParagraphStyle("RightSm",   fontSize=8,  textColor=GRAY, alignment=TA_RIGHT))
    return s


def _header(story, styles, clinic_name, branch_name, address, doc_type):
    story.append(Paragraph("BharatHealth", styles["AppName"]))
    story.append(Paragraph(f"{clinic_name}  ·  {branch_name}", styles["Clinic"]))
    story.append(Paragraph(address, styles["Sub"]))
    story.append(Spacer(1, 3*mm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(doc_type, styles["DocTitle"]))
    story.append(Spacer(1, 4*mm))


def _patient_table(patient_name, uhid, age, gender, doctor, date_str):
    data = [
        ["Patient Name", patient_name or "—",  "UHID",    uhid or "—"],
        ["Age / Gender",  f"{age or '—'} / {gender or '—'}", "Doctor", doctor or "—"],
        ["Date",          date_str,              "",        ""],
    ]
    t = Table(data, colWidths=[32*mm, 68*mm, 22*mm, 58*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), LIGHT_BLUE),
        ("FONTNAME",     (0,0), (0,-1),  "Helvetica-Bold"),
        ("FONTNAME",     (2,0), (2,-1),  "Helvetica-Bold"),
        ("FONTSIZE",     (0,0), (-1,-1), 8),
        ("GRID",         (0,0), (-1,-1), 0.3, colors.white),
        ("PADDING",      (0,0), (-1,-1), 4),
        ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
    ]))
    return t


def generate_prescription_pdf(pres: dict, patient: dict, clinic: dict) -> bytes:
    buf = BytesIO()
    doc = _base_doc(buf)
    s = _styles()
    story = []

    _header(story, s, clinic.get("clinic_name",""), clinic.get("branch_name",""),
            clinic.get("address",""), "PRESCRIPTION")

    story.append(_patient_table(
        patient.get("full_name"), patient.get("uhid"),
        patient.get("age"), patient.get("gender"),
        clinic.get("doctor_name"),
        datetime.now().strftime("%d %b %Y")
    ))
    story.append(Spacer(1, 5*mm))

    if patient.get("allergies"):
        story.append(Paragraph(f"⚠ Allergies: {patient['allergies']}", ParagraphStyle(
            "Alert", fontSize=8, textColor=RED, fontName="Helvetica-Bold",
            backColor=colors.HexColor("#fff3cd"), borderPad=3
        )))
        story.append(Spacer(1, 3*mm))

    rows = [["#", "Medicine", "Dosage", "Frequency", "Duration", "Instructions"]]
    for i, item in enumerate(pres.get("items", []), 1):
        rows.append([str(i), item.get("medicine_name",""),
                     item.get("dosage",""), item.get("frequency",""),
                     item.get("duration",""), item.get("instructions","") or ""])

    t = Table(rows, colWidths=[7*mm, 50*mm, 28*mm, 28*mm, 22*mm, 45*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0), PRIMARY),
        ("TEXTCOLOR",     (0,0), (-1,0), colors.white),
        ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, LIGHT_BLUE]),
        ("GRID",          (0,0), (-1,-1), 0.3, colors.lightgrey),
        ("PADDING",       (0,0), (-1,-1), 4),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(t)

    if pres.get("notes"):
        story.append(Spacer(1,3*mm))
        story.append(Paragraph(f"Notes: {pres['notes']}", s["Body"]))

    story.append(Spacer(1, 12*mm))
    story.append(HRFlowable(width="60mm", thickness=0.5, color=DARK, hAlign="RIGHT"))
    story.append(Paragraph(f"Dr. {clinic.get('doctor_name','')}", ParagraphStyle(
        "Sign", fontSize=9, fontName="Helvetica-Bold", alignment=TA_RIGHT)))
    story.append(Paragraph("Signature & Stamp", ParagraphStyle(
        "SignSub", fontSize=7, textColor=GRAY, alignment=TA_RIGHT)))

    doc.build(story)
    return buf.getvalue()


def generate_lab_report_pdf(order: dict, patient: dict, clinic: dict) -> bytes:
    buf = BytesIO()
    doc = _base_doc(buf)
    s = _styles()
    story = []

    _header(story, s, clinic.get("clinic_name",""), clinic.get("branch_name",""),
            clinic.get("address",""), "LAB REPORT")
    story.append(_patient_table(
        patient.get("full_name"), patient.get("uhid"),
        patient.get("age"), patient.get("gender"),
        clinic.get("doctor_name"),
        datetime.now().strftime("%d %b %Y")
    ))
    story.append(Spacer(1, 5*mm))

    rows = [["Test Name", "Result", "Unit", "Normal Range", "Status"]]
    for item in order.get("items", []):
        status = "ABNORMAL" if item.get("is_abnormal") else "Normal"
        rows.append([
            item.get("test_name",""),
            item.get("result_value","Pending"),
            item.get("unit",""),
            item.get("normal_range",""),
            status,
        ])

    t = Table(rows, colWidths=[55*mm, 35*mm, 20*mm, 45*mm, 25*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0), PRIMARY),
        ("TEXTCOLOR",     (0,0), (-1,0), colors.white),
        ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, LIGHT_BLUE]),
        ("GRID",          (0,0), (-1,-1), 0.3, colors.lightgrey),
        ("PADDING",       (0,0), (-1,-1), 4),
        ("TEXTCOLOR",     (4,1), (4,-1), RED),
    ]))
    story.append(t)
    story.append(Spacer(1, 8*mm))
    story.append(Paragraph("Verified by Lab Technician", ParagraphStyle(
        "Sign2", fontSize=9, fontName="Helvetica-Bold", alignment=TA_RIGHT)))

    doc.build(story)
    return buf.getvalue()


def generate_invoice_pdf(inv: dict, patient: dict, clinic: dict) -> bytes:
    buf = BytesIO()
    doc = _base_doc(buf)
    s = _styles()
    story = []

    _header(story, s, clinic.get("clinic_name",""), clinic.get("branch_name",""),
            clinic.get("address",""), "INVOICE")

    story.append(Paragraph(f"Invoice No: {inv.get('invoice_number','')}", s["Clinic"]))
    story.append(Spacer(1, 2*mm))

    meta = [
        ["Patient", patient.get("full_name",""), "UHID", patient.get("uhid","")],
        ["Date", inv.get("date", datetime.now().strftime("%d %b %Y")),
         "Payment", inv.get("payment_method","")],
    ]
    mt = Table(meta, colWidths=[28*mm, 67*mm, 22*mm, 63*mm])
    mt.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), LIGHT_BLUE),
        ("FONTNAME",  (0,0),(0,-1), "Helvetica-Bold"),
        ("FONTNAME",  (2,0),(2,-1), "Helvetica-Bold"),
        ("FONTSIZE",  (0,0),(-1,-1), 8),
        ("GRID",      (0,0),(-1,-1), 0.3, colors.white),
        ("PADDING",   (0,0),(-1,-1), 4),
    ]))
    story.append(mt)
    story.append(Spacer(1, 5*mm))

    rows = [["Description", "Type", "Qty", "Unit Price", "Total"]]
    for item in inv.get("items", []):
        rows.append([
            item.get("description",""),
            item.get("item_type",""),
            str(item.get("quantity",1)),
            f"\u20b9{item.get('unit_price',0):.2f}",
            f"\u20b9{item.get('total',0):.2f}",
        ])

    t = Table(rows, colWidths=[75*mm, 30*mm, 14*mm, 30*mm, 31*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0), PRIMARY),
        ("TEXTCOLOR",     (0,0), (-1,0), colors.white),
        ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, LIGHT_BLUE]),
        ("GRID",          (0,0), (-1,-1), 0.3, colors.lightgrey),
        ("ALIGN",         (2,0), (-1,-1), "RIGHT"),
        ("PADDING",       (0,0), (-1,-1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 4*mm))

    summary = [
        ["Subtotal",    f"\u20b9{inv.get('subtotal',0):.2f}"],
        ["Discount",    f"- \u20b9{inv.get('discount',0):.2f}"],
        ["Tax",         f"\u20b9{inv.get('tax',0):.2f}"],
        ["TOTAL",       f"\u20b9{inv.get('total',0):.2f}"],
        ["Amount Paid", f"\u20b9{inv.get('amount_paid',0):.2f}"],
    ]
    ts = Table(summary, colWidths=[140*mm, 40*mm])
    ts.setStyle(TableStyle([
        ("ALIGN",    (0,0), (-1,-1), "RIGHT"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("FONTNAME", (0,3), (1,3),   "Helvetica-Bold"),
        ("FONTSIZE", (0,3), (1,3),   11),
        ("TEXTCOLOR",(0,3), (1,3),   PRIMARY),
        ("LINEABOVE",(0,3), (-1,3),  1, PRIMARY),
        ("PADDING",  (0,0), (-1,-1), 3),
    ]))
    story.append(ts)
    doc.build(story)
    return buf.getvalue()
