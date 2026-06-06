import { useState, useEffect, useCallback } from 'react'
import api from '../../api/client'
import {
  Banknote, Plus, Trash2, Printer, CheckCircle, CreditCard,
  BedDouble, AlertCircle, RefreshCw, X
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = v => '₹ ' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

const CHARGE_COLORS = {
  room:         'bg-indigo-100 text-indigo-800',
  procedure:    'bg-orange-100 text-orange-800',
  consultation: 'bg-blue-100 text-blue-800',
  lab:          'bg-purple-100 text-purple-800',
  imaging:      'bg-teal-100 text-teal-800',
  pharmacy:     'bg-green-100 text-green-800',
  misc:         'bg-gray-100 text-gray-700',
}

const CHARGE_TYPES = ['room', 'procedure', 'consultation', 'lab', 'imaging', 'pharmacy', 'misc']

const BILL_STATUS_STYLES = {
  draft:          'bg-gray-100 text-gray-700',
  finalized:      'bg-blue-100 text-blue-800',
  paid:           'bg-green-100 text-green-800',
  partially_paid: 'bg-orange-100 text-orange-800',
}

const BILL_STATUS_LABELS = {
  draft:          'Draft',
  finalized:      'Finalized',
  paid:           'Paid',
  partially_paid: 'Partial',
}

function TypeBadge({ type }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${CHARGE_COLORS[type] || 'bg-gray-100 text-gray-700'}`}>
      {type}
    </span>
  )
}

function BillStatusBadge({ status }) {
  if (!status) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">No Bill</span>
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${BILL_STATUS_STYLES[status] || 'bg-gray-100 text-gray-700'}`}>
      {BILL_STATUS_LABELS[status] || status}
    </span>
  )
}

// ── Days Admitted Counter ─────────────────────────────────────────────────────
function DaysCounter({ admission }) {
  if (!admission) return null
  const admDate = new Date(admission.admission_date || admission.created_at)
  const now = new Date()
  const days = Math.max(1, Math.floor((now - admDate) / (1000 * 60 * 60 * 24)) + 1)
  const estimated = admission.estimated_stay_days || null

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm font-semibold text-blue-800">
      <BedDouble size={15} />
      Day {days}{estimated ? ` of estimated ${estimated}` : ''}
    </div>
  )
}

