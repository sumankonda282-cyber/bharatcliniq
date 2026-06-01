import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { Loader2, AlertCircle, Beaker, CheckCircle, Clock, User, FlaskConical } from 'lucide-react'

function timeSince(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function isToday(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function OrderCard({ order, onCollected }) {
  const [collecting, setCollecting] = useState(false)
  const [fading, setFading] = useState(false)

  const handleCollect = async () => {
    setCollecting(true)
    try {
      await api.put(`/lab/orders/${order.id}/status`, { status: 'sample_collected' })
      setFading(true)
      setTimeout(() => onCollected(order.id), 500)
    } catch (err) {
      alert(err.message || 'Failed to update status')
      setCollecting(false)
    }
  }

  return (
    <div
      className="card p-5 transition-all duration-500"
      style={{ opacity: fading ? 0 : 1, transform: fading ? 'scale(0.97)' : 'scale(1)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: '#0F255710', color: '#0F2557' }}>
              LAB-{order.id}
            </span>
            <span className="badge badge-yellow">pending</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            <User size={14} className="text-gray-400 flex-shrink-0" />
            <span className="font-semibold text-gray-800 truncate">{order.patient?.full_name || '—'}</span>
            {order.patient?.mobile && (
              <span className="text-xs text-gray-400 ml-1">{order.patient.mobile}</span>
            )}
          </div>
          {(order.doctor?.full_name || order.referred_by) && (
            <div className="text-xs text-gray-500 mb-2">
              Ordered by: <span className="font-medium">{order.doctor?.full_name || order.referred_by}</span>
            </div>
          )}
          <div className="flex items-start gap-1.5 mb-3">
            <FlaskConical size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {(order.items || []).length === 0 && <span className="text-xs text-gray-400">No tests listed</span>}
              {(order.items || []).map((item, i) => (
                <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                  {item.test?.name || item.test_name || `Test #${item.id}`}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock size={12} />
            <span>Ordered {timeSince(order.created_at)}</span>
          </div>
        </div>
        <button
          onClick={handleCollect}
          disabled={collecting}
          className="btn-primary flex-shrink-0 text-sm"
        >
          {collecting
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Marking…</>
            : <><Beaker size={14} />Mark Collected</>
          }
        </button>
      </div>
    </div>
  )
}

export default function SampleCollection() {
  const [pendingOrders, setPendingOrders] = useState([])
  const [collectedToday, setCollectedToday] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchOrders = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [pendingRes, collectedRes] = await Promise.all([
        api.get('/lab/orders', { params: { status: 'pending', limit: 200 } }),
        api.get('/lab/orders', { params: { status: 'sample_collected', limit: 200 } }),
      ])
      setPendingOrders(Array.isArray(pendingRes) ? pendingRes : [])
      const todayCollected = (Array.isArray(collectedRes) ? collectedRes : []).filter(o => isToday(o.updated_at || o.created_at))
      setCollectedToday(todayCollected)
    } catch (err) {
      setError(err.message || 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const handleCollected = (id) => {
    setPendingOrders(prev => prev.filter(o => o.id !== id))
    // Re-fetch collected today list to include the newly collected
    api.get('/lab/orders', { params: { status: 'sample_collected', limit: 200 } })
      .then(r => {
        const todayCollected = (Array.isArray(r) ? r : []).filter(o => isToday(o.updated_at || o.created_at))
        setCollectedToday(todayCollected)
      })
      .catch(() => {})
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-400" /></div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sample Collection</h1>
        <button onClick={fetchOrders} className="btn-secondary text-sm">Refresh</button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-5">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* Counter */}
      <div className="flex items-center gap-3 mb-5">
        <div className="card px-5 py-3 flex items-center gap-3" style={{ borderLeft: '4px solid #F5821E' }}>
          <Clock size={18} style={{ color: '#F5821E' }} />
          <div>
            <span className="text-2xl font-bold" style={{ color: '#0F2557' }}>{pendingOrders.length}</span>
            <span className="text-sm text-gray-500 ml-2">sample{pendingOrders.length !== 1 ? 's' : ''} pending collection</span>
          </div>
        </div>
        <div className="card px-5 py-3 flex items-center gap-3" style={{ borderLeft: '4px solid #16A34A' }}>
          <CheckCircle size={18} className="text-green-600" />
          <div>
            <span className="text-2xl font-bold text-green-700">{collectedToday.length}</span>
            <span className="text-sm text-gray-500 ml-2">collected today</span>
          </div>
        </div>
      </div>

      {/* Pending collection section */}
      <h2 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Awaiting Sample Collection</h2>

      {pendingOrders.length === 0 ? (
        <div className="card p-14 text-center mb-8">
          <CheckCircle size={44} className="mx-auto mb-3 text-green-400" />
          <div className="font-semibold text-green-700 text-lg">All samples collected ✓</div>
          <div className="text-gray-400 text-sm mt-1">No pending sample collection at this time.</div>
        </div>
      ) : (
        <div className="grid gap-3 mb-8">
          {pendingOrders.map(order => (
            <OrderCard key={order.id} order={order} onCollected={handleCollected} />
          ))}
        </div>
      )}

      {/* Collected today section */}
      {collectedToday.length > 0 && (
        <>
          <h2 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Collected Today</h2>
          <div className="card overflow-hidden">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th className="th">Order #</th>
                    <th className="th">Patient</th>
                    <th className="th">Tests</th>
                    <th className="th">Doctor</th>
                    <th className="th">Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {collectedToday.map(order => (
                    <tr key={order.id} className="tr-hover">
                      <td className="td font-mono text-xs text-gray-500">LAB-{order.id}</td>
                      <td className="td font-medium text-gray-800">{order.patient?.full_name || '—'}</td>
                      <td className="td">
                        <div className="flex flex-wrap gap-1">
                          {(order.items || []).map((item, i) => (
                            <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                              {item.test?.name || item.test_name || `#${item.id}`}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="td text-gray-500 text-sm">{order.doctor?.full_name || order.referred_by || '—'}</td>
                      <td className="td text-xs text-gray-400">
                        <span className="badge badge-green">Collected</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
