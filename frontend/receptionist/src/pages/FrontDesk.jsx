import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search, X, Check, Loader2, Clock, Calendar, AlertTriangle,
  ChevronRight, UserPlus, CalendarPlus, Pin, PinOff, Pencil, CalendarRange,
  Footprints, Phone, Globe, Video, RefreshCw, ShieldAlert,
} from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import RegisterPatientModal from '../components/frontdesk/RegisterPatientModal'
import BookAppointmentModal from '../components/frontdesk/BookAppointmentModal'
import EditAppointmentModal from '../components/frontdesk/EditAppointmentModal'
import CancelAppointmentModal from '../components/frontdesk/CancelAppointmentModal'
import PatientLookupPopup from '../components/frontdesk/PatientLookupPopup'

// ── helpers ────────────────────────────────────────────────────────────────────

function todayIST() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10)
}

function fmtAge(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) + 'y'
}

// ── constants ──────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  scheduled:   'bg-blue-100 text-blue-700',
  waiting:     'bg-amber-100 text-amber-700',
  in_progress: 'bg-violet-100 text-violet-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-gray-100 text-gray-500',
  no_show:     'bg-red-100 text-red-600',
}
const STATUS_LABELS = {
  scheduled: 'Scheduled', waiting: 'Waiting', in_progress: 'In Consultation',
  completed: 'Completed', cancelled: 'Cancelled', no_show: 'No Show',
}
const STATUS_LEFT_BORDER = {
  waiting:     '#F59E0B',
  in_progress: '#7C3AED',
  scheduled:   '#3B82F6',
  completed:   '#16A34A',
  no_show:     '#EF4444',
  cancelled:   '#D1D5DB',
}
const STATUS_ORDER = { waiting: 0, in_progress: 1, scheduled: 2, completed: 3, no_show: 4, cancelled: 5 }

const VISIT_LABELS = { fresh: 'Fresh', followup: 'Follow-up', emergency: 'Emergency' }

const MODE_BADGE = {
  offline: { icon: Footprints, label: 'Walk-in',  cls: 'bg-gray-100 text-gray-600' },
  phone:   { icon: Phone,      label: 'Phone',    cls: 'bg-sky-100 text-sky-700' },
  online:  { icon: Globe,      label: 'Online',   cls: 'bg-emerald-100 text-emerald-700' },
  // legacy values
  onsite:    { icon: Footprints, label: 'Walk-in',  cls: 'bg-gray-100 text-gray-600' },
  telehealth:{ icon: Video,      label: 'Telehealth', cls: 'bg-cyan-100 text-cyan-700' },
}

