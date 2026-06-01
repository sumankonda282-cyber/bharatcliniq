import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { BarChart2, ChevronDown, ChevronUp, Loader2, AlertCircle, RefreshCw } from 'lucide-react'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function isOnDate(dateStr, target) {
  if (!dateStr) return false
  return dateStr.slice(0, 10) === target
}

function tat(order) {
  if (!order.created_at || !order.updated_at) return null
  const diff = new Date(order.updated_at) - new Date(order.created_at)
  if (diff <= 0) return null
  const hrs = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
}

function tatMins(order) {
  if (!order.created_at || !order.updated_at) return null
  return (new Date(order.updated_at) - new Date(order.created_at)) / 60000
}

function hoursOld(dateStr) {
  if (!dateStr) return 0
  return (Date.now() - new Date(dateStr).getTime()) / 3600000
}

function Card({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#0F255712' }}>
            <Icon size={16} style={{ color: '#0F2557' }} />
          </div>
          <span className="font-semibold text-gray-800">{title}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="p-6">{children}</div>}
    </div>
  )
}

// ──────────────────────────────────────────
// a) Daily Productivity
// ──────────────────────────────────────────
function DailyProductivity({ allOrders }) {
  const [date, setDate] = useState(todayStr())

  const dayOrders = allOrders.filter(o => isOnDate(o.created_at, date))
  const completed = dayOrders.filter(o => o.status === 'completed')
  const pending   = dayOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled')

  const tatValues = completed.map(tatMins).filter(v => v !== null && v > 0)
  const avgTatMins = tatValues.length ? tatValues.reduce((a, b) => a + b, 0) / tatValues.length : null
  const avgTatStr  = avgTatMins ? (avgTatMins >= 60 ? `${Math.floor(avgTatMins / 60)}h ${Math.floor(avgTatMins % 60)}m` : `${Math.floor(avgTatMins)}m`) : '—'

  return (
    <div>
      <div className="flex items-center gap-4 mb-5">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input w-44" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="flex gap-4 mt-5">
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#0F2557' }}>{dayOrders.length}</div>
            <div className="text-xs text-gray-500">Orders Received</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{completed.length}</div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#CC1414' }}>{pending.length}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#F5821E' }}>{avgTatStr}</div>
            <div className="text-xs text-gray-500">Avg TAT</div>
          </div>
        </div>
      </div>

      {dayOrders.length === 0 ? (
        <p className="text-sm text-gray-500">No orders on this date.</p>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th className="th">Order #</th>
                <th className="th">Patient</th>
                <th className="th">Scan Type</th>
                <th className="th">Status</th>
                <th className="th">TAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dayOrders.map(o => (
                <tr key={o.id} className="tr-hover">
                  <td className="td font-mono text-xs">IMG-{o.id}</td>
                  <td className="td font-medium">{o.patient?.full_name || '—'}</td>
                  <td className="td">{o.modality || o.body_part || '—'}</td>
                  <td className="td">
                    <span className={`badge ${o.status === 'completed' ? 'badge-green' : o.status === 'in_progress' ? 'badge-purple' : 'badge-yellow'}`}>
                      {o.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="td text-gray-500">{o.status === 'completed' ? (tat(o) || '—') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────
// b) Pending Reports Summary
// ──────────────────────────────────────────
function PendingReportsSummary({ allOrders }) {
  const pending = allOrders
    .filter(o => o.status !== 'completed' && o.status !== 'cancelled')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  // Group by scan type
  const groups = {}
  pending.forEach(o => {
    const type = o.modality || o.body_part || 'Unknown'
    if (!groups[type]) groups[type] = []
    groups[type].push(o)
  })

  return (
    <div>
      {pending.length === 0 && <p className="text-sm text-gray-500">No pending reports.</p>}
      {Object.entries(groups).map(([type, items]) => (
        <div key={type} className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-gray-700">{type}</span>
            <span className="badge badge-yellow">{items.length}</span>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Order #</th>
                  <th className="th">Patient</th>
                  <th className="th">Ordered By</th>
                  <th className="th">Status</th>
                  <th className="th">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(o => {
                  const hrs = hoursOld(o.created_at)
                  const ageStr = hrs >= 24 ? `${Math.floor(hrs / 24)}d ${Math.floor(hrs % 24)}h` : `${Math.floor(hrs)}h`
                  return (
                    <tr key={o.id} className={`tr-hover ${hrs > 6 ? 'bg-red-50/40' : ''}`}>
                      <td className="td font-mono text-xs">IMG-{o.id}</td>
                      <td className="td font-medium">{o.patient?.full_name || '—'}</td>
                      <td className="td text-gray-500">Dr. {o.ordered_by_name || o.doctor?.full_name || '—'}</td>
                      <td className="td">
                        <span className={`badge ${o.status === 'in_progress' ? 'badge-purple' : o.status === 'scheduled' ? 'badge-blue' : 'badge-yellow'}`}>
                          {o.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="td" style={{ color: hrs > 6 ? '#CC1414' : undefined }}>{ageStr}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────
// c) Scan Type Distribution
// ──────────────────────────────────────────
function ScanDistribution({ allOrders }) {
  const counts = {}
  allOrders.forEach(o => {
    const type = o.modality || o.body_part || 'Unknown'
    counts[type] = (counts[type] || 0) + 1
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const max = sorted[0]?.[1] || 1

  const COLORS = ['#0F2557', '#CC1414', '#F5821E', '#1D4ED8', '#16A34A', '#7C3AED', '#0891B2', '#D97706']

  return (
    <div>
      {sorted.length === 0 && <p className="text-sm text-gray-500">No data.</p>}
      <div className="space-y-3">
        {sorted.map(([type, count], i) => (
          <div key={type}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">{type}</span>
              <span className="text-gray-500 font-mono">{count}</span>
            </div>
            <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                style={{ width: `${(count / max) * 100}%`, background: COLORS[i % COLORS.length] }}
              >
                {count / max > 0.15 && (
                  <span className="text-white text-xs font-semibold">{Math.round((count / allOrders.length) * 100)}%</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {sorted.length > 0 && (
        <p className="text-xs text-gray-500 mt-4">
          Most common: <strong>{sorted[0][0]}</strong> ({sorted[0][1]} orders)
        </p>
      )}
    </div>
  )
}

// ──────────────────────────────────────────
// d) Radiologist Workload
// ──────────────────────────────────────────
function RadiologistWorkload({ allOrders }) {
  const [from, setFrom] = useState('')
  const [to,   setTo]   = useState('')

  const filtered = allOrders.filter(o => {
    if (o.status !== 'completed') return false
    if (from && o.updated_at < from) return false
    if (to   && o.updated_at > to + 'T23:59:59') return false
    return true
  })

  const counts = {}
  filtered.forEach(o => {
    const name = o.radiologist_name || 'Unassigned'
    counts[name] = (counts[name] || 0) + 1
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])

  return (
    <div>
      <div className="flex gap-4 mb-5">
        <div>
          <label className="label">From</label>
          <input type="date" className="input w-40" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input w-40" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500">No completed orders in this range.</p>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th className="th">Radiologist</th>
                <th className="th">Reports Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(([name, count]) => (
                <tr key={name} className="tr-hover">
                  <td className="td font-medium">{name}</td>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <span className="font-bold" style={{ color: '#0F2557' }}>{count}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full max-w-xs">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(count / (sorted[0]?.[1] || 1)) * 100}%`, background: '#0F2557' }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────
// Main
// ──────────────────────────────────────────
export default function Reports() {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const fetchOrders = useCallback(() => {
    setLoading(true)
    setError('')
    api.get('/imaging/orders', { params: { limit: 500 } })
      .then(r => setOrders(Array.isArray(r) ? r : []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Analytics & Reports</h1>
        <button onClick={fetchOrders} className="btn-secondary gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={fetchOrders} className="ml-auto underline text-xs">Retry</button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      )}

      {!loading && (
        <>
          <Card title="Daily Productivity Report" icon={BarChart2} defaultOpen>
            <DailyProductivity allOrders={orders} />
          </Card>
          <Card title="Pending Reports Summary" icon={AlertCircle}>
            <PendingReportsSummary allOrders={orders} />
          </Card>
          <Card title="Scan Type Distribution" icon={BarChart2}>
            <ScanDistribution allOrders={orders} />
          </Card>
          <Card title="Radiologist Workload" icon={BarChart2}>
            <RadiologistWorkload allOrders={orders} />
          </Card>
        </>
      )}
    </div>
  )
}
