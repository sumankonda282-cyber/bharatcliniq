import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { patientsApi, tagsApi, appointmentsApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import { Search, Plus, User, X, Tag, ChevronDown } from 'lucide-react'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  scheduled:   { label: 'Scheduled',      color: 'bg-blue-50 text-blue-700 border-blue-200' },
  waiting:     { label: 'Waiting',         color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  triaged:     { label: 'Triaged',         color: 'bg-orange-50 text-orange-700 border-orange-200' },
  in_progress: { label: 'With Doctor',     color: 'bg-purple-50 text-purple-700 border-purple-200' },
  completed:   { label: 'Completed',       color: 'bg-green-50 text-green-700 border-green-200' },
  cancelled:   { label: 'Cancelled',       color: 'bg-red-50 text-red-600 border-red-200' },
}

function StatusBadge({ status }) {
  if (!status) return <span className="text-gray-200 text-xs">—</span>
  const s = STATUS[status] || { label: status, color: 'bg-gray-100 text-gray-600 border-gray-200' }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>
      {s.label}
    </span>
  )
}

// ── 3-Tier Tag Input ──────────────────────────────────────────────────────────
function TagInput({ patientId, currentTags, onTagsChange }) {
  const [open, setOpen]           = useState(false)
  const [saved, setSaved]         = useState([])
  const [suggestions, setSugs]    = useState([])
  const [freeMode, setFreeMode]   = useState(false)
  const [freeText, setFreeText]   = useState('')
  const [saveToClinic, setSaveToClinic] = useState(false)
  const [loading, setLoading]     = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    tagsApi.getSuggestions().then(r => {
      setSaved(r.saved || [])
      setSugs(r.suggestions || [])
    })
  }, [open])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isAssigned = (tagName) => currentTags.some(t => t.tag_name === tagName)

  const assign = async (tagName, icd10 = null, save = false) => {
    if (isAssigned(tagName)) return
    setLoading(true)
    try {
      const tag = await patientsApi.assignTag(patientId, { tag_name: tagName, icd10_code: icd10, save_to_clinic: save })
      onTagsChange([...currentTags, tag])
    } finally {
      setLoading(false)
    }
  }

  const remove = async (tagId) => {
    await patientsApi.removeTag(patientId, tagId)
    onTagsChange(currentTags.filter(t => t.id !== tagId))
  }

  const submitFree = async () => {
    if (!freeText.trim()) return
    await assign(freeText.trim(), null, saveToClinic)
    setFreeText('')
    setSaveToClinic(false)
    setFreeMode(false)
  }

  return (
    <div className="relative" ref={ref}>
      {/* Current tags + open button */}
      <div className="flex flex-wrap items-center gap-1">
        {currentTags.map(t => (
          <span key={t.id} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
            {t.tag_name}
            <button onClick={(e) => { e.stopPropagation(); remove(t.id) }} className="hover:text-red-500 ml-0.5">
              <X size={10} />
            </button>
          </span>
        ))}
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(v => !v); setFreeMode(false) }}
          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs text-gray-400 border border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
          <Tag size={10} /><span>Add</span>
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">

          {/* Tier 1 — Clinic saved tags */}
          {saved.length > 0 && (
            <div className="px-3 pt-3 pb-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Saved Tags</div>
              <div className="flex flex-wrap gap-1">
                {saved.map(t => (
                  <button
                    key={t.id}
                    disabled={isAssigned(t.tag_name) || loading}
                    onClick={() => assign(t.tag_name, t.icd10_code)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors
                      ${isAssigned(t.tag_name)
                        ? 'bg-blue-100 text-blue-700 border-blue-200 opacity-50 cursor-default'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700'}`}
                  >
                    {isAssigned(t.tag_name) ? '✓ ' : ''}{t.tag_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tier 2 — Specialty suggestions */}
          {suggestions.length > 0 && (
            <div className={`px-3 py-2 ${saved.length > 0 ? 'border-t border-gray-100' : 'pt-3'}`}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Suggested</div>
              <div className="flex flex-wrap gap-1">
                {suggestions.map(s => (
                  <button
                    key={s.tag}
                    disabled={isAssigned(s.tag) || loading}
                    onClick={() => assign(s.tag, s.icd10)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors
                      ${isAssigned(s.tag)
                        ? 'bg-blue-100 text-blue-700 border-blue-200 opacity-50 cursor-default'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600'}`}
                  >
                    {isAssigned(s.tag) ? '✓ ' : ''}{s.tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tier 3 — Free tag */}
          <div className="border-t border-gray-100 px-3 py-2">
            {!freeMode ? (
              <button
                onClick={() => setFreeMode(true)}
                className="w-full text-left text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 py-1"
              >
                <Plus size={12} /> Free Tag
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  autoFocus
                  className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Type condition..."
                  value={freeText}
                  onChange={e => setFreeText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitFree()}
                />
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={saveToClinic}
                    onChange={e => setSaveToClinic(e.target.checked)} />
                  Save to clinic tag library
                </label>
                <div className="flex gap-2">
                  <button onClick={() => { setFreeMode(false); setFreeText('') }}
                    className="flex-1 text-xs py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={submitFree} disabled={!freeText.trim() || loading}
                    className="flex-1 text-xs py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PatientList() {
  const [patients, setPatients]     = useState([])
  const [todayAppts, setTodayAppts] = useState({}) // patientId → status
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const navigate = useNavigate()

  const loadPatients = (q = search) => {
    setLoading(true)
    patientsApi.list({ search: q, limit: 50 })
      .then(r => setPatients(Array.isArray(r) ? r : []))
      .finally(() => setLoading(false))
  }

  // Load today's appointment statuses
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    appointmentsApi.list({ date: today, limit: 200 })
      .then(r => {
        const map = {}
        if (Array.isArray(r)) r.forEach(a => { map[a.patient_id] = a.status })
        setTodayAppts(map)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => loadPatients(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const updateTags = (patientId, tags) => {
    setPatients(ps => ps.map(p => p.id === patientId ? { ...p, tags } : p))
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Patients</h1>
        <Link to="/patients/new" className="btn-primary">
          <Plus size={16} />Register Patient
        </Link>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search by name or clinic ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? <PageLoader /> : patients.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <User size={36} className="mx-auto mb-2 opacity-30" />
            <p>No patients found</p>
            <Link to="/patients/new" className="btn-primary mt-4 inline-flex">Register first patient</Link>
          </div>
        ) : (
          <div className="table-wrapper rounded-none border-0">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Clinic ID</th>
                  <th className="th">Name</th>
                  <th className="th">Age / Gender</th>
                  <th className="th">Blood Group</th>
                  <th className="th">Conditions</th>
                  <th className="th">Today's Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patients.map(p => {
                  const age = p.date_of_birth
                    ? Math.floor((Date.now() - new Date(p.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))
                    : null
                  return (
                    <tr key={p.id} className="tr-hover cursor-pointer"
                      onClick={() => navigate(`/patients/${p.id}`)}>
                      <td className="td font-mono text-xs text-gray-500 whitespace-nowrap align-middle">
                        {p.clinic_patient_id}
                      </td>
                      <td className="td align-middle">
                        <div className="font-medium text-gray-900">{p.full_name}</div>
                      </td>
                      <td className="td whitespace-nowrap text-sm text-gray-600 align-middle">
                        {age !== null ? (age > 0 ? `${age} yrs` : '< 1 yr') : '—'}
                        {p.gender ? ` / ${p.gender}` : ''}
                      </td>
                      <td className="td align-middle">
                        {p.blood_group
                          ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">{p.blood_group}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="td align-middle" onClick={e => e.stopPropagation()}>
                        <TagInput
                          patientId={p.id}
                          currentTags={p.tags || []}
                          onTagsChange={(tags) => updateTags(p.id, tags)}
                        />
                      </td>
                      <td className="td align-middle">
                        <StatusBadge status={todayAppts[p.id]} />
                      </td>
                      <td className="td align-middle whitespace-nowrap">
                        <Link
                          to={`/patients/${p.id}`}
                          onClick={e => e.stopPropagation()}
                          className="text-blue-600 text-xs hover:underline"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
