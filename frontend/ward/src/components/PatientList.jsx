import { useEffect, useState } from 'react'
import api from '../api/client'

export default function PatientList({ selectedId, onSelect }) {
  const [patients, setPatients] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    api.get('/inpatient/admissions/?status=admitted')
      .then(data => {
        const list = Array.isArray(data) ? data : (data.items || data.admissions || [])
        setPatients(list)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-32 text-gray-500 text-sm animate-pulse">
      Loading patients…
    </div>
  )

  if (error) return (
    <div className="p-4 text-red-600 text-sm">Error: {error}</div>
  )

  if (patients.length === 0) return (
    <div className="flex flex-col items-center justify-center h-40 text-gray-400 px-4">
      <svg className="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
      </svg>
      <p className="text-sm text-center">No admitted patients</p>
    </div>
  )

  return (
    <ul className="divide-y divide-gray-100">
      {patients.map(p => {
        const name = p.patient_name || p.patient?.full_name || `Patient #${p.patient_id}`
        const bed  = p.bed_label || p.bed?.label || p.bed_number || '—'
        const mrn  = p.patient?.mrn || p.mrn || ''
        return (
          <li key={p.id}>
            <button
              onClick={() => onSelect(p)}
              className={`w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors ${
                selectedId === p.id ? 'bg-emerald-50 border-r-2 border-emerald-600' : ''
              }`}
            >
              <p className="font-medium text-gray-800 text-sm truncate">{name}</p>
              <p className="text-xs text-gray-500">Bed {bed}{mrn ? ` · MRN ${mrn}` : ''}</p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
