import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { FileEdit, Loader2, AlertCircle, CheckCircle, Clock, User } from 'lucide-react'

const STATUS_BADGE = {
  pending:     'badge-yellow',
  scheduled:   'badge-blue',
  in_progress: 'badge-purple',
  completed:   'badge-green',
}

function timeSince(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const EMPTY_FORM = {
  findings: '',
  impression: '',
  recommendation: '',
  technique: '',
  radiologist_name: '',
  report_status: 'draft',
}

export default function ReportWriter() {
  const { user } = useAuth()
  const location = useLocation()

  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [selected, setSelected]   = useState(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM, radiologist_name: user?.full_name || '' })
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedOk, setSavedOk]     = useState(false)
  const [confirmFinalize, setConfirmFinalize] = useState(false)

  const fetchOrders = useCallback(() => {
    setLoading(true)
    setError('')
    api.get('/imaging/orders', { params: { limit: 300 } })
      .then(r => {
        const list = Array.isArray(r) ? r : []
        const needReport = list.filter(o =>
          o.status === 'pending' || o.status === 'scheduled' || o.status === 'in_progress'
        )
        setOrders(needReport)

        // Pre-select from navigation state
        const preId = location.state?.orderId
        if (preId) {
          const found = needReport.find(o => o.id === preId)
          if (found) selectOrder(found)
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchOrders() }, [fetchOrders])

  function selectOrder(order) {
    setSelected(order)
    setSaveError('')
    setSavedOk(false)
    setConfirmFinalize(false)
    setForm({
      findings:          order.findings || '',
      impression:        order.impression || '',
      recommendation:    order.recommendation || '',
      technique:         order.notes || '',
      radiologist_name:  order.radiologist_name || user?.full_name || '',
      report_status:     order.status === 'in_progress' ? 'draft' : 'draft',
    })
  }

  const save = async (finalise) => {
    if (!selected) return
    setSaving(true)
    setSaveError('')
    setSavedOk(false)
    try {
      await api.put(`/imaging/orders/${selected.id}`, {
        status:            finalise ? 'completed' : 'in_progress',
        findings:          form.findings,
        impression:        form.impression,
        recommendation:    form.recommendation,
        notes:             form.technique,
        radiologist_name:  form.radiologist_name,
      })
      setSavedOk(true)
      if (finalise) {
        setConfirmFinalize(false)
        // Remove from list
        setOrders(prev => prev.filter(o => o.id !== selected.id))
        setSelected(null)
        setForm({ ...EMPTY_FORM, radiologist_name: user?.full_name || '' })
      } else {
        // Update in list
        setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: 'in_progress', ...form, notes: form.technique } : o))
        setSelected(prev => ({ ...prev, status: 'in_progress' }))
      }
      setTimeout(() => setSavedOk(false), 3000)
    } catch (err) {
      setSaveError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const field = (key) => ({
    value: form[key],
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Report Writer</h1>
        <p className="text-sm text-gray-500 mt-1">{orders.length} order{orders.length !== 1 ? 's' : ''} awaiting report</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={fetchOrders} className="ml-auto underline text-xs">Retry</button>
        </div>
      )}

      <div className="flex gap-5" style={{ minHeight: '70vh' }}>
        {/* Left panel — order list */}
        <div className="flex-shrink-0 w-80 flex flex-col gap-2">
          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-gray-400" />
            </div>
          )}
          {!loading && orders.length === 0 && !error && (
            <div className="card p-8 text-center text-gray-500">
              <CheckCircle size={32} className="mx-auto mb-3 text-green-500" />
              <div className="font-semibold text-gray-700">All caught up!</div>
              <div className="text-sm mt-1">No orders pending a report.</div>
            </div>
          )}
          {!loading && orders.map(order => {
            const isActive = selected?.id === order.id
            return (
              <button
                key={order.id}
                onClick={() => selectOrder(order)}
                className="card p-4 text-left transition-all hover:shadow-md"
                style={isActive ? { borderColor: '#0F2557', borderWidth: 2, background: '#0F255708' } : {}}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-xs text-gray-400">IMG-{order.id}</span>
                  <span className={`badge ${STATUS_BADGE[order.status] || 'badge-gray'} flex-shrink-0`}>
                    {order.status?.replace('_', ' ')}
                  </span>
                </div>
                <div className="font-semibold text-sm mb-0.5" style={{ color: '#0F2557' }}>
                  {order.patient?.full_name || '—'}
                </div>
                <div className="text-xs text-gray-500 mb-1">{order.modality || order.body_part || '—'}</div>
                {(order.ordered_by_name || order.doctor?.full_name) && (
                  <div className="text-xs text-gray-400">
                    Dr. {order.ordered_by_name || order.doctor?.full_name}
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                  <Clock size={11} />
                  {timeSince(order.created_at)}
                </div>
              </button>
            )
          })}
        </div>

        {/* Right panel — report form */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="card h-full flex flex-col items-center justify-center text-center text-gray-400 py-24">
              <FileEdit size={48} className="mb-4 opacity-30" />
              <div className="font-semibold text-gray-600 text-lg">Select an order to write a report</div>
              <div className="text-sm mt-1">Choose from the list on the left</div>
            </div>
          ) : (
            <div className="card p-6">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 mb-5 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-sm text-gray-400">IMG-{selected.id}</span>
                    <span className={`badge ${STATUS_BADGE[selected.status] || 'badge-gray'}`}>
                      {selected.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xl font-bold" style={{ color: '#0F2557' }}>
                    {selected.patient?.full_name || '—'}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                    <span>{selected.modality || selected.body_part || '—'}</span>
                    {(selected.ordered_by_name || selected.doctor?.full_name) && (
                      <span>Ordered by: Dr. {selected.ordered_by_name || selected.doctor?.full_name}</span>
                    )}
                    {selected.created_at && (
                      <span>{new Date(selected.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Clinical History */}
              {selected.clinical_history || selected.reason_for_exam ? (
                <div className="mb-4">
                  <label className="label">Clinical History</label>
                  <div className="input bg-gray-50 text-gray-600 text-sm min-h-[2.5rem]">
                    {selected.clinical_history || selected.reason_for_exam}
                  </div>
                </div>
              ) : null}

              {/* Technique */}
              <div className="mb-4">
                <label className="label">Technique</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="e.g. Plain X-ray, PA view; contrast-enhanced CT abdomen…"
                  {...field('technique')}
                />
              </div>

              {/* Findings */}
              <div className="mb-4">
                <label className="label">
                  Findings <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="input resize-none"
                  rows={7}
                  placeholder="Detailed radiological findings, observations, measurements…"
                  {...field('findings')}
                />
              </div>

              {/* Impression */}
              <div className="mb-4">
                <label className="label">
                  Impression <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Summary diagnosis / conclusion…"
                  {...field('impression')}
                />
              </div>

              {/* Recommendation */}
              <div className="mb-4">
                <label className="label">Recommendation</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="Suggested follow-up, additional tests, clinical correlation…"
                  {...field('recommendation')}
                />
              </div>

              {/* Radiologist name */}
              <div className="mb-5">
                <label className="label">
                  <User size={13} className="inline mr-1" />
                  Radiologist Name
                </label>
                <input
                  className="input"
                  placeholder="Radiologist name"
                  {...field('radiologist_name')}
                />
              </div>

              {/* Feedback */}
              {saveError && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle size={15} />
                  <span>{saveError}</span>
                </div>
              )}
              {savedOk && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                  <CheckCircle size={15} />
                  <span>Saved successfully.</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => save(false)}
                  disabled={saving}
                  className="btn-secondary flex-1 justify-center"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                  Save Draft
                </button>
                <button
                  onClick={() => setConfirmFinalize(true)}
                  disabled={saving || !form.findings.trim() || !form.impression.trim()}
                  className="btn-primary flex-1 justify-center"
                >
                  Finalize Report
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Finalize confirmation dialog */}
      {confirmFinalize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,37,87,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#16A34A18' }}>
                <CheckCircle size={20} style={{ color: '#16A34A' }} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Finalize Report?</h3>
                <p className="text-xs text-gray-500 mt-0.5">IMG-{selected?.id} · {selected?.patient?.full_name}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              This will mark the order as <strong>Completed</strong> and lock the report. Are you sure you want to finalize?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmFinalize(false)} className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
              <button
                onClick={() => save(true)}
                disabled={saving}
                className="btn-success flex-1 justify-center"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                Yes, Finalize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
