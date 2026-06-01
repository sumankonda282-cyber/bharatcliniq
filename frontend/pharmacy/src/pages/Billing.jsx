import { useState, useEffect, useMemo, useCallback } from 'react'
import api from '../api/client'
import { CreditCard, Loader2, X, IndianRupee } from 'lucide-react'

const TABS = ['Pending', 'Paid', 'All']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function Billing() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('Pending')
  const [payModal, setPayModal] = useState(null) // invoice object
  const [payMethod, setPayMethod] = useState('cash')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    api.get('/billing/invoices', { params: { limit: 200 } })
      .then(r => {
        const data = Array.isArray(r) ? r : (Array.isArray(r?.invoices) ? r.invoices : [])
        setInvoices(data)
      })
      .catch(ex => setError(ex.message || 'Failed to load invoices'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const today = todayStr()

  const summaryStats = useMemo(() => {
    const todayInv = invoices.filter(inv => inv.created_at && inv.created_at.slice(0, 10) === today)
    const totalBilledToday = todayInv.reduce((s, i) => s + (Number(i.total_amount) || 0), 0)
    const collectedToday = todayInv
      .filter(i => i.status === 'paid')
      .reduce((s, i) => s + (Number(i.total_amount) || Number(i.paid_amount) || 0), 0)
    const pendingAmount = invoices
      .filter(i => i.status === 'pending' || i.status === 'partial')
      .reduce((s, i) => s + (Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0), 0)
    return { totalBilledToday, collectedToday, pendingAmount }
  }, [invoices, today])

  const filtered = useMemo(() => {
    if (tab === 'Pending') return invoices.filter(i => i.status === 'pending' || i.status === 'partial')
    if (tab === 'Paid') return invoices.filter(i => i.status === 'paid')
    return invoices
  }, [invoices, tab])

  const totalPendingAmount = useMemo(() =>
    invoices
      .filter(i => i.status === 'pending' || i.status === 'partial')
      .reduce((s, i) => s + (Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0), 0),
    [invoices]
  )

  async function collectPayment() {
    if (!payModal) return
    setPaying(true)
    setPayError('')
    try {
      await api.post(`/billing/invoices/${payModal.id}/pay`, { payment_method: payMethod })
      setPayModal(null)
      load()
    } catch (ex) {
      setPayError(ex.message || 'Payment failed')
    } finally {
      setPaying(false)
    }
  }

  function statusBadge(status) {
    if (status === 'paid') return 'badge badge-green'
    if (status === 'partial') return 'badge badge-yellow'
    if (status === 'pending') return 'badge badge-red'
    return 'badge badge-gray'
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pharmacy Billing</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0F255718' }}>
            <IndianRupee size={18} style={{ color: '#0F2557' }} />
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: '#0F2557' }}>₹{summaryStats.totalBilledToday.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Total Billed Today</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#16a34a18' }}>
            <CreditCard size={18} style={{ color: '#16a34a' }} />
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: '#16a34a' }}>₹{summaryStats.collectedToday.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Collected Today</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#CC141418' }}>
            <IndianRupee size={18} style={{ color: '#CC1414' }} />
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: '#CC1414' }}>₹{summaryStats.pendingAmount.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Pending Amount</div>
          </div>
        </div>
      </div>

      {/* Pending amount banner */}
      {totalPendingAmount > 0 && (
        <div className="mb-4 p-3 rounded-xl border border-red-200 bg-red-50 flex items-center justify-between">
          <span className="text-sm text-red-700 font-medium">
            Outstanding pending amount across all invoices
          </span>
          <span className="text-lg font-bold" style={{ color: '#CC1414' }}>₹{totalPendingAmount.toFixed(2)}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 border border-gray-100 w-fit shadow-sm">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? 'px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all' : 'px-4 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-800 transition-all'}
            style={tab === t ? { background: '#0F2557' } : {}}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={30} className="animate-spin text-gray-400" /></div>
      ) : error ? (
        <div className="card p-10 text-center text-red-500">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-14 text-center text-gray-400">
          <CreditCard size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No invoices found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Invoice #</th>
                  <th className="th">Patient</th>
                  <th className="th">Amount</th>
                  <th className="th">Status</th>
                  <th className="th">Date</th>
                  <th className="th">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(inv => (
                  <tr key={inv.id} className="tr-hover">
                    <td className="td font-mono text-xs text-gray-600">INV-{inv.id}</td>
                    <td className="td font-medium">{inv.patient?.full_name || inv.patient_name || '—'}</td>
                    <td className="td font-semibold">₹{Number(inv.total_amount || 0).toFixed(2)}</td>
                    <td className="td"><span className={statusBadge(inv.status)}>{inv.status || '—'}</span></td>
                    <td className="td text-gray-500 text-xs whitespace-nowrap">
                      {inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                    </td>
                    <td className="td">
                      {(inv.status === 'pending' || inv.status === 'partial') ? (
                        <button
                          className="btn-success text-xs py-1 px-3"
                          onClick={() => { setPayModal(inv); setPayMethod('cash'); setPayError('') }}
                        >
                          Collect Payment
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>Collect Payment</h3>
              <button onClick={() => setPayModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">Invoice</span>
                <span className="font-mono text-xs">INV-{payModal.id}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">Patient</span>
                <span className="font-medium">{payModal.patient?.full_name || payModal.patient_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-base">₹{Number(payModal.total_amount || 0).toFixed(2)}</span>
              </div>
            </div>
            <div className="mb-4">
              <label className="label">Payment Method</label>
              <div className="flex gap-2 mt-1">
                {['cash', 'card', 'upi'].map(m => (
                  <button
                    key={m}
                    onClick={() => setPayMethod(m)}
                    className={payMethod === m ? 'flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all capitalize' : 'flex-1 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:border-gray-400 transition-all capitalize'}
                    style={payMethod === m ? { background: '#0F2557' } : {}}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {payError && <p className="text-red-600 text-sm mb-3">{payError}</p>}
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setPayModal(null)}>Cancel</button>
              <button className="btn-success flex-1 justify-center" onClick={collectPayment} disabled={paying}>
                {paying ? 'Processing…' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
