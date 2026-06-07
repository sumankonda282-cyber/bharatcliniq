import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { toast } from '../utils/toast'
import { getRefRange, autoFlag, isCritical, formatRange, FLAG_META, getTubeForTest, TUBE_CONFIG } from '../utils/refRanges'
import {
  Loader2, X, CheckCircle, ClipboardEdit, FlaskConical,
  AlertTriangle, ShieldCheck, RefreshCw, Info
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  sample_collected: 'badge-blue',
  processing:       'badge-purple',
}

const FILTER_TABS = [
  { key: 'all',              label: 'All Pending' },
  { key: 'sample_collected', label: 'Collected' },
  { key: 'processing',       label: 'Processing' },
]

function fmt(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function patientSex(patient) {
  const g = (patient?.gender || patient?.sex || '').toLowerCase()
  return g.startsWith('f') ? 'F' : 'M'
}

// ── Flag Badge ────────────────────────────────────────────────────────────────

function FlagBadge({ flag }) {
  if (!flag || flag === 'N') return null
  const m = FLAG_META[flag] || FLAG_META.N
  return (
    <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full border ${m.tw}`}>
      {m.label}
    </span>
  )
}

// ── Results Modal ─────────────────────────────────────────────────────────────

function ResultsModal({ order, onClose, onSaved }) {
  const sex = patientSex(order.patient)

  const [items, setItems] = useState(() =>
    (order.items || []).map(item => {
      const name  = item.test?.name || item.test_name || ''
      const range = getRefRange(name, sex)
      return {
        item_id:         item.id,
        test_name:       name,
        result_value:    item.result_value || '',
        unit:            item.unit  || range?.unit || '',
        reference_range: item.reference_range || formatRange(range),
        is_abnormal:     item.is_abnormal || false,
        method:          item.method || '',
        _range:          range,
        _flag:           item.result_value ? autoFlag(item.result_value, range) : 'N',
        tube:            getTubeForTest(name),
      }
    })
  )

  const [critAck,  setCritAck]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)

  const hasCritical = items.some(it => isCritical(it._flag))

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [field]: value }
      if (field === 'result_value') {
        const flag = autoFlag(value, it._range)
        updated._flag       = flag
        updated.is_abnormal = flag !== 'N'
      }
      return updated
    }))
  }

  const validate = () => {
    for (const item of items) {
      if (!String(item.result_value).trim()) return `Result required for "${item.test_name}"`
    }
    if (hasCritical && !critAck) return 'Acknowledge critical value(s) before saving'
    return null
  }

  const submit = async e => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true); setError('')
    try {
      await api.post(`/lab/orders/${order.id}/results`, {
        items: items.map(({ item_id, result_value, unit, reference_range, is_abnormal, method }) => ({
          item_id, result_value, unit, reference_range, is_abnormal, method,
        }))
      })
      await api.put(`/lab/orders/${order.id}/status`, { status: 'completed' })
      setSuccess(true)
      toast.success(`Results saved for ${order.patient?.full_name || 'patient'}`)
      setTimeout(() => { onSaved(); onClose() }, 800)
    } catch {
      // toast already shown
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,37,87,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="font-bold text-lg" style={{ color: '#0F2557' }}>
              Enter Results — {order.patient?.full_name || '—'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              LAB-{order.id} · {sex === 'F' ? 'Female' : 'Male'} ref ranges applied
            </p>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        {/* Critical alert banner */}
        {hasCritical && (
          <div className="flex items-center gap-3 mx-6 mt-4 p-3 bg-red-700 rounded-xl text-white text-sm flex-shrink-0">
            <AlertTriangle size={18} className="flex-shrink-0" />
            <div className="flex-1">
              <span className="font-bold">Critical Value detected.</span>
              {' '}Notify the ordering physician immediately per your lab protocol.
            </div>
          </div>
        )}

        {/* Body */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {items.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">No test items found for this order.</p>
            )}

            {items.map((item, idx) => {
              const tubeCfg = TUBE_CONFIG[item.tube]
              const flagMeta = FLAG_META[item._flag] || FLAG_META.N
              const isCrit = isCritical(item._flag)

              return (
                <div key={item.item_id}
                  className={`border rounded-xl p-4 ${isCrit ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>

                  {/* Test name + tube */}
                  <div className="flex items-center gap-2 mb-3">
                    <FlaskConical size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="font-semibold text-sm" style={{ color: '#0F2557' }}>{item.test_name}</span>
                    {tubeCfg && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ml-auto"
                        style={{ background: tubeCfg.bg, color: tubeCfg.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: tubeCfg.dot }} />
                        {tubeCfg.label}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Value + flag */}
                    <div>
                      <label className="label">Result Value <span className="text-red-500">*</span></label>
                      <div className="flex items-center gap-2">
                        <input
                          className={`input flex-1 ${isCrit ? 'border-red-400 bg-white' : ''}`}
                          placeholder="e.g. 98.6"
                          value={item.result_value}
                          onChange={e => updateItem(idx, 'result_value', e.target.value)}
                        />
                        {item._flag && <FlagBadge flag={item._flag} />}
                      </div>
                    </div>

                    {/* Unit */}
                    <div>
                      <label className="label">Unit</label>
                      <input className="input" placeholder="e.g. mg/dL" value={item.unit}
                        onChange={e => updateItem(idx, 'unit', e.target.value)} />
                    </div>

                    {/* Reference range */}
                    <div>
                      <label className="label flex items-center gap-1">
                        Reference Range
                        {item._range?.note && (
                          <span title={item._range.note}>
                            <Info size={12} className="text-gray-400 cursor-help" />
                          </span>
                        )}
                      </label>
                      <input className="input" placeholder="e.g. 70–110" value={item.reference_range}
                        onChange={e => updateItem(idx, 'reference_range', e.target.value)} />
                    </div>

                    {/* Method */}
                    <div>
                      <label className="label">Method <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input className="input" placeholder="e.g. Colorimetric" value={item.method}
                        onChange={e => updateItem(idx, 'method', e.target.value)} />
                    </div>

                    {/* Abnormal flag override */}
                    <div className="col-span-2 flex items-center pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={item.is_abnormal}
                          onChange={e => updateItem(idx, 'is_abnormal', e.target.checked)}
                          className="w-4 h-4 rounded accent-red-600" />
                        <span className="text-sm text-gray-600">Flag as Abnormal</span>
                        {item.is_abnormal && item._flag === 'N' && (
                          <span className="badge badge-orange text-xs">Manual</span>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Range note */}
                  {item._range?.note && (
                    <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                      <Info size={11} />
                      {item._range.note}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Critical acknowledgement */}
          {hasCritical && (
            <div className="mx-6 mb-3 p-4 rounded-xl border border-red-300 bg-red-50">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={critAck} onChange={e => setCritAck(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-red-700 flex-shrink-0" />
                <span className="text-sm text-red-800 font-medium">
                  I confirm that the ordering physician has been notified of the critical value(s) above
                  and the notification time has been documented.
                </span>
              </label>
            </div>
          )}

          {error && (
            <div className="mx-6 mb-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />{error}
            </div>
          )}

          {success && (
            <div className="mx-6 mb-3 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              <CheckCircle size={15} />Results saved and order marked completed!
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || items.length === 0} className="btn-primary">
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                : hasCritical
                  ? <><ShieldCheck size={15} />Save & Acknowledge Critical</>
                  : <><CheckCircle size={15} />Save Results</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ResultEntry() {
  const [orders,       setOrders]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState('all')
  const [resultsOrder, setResultsOrder] = useState(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const [a, b] = await Promise.all([
        api.get('/lab/orders', { params: { status: 'sample_collected', limit: 200 } }),
        api.get('/lab/orders', { params: { status: 'processing',       limit: 200 } }),
      ])
      const combined = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]
      const seen = new Set()
      setOrders(combined.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const filtered = activeTab === 'all' ? orders : orders.filter(o => o.status === activeTab)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Enter Results</h1>
        <button onClick={fetchOrders} className="btn-secondary gap-1.5 text-sm">
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-xl border border-gray-200 p-1 w-fit shadow-sm">
        {FILTER_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={activeTab === tab.key ? { background: '#0F2557' } : {}}>
            {tab.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {tab.key === 'all' ? orders.length : orders.filter(o => o.status === tab.key).length}
            </span>
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-400" /></div>}

      {!loading && filtered.length === 0 && (
        <div className="card p-16 text-center">
          <ClipboardEdit size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No orders pending result entry</p>
          <p className="text-gray-400 text-sm mt-1">Orders appear here once samples are collected.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Order #</th>
                  <th className="th">Patient</th>
                  <th className="th">Tests</th>
                  <th className="th">Tubes</th>
                  <th className="th">Collected At</th>
                  <th className="th">Status</th>
                  <th className="th">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(order => {
                  const tubes = [...new Set((order.items || []).map(it => getTubeForTest(it.test?.name || it.test_name || '')))]
                  return (
                    <tr key={order.id} className="tr-hover">
                      <td className="td font-mono text-xs text-gray-500">LAB-{order.id}</td>
                      <td className="td">
                        <div className="font-medium text-gray-800">{order.patient?.full_name || '—'}</div>
                        {order.patient?.mobile && <div className="text-xs text-gray-400">{order.patient.mobile}</div>}
                      </td>
                      <td className="td">
                        <span className="font-medium">{order.items?.length || 0}</span>
                        <span className="text-gray-400 text-xs ml-1">test{(order.items?.length || 0) !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="td">
                        <div className="flex gap-1">
                          {tubes.map(t => {
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
                      <td className="td text-xs text-gray-500">{fmt(order.updated_at || order.created_at)}</td>
                      <td className="td">
                        <span className={`badge ${STATUS_BADGE[order.status] || 'badge-gray'}`}>
                          {order.status?.replace(/_/g, ' ') || '—'}
                        </span>
                      </td>
                      <td className="td">
                        <button onClick={() => setResultsOrder(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                          style={{ background: '#CC1414' }}>
                          <ClipboardEdit size={12} />Enter Results
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resultsOrder && (
        <ResultsModal
          order={resultsOrder}
          onClose={() => setResultsOrder(null)}
          onSaved={fetchOrders}
        />
      )}
    </div>
  )
}
