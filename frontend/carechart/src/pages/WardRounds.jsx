import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Lock, LockOpen, Search, ChevronUp, ChevronDown,
  AlertTriangle, Droplets, Clock, Activity,
  Loader2, X, ShieldAlert,
} from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADMIN_ROLES = ['clinic_admin', 'clinic_manager', 'platform_admin']

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function losLabel(admittedAt) {
  if (!admittedAt) return '—'
  const days = Math.max(1, Math.floor((Date.now() - new Date(admittedAt)) / 86400000) + 1)
  return `Day ${days}`
}

function ageLabel(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob)) / 86400000 / 365.25) + 'Y'
}

function vitalsFreshness(recordedAt) {
  if (!recordedAt) return 'none'
  const h = (Date.now() - new Date(recordedAt)) / 3600000
  if (h < 4)  return 'fresh'
  if (h < 12) return 'stale'
  return 'overdue'
}

const FRESHNESS_COLOR = { fresh: 'text-emerald-500', stale: 'text-amber-500', overdue: 'text-red-500', none: 'text-gray-300' }

// ── PinModal ──────────────────────────────────────────────────────────────────

function PinModal({ admissionId, isAdmin, patientName, onUnlocked, onClose }) {
  const [pin, setPin]       = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const r0 = useRef(), r1 = useRef(), r2 = useRef(), r3 = useRef()
  const refs = [r0, r1, r2, r3]

  const changePin = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...pin]; next[i] = val; setPin(next)
    if (val && i < 3) refs[i + 1].current?.focus()
    else if (val && i === 3) { const full = [...pin]; full[3] = val; verify(full.join('')) }
  }

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) refs[i - 1].current?.focus()
  }

  const verify = async (pinStr) => {
    if (loading) return
    setLoading(true); setError('')
    try {
      const r = await api.post(`/inpatient/admissions/${admissionId}/verify-pin`, { pin: pinStr })
      if (r.data?.verified) {
        sessionStorage.setItem(`chart_unlocked_${admissionId}`, '1')
        onUnlocked()
      } else {
        setError('Incorrect PIN'); setPin(['', '', '', '']); setTimeout(() => refs[0].current?.focus(), 50)
      }
    } catch (e) {
      setError(e?.response?.data?.detail || 'Verification failed')
      setPin(['', '', '', '']); setTimeout(() => refs[0].current?.focus(), 50)
    } finally { setLoading(false) }
  }

  const adminOverride = async () => {
    if (loading) return
    setLoading(true); setError('')
    try {
      const r = await api.post(`/inpatient/admissions/${admissionId}/verify-pin`, { pin: '0000' })
      if (r.data?.verified) { sessionStorage.setItem(`chart_unlocked_${admissionId}`, '1'); onUnlocked() }
      else setError('Override failed')
    } catch (e) { setError(e?.response?.data?.detail || 'Override failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 mb-3">
            <Lock size={26} className="text-amber-600" />
          </div>
          <h2 className="font-bold text-gray-900 text-lg">Chart Locked</h2>
          <p className="text-gray-500 text-sm mt-1">
            <span className="font-medium">{patientName}</span>'s chart is protected.{' '}
            {isAdmin ? 'Use admin override or enter PIN.' : 'Enter the 4-digit PIN to access.'}
          </p>
        </div>
        <div className="flex justify-center gap-3 mb-4">
          {[0, 1, 2, 3].map(i => (
            <input
              key={i} ref={refs[i]}
              type="password" inputMode="numeric" maxLength={1}
              value={pin[i]}
              onChange={e => changePin(i, e.target.value)}
              onKeyDown={e => onKeyDown(i, e)}
              disabled={loading} autoFocus={i === 0}
              className="w-12 h-12 text-center text-xl font-bold border-2 rounded-xl focus:outline-none focus:border-emerald-600 border-gray-300 disabled:opacity-50"
            />
          ))}
        </div>
        {error && <p className="text-red-600 text-xs text-center mb-3">{error}</p>}
        {loading && <p className="text-emerald-600 text-sm text-center mb-3 animate-pulse">Verifying…</p>}
        {isAdmin && (
          <button onClick={adminOverride} disabled={loading}
            className="w-full py-2.5 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl text-sm font-semibold hover:bg-amber-100 transition-colors mb-3 disabled:opacity-50">
            Admin Override (bypass PIN)
          </button>
        )}
        <button onClick={onClose} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── SortTh ────────────────────────────────────────────────────────────────────

function SortTh({ col, label, sort, onSort, className = '' }) {
  const active = sort.col === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap ${active ? 'text-emerald-700' : 'hover:text-gray-700'} ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? (sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
          : <ChevronDown size={11} className="opacity-30" />
        }
      </span>
    </th>
  )
}

// ── Flags ─────────────────────────────────────────────────────────────────────

function Flags({ admission }) {
  const flags = []
  if (admission.allergies?.length) flags.push({ icon: Droplets, label: 'Allergy', color: 'text-red-600 bg-red-50' })
  const los = admission.admitted_at
    ? Math.floor((Date.now() - new Date(admission.admitted_at)) / 86400000) + 1
    : 0
  if (los >= 7) flags.push({ icon: Clock, label: `${los}d`, color: 'text-amber-700 bg-amber-50' })
  const vf = vitalsFreshness(admission.last_vitals?.recorded_at)
  if (vf === 'overdue') flags.push({ icon: Activity, label: 'V.Due', color: 'text-red-600 bg-red-50' })
  if (!flags.length) return <span className="text-gray-300 text-xs">—</span>
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {flags.map(({ icon: Icon, label, color }) => (
        <span key={label} className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded font-medium ${color}`}>
          <Icon size={10} />{label}
        </span>
      ))}
    </div>
  )
}

// ── WardRounds ────────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { key: 'all',           label: 'All Patients' },
  { key: 'vitals_overdue',label: 'Vitals Overdue' },
  { key: 'long_stay',     label: 'Long Stay (≥7d)' },
  { key: 'has_allergy',   label: 'Has Allergy' },
]

export default function WardRounds() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const isAdmin   = ADMIN_ROLES.includes(user?.role)

  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState('all')
  const [sort, setSort]             = useState({ col: 'admitted', dir: 'desc' })
  const [pinModal, setPinModal]     = useState(null) // { id, name }

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await api.get('/inpatient/admissions', { params: { status: 'active' } })
      setAdmissions(r.data || [])
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load admissions')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSort = (col) => {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  const handleRowClick = (a) => {
    if (a.is_locked && !sessionStorage.getItem(`chart_unlocked_${a.id}`)) {
      const name = a.patient?.full_name || a.patient_name || 'Patient'
      setPinModal({ id: a.id, name })
    } else {
      navigate(`/patient/${a.id}`)
    }
  }

  // ── Filter ──────────────────────────────────────────────────────────────────
  let rows = admissions.filter(a => {
    const name  = (a.patient?.full_name || a.patient_name || '').toLowerCase()
    const bed   = (a.bed_number || '').toLowerCase()
    const diag  = (a.primary_diagnosis || '').toLowerCase()
    const q     = search.toLowerCase()
    if (q && !name.includes(q) && !bed.includes(q) && !diag.includes(q)) return false
    if (filter === 'vitals_overdue') return vitalsFreshness(a.last_vitals?.recorded_at) === 'overdue'
    if (filter === 'long_stay') return Math.floor((Date.now() - new Date(a.admitted_at)) / 86400000) + 1 >= 7
    if (filter === 'has_allergy') return (a.allergies?.length || 0) > 0
    return true
  })

  // ── Sort ────────────────────────────────────────────────────────────────────
  rows = [...rows].sort((a, b) => {
    let av, bv
    const d = sort.dir === 'asc' ? 1 : -1
    switch (sort.col) {
      case 'bed':     av = a.bed_number || ''; bv = b.bed_number || ''; break
      case 'patient': av = a.patient?.full_name || a.patient_name || ''; bv = b.patient?.full_name || b.patient_name || ''; break
      case 'doctor':  av = a.admitting_doctor_name || ''; bv = b.admitting_doctor_name || ''; break
      case 'admitted':av = a.admitted_at || ''; bv = b.admitted_at || ''; break
      case 'discharge':av= a.expected_discharge || ''; bv = b.expected_discharge || ''; break
      case 'los': {
        const ad = a.admitted_at ? (Date.now() - new Date(a.admitted_at)) : 0
        const bd = b.admitted_at ? (Date.now() - new Date(b.admitted_at)) : 0
        return (ad - bd) * d
      }
      default: av = a.admitted_at || ''; bv = b.admitted_at || ''
    }
    return av < bv ? -d : av > bv ? d : 0
  })

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-base font-bold text-gray-900">Ward Census</h1>
            <p className="text-xs text-gray-500">{rows.length} active admission{rows.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={load} disabled={loading}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1 disabled:opacity-50">
            {loading ? <Loader2 size={13} className="animate-spin" /> : null}
            Refresh
          </button>
        </div>

        {/* Search + Filter row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search patient, bed, diagnosis…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {FILTER_OPTIONS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-emerald-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="flex items-center gap-2 p-4 text-red-600 text-sm">
            <AlertTriangle size={15} /> {error}
          </div>
        )}
        {loading && !admissions.length ? (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading admissions…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <ShieldAlert size={32} className="mb-2 opacity-40" />
            <p className="text-sm">No admissions match your filter</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 w-6" />
                <SortTh col="bed"      label="Bed"           sort={sort} onSort={handleSort} className="w-16" />
                <SortTh col="patient"  label="Patient"       sort={sort} onSort={handleSort} />
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-20">Age/Sex</th>
                <SortTh col="doctor"   label="Primary Dr."   sort={sort} onSort={handleSort} />
                <SortTh col="admitted" label="Admitted"      sort={sort} onSort={handleSort} />
                <SortTh col="discharge"label="Est. Discharge"sort={sort} onSort={handleSort} />
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Diagnosis</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Last Vitals</th>
                <SortTh col="los"      label="LOS"           sort={sort} onSort={handleSort} className="w-16" />
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(a => {
                const locked     = a.is_locked && !sessionStorage.getItem(`chart_unlocked_${a.id}`)
                const pat        = a.patient || {}
                const name       = pat.full_name || a.patient_name || '—'
                const age        = pat.date_of_birth ? ageLabel(pat.date_of_birth) : (pat.age ? `${pat.age}Y` : null)
                const sex        = (pat.gender || '').toUpperCase().slice(0, 1) || '?'
                const doctor     = a.admitting_doctor_name || '—'
                const lv         = a.last_vitals
                const freshColor = FRESHNESS_COLOR[vitalsFreshness(lv?.recorded_at)]

                return (
                  <tr
                    key={a.id}
                    onClick={() => handleRowClick(a)}
                    className="cursor-pointer hover:bg-emerald-50 transition-colors group"
                  >
                    {/* Lock icon */}
                    <td className="px-2 py-3 text-center">
                      {a.is_locked
                        ? <Lock size={13} className="text-amber-500 mx-auto" />
                        : <LockOpen size={13} className="text-gray-200 mx-auto group-hover:text-gray-300" />
                      }
                    </td>
                    {/* Bed */}
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-gray-700">
                      {a.bed_number || '—'}
                    </td>
                    {/* Patient */}
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900">{name}</div>
                      <div className="text-xs text-gray-400 font-mono">{a.admission_number || `#${a.id}`}</div>
                    </td>
                    {/* Age/Sex */}
                    <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {age ? `${age} / ${sex}` : sex}
                    </td>
                    {/* Doctor */}
                    <td className="px-3 py-3 text-gray-600 text-xs">
                      {doctor !== '—' ? `Dr. ${doctor}` : '—'}
                    </td>
                    {/* Admitted */}
                    <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {fmtDate(a.admitted_at)}
                    </td>
                    {/* Est. Discharge */}
                    <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {fmtDate(a.expected_discharge)}
                    </td>
                    {/* Diagnosis */}
                    <td className="px-3 py-3 text-gray-600 text-xs max-w-[180px]">
                      {locked
                        ? <span className="tracking-widest text-gray-300">••••••</span>
                        : <span className="truncate block" title={a.primary_diagnosis}>{a.primary_diagnosis || '—'}</span>
                      }
                    </td>
                    {/* Last Vitals */}
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      {locked
                        ? <span className="tracking-widest text-gray-300">••••</span>
                        : lv
                          ? <span className={freshColor}>
                              {lv.bp_systolic ? `${lv.bp_systolic}/${lv.bp_diastolic}` : ''}
                              {lv.pulse ? ` · P:${lv.pulse}` : ''}
                              {lv.spo2  ? ` · SpO₂:${lv.spo2}%` : ''}
                            </span>
                          : <span className="text-gray-300">No vitals</span>
                      }
                    </td>
                    {/* LOS */}
                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {losLabel(a.admitted_at)}
                    </td>
                    {/* Flags */}
                    <td className="px-3 py-3">
                      {locked
                        ? <span className="tracking-widest text-gray-300">••</span>
                        : <Flags admission={a} />
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* PIN Modal */}
      {pinModal && (
        <PinModal
          admissionId={pinModal.id}
          isAdmin={isAdmin}
          patientName={pinModal.name}
          onUnlocked={() => { setPinModal(null); navigate(`/patient/${pinModal.id}`) }}
          onClose={() => setPinModal(null)}
        />
      )}
    </div>
  )
}
