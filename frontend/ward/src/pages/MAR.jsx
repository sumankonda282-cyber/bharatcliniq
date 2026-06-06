import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { usePin } from '../contexts/PinContext'
import { CheckCircle2, Clock, XCircle, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Search } from 'lucide-react'

const STATUS_STYLE = {
  scheduled: { cls: 'bg-blue-50 border-blue-200',   badge: 'bg-blue-100 text-blue-800',    label: 'Due' },
  given:     { cls: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', label: 'Given' },
  held:      { cls: 'bg-amber-50 border-amber-200',  badge: 'bg-amber-100 text-amber-800',  label: 'Held' },
  missed:    { cls: 'bg-red-50 border-red-200',      badge: 'bg-red-100 text-red-800',      label: 'Missed' },
}

export default function MAR() {
  const { requestPin } = usePin()
  const [admissions, setAdmissions] = useState([])
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState(null)  // admission
  const [marEntries, setMarEntries]  = useState([])
  const [loading, setLoading]        = useState(false)
  const [loadingMar, setLoadingMar]  = useState(false)
  const [expanded, setExpanded]      = useState({})

  // Load active admissions
  useEffect(() => {
    setLoading(true)
    api.get('/inpatient/admissions', { params: { status: 'active' } })
      .then(d => setAdmissions(Array.isArray(d) ? d : d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const loadMAR = useCallback(async (admission) => {
    setSelected(admission)
    setLoadingMar(true)
    try {
      const entries = await api.get(`/inpatient/admissions/${admission.id}/mar`)
      setMarEntries(entries || [])
    } catch { setMarEntries([]) }
    finally { setLoadingMar(false) }
  }, [])

  // Group MAR entries by order_id (or drug_name if no order)
  const grouped = marEntries.reduce((acc, e) => {
    const key = e.order_id ? `order_${e.order_id}` : `drug_${e.drug_name}`
    if (!acc[key]) acc[key] = { drug_name: e.drug_name, dose: e.dose, route: e.route, entries: [] }
    acc[key].entries.push(e)
    return acc
  }, {})

  const administer = async (entry) => {
    try {
      const creds = await requestPin()
      const isIV = entry.route === 'IV'
      let ivRate = null
      if (isIV) {
        ivRate = window.prompt('IV infusion rate (mL/hr) or confirm volume given:')
        if (ivRate === null) return
      }
      await api.patch(`/inpatient/mar/${entry.id}/administer`, {
        administered_by: creds.staff_id,
        administered_at: new Date().toISOString(),
        status: 'given',
        site: isIV ? null : window.prompt('Site (e.g. right deltoid) — or press OK to skip') || null,
        notes: ivRate ? `Rate: ${ivRate}` : null,
      })
      loadMAR(selected)
    } catch (e) {
      if (e?.message !== 'PIN entry cancelled') alert('Failed: ' + (e?.detail || e?.message))
    }
  }

  const hold = async (entry) => {
    const reason = window.prompt('Reason for holding this dose:')
    if (reason === null) return
    try {
      const creds = await requestPin()
      await api.patch(`/inpatient/mar/${entry.id}/administer`, {
        administered_by: creds.staff_id,
        status: 'held',
        reason_held: reason,
      })
      loadMAR(selected)
    } catch (e) {
      if (e?.message !== 'PIN entry cancelled') alert('Failed: ' + (e?.detail || e?.message))
    }
  }

  const filtered = admissions.filter(a => {
    const q = search.toLowerCase()
    return a.patient?.full_name?.toLowerCase().includes(q) || a.ward?.name?.toLowerCase().includes(q)
  })

  const now = new Date()
  const isDue = (e) => e.status === 'scheduled' && e.scheduled_at && new Date(e.scheduled_at) <= now
  const isUpcoming = (e) => e.status === 'scheduled' && e.scheduled_at && new Date(e.scheduled_at) > now

  if (!selected) {
    return (
      <div className="p-4 space-y-3">
        <h1 className="font-bold text-lg text-emerald-900">Medication Administration Record</h1>
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
                <button key={a.id} onClick={() => loadMAR(a)}
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
            {filtered.length === 0 && <p className="text-gray-400 text-sm text-center py-6">No active admissions.</p>}
          </div>
        )}
      </div>
    )
  }

  const p = selected.patient || {}

  return (
    <div className="flex flex-col h-full">
      {/* Patient header */}
      <div className="bg-emerald-800 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => setSelected(null)} className="text-emerald-200 hover:text-white text-sm">← Back</button>
        <div className="flex-1">
          <div className="font-bold">{p.full_name}</div>
          <div className="text-xs text-emerald-200">{selected.ward?.name} · Bed {selected.bed?.bed_number}</div>
        </div>
        <button onClick={() => loadMAR(selected)} className="p-1.5 hover:bg-emerald-700 rounded">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loadingMar && <p className="text-gray-400 text-sm text-center py-6">Loading MAR…</p>}
        {!loadingMar && Object.entries(grouped).length === 0 && (
          <p className="text-gray-400 text-sm text-center py-10">No medication orders for this patient.</p>
        )}

        {Object.entries(grouped).map(([key, group]) => {
          const isOpen = expanded[key] !== false
          const dueEntries = group.entries.filter(isDue)
          const hasDue = dueEntries.length > 0

          return (
            <div key={key} className={`border rounded-xl overflow-hidden ${hasDue ? 'border-amber-300' : 'border-gray-200'}`}>
              {/* Drug header */}
              <button className={`w-full flex items-center gap-2 px-3 py-2.5 text-left ${hasDue ? 'bg-amber-50' : 'bg-white'}`}
                onClick={() => setExpanded(e => ({ ...e, [key]: !isOpen }))}>
                {hasDue && <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />}
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 text-sm">{group.drug_name}</div>
                  <div className="text-xs text-gray-500">{group.dose} · {group.route}</div>
                </div>
                <div className="text-xs text-gray-400">{group.entries.length} doses</div>
                {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>

              {/* Dose entries */}
              {isOpen && (
                <div className="divide-y divide-gray-100">
                  {group.entries.map(entry => {
                    const style = STATUS_STYLE[entry.status] || STATUS_STYLE.scheduled
                    const scheduledTime = entry.scheduled_at ? new Date(entry.scheduled_at) : null
                    const due = isDue(entry)

                    return (
                      <div key={entry.id} className={`px-3 py-2.5 flex items-center gap-2 ${style.cls}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${style.badge}`}>{style.label}</span>
                            {scheduledTime && (
                              <span className={`text-xs ${due ? 'text-amber-700 font-semibold' : 'text-gray-500'}`}>
                                <Clock size={10} className="inline mr-0.5" />
                                {scheduledTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          {entry.status !== 'scheduled' && entry.administered_at && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {entry.status === 'given' ? 'Given' : 'Held'} at {new Date(entry.administered_at || entry.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              {entry.reason_held && ` — ${entry.reason_held}`}
                            </div>
                          )}
                        </div>

                        {entry.status === 'scheduled' && (
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={() => administer(entry)}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700">
                              Give
                            </button>
                            <button onClick={() => hold(entry)}
                              className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold hover:bg-amber-200">
                              Hold
                            </button>
                          </div>
                        )}
                        {entry.status === 'given' && <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />}
                        {entry.status === 'held'  && <XCircle size={16} className="text-amber-500 flex-shrink-0" />}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
