import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { toast } from '../utils/toast'
import { getTubeForTest, TUBE_CONFIG } from '../utils/refRanges'
import {
  Loader2, Beaker, CheckCircle, Clock, User, FlaskConical, X,
  AlertTriangle, RefreshCw
} from 'lucide-react'

const REJECTION_REASONS = [
  'Haemolysed sample',
  'Insufficient quantity',
  'Clotted sample',
  'Wrong tube type',
  'Unlabelled / mis-labelled',
  'Sample not received',
  'Contaminated',
  'Expired collection date',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeSince(d) {
  if (!d) return '—'
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}

function isToday(d) {
  if (!d) return false
  const t = new Date(d), n = new Date()
  return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate()
}

function uniqueTubes(items = []) {
  const seen = new Set()
  return items
    .map(it => getTubeForTest(it.test?.name || it.test_name || ''))
    .filter(t => { if (seen.has(t)) return false; seen.add(t); return true })
}

// ── Tube Pills ────────────────────────────────────────────────────────────────

function TubePills({ items }) {
  const tubes = uniqueTubes(items)
  if (!tubes.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {tubes.map(t => {
        const cfg = TUBE_CONFIG[t]
        if (!cfg) return null
        return (
          <span key={t}
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: cfg.bg, color: cfg.color }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
            {cfg.label}
          </span>
        )
      })}
    </div>
  )
}

// ── Rejection Modal ───────────────────────────────────────────────────────────

