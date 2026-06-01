import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { Loader2, AlertCircle, X, CheckCircle, ClipboardEdit, FlaskConical } from 'lucide-react'

const STATUS_BADGE = {
  sample_collected: 'badge-blue',
  processing: 'badge-purple',
}

const FILTER_TABS = [
  { key: 'all', label: 'All Pending' },
  { key: 'sample_collected', label: 'Sample Collected' },
  { key: 'processing', label: 'Processing' },
]

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function ResultsModal({ order, onClose, onSaved }) {
  const [items, setItems] = useState(
    (order.items || []).map(item => ({
      item_id: item.id,
      test_name: item.test?.name || item.test_name || `Test #${item.id}`,
      result_value: item.result_value || '',
      unit: item.unit || '',
      reference_range: item.reference_range || '',
      is_abnormal: item.is_abnormal || false,
      method: item.method || '',
    }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  const validate = () => {
    for (const item of items) {
      if (!item.result_value.toString().trim()) {
        return `Result value is required for "${item.test_name}"`
      }
    }
    return null
  }

  const submit = async e => {
    e.preventDefault()
    const validErr = validate()
    if (validErr) { setError(validErr); return }
    setSaving(true); setError('')
    try {
      await api.put(`/lab/orders/${order.id}/results`, {
        items: items.map(({ item_id, result_value, unit, reference_range, is_abnormal, method }) => ({
          item_id, result_value, unit, reference_range, is_abnormal, method
        }))
      })
      await api.put(`/lab/orders/${order.id}/status`, { status: 'completed' })
      setSuccess(true)
      setTimeout(() => { onSaved(); onClose() }, 900)
    } catch (err) {
      setError(err.message || 'Failed to save results')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,37,87,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-lg" style={{ color: '#0F2557' }}>
              Results for {order.patient?.full_name || '—'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Order LAB-{order.id}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {items.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">No test items found for this order.</p>
            )}
            {items.map((item, idx) => (
              <div key={item.item_id} className="border border-gray-200 rounded-xl p-4">
                <div className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: '#0F2557' }}>
                  <FlaskConical size={14} />
                  {item.test_name}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Result Value <span className="text-red-500">*</span></label>
                    <input
                      className="input"
                      placeholder="e.g. 98.6"
                      value={item.result_value}
                      onChange={e => updateItem(idx, 'result_value', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Unit</label>
                    <input
                      className="input"
                      placeholder="e.g. mg/dL"
                      value={item.unit}
                      onChange={e => updateItem(idx, 'unit', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Reference Range</label>
                    <input
                      className="input"
                      placeholder="e.g. 70–110"
                      value={item.reference_range}
                      onChange={e => updateItem(idx, 'reference_range', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Method <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      className="input"
                      placeholder="e.g. Colorimetric"
                      value={item.method}
                      onChange={e => updateItem(idx, 'method', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 flex items-center pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={item.is_abnormal}
                        onChange={e => updateItem(idx, 'is_abnormal', e.target.checked)}
                        className="w-4 h-4 rounded accent-red-600"
                      />
                      <span className="text-sm font-medium text-gray-700">Flag as Abnormal</span>
                      {item.is_abnormal && <span className="badge badge-red text-xs">Abnormal</span>}
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="mx-6 mb-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mx-6 mb-3 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              <CheckCircle size={16} /><span>Results saved and order marked completed!</span>
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || items.length === 0} className="btn-primary">
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                : <><CheckCircle size={15} />Save Results</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ResultEntry() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [resultsOrder, setResultsOrder] = useState(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [sampledRes, processingRes] = await Promise.all([
        api.get('/lab/orders', { params: { status: 'sample_collected', limit: 200 } }),
        api.get('/lab/orders', { params: { status: 'processing', limit: 200 } }),
      ])
      const combined = [
        ...(Array.isArray(sampledRes) ? sampledRes : []),
        ...(Array.isArray(processingRes) ? processingRes : []),
      ]
      // deduplicate by id
      const seen = new Set()
      setOrders(combined.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true }))
    } catch (err) {
      setError(err.message || 'Failed to load orders')
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
        <button onClick={fetchOrders} className="btn-secondary text-sm">Refresh</button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-xl border border-gray-200 p-1 w-fit shadow-sm">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={activeTab === tab.key ? { background: '#0F2557' } : {}}
          >
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

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="card p-16 text-center">
          <ClipboardEdit size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No orders pending result entry</p>
          <p className="text-gray-400 text-sm mt-1">Orders will appear here once samples are collected.</p>
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
                  <th className="th">Sample Collected</th>
                  <th className="th">Status</th>
                  <th className="th">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(order => (
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
                    <td className="td text-xs text-gray-500">{formatDateTime(order.updated_at || order.created_at)}</td>
                    <td className="td">
                      <span className={`badge ${STATUS_BADGE[order.status] || 'badge-gray'}`}>
                        {order.status?.replace(/_/g, ' ') || '—'}
                      </span>
                    </td>
                    <td className="td">
                      <button
                        onClick={() => setResultsOrder(order)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
                        style={{ background: '#CC1414' }}
                      >
                        <ClipboardEdit size={13} />
                        Enter Results
                      </button>
                    </td>
                  </tr>
                ))}
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
