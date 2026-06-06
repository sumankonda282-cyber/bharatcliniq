import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { Bed, Search, RefreshCw, ChevronRight, UserPlus } from 'lucide-react'

export default function InpatientDesk() {
  const navigate = useNavigate()
  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/inpatient/admissions', { params: { status: 'active' } })
      setAdmissions(Array.isArray(data) ? data : data.items || [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = admissions.filter(a => {
    const q = search.toLowerCase()
    return (
      a.patient?.full_name?.toLowerCase().includes(q) ||
      a.admission_number?.toLowerCase().includes(q) ||
      a.ward?.name?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Bed size={20} /> Inpatient Desk
        </h1>
        <button onClick={load} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-8" placeholder="Search patient, IP number, ward…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400">No active admissions found.</div>
          )}
          {filtered.map(a => {
            const p = a.patient || {}
            const age = p.date_of_birth ? Math.floor((new Date() - new Date(p.date_of_birth)) / 31557600000) : '?'
            const days = Math.floor((new Date() - new Date(a.admitted_at)) / 86400000)
            return (
              <div
                key={a.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
                onClick={() => navigate(`/inpatient/${a.id}`)}
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold flex-shrink-0">
                  {p.full_name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{p.full_name}</span>
                    <span className="text-gray-500 text-sm">{age}y {p.gender?.[0]}</span>
                    <span className="text-xs text-gray-400">{a.admission_number}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {a.ward?.name || 'Ward —'} · Bed {a.bed?.bed_number || '—'} · Day {days}
                    {a.primary_diagnosis && <span className="ml-2 text-gray-400">· {a.primary_diagnosis.slice(0, 40)}</span>}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
