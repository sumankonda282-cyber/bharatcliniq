import { useState, useEffect } from 'react'
import api from '../api/client'
import { cachedFetch } from '../utils/cache'
import { Receipt, IndianRupee, TrendingUp, Download } from 'lucide-react'

async function downloadInvoice(billId, invoiceNumber) {
  try {
    const res = await api.get(`/pdf/portal/invoice/${billId}`, { responseType: 'blob' })
    const blob = res instanceof Blob ? res : res.data || res
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice-${invoiceNumber || billId}.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  } catch { /* silent — PDF service may not have data */ }
}

const STATUS_BADGE = { pending: 'badge-yellow', paid: 'badge-green', cancelled: 'badge-gray', partial: 'badge-blue' }

export default function Bills() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cachedFetch(
      'bills',
      () => api.get('/portal/bills'),
      r => { setBills(r.data?.bills || r.data || r?.bills || []); setLoading(false) }
    ).catch(() => setLoading(false))
  }, [])

  const totalPaid = bills.filter(b => b.status === 'paid').reduce((s, b) => s + parseFloat(b.total || 0), 0)
  const totalDue = bills.filter(b => b.status === 'pending').reduce((s, b) => s + parseFloat(b.total || 0), 0)

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      {bills.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F0FDF4' }}>
              <IndianRupee size={22} style={{ color: '#16a34a' }} />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Total Paid</div>
              <div className="text-2xl font-extrabold" style={{ color: '#16a34a' }}>₹{totalPaid.toLocaleString('en-IN')}</div>
            </div>
          </div>
          {totalDue > 0 && (
            <div className="card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FEF2F2' }}>
                <TrendingUp size={22} style={{ color: '#CC1414' }} />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">Amount Due</div>
                <div className="text-2xl font-extrabold" style={{ color: '#CC1414' }}>₹{totalDue.toLocaleString('en-IN')}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bills table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : bills.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Receipt size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No bills on record</p>
          </div>
        ) : (
          <div className="table-wrapper rounded-none border-0">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Invoice #</th>
                  <th className="th">Health Center</th>
                  <th className="th">Amount</th>
                  <th className="th">Method</th>
                  <th className="th">Status</th>
                  <th className="th">Date</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bills.map(b => (
                  <tr key={b.id} className="tr-hover">
                    <td className="td font-mono text-xs font-bold" style={{ color: '#0F2557' }}>
                      {b.invoice_number || `INV-${b.id}`}
                    </td>
                    <td className="td text-sm text-gray-600">{b.clinic_name || '—'}</td>
                    <td className="td font-bold text-base" style={{ color: '#16a34a' }}>
                      ₹{parseFloat(b.total || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="td text-sm text-gray-500 capitalize">{b.payment_method || '—'}</td>
                    <td className="td"><span className={STATUS_BADGE[b.status] || 'badge-gray'}>{b.status}</span></td>
                    <td className="td text-xs text-gray-400">
                      {b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="td">
                      <button
                        onClick={() => downloadInvoice(b.id, b.invoice_number)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                        title="Download PDF"
                      >
                        <Download size={11} /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
