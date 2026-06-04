import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api/client'
import {
  Loader2, AlertCircle, FlaskConical, X, CheckCircle, Printer,
  Upload, FileText, AlertTriangle, ShieldCheck, Eye, ChevronDown
} from 'lucide-react'

const STATUS_BADGE = {
  pending:        { cls: 'badge-yellow',  label: 'Pending' },
  collected:      { cls: 'badge-blue',    label: 'Collected' },
  processing:     { cls: 'badge-purple',  label: 'Processing' },
  pending_review: { cls: 'badge-orange',  label: 'Pending Review' },
  signed:         { cls: 'badge-green',   label: 'Signed' },
  cancelled:      { cls: 'badge-gray',    label: 'Cancelled' },
}

const PRIORITY_BADGE = {
  routine: { cls: 'badge-gray',   label: 'Routine' },
  urgent:  { cls: 'badge-yellow', label: 'Urgent' },
  stat:    { cls: 'badge-red',    label: 'STAT' },
}

const FLAG_COLOR = { H: '#CC1414', HH: '#7f1d1d', L: '#1d4ed8', LL: '#1e3a8a', N: '#16a34a', A: '#d97706' }

// ── Collection Sheet Print ─────────────────────────────────────────────────────
function printCollectionSheet(sheet) {
  const w = window.open('', '_blank', 'width=600,height=700')
  w.document.write(`<!DOCTYPE html><html><head>
    <title>Collection Sheet — ${sheet.order_id}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h2   { color: #0F2557; margin-bottom: 4px; }
      .sub { color: #666; font-size: 12px; margin-bottom: 20px; }
      .box { border: 2px solid #0F2557; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
      .id  { font-size: 28px; font-weight: bold; color: #0F2557; letter-spacing: 2px; }
      table { width: 100%; border-collapse: collapse; }
      td,th { border: 1px solid #ddd; padding: 8px 12px; font-size: 13px; }
      th { background: #f0f4f8; text-align: left; }
      .note { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 6px; padding: 10px; font-size: 12px; margin-top: 16px; }
      @media print { button { display:none; } }
    </style></head><body>
    <h2>${sheet.clinic_name || 'BHaratCliniq'}</h2>
    <div class="sub">Sample Collection Sheet · ${new Date().toLocaleString('en-IN')}</div>
    <div class="box">
      <div class="id">${sheet.order_id}</div>
      <div style="font-size:12px;color:#666;margin-top:4px;">Enter this ID into the analyser before running</div>
    </div>
    <table>
      <tr><th>Patient</th><td>${sheet.patient_name}</td></tr>
      <tr><th>Age / Gender</th><td>${sheet.patient_age || '—'} / ${sheet.patient_gender || '—'}</td></tr>
      <tr><th>Doctor</th><td>${sheet.doctor_name || '—'}</td></tr>
      <tr><th>Tests Ordered</th><td>${(sheet.tests || []).join(', ') || '—'}</td></tr>
      <tr><th>Specimen</th><td>${sheet.specimen || '—'}</td></tr>
      <tr><th>Priority</th><td>${sheet.priority?.toUpperCase() || 'ROUTINE'}</td></tr>
      ${sheet.notes ? `<tr><th>Notes</th><td>${sheet.notes}</td></tr>` : ''}
    </table>
    <div class="note">⚠️ <strong>${sheet.instruction}</strong></div>
    <br/>
    <button onclick="window.print()">🖨 Print</button>
  </body></html>`)
  w.document.close()
  setTimeout(() => w.print(), 500)
}

