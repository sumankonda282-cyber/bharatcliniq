import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { CreditCard, Loader2 } from 'lucide-react'

export default function Billing() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/billing/invoices', { params: { limit: 100 } })
      .then(r => setInvoices(Array.isArray(r) ? r : []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const collectPayment = async (id, method = 'cash') => {
    setPaying(id)
    try { await api.post(`/billing/invoices/${id}/pay`, { payment_method: method }); load() }
    catch {}
    finally { setPaying(null) }
  }

  const unpaid = invoices.filter(i => i.status === 'pending' || i.status === 'partial')
  const paid   = invoices.filter(i => i.status === 'paid')

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Billing</h1></div>
      <div className="grid grid-cols-2 gap-4 mb-6">
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
              <td className="td font-semibold">₹{inv.total_amount}</td>
              <td className="td"><span className={`badge ${inv.status === 'paid' ? 'badge-green' : inv.status === 'partial' ? 'badge-yellow' : 'badge-red'}`}>{inv.status}</span></td>
              <td className="td">{(inv.status === 'pending' || inv.status === 'partial') && (
                <button onClick={() => collectPayment(inv.id)} disabled={paying === inv.id} className="btn-success text-xs py-1 px-3">{paying === inv.id ? 'Processing…' : 'Collect Cash'}</button>
              )}</td>
            </tr>)}</tbody></table></div>}
      </div>
    </div>
  )
}
