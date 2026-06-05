import { useEffect, useState } from 'react'
import { Search, User, Loader2 } from 'lucide-react'
import api from '../api/client'

export default function PatientList({ selectedId, onSelect }) {
  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get('/inpatient/admissions?status=active')
      .then(data => setAdmissions(Array.isArray(data) ? data : (data.items || data.results || [])))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = admissions.filter(a => {
    const q = search.toLowerCase()
    const name = (a.patient?.full_name || a.patient_name || '').toLowerCase()
    const num = (a.admission_number || a.id || '').toString().toLowerCase()
    return name.includes(q) || num.includes(q)
  })

  return (
    <div className="w-72 flex-shrink-0 bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8 py-1.5 text-xs"
            placeholder="Search patient or admission #"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        )}
        {error && (
          <div className="p-4 text-sm text-red-600 text-center">{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">
            <User size={32} className="empty-state-icon" />
            <span className="empty-state-text">No active admissions</span>
          </div>
        )}
        {filtered.map(a => {
          const name = a.patient?.full_name || a.patient_name || 'Unknown'
          const admNo = a.admission_number || `#${a.id}`
          const bed = a.bed?.bed_number || a.bed_number || '—'
          const ward = a.ward?.name || a.ward_name || ''
          const isSelected = selectedId === a.id
          return (
            <button
              key={a.id}
              onClick={() => onSelect(a)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                isSelected
                  ? 'bg-emerald-50 border-l-4 border-l-emerald-600'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-sm text-gray-900 truncate">{name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{admNo}</div>
              {(ward || bed !== '—') && (
                <div className="text-xs text-gray-400 mt-0.5">
                  {ward}{ward && bed !== '—' ? ' · ' : ''}{bed !== '—' ? `Bed ${bed}` : ''}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
        {admissions.length} active admission{admissions.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
