"""
Simple SMTP email sender — env-driven, no-ops gracefully when unconfigured.

Env vars:
    SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD,
    SMTP_FROM (default = SMTP_USER), SMTP_USE_TLS (default true)
"""
import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)


def _smtp_config():
    host = os.getenv("SMTP_HOST")
    user = os.getenv("SMTP_USER")
    if not host or not user:
        return None
    return {
        "host": host,
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": user,
        "password": os.getenv("SMTP_PASSWORD", ""),
        "from": os.getenv("SMTP_FROM", user),
        "use_tls": os.getenv("SMTP_USE_TLS", "true").lower() != "false",
    }


def send_email(to: str, subject: str, html_body: str) -> bool:
    """Send one HTML email. Returns True if sent, False if skipped/failed."""
    cfg = _smtp_config()
    if not cfg:
        logger.info(f"[email] SMTP not configured — skipping email to {to}: {subject}")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = cfg["from"]
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=20) as server:
            if cfg["use_tls"]:
                server.starttls()
            if cfg["password"]:
                server.login(cfg["user"], cfg["password"])
            server.sendmail(cfg["from"], [to], msg.as_string())
        return True
    except Exception as e:
        logger.error(f"[email] Failed to send to {to}: {e}")
        return False


def send_schedule_email(to: str, staff_name: str, clinic_name: str,
                        week_start: str, week_end: str, shifts: list) -> bool:
    """Send a staff member their published shifts for the week.

    shifts: [{date: '2026-06-15', day: 'Mon', shift: 'Morning', time: '06:00–14:00'}]
    """
    rows = "".join(
        f"<tr><td style='padding:6px 12px;border:1px solid #e5e7eb'>{s['day']} {s['date']}</td>"
        f"<td style='padding:6px 12px;border:1px solid #e5e7eb'><b>{s['shift']}</b></td>"
        f"<td style='padding:6px 12px;border:1px solid #e5e7eb'>{s['time']}</td></tr>"
        for s in shifts
    ) or "<tr><td colspan='3' style='padding:6px 12px'>No shifts this week — you are off.</td></tr>"

    html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#0F2557;color:#fff;padding:16px 24px;border-radius:12px 12px 0 0">
        <h2 style="margin:0;font-size:18px">Your Schedule — {clinic_name}</h2>
        <p style="margin:4px 0 0;font-size:13px;color:#cbd5e1">{week_start} to {week_end}</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:20px 24px;border-radius:0 0 12px 12px">
        <p style="font-size:14px">Hi <b>{staff_name}</b>, your shifts for the week have been published:</p>
        <table style="border-collapse:collapse;width:100%;font-size:13px">
          <tr style="background:#f1f5f9">
            <th style="padding:6px 12px;border:1px solid #e5e7eb;text-align:left">Date</th>
            <th style="padding:6px 12px;border:1px solid #e5e7eb;text-align:left">Shift</th>
            <th style="padding:6px 12px;border:1px solid #e5e7eb;text-align:left">Timing</th>
          </tr>
          {rows}
        </table>
        <p style="font-size:12px;color:#6b7280;margin-top:16px">
          Questions about your schedule? Contact your manager.<br/>
          — BHarath Health Scheduler
        </p>
      </div>
    </div>
    """
    return send_email(to, f"Your shifts: {week_start} – {week_end} · {clinic_name}", html)


def send_whatsapp_schedule(mobile: str, staff_name: str, shifts: list) -> bool:
    """WhatsApp delivery — stub for future integration (WhatsApp Business API).

    When scaling: implement via Meta Cloud API / Gupshup / Twilio here.
    The publish flow already calls this, so wiring it up later is one function.
    """
    logger.info(f"[whatsapp] Stub — would send schedule to {mobile} ({staff_name})")
    return False
