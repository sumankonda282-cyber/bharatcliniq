import { useState, useEffect } from 'react'
import { clinicApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import { BarChart3, TrendingUp, IndianRupee, Users, Award } from 'lucide-react'
import { format } from 'date-fns'

export default function Analytics() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    clinicApi.getRevenue(month)
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [month])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Revenue Analytics</h1>
        <input type="month" className="input w-44" value={month} onChange={e => setMonth(e.target.value)} />
      </div>

      {loading ? <PageLoader /> : error ? (
        <div className="card p-6 text-center text-red-600">{error}</div>
      ) : data ? (
        <>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center"><IndianRupee size={18} className="text-green-600" /></div>
                <span className="text-sm text-gray-500">Total Revenue</span>
              </div>
              <div className="text-3xl font-bold text-green-700">₹{(data.totals?.total || 0).toLocaleString('en-IN')}</div>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><Users size={18} className="text-blue-600" /></div>
                <span className="text-sm text-gray-500">Paid Invoices</span>
              </div>
              <div className="text-3xl font-bold text-blue-700">{data.totals?.count || 0}</div>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center"><TrendingUp size={18} className="text-purple-600" /></div>
                <span className="text-sm text-gray-500">Avg. per Invoice</span>
              </div>
              <div className="text-3xl font-bold text-purple-700">₹{(data.totals?.avg || 0).toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* By Doctor */}
          {data.by_doctor?.length > 0 && (
            <div className="card mb-6">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Award size={16} className="text-yellow-500" />
                <h2 className="font-semibold">Revenue by Doctor</h2>
              </div>
              <div className="p-5 space-y-3">
                {data.by_doctor.map((doc, i) => {
                  const pct = data.totals?.total ? Math.round((doc.total / data.totals.total) * 100) : 0
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{doc.doctor_name}</span>
                        <span className="text-green-700 font-medium">₹{doc.total.toLocaleString('en-IN')} ({doc.count} pts)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Billing Ledger */}
          {data.billing?.length > 0 && (
            <div className="card">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold">Billing Ledger — {month}</h2>
              </div>
              <div className="table-wrapper rounded-xl border-0">
                <table className="table">
                  <thead><tr>
                    <th className="th">Invoice</th><th className="th">Patient</th><th className="th">Doctor</th>
                    <th className="th">Method</th><th className="th">Amount</th><th className="th">Date</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.billing.map((row, i) => (
                      <tr key={i} className="tr-hover">
                        <td className="td font-mono text-sm">{row.invoice_number}</td>
                        <td className="td">{row.patient_name}</td>
                        <td className="td text-gray-500">{row.doctor_name}</td>
                        <td className="td text-xs">{row.payment_mode || '—'}</td>
                        <td className="td font-medium text-green-700">₹{row.amount.toLocaleString('en-IN')}</td>
                        <td className="td text-xs text-gray-400">{row.billed_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.billing?.length === 0 && (
            <div className="card p-10 text-center text-gray-400">
              <BarChart3 size={36} className="mx-auto mb-2 opacity-30" />
              <p>No paid invoices for {month}</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
