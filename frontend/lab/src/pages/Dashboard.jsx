import { useState, useEffect } from 'react'
import api from '../api/client'
import { FlaskConical, Clock, CheckCircle, Loader2 } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ color: '#0F2557' }}>{value ?? '—'}</div>
        <div className="text-xs text-gray-500 font-medium">{label}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/lab/orders', { params: { limit: 200 } })
      .then(r => setOrders(Array.isArray(r) ? r : []))
      .finally(() => setLoading(false))
  }, [])

  const pending   = orders.filter(o => o.status === 'pending' || o.status === 'sample_collected')
  const inProcess = orders.filter(o => o.status === 'processing')
  const completed = orders.filter(o => o.status === 'completed')

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={32} className="animate-spin text-gray-400" />
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Lab Dashboard</h1>
        <span className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Clock}        label="Pending Orders" value={pending.length}   color="#F5821E" />
        <StatCard icon={FlaskConical} label="Processing"     value={inProcess.length} color="#3B82F6" />
        <StatCard icon={CheckCircle}  label="Completed"      value={completed.length} color="#16A34A" />
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-700">Pending Orders</div>
        {pending.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <CheckCircle size={40} className="mx-auto mb-3 text-green-400 opacity-60" />
            <div className="font-medium">All caught up! No pending orders.</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Order #</th>
                  <th className="th">Patient</th>
                  <th className="th">Tests</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pending.slice(0, 10).map(o => (
                  <tr key={o.id} className="tr-hover">
                    <td className="td font-mono text-xs">LAB-{o.id}</td>
                    <td className="td font-medium">{o.patient?.full_name || '—'}</td>
                    <td className="td">{o.items?.length || 0} test{(o.items?.length || 0) !== 1 ? 's' : ''}</td>
                    <td className="td">
                      <span className={`badge ${o.status === 'pending' ? 'badge-yellow' : o.status === 'processing' ? 'badge-blue' : 'badge-green'}`}>
                        {o.status?.replace('_', ' ')}
                      </span>
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
