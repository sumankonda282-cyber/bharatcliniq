import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { cachedFetch, cacheInvalidate, TTL } from '../utils/cache'
import { CreditCard, Loader2, FileText, X, Printer } from 'lucide-react'

function DayReport({ invoices }) {
  const [open, setOpen] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const todayPaid = invoices.filter(
    i => i.status === 'paid' && i.created_at && i.created_at.slice(0, 10) === today
  )
  const todayPending = invoices.filter(
    i => (i.status === 'pending' || i.status === 'partial') && i.created_at && i.created_at.slice(0, 10) === today
  )

  const pendingTotal = todayPending.reduce((s, i) => s + (Number(i.total_amount) || 0), 0)

  const methods = ['cash', 'upi', 'card', 'insurance', 'other']
  const methodLabels = { cash: 'Cash', upi: 'UPI', card: 'Card', insurance: 'Insurance', other: 'Other' }

  const grouped = methods.map(method => {
    const items = todayPaid.filter(i => {
      const m = (i.payment_method || 'cash').toLowerCase()
      if (method === 'other') return !['cash', 'upi', 'card', 'insurance'].includes(m)
      return m === method
    })
    return {
      method,
      label: methodLabels[method],
      count: items.length,
      total: items.reduce((s, i) => s + (Number(i.total_amount) || 0), 0),
    }
  }).filter(g => g.count > 0)

  const grandTotal = todayPaid.reduce((s, i) => s + (Number(i.total_amount) || 0), 0)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        <FileText size={15} />
        Day Report
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Day-End Cash Report</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Collections by Payment Method</div>
              {grouped.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">No paid invoices today</div>
              ) : (
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
                  {grouped.map(g => (
                    <div key={g.method} className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100">
                      <div>
                        <span className="font-medium text-gray-700">{g.label}</span>
                        <span className="ml-2 text-xs text-gray-400">{g.count} invoice{g.count !== 1 ? 's' : ''}</span>
                      </div>
                      <span className="font-semibold text-gray-800">₹ {g.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: '#0F2557' }}>
                <span className="font-bold text-white">Grand Total</span>
                <span className="font-extrabold text-white text-lg">₹ {grandTotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-red-100 bg-red-50">
                <span className="font-medium text-red-700 text-sm">Pending Amount (Today)</span>
                <span className="font-bold text-red-700">₹ {pendingTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Close</button>
              <button onClick={() => window.print()} className="btn-primary flex items-center gap-2 text-sm">
                <Printer size={14} />
                Print Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function Billing() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(null)

  const load = useCallback((invalidate = false) => {
    setLoading(true)
    const run = async () => {
      if (invalidate) await cacheInvalidate('recep_invoices')
      await cachedFetch(
        'recep_invoices',
        () => api.get('/billing/invoices', { params: { limit: 100 } }),
        r => { setInvoices(Array.isArray(r) ? r : []); setLoading(false) },
        TTL.SHORT
      )
    }
    run().catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const collectPayment = async (id, method = 'cash') => {
    setPaying(id)
    try { await api.post(`/billing/invoices/${id}/pay`, { payment_method: method }); load(true) }
    catch {}
    finally { setPaying(null) }
  }

  const unpaid = invoices.filter(i => i.status === 'pending' || i.status === 'partial')
  const paid   = invoices.filter(i => i.status === 'paid')

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title">Billing</h1>
        <DayReport invoices={invoices} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="card p-4"><div className="text-xs text-gray-500 mb-1">Pending Payments</div><div className="text-2xl font-bold" style={{ color: '#CC1414' }}>{unpaid.length}</div></div>
        <div className="card p-4"><div className="text-xs text-gray-500 mb-1">Collected Today</div><div className="text-2xl font-bold" style={{ color: '#16A34A' }}>{paid.length}</div></div>
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-700">Recent Invoices</div>
        {loading ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
         : invoices.length === 0 ? <div className="p-10 text-center text-gray-400"><CreditCard size={32} className="mx-auto mb-2 opacity-30" /><p>No invoices found</p></div>
         : <div className="table-wrapper"><table className="table"><thead><tr><th className="th">Invoice</th><th className="th">Patient</th><th className="th">Amount</th><th className="th">Status</th><th className="th">Action</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{invoices.slice(0, 50).map(inv => <tr key={inv.id} className="tr-hover">
              <td className="td font-mono text-xs">INV-{String(inv.id).padStart(4,'0')}</td>
              <td className="td font-medium">{inv.patient_name || inv.patient?.full_name || '—'}</td>
              <td className="td font-semibold">₹ {Number(inv.total_amount).toLocaleString('en-IN')}</td>
              <td className="td"><span className={`badge ${inv.status === 'paid' ? 'badge-green' : inv.status === 'partial' ? 'badge-yellow' : 'badge-red'}`}>{inv.status}</span></td>
              <td className="td">{(inv.status === 'pending' || inv.status === 'partial') && (
                <button onClick={() => collectPayment(inv.id)} disabled={paying === inv.id} className="btn-success text-xs py-1 px-3">{paying === inv.id ? 'Processing…' : 'Collect Cash'}</button>
              )}</td>
            </tr>)}</tbody></table></div>}
      </div>
    </div>
  )
}
