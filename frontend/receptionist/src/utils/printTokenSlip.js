/**
 * printTokenSlip - Prints a compact token slip (half-A4 / index-card size).
 * Uses the browser print API — no external dependencies.
 *
 * @param {Object} params
 * @param {string|number} params.tokenNumber  - Queue token number (displayed very large)
 * @param {string} params.patientName         - Patient's full name
 * @param {string} [params.uhid]              - Universal Health ID
 * @param {string} [params.bhId]              - BHarath Health BH-ID
 * @param {string} params.doctorName          - Consulting doctor's name
 * @param {string} params.clinicName          - Clinic / hospital name
 * @param {string} [params.branchName]        - Branch / location name
 * @param {string} params.date                - Appointment / visit date (formatted string)
 * @param {string} params.time                - Token time / appointment time (formatted string)
 */
export function printTokenSlip({
  tokenNumber,
  patientName,
  uhid,
  bhId,
  doctorName,
  clinicName,
  branchName,
  date,
  time,
}) {
  const idLine = [uhid ? `UHID: ${esc(uhid)}` : '', bhId ? `BH ID: ${esc(bhId)}` : '']
    .filter(Boolean)
    .join(' &nbsp;|&nbsp; ');

  const branchLine = branchName ? `${esc(clinicName)} &mdash; ${esc(branchName)}` : esc(clinicName || '');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Token Slip - ${esc(String(tokenNumber || ''))}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* Half-A4 slip — fits two per A4 sheet when printed */
    @page { size: A5 landscape; margin: 8mm 10mm; }

    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: #1a1a1a;
      background: #fff;
      width: 100%;
      max-width: 200mm;
    }

    /* ── BHarath Health header ── */
    .bc-header {
      background: linear-gradient(135deg, #1a56db 0%, #0e9f6e 100%);
      color: #fff;
      text-align: center;
      padding: 10px 16px 8px;
      border-radius: 6px 6px 0 0;
    }
    .bc-brand {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .bc-tagline {
      font-size: 10px;
      opacity: 0.85;
      margin-top: 2px;
    }

    /* ── Token box ── */
    .token-section {
      background: #fff7ed;
      border: 3px solid #f97316;
      border-top: none;
      text-align: center;
      padding: 16px 12px 10px;
    }
    .token-label {
      font-size: 11px;
      font-weight: 600;
      color: #9a3412;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .token-number {
      font-size: 72px;
      font-weight: 800;
      color: #f97316;
      line-height: 1;
      margin: 4px 0 6px;
      letter-spacing: -2px;
    }
    .token-box-inner {
      display: inline-block;
      background: #f97316;
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 16px;
      border-radius: 20px;
      letter-spacing: 0.5px;
    }

    /* ── Patient / appointment details ── */
    .details {
      border: 1px solid #e5e7eb;
      border-top: none;
      padding: 10px 14px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 4px 0;
      border-bottom: 1px dashed #f3f4f6;
      font-size: 11.5px;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label {
      font-weight: 600;
      color: #6b7280;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      flex-shrink: 0;
      margin-right: 8px;
    }
    .detail-val { color: #111827; font-weight: 500; text-align: right; }

    /* ── Wait message ── */
    .wait-msg {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-top: none;
      text-align: center;
      padding: 8px 12px;
      font-size: 11px;
      color: #166534;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    /* ── Footer ── */
    .slip-footer {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-top: 2px solid #1a56db;
      text-align: center;
      padding: 6px 12px;
      border-radius: 0 0 6px 6px;
      font-size: 10px;
      color: #374151;
    }
    .slip-footer .branch { font-weight: 600; }

    @media print {
      html, body { width: 200mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <div class="bc-header">
    <div class="bc-brand">BHarath Health</div>
    <div class="bc-tagline">Your Health, Our Priority</div>
  </div>

  <div class="token-section">
    <div class="token-label">Your Token Number</div>
    <div class="token-number">${esc(String(tokenNumber || '—'))}</div>
    <div class="token-box-inner">Please wait for your number to be called</div>
  </div>

  <div class="details">
    <div class="detail-row">
      <span class="detail-label">Patient</span>
      <span class="detail-val">${esc(patientName || '')}</span>
    </div>
    ${idLine ? `<div class="detail-row">
      <span class="detail-label">ID</span>
      <span class="detail-val">${idLine}</span>
    </div>` : ''}
    <div class="detail-row">
      <span class="detail-label">Doctor</span>
      <span class="detail-val">Dr.&nbsp;${esc(doctorName || '')}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Date</span>
      <span class="detail-val">${esc(date || '')}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Time</span>
      <span class="detail-val">${esc(time || '')}</span>
    </div>
  </div>

  <div class="wait-msg">
    &#9203;&nbsp; Please wait — your token will be announced shortly.
  </div>

  <div class="slip-footer">
    <span class="branch">${branchLine}</span>
  </div>

  <script>
    window.onload = function () {
      window.print();
      window.onafterprint = function () { window.close(); };
    };
  </script>
</body>
</html>`;

  openPrintWindow(html);
}

/* ── Internal helpers ─────────────────────────────────────────────────────── */

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function openPrintWindow(html) {
  const win = window.open('', '_blank', 'width=520,height=700');
  if (!win) {
    // eslint-disable-next-line no-alert
    alert('Pop-up blocked. Please allow pop-ups for this site to enable printing.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