const PINS_KEY = () => `recep_pinned_doctors_${localStorage.getItem('clinic_id') || 'c'}`

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ msg, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed bottom-5 right-5 z-[90] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
      ${type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
      {type === 'success' ? <Check size={15} className="text-green-600" /> : <AlertTriangle size={15} className="text-red-600" />}
      {msg}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function FrontDesk() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const isHospital = user?.org_type === 'hospital'

  // ── data ───────────────────────────────────────────────────────────────────
  const [appts, setAppts] = useState([])
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)

  // ── date mode ──────────────────────────────────────────────────────────────
  const [dateMode, setDateMode] = useState('today') // 'today' | 'range'
  const [rangeFrom, setRangeFrom] = useState(todayIST)
  const [rangeTo, setRangeTo] = useState(todayIST)

  // ── filters ────────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '')
  const [filterSearch, setFilterSearch] = useState('')
  const [pinnedDoctors, setPinnedDoctors] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PINS_KEY()) || '[]') } catch { return [] }
  })
  const [filterDoctor, setFilterDoctor] = useState('')

  // ── modals ─────────────────────────────────────────────────────────────────
  const [showLookup, setShowLookup] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [showBook, setShowBook] = useState(false)
  const [bookPatient, setBookPatient] = useState(null)   // preselected patient for booking modal
  const [editAppt, setEditAppt] = useState(null)
  const [cancelAppt, setCancelAppt] = useState(null)

  const todayStr = todayIST()
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  // ── doctors ────────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/clinic/doctors').then(r => setDoctors(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  // ── load queue ─────────────────────────────────────────────────────────────
  const loadQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    setError('')
    try {
      const params = { limit: 300 }
      if (dateMode === 'today') {
        params.appointment_date = todayStr
      } else {
        if (rangeFrom) params.date_from = rangeFrom
        if (rangeTo)   params.date_to   = rangeTo
      }
      if (filterDoctor) params.doctor_name = filterDoctor
      const data = await api.get('/appointments', { params })
      setAppts(Array.isArray(data) ? data : [])
    } catch (ex) { setError(ex.message || 'Failed to load') }
    finally { setLoading(false); setRefreshing(false) }
  }, [dateMode, todayStr, rangeFrom, rangeTo, filterDoctor])

  useEffect(() => {
    loadQueue()
    if (dateMode !== 'today') return
    const id = setInterval(() => loadQueue(true), 60000)
    return () => clearInterval(id)
  }, [loadQueue, dateMode])

  // ── pin helpers ────────────────────────────────────────────────────────────
  const togglePin = (doctorName) => {
    setPinnedDoctors(prev => {
      const next = prev.includes(doctorName)
        ? prev.filter(d => d !== doctorName)
        : [...prev, doctorName]
      try { localStorage.setItem(PINS_KEY(), JSON.stringify(next)) } catch {}
      return next
    })
  }

  // ── status counts ──────────────────────────────────────────────────────────
  const counts = {
    all: appts.length,
    scheduled:   appts.filter(a => a.status === 'scheduled').length,
    waiting:     appts.filter(a => a.status === 'waiting').length,
    in_progress: appts.filter(a => a.status === 'in_progress').length,
    completed:   appts.filter(a => a.status === 'completed').length,
    cancelled:   appts.filter(a => a.status === 'cancelled').length,
  }

  // ── visible list ───────────────────────────────────────────────────────────
  const allDoctorNames = [...new Set(appts.map(a => a.doctor_name).filter(Boolean))].sort()

  const visible = appts.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false
    if (filterDoctor && a.doctor_name !== filterDoctor) return false
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      if (!a.patient_name?.toLowerCase().includes(q) && !a.bh_id?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const sorted = [...visible].sort((a, b) => {
    const ao = STATUS_ORDER[a.status] ?? 9, bo = STATUS_ORDER[b.status] ?? 9
    return ao !== bo ? ao - bo : (a.appointment_time || '').localeCompare(b.appointment_time || '')
  })

  // ── quick status update ────────────────────────────────────────────────────
  const updateStatus = useCallback(async (apptId, status) => {
    try {
      await api.put(`/appointments/${apptId}`, { status })
      setAppts(prev => prev.map(a => a.id === apptId ? { ...a, status } : a))
      showToast(`Status → ${STATUS_LABELS[status] || status}`)
    } catch (ex) { showToast(ex.message || 'Update failed', 'error') }
  }, [])

  const handleCancelled = (apptId) => {
    setAppts(prev => prev.map(a => a.id === apptId ? { ...a, status: 'cancelled' } : a))
    showToast('Appointment cancelled')
  }

  const handleSaved = (updated) => {
    setAppts(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
    showToast('Appointment updated')
  }

  // ── stat pill def ──────────────────────────────────────────────────────────
  const statPills = [
    { key: '',           label: 'All',              count: counts.all,         color: '#6B7280', bg: '#F3F4F6' },
    { key: 'scheduled',  label: 'Scheduled',        count: counts.scheduled,   color: '#3B82F6', bg: '#EFF6FF' },
    { key: 'waiting',    label: 'Waiting',          count: counts.waiting,     color: '#D97706', bg: '#FFFBEB' },
    { key: 'in_progress',label: 'In Consultation',  count: counts.in_progress, color: '#7C3AED', bg: '#F5F3FF' },
    { key: 'completed',  label: 'Completed',        count: counts.completed,   color: '#16A34A', bg: '#F0FDF4' },
    { key: 'cancelled',  label: 'Cancelled',        count: counts.cancelled,   color: '#9CA3AF', bg: '#F9FAFB' },
  ]

  return (
    <div className="space-y-4">

      {/* ── Top Bar: Title + Action Buttons ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Front Desk</h1>
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
            <Clock size={12} />
            {dateMode === 'today' ? <span>{todayStr} · live</span> : <span>{rangeFrom} — {rangeTo}</span>}
            {refreshing && <Loader2 size={12} className="animate-spin text-blue-400" />}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Patient Lookup */}
          <button onClick={() => setShowLookup(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
            <Search size={14} /> Patient Lookup
          </button>

          {/* Register Patient */}
          <button onClick={() => setShowRegister(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
            <UserPlus size={14} /> Register Patient
          </button>

          {/* Book Appointment */}
          <button onClick={() => { setBookPatient(null); setShowBook(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
            <CalendarPlus size={14} /> Book Appointment
          </button>

          {/* Emergency — hospital only */}
          {isHospital && (
            <button onClick={() => navigate('/emergency-admission')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 font-bold shadow-sm shadow-red-200">
              <ShieldAlert size={14} /> Emergency
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Row: date-mode toggle + range pickers + stat pills + refresh ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date mode toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium flex-shrink-0">
          <button
            onClick={() => setDateMode('today')}
            className={`px-3 py-1.5 flex items-center gap-1 transition ${dateMode === 'today' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            <Clock size={12} /> Today
          </button>
          <button
            onClick={() => setDateMode('range')}
            className={`px-3 py-1.5 flex items-center gap-1 transition ${dateMode === 'range' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            <CalendarRange size={12} /> Range
          </button>
        </div>

        {/* Date range pickers (inline, only when range mode) */}
        {dateMode === 'range' && (
          <>
            <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-100 flex-shrink-0" />
            <span className="text-xs text-gray-400">—</span>
            <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-100 flex-shrink-0" />
          </>
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 hidden sm:block flex-shrink-0" />

        {/* Stat pills (status filter) */}
        {statPills.map(p => {
          const active = filterStatus === p.key
          return (
            <button
              key={p.key}
              onClick={() => setFilterStatus(p.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border flex-shrink-0 ${
                active ? 'border-transparent shadow-sm' : 'border-gray-100 bg-white hover:shadow-sm'
              }`}
              style={active ? { background: p.bg, color: p.color, borderColor: p.color + '33' } : {}}
            >
              <span style={{ color: active ? p.color : '#9CA3AF' }} className="text-base font-extrabold leading-none">{p.count}</span>
              <span style={{ color: active ? p.color : '#6B7280' }}>{p.label}</span>
            </button>
          )
        })}

      </div>

      {/* ── Pinned Doctor Quick-filters ── */}
      {(pinnedDoctors.length > 0 || allDoctorNames.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium">Doctors:</span>
          {allDoctorNames.map(name => {
            const pinned = pinnedDoctors.includes(name)
            const active = filterDoctor === name
            return (
              <div key={name} className={`flex items-center gap-0.5 rounded-lg border overflow-hidden transition ${active ? 'border-blue-400' : 'border-gray-200'}`}>
                <button
                  onClick={() => setFilterDoctor(active ? '' : name)}
                  className={`px-2.5 py-1 text-xs font-medium transition ${active ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {name}
                </button>
                <button
                  onClick={() => togglePin(name)}
                  title={pinned ? 'Unpin' : 'Pin doctor filter'}
                  className={`px-1.5 py-1 transition ${active ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-400 hover:text-blue-500'}`}
                >
                  {pinned ? <PinOff size={10} /> : <Pin size={10} />}
                </button>
              </div>
            )
          })}
          {filterDoctor && (
            <button onClick={() => setFilterDoctor('')} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
              <X size={10} /> clear
            </button>
          )}
        </div>
      )}

      {/* ── Worklist ── */}
      <section className="card overflow-hidden">
        {/* Table header bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <span className="font-bold text-sm mr-auto" style={{ color: '#0F2557' }}>
            Appointments
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">{sorted.length}</span>
          </span>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search patient…"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className="input pl-8 w-44 text-sm py-1.5"
            />
            {filterSearch && (
              <button onClick={() => setFilterSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-300" /></div>
        ) : error ? (
          <div className="p-10 text-center">
            <AlertTriangle size={28} className="mx-auto mb-3 text-red-400" />
            <p className="text-red-600 text-sm mb-3">{error}</p>
            <button onClick={() => loadQueue()} className="btn-secondary text-sm"><RefreshCw size={14} />Retry</button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-14 text-center">
            <Calendar size={28} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 font-medium mb-1">
              {filterStatus || filterSearch || filterDoctor ? 'No appointments match filters' : 'No appointments'}
            </p>
            <p className="text-xs text-gray-300">Booked appointments will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="th w-14">#</th>
                  <th className="th">Patient</th>
                  <th className="th">Age/Sex</th>
                  <th className="th">Visit</th>
                  <th className="th">Mode</th>
                  <th className="th">Doctor</th>
                  <th className="th">Time</th>
                  <th className="th">Status</th>
                  <th className="th">Quick Action</th>
                  <th className="th w-20">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map(a => {
                  const age = a.age != null ? a.age + 'y' : fmtAge(a.date_of_birth)
                  const modeDef = MODE_BADGE[a.mode] || MODE_BADGE.offline
                  const ModeIcon = modeDef.icon
                  return (
                    <tr
                      key={a.id}
                      className="tr-hover cursor-pointer"
                      style={{
                        boxShadow: `inset 3px 0 0 ${STATUS_LEFT_BORDER[a.status] || '#E5E7EB'}`,
                      }}
                      onClick={() => navigate(`/front-desk/chart/${a.id}`, { state: { appt: a } })}
                    >
                      {/* Token */}
                      <td className="td" onClick={e => e.stopPropagation()}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-indigo-50 text-indigo-700">
                          {a.token_number ?? a.id}
                        </div>
                      </td>

                      {/* Patient */}
                      <td className="td">
                        <div className="font-semibold text-sm text-gray-900">{a.patient_name}</div>
                        {(a.bh_id || a.clinic_patient_id) && (
                          <div className="text-xs font-mono text-blue-500 mt-0.5">{a.bh_id || a.clinic_patient_id}</div>
                        )}
                      </td>

                      {/* Age / Sex */}
                      <td className="td text-sm text-gray-500">
                        {age && <span>{age}</span>}
                        {a.gender && <span className="ml-1 text-xs uppercase text-gray-400">{a.gender.charAt(0)}</span>}
                      </td>

                      {/* Visit type */}
                      <td className="td text-xs text-gray-600">
                        {VISIT_LABELS[a.visit_type] || a.visit_type || '—'}
                      </td>

                      {/* Mode */}
                      <td className="td">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${modeDef.cls}`}>
                          <ModeIcon size={10} />{modeDef.label}
                        </span>
                      </td>

                      {/* Doctor */}
                      <td className="td text-sm text-gray-600 max-w-[140px] truncate">{a.doctor_name || '—'}</td>

                      {/* Time */}
                      <td className="td text-sm text-gray-500 whitespace-nowrap">
                        <div className="flex items-center gap-1"><Clock size={11} className="text-gray-300" />{a.appointment_time || '—'}</div>
                        {dateMode === 'range' && a.appointment_date && (
                          <div className="text-xs text-gray-400">{a.appointment_date}</div>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="td">
                        <span className={`badge text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABELS[a.status] || a.status}
                        </span>
                      </td>

                      {/* Quick action */}
                      <td className="td" onClick={e => e.stopPropagation()}>
                        {a.status === 'scheduled' && (
                          <button onClick={() => updateStatus(a.id, 'waiting')} className="btn-secondary text-xs py-1 px-2.5">
                            <Check size={11} /> Check In
                          </button>
                        )}
                        {a.status === 'waiting' && (
                          <button onClick={() => updateStatus(a.id, 'in_progress')} className="btn-primary text-xs py-1 px-2.5">
                            Start
                          </button>
                        )}
                        {a.status === 'in_progress' && (
                          <button onClick={() => updateStatus(a.id, 'completed')} className="btn-success text-xs py-1 px-2.5">
                            Complete
                          </button>
                        )}
                        {a.status === 'completed' && (
                          <span className="text-xs text-green-600 font-medium flex items-center gap-1"><Check size={11} />Done</span>
                        )}
                      </td>

                      {/* Edit / Cancel */}
                      <td className="td" onClick={e => e.stopPropagation()}>
                        {a.status !== 'cancelled' && a.status !== 'completed' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditAppt(a)}
                              title="Edit"
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setCancelAppt(a)}
                              title="Cancel appointment"
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        )}
                        <ChevronRight size={14} className="text-gray-200 ml-1" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Modals ── */}

      <PatientLookupPopup
        open={showLookup}
        onClose={() => setShowLookup(false)}
        onBookFor={(patient) => { setBookPatient(patient); setShowBook(true); setShowLookup(false) }}
      />

      <RegisterPatientModal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        doctors={doctors}
        onRegistered={(p) => {
          showToast(`${p.full_name} registered`)
          loadQueue(true)
        }}
        onBookFor={(patient) => {
          setShowRegister(false)
          setBookPatient(patient)
          setShowBook(true)
        }}
      />

      <BookAppointmentModal
        open={showBook}
        onClose={() => { setShowBook(false); setBookPatient(null) }}
        doctors={doctors}
        preselectedPatient={bookPatient}
        onBooked={() => {
          showToast('Appointment booked')
          setShowBook(false)
          setBookPatient(null)
          loadQueue(true)
        }}
      />

      <EditAppointmentModal
        open={!!editAppt}
        appointment={editAppt}
        doctors={doctors}
        onClose={() => setEditAppt(null)}
        onSaved={handleSaved}
      />

      <CancelAppointmentModal
        open={!!cancelAppt}
        appointment={cancelAppt}
        onClose={() => setCancelAppt(null)}
        onCancelled={handleCancelled}
      />

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
