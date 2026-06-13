import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { cachedFetch, cacheSet } from '../utils/cache'
import {
  Calendar, Stethoscope, Clock, Video, MapPin, Plus,
  Building2, Globe, CheckCircle, AlertTriangle, X,
  ExternalLink, ChevronRight, RefreshCw
} from 'lucide-react'

const STATUS_BADGE = {
  pending: 'badge-yellow', confirmed: 'badge-blue', completed: 'badge-green',
  cancelled: 'badge-gray', in_progress: 'badge-blue',
}

const TABS = ['All', 'Upcoming', 'Completed', 'Cancelled']

function hoursUntil(dateStr, timeStr) {
  if (!dateStr) return null
  try {
    const dt = new Date(`${dateStr}T${timeStr || '00:00'}`)
    return (dt - Date.now()) / 3_600_000
  } catch {
    return null
  }
}

function modeLabel(mode) {
  if (mode === 'telehealth') return 'Telehealth (Video)'
  if (mode === 'online') return 'Online'
  return 'In-Person'
}

// ── Appointment detail drawer ─────────────────────────────────────────────
function ApptDrawer({ a, onClose, onRefresh }) {
  const navigate = useNavigate()
  const [rescheduling, setRescheduling] = useState(false)
  const [newDate, setNewDate] = useState(a.date || '')
  const [newTime, setNewTime] = useState(a.time || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const bookingId = a.id?.toString().startsWith('ob-') ? parseInt(a.id.slice(3)) : null
  const isOnline = a.source === 'online_booking'
  const hours = hoursUntil(a.date, a.time)
  const canCancel = !['completed', 'cancelled'].includes(a.status)
  const canReschedule = isOnline && ['pending', 'confirmed'].includes(a.status)

  const cancelLabel = () => {
    if (isOnline && a.status === 'pending') return { label: 'Cancel Request', color: '#6B7280', warn: null }
    if (hours !== null && hours > 6) return { label: 'Cancel — Full Refund', color: '#16a34a', warn: null }
    if (hours !== null && hours <= 6) return {
      label: 'Cancel — No Refund', color: '#CC1414',
      warn: 'Cancellations within 6 hours of appointment are not eligible for a refund.'
    }
    return { label: 'Cancel Appointment', color: '#CC1414', warn: null }
  }

  const doCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return
    setBusy(true); setMsg('')
    try {
      if (isOnline && bookingId) {
        await api.post(`/portal/bookings/${bookingId}/cancel`)
      } else {
        await api.post(`/portal/appointments/${a.id}/cancel`)
      }
      setMsg('Appointment cancelled.')
      onRefresh()
      setTimeout(onClose, 1200)
    } catch (e) {
      setMsg(e.message || 'Could not cancel.')
    } finally {
      setBusy(false)
    }
  }

  const doReschedule = async () => {
    if (!bookingId) return
    setBusy(true); setMsg('')
    try {
      await api.put(`/portal/bookings/${bookingId}/reschedule`, {
        booking_date: newDate,
        booking_time: newTime,
      })
      setMsg('Appointment rescheduled.')
      onRefresh()
      setRescheduling(false)
    } catch (e) {
      setMsg(e.message || 'Could not reschedule.')
    } finally {
      setBusy(false)
    }
  }

  const cl = cancelLabel()

  const fmtDate = (d) => {
    if (!d) return '—'
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    } catch { return d }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center z-50 p-0 sm:p-4">
        <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl overflow-y-auto max-h-[92vh] sm:max-h-[85vh] rounded-t-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10 rounded-t-2xl">
            <div>
              <div className="font-bold text-base" style={{ color: '#0F2557' }}>
                {/^dr\.?\s/i.test(a.doctor_name || '') ? a.doctor_name : `Dr. ${a.doctor_name || 'Doctor'}`}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {a.clinic_name}
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Status */}
            <div className="flex items-center gap-3">
              <span className={`${STATUS_BADGE[a.status] || 'badge-gray'} capitalize text-sm`}>
                {a.status?.replace('_', ' ')}
              </span>
              {a.source === 'online_booking' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#0F255710', color: '#0F2557' }}>
                  <Globe size={10} /> Booked Online
                </span>
              )}
            </div>

            {/* Booking summary */}
            <div className="rounded-xl p-4 space-y-2.5" style={{ background: '#EEF2FF' }}>
              {[
                ['Date', fmtDate(a.date)],
                ['Time', a.time || '—'],
                ['Mode', modeLabel(a.mode)],
                ...(a.token_number ? [['Token', `#${a.token_number}`]] : []),
                ...(a.confirmation_code ? [['Confirmation Code', a.confirmation_code]] : []),
                ...(a.patient_name ? [['Patient', a.patient_name]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-semibold text-gray-900 font-mono text-right">{v}</span>
                </div>
              ))}
            </div>

            {/* Pending notice */}
            {a.source === 'online_booking' && a.status === 'pending' && (
              <div className="flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <AlertTriangle size={14} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                Awaiting confirmation from health center
              </div>
            )}

            {/* Location */}
            {a.clinic_address && a.mode !== 'telehealth' && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Location</div>
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div>{a.clinic_address}</div>
                    {a.clinic_city && <div className="text-gray-500 text-xs">{a.clinic_city}</div>}
                  </div>
                </div>
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent([a.clinic_address, a.clinic_city, 'India'].filter(Boolean).join(', '))}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                >
                  <ExternalLink size={11} /> Get Directions →
                </a>
              </div>
            )}

            {/* Reason */}
            {a.reason && (
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Reason for Visit</div>
                <p className="text-sm text-gray-600 italic">"{a.reason}"</p>
              </div>
            )}

            {/* Reschedule section */}
            {canReschedule && (
              <div>
                {!rescheduling ? (
                  <button
                    onClick={() => setRescheduling(true)}
                    className="w-full py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors"
                    style={{ borderColor: '#0F2557', color: '#0F2557' }}
                  >
                    <RefreshCw size={14} className="inline mr-2" />
                    Change Slot
                  </button>
                ) : (
                  <div className="border-2 border-blue-200 rounded-xl p-4 space-y-3" style={{ background: '#EEF2FF' }}>
                    <div className="text-sm font-semibold" style={{ color: '#0F2557' }}>Select New Date & Time</div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Date</label>
                      <input
                        type="date"
                        value={newDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setNewDate(e.target.value)}
                        className="input"
                        style={{ colorScheme: 'light' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Time (e.g. 10:30 AM)</label>
                      <input
                        type="time"
                        value={newTime}
                        onChange={e => setNewTime(e.target.value)}
                        className="input"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRescheduling(false)}
                        className="flex-1 py-2 rounded-xl border text-sm font-medium text-gray-500"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={doReschedule}
                        disabled={busy || !newDate}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                        style={{ background: '#0F2557' }}
                      >
                        {busy ? 'Saving…' : 'Confirm Change'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cancel */}
            {canCancel && (
              <div>
                {cl.warn && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 mb-2">
                    ⚠ {cl.warn}
                  </div>
                )}
                <button
                  onClick={doCancel}
                  disabled={busy}
                  className="w-full py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors disabled:opacity-50"
                  style={{ borderColor: cl.color, color: cl.color }}
                >
                  {busy ? 'Processing…' : cl.label}
                </button>
              </div>
            )}

            {/* View doctor profile */}
            {a.doctor_profile_id && (
              <button
                onClick={() => { navigate(`/doctors/${a.doctor_profile_id}`); onClose() }}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <Stethoscope size={14} /> View Doctor Profile <ChevronRight size={14} />
              </button>
            )}

            {/* Telehealth join */}
            {a.mode === 'telehealth' && ['confirmed', 'in_progress', 'pending'].includes(a.status) && (
              <TelehealthJoin a={a} />
            )}

            {/* Feedback message */}
            {msg && (
              <div className={`text-sm text-center font-medium py-2 rounded-xl ${msg.includes('cancel') || msg.includes('Could') ? 'text-red-600 bg-red-50' : 'text-green-700 bg-green-50'}`}>
                {msg}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function TelehealthJoin({ a }) {
  const navigate = useNavigate()
  const [joining, setJoining] = useState(false)

  const join = async () => {
    setJoining(true)
    try {
      const data = await api.post(`/portal/appointments/${a.id}/join`)
      navigate(`/telehealth/call/${a.id}`, { state: { joinData: data, appt: a } })
    } catch (e) {
      alert(e.message || 'Cannot join yet. Please wait for your appointment time.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <button onClick={join} disabled={joining}
      className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
      style={{ background: '#CC1414' }}>
      <Video size={14} /> {joining ? 'Joining…' : 'Join Consultation'}
    </button>
  )
}

function ApptCard({ a, onClick }) {
  const isTelehealth = a.mode === 'telehealth'
  const isOnlineBooking = a.source === 'online_booking'

  return (
    <button
      onClick={() => onClick(a)}
      className="w-full card p-4 flex items-start gap-4 hover:shadow-md hover:border-blue-200 border-2 border-transparent transition-all text-left"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: isTelehealth ? '#0F255712' : '#EEF2FF' }}>
        {isTelehealth
          ? <Video size={20} style={{ color: '#0F2557' }} />
          : <Stethoscope size={20} style={{ color: '#0F2557' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold text-gray-900 text-sm truncate">{a.clinic_name || 'Health Center'}</div>
          <span className={`${STATUS_BADGE[a.status] || 'badge-gray'} flex-shrink-0 capitalize`}>
            {a.status?.replace('_', ' ')}
          </span>
        </div>
        <div className="text-sm text-gray-500 mt-0.5">
          {/^dr\.?\s/i.test(a.doctor_name || '') ? a.doctor_name : `Dr. ${a.doctor_name || 'Doctor'}`}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {a.date && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar size={11} />
              {new Date(a.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
          {a.time && <span className="flex items-center gap-1 text-xs text-gray-400"><Clock size={11} /> {a.time}</span>}
          {a.token_number && (
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full" style={{ background: '#EEF2FF', color: '#0F2557' }}>
              Token #{a.token_number}
            </span>
          )}
          {a.confirmation_code && (
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF3E7', color: '#F5821E' }}>
              {a.confirmation_code}
            </span>
          )}
          {isOnlineBooking && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#0F255710', color: '#0F2557' }}>
              <Globe size={10} /> Booked Online
            </span>
          )}
          {isTelehealth && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: '#0F2557' }}>
              <Video size={10} /> Virtual
            </span>
          )}
        </div>
        {isOnlineBooking && a.status === 'pending' && (
          <div className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
            <AlertTriangle size={11} className="text-yellow-500" />
            Awaiting confirmation from the health center
          </div>
        )}
        {a.reason && <div className="text-xs text-gray-400 mt-1 italic">"{a.reason}"</div>}
        {a.status === 'completed' && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
            <CheckCircle size={11} /> Visit completed
          </div>
        )}
      </div>
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-1" />
    </button>
  )
}

export default function Appointments() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [appts, setAppts] = useState([])
  const [prevStatuses, setPrevStatuses] = useState({})
  const [newlyConfirmed, setNewlyConfirmed] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('All')
  const [selectedAppt, setSelectedAppt] = useState(null)

  const loadAppts = (cached = true) => {
    const fetcher = () => api.get('/portal/appointments')
    const handler = r => {
      const list = r?.appointments || (Array.isArray(r) ? r : [])
      setAppts(list)
      setLoading(false)
      // Detect status changes → newly confirmed
      setPrevStatuses(prev => {
        const confirmed = list.filter(a =>
          a.status === 'confirmed' && prev[a.id] === 'pending'
        )
        if (confirmed.length) setNewlyConfirmed(confirmed.map(a => a.id))
        const next = {}
        list.forEach(a => { next[a.id] = a.status })
        return next
      })
    }
    if (cached) {
      cachedFetch('appointments', fetcher, handler).catch(() => setLoading(false))
    } else {
      fetcher().then(handler).catch(() => setLoading(false))
    }
  }

  useEffect(() => {
    if (searchParams.get('book') || searchParams.get('doctor_id')) {
      navigate('/appointments/book', { replace: true })
    }
    loadAppts()
    // Poll every 60s to catch status changes
    const t = setInterval(() => loadAppts(false), 60_000)
    return () => clearInterval(t)
  }, []) // eslint-disable-line

  const filtered = appts.filter(a => {
    if (tab === 'Upcoming') return ['pending', 'confirmed'].includes(a.status)
    if (tab === 'Completed') return a.status === 'completed'
    if (tab === 'Cancelled') return a.status === 'cancelled'
    return true
  })

  return (
    <div className="space-y-5">
      {/* Newly confirmed notifications */}
      {newlyConfirmed.length > 0 && (
        <div className="rounded-2xl p-4 flex items-start gap-3 border border-green-200" style={{ background: '#f0fdf4' }}>
          <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">Appointment Confirmed!</p>
            <p className="text-xs text-green-600 mt-0.5">
              {newlyConfirmed.length === 1
                ? 'Your appointment has been confirmed by the health center.'
                : `${newlyConfirmed.length} appointments have been confirmed.`}
            </p>
          </div>
          <button onClick={() => setNewlyConfirmed([])} className="text-green-400 hover:text-green-600 text-xs">✕</button>
        </div>
      )}

      {/* Action bar — hidden when there's nothing to filter; empty state owns the Book button */}
      {!(!loading && appts.length === 0) && (
      <div className="flex items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex bg-white rounded-xl border border-gray-200 p-1 gap-0.5 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0"
              style={tab === t
                ? { background: '#0F2557', color: 'white' }
                : { color: '#6b7280' }}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => navigate('/appointments/book')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
          style={{ background: '#CC1414' }}>
          <Plus size={15} /> Book Appointment
        </button>
      </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="card p-10 text-center">
          <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: '#c7d2e5', borderTopColor: '#0F2557' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">
            {tab === 'All' ? 'No appointments yet' : `No ${tab.toLowerCase()} appointments`}
          </p>
          {tab === 'All' && (
            <>
              <p className="text-sm mt-1 mb-5">Book your first appointment with a verified doctor.</p>
              <button onClick={() => navigate('/appointments/book')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#CC1414' }}>
                <Plus size={15} /> Book Appointment
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => <ApptCard key={a.id} a={a} onClick={setSelectedAppt} />)}
        </div>
      )}

      {/* Detail drawer */}
      {selectedAppt && (
        <ApptDrawer
          a={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onRefresh={() => loadAppts(false)}
        />
      )}
    </div>
  )
}
