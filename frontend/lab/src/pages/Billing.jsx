import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { Loader2, AlertCircle, CreditCard, CheckCircle, Clock, X, IndianRupee } from 'lucide-react'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending Payment' },
  { key: 'paid', label: 'Paid' },
]

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Net Banking', 'Insurance']

function isToday(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isOverdue(invoice) {
  if (!invoice.created_at || invoice.status === 'paid') return false
  return Date.now() - new Date(invoice.created_at).getTime() > 2 * 24 * 60 * 60 * 1000
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatAmount(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function PaymentModal({ invoice, onClose, onPaid }) {
  const [method, setMethod] = useState('Cash')
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  const submit = async e => {
    e.preventDefault()
    setPaying(true); setError('')
    try {
      await api.post(`/billing/invoices/${invoice.id}/pay`, { payment_method: method })
      onPaid(invoice.id)
      onClose()
    } catch (err) {
      setError(err.message || 'Payment failed')
      setPaying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,37,87,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-lg" style={{ color: '#0F2557' }}>Collect Payment</h3>
            <p className="text-xs text-gray-500 mt-0.5">Invoice #{invoice.id} · {invoice.patient?.full_name || '—'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="px-6 py-5 space-y-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm text-gray-500 mb-1">Amount Due</div>
              <div className="text-3xl font-bold" style={{ color: '#0F2557' }}>{formatAmount(invoice.amount || invoice.total_amount)}</div>
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select
                className="input"
                value={method}
                onChange={e => setMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={paying} className="btn-success">
              {paying
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing…</>
                : <><CheckCircle size={15} />Confirm Payment</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Billing() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [payInvoice, setPayInvoice] = useState(null)

  const fetchInvoices = useCallback(() => {
    setLoading(true); setError('')
    api.get('/billing/invoices', { params: { limit: 200 } })
      .then(r => setInvoices(Array.isArray(r) ? r : []))
      .catch(err => setError(err.message || 'Failed to load invoices'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const handlePaid = (id) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'paid' } : inv))
  }

  const todayBilled = invoices.filter(inv => isToday(inv.created_at))
  const todayCollected = invoices.filter(inv => inv.status === 'paid' && isToday(inv.paid_at || inv.updated_at))
  const pendingInvoices = invoices.filter(inv => inv.status !== 'paid')

  const billedTodayCount = todayBilled.length
  const collectedTodaySum = todayCollected.reduce((acc, inv) => acc + Number(inv.amount || inv.total_amount || 0), 0)
  const pendingSum = pendingInvoices.reduce((acc, inv) => acc + Number(inv.amount || inv.total_amount || 0), 0)

  const filtered = activeTab === 'all'
    ? invoices
    : activeTab === 'pending'
    ? invoices.filter(inv => inv.status !== 'paid')
    : invoices.filter(inv => inv.status === 'paid')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Billing</h1>
        <button onClick={fetchInvoices} className="btn-secondary text-sm">Refresh</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#0F255718' }}>
            <CreditCard size={22} style={{ color: '#0F2557' }} />
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: '#0F2557' }}>{billedTodayCount}</div>
            <div className="text-xs text-gray-500">Billed Today</div>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#16A34A18' }}>
            <IndianRupee size={22} className="text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-green-700">{formatAmount(collectedTodaySum)}</div>
            <div className="text-xs text-gray-500">Collected Today</div>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#F5821E18' }}>
            <Clock size={22} style={{ color: '#F5821E' }} />
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: '#F5821E' }}>{formatAmount(pendingSum)}</div>
            <div className="text-xs text-gray-500">Pending Collection</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-xl border border-gray-200 p-1 w-fit shadow-sm">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={activeTab === tab.key ? { background: '#0F2557' } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-400" /></div>}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="card p-16 text-center">
          <CreditCard size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No invoices found</p>
          <p className="text-gray-400 text-sm mt-1">
            {activeTab === 'pending' ? 'No pending payments at this time.' : activeTab === 'paid' ? 'No paid invoices yet.' : 'No billing records found.'}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Invoice #</th>
                  <th className="th">Patient</th>
                  <th className="th">Tests</th>
                  <th className="th">Amount</th>
                  <th className="th">Status</th>
                  <th className="th">Date</th>
                  <th className="th">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(invoice => (
                  <tr
                    key={invoice.id}
                    className="tr-hover"
                    style={isOverdue(invoice) ? { background: '#FEF2F2' } : {}}
                  >
                    <td className="td">
                      <div className="font-mono text-xs text-gray-500">#{invoice.id}</div>
                      {isOverdue(invoice) && (
                        <span className="text-xs text-red-600 font-medium">Overdue</span>
                      )}
                    </td>
                    <td className="td">
                      <div className="font-medium text-gray-800">{invoice.patient?.full_name || invoice.patient_name || '—'}</div>
                      {invoice.patient?.mobile && <div className="text-xs text-gray-400">{invoice.patient.mobile}</div>}
                    </td>
                    <td className="td text-xs text-gray-500">
                      {invoice.order?.items?.length
                        ? `${invoice.order.items.length} test${invoice.order.items.length !== 1 ? 's' : ''}`
                        : '—'}
                    </td>
                    <td className="td font-semibold" style={{ color: '#0F2557' }}>
                      {formatAmount(invoice.amount || invoice.total_amount)}
                    </td>
                    <td className="td">
                      <span className={`badge ${invoice.status === 'paid' ? 'badge-green' : 'badge-yellow'}`}>
                        {invoice.status || 'pending'}
                      </span>
                    </td>
                    <td className="td text-xs text-gray-500">{formatDate(invoice.created_at)}</td>
                    <td className="td">
                      {invoice.status !== 'paid' ? (
                        <button
                          onClick={() => setPayInvoice(invoice)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
                          style={{ background: '#16A34A' }}
                        >
                          <IndianRupee size={12} />Collect Payment
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {invoice.paid_at ? formatDate(invoice.paid_at) : 'Paid'}
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

      {payInvoice && (
        <PaymentModal
          invoice={payInvoice}
          onClose={() => setPayInvoice(null)}
          onPaid={handlePaid}
        />
      )}
    </div>
  )
}