// ── Sign Report Modal ──────────────────────────────────────────────────────────
function SignModal({ order, onClose, onSigned }) {
  const [interpretation, setInterpretation] = useState('')
  const [attested, setAttested]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const result = order.result

  const obs = result?.observations || []

  const submit = async () => {
    if (!attested) { setError('You must check the attestation box to sign.'); return }
    if (!interpretation.trim()) { setError('Interpretation is required before signing.'); return }
    setSaving(true); setError('')
    try {
      await api.post(`/lab-orders/${order.order_id}/sign`, { interpretation, order_id: result?.id })
      onSigned()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,37,87,0.6)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-bold text-lg" style={{ color: '#0F2557' }}>Review & Sign Report</h3>
            <p className="text-xs text-gray-500 mt-0.5">{order.order_id} · {order.patient_name}</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Observations table */}
          {obs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Results from Analyser</p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Test</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Value</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Unit</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Ref Range</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Flag</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {obs.map((o, i) => (
                      <tr key={i} className={o.flag && o.flag !== 'N' ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2 font-medium text-gray-800">{o.test_name || o.identifier || '—'}</td>
                        <td className="px-3 py-2 font-mono font-semibold" style={{ color: FLAG_COLOR[o.flag] || '#111' }}>{o.value}</td>
                        <td className="px-3 py-2 text-gray-500">{o.unit}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{o.ref_range}</td>
                        <td className="px-3 py-2">
                          {o.flag && o.flag !== 'N' && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: FLAG_COLOR[o.flag] + '20', color: FLAG_COLOR[o.flag] }}>
                              {o.flag}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Interpretation */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Clinical Interpretation <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={interpretation}
              onChange={e => setInterpretation(e.target.value)}
              placeholder="Enter your clinical interpretation and any relevant findings..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 resize-none"
            />
          </div>

          {/* Attestation */}
          <div className="rounded-xl p-4 border" style={{ background: '#0F25570A', borderColor: '#0F255730' }}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-blue-900 flex-shrink-0" />
              <span className="text-sm" style={{ color: '#0F2557' }}>
                I have reviewed this report and attest to its accuracy. I understand this constitutes my
                digital signature under the IT Act 2000 and am accountable for this report.
              </span>
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-medium text-gray-600">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50"
            style={{ background: '#0F2557' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {saving ? 'Signing…' : 'Sign & Release Report'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PDF Upload Modal ───────────────────────────────────────────────────────────
function PDFUploadModal({ order, onClose, onUploaded }) {
  const [file, setFile]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const fileRef = useRef()

  const submit = async () => {
    if (!file) { setError('Select a PDF file first.'); return }
    setSaving(true); setError('')
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })
      await api.post(`/lab-orders/${order.order_id}/upload-pdf`, { pdf_b64: b64 })
      onUploaded(); onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,37,87,0.6)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg" style={{ color: '#0F2557' }}>Upload PDF Result</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{order.order_id} · {order.patient_name}</p>
        {file ? (
          <div className="flex items-center gap-3 px-4 py-3 border border-green-300 rounded-xl bg-green-50 mb-4">
            <FileText size={16} className="text-green-600" />
            <span className="text-sm text-green-700 truncate flex-1">{file.name}</span>
            <button onClick={() => setFile(null)}><X size={14} className="text-gray-400" /></button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2 mb-4">
            <Upload size={16} /> Select PDF file
          </button>
        )}
        <input ref={fileRef} type="file" accept=".pdf" className="hidden"
          onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); e.target.value = '' }} />
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-medium text-gray-600">Cancel</button>
          <button onClick={submit} disabled={saving || !file}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: '#CC1414' }}>
            {saving ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Order Detail Row ───────────────────────────────────────────────────────────
function OrderRow({ order, onPrintSheet, onSign, onUploadPDF, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const sb = STATUS_BADGE[order.status] || STATUS_BADGE.pending
  const pb = PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.routine
  const result = order.result

  return (
    <>
      <tr className="tr-hover cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <td className="td font-mono text-xs font-semibold" style={{ color: '#0F2557' }}>{order.order_id}</td>
        <td className="td">
          <div className="font-medium text-gray-800">{order.patient_name}</div>
          <div className="text-xs text-gray-400">{order.patient_age ? `${order.patient_age}y` : ''} {order.patient_gender || ''}</div>
        </td>
        <td className="td">
          <div className="flex flex-wrap gap-1">
            {(order.test_names || []).map(t => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{t}</span>
            ))}
          </div>
        </td>
        <td className="td"><span className={`badge ${pb.cls}`}>{pb.label}</span></td>
        <td className="td"><span className={`badge ${sb.cls}`}>{sb.label}</span></td>
        <td className="td text-xs text-gray-500">
          {order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
        </td>
        <td className="td" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => onPrintSheet(order)}
              className="p-1.5 rounded-lg hover:bg-gray-100" title="Print Collection Sheet">
              <Printer size={14} className="text-gray-500" />
            </button>
            {order.status === 'pending_review' && result && result.status !== 'signed' && (
              <button onClick={() => onSign(order)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white"
                style={{ background: '#0F2557' }}>
                <ShieldCheck size={11} className="inline mr-1" />Sign
              </button>
            )}
            {order.status !== 'signed' && (
              <button onClick={() => onUploadPDF(order)}
                className="p-1.5 rounded-lg hover:bg-gray-100" title="Upload PDF">
                <Upload size={14} className="text-gray-500" />
              </button>
            )}
            {result?.status === 'signed' && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle size={12} />Signed
              </span>
            )}
          </div>
        </td>
      </tr>
      {expanded && result && (
        <tr>
          <td colSpan={7} className="px-6 py-4 bg-gray-50 border-b">
            <div className="text-xs text-gray-500 mb-2 font-semibold uppercase">Result Details</div>
            {(result.observations || []).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {(result.observations || []).map((o, i) => (
                  <div key={i} className={`p-2 rounded-lg border text-xs ${o.flag && o.flag !== 'N' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                    <div className="text-gray-500 truncate">{o.test_name || o.identifier}</div>
                    <div className="font-bold text-base mt-0.5" style={{ color: FLAG_COLOR[o.flag] || '#111' }}>
                      {o.value} <span className="text-xs font-normal text-gray-400">{o.unit}</span>
                    </div>
                    <div className="text-gray-400 text-xs">{o.ref_range}</div>
                  </div>
                ))}
              </div>
            ) : result.has_pdf ? (
              <p className="text-sm text-gray-500">PDF report uploaded. Available after signing.</p>
            ) : (
              <p className="text-sm text-gray-400">No structured results yet.</p>
            )}
            {result.interpretation && (
              <div className="mt-3 p-3 rounded-xl text-sm" style={{ background: '#0F25570A' }}>
                <span className="font-semibold text-gray-700">Interpretation: </span>{result.interpretation}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Unmatched Queue ────────────────────────────────────────────────────────────
function UnmatchedQueue({ orders, onResolved }) {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(null)
  const [orderId, setOrderId] = useState('')

  useEffect(() => {
    api.get('/lab-orders/unmatched')
      .then(r => setItems(Array.isArray(r) ? r : []))
      .finally(() => setLoading(false))
  }, [])

  const resolve = async (id) => {
    if (!orderId.trim()) { alert('Enter the ORDER ID to link to'); return }
    const order = orders.find(o => o.order_id === orderId.trim().toUpperCase())
    if (!order) { alert('Order ID not found. Check the ID and try again.'); return }
    setLinking(id)
    try {
      await api.post('/lab-orders/unmatched/resolve', { unmatched_id: id, lab_order_id: order.id })
      setItems(prev => prev.filter(i => i.id !== id))
      onResolved()
    } catch (err) {
      alert(err.message)
    } finally {
      setLinking(null); setOrderId('')
    }
  }

  if (loading) return null
  if (!items.length) return null

  return (
    <div className="mb-6 border border-yellow-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-yellow-50 border-b border-yellow-200">
        <AlertTriangle size={16} className="text-yellow-600" />
        <span className="font-semibold text-yellow-800 text-sm">{items.length} Unmatched Result{items.length > 1 ? 's' : ''} — Manual Linking Required</span>
      </div>
      <div className="divide-y divide-yellow-100">
        {items.map(item => (
          <div key={item.id} className="px-4 py-3 bg-yellow-50/50 flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500">{item.source} · {item.raw_format}</div>
              <div className="text-sm font-medium text-gray-800 truncate">{item.patient_hint || 'Unknown patient'}</div>
              <div className="text-xs text-gray-400">{item.created_at ? new Date(item.created_at).toLocaleString('en-IN') : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <input value={orderId} onChange={e => setOrderId(e.target.value)}
                placeholder="ORDER ID e.g. LAB-00001"
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-400 w-36" />
              <button onClick={() => resolve(item.id)} disabled={linking === item.id}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white disabled:opacity-50"
                style={{ background: '#F5821E' }}>
                {linking === item.id ? 'Linking…' : 'Link'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'pending_review', label: 'Review' },
  { key: 'signed', label: 'Signed' },
]

export default function Orders() {
  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [tab, setTab]             = useState('')
  const [signOrder, setSignOrder] = useState(null)
  const [pdfOrder, setPdfOrder]   = useState(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = tab ? { status: tab } : {}
      const data = await api.get('/lab-orders', { params })
      // For each order with a result, expand result details
      const detailed = await Promise.all(
        (Array.isArray(data) ? data : []).map(async o => {
          if (o.has_result) {
            try {
              const d = await api.get(`/lab-orders/${o.order_id}`)
              return d
            } catch { return o }
          }
          return o
        })
      )
      setOrders(detailed)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const printSheet = async (order) => {
    try {
      const sheet = await api.get(`/lab-orders/${order.order_id}/collection-sheet`)
      printCollectionSheet(sheet)
    } catch (err) { alert(err.message) }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Lab Orders</h1>
      </div>

      <UnmatchedQueue orders={orders} onResolved={fetchOrders} />

      {/* Status tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-xl border border-gray-200 p-1 w-fit shadow-sm">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            style={tab === t.key ? { background: '#0F2557' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-300" /></div>}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="card p-16 text-center">
          <FlaskConical size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No orders found</p>
          <p className="text-gray-400 text-sm mt-1">Orders appear here when doctors order tests for patients.</p>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="card overflow-hidden">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="th">Order ID</th>
                <th className="th">Patient</th>
                <th className="th">Tests</th>
                <th className="th">Priority</th>
                <th className="th">Status</th>
                <th className="th">Date</th>
                <th className="th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(order => (
                <OrderRow key={order.id} order={order}
                  onPrintSheet={printSheet}
                  onSign={o => setSignOrder(o)}
                  onUploadPDF={o => setPdfOrder(o)}
                  onRefresh={fetchOrders}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {signOrder && <SignModal order={signOrder} onClose={() => setSignOrder(null)} onSigned={fetchOrders} />}
      {pdfOrder  && <PDFUploadModal order={pdfOrder} onClose={() => setPdfOrder(null)} onUploaded={fetchOrders} />}
    </div>
  )
}
