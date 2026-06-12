import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Loader2, X, CalendarPlus, UserPlus, User, Phone, Mail, MapPin } from 'lucide-react'
import api from '../api/client'

export default function PatientLookup() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const timer = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await api.get('/patients', { params: { search: q.trim(), limit: 20 } })
        setResults(Array.isArray(r) ? r : [])
      } catch { setResults([]) }
      setSearching(false)
    }, 300)
    return () => timer.current && clearTimeout(timer.current)
  }, [q])

  const fmtAge = (dob) => {
    if (!dob) return null
    return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) + 'y'
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/front-desk')}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Search size={20} className="text-blue-600" /> Patient Lookup
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Search by name, BHID, or mobile number</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => { setQ(e.target.value); setSelected(null) }}
            placeholder="Search patient by name, BHID, or mobile…"
            className="w-full pl-10 pr-10 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
          />
          {searching && <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
          {q && !searching && (
            <button onClick={() => { setQ(''); setResults([]); setSelected(null) }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Results list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {q.trim().length < 2 ? (
            <div className="p-8 text-center text-gray-400">
              <Search size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Type at least 2 characters to search</p>
            </div>
          ) : results.length === 0 && !searching ? (
            <div className="p-8 text-center text-gray-400">
              <User size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-gray-500 mb-1">No patient found for "{q}"</p>
              <p className="text-xs mb-4">Want to add them?</p>
              <button onClick={() => navigate('/front-desk/register')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700">
                <UserPlus size={14} /> Register New Patient
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {results.map(p => {
                const age = p.age != null ? `${p.age}y` : fmtAge(p.date_of_birth)
                const isSelected = selected?.id === p.id
                return (
                  <button key={p.id} onClick={() => setSelected(p)}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition flex items-center gap-3 ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}>
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <User size={15} className="text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.full_name}</p>
                      <p className="text-xs text-gray-400">
                        {p.bh_id || p.clinic_patient_id}
                        {p.mobile && ` · ${p.mobile}`}
                        {age && ` · ${age}`}
                        {p.gender && ` ${p.gender.charAt(0).toUpperCase()}`}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Patient detail card */}
        {selected ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <User size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{selected.full_name}</p>
                <p className="text-xs text-blue-600 font-mono">{selected.bh_id || selected.clinic_patient_id}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm mb-5">
              {selected.mobile && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone size={13} className="text-gray-400 flex-shrink-0" />
                  <span>{selected.mobile}</span>
                </div>
              )}
              {selected.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail size={13} className="text-gray-400 flex-shrink-0" />
                  <span className="truncate">{selected.email}</span>
                </div>
              )}
              {(selected.city || selected.state) && (
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                  <span>{[selected.city, selected.state].filter(Boolean).join(', ')}</span>
                </div>
              )}
              <div className="flex gap-4 pt-1">
                {(selected.age != null || selected.date_of_birth) && (
                  <div>
                    <p className="text-xs text-gray-400">Age</p>
                    <p className="font-semibold text-gray-800">
                      {selected.age != null ? `${selected.age}y` : fmtAge(selected.date_of_birth) || '—'}
                    </p>
                  </div>
                )}
                {selected.gender && (
                  <div>
                    <p className="text-xs text-gray-400">Gender</p>
                    <p className="font-semibold text-gray-800 capitalize">{selected.gender}</p>
                  </div>
                )}
                {selected.blood_group && (
                  <div>
                    <p className="text-xs text-gray-400">Blood Group</p>
                    <p className="font-semibold text-red-600">{selected.blood_group}</p>
                  </div>
                )}
              </div>
              {selected.allergies && (
                <div className="mt-1 p-2.5 bg-rose-50 rounded-lg">
                  <p className="text-xs text-rose-500 font-semibold mb-0.5">Allergies</p>
                  <p className="text-xs text-rose-700">{selected.allergies}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('/front-desk/book', { state: { patient: selected } })}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-700 font-medium transition">
              <CalendarPlus size={15} /> Book Appointment
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 hidden md:flex flex-col items-center justify-center">
            <User size={32} className="mb-3 opacity-20" />
            <p className="text-sm">Select a patient to view details</p>
          </div>
        )}
      </div>

      {/* Bottom register CTA */}
      {q.trim().length >= 2 && results.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-500">
          <span>Patient not in the list?</span>
          <button onClick={() => navigate('/front-desk/register')}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-xs">
            <UserPlus size={13} /> Register New Patient
          </button>
        </div>
      )}
    </div>
  )
}
