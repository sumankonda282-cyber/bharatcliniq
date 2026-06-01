import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { Loader2, AlertCircle, FlaskConical, ChevronDown, X, CheckCircle } from 'lucide-react'

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'sample_collected', label: 'Sample Collected' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed', label: 'Completed' },
]

const STATUS_FLOW = {
  pending: 'sample_collected',
  sample_collected: 'processing',
  processing: 'completed',
}

const STATUS_BADGE = {
  pending: 'badge-yellow',
  sample_collected: 'badge-blue',
  processing: 'badge-purple',
  completed: 'badge-green',
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
    }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  const submit = async e => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await api.put(`/lab/orders/${order.id}/results`, {
        items: items.map(({ item_id, result_value, unit, reference_range, is_abnormal }) => ({
          item_id, result_value, unit, reference_range, is_abnormal
        }))
      })
      setSuccess(true)
      setTimeout(() => { onSaved(); onClose() }, 1000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,37,87,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-lg" style={{ color: '#0F2557' }}>Enter Test Results</h3>
            <p className="text-xs text-gray-500 mt-0.5">Order LAB-{order.id} · {order.patient?.full_name || '—'}</p>
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
                <div className="font-medium text-sm mb-3" style={{ color: '#0F2557' }}>{item.test_name}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Result Value</label>
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
                      placeholder="e.g. 70–100"
                      value={item.reference_range}
                      onChange={e => updateItem(idx, 'reference_range', e.target.value)}
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={item.is_abnormal}
                        onChange={e => updateItem(idx, 'is_abnormal', e.target.checked)}
                        className="w-4 h-4 rounded accent-red-600"
                      />
                      <span className="text-sm font-medium text-gray-700">Mark as Abnormal</span>
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
              <CheckCircle size={16} /><span>Results saved successfully!</span>
            </div>
          )}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || items.length === 0} className="btn-primary">
              {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : 'Save Results'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [updatingId, setUpdatingId] = useState(null)
  const [resultsOrder, setResultsOrder] = useState(null)

  const fetchOrders = useCallback(() => {
    setLoading(true); setError('')
    const params = activeTab !== 'all' ? { status: activeTab, limit: 200 } : { limit: 200 }
    api.get('/lab/orders', { params })
      .then(r => setOrders(Array.isArray(r) ? r : []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [activeTab])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const advanceStatus = async (order) => {
    const next = STATUS_FLOW[order.status]
    if (!next) return
    setUpdatingId(order.id)
    try {
      await api.patch(`/lab/orders/${order.id}/status`, { status: next })
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o))
    } catch (err) {
      alert(err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const formatDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Test Orders</h1>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-xl border border-gray-200 p-1 w-fit shadow-sm">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={activeTab === tab.key ? { background: '#0F2557' } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-400" /></div>}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="card p-16 text-center">
          <FlaskConical size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No orders found</p>
          <p className="text-gray-400 text-sm mt-1">
            {activeTab !== 'all' ? `No ${activeTab.replace('_', ' ')} orders at the moment.` : 'No lab orders have been created yet.'}
          </p>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Order #</th>
                  <th className="th">Patient</th>
                  <th className="th">Doctor</th>
                  <th className="th">Tests</th>
                  <th className="th">Status</th>
                  <th className="th">Date</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(order => (
                  <tr key={order.id} className="tr-hover">
                    <td className="td font-mono text-xs text-gray-500">LAB-{order.id}</td>
                    <td className="td">
                      <div className="font-medium text-gray-800">{order.patient?.full_name || '—'}</div>
                      {order.patient?.mobile && <div className="text-xs text-gray-400">{order.patient.mobile}</div>}
                    </td>
                    <td className="td text-gray-600">{order.doctor?.full_name || order.referred_by || '—'}</td>
                    <td className="td">
                      <span className="font-medium">{order.items?.length || 0}</span>
                      <span className="text-gray-400 text-xs ml-1">test{(order.items?.length || 0) !== 1 ? 's' : ''}</span>
                    </td>
                    <td className="td">
                      <span className={`badge ${STATUS_BADGE[order.status] || 'badge-gray'}`}>
                        {order.status?.replace(/_/g, ' ') || '—'}
                      </span>
                    </td>
                    <td className="td text-xs text-gray-500">{formatDate(order.created_at)}</td>
                    <td className="td">
                      <div className="flex items-center gap-2 flex-wrap">
                        {STATUS_FLOW[order.status] && (
                          <button
                            onClick={() => advanceStatus(order)}
                            disabled={updatingId === order.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-50"
                            style={{ background: '#F5821E' }}
                          >
                            {updatingId === order.id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <ChevronDown size={12} />
                            }
                            → {STATUS_FLOW[order.status].replace(/_/g, ' ')}
                          </button>
                        )}
                        <button
                          onClick={() => setResultsOrder(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{ background: '#0F255710', color: '#0F2557' }}
                        >
                          <FlaskConical size={12} />
                          Enter Results
                        </button>
                      </div>
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
