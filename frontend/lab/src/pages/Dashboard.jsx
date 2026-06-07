import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import {
  FlaskConical, Clock, CheckCircle, AlertTriangle, Zap, Loader2,
  TrendingUp, Activity, RefreshCw
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isToday(d) {
  if (!d) return false
  const t = new Date(d), n = new Date()
  return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate()
}

function minutesSince(d) {
  if (!d) return 0
  return Math.floor((Date.now() - new Date(d).getTime()) / 60000)
}

function ageLabel(mins) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function tatTarget(priority) {
  if (priority === 'stat')   return 60
  if (priority === 'urgent') return 120
  return 240
}

function getShift() {
  const h = new Date().getHours()
  if (h >= 6  && h < 14) return 'Morning Shift'
  if (h >= 14 && h < 22) return 'Afternoon Shift'
  return 'Night Shift'
}

function ageColor(mins, priority) {
  const tgt = tatTarget(priority)
  const pct = mins / tgt
  if (pct >= 1)    return { bg: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500' }
  if (pct >= 0.75) return { bg: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500' }
  if (pct >= 0.5)  return { bg: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500' }
  return { bg: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-500' }
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, accent, sub, urgent }) {
  return (
    <div className={`card p-5 flex items-center gap-4 ${urgent ? 'ring-2 ring-red-300' : ''}`}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: accent + '18' }}>
        <Icon size={20} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-none" style={{ color: '#0F2557' }}>{value ?? '—'}</div>
        <div className="text-xs text-gray-500 font-medium mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

// ── STAT / Urgent Queue Row ───────────────────────────────────────────────────

function QueueRow({ order }) {
  const mins = minutesSince(order.created_at)
  const priority = order.priority || 'routine'
  const c = ageColor(mins, priority)
  const isBreached = mins >= tatTarget(priority)
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg"
        style={{ background: '#0F255710', color: '#0F2557' }}>
        LAB-{order.id}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-800 truncate">{order.patient?.full_name || '—'}</div>
        <div className="text-xs text-gray-400 truncate">
          {(order.items || []).map(it => it.test?.name || it.test_name).filter(Boolean).join(', ') || 'No tests listed'}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {priority === 'stat' && (
          <span className="badge badge-red text-xs">STAT</span>
        )}
        {priority === 'urgent' && (
          <span className="badge badge-orange text-xs">URGENT</span>
        )}
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${c.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
          {ageLabel(mins)}
          {isBreached && ' ⚠'}
        </span>
      </div>
    </div>
  )
}

// ── Pending Table Row ─────────────────────────────────────────────────────────

function PendingRow({ order }) {
  const mins = minutesSince(order.created_at)
  const priority = order.priority || 'routine'
  const c = ageColor(mins, priority)
  return (
    <tr className="tr-hover">
      <td className="td font-mono text-xs text-gray-500">LAB-{order.id}</td>
      <td className="td">
        <div className="font-medium text-gray-800">{order.patient?.full_name || '—'}</div>
        {order.patient?.mobile && <div className="text-xs text-gray-400">{order.patient.mobile}</div>}
      </td>
      <td className="td">
        <div className="flex flex-wrap gap-1">
          {(order.items || []).slice(0, 3).map((it, i) => (
            <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
              {it.test?.name || it.test_name || `#${it.id}`}
            </span>
          ))}
          {(order.items || []).length > 3 && (
            <span className="text-xs text-gray-400">+{order.items.length - 3}</span>
          )}
        </div>
      </td>
      <td className="td">
        {priority === 'stat' && <span className="badge badge-red">STAT</span>}
        {priority === 'urgent' && <span className="badge badge-orange">URGENT</span>}
        {priority === 'routine' && <span className="badge badge-gray">Routine</span>}
      </td>
      <td className="td">
        <span className={`badge ${order.status === 'sample_collected' ? 'badge-blue' : 'badge-yellow'}`}>
          {order.status?.replace(/_/g, ' ') || '—'}
        </span>
      </td>
      <td className="td">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${c.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
          {ageLabel(mins)}
        </span>
      </td>
    </tr>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchOrders = useCallback(async () => {
    try {
      const r = await api.get('/lab/orders', { params: { limit: 300 } })
      setOrders(Array.isArray(r) ? r : [])
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    const t = setInterval(fetchOrders, 30_000)
    return () => clearInterval(t)
  }, [fetchOrders])

  const today        = orders.filter(o => isToday(o.created_at))
  const pending      = orders.filter(o => ['pending', 'sample_collected', 'processing'].includes(o.status))
  const statUrgent   = pending.filter(o => o.priority === 'stat' || o.priority === 'urgent')
    .sort((a, b) => {
      if (a.priority === 'stat' && b.priority !== 'stat') return -1
      if (b.priority === 'stat' && a.priority !== 'stat') return  1
      return new Date(a.created_at) - new Date(b.created_at)
    })
  const completed    = orders.filter(o => o.status === 'completed' && isToday(o.updated_at || o.created_at))
  const tatBreaches  = pending.filter(o => minutesSince(o.created_at) >= tatTarget(o.priority || 'routine'))

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 size={32} className="animate-spin text-gray-400" />
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="page-header mb-5">
        <div>
          <h1 className="page-title">Lab Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{getShift()} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <button onClick={fetchOrders} className="btn-secondary gap-1.5 text-sm">
          <RefreshCw size={14} />
          {lastRefresh ? `Updated ${new Date(lastRefresh).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'}
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <KpiCard icon={Activity}       label="Today's Orders"  value={today.length}       accent="#0F2557" />
        <KpiCard icon={Zap}            label="STAT / Urgent"   value={statUrgent.length}  accent="#CC1414"
          urgent={statUrgent.length > 0}
          sub={statUrgent.length > 0 ? 'Needs attention' : 'All clear'} />
        <KpiCard icon={AlertTriangle}  label="TAT Breaches"    value={tatBreaches.length} accent="#F5821E"
          urgent={tatBreaches.length > 0}
          sub={tatBreaches.length > 0 ? 'Exceeded target TAT' : 'On time'} />
        <KpiCard icon={Clock}          label="Pending"          value={pending.length}     accent="#3B82F6" />
        <KpiCard icon={CheckCircle}    label="Completed Today"  value={completed.length}   accent="#16A34A" />
      </div>

      {/* TAT breach alert */}
      {tatBreaches.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-orange-200 bg-orange-50 mb-5">
          <AlertTriangle size={18} className="text-orange-600 flex-shrink-0" />
          <div className="text-sm text-orange-800">
            <span className="font-semibold">{tatBreaches.length} order{tatBreaches.length > 1 ? 's' : ''} exceeded target TAT.</span>
            {' '}Prioritise these to prevent further delays.
          </div>
        </div>
      )}

      {/* STAT / Urgent queue */}
      {statUrgent.length > 0 && (
        <div className="card overflow-hidden mb-5">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100"
            style={{ background: '#FEF2F2' }}>
            <Zap size={15} className="text-red-600" />
            <span className="font-semibold text-red-800 text-sm">STAT / Urgent Queue — {statUrgent.length} order{statUrgent.length > 1 ? 's' : ''}</span>
          </div>
          <div>
            {statUrgent.slice(0, 8).map(o => <QueueRow key={o.id} order={o} />)}
          </div>
        </div>
      )}

      {/* Pending orders table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-gray-400" />
            <span className="font-semibold text-gray-700">Pending Orders</span>
            <span className="badge badge-blue">{pending.length}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />On track</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />50% TAT</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />75% TAT</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Breached</span>
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="p-14 text-center">
            <CheckCircle size={44} className="mx-auto mb-3 text-green-400" />
            <div className="font-semibold text-green-700 text-lg">All caught up!</div>
            <div className="text-gray-400 text-sm mt-1">No pending orders at this time.</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Order #</th>
                  <th className="th">Patient</th>
                  <th className="th">Tests</th>
                  <th className="th">Priority</th>
                  <th className="th">Status</th>
                  <th className="th">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pending
                  .slice()
                  .sort((a, b) => {
                    const pOrder = { stat: 0, urgent: 1, routine: 2 }
                    const pa = pOrder[a.priority || 'routine'] ?? 2
                    const pb = pOrder[b.priority || 'routine'] ?? 2
                    if (pa !== pb) return pa - pb
                    return new Date(a.created_at) - new Date(b.created_at)
                  })
                  .slice(0, 30)
                  .map(o => <PendingRow key={o.id} order={o} />)
                }
              </tbody>
            </table>
            {pending.length > 30 && (
              <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100 text-center">
                Showing 30 of {pending.length} pending orders. Go to Orders page for full list.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Today completed summary */}
      {completed.length > 0 && (
        <div className="mt-5 card px-5 py-4 flex items-center gap-4">
          <TrendingUp size={20} className="text-green-600 flex-shrink-0" />
          <div className="text-sm text-gray-700">
            <span className="font-semibold text-green-700">{completed.length} order{completed.length > 1 ? 's' : ''}</span> completed today.
            {today.length > 0 && (
              <span className="text-gray-500"> That's {Math.round((completed.length / today.length) * 100)}% completion rate for the day.</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
