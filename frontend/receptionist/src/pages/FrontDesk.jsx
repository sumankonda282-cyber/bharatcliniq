import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import {
  Plus, Search, X, Check, Loader2, Video, ChevronDown, ChevronUp,
  RefreshCw, Clock, Calendar, User, AlertTriangle, Heart, Thermometer,
  Activity, Droplets, Edit2, Filter, ArrowLeft,
} from 'lucide-react'

// ─── Utilities ────────────────────────────────────────────────────────────────

function todayIST() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10)
}

function calcBMI(weight, height) {
  const w = parseFloat(weight)
  const h = parseFloat(height) / 100
  if (!w || !h || h === 0) return null
  return (w / (h * h)).toFixed(1)
}

function formatAge(dob) {
  if (!dob) return null
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000)
  return years + 'y'
}

function nowLabel() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const STATUS_COLORS = {
  scheduled: 'badge-yellow',
  waiting: 'badge-yellow',
  in_progress: 'badge-purple',
  completed: 'badge-green',
  cancelled: 'badge-gray',
  no_show: 'badge-red',
}

const STATUS_LABELS = {
  scheduled: 'Scheduled',
  waiting: 'Waiting',
  in_progress: 'In Consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
}

const VISIT_TYPE_LABELS = {
  walk_in: 'Walk-in',
  scheduled: 'Scheduled',
  follow_up: 'Follow-up',
  emergency: 'Emergency',
  telehealth: 'Telehealth',
}

const TRIAGE_LEVELS = [
  { value: 'normal', label: 'Normal', dot: 'bg-green-400', text: 'text-green-700' },
  { value: 'moderate', label: 'Moderate', dot: 'bg-yellow-400', text: 'text-yellow-700' },
  { value: 'urgent', label: 'Urgent', dot: 'bg-red-500', text: 'text-red-700' },
]

const DESK_PINS_KEY = 'recep_desk_pins'

function loadPins() {
  try {
    const raw = localStorage.getItem(DESK_PINS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePins(pins) {
  localStorage.setItem(DESK_PINS_KEY, JSON.stringify(pins))
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div
      className={`fixed bottom-5 right-5 z-[90] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
        ${type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}
    >
      {type === 'success' ? <Check size={15} className="text-green-600" /> : <AlertTriangle size={15} className="text-red-600" />}
      {msg}
    </div>
  )
}

// ─── Triage dot ───────────────────────────────────────────────────────────────

function TriageDot({ level }) {
  const t = TRIAGE_LEVELS.find(x => x.value === level) || TRIAGE_LEVELS[0]
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${t.dot}`} title={t.label} />
}

// ─── BHID Banner (reused from Patients page pattern) ─────────────────────────

function BhidBanner({ mobile, dob }) {
  const [status, setStatus] = useState(null)
  const [result, setResult] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!mobile || mobile.length < 10 || !dob) { setStatus(null); setResult(null); return }
    setStatus('loading')
    timerRef.current = setTimeout(async () => {
      try {
        const r = await api.get('/inpatient/bhid/lookup', { params: { mobile, dob } })
        setResult(r)
        setStatus('found')
      } catch {
        setStatus('not_found')
        setResult(null)
      }
    }, 600)
    return () => clearTimeout(timerRef.current)
  }, [mobile, dob])

  if (status === 'loading') return (
    <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
      <Loader2 size={13} className="animate-spin" />Checking BHID…
    </div>
  )
  if (status === 'found') return (
    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
      <Check size={13} className="text-green-600 flex-shrink-0" />
      <span><strong>{result?.bh_id || 'BH-ID found'}</strong> — Existing patient on platform</span>
    </div>
  )
  if (status === 'not_found') return (
    <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      New to platform — BHID will be assigned on save
    </div>
  )
  return null
}

// ─── Register Patient Modal ───────────────────────────────────────────────────

