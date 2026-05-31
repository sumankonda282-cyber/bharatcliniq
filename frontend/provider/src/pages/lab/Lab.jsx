import { useState, useEffect } from 'react'
import { labApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import { FlaskConical, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

const STATUS_COLORS = {
  ordered: 'badge-yellow', sample_collected: 'badge-blue',
  processing: 'badge-purple', completed: 'badge-green', cancelled: 'badge-gray',
}

export default function Lab() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ordered')
  const [selected, setSelected] = useState(null)
  const [results, setResults] = useState([])
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    labApi.getOrders({ status: filter, limit: 50 })
      .then(r => setOrders(r.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const updateStatus = async (id, status) => {
    await labApi.updateStatus(id, status)
    load()
  }

  const openResults = (order) => {
    setSelected(order)
    setResults((order.items || []).map(item => ({
      id: item.id,
      test_name: item.test_name || item.test?.name || '',
      result_value: item.result_value || '',
      result_notes: item.result_notes || '',
      is_abnormal: item.is_abnormal || false,
    })))
  }

  const handleSaveResults = async () => {
    setSaving(true)
    try {
      await labApi.addResults(selected.id, results)
      setSelected(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Laboratory</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4 w-fit">
        {['ordered', 'sample_collected', 'processing', 'completed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${filter === s ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? <PageLoader /> : orders.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <FlaskConical size={36} className="mx-auto mb-2 opacity-30" />
            <p>No lab orders with status: {filter}</p>
          </div>
        ) : (
          <div className="table-wrapper rounded-xl border-0">
            <table className="table">
              <thead><tr>
                <th className="th">Order #</th><th className="th">Patient</th><th className="th">Tests</th>
                <th className="th">Ordered By</th><th className="th">Time</th><th className="th">Status</th><th className="th">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(order => (
                  <tr key={order.id} className="tr-hover">
                    <td className="td font-mono text-sm">LAB-{order.id}</td>
                    <td className="td font-medium">{order.patient_name || order.patient?.full_name}</td>
                    <td className="td">
                      <div className="text-xs space-y-0.5">
                        {(order.items || []).map((t, i) => (
                          <div key={i} className="text-gray-600">{t.test_name || t.test?.name}</div>
                        ))}
                      </div>
                    </td>
                    <td className="td text-gray-500 text-sm">{order.ordered_by_name || '—'}</td>
                    <td className="td text-xs text-gray-400">{new Date(order.created_at).toLocaleString('en-IN')}</td>
                    <td className="td"><span className={STATUS_COLORS[order.status] || 'badge-gray'}>{order.status?.replace('_', ' ')}</span></td>
                    <td className="td">
                      <div className="flex gap-2">
                        {order.status === 'ordered' && (
                          <button onClick={() => updateStatus(order.id, 'sample_collected')} className="text-xs text-blue-600 hover:underline">Collect Sample</button>
                        )}
                        {order.status === 'sample_collected' && (
                          <button onClick={() => updateStatus(order.id, 'processing')} className="text-xs text-purple-600 hover:underline">Start Processing</button>
                        )}
                        {order.status === 'processing' && (
                          <button onClick={() => openResults(order)} className="text-xs text-green-600 hover:underline">Enter Results</button>
                        )}
                        {order.status === 'completed' && (
                          <button onClick={() => openResults(order)} className="text-xs text-gray-600 hover:underline">View Results</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Results Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Enter Lab Results" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="text-sm text-gray-500">Order LAB-{selected.id} · {selected.patient_name}</div>
            {results.map((item, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="font-medium text-sm">{item.test_name}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Result Value</label>
                    <input
                      className="input text-sm"
                      placeholder="e.g. 12.5 g/dL"
                      value={item.result_value}
                      onChange={e => setResults(r => r.map((x, i) => i === idx ? { ...x, result_value: e.target.value } : x))}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <input
                      type="checkbox"
                      id={`abnormal-${idx}`}
                      checked={item.is_abnormal}
                      onChange={e => setResults(r => r.map((x, i) => i === idx ? { ...x, is_abnormal: e.target.checked } : x))}
                    />
                    <label htmlFor={`abnormal-${idx}`} className="text-sm text-red-600">Abnormal</label>
                  </div>
                </div>
                <div>
                  <label className="label text-xs">Notes</label>
                  <input className="input text-sm" value={item.result_notes} onChange={e => setResults(r => r.map((x, i) => i === idx ? { ...x, result_notes: e.target.value } : x))} />
                </div>
              </div>
            ))}
            <button onClick={handleSaveResults} disabled={saving} className="btn-success w-full justify-center">
              <CheckCircle size={15} />{saving ? 'Saving…' : 'Save Results & Complete'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