function RejectModal({ order, onClose, onRejected }) {
  const [reason, setReason]   = useState('')
  const [custom, setCustom]   = useState('')
  const [saving, setSaving]   = useState(false)

  const submit = async () => {
    const finalReason = reason === '__custom' ? custom.trim() : reason
    if (!finalReason) { toast.error('Please select or enter a rejection reason'); return }
    setSaving(true)
    try {
      await api.put(`/lab/orders/${order.id}/status`, { status: 'rejected', rejection_reason: finalReason })
      toast.warning(`Sample rejected: ${finalReason}`)
      onRejected(order.id)
      onClose()
    } catch (err) {
      // toast already shown by interceptor
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,37,87,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-base" style={{ color: '#CC1414' }}>Reject Sample</h3>
            <p className="text-xs text-gray-500 mt-0.5">LAB-{order.id} · {order.patient?.full_name || '—'}</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-2">
          <p className="text-xs text-gray-500 mb-3">Select rejection reason:</p>
          {REJECTION_REASONS.map(r => (
            <label key={r} className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
              <input type="radio" name="rej" value={r} checked={reason === r}
                onChange={() => setReason(r)}
                className="w-4 h-4 accent-red-600" />
              <span className="text-sm text-gray-700">{r}</span>
            </label>
          ))}
          <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
            <input type="radio" name="rej" value="__custom" checked={reason === '__custom'}
              onChange={() => setReason('__custom')}
              className="w-4 h-4 accent-red-600" />
            <span className="text-sm text-gray-700">Other reason…</span>
          </label>
          {reason === '__custom' && (
            <input value={custom} onChange={e => setCustom(e.target.value)}
              placeholder="Describe the reason"
              className="input mt-1 ml-6" />
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-danger text-sm">
            {saving
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Rejecting…</>
              : <><AlertTriangle size={14} />Reject Sample</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({ order, onCollected, onRejected }) {
  const [collecting, setCollecting] = useState(false)
  const [fading, setFading]         = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)

  const handleCollect = async () => {
    setCollecting(true)
    try {
      await api.put(`/lab/orders/${order.id}/status`, { status: 'sample_collected' })
      toast.success(`Sample collected for ${order.patient?.full_name || 'patient'}`)
      setFading(true)
      setTimeout(() => onCollected(order.id), 500)
    } catch {
      setCollecting(false)
    }
  }

  return (
    <>
      <div className="card p-5 transition-all duration-500"
        style={{ opacity: fading ? 0 : 1, transform: fading ? 'scale(0.97)' : 'scale(1)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Order ID + priority badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg"
                style={{ background: '#0F255710', color: '#0F2557' }}>
                LAB-{order.id}
              </span>
              {order.priority === 'stat'   && <span className="badge badge-red">STAT</span>}
              {order.priority === 'urgent' && <span className="badge badge-orange">URGENT</span>}
              {!order.priority || order.priority === 'routine' && <span className="badge badge-gray">Routine</span>}
            </div>

            {/* Patient */}
            <div className="flex items-center gap-1.5 mb-1">
              <User size={14} className="text-gray-400 flex-shrink-0" />
              <span className="font-semibold text-gray-800 truncate">{order.patient?.full_name || '—'}</span>
              {order.patient?.mobile && (
                <span className="text-xs text-gray-400 ml-1">{order.patient.mobile}</span>
              )}
            </div>

            {/* Doctor */}
            {(order.doctor?.full_name || order.referred_by) && (
              <div className="text-xs text-gray-500 mb-2">
                Ordered by: <span className="font-medium">{order.doctor?.full_name || order.referred_by}</span>
              </div>
            )}

            {/* Tests */}
            <div className="flex items-start gap-1.5 mb-1">
              <FlaskConical size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="flex flex-wrap gap-1">
                {(order.items || []).length === 0 && <span className="text-xs text-gray-400">No tests listed</span>}
                {(order.items || []).map((it, i) => (
                  <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                    {it.test?.name || it.test_name || `Test #${it.id}`}
                  </span>
                ))}
              </div>
            </div>

            {/* Tube pills */}
            <TubePills items={order.items || []} />

            {/* Age */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2">
              <Clock size={12} />
              <span>Ordered {timeSince(order.created_at)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button onClick={handleCollect} disabled={collecting} className="btn-primary text-sm">
              {collecting
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Marking…</>
                : <><Beaker size={14} />Collected</>}
            </button>
            <button onClick={() => setRejectOpen(true)}
              className="btn text-xs text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 py-1.5">
              <AlertTriangle size={12} />Reject
            </button>
          </div>
        </div>
      </div>

      {rejectOpen && (
        <RejectModal
          order={order}
          onClose={() => setRejectOpen(false)}
          onRejected={id => { setFading(true); setTimeout(() => onRejected(id), 500) }}
        />
      )}
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SampleCollection() {
  const [pendingOrders,  setPendingOrders]  = useState([])
  const [collectedToday, setCollectedToday] = useState([])
  const [loading,        setLoading]        = useState(true)

  const fetchCollectedToday = useCallback(() => {
    api.get('/lab/orders', { params: { status: 'sample_collected', limit: 200 } })
      .then(r => {
        const today = (Array.isArray(r) ? r : []).filter(o => isToday(o.updated_at || o.created_at))
        setCollectedToday(today)
      })
      .catch(() => {})
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/lab/orders', { params: { status: 'pending', limit: 200 } })
      setPendingOrders(Array.isArray(r) ? r : [])
      fetchCollectedToday()
    } finally {
      setLoading(false)
    }
  }, [fetchCollectedToday])

  useEffect(() => {
    fetchOrders()
    const t = setInterval(fetchOrders, 30_000)
    return () => clearInterval(t)
  }, [fetchOrders])

  const handleCollected = (id) => {
    setPendingOrders(prev => prev.filter(o => o.id !== id))
    fetchCollectedToday()
  }

  const handleRejected = (id) => {
    setPendingOrders(prev => prev.filter(o => o.id !== id))
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 size={32} className="animate-spin text-gray-400" /></div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sample Collection</h1>
        <button onClick={fetchOrders} className="btn-secondary gap-1.5 text-sm">
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {/* Counters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="card px-5 py-3 flex items-center gap-3" style={{ borderLeft: '4px solid #F5821E' }}>
          <Clock size={18} style={{ color: '#F5821E' }} />
          <div>
            <span className="text-2xl font-bold" style={{ color: '#0F2557' }}>{pendingOrders.length}</span>
            <span className="text-sm text-gray-500 ml-2">pending collection</span>
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

      {/* Tube legend */}
      <div className="flex flex-wrap gap-2 mb-5">
        {Object.entries(TUBE_CONFIG).map(([key, cfg]) => (
          <span key={key} className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border"
            style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.color + '40' }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.dot }} />
            {cfg.label}
          </span>
        ))}
      </div>

      {/* Awaiting collection */}
      <h2 className="font-semibold text-gray-600 mb-3 text-xs uppercase tracking-widest">Awaiting Sample Collection</h2>

      {pendingOrders.length === 0 ? (
        <div className="card p-14 text-center mb-8">
          <CheckCircle size={44} className="mx-auto mb-3 text-green-400" />
          <div className="font-semibold text-green-700 text-lg">All samples collected</div>
          <div className="text-gray-400 text-sm mt-1">No pending sample collection at this time.</div>
        </div>
      ) : (
        <div className="grid gap-3 mb-8">
          {pendingOrders
            .slice()
            .sort((a, b) => {
              const o = { stat: 0, urgent: 1, routine: 2 }
              return (o[a.priority || 'routine'] ?? 2) - (o[b.priority || 'routine'] ?? 2)
            })
            .map(order => (
              <OrderCard key={order.id} order={order} onCollected={handleCollected} onRejected={handleRejected} />
            ))}
        </div>
      )}

      {/* Collected today */}
      {collectedToday.length > 0 && (
        <>
          <h2 className="font-semibold text-gray-600 mb-3 text-xs uppercase tracking-widest">Collected Today</h2>
          <div className="card overflow-hidden">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th className="th">Order #</th>
                    <th className="th">Patient</th>
                    <th className="th">Tests</th>
                    <th className="th">Tubes</th>
                    <th className="th">Doctor</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {collectedToday.map(order => (
                    <tr key={order.id} className="tr-hover">
                      <td className="td font-mono text-xs text-gray-500">LAB-{order.id}</td>
                      <td className="td font-medium text-gray-800">{order.patient?.full_name || '—'}</td>
                      <td className="td">
                        <div className="flex flex-wrap gap-1">
                          {(order.items || []).map((it, i) => (
                            <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                              {it.test?.name || it.test_name || `#${it.id}`}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="td">
                        <div className="flex flex-wrap gap-1">
                          {uniqueTubes(order.items || []).map(t => {
                            const cfg = TUBE_CONFIG[t]
                            return cfg ? (
                              <span key={t} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
                                style={{ background: cfg.bg, color: cfg.color }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                                {cfg.label}
                              </span>
                            ) : null
                          })}
                        </div>
                      </td>
                      <td className="td text-gray-500 text-sm">{order.doctor?.full_name || order.referred_by || '—'}</td>
                      <td className="td"><span className="badge badge-green">Collected</span></td>
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
