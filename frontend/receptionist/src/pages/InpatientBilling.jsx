import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import {
  Banknote, Plus, Trash2, Printer, CheckCircle, CreditCard,
  BedDouble, AlertCircle, RefreshCw, X, Search
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = v => '₹ ' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

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

function BillStatusBadge({ status }) {
  if (!status) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">No Bill</span>
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${BILL_STATUS_STYLES[status] || 'bg-gray-100 text-gray-700'}`}>
      {BILL_STATUS_LABELS[status] || status}
    </span>
  )
}

const ROOM_RATES = { general: 500, semi_private: 1200, private: 2500, icu: 5000 }
const ROOM_LABELS = { general: 'General', semi_private: 'Semi-Private', private: 'Private', icu: 'ICU' }

// ── Room Charge Modal ─────────────────────────────────────────────────────────
function RoomChargeModal({ admissionId, onClose, onSaved }) {
  const today = new Date().toISOString().split('T')[0]
  const [bedType, setBedType] = useState('general')
  const [rate, setRate] = useState(ROOM_RATES.general)
  const [chargeDate, setChargeDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const selectBed = type => { setBedType(type); setRate(ROOM_RATES[type]) }

  const submit = async e => {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      await api.post(`/inpatient/admissions/${admissionId}/charges/room-daily`, {
        bed_type: bedType, rate, charge_date: chargeDate,
      })
      onSaved(); onClose()
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to add room charge')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: '#0F2557' }}>
            <BedDouble size={18} />Add Room Charge
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Daily Rate (₹)</label>
            <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Charge Date</label>
            <input type="date" value={chargeDate} onChange={e => setChargeDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 text-sm text-indigo-800 flex justify-between font-semibold">
            <span>{ROOM_LABELS[bedType]} — {chargeDate}</span>
            <span>{fmt(rate)}</span>
          </div>
          {err && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle size={14} />{err}</div>}
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

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ admissionId, balanceDue, onClose, onSaved }) {
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
      onSaved(); onClose()
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to record payment')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
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
            {balanceDue > 0 && <p className="text-xs text-gray-500 mt-1">Balance due: {fmt(balanceDue)}</p>}
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
          {err && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle size={14} />{err}</div>}
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

// ── Billing Drawer ────────────────────────────────────────────────────────────
function BillingDrawer({ admission, onClose, onChanged }) {
  const [bill, setBill]         = useState(null)
  const [loadingBill, setLoadingBill] = useState(true)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showPayModal, setShowPayModal]   = useState(false)
  const [err, setErr]           = useState('')
  const [discount, setDiscount] = useState(0)

  const fetchBill = useCallback(async () => {
    setLoadingBill(true)
    try {
      const r = await api.get(`/inpatient/admissions/${admission.id}/bill`)
      const b = r?.id ? r : null
      setBill(b)
      setDiscount(b?.discount || 0)
    } catch (_) {
      setBill(null)
    } finally { setLoadingBill(false) }
  }, [admission.id])

  useEffect(() => { fetchBill() }, [fetchBill])

  const handleSaved = () => { fetchBill(); onChanged() }

  const b = bill || {}
  const subtotal      = Number(b.subtotal || 0)
  const gstTotal      = Number(b.gst_total || 0)
  const grossTotal    = Number(b.gross_total || subtotal + gstTotal)
  const tpaAmount     = (admission.tpa_id || admission.insurance_provider) ? Number(b.tpa_amount || 0) : 0
  const discountAmt   = Number(discount || 0)
  const amountPaid    = Number(b.amount_paid || 0)
  const patientPayable = Math.max(0, grossTotal - tpaAmount - discountAmt)
  const balanceDue     = Math.max(0, patientPayable - amountPaid)

  const SummaryRow = ({ label, value, bold, highlight }) => (
    <div className={`flex justify-between items-center py-1.5 text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className={highlight === 'red' ? 'text-red-700' : highlight === 'green' ? 'text-green-700' : bold ? 'text-gray-800' : 'text-gray-600'}>{label}</span>
      <span className={highlight === 'red' ? 'text-red-700 font-bold' : highlight === 'green' ? 'text-green-700 font-bold' : bold ? 'text-gray-900' : 'text-gray-700'}>{fmt(value)}</span>
    </div>
  )
  const Divider = () => <div className="border-t border-gray-200 my-1.5" />

  const pat = admission.patient || {}

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0F2557' }}>IPD Billing</h2>
            <p className="text-sm text-gray-500">{pat.full_name || admission.patient_name} · {admission.admission_number || `#${admission.id}`}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Status badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <BillStatusBadge status={bill?.status} />
            {bill?.status && (
              <span className="text-xs text-gray-400">{bill.bill_number || ''}</span>
            )}
          </div>

          {err && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={14} />{err}
            </div>
          )}

          {/* Bill summary card */}
          {loadingBill ? (
            <div className="flex justify-center py-8"><RefreshCw size={20} className="animate-spin text-gray-400" /></div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Charge Breakdown</h4>
              {[
                ['Room Charges',      b.room_total],
                ['Procedure Charges', b.procedure_total],
                ['Consultation',      b.consultation_total],
                ['Lab',               b.lab_total],
                ['Imaging',           b.imaging_total],
                ['Pharmacy',          b.pharmacy_total],
                ['Miscellaneous',     b.misc_total],
              ].map(([label, val]) => (
                <SummaryRow key={label} label={label} value={val || 0} />
              ))}
              <Divider />
              <SummaryRow label="Subtotal" value={subtotal} bold />
              <SummaryRow label="GST" value={gstTotal} />
              <Divider />
              <SummaryRow label="Gross Total" value={grossTotal} bold />
              {(admission.tpa_id || admission.insurance_provider) && (
                <SummaryRow label="TPA / Insurance" value={tpaAmount} />
              )}
              <div className="flex justify-between items-center py-1.5 text-sm">
                <span className="text-gray-600">Discount</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-xs">₹</span>
                  <input type="number" min="0" step="0.01" value={discount}
                    onChange={e => setDiscount(e.target.value)}
                    className="w-24 border border-gray-300 rounded px-2 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              </div>
              <Divider />
              <SummaryRow label="Patient Payable" value={patientPayable} bold />
              <SummaryRow label="Amount Paid" value={amountPaid} />
              <Divider />
              <SummaryRow label="Balance Due" value={balanceDue} bold highlight={balanceDue > 0 ? 'red' : 'green'} />
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="p-5 border-t border-gray-100 space-y-2">
          <button onClick={() => setShowRoomModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-indigo-300 text-indigo-700 hover:bg-indigo-50">
            <BedDouble size={16} />Add Room Charge
          </button>
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
      </div>

      {showRoomModal && (
        <RoomChargeModal
          admissionId={admission.id}
          onClose={() => setShowRoomModal(false)}
          onSaved={handleSaved}
        />
      )}
      {showPayModal && (
        <PaymentModal
          admissionId={admission.id}
          balanceDue={balanceDue}
          onClose={() => setShowPayModal(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InpatientBilling() {
  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading]       = useState(true)
  const [err, setErr]               = useState('')
  const [search, setSearch]         = useState('')
  const [drawerAdmission, setDrawerAdmission] = useState(null)

  const fetchAdmissions = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const r = await api.get('/inpatient/admissions?status=active,discharged')
      setAdmissions(Array.isArray(r) ? r : (r?.items || r?.admissions || []))
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to load admissions')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAdmissions() }, [fetchAdmissions])

  const filtered = admissions.filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    const pat = a.patient || {}
    return (
      (pat.full_name || a.patient_name || '').toLowerCase().includes(q) ||
      (a.admission_number || '').toLowerCase().includes(q)
    )
  })

  const computeBalance = a => {
    if (!a.bill) return 0
    const b = a.bill
    const gross = Number(b.gross_total || 0)
    const paid = Number(b.amount_paid || 0)
    const disc = Number(b.discount || 0)
    return Math.max(0, gross - paid - disc)
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0F2557' }}>
            <Banknote size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#0F2557' }}>Inpatient Billing</h1>
            <p className="text-sm text-gray-500">Manage charges and payments for admitted patients</p>
          </div>
        </div>
        {/* Search */}
        <div className="relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search patient or admission #…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-2 p-4 mb-5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={15} />{err}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center py-16 gap-3 text-gray-400">
          <RefreshCw size={28} className="animate-spin opacity-50" />
          <span className="text-sm">Loading admissions…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Banknote size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No admissions found</p>
          {search && <p className="text-sm mt-1">Try a different search term</p>}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Admission #', 'Patient', 'Dept / Ward', 'Admitted', 'Bill Status', 'Total', 'Paid', 'Balance', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(a => {
                  const pat = a.patient || {}
                  const b = a.bill || {}
                  const balance = computeBalance(a)
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                        {a.admission_number || `#${a.id}`}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{pat.full_name || a.patient_name || '—'}</div>
                        <div className="text-xs text-gray-400">{pat.clinic_patient_id || a.uhid || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {[a.department_name || a.department?.name, a.ward_name].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{fmtDate(a.admission_date || a.created_at)}</td>
                      <td className="px-4 py-3"><BillStatusBadge status={b.status} /></td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmt(b.gross_total || 0)}</td>
                      <td className="px-4 py-3 text-green-700 whitespace-nowrap">{fmt(b.amount_paid || 0)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={balance > 0 ? 'text-red-700 font-semibold' : 'text-green-700 font-semibold'}>{fmt(balance)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDrawerAdmission(a)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap">
                          View Bill
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {drawerAdmission && (
        <BillingDrawer
          admission={drawerAdmission}
          onClose={() => setDrawerAdmission(null)}
          onChanged={fetchAdmissions}
        />
      )}
    </div>
  )
}
