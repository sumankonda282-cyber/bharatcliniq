import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { ScanLine, Clock, CheckCircle, Loader2 } from 'lucide-react'

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

  const fetchOrders = useCallback(() => {
    api.get('/imaging/orders', { params: { limit: 200 } })
      .then(r => { setOrders(Array.isArray(r) ? r : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 30_000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  const pending   = orders.filter(o => o.status === 'pending' || o.status === 'scheduled')
  const inProcess = orders.filter(o => o.status === 'in_progress')
  const completed = orders.filter(o => o.status === 'completed')

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={32} className="animate-spin text-gray-400" />
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Imaging Dashboard</h1>
        <span className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Clock}       label="Pending"     value={pending.length}   color="#F5821E" />
        <StatCard icon={ScanLine}    label="In Progress" value={inProcess.length} color="#0F2557" />
        <StatCard icon={CheckCircle} label="Completed"   value={completed.length} color="#16A34A" />
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-700">Recent Orders</div>
        {orders.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ScanLine size={40} className="mx-auto mb-3 opacity-30" />
            <div className="font-medium">No imaging orders found.</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Order #</th>
                  <th className="th">Patient</th>
                  <th className="th">Type</th>
                  <th className="th">Status</th>
                  <th className="th">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.slice(0, 10).map(o => (
                  <tr key={o.id} className="tr-hover">
                    <td className="td font-mono text-xs">IMG-{o.id}</td>
                    <td className="td font-medium">{o.patient?.full_name || '—'}</td>
                    <td className="td">{o.modality || o.body_part || '—'}</td>
                    <td className="td">
                      <span className={`badge ${o.status === 'completed' ? 'badge-green' : o.status === 'in_progress' ? 'badge-blue' : 'badge-yellow'}`}>
                        {o.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="td text-gray-500">
                      {o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '—'}
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
