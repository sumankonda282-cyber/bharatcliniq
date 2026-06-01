import { useState, useCallback } from 'react'
import api from '../api/client'
import { Search, Users, FlaskConical, ChevronDown, ChevronUp, AlertTriangle, Loader2 } from 'lucide-react'

export default function PatientHistory() {
  const [query, setQuery]       = useState('')
  const [patients, setPatients] = useState([])
  const [selected, setSelected] = useState(null)
  const [orders, setOrders]     = useState([])
  const [expanded, setExpanded] = useState(null)
  const [searching, setSearching]   = useState(false)
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
      const r = await api.get('/lab/orders', { params: { limit: 500 } })
      const all = Array.isArray(r) ? r : []
      setOrders(all.filter(o => o.patient_id === patient.id || o.patient?.id === patient.id))
    } catch {}
    finally { setLoadingOrders(false) }
  }

  const abnormalCount = (items = []) => items.filter(i => i.is_abnormal).length

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Patient Test History</h1></div>

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
        {/* Patient list */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-700 text-sm">Patients Found</div>
          {patients.length === 0 ? (
            <div className="p-8 text-center text-gray-400"><Users size={28} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Search to find a patient</p></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {patients.map(p => (
                <button
                  key={p.id}
                  onClick={() => loadHistory(p)}
                  className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${selected?.id === p.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                >
                  <div className="font-medium text-gray-800 text-sm">{p.full_name}</div>
                  <div className="text-xs text-gray-500">{p.mobile} {p.date_of_birth ? '· ' + Math.floor((new Date() - new Date(p.date_of_birth)) / 31557600000) + 'y' : ''}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Order history */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="card p-12 text-center text-gray-400">
              <FlaskConical size={36} className="mx-auto mb-3 opacity-30" />
              <p>Select a patient to view their lab history</p>
            </div>
          ) : loadingOrders ? (
            <div className="card flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-800">{selected.full_name}</div>
                  <div className="text-xs text-gray-500">{orders.length} lab order{orders.length !== 1 ? 's' : ''}</div>
                </div>
                {orders.length > 0 && <button onClick={() => window.print()} className="btn-secondary text-xs">Print History</button>}
              </div>
              {orders.length === 0 ? (
                <div className="p-10 text-center text-gray-400"><FlaskConical size={28} className="mx-auto mb-2 opacity-30" /><p>No lab orders found</p></div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(o => (
                    <div key={o.id}>
                      <button
                        onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                        className="w-full text-left px-5 py-4 hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-gray-500">LAB-{o.id}</span>
                              <span className={`badge ${o.status === 'completed' ? 'badge-green' : o.status === 'processing' ? 'badge-blue' : 'badge-yellow'}`}>{o.status?.replace('_', ' ')}</span>
                              {abnormalCount(o.items) > 0 && (
                                <span className="badge badge-red flex items-center gap-1"><AlertTriangle size={10} />{abnormalCount(o.items)} abnormal</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                              {o.items?.length ? ` · ${o.items.length} test${o.items.length !== 1 ? 's' : ''}` : ''}
                            </div>
                          </div>
                        </div>
                        {expanded === o.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </button>
                      {expanded === o.id && o.items?.length > 0 && (
                        <div className="px-5 pb-4 bg-gray-50">
                          <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <table className="table text-xs">
                              <thead>
                                <tr>
                                  <th className="th">Test</th>
                                  <th className="th">Result</th>
                                  <th className="th">Unit</th>
                                  <th className="th">Reference</th>
                                  <th className="th">Flag</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {o.items.map((item, i) => (
                                  <tr key={i} className={item.is_abnormal ? 'bg-red-50' : ''}>
                                    <td className="td font-medium">{item.test_name || item.name || '—'}</td>
                                    <td className={`td font-semibold ${item.is_abnormal ? 'text-red-600' : ''}`}>{item.result_value || '—'}</td>
                                    <td className="td text-gray-500">{item.unit || '—'}</td>
                                    <td className="td text-gray-500">{item.reference_range || '—'}</td>
                                    <td className="td">{item.is_abnormal ? <span className="badge badge-red">Abnormal</span> : <span className="badge badge-green">Normal</span>}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
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
