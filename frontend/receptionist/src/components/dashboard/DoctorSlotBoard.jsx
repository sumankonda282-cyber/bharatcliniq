import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Stethoscope, Search, X, Check, Loader2, ChevronDown, ChevronRight,
  Pin, PinOff, Lock, Unlock, CalendarDays, Clock, Bell, AlertTriangle,
  Pencil, CalendarPlus, Ban, UserCircle2, Phone,
} from 'lucide-react'
import api from '../../api/client'
import EditAppointmentModal from '../frontdesk/EditAppointmentModal'
import CancelAppointmentModal from '../frontdesk/CancelAppointmentModal'

// ── helpers ────────────────────────────────────────────────────────────────────

const istNow = () => new Date(Date.now() + 5.5 * 3600000)
const istToday = () => istNow().toISOString().slice(0, 10)
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const fmtDay = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const initials = (name) => (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

const LIVE = {
  busy:      { dot: 'bg-violet-500', label: 'In Consultation', text: 'text-violet-700' },
  waiting:   { dot: 'bg-amber-400',  label: 'Patients Waiting', text: 'text-amber-700' },
  available: { dot: 'bg-green-400',  label: 'Available',        text: 'text-green-700' },
  done:      { dot: 'bg-gray-300',   label: 'Done for Today',   text: 'text-gray-500'  },
}

const APPT_STATUS_CLS = {
  scheduled: 'bg-blue-100 text-blue-700', confirmed: 'bg-blue-100 text-blue-700',
  pending: 'bg-blue-100 text-blue-700', waiting: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-violet-100 text-violet-700', completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500', no_show: 'bg-red-100 text-red-600',
}

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

// ── Slot meter bar ─────────────────────────────────────────────────────────────

function SlotMeter({ totals }) {
  const { total, booked, requested, open } = totals
  if (!total) return <div className="h-2 rounded-full bg-gray-100 w-full" title="No schedule in range" />
  const pct = v => `${(v / total) * 100}%`
  return (
    <div className="h-2 rounded-full bg-gray-100 w-full flex overflow-hidden" title={`${booked} booked · ${requested} requested · ${open} open`}>
      <div className="bg-blue-500 h-full" style={{ width: pct(booked) }} />
      <div className="bg-amber-400 h-full" style={{ width: pct(requested) }} />
      <div className="bg-emerald-400 h-full" style={{ width: pct(open) }} />
    </div>
  )
}

// ── Day detail panel (slot chips + appointments) ───────────────────────────────

function DayPanel({ doctor, dates, requests, onBookSlot, onApprove, onReject, onEditAppt, onCancelAppt, onStatusChange, busyId, reloadKey }) {
  const [day, setDay] = useState(dates[0])
  const [slotData, setSlotData] = useState(null)
  const [appts, setAppts] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null) // { type: 'open'|'booked'|'requested', time, appt?, booking? }
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  useEffect(() => { if (!dates.includes(day)) setDay(dates[0]) }, [dates]) // range changed

  useEffect(() => {
    let dead = false
    setLoading(true); setSelected(null); setShowReject(false)
    Promise.all([
      api.get(`/public/doctors/${doctor.profile_id}/slots`, { params: { booking_date: day } }).catch(() => null),
      api.get('/appointments', { params: { doctor_id: doctor.profile_id, appointment_date: day, limit: 200 } }).catch(() => []),
    ]).then(([slots, list]) => {
      if (dead) return
      setSlotData(slots)
      setAppts(Array.isArray(list) ? list : [])
    }).finally(() => !dead && setLoading(false))
    return () => { dead = true }
  }, [doctor.profile_id, day, reloadKey])

  const dayRequests = requests.filter(r => r.doctor_id === doctor.profile_id && r.booking_date === day)
  const reqByTime = Object.fromEntries(dayRequests.map(r => [r.booking_time?.slice(0, 5), r]))
  const apptByTime = {}
  appts.filter(a => !['cancelled', 'no_show'].includes(a.status)).forEach(a => {
    const t = (a.appointment_time || '').slice(0, 5)
    if (t && !apptByTime[t]) apptByTime[t] = a
  })

  const nowHM = istNow().toISOString().slice(11, 16)
  const isPast = (t) => day < istToday() || (day === istToday() && t < nowHM)

  const chipFor = (slot) => {
    const t = slot.time
    if (reqByTime[t])  return { type: 'requested', cls: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200', booking: reqByTime[t] }
    if (apptByTime[t]) return { type: 'booked', cls: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200', appt: apptByTime[t] }
    if (isPast(t))     return { type: 'past', cls: 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed' }
    if (!slot.available) return { type: 'taken', cls: 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed', title: 'Held by another branch/booking' }
    return { type: 'open', cls: 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50' }
  }

  const visibleAppts = appts.filter(a => a.status !== 'cancelled')

  return (
    <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-4">
      {/* Day tabs */}
      <div className="flex gap-1.5 flex-wrap mb-3">
        {dates.map(d => (
          <button key={d} onClick={() => setDay(d)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${d === day
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
            {d === istToday() ? 'Today' : fmtDay(d)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
      ) : !slotData?.available ? (
        <p className="text-sm text-gray-400 py-3">{slotData?.reason || 'No schedule for this day'}</p>
      ) : (
        <>
          {/* Slot chips */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {slotData.slots.map(s => {
              const chip = chipFor(s)
              const isSel = selected?.time === s.time
              return (
                <button key={s.time} title={chip.title}
                  disabled={chip.type === 'past' || chip.type === 'taken'}
                  onClick={() => { setSelected({ ...chip, time: s.time }); setShowReject(false) }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold border transition ${chip.cls} ${isSel ? 'ring-2 ring-blue-400' : ''}`}>
                  {s.time}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-400 inline-block" /> Open</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" /> Booked</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" /> Requested</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gray-200 inline-block" /> Past</span>
          </div>

          {/* Selected slot action card */}
          {selected && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
              {selected.type === 'open' && (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm text-gray-700">
                    <span className="font-bold font-mono">{selected.time}</span> on {fmtDay(day)} — open slot
                  </div>
                  <button onClick={() => onBookSlot(doctor, day, selected.time)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700">
                    <CalendarPlus size={13} /> Book this slot
                  </button>
                </div>
              )}

              {selected.type === 'requested' && (
                <div>
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{selected.booking.patient_name}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                        <Phone size={11} /> {selected.booking.patient_mobile}
                        <Clock size={11} className="ml-1" /> {selected.time} · {fmtDay(day)}
                      </p>
                      {selected.booking.reason && <p className="text-xs text-gray-400 mt-1">"{selected.booking.reason}"</p>}
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Online Request</span>
                  </div>
                  {showReject ? (
                    <div className="flex gap-2 items-center">
                      <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        placeholder="Reason (optional)"
                        className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-100" />
                      <button onClick={() => setShowReject(false)} className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">Back</button>
                      <button onClick={() => onReject(selected.booking.id, rejectReason)} disabled={busyId === selected.booking.id}
                        className="px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                        {busyId === selected.booking.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />} Confirm Reject
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setShowReject(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                        <X size={12} /> Reject
                      </button>
                      <button onClick={() => onApprove(selected.booking.id)} disabled={busyId === selected.booking.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                        {busyId === selected.booking.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={12} />} Approve & Book
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selected.type === 'booked' && selected.appt && (
                <div>
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {selected.appt.patient_name}
                        {selected.appt.token_number != null && <span className="ml-2 text-xs text-indigo-600 font-bold">#{selected.appt.token_number}</span>}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {selected.appt.bh_id || selected.appt.clinic_patient_id || ''} · {selected.time} · {fmtDay(day)}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${APPT_STATUS_CLS[selected.appt.status] || 'bg-gray-100 text-gray-500'}`}>
                      {(selected.appt.status || '').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {day === istToday() && selected.appt.status === 'scheduled' && (
                      <button onClick={() => onStatusChange(selected.appt, 'waiting')} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1"><Check size={11} /> Check In</button>
                    )}
                    {day === istToday() && selected.appt.status === 'waiting' && (
                      <button onClick={() => onStatusChange(selected.appt, 'in_progress')} className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700">Start</button>
                    )}
                    {day === istToday() && selected.appt.status === 'in_progress' && (
                      <button onClick={() => onStatusChange(selected.appt, 'completed')} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Complete</button>
                    )}
                    {!['completed', 'cancelled'].includes(selected.appt.status) && (
                      <>
                        <button onClick={() => onEditAppt(selected.appt)} className="px-3 py-1.5 text-xs border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-1">
                          <Pencil size={11} /> Edit / Reschedule
                        </button>
                        <button onClick={() => onCancelAppt(selected.appt)} className="px-3 py-1.5 text-xs border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 flex items-center gap-1">
                          <X size={11} /> Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Appointments table for the day */}
          {visibleAppts.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 text-xs font-bold text-gray-500">
                Appointments — {fmtDay(day)} ({visibleAppts.length})
              </div>
              <div className="divide-y divide-gray-50 max-h-56 overflow-auto">
                {visibleAppts.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-gray-50">
                    <span className="font-mono font-semibold text-gray-600 w-11">{(a.appointment_time || '—').slice(0, 5)}</span>
                    <span className="font-semibold text-gray-800 flex-1 truncate">{a.patient_name}</span>
                    <span className={`font-semibold px-2 py-0.5 rounded-full capitalize ${APPT_STATUS_CLS[a.status] || 'bg-gray-100 text-gray-500'}`}>
                      {(a.status || '').replace(/_/g, ' ')}
                    </span>
                    {!['completed', 'cancelled'].includes(a.status) && (
                      <span className="flex gap-1">
                        <button onClick={() => onEditAppt(a)} title="Edit / Reschedule"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Pencil size={12} /></button>
                        <button onClick={() => onCancelAppt(a)} title="Cancel"
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-gray-400 hover:text-rose-600"><X size={12} /></button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Doctor row ─────────────────────────────────────────────────────────────────

function DoctorRow({ doc, expanded, onToggle, onPin, onLock, onAccepting, children }) {
  const live = LIVE[doc.live_status] || LIVE.available
  const lockedByOther = doc.locked_by && !doc.locked_by.me
  return (
    <div className={`border rounded-xl bg-white overflow-hidden transition ${expanded ? 'border-blue-200 shadow-sm' : 'border-gray-100'} ${lockedByOther ? 'opacity-75' : ''}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Pin & Lock */}
        <div className="flex flex-col gap-1">
          <button onClick={() => onPin(doc)} title={doc.pinned ? 'Unpin from my list' : 'Pin to my list'}
            className={`p-1 rounded ${doc.pinned ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}>
            {doc.pinned ? <Pin size={13} fill="currentColor" /> : <Pin size={13} />}
          </button>
          <button onClick={() => onLock(doc)}
            title={doc.locked_by ? (doc.locked_by.me ? 'Unlock (you are handling)' : `Locked by ${doc.locked_by.name}`) : 'Lock — I am handling this doctor'}
            className={`p-1 rounded ${doc.locked_by ? (doc.locked_by.me ? 'text-blue-600' : 'text-rose-400') : 'text-gray-300 hover:text-blue-500'}`}>
            {doc.locked_by ? <Lock size={13} /> : <Unlock size={13} />}
          </button>
        </div>

        {/* Identity */}
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{ background: '#0F255718', color: '#0F2557' }}>
            {initials(doc.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-800 truncate">{doc.full_name}</span>
              <span className="text-xs text-gray-400">{doc.specialty}</span>
              {!doc.accepting && (
                <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded">BLOCKED</span>
              )}
              {lockedByOther && (
                <span className="text-xs bg-rose-50 text-rose-500 px-1.5 py-0.5 rounded flex items-center gap-1"><Lock size={9} /> {doc.locked_by.name}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className={`flex items-center gap-1 text-xs font-medium ${live.text} flex-shrink-0`}>
                <span className={`w-1.5 h-1.5 rounded-full ${live.dot}`} /> {live.label}
              </span>
              <div className="flex-1 max-w-[160px] hidden sm:block"><SlotMeter totals={doc.totals} /></div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                <b className="text-gray-700">{doc.totals.booked}</b>/{doc.totals.total} booked
                {doc.totals.requested > 0 && <span className="text-amber-600 font-semibold"> · {doc.totals.requested} req</span>}
                <span className="text-emerald-600"> · {doc.totals.open} open</span>
              </span>
              {doc.advance_requests > 0 && (
                <span className="text-xs bg-amber-50 text-amber-700 font-semibold px-1.5 py-0.5 rounded whitespace-nowrap hidden md:inline">{doc.advance_requests} adv</span>
              )}
            </div>
          </div>
        </button>

        {/* Accepting toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => onAccepting(doc)}
            title={doc.accepting ? 'Accepting bookings — click to block' : 'Blocked — click to enable'}
            className={`relative w-10 h-6 rounded-full transition ${doc.accepting ? 'bg-emerald-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${doc.accepting ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
          <button onClick={onToggle} className="p-1 text-gray-400">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>
      {expanded && children}
    </div>
  )
}

// ── Requests panel ─────────────────────────────────────────────────────────────

function RequestsPanel({ requests, doctorsById, onApprove, onReject, busyId }) {
  const [tab, setTab] = useState('all')
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')

  const today = istToday()
  const tomorrow = addDays(today, 1)
  const week = addDays(today, 7)

  const filtered = requests.filter(r => {
    if (tab === 'today') return r.booking_date === today
    if (tab === 'tomorrow') return r.booking_date === tomorrow
    if (tab === 'week') return r.booking_date >= today && r.booking_date <= week
    return true
  })

  const count = (f) => requests.filter(f).length
  const tabs = [
    { id: 'today',    label: 'Today',    n: count(r => r.booking_date === today) },
    { id: 'tomorrow', label: 'Tomorrow', n: count(r => r.booking_date === tomorrow) },
    { id: 'week',     label: '7 Days',   n: count(r => r.booking_date >= today && r.booking_date <= week) },
    { id: 'all',      label: 'All',      n: requests.length },
  ]

  if (requests.length === 0) return null

  return (
    <div className="border-t border-amber-100">
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap" style={{ background: '#FFFBEB' }}>
        <Bell size={15} className="text-amber-600" />
        <span className="font-bold text-amber-800 text-sm">Booking Requests</span>
        <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white bg-amber-500">{requests.length}</span>
        <div className="flex gap-1 ml-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${tab === t.id
                ? 'bg-amber-500 text-white' : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-100'}`}>
              {t.label}{t.n > 0 && ` (${t.n})`}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y divide-gray-50 max-h-72 overflow-auto">
        {filtered.length === 0 && (
          <p className="px-4 py-4 text-sm text-gray-400">No requests in this window</p>
        )}
        {filtered.map(r => {
          const doc = doctorsById[r.doctor_id]
          const blocked = doc && !doc.accepting
          return (
            <div key={r.id} className="px-4 py-2.5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-xs font-semibold text-gray-700 w-24 flex-shrink-0">
                  {r.booking_date === today ? 'Today' : fmtDay(r.booking_date)}
                  <span className="block font-mono text-gray-500">{(r.booking_time || '').slice(0, 5)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{r.patient_name}
                    <span className="text-xs text-gray-400 font-normal ml-2">{r.patient_mobile}</span>
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {doc ? doc.full_name : 'Doctor'}
                    {r.reason && ` · "${r.reason}"`}
                    {blocked && <span className="text-red-500 font-semibold ml-1">⚠ Dr blocked</span>}
                  </p>
                </div>
                {rejecting === r.id ? (
                  <div className="flex gap-1.5 items-center">
                    <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason"
                      className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg w-32 focus:outline-none" />
                    <button onClick={() => setRejecting(null)} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg">Back</button>
                    <button onClick={() => { onReject(r.id, reason); setRejecting(null); setReason('') }}
                      disabled={busyId === r.id}
                      className="px-2.5 py-1.5 text-xs bg-red-600 text-white rounded-lg disabled:opacity-50">Confirm</button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <button onClick={() => setRejecting(r.id)}
                      className="px-2.5 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-1">
                      <X size={11} /> Reject
                    </button>
                    <button onClick={() => onApprove(r.id)} disabled={busyId === r.id}
                      className="px-2.5 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
                      {busyId === r.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main board ─────────────────────────────────────────────────────────────────

const RANGE_PRESETS = [
  { id: 'today',    label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'week',     label: '7 Days' },
  { id: 'custom',   label: 'Custom' },
]

const SORTS = [
  { id: 'attention', label: 'Needs attention' },
  { id: 'name',      label: 'Name' },
  { id: 'open',      label: 'Most open' },
  { id: 'booked',    label: 'Most booked' },
]

export default function DoctorSlotBoard({ onPendingCount }) {
  const navigate = useNavigate()
  const [rangeMode, setRangeMode] = useState('today')
  const [customFrom, setCustomFrom] = useState(istToday())
  const [customTo, setCustomTo] = useState(addDays(istToday(), 6))

  const [board, setBoard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [doctorsList, setDoctorsList] = useState([]) // staff-id list for Edit modal
  const [reloadKey, setReloadKey] = useState(0)

  const [search, setSearch] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [slotFilter, setSlotFilter] = useState('')
  const [myOnly, setMyOnly] = useState(false)
  const [sort, setSort] = useState('attention')
  const [showAll, setShowAll] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const [busyId, setBusyId] = useState(null)
  const [toast, setToast] = useState(null)
  const [editAppt, setEditAppt] = useState(null)
  const [cancelAppt, setCancelAppt] = useState(null)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const { from, to } = useMemo(() => {
    const t = istToday()
    if (rangeMode === 'today') return { from: t, to: t }
    if (rangeMode === 'tomorrow') { const d = addDays(t, 1); return { from: d, to: d } }
    if (rangeMode === 'week') return { from: t, to: addDays(t, 6) }
    return { from: customFrom, to: customTo }
  }, [rangeMode, customFrom, customTo])

  const dates = useMemo(() => {
    const out = []
    let d = from
    let guard = 0
    while (d <= to && guard < 32) { out.push(d); d = addDays(d, 1); guard++ }
    return out
  }, [from, to])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const r = await api.get('/clinic/slot-board', { params: { date_from: from, date_to: to } })
      setBoard(r)
      onPendingCount?.(r?.pending_requests?.length || 0)
    } catch { /* keep last */ }
    setLoading(false)
  }, [from, to, onPendingCount])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/clinic/doctors').then(r => setDoctorsList(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])
  useEffect(() => {
    const h = () => { load(true); setReloadKey(k => k + 1) }
    window.addEventListener('bharatcliniq:refresh', h)
    const id = setInterval(() => load(true), 60000)
    return () => { window.removeEventListener('bharatcliniq:refresh', h); clearInterval(id) }
  }, [load])

  const refreshAll = () => { load(true); setReloadKey(k => k + 1) }

  // ── actions ──────────────────────────────────────────────────────────────────
  const approve = async (id) => {
    setBusyId(id)
    try {
      await api.post(`/appointments/online-bookings/${id}/confirm`)
      showToast('Request approved — appointment created')
      refreshAll()
    } catch (e) { showToast(e?.message || 'Approval failed', 'error') }
    setBusyId(null)
  }

  const reject = async (id, reason) => {
    setBusyId(id)
    try {
      await api.post(`/appointments/online-bookings/${id}/cancel`, { reason })
      showToast('Request rejected')
      refreshAll()
    } catch (e) { showToast(e?.message || 'Rejection failed', 'error') }
    setBusyId(null)
  }

  const toggleAccepting = async (doc) => {
    try {
      const r = await api.put(`/clinic/doctors/${doc.profile_id}/accepting`, { accepting: !doc.accepting })
      setBoard(b => ({ ...b, doctors: b.doctors.map(d => d.profile_id === doc.profile_id ? { ...d, accepting: r.accepting_appointments } : d) }))
      showToast(r.accepting_appointments ? `${doc.full_name} is accepting bookings` : `${doc.full_name} blocked from new bookings`)
    } catch (e) { showToast(e?.message || 'Update failed', 'error') }
  }

  const togglePin = async (doc) => {
    try {
      const r = await api.post('/clinic/desk-assignments', { doctor_id: doc.profile_id, pinned: !doc.pinned })
      setBoard(b => ({ ...b, doctors: b.doctors.map(d => d.profile_id === doc.profile_id ? { ...d, pinned: r.pinned } : d) }))
    } catch (e) { showToast(e?.message || 'Pin failed', 'error') }
  }

  const toggleLock = async (doc) => {
    const want = !(doc.locked_by && doc.locked_by.me)
    try {
      await api.post('/clinic/desk-assignments', { doctor_id: doc.profile_id, locked: want })
      refreshAll()
      showToast(want ? `You are now handling ${doc.full_name}` : `Unlocked ${doc.full_name}`)
    } catch (e) { showToast(e?.message || 'Lock failed', 'error') }
  }

  const bookSlot = (doc, day, time) => {
    navigate('/front-desk/book', { state: { prefill: { doctor_staff_id: doc.staff_id, date: day, time } } })
  }

  const statusChange = async (appt, status) => {
    try {
      await api.put(`/appointments/${appt.id}`, { status })
      showToast(`Status → ${status.replace(/_/g, ' ')}`)
      refreshAll()
    } catch (e) { showToast(e?.message || 'Update failed', 'error') }
  }

  // ── derived ──────────────────────────────────────────────────────────────────
  const doctors = board?.doctors || []
  const requests = board?.pending_requests || []
  const doctorsById = Object.fromEntries(doctors.map(d => [d.profile_id, d]))
  const specialties = [...new Set(doctors.map(d => d.specialty).filter(Boolean))].sort()

  const filtered = doctors.filter(d => {
    if (search && !d.full_name.toLowerCase().includes(search.toLowerCase())) return false
    if (specialty && d.specialty !== specialty) return false
    if (myOnly && !d.pinned) return false
    if (slotFilter === 'open' && d.totals.open === 0) return false
    if (slotFilter === 'requested' && d.totals.requested === 0 && d.advance_requests === 0) return false
    if (slotFilter === 'full' && (d.totals.open > 0 || d.totals.total === 0)) return false
    if (slotFilter === 'blocked' && d.accepting) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'name') return a.full_name.localeCompare(b.full_name)
    if (sort === 'open') return b.totals.open - a.totals.open
    if (sort === 'booked') return b.totals.booked - a.totals.booked
    // needs attention: my locks first, then requests, then advance, then fewest open
    const lockMe = (d) => (d.locked_by?.me ? 1 : 0)
    if (lockMe(b) !== lockMe(a)) return lockMe(b) - lockMe(a)
    if (b.totals.requested !== a.totals.requested) return b.totals.requested - a.totals.requested
    if (b.advance_requests !== a.advance_requests) return b.advance_requests - a.advance_requests
    return a.totals.open - b.totals.open
  })

  const visible = showAll ? sorted : sorted.slice(0, 5)

  const sum = filtered.reduce((s, d) => ({
    total: s.total + d.totals.total, booked: s.booked + d.totals.booked,
    requested: s.requested + d.totals.requested, open: s.open + d.totals.open,
  }), { total: 0, booked: 0, requested: 0, open: 0 })
  const blockedCount = filtered.filter(d => !d.accepting).length

  const handleSaved = () => { showToast('Appointment updated'); refreshAll() }
  const handleCancelled = () => { showToast('Appointment cancelled'); refreshAll() }

  return (
    <div className="card overflow-hidden mb-6">
      {/* Header + range */}
      <div className="px-4 py-3.5 border-b border-gray-100 flex items-center gap-3 flex-wrap">
        <span className="font-bold flex items-center gap-2" style={{ color: '#0F2557' }}>
          <Stethoscope size={16} className="text-gray-400" /> Doctor Slot Board
        </span>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium ml-auto">
          {RANGE_PRESETS.map(p => (
            <button key={p.id} onClick={() => setRangeMode(p.id)}
              className={`px-3 py-1.5 transition ${rangeMode === p.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {rangeMode === 'custom' && (
          <div className="flex items-center gap-1.5">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none" />
            <span className="text-xs text-gray-400">—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none" />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-wrap bg-gray-50/50">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search doctor…"
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <select value={specialty} onChange={e => setSpecialty(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
          <option value="">All specialties</option>
          {specialties.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={slotFilter} onChange={e => setSlotFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
          <option value="">All slots</option>
          <option value="open">Has open slots</option>
          <option value="requested">Has requests</option>
          <option value="full">Fully booked</option>
          <option value="blocked">Blocked</option>
        </select>
        <button onClick={() => setMyOnly(v => !v)}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition ${myOnly
            ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'}`}>
          <Pin size={11} /> My Doctors
        </button>
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none ml-auto">
          {SORTS.map(s => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
        </select>
      </div>

      {/* Summary strip */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-4 flex-wrap text-xs">
        <span className="text-gray-500"><b className="text-base text-gray-800">{sum.total}</b> Slots</span>
        <span className="text-blue-600"><b className="text-base">{sum.booked}</b> Booked</span>
        <span className="text-amber-600"><b className="text-base">{sum.requested}</b> Requested</span>
        <span className="text-emerald-600"><b className="text-base">{sum.open}</b> Open</span>
        {blockedCount > 0 && <span className="text-red-500 flex items-center gap-1"><Ban size={11} /><b>{blockedCount}</b> Blocked</span>}
        <span className="text-gray-400 ml-auto">{from === to ? fmtDay(from) : `${fmtDay(from)} — ${fmtDay(to)}`}</span>
      </div>

      {/* Doctor rows */}
      {loading && !board ? (
        <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
      ) : sorted.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">
          <UserCircle2 size={28} className="mx-auto mb-2 opacity-30" />
          {doctors.length === 0 ? 'No doctors configured' : 'No doctors match the filters'}
        </div>
      ) : (
        <div className="p-3 space-y-2">
          {visible.map(doc => (
            <DoctorRow key={doc.profile_id} doc={doc}
              expanded={expandedId === doc.profile_id}
              onToggle={() => setExpandedId(expandedId === doc.profile_id ? null : doc.profile_id)}
              onPin={togglePin} onLock={toggleLock} onAccepting={toggleAccepting}>
              <DayPanel doctor={doc} dates={dates} requests={requests}
                onBookSlot={bookSlot} onApprove={approve} onReject={reject}
                onEditAppt={setEditAppt} onCancelAppt={setCancelAppt}
                onStatusChange={statusChange} busyId={busyId} reloadKey={reloadKey} />
            </DoctorRow>
          ))}
          {sorted.length > 5 && (
            <button onClick={() => setShowAll(v => !v)}
              className="w-full py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition">
              {showAll ? 'Show top 5 only' : `Show all ${sorted.length} doctors`}
            </button>
          )}
        </div>
      )}

      {/* Booking requests */}
      <RequestsPanel requests={requests} doctorsById={doctorsById}
        onApprove={approve} onReject={reject} busyId={busyId} />

      {/* Modals */}
      <EditAppointmentModal open={!!editAppt} appointment={editAppt} doctors={doctorsList}
        onClose={() => setEditAppt(null)} onSaved={handleSaved} />
      <CancelAppointmentModal open={!!cancelAppt} appointment={cancelAppt}
        onClose={() => setCancelAppt(null)} onCancelled={handleCancelled} />

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