// ── Add Charge Modal ──────────────────────────────────────────────────────────
function AddChargeModal({ admissionId, onClose, onSaved }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    charge_type: 'misc',
    description: '',
    quantity: 1,
    unit_price: '',
    gst_rate: 0,
    charge_date: today,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const qty = Number(form.quantity) || 1
  const price = Number(form.unit_price) || 0
  const gst = Number(form.gst_rate) || 0
  const subtotal = qty * price
  const gstAmt = subtotal * gst / 100
  const total = subtotal + gstAmt

  const submit = async e => {
    e.preventDefault()
    if (!form.description.trim() || !form.unit_price) return setErr('Description and Unit Price are required')
    setSaving(true); setErr('')
    try {
      await api.post(`/inpatient/admissions/${admissionId}/charges`, {
        charge_type: form.charge_type,
        description: form.description,
        quantity: qty,
        unit_price: price,
        gst_rate: gst,
        charge_date: form.charge_date,
      })
      onSaved()
      onClose()
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to add charge')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>Add Charge</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Charge Type</label>
              <select value={form.charge_type} onChange={e => setF('charge_type', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CHARGE_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Charge Date</label>
              <input type="date" value={form.charge_date} onChange={e => setF('charge_date', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input type="text" value={form.description} onChange={e => setF('description', e.target.value)}
              placeholder="e.g. Consultation fee, Dressing change…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
              <input type="number" min="1" value={form.quantity} onChange={e => setF('quantity', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unit Price (₹)</label>
              <input type="number" min="0" step="0.01" value={form.unit_price} onChange={e => setF('unit_price', e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">GST Rate (%)</label>
              <input type="number" min="0" max="100" step="0.01" value={form.gst_rate} onChange={e => setF('gst_rate', e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {/* Live total preview */}
          {price > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-sm text-blue-800">
              <div className="flex justify-between">
                <span>Subtotal ({qty} × {fmt(price)})</span>
                <span>{fmt(subtotal)}</span>
              </div>
              {gst > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>GST ({gst}%)</span>
                  <span>{fmt(gstAmt)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-blue-200 mt-1 pt-1">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
            </div>
          )}
          {err && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={14} />{err}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-60" style={{ background: '#0F2557' }}>
              {saving ? 'Adding…' : 'Add Charge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Room Charge Modal ─────────────────────────────────────────────────────────
const ROOM_RATES = { general: 500, semi_private: 1200, private: 2500, icu: 5000 }
const ROOM_LABELS = { general: 'General', semi_private: 'Semi-Private', private: 'Private', icu: 'ICU' }

function RoomChargeModal({ admissionId, onClose, onSaved }) {
  const today = new Date().toISOString().split('T')[0]
  const [bedType, setBedType] = useState('general')
  const [rate, setRate] = useState(ROOM_RATES.general)
  const [chargeDate, setChargeDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const selectBed = type => {
    setBedType(type)
    setRate(ROOM_RATES[type])
  }

  const submit = async e => {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      await api.post(`/inpatient/admissions/${admissionId}/charges/room-daily`, {
        bed_type: bedType,
        rate,
        charge_date: chargeDate,
      })
      onSaved()
      onClose()
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to add room charge')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: '#0F2557' }}>
            <BedDouble size={18} />Add Room Charge
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Bed Type</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(ROOM_RATES).map(type => (
                <label key={type} className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer text-sm transition-colors ${bedType === type ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="bed_type" value={type} checked={bedType === type} onChange={() => selectBed(type)} className="sr-only" />
                  <span className="font-medium">{ROOM_LABELS[type]}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Daily Rate (₹) — editable</label>
            <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Charge Date</label>
            <input type="date" value={chargeDate} onChange={e => setChargeDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 text-sm text-indigo-800 flex justify-between font-semibold">
            <span>{ROOM_LABELS[bedType]} Room — {chargeDate}</span>
            <span>{fmt(rate)}</span>
          </div>
          {err && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={14} />{err}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-60" style={{ background: '#0F2557' }}>
              {saving ? 'Adding…' : 'Add Room Charge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Void Charge Dialog ────────────────────────────────────────────────────────
function VoidDialog({ charge, onClose, onVoided }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async e => {
    e.preventDefault()
    if (!reason.trim()) return setErr('Reason is required')
    setLoading(true); setErr('')
    try {
      await api.delete(`/inpatient/charges/${charge.id}`, { data: { reason } })
      onVoided()
      onClose()
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to void charge')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-red-700 flex items-center gap-2">
            <Trash2 size={18} />Void Charge
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
            <p className="font-medium text-red-800">{charge.description}</p>
            <p className="text-red-600 text-xs mt-1">{fmt(charge.total_amount || charge.unit_price)} — {fmtDate(charge.charge_date)}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reason for voiding <span className="text-red-500">*</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder="Enter reason for voiding this charge…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
          </div>
          {err && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={14} />{err}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
              {loading ? 'Voiding…' : 'Void Charge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ admissionId, billId, balanceDue, onClose, onSaved }) {
  const [form, setForm] = useState({ amount: balanceDue || '', payment_method: 'cash' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async e => {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) return setErr('Amount must be greater than 0')
    setSaving(true); setErr('')
    try {
      await api.post(`/inpatient/admissions/${admissionId}/bill/record-payment`, {
        amount: Number(form.amount),
        payment_method: form.payment_method,
      })
      onSaved()
      onClose()
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to record payment')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: '#0F2557' }}>
            <CreditCard size={18} />Record Payment
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
            <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setF('amount', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {balanceDue > 0 && (
              <p className="text-xs text-gray-500 mt-1">Balance due: {fmt(balanceDue)}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
            <select value={form.payment_method} onChange={e => setF('payment_method', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="insurance">Insurance</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          {err && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={14} />{err}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-60" style={{ background: '#0F2557' }}>
              {saving ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Bill Summary Panel ────────────────────────────────────────────────────────
function BillSummaryPanel({ admissionId, admission, bill, loadingBill, onBillChange }) {
  const [generating, setGenerating] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [discount, setDiscount] = useState(bill?.discount || 0)
  const [showPayModal, setShowPayModal] = useState(false)
  const [err, setErr] = useState('')
  const hasTpa = !!(admission?.tpa_id || admission?.insurance_provider)

  // Sync discount when bill changes
  useEffect(() => { setDiscount(bill?.discount || 0) }, [bill?.discount])

  const generateBill = async () => {
    setGenerating(true); setErr('')
    try {
      await api.post(`/inpatient/admissions/${admissionId}/bill/generate`, {})
      onBillChange()
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to generate bill')
    } finally { setGenerating(false) }
  }

  const finalizeBill = async () => {
    if (!window.confirm('This will create a final invoice. Continue?')) return
    setFinalizing(true); setErr('')
    try {
      await api.post(`/inpatient/admissions/${admissionId}/bill/finalize`, {})
      onBillChange()
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to finalize bill')
    } finally { setFinalizing(false) }
  }

  const b = bill || {}
  const subtotal      = Number(b.subtotal || 0)
  const gstTotal      = Number(b.gst_total || 0)
  const grossTotal    = Number(b.gross_total || subtotal + gstTotal)
  const tpaAmount     = hasTpa ? Number(b.tpa_amount || 0) : 0
  const discountAmt   = Number(discount || 0)
  const amountPaid    = Number(b.amount_paid || 0)
  const patientPayable = Math.max(0, grossTotal - tpaAmount - discountAmt)
  const balanceDue     = Math.max(0, patientPayable - amountPaid)

  const SummaryRow = ({ label, value, bold, large, highlight }) => (
    <div className={`flex justify-between items-center py-1.5 ${bold ? 'font-semibold' : ''} ${large ? 'text-base' : 'text-sm'}`}>
      <span className={highlight === 'red' ? 'text-red-700' : highlight === 'green' ? 'text-green-700' : bold ? 'text-gray-800' : 'text-gray-600'}>{label}</span>
      <span className={highlight === 'red' ? 'text-red-700 font-bold' : highlight === 'green' ? 'text-green-700 font-bold' : bold ? 'text-gray-900' : 'text-gray-700'}>{fmt(value)}</span>
    </div>
  )

  const Divider = () => <div className="border-t border-gray-200 my-1.5" />

  return (
    <div className="space-y-4">
      {/* Bill status + days */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <DaysCounter admission={admission} />
        {bill?.status && <BillStatusBadge status={bill.status} />}
      </div>

      {err && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={14} />{err}
        </div>
      )}

      {loadingBill ? (
        <div className="flex justify-center py-8"><RefreshCw size={20} className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Bill Summary</h4>

          {/* Category breakdown */}
          {[
            ['Room Charges',       b.room_total],
            ['Procedure Charges',  b.procedure_total],
            ['Consultation',       b.consultation_total],
            ['Lab',                b.lab_total],
            ['Imaging',            b.imaging_total],
            ['Pharmacy',           b.pharmacy_total],
            ['Miscellaneous',      b.misc_total],
          ].map(([label, val]) => (
            <SummaryRow key={label} label={label} value={val || 0} />
          ))}

          <Divider />
          <SummaryRow label="Subtotal" value={subtotal} bold />
          <SummaryRow label="GST" value={gstTotal} />
          <Divider />
          <SummaryRow label="Gross Total" value={grossTotal} bold />

          {hasTpa && (
            <SummaryRow label="TPA / Insurance" value={tpaAmount} />
          )}

          {/* Editable discount */}
          <div className="flex justify-between items-center py-1.5 text-sm">
            <span className="text-gray-600">Discount</span>
            <div className="flex items-center gap-1">
              <span className="text-gray-400 text-xs">₹</span>
              <input
                type="number" min="0" step="0.01" value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="w-24 border border-gray-300 rounded px-2 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>

          <Divider />
          <SummaryRow label="Patient Payable" value={patientPayable} bold large />
          <SummaryRow label="Amount Paid" value={amountPaid} />
          <Divider />
          <SummaryRow
            label="Balance Due"
            value={balanceDue}
            bold
            highlight={balanceDue > 0 ? 'red' : 'green'}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2 print:hidden">
        {!bill && (
          <button onClick={generateBill} disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            style={{ background: '#0F2557' }}>
            <Banknote size={16} />
            {generating ? 'Generating…' : 'Generate Bill'}
          </button>
        )}

        {bill && bill.status === 'draft' && (
          <>
            <button onClick={generateBill} disabled={generating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              <RefreshCw size={16} />
              {generating ? 'Refreshing…' : 'Refresh Bill'}
            </button>
            <button onClick={finalizeBill} disabled={finalizing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
              <CheckCircle size={16} />
              {finalizing ? 'Finalizing…' : 'Finalize Bill'}
            </button>
          </>
        )}

        {bill && ['finalized', 'partially_paid'].includes(bill.status) && balanceDue > 0 && (
          <button onClick={() => setShowPayModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700">
            <CreditCard size={16} />Record Payment
          </button>
        )}

        {bill && (
          <button onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">
            <Printer size={16} />Print Bill
          </button>
        )}
      </div>

      {showPayModal && (
        <PaymentModal
          admissionId={admissionId}
          billId={bill?.id}
          balanceDue={balanceDue}
          onClose={() => setShowPayModal(false)}
          onSaved={onBillChange}
        />
      )}
    </div>
  )
}

// ── Main InpatientBilling ─────────────────────────────────────────────────────
export default function InpatientBilling({ admissionId, admission }) {
  const [charges, setCharges]         = useState([])
  const [bill, setBill]               = useState(null)
  const [loadingCharges, setLoadingCharges] = useState(true)
  const [loadingBill, setLoadingBill] = useState(true)
  const [err, setErr]                 = useState('')
  const [filterType, setFilterType]   = useState('all')
  const [showAddModal, setShowAddModal]   = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [voidTarget, setVoidTarget]   = useState(null)

  const fetchCharges = useCallback(async () => {
    setLoadingCharges(true)
    try {
      const r = await api.get(`/inpatient/admissions/${admissionId}/charges`)
      setCharges(Array.isArray(r) ? r : (r?.items || r?.charges || []))
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to load charges')
    } finally { setLoadingCharges(false) }
  }, [admissionId])

  const fetchBill = useCallback(async () => {
    setLoadingBill(true)
    try {
      const r = await api.get(`/inpatient/admissions/${admissionId}/bill`)
      setBill(r?.id ? r : null)
    } catch (ex) {
      setBill(null)
    } finally { setLoadingBill(false) }
  }, [admissionId])

  useEffect(() => {
    fetchCharges()
    fetchBill()
  }, [fetchCharges, fetchBill])

  const handleSaved = () => { fetchCharges(); fetchBill() }

  // Compute running total
  const activeCharges = charges.filter(c => !c.is_voided)
  const runningTotal = activeCharges.reduce((sum, c) => sum + Number(c.total_amount || c.unit_price * (c.quantity || 1)), 0)

  // Filtered view
  const FILTER_TABS = ['all', ...CHARGE_TYPES]
  const visible = filterType === 'all' ? charges : charges.filter(c => c.charge_type === filterType)

  return (
    <div>
      {/* Print stylesheet */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { font-size: 12px; }
        }
      `}</style>

      {err && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={15} />{err}
        </div>
      )}

      <div className="lg:flex gap-5">
        {/* LEFT: Running Charges (60%) */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-800">Running Charges</h3>
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-xs font-bold">{fmt(runningTotal)}</span>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button onClick={() => setShowRoomModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 text-sm font-medium hover:bg-indigo-50">
                <BedDouble size={14} />Room Charge
              </button>
              <button onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                style={{ background: '#0F2557' }}>
                <Plus size={14} />Add Charge
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 flex-wrap mb-4 print:hidden">
            {FILTER_TABS.map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${filterType === t ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>

          {/* Charges table */}
          {loadingCharges ? (
            <div className="flex justify-center py-10"><RefreshCw size={22} className="animate-spin text-gray-400" /></div>
          ) : visible.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Banknote size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium text-sm">No charges yet</p>
              <p className="text-xs mt-1">Add charges using the buttons above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Date', 'Type', 'Description', 'Qty', 'Unit Price', 'GST', 'Total', ''].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visible.map(c => (
                    <tr key={c.id} className={`hover:bg-gray-50 ${c.is_voided ? 'opacity-40 line-through' : ''}`}>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(c.charge_date)}</td>
                      <td className="px-3 py-2.5"><TypeBadge type={c.charge_type} /></td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-40 truncate">{c.description}</td>
                      <td className="px-3 py-2.5 text-gray-700 text-right">{c.quantity || 1}</td>
                      <td className="px-3 py-2.5 text-gray-700 text-right whitespace-nowrap">{fmt(c.unit_price)}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-right">{c.gst_rate ? `${c.gst_rate}%` : '—'}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800 text-right whitespace-nowrap">{fmt(c.total_amount || (Number(c.unit_price) * Number(c.quantity || 1)))}</td>
                      <td className="px-3 py-2.5 print:hidden">
                        {!c.is_voided && (
                          <button onClick={() => setVoidTarget(c)} title="Void charge"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT: Bill Summary (40%) */}
        <div className="lg:w-80 xl:w-96 shrink-0 mt-6 lg:mt-0">
          <h3 className="font-semibold text-gray-800 mb-4">Bill Summary</h3>
          <BillSummaryPanel
            admissionId={admissionId}
            admission={admission}
            bill={bill}
            loadingBill={loadingBill}
            onBillChange={handleSaved}
          />
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddChargeModal
          admissionId={admissionId}
          onClose={() => setShowAddModal(false)}
          onSaved={handleSaved}
        />
      )}
      {showRoomModal && (
        <RoomChargeModal
          admissionId={admissionId}
          onClose={() => setShowRoomModal(false)}
          onSaved={handleSaved}
        />
      )}
      {voidTarget && (
        <VoidDialog
          charge={voidTarget}
          onClose={() => setVoidTarget(null)}
          onVoided={handleSaved}
        />
      )}
    </div>
  )
}
