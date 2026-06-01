import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { CreditCard, AlertCircle, Loader2, X, Printer } from 'lucide-react'

const TABS = ['outstanding', 'paid', 'all']

const STATUS_BADGE = {
  paid:       'badge-green',
  outstanding: 'badge-yellow',
  overdue:    'badge-red',
  cancelled:  'badge-gray',
  pending:    'badge-yellow',
}

function fmt(amount) {
  if (amount == null) return '—'
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isToday(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function PayModal({ invoice, onClose, onPaid }) {
  const [form, setForm] = useState({
    amount_paid:      invoice.amount_due ?? invoice.total_amount ?? '',
    payment_method:   'cash',
    reference_no:     '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const submit = async e => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post(`/billing/invoices/${invoice.id}/pay`, {
        payment_method: form.payment_method,
        amount_paid:    parseFloat(form.amount_paid),
        reference_no:   form.reference_no || undefined,
      })
      onPaid()
    } catch (err) {
      setError(err.message || 'Payment failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,37,87,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold" style={{ color: '#0F2557' }}>Collect Payment</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Invoice #{invoice.invoice_number || invoice.id} · {invoice.patient?.full_name || '—'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Amount (₹)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount_paid}
              onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Payment Method</label>
            <select
              className="input"
              value={form.payment_method}
              onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="insurance">Insurance</option>
            </select>
          </div>
          <div>
            <label className="label">Reference / Transaction No <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              className="input"
              placeholder="UPI ref, cheque no, etc."
              value={form.reference_no}
              onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))}
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Confirm Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Billing() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [activeTab, setActiveTab] = useState('outstanding')
  const [paying, setPaying]     = useState(null)

  const fetchInvoices = useCallback(() => {
    setLoading(true)
    setError('')
    api.get('/billing/invoices', { params: { limit: 200 } })
      .then(r => setInvoices(Array.isArray(r) ? r : (Array.isArray(r?.items) ? r.items : [])))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const billedToday  = invoices.filter(i => isToday(i.created_at))
  const billedTodayAmt = billedToday.reduce((s, i) => s + (Number(i.total_amount) || 0), 0)
  const collectedTodayAmt = billedToday
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + (Number(i.amount_paid) || Number(i.total_amount) || 0), 0)
  const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled')
  const outstandingAmt = outstanding.reduce((s, i) => s + (Number(i.amount_due) || Number(i.total_amount) || 0), 0)

  const filtered = invoices.filter(i => {
    if (activeTab === 'outstanding') return i.status !== 'paid' && i.status !== 'cancelled'
    if (activeTab === 'paid')        return i.status === 'paid'
    return true
  })

  const isInsurance = (inv) =>
    inv.payment_method === 'insurance' || inv.payer_type === 'insurance' || inv.insurance_claim

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Imaging Billing</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-xs text-gray-500 mb-1">Billed Today</div>
          <div className="text-2xl font-bold" style={{ color: '#0F2557' }}>{fmt(billedTodayAmt)}</div>
          <div className="text-xs text-gray-400 mt-0.5">{billedToday.length} invoice{billedToday.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-500 mb-1">Collected Today</div>
          <div className="text-2xl font-bold text-green-600">{fmt(collectedTodayAmt)}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {billedToday.filter(i => i.status === 'paid').length} paid
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-500 mb-1">Outstanding Balance</div>
          <div className="text-2xl font-bold" style={{ color: '#CC1414' }}>{fmt(outstandingAmt)}</div>
          <div className="text-xs text-gray-400 mt-0.5">{outstanding.length} unpaid</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
              activeTab === tab ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            style={activeTab === tab ? { background: '#0F2557' } : {}}
          >
            {tab}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={fetchInvoices} className="ml-auto underline text-xs">Retry</button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="card p-16 text-center text-gray-500">
          <CreditCard size={36} className="mx-auto mb-3 opacity-30" />
          <div className="font-semibold text-gray-600">No invoices found</div>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Invoice #</th>
                  <th className="th">Patient</th>
                  <th className="th">Scan Type</th>
                  <th className="th">Amount</th>
                  <th className="th">Created</th>
                  <th className="th">Status</th>
                  <th className="th">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(inv => (
                  <tr
                    key={inv.id}
                    className={`tr-hover ${isInsurance(inv) ? 'bg-blue-50/50' : ''}`}
                  >
                    <td className="td font-mono text-xs">
                      {inv.invoice_number || `INV-${inv.id}`}
                      {isInsurance(inv) && <span className="badge badge-blue ml-2">Insurance</span>}
                    </td>
                    <td className="td font-medium">{inv.patient?.full_name || '—'}</td>
                    <td className="td text-gray-500">{inv.service_name || '—'}</td>
                    <td className="td font-semibold">{fmt(inv.total_amount)}</td>
                    <td className="td text-gray-500">
                      {inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="td">
                      <span className={`badge ${STATUS_BADGE[inv.status] || 'badge-gray'}`}>
                        {inv.status || '—'}
                      </span>
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                          <button
                            onClick={() => setPaying(inv)}
                            className="btn-success text-xs py-1.5 px-3"
                          >
                            Collect Payment
                          </button>
                        )}
                        {inv.status === 'paid' && (
                          <button
                            onClick={() => window.print()}
                            className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
                          >
                            <Printer size={12} />
                            Receipt
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {paying && (
        <PayModal
          invoice={paying}
          onClose={() => setPaying(null)}
          onPaid={() => { setPaying(null); fetchInvoices() }}
        />
      )}
    </div>
  )
}