function RegisterPatientModal({ onClose, onRegistered }) {
  const [form, setForm] = useState({ full_name: '', mobile: '', date_of_birth: '', gender: '', blood_group: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async e => {
    e.preventDefault()
    if (form.mobile.length !== 10) { setErr('Mobile must be 10 digits'); return }
    setSaving(true); setErr('')
    try {
      const payload = { ...form }
      if (!payload.date_of_birth) delete payload.date_of_birth
      if (!payload.gender) delete payload.gender
      if (!payload.blood_group) delete payload.blood_group
      if (!payload.address) delete payload.address
      const newPat = await api.post('/patients', payload)
      onRegistered(newPat)
      onClose()
    } catch (ex) { setErr(ex.message || 'Registration failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>Register New Patient</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required placeholder="Patient's full name" />
          </div>
          <div>
            <label className="label">Mobile * (10 digits)</label>
            <input className="input" type="tel" maxLength={10} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))} required placeholder="10-digit mobile number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date of Birth</label>
              <input type="date" className="input" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
            </div>
            <div>
              <label className="label">Gender</label>
              <select className="input" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <BhidBanner mobile={form.mobile} dob={form.date_of_birth} />
          <div>
            <label className="label">Blood Group</label>
            <select className="input" value={form.blood_group} onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}>
              <option value="">Unknown</option>
              {'A+ A- B+ B- O+ O- AB+ AB-'.split(' ').map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="input resize-none" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Optional address" />
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Register Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Book Appointment Modal ───────────────────────────────────────────────────

function BookAppointmentModal({ patient, doctors, onClose, onBooked }) {
  const today = todayIST()
  const [form, setForm] = useState({
    patient_id: patient?.id || '',
    doctor_id: '',
    appointment_date: today,
    appointment_time: '09:00',
    visit_type: 'walk_in',
    notes: '',
    mode: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      const payload = {
        patient_id: parseInt(form.patient_id),
        doctor_id: parseInt(form.doctor_id),
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        visit_type: form.visit_type,
        notes: form.notes,
      }
      if (form.mode) payload.mode = form.mode
      await api.post('/appointments', payload)
      onBooked()
      onClose()
    } catch (ex) { setErr(ex.message || 'Booking failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>Book Appointment</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        {patient && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-2">
            <User size={14} className="text-blue-500" />
            <div>
              <span className="text-sm font-semibold text-blue-900">{patient.full_name}</span>
              {patient.bh_id && <span className="ml-2 text-xs text-blue-500 font-mono">{patient.bh_id}</span>}
            </div>
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Doctor *</label>
            <select className="input" value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))} required>
              <option value="">Select doctor</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.staff?.full_name || `Dr. #${d.id}`}{d.specialty ? ` — ${d.specialty}` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" value={form.appointment_date} onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Time *</label>
              <input type="time" className="input" value={form.appointment_time} onChange={e => setForm(f => ({ ...f, appointment_time: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">Visit Type</label>
            <select className="input" value={form.visit_type} onChange={e => setForm(f => ({ ...f, visit_type: e.target.value }))}>
              <option value="walk_in">Walk-in</option>
              <option value="scheduled">Scheduled</option>
              <option value="follow_up">Follow-up</option>
              <option value="emergency">Emergency</option>
              <option value="telehealth">Telehealth</option>
            </select>
          </div>
          {form.visit_type === 'telehealth' && (
            <div>
              <label className="label">Mode</label>
              <select className="input" value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}>
                <option value="">Default</option>
                <option value="telehealth">Telehealth</option>
              </select>
            </div>
          )}
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" />
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <><Loader2 size={14} className="animate-spin" />Booking…</> : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Patient Profile Slide Panel ──────────────────────────────────────────────

function PatientProfilePanel({ patient, todayAppt, doctors, onClose, onBookAppt, onAddToDesk }) {
  const [pastAppts, setPastAppts] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!patient?.id) return
    setLoading(true)
    api.get('/appointments', { params: { patient_id: patient.id, limit: 10 } })
      .then(r => setPastAppts(Array.isArray(r) ? r.slice(0, 10) : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [patient?.id])

  const age = formatAge(patient?.date_of_birth)

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-start justify-end">
      <div className="bg-white shadow-2xl w-full max-w-md h-full overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="text-base font-bold" style={{ color: '#0F2557' }}>{patient?.full_name}</h2>
              {patient?.bh_id && <p className="text-xs text-gray-400 font-mono">{patient.bh_id}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>

        <div className="flex-1 p-5 space-y-5">
          {/* Demographics */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Patient Info</h3>
            <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
              {[
                { label: 'Mobile', value: patient?.mobile },
                { label: 'Age', value: age || '—' },
                { label: 'Gender', value: patient?.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : '—' },
                { label: 'BHID', value: patient?.bh_id || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
                  <span className="text-sm text-gray-800 text-right">{value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onBookAppt(patient)}
              className="btn-primary flex-1 justify-center text-sm"
            >
              <Calendar size={14} />Book Appointment
            </button>
            {todayAppt && (
              <button
                onClick={() => { onAddToDesk(todayAppt.id); onClose() }}
                className="btn-secondary flex-1 justify-center text-sm"
              >
                <Plus size={14} />Add to Desk
              </button>
            )}
          </div>

          {/* Past appointments */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Recent Appointments</h3>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
            ) : pastAppts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No appointment history found</p>
            ) : (
              <div className="space-y-2">
                {pastAppts.map(a => (
                  <div key={a.id} className="rounded-xl border border-gray-100 px-4 py-3">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800">{a.appointment_date}</span>
                      <span className={`badge ${STATUS_COLORS[a.status] || 'badge-gray'} text-xs`}>
                        {STATUS_LABELS[a.status] || a.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{a.doctor_name || '—'}</div>
                    {a.visit_type && (
                      <div className="text-xs text-gray-400 mt-0.5 capitalize">
                        {VISIT_TYPE_LABELS[a.visit_type] || a.visit_type}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

// ─── Desk Card (Section A) ────────────────────────────────────────────────────

function DeskCard({ appt, triageLevel, onRemove, onTriageChange, onSaveScreening, onUpdateStatus, navigate }) {
  const [expanded, setExpanded] = useState(false)
  const [complaint, setComplaint] = useState(appt.triage_complaint || '')
  const [vitals, setVitals] = useState({
    blood_pressure_systolic: '',
    blood_pressure_diastolic: '',
    pulse_rate: '',
    temperature: '',
    oxygen_saturation: '',
    weight_kg: '',
    height_cm: '',
    blood_sugar: '',
  })
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [localErr, setLocalErr] = useState('')

  const bmi = calcBMI(vitals.weight_kg, vitals.height_cm)
  const isTelehealth = appt.mode === 'telehealth' || appt.visit_type === 'telehealth'

  const handleSave = async () => {
    setSaving(true); setLocalErr('')
    try {
      const vitalsPayload = { patient_id: appt.patient_id, appointment_id: appt.id }
      Object.entries(vitals).forEach(([k, v]) => { if (v !== '') vitalsPayload[k] = parseFloat(v) || v })
      await api.post('/appointments/vitals', vitalsPayload)
      if (complaint !== appt.triage_complaint) {
        await api.put(`/appointments/${appt.id}`, { triage_complaint: complaint })
      }
      setSavedAt(nowLabel())
      onSaveScreening(appt.id, complaint)
    } catch (ex) { setLocalErr(ex.message || 'Save failed') }
    finally { setSaving(false) }
  }

  const triageObj = TRIAGE_LEVELS.find(t => t.value === (triageLevel || 'normal')) || TRIAGE_LEVELS[0]

  return (
    <div className="card flex flex-col min-w-[300px] max-w-[380px] flex-shrink-0 relative">
      {/* Remove button */}
      <button
        onClick={() => onRemove(appt.id)}
        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors z-10"
        title="Remove from desk"
      >
        <X size={15} />
      </button>

      {/* Card header */}
      <div className="p-4 pb-3">
        <div className="flex items-center gap-2 mb-2 pr-6">
          <span className="text-xl font-extrabold" style={{ color: '#0F2557' }}>
            #{appt.token_number || appt.id}
          </span>
          {isTelehealth && <Video size={14} className="text-blue-500" />}
          <span className={`badge text-xs ${appt.visit_type === 'emergency' ? 'badge-red' : appt.visit_type === 'telehealth' ? 'badge-blue' : 'badge-gray'}`}>
            {VISIT_TYPE_LABELS[appt.visit_type] || appt.visit_type || 'Visit'}
          </span>
        </div>
        <div className="font-semibold text-gray-900 leading-tight">{appt.patient_name || '—'}</div>
        {appt.bh_id && <div className="text-xs font-mono text-gray-400">{appt.bh_id}</div>}
        <div className="text-sm text-gray-500 mt-1">{appt.doctor_name || '—'}</div>

        {/* Triage selector */}
        <div className="flex items-center gap-2 mt-3">
          <TriageDot level={triageLevel || 'normal'} />
          <select
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1"
            style={{ '--tw-ring-color': '#0F2557' }}
            value={triageLevel || 'normal'}
            onChange={e => onTriageChange(appt.id, e.target.value)}
          >
            {TRIAGE_LEVELS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <span className={`ml-auto badge ${STATUS_COLORS[appt.status] || 'badge-gray'} text-xs`}>
            {STATUS_LABELS[appt.status] || appt.status}
          </span>
        </div>

        {/* Quick status actions */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {appt.status === 'scheduled' && (
            <button
              onClick={() => onUpdateStatus(appt.id, 'waiting')}
              className="btn-secondary text-xs py-1 px-2"
            >
              <Check size={12} />Check In
            </button>
          )}
          {appt.status === 'waiting' && (
            <button
              onClick={() => onUpdateStatus(appt.id, 'in_progress')}
              className="btn-primary text-xs py-1 px-2"
            >
              Start
            </button>
          )}
          {appt.status === 'in_progress' && (
            <>
              <button onClick={() => onUpdateStatus(appt.id, 'completed')} className="btn-success text-xs py-1 px-2">Complete</button>
              <button onClick={() => onUpdateStatus(appt.id, 'no_show')} className="btn-secondary text-xs py-1 px-2 text-gray-500">No Show</button>
            </>
          )}
          {isTelehealth && (
            <button
              onClick={() => navigate(`/telehealth/call/${appt.id}`)}
              className="btn-secondary text-xs py-1 px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <Video size={12} />Join
            </button>
          )}
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 py-2 border-t border-gray-100 hover:bg-gray-50 transition-colors rounded-b-2xl"
      >
        {expanded ? <><ChevronUp size={13} />Hide Screening</> : <><ChevronDown size={13} />Screening & Vitals</>}
      </button>

      {/* Expanded screening form */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {/* Chief Complaint */}
          <div>
            <label className="label text-xs">Chief Complaint</label>
            <textarea
              className="input resize-none text-sm"
              rows={2}
              value={complaint}
              onChange={e => setComplaint(e.target.value)}
              placeholder="Describe chief complaint…"
            />
          </div>

          {/* BP */}
          <div>
            <label className="label text-xs flex items-center gap-1"><Heart size={12} className="text-red-400" />Blood Pressure (mmHg)</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                className="input text-sm"
                placeholder="Systolic"
                value={vitals.blood_pressure_systolic}
                onChange={e => setVitals(v => ({ ...v, blood_pressure_systolic: e.target.value }))}
              />
              <input
                type="number"
                className="input text-sm"
                placeholder="Diastolic"
                value={vitals.blood_pressure_diastolic}
                onChange={e => setVitals(v => ({ ...v, blood_pressure_diastolic: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label text-xs flex items-center gap-1"><Activity size={12} className="text-purple-400" />Pulse</label>
              <input type="number" className="input text-sm" placeholder="bpm" value={vitals.pulse_rate} onChange={e => setVitals(v => ({ ...v, pulse_rate: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs flex items-center gap-1"><Thermometer size={12} className="text-orange-400" />Temp °F</label>
              <input type="number" step="0.1" className="input text-sm" placeholder="98.6" value={vitals.temperature} onChange={e => setVitals(v => ({ ...v, temperature: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs flex items-center gap-1"><Droplets size={12} className="text-blue-400" />SpO2 %</label>
              <input type="number" className="input text-sm" placeholder="99" value={vitals.oxygen_saturation} onChange={e => setVitals(v => ({ ...v, oxygen_saturation: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Weight (kg)</label>
              <input type="number" step="0.1" className="input text-sm" placeholder="70.0" value={vitals.weight_kg} onChange={e => setVitals(v => ({ ...v, weight_kg: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs">Height (cm)</label>
              <input type="number" step="0.1" className="input text-sm" placeholder="170" value={vitals.height_cm} onChange={e => setVitals(v => ({ ...v, height_cm: e.target.value }))} />
            </div>
          </div>

          {bmi && (
            <div className="text-xs text-gray-500 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
              BMI: <strong className="text-blue-800">{bmi}</strong>
              <span className="ml-2 text-gray-400">
                {bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese'}
              </span>
            </div>
          )}

          <div>
            <label className="label text-xs"><Droplets size={12} className="inline text-red-400 mr-1" />Blood Glucose (mg/dL)</label>
            <input type="number" step="0.1" className="input text-sm" placeholder="Optional" value={vitals.blood_sugar} onChange={e => setVitals(v => ({ ...v, blood_sugar: e.target.value }))} />
          </div>

          {localErr && <p className="text-red-600 text-xs">{localErr}</p>}
          {savedAt && <p className="text-green-600 text-xs flex items-center gap-1"><Check size={12} />Saved at {savedAt}</p>}

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center text-sm">
            {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Save Screening'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function FrontDesk() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // ── Top-level state ──────────────────────────────────────────────────────────
  const [appts, setAppts] = useState([])
  const [doctors, setDoctors] = useState([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueError, setQueueError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState(null)

  // Desk pins & triage
  const [pinnedIds, setPinnedIds] = useState(() => loadPins())
  const [triageLevels, setTriageLevels] = useState({}) // { appt_id: 'normal' | 'moderate' | 'urgent' }

  // Queue filters
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '')
  const [filterDoctor, setFilterDoctor] = useState('')
  const [filterVisitType, setFilterVisitType] = useState('')

  // Section C state
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Modals
  const [showRegister, setShowRegister] = useState(false)
  const [bookModalPatient, setBookModalPatient] = useState(null) // patient object or null
  const [profilePatient, setProfilePatient] = useState(null)    // patient object or null
  const [deskSearchModal, setDeskSearchModal] = useState(false)
  const [deskSearchText, setDeskSearchText] = useState('')
  const [deskSearchResults, setDeskSearchResults] = useState([])
  const [deskSearchLoading, setDeskSearchLoading] = useState(false)

  // Debounce refs
  const searchTimer = useRef(null)
  const deskSearchTimer = useRef(null)

  // ── IST date ─────────────────────────────────────────────────────────────────
  const todayStr = todayIST()

  // ── Persist pins ─────────────────────────────────────────────────────────────
  useEffect(() => { savePins(pinnedIds) }, [pinnedIds])

  // ── Load doctors once ─────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/clinic/doctors')
      .then(r => setDoctors(Array.isArray(r) ? r : []))
      .catch(() => {})
  }, [])

  // ── Load queue ────────────────────────────────────────────────────────────────
  const loadQueue = useCallback(async (silent = false) => {
    if (!silent) setQueueLoading(true)
    else setRefreshing(true)
    setQueueError('')
    try {
      const data = await api.get('/appointments', { params: { appointment_date: todayStr, limit: 200 } })
      setAppts(Array.isArray(data) ? data : [])
    } catch (ex) {
      setQueueError(ex.message || 'Failed to load queue')
    } finally {
      setQueueLoading(false)
      setRefreshing(false)
    }
  }, [todayStr])

  useEffect(() => {
    loadQueue()
    const interval = setInterval(() => loadQueue(true), 30000)
    return () => clearInterval(interval)
  }, [loadQueue])

  // ── Patient search (Section C) ────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimer.current)
    if (!searchText.trim()) { setSearchResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const r = await api.get('/patients', { params: { search: searchText.trim(), limit: 30 } })
        setSearchResults(Array.isArray(r) ? r : [])
      } catch { setSearchResults([]) }
      finally { setSearchLoading(false) }
    }, 400)
    return () => clearTimeout(searchTimer.current)
  }, [searchText])

  // ── Desk search (add to desk modal) ──────────────────────────────────────────
  useEffect(() => {
    clearTimeout(deskSearchTimer.current)
    if (!deskSearchText.trim()) { setDeskSearchResults([]); return }
    deskSearchTimer.current = setTimeout(async () => {
      setDeskSearchLoading(true)
      try {
        const r = await api.get('/patients', { params: { search: deskSearchText.trim(), limit: 20 } })
        setDeskSearchResults(Array.isArray(r) ? r : [])
      } catch { setDeskSearchResults([]) }
      finally { setDeskSearchLoading(false) }
    }, 400)
    return () => clearTimeout(deskSearchTimer.current)
  }, [deskSearchText])

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const pinAppt = useCallback((apptId) => {
    setPinnedIds(prev => {
      if (prev.includes(apptId)) return prev
      return [...prev, apptId]
    })
  }, [])

  const unpinAppt = useCallback((apptId) => {
    setPinnedIds(prev => prev.filter(id => id !== apptId))
  }, [])

  const handleTriageChange = useCallback((apptId, level) => {
    setTriageLevels(prev => ({ ...prev, [apptId]: level }))
  }, [])

  const handleUpdateStatus = useCallback(async (apptId, newStatus) => {
    try {
      await api.put(`/appointments/${apptId}`, { status: newStatus })
      setAppts(prev => prev.map(a => a.id === apptId ? { ...a, status: newStatus } : a))
      showToast(`Status updated to ${STATUS_LABELS[newStatus] || newStatus}`)
    } catch (ex) {
      showToast(ex.message || 'Status update failed', 'error')
    }
  }, [])

  const handleSaveScreening = useCallback((apptId, complaint) => {
    setAppts(prev => prev.map(a => a.id === apptId ? { ...a, triage_complaint: complaint } : a))
    showToast('Screening saved')
  }, [])

  // Pinned appointment objects (in order of pinnedIds)
  const pinnedAppts = pinnedIds
    .map(id => appts.find(a => a.id === id))
    .filter(Boolean)

  // Find today's appointment for a patient
  const todayApptForPatient = useCallback((patientId) => {
    return appts.find(a => a.patient_id === patientId)
  }, [appts])

  // Add patient to desk: use today's appointment if exists
  const addPatientToDesk = useCallback((patient) => {
    const existing = todayApptForPatient(patient.id)
    if (existing) {
      pinAppt(existing.id)
      showToast(`${patient.full_name} added to desk`)
    } else {
      setBookModalPatient(patient)
    }
  }, [todayApptForPatient, pinAppt])

  // ── Filtered queue ────────────────────────────────────────────────────────────
  const doctorNames = [...new Set(appts.map(a => a.doctor_name).filter(Boolean))].sort()
  const hasFilters = filterStatus || filterDoctor || filterVisitType

  const visibleAppts = appts.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false
    if (filterDoctor && a.doctor_name !== filterDoctor) return false
    if (filterVisitType && a.visit_type !== filterVisitType) return false
    return true
  })

  // Sort: active first (scheduled, waiting, in_progress), then completed, then others
  const STATUS_ORDER_MAP = { waiting: 0, scheduled: 1, in_progress: 2, completed: 3, no_show: 4, cancelled: 5 }
  const sortedAppts = [...visibleAppts].sort((a, b) => {
    const ao = STATUS_ORDER_MAP[a.status] ?? 9
    const bo = STATUS_ORDER_MAP[b.status] ?? 9
    if (ao !== bo) return ao - bo
    return (a.appointment_time || '').localeCompare(b.appointment_time || '')
  })

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Front Desk</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock size={14} />
          <span>{todayStr}</span>
          {refreshing && <Loader2 size={14} className="animate-spin text-blue-400" />}
          <span className={`badge text-xs ${refreshing ? 'badge-blue' : 'badge-green'}`}>
            {refreshing ? 'Refreshing' : 'Live'}
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION A — MY DESK                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold" style={{ color: '#0F2557' }}>My Desk</h2>
          <button
            onClick={() => { setDeskSearchModal(true); setDeskSearchText(''); setDeskSearchResults([]) }}
            className="btn-secondary text-sm"
          >
            <Plus size={15} />Add to Desk
          </button>
        </div>

        {pinnedAppts.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">
            <User size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Your desk is empty — add patients from the queue below or search above</p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {pinnedAppts.map(appt => (
              <DeskCard
                key={appt.id}
                appt={appt}
                triageLevel={triageLevels[appt.id]}
                onRemove={unpinAppt}
                onTriageChange={handleTriageChange}
                onSaveScreening={handleSaveScreening}
                onUpdateStatus={handleUpdateStatus}
                navigate={navigate}
              />
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION B — TODAY'S QUEUE                                              */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold" style={{ color: '#0F2557' }}>Today's Queue</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">{appts.length} appointments</span>
            <button onClick={() => loadQueue()} className="btn-secondary text-sm p-2" title="Refresh">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-3">
          <select
            className="input w-auto text-sm py-1.5"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="waiting">Waiting</option>
            <option value="in_progress">In Consultation</option>
            <option value="completed">Completed</option>
            <option value="no_show">No Show</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="input w-auto text-sm py-1.5"
            value={filterDoctor}
            onChange={e => setFilterDoctor(e.target.value)}
          >
            <option value="">All Doctors</option>
            {doctorNames.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            className="input w-auto text-sm py-1.5"
            value={filterVisitType}
            onChange={e => setFilterVisitType(e.target.value)}
          >
            <option value="">All Visit Types</option>
            <option value="walk_in">Walk-in</option>
            <option value="scheduled">Scheduled</option>
            <option value="follow_up">Follow-up</option>
            <option value="emergency">Emergency</option>
            <option value="telehealth">Telehealth</option>
          </select>
          {hasFilters && (
            <button
              onClick={() => { setFilterStatus(''); setFilterDoctor(''); setFilterVisitType('') }}
              className="btn-secondary text-xs py-1 px-3 flex items-center gap-1"
            >
              <X size={12} />Clear Filters
            </button>
          )}
          {hasFilters && (
            <span className="text-xs text-gray-400 self-center">
              {visibleAppts.length} of {appts.length}
            </span>
          )}
        </div>

        {/* Queue table */}
        <div className="card overflow-hidden">
          {queueLoading ? (
            <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
          ) : queueError ? (
            <div className="p-10 text-center">
              <AlertTriangle size={28} className="mx-auto mb-3 text-red-400" />
              <p className="text-red-600 text-sm mb-3">{queueError}</p>
              <button onClick={() => loadQueue()} className="btn-secondary text-sm">
                <RefreshCw size={14} />Retry
              </button>
            </div>
          ) : sortedAppts.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <Calendar size={32} className="mx-auto mb-2 opacity-30" />
              <p>{appts.length === 0 ? 'No appointments today' : 'No appointments match filters'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="th">Token</th>
                    <th className="th">Patient</th>
                    <th className="th">Doctor</th>
                    <th className="th">Time</th>
                    <th className="th">Type</th>
                    <th className="th">Status</th>
                    <th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedAppts.map(a => {
                    const isTelehealth = a.mode === 'telehealth' || a.visit_type === 'telehealth'
                    const isPinned = pinnedIds.includes(a.id)
                    return (
                      <tr key={a.id} className="tr-hover">
                        <td className="td">
                          <span className="font-bold" style={{ color: '#0F2557' }}>#{a.token_number || a.id}</span>
                        </td>
                        <td className="td">
                          <div className="font-medium text-gray-900">{a.patient_name || '—'}</div>
                          {a.bh_id && <div className="text-xs font-mono text-gray-400">{a.bh_id}</div>}
                        </td>
                        <td className="td text-gray-600">{a.doctor_name || '—'}</td>
                        <td className="td text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-gray-400 flex-shrink-0" />
                            {a.appointment_time || '—'}
                          </span>
                        </td>
                        <td className="td">
                          <div className="flex items-center gap-1">
                            {isTelehealth && <Video size={13} className="text-blue-500 flex-shrink-0" />}
                            <span className="capitalize text-sm">
                              {VISIT_TYPE_LABELS[a.visit_type] || a.visit_type || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="td">
                          <span className={`badge ${STATUS_COLORS[a.status] || 'badge-gray'}`}>
                            {STATUS_LABELS[a.status] || a.status}
                          </span>
                        </td>
                        <td className="td">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {a.status === 'scheduled' && (
                              <button
                                onClick={() => handleUpdateStatus(a.id, 'waiting')}
                                className="btn-secondary text-xs py-1 px-2"
                              >
                                <Check size={12} />Check In
                              </button>
                            )}
                            {a.status === 'waiting' && (
                              <button
                                onClick={() => handleUpdateStatus(a.id, 'in_progress')}
                                className="btn-primary text-xs py-1 px-2"
                              >
                                Start
                              </button>
                            )}
                            {a.status === 'in_progress' && (
                              <>
                                <button onClick={() => handleUpdateStatus(a.id, 'completed')} className="btn-success text-xs py-1 px-2">Complete</button>
                                <button onClick={() => handleUpdateStatus(a.id, 'no_show')} className="btn-secondary text-xs py-1 px-2 text-gray-500">No Show</button>
                              </>
                            )}
                            {['scheduled', 'waiting', 'in_progress'].includes(a.status) && !isPinned && (
                              <button
                                onClick={() => { pinAppt(a.id); showToast('Added to desk') }}
                                className="btn-secondary text-xs py-1 px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                                title="Add to desk"
                              >
                                <Plus size={12} />Desk
                              </button>
                            )}
                            {isTelehealth && (
                              <button
                                onClick={() => navigate(`/telehealth/call/${a.id}`)}
                                className="btn-secondary text-xs py-1 px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                              >
                                <Video size={12} />Join
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION C — PATIENT SEARCH                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section className="card overflow-hidden">
        {/* Collapsible header */}
        <button
          onClick={() => setSearchExpanded(e => !e)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 font-bold text-base" style={{ color: '#0F2557' }}>
            <Search size={18} />
            Patient Search
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={e => { e.stopPropagation(); setShowRegister(true) }}
              className="btn-primary text-sm"
            >
              <Plus size={14} />Register New Patient
            </button>
            {searchExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </div>
        </button>

        {searchExpanded && (
          <div className="border-t border-gray-100 p-5">
            {/* Search input */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9"
                placeholder="Search by name, mobile, or BHID…"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                autoFocus
              />
              {searchText && (
                <button
                  onClick={() => { setSearchText(''); setSearchResults([]) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Search results */}
            {searchLoading && (
              <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-gray-400" /></div>
            )}

            {!searchLoading && searchText && searchResults.length === 0 && (
              <div className="text-center py-6 text-gray-400">
                <User size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No patients found for "{searchText}"</p>
                <button onClick={() => setShowRegister(true)} className="btn-primary text-sm mt-3">
                  <Plus size={14} />Register New Patient
                </button>
              </div>
            )}

            {!searchLoading && searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map(patient => {
                  const todayAppt = todayApptForPatient(patient.id)
                  const isPinned = todayAppt && pinnedIds.includes(todayAppt.id)
                  return (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:bg-blue-50/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{patient.full_name}</span>
                          {patient.bh_id && (
                            <span className="text-xs font-mono text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              {patient.bh_id}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                          {patient.mobile && <span>{patient.mobile}</span>}
                          {patient.age && <span>{patient.age}y</span>}
                          {patient.date_of_birth && !patient.age && <span>{formatAge(patient.date_of_birth)}</span>}
                          {patient.gender && <span className="capitalize">{patient.gender}</span>}
                          {todayAppt && (
                            <span className={`badge ${STATUS_COLORS[todayAppt.status] || 'badge-gray'} text-xs`}>
                              Today: {STATUS_LABELS[todayAppt.status] || todayAppt.status}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!isPinned && (
                          <button
                            onClick={() => addPatientToDesk(patient)}
                            className="btn-secondary text-xs py-1 px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                            title="Add to desk"
                          >
                            <Plus size={12} />Desk
                          </button>
                        )}
                        {isPinned && (
                          <span className="text-xs text-blue-500 font-medium px-2">On Desk</span>
                        )}
                        <button
                          onClick={() => setProfilePatient(patient)}
                          className="btn-secondary text-xs py-1 px-2"
                          title="View profile"
                        >
                          <User size={12} />Profile
                        </button>
                        <button
                          onClick={() => setBookModalPatient(patient)}
                          className="btn-primary text-xs py-1 px-2"
                          title="Book appointment"
                        >
                          <Calendar size={12} />Book
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Empty state before search */}
            {!searchLoading && !searchText && (
              <div className="text-center py-6 text-gray-400">
                <Search size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Type a patient name, mobile number, or BHID to search</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ADD TO DESK MODAL (search for patient to pin)                          */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {deskSearchModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>Add Patient to Desk</h3>
              <button onClick={() => setDeskSearchModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="relative mb-4">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9"
                placeholder="Search patient by name or mobile…"
                value={deskSearchText}
                onChange={e => setDeskSearchText(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {deskSearchLoading && (
                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
              )}
              {!deskSearchLoading && deskSearchText && deskSearchResults.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">No patients found</p>
              )}
              {!deskSearchLoading && deskSearchResults.map(patient => {
                const todayAppt = todayApptForPatient(patient.id)
                const isPinned = todayAppt && pinnedIds.includes(todayAppt.id)
                return (
                  <div key={patient.id} className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl border border-gray-100 hover:bg-blue-50/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 text-sm">{patient.full_name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        {patient.mobile && <span>{patient.mobile}</span>}
                        {patient.bh_id && <span className="font-mono">{patient.bh_id}</span>}
                        {todayAppt && (
                          <span className={`badge ${STATUS_COLORS[todayAppt.status] || 'badge-gray'} text-xs`}>
                            {STATUS_LABELS[todayAppt.status] || todayAppt.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      {isPinned ? (
                        <span className="text-xs text-blue-500 font-medium">On Desk</span>
                      ) : (
                        <button
                          onClick={() => {
                            addPatientToDesk(patient)
                            setDeskSearchModal(false)
                          }}
                          className="btn-primary text-xs py-1 px-2"
                        >
                          <Plus size={12} />Add
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {/* Also show today's appointments for quick pinning */}
              {!deskSearchText && (
                <>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Today's Active Appointments</p>
                  {appts.filter(a => ['scheduled', 'waiting', 'in_progress'].includes(a.status)).map(a => {
                    const isPinned = pinnedIds.includes(a.id)
                    return (
                      <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl border border-gray-100 hover:bg-blue-50/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm" style={{ color: '#0F2557' }}>#{a.token_number || a.id}</span>
                            <span className="font-medium text-gray-900 text-sm">{a.patient_name}</span>
                          </div>
                          <div className="text-xs text-gray-500">{a.doctor_name} · {a.appointment_time}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`badge ${STATUS_COLORS[a.status] || 'badge-gray'} text-xs`}>{STATUS_LABELS[a.status] || a.status}</span>
                          {isPinned ? (
                            <span className="text-xs text-blue-500 font-medium">On Desk</span>
                          ) : (
                            <button
                              onClick={() => { pinAppt(a.id); showToast('Added to desk'); setDeskSearchModal(false) }}
                              className="btn-primary text-xs py-1 px-2"
                            >
                              <Plus size={12} />Add
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {appts.filter(a => ['scheduled', 'waiting', 'in_progress'].includes(a.status)).length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-4">No active appointments today</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* REGISTER PATIENT MODAL                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showRegister && (
        <RegisterPatientModal
          onClose={() => setShowRegister(false)}
          onRegistered={newPat => {
            showToast(`Patient ${newPat.full_name || 'registered'} successfully`)
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* BOOK APPOINTMENT MODAL                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {bookModalPatient && (
        <BookAppointmentModal
          patient={bookModalPatient}
          doctors={doctors}
          onClose={() => setBookModalPatient(null)}
          onBooked={() => {
            showToast('Appointment booked')
            loadQueue()
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* PATIENT PROFILE SLIDE PANEL                                            */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {profilePatient && (
        <PatientProfilePanel
          patient={profilePatient}
          todayAppt={todayApptForPatient(profilePatient.id)}
          doctors={doctors}
          onClose={() => setProfilePatient(null)}
          onBookAppt={patient => { setProfilePatient(null); setBookModalPatient(patient) }}
          onAddToDesk={apptId => { pinAppt(apptId); showToast('Added to desk') }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TOAST                                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {toast && <Toast msg={toast.msg} type={toast.type || 'success'} onClose={() => setToast(null)} />}
    </div>
  )
}
