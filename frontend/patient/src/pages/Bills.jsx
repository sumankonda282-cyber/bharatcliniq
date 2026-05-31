import { useState, useEffect } from 'react'
import api from '../api/client'
import { Receipt, IndianRupee } from 'lucide-react'

const STATUS_COLORS = { pending:'badge-yellow', paid:'badge-green', cancelled:'badge-gray', partial:'badge-blue' }

export default function Bills() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/portal/bills')
      .then(r => setBills(r.data?.bills || r.data || []))
      .finally(() => setLoading(false))
  }, [])

  const total = bills.filter(b => b.status === 'paid').reduce((s, b) => s + parseFloat(b.total || 0), 0)

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Bills</h1>

      {/* Total paid */}
      {bills.length > 0 && (
        <div className="card p-5 mb-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <IndianRupee size={22} className="text-green-600" />
          </div>
          <div>
            <div className="text-sm text-gray-500">Total Paid</div>
            <div className="text-2xl font-bold text-green-700">₹{total.toLocaleString('en-IN')}</div>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : bills.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Receipt size={36} className="mx-auto mb-2 opacity-30" />
            <p>No bills on record</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="th">Invoice #</th>
                  <th className="th">Clinic</th>
                  <th className="th">Total</th>
                  <th className="th">Method</th>
                  <th className="th">Status</th>
                  <th className="th">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bills.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="td font-mono text-sm">{b.invoice_number || `INV-${b.id}`}</td>
                    <td className="td text-sm text-gray-600">{b.clinic_name || '—'}</td>
                    <td className="td font-bold text-green-700">₹{parseFloat(b.total || 0).toLocaleString('en-IN')}</td>
                    <td className="td text-sm text-gray-500">{b.payment_method || '—'}</td>
                    <td className="td"><span className={STATUS_COLORS[b.status] || 'badge-gray'}>{b.status}</span></td>
                    <td className="td text-xs text-gray-400">
                      {b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : '—'}
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
