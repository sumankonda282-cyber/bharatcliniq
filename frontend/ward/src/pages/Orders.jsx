import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { usePin } from '../contexts/PinContext'
import { FlaskConical, Activity, Utensils, PersonStanding, Bell, Stethoscope, CheckCircle2, Search, RefreshCw } from 'lucide-react'

const TYPE_ICON = {
  lab:       FlaskConical,
  imaging:   Activity,
  procedure: Stethoscope,
  diet:      Utensils,
  activity:  PersonStanding,
  nursing:   Bell,
  consult:   Stethoscope,
}

const PRIORITY_BADGE = {
  stat:    'bg-red-100 text-red-800',
  urgent:  'bg-amber-100 text-amber-800',
  routine: 'bg-gray-100 text-gray-600',
}

const STATUS_BADGE = {
  pending:       'bg-blue-100 text-blue-800',
  acknowledged:  'bg-indigo-100 text-indigo-800',
  in_progress:   'bg-purple-100 text-purple-800',
  completed:     'bg-emerald-100 text-emerald-800',
  cancelled:     'bg-red-100 text-red-700',
}

export default function Orders() {
  const { requestPin } = usePin()
  const [admissions, setAdmissions] = useState([])
  const [selected, setSelected]     = useState(null)
  const [orders, setOrders]         = useState([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get('/inpatient/admissions', { params: { status: 'active' } })
      .then(d => setAdmissions(Array.isArray(d) ? d : d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const loadOrders = useCallback(async (admission) => {
    setSelected(admission)
    try {
      const data = await api.get(`/inpatient/admissions/${admission.id}/clinical-orders`)
      setOrders(data || [])
    } catch { setOrders([]) }
  }, [])

  const acknowledge = async (order) => {
    try {
      await requestPin()
      await api.post(`/inpatient/clinical-orders/${order.id}/acknowledge`)
      loadOrders(selected)
    } catch (e) { if (e?.message !== 'PIN entry cancelled') alert(e?.detail || e?.message) }
  }

  const complete = async (order) => {
    const notes = window.prompt('Result / completion notes (optional):')
    if (notes === null) return
    try {
      await requestPin()
      await api.post(`/inpatient/clinical-orders/${order.id}/complete`, { result_notes: notes })
      loadOrders(selected)
    } catch (e) { if (e?.message !== 'PIN entry cancelled') alert(e?.detail || e?.message) }
  }

  const filtered = admissions.filter(a => {
    const q = search.toLowerCase()
    return a.patient?.full_name?.toLowerCase().includes(q) || a.ward?.name?.toLowerCase().includes(q)
  })

  if (!selected) {
    return (
      <div className="p-4 space-y-3">
        <h1 className="font-bold text-lg text-emerald-900">Clinical Orders</h1>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8" placeholder="Search patient or ward…" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        {loading ? <p className="text-gray-400 text-sm text-center py-6">Loading…</p> : (
          <div className="space-y-2">
            {filtered.map(a => {
              const p = a.patient || {}
              return (
                <button key={a.id} onClick={() => loadOrders(a)}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 hover:border-emerald-400 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center flex-shrink-0">
                    {p.full_name?.[0] || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{p.full_name}</div>
                    <div className="text-xs text-gray-500">{a.ward?.name} · Bed {a.bed?.bed_number}</div>
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && <p className="text-gray-400 text-sm text-center py-6">No active patients.</p>}
          </div>
        )}
      </div>
    )
  }

  const p = selected.patient || {}
  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled')
  const doneOrders   = orders.filter(o => o.status === 'completed' || o.status === 'cancelled')

  return (
    <div className="flex flex-col h-full">
      <div className="bg-emerald-800 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => setSelected(null)} className="text-emerald-200 hover:text-white text-sm">← Back</button>
        <div className="flex-1">
          <div className="font-bold">{p.full_name}</div>
          <div className="text-xs text-emerald-200">{selected.ward?.name} · Bed {selected.bed?.bed_number}</div>
        </div>
        <button onClick={() => loadOrders(selected)} className="p-1.5 hover:bg-emerald-700 rounded">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {orders.length === 0 && <p className="text-gray-400 text-sm text-center py-10">No clinical orders.</p>}

        {activeOrders.map(o => {
          const Icon = TYPE_ICON[o.order_type] || Bell
          return (
            <div key={o.id} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-gray-100 rounded-lg flex-shrink-0"><Icon size={14} className="text-gray-600" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{o.order_detail}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_BADGE[o.priority] || ''}`}>{o.priority}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[o.status] || ''}`}>{o.status}</span>
                  </div>
                  {o.instructions && <div className="text-xs text-gray-500 mt-0.5">{o.instructions}</div>}
                  <div className="text-xs text-gray-400 mt-1">
                    {o.order_type} · {o.orderer_name} · {o.ordered_at ? new Date(o.ordered_at).toLocaleString('en-IN') : ''}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-2 justify-end">
                {o.status === 'pending' && (
                  <button onClick={() => acknowledge(o)}
                    className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-xs font-semibold hover:bg-indigo-200">
                    Acknowledge
                  </button>
                )}
                {(o.status === 'pending' || o.status === 'acknowledged' || o.status === 'in_progress') && (
                  <button onClick={() => complete(o)}
                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700">
                    Complete
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {doneOrders.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-gray-400 cursor-pointer">Completed / Cancelled ({doneOrders.length})</summary>
            <div className="space-y-1 mt-1">
              {doneOrders.map(o => (
                <div key={o.id} className="bg-gray-50 border border-gray-100 rounded-lg p-2 opacity-60">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    <span className="text-gray-700">{o.order_detail}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_BADGE[o.status] || ''}`}>{o.status}</span>
                  </div>
                  {o.result_notes && <div className="text-xs text-gray-500 ml-5 mt-0.5">{o.result_notes}</div>}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
