import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { ScanLine, Loader2, AlertCircle, X, ChevronDown } from 'lucide-react'

const STATUS_TABS = ['all', 'pending', 'scheduled', 'in_progress', 'completed']

const STATUS_BADGE = {
  pending:     'badge-yellow',
  scheduled:   'badge-blue',
  in_progress: 'badge-purple',
  completed:   'badge-green',
  cancelled:   'badge-red',
}

function statusLabel(s) {
  return s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'
}

function UpdateModal({ order, onClose, onSaved }) {
  const [form, setForm] = useState({
    status:   order.status || 'pending',
    findings: order.findings || '',
    notes:    order.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const submit = async e => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.put(`/imaging/orders/${order.id}`, form)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,37,87,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold" style={{ color: '#0F2557' }}>Update Order</h3>
            <p className="text-xs text-gray-500 mt-0.5">IMG-{order.id} · {order.patient?.full_name || '—'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Status</label>
            <div className="relative">
              <select
                className="input appearance-none pr-8"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="label">Findings <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Enter imaging findings, observations…"
              value={form.findings}
              onChange={e => setForm(f => ({ ...f, findings: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Internal notes, instructions…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Orders() {
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [editing, setEditing]   = useState(null)

  const fetchOrders = useCallback(() => {
    setLoading(true)
    setError('')
    const params = { limit: 200 }
    if (activeTab !== 'all') params.status = activeTab
    api.get('/imaging/orders', { params })
      .then(r => setOrders(Array.isArray(r) ? r : []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [activeTab])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const handleSaved = () => {
    setEditing(null)
    fetchOrders()
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Imaging Orders</h1>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-1 w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab
                ? 'text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            style={activeTab === tab ? { background: '#0F2557' } : {}}
          >
            {statusLabel(tab)}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{error}</span>
          <button onClick={fetchOrders} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#0F255712' }}>
            <ScanLine size={28} style={{ color: '#0F2557' }} />
          </div>
          <p className="font-semibold text-gray-600 mb-1">No orders found</p>
          <p className="text-sm text-gray-400">
            {activeTab === 'all' ? 'No imaging orders have been created yet.' : `No ${statusLabel(activeTab).toLowerCase()} orders.`}
          </p>
        </div>
      )}

      {/* Cards grid */}
      {!loading && !error && orders.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map(order => (
            <div key={order.id} className="card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-xs text-gray-400 mb-0.5">IMG-{order.id}</div>
                  <div className="font-semibold text-sm" style={{ color: '#0F2557' }}>
                    {order.patient?.full_name || '—'}
                  </div>
                </div>
                <span className={`badge ${STATUS_BADGE[order.status] || 'badge-gray'} flex-shrink-0`}>
                  {statusLabel(order.status)}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ScanLine size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="font-medium">{order.imaging_type || order.scan_type || 'Unknown type'}</span>
                </div>
                {(order.ordered_by_name || order.doctor?.full_name) && (
                  <div className="text-xs text-gray-500">
                    Ordered by: {order.ordered_by_name || order.doctor?.full_name}
                  </div>
                )}
                {order.created_at && (
                  <div className="text-xs text-gray-400">
                    {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>

              {order.findings && (
                <div className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3 line-clamp-2">
                  <span className="font-medium text-gray-500">Findings: </span>{order.findings}
                </div>
              )}

              <button
                onClick={() => setEditing(order)}
                className="btn-navy w-full justify-center mt-auto"
              >
                Update Order
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <UpdateModal
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
