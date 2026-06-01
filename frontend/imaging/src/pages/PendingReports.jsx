import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { AlertCircle, Clock, Loader2, FileEdit, RefreshCw } from 'lucide-react'

function timeSince(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
}

function hoursOld(dateStr) {
  if (!dateStr) return 0
  return (Date.now() - new Date(dateStr).getTime()) / 3600000
}

function isToday(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isFuture(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) > new Date()
}

const STATUS_BADGE = {
  pending:     'badge-yellow',
  scheduled:   'badge-blue',
  in_progress: 'badge-purple',
}

function SectionHeader({ title, count, color }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h2 className="font-bold text-base" style={{ color }}>{title}</h2>
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white" style={{ background: color }}>
        {count}
      </span>
    </div>
  )
}

function OrderCard({ order, onWrite }) {
  return (
    <div className="card p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs text-gray-400">IMG-{order.id}</span>
          <span className={`badge ${STATUS_BADGE[order.status] || 'badge-gray'}`}>
            {order.status?.replace('_', ' ')}
          </span>
        </div>
        <div className="font-semibold text-sm truncate" style={{ color: '#0F2557' }}>
          {order.patient?.full_name || '—'}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{order.modality || order.body_part || '—'}</div>
        {(order.ordered_by_name || order.doctor?.full_name) && (
          <div className="text-xs text-gray-400 mt-0.5">
            Dr. {order.ordered_by_name || order.doctor?.full_name}
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
          <Clock size={11} />
          Waiting: {timeSince(order.created_at)}
        </div>
      </div>
      <button
        onClick={() => onWrite(order)}
        className="btn-primary flex-shrink-0 gap-1.5 whitespace-nowrap"
      >
        <FileEdit size={14} />
        Write Report
      </button>
    </div>
  )
}

export default function PendingReports() {
  const navigate = useNavigate()
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  const fetchOrders = useCallback(() => {
    setLoading(true)
    setError('')
    api.get('/imaging/orders', { params: { limit: 300 } })
      .then(r => {
        const list = Array.isArray(r) ? r : []
        setOrders(list.filter(o => o.status !== 'completed' && o.status !== 'cancelled'))
        setLastRefresh(Date.now())
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 60000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  const handleWrite = (order) => {
    navigate('/report-writer', { state: { orderId: order.id } })
  }

  // Categorise
  const urgent    = orders.filter(o => !isFuture(o.created_at) && hoursOld(o.created_at) > 6)
  const today     = orders.filter(o => isToday(o.created_at) && hoursOld(o.created_at) <= 6)
  const scheduled = orders.filter(o => isFuture(o.created_at) || (!isToday(o.created_at) && hoursOld(o.created_at) <= 6))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pending Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            {orders.length} report{orders.length !== 1 ? 's' : ''} pending ·{' '}
            <span className="text-gray-400">Refreshes every 60s</span>
          </p>
        </div>
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

      {loading && orders.length === 0 && (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      )}

      {!loading && orders.length === 0 && !error && (
        <div className="card p-16 text-center text-gray-500">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#16A34A18' }}>
            <FileEdit size={28} style={{ color: '#16A34A' }} />
          </div>
          <div className="font-semibold text-gray-700 text-lg">All reports are complete!</div>
          <div className="text-sm mt-1">No pending reports at this time.</div>
        </div>
      )}

      {/* Urgent section */}
      {urgent.length > 0 && (
        <div className="mb-6">
          <div className="p-4 rounded-2xl border-2 border-red-200 bg-red-50">
            <SectionHeader title="Urgent — Over 6 Hours" count={urgent.length} color="#CC1414" />
            <div className="grid gap-3 sm:grid-cols-2">
              {urgent.map(o => <OrderCard key={o.id} order={o} onWrite={handleWrite} />)}
            </div>
          </div>
        </div>
      )}

      {/* Today section */}
      {today.length > 0 && (
        <div className="mb-6">
          <div className="p-4 rounded-2xl border-2 border-yellow-200 bg-yellow-50">
            <SectionHeader title="Today — Within 6 Hours" count={today.length} color="#D97706" />
            <div className="grid gap-3 sm:grid-cols-2">
              {today.map(o => <OrderCard key={o.id} order={o} onWrite={handleWrite} />)}
            </div>
          </div>
        </div>
      )}

      {/* Scheduled section */}
      {scheduled.length > 0 && (
        <div className="mb-6">
          <div className="p-4 rounded-2xl border-2 border-blue-200 bg-blue-50">
            <SectionHeader title="Scheduled / Upcoming" count={scheduled.length} color="#1D4ED8" />
            <div className="grid gap-3 sm:grid-cols-2">
              {scheduled.map(o => <OrderCard key={o.id} order={o} onWrite={handleWrite} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
