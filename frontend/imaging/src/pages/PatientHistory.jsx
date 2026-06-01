import { useState, useCallback } from 'react'
import api from '../api/client'
import { Search, Users, ScanLine, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

export default function PatientHistory() {
  const [query, setQuery]       = useState('')
  const [patients, setPatients] = useState([])
  const [selected, setSelected] = useState(null)
  const [orders, setOrders]     = useState([])
  const [expanded, setExpanded] = useState(null)
  const [searching, setSearching]     = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)

  const search = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const r = await api.get('/patients', { params: { search: query, limit: 20 } })
      setPatients(Array.isArray(r) ? r : [])
      setSelected(null); setOrders([])
    } catch {}
    finally { setSearching(false) }
  }, [query])

  const loadHistory = async (patient) => {
    setSelected(patient); setLoadingOrders(true)
    try {
      const r = await api.get('/imaging/orders', { params: { limit: 500 } })
      const all = Array.isArray(r) ? r : []
      setOrders(all.filter(o => o.patient_id === patient.id || o.patient?.id === patient.id))
    } catch {}
    finally { setLoadingOrders(false) }
  }

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Patient Imaging History</h1></div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search patient by name or mobile…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
          />
        </div>
        <button onClick={search} disabled={searching} className="btn-primary">
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Search
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-700 text-sm">Patients Found</div>
          {patients.length === 0 ? (
            <div className="p-8 text-center text-gray-400"><Users size={28} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Search to find a patient</p></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {patients.map(p => (
                <button key={p.id} onClick={() => loadHistory(p)}
                  className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${selected?.id === p.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                  <div className="font-medium text-gray-800 text-sm">{p.full_name}</div>
                  <div className="text-xs text-gray-500">{p.mobile}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="card p-12 text-center text-gray-400">
              <ScanLine size={36} className="mx-auto mb-3 opacity-30" />
              <p>Select a patient to view their imaging history</p>
            </div>
          ) : loadingOrders ? (
            <div className="card flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-800">{selected.full_name}</div>
                  <div className="text-xs text-gray-500">{orders.length} imaging study{orders.length !== 1 ? 's' : ''}</div>
                </div>
                {orders.length > 0 && <button onClick={() => window.print()} className="btn-secondary text-xs">Print History</button>}
              </div>
              {orders.length === 0 ? (
                <div className="p-10 text-center text-gray-400"><ScanLine size={28} className="mx-auto mb-2 opacity-30" /><p>No imaging studies found</p></div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(o => (
                    <div key={o.id}>
                      <button onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                        className="w-full text-left px-5 py-4 hover:bg-gray-50 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs font-semibold text-gray-500">IMG-{o.id}</span>
                            <span className="font-medium text-sm">{o.modality || o.body_part || 'Imaging Study'}</span>
                            <span className={`badge ${o.status === 'completed' ? 'badge-green' : o.status === 'in_progress' ? 'badge-purple' : 'badge-yellow'}`}>{o.status?.replace('_', ' ')}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                            {o.findings && ' · Report available'}
                          </div>
                        </div>
                        {expanded === o.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </button>
                      {expanded === o.id && (
                        <div className="px-5 pb-5 bg-gray-50 space-y-3">
                          {o.findings && (
                            <div className="rounded-xl border border-gray-200 bg-white p-4">
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Findings</div>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{o.findings}</p>
                            </div>
                          )}
                          {o.impression && (
                            <div className="rounded-xl border border-gray-200 bg-white p-4">
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Impression</div>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{o.impression}</p>
                            </div>
                          )}
                          {o.recommendation && (
                            <div className="rounded-xl border border-gray-200 bg-white p-4">
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Recommendation</div>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{o.recommendation}</p>
                            </div>
                          )}
                          {!o.findings && !o.impression && (
                            <p className="text-sm text-gray-400 italic">Report not yet finalized.</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
