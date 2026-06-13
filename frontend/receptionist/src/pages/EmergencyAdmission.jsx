import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Bell, BedDouble,
  User, Phone, Clock, Ambulance, Edit3, LogIn, X, ShieldAlert,
} from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'

// ── Triage config ──────────────────────────────────────────────────────────────

const TRIAGE = [
  { id: 'red',    label: 'CRITICAL',   sub: 'Life-threatening',   bg: 'bg-red-600',    ring: 'ring-red-600',    text: 'text-red-600',    light: 'bg-red-50 border-red-300' },
  { id: 'orange', label: 'URGENT',     sub: 'Severe / unstable',  bg: 'bg-orange-500', ring: 'ring-orange-500', text: 'text-orange-500', light: 'bg-orange-50 border-orange-300' },
  { id: 'yellow', label: 'SEMI-URGENT',sub: 'Stable but needs care', bg: 'bg-yellow-400', ring: 'ring-yellow-400', text: 'text-yellow-600', light: 'bg-yellow-50 border-yellow-300' },
  { id: 'green',  label: 'STABLE',     sub: 'Non-urgent',         bg: 'bg-green-500',  ring: 'ring-green-500',  text: 'text-green-600',  light: 'bg-green-50 border-green-300' },
]

const BROUGHT_BY = [
  { v: 'ambulance', label: 'Ambulance' },
  { v: 'relative',  label: 'Relative' },
  { v: 'police',    label: 'Police' },
  { v: 'walk_in',   label: 'Walk-in' },
  { v: 'other',     label: 'Other' },
]

const defaultForm = () => ({
  triage_level: '',
  patient_name: '', gender: '', mobile: '', age: '',
  chief_complaint: '',
  brought_by: '', eta_minutes: '', caller_name: '', caller_mobile: '',
  bp: '', pulse: '', spo2: '', temp: '', rr: '', gcs: '',
  doctor_id: '', department_id: '', ward_id: '', bed_id: '',
})

// ── Helpers ────────────────────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300'
const labelCls = 'text-xs font-medium text-gray-500 mb-1 block'

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )
}

// ── Edit modal (post-registration corrections) ─────────────────────────────────

function EditEmergencyModal({ emrg, doctors, departments, wards, beds, onDone, onClose }) {
  const [form, setForm] = useState({
    triage_level: emrg.triage_level || '',
    patient_name: emrg.patient_name || '',
    gender: emrg.patient_gender || '',
    mobile: emrg.patient_mobile || '',
    chief_complaint: emrg.chief_complaint || '',
    brought_by: emrg.brought_by || '',
    eta_minutes: emrg.eta_minutes || '',
    caller_name: emrg.caller_name || '',
    caller_mobile: emrg.caller_mobile || '',
    doctor_id: emrg.admitting_doctor_id || '',
    department_id: emrg.department_id || '',
    ward_id: emrg.ward_id || '',
    bed_id: emrg.bed_id || '',
    bp: emrg.initial_vitals?.bp || '',
    pulse: emrg.initial_vitals?.pulse || '',
    spo2: emrg.initial_vitals?.spo2 || '',
    temp: emrg.initial_vitals?.temp || '',
    rr: emrg.initial_vitals?.rr || '',
    gcs: emrg.initial_vitals?.gcs || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const filteredWards = form.department_id
    ? wards.filter(w => String(w.department_id) === String(form.department_id))
    : wards
  const filteredBeds = form.ward_id
    ? beds.filter(b => String(b.ward_id) === String(form.ward_id) && (b.status === 'vacant' || b.id === emrg.bed_id))
    : []

  const submit = async () => {
    setSaving(true)
    try {
      const vitals = {}
      if (form.bp) vitals.bp = form.bp
      if (form.pulse) vitals.pulse = form.pulse
      if (form.spo2) vitals.spo2 = form.spo2
      if (form.temp) vitals.temp = form.temp
      if (form.rr) vitals.rr = form.rr
      if (form.gcs) vitals.gcs = form.gcs

      await api.put(`/inpatient/emergency/${emrg.id}`, {
        ...form,
        doctor_id: form.doctor_id || null,
        department_id: form.department_id || null,
        ward_id: form.ward_id || null,
        bed_id: form.bed_id || null,
        eta_minutes: form.eta_minutes ? parseInt(form.eta_minutes) : null,
        initial_vitals: Object.keys(vitals).length ? vitals : null,
      })
      onDone()
    } catch (e) {
      alert(e?.message || 'Update failed')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Edit3 size={16} className="text-orange-500" /> Edit Emergency — {emrg.admission_number}
          </h2>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Triage */}
          <div className="grid grid-cols-4 gap-2">
            {TRIAGE.map(t => (
              <button key={t.id} onClick={() => set('triage_level', t.id)}
                className={`py-2 rounded-xl text-xs font-bold transition border-2 ${form.triage_level === t.id ? `${t.bg} text-white border-transparent` : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Patient Name <span className="text-red-400 text-xs">(correctable)</span></label>
              <input className={inputCls} value={form.patient_name} onChange={e => set('patient_name', e.target.value)} placeholder="Full name or 'Unidentified'" />
            </div>
            <div>
              <label className={labelCls}>Mobile <span className="text-red-400 text-xs">(correctable)</span></label>
              <input className={inputCls} value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="Mobile number" />
            </div>
            <div>
              <label className={labelCls}>Gender</label>
              <select className={inputCls} value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Chief Complaint</label>
              <textarea className={inputCls} rows={2} value={form.chief_complaint} onChange={e => set('chief_complaint', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Brought By</label>
              <select className={inputCls} value={form.brought_by} onChange={e => set('brought_by', e.target.value)}>
                <option value="">Select…</option>
                {BROUGHT_BY.map(b => <option key={b.v} value={b.v}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>ETA (minutes)</label>
              <input type="number" className={inputCls} value={form.eta_minutes} onChange={e => set('eta_minutes', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Caller Name</label>
              <input className={inputCls} value={form.caller_name} onChange={e => set('caller_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Caller Mobile</label>
              <input className={inputCls} value={form.caller_mobile} onChange={e => set('caller_mobile', e.target.value)} />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Initial Vitals (update if available)</p>
            <div className="grid grid-cols-3 gap-2">
              {[['bp','BP (mmHg)'],['pulse','Pulse (bpm)'],['spo2','SpO₂ (%)'],['temp','Temp (°C)'],['rr','RR (/min)'],['gcs','GCS (3-15)']].map(([k,lbl]) => (
                <div key={k}>
                  <label className={labelCls}>{lbl}</label>
                  <input className={inputCls} value={form[k]} onChange={e => set(k, e.target.value)} placeholder="—" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
            <div>
              <label className={labelCls}>Department</label>
              <select className={inputCls} value={form.department_id} onChange={e => { set('department_id', e.target.value); set('ward_id', ''); set('bed_id', '') }}>
                <option value="">Select…</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Assigned Doctor</label>
              <select className={inputCls} value={form.doctor_id} onChange={e => set('doctor_id', e.target.value)}>
                <option value="">Select…</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` — ${d.specialty}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Ward</label>
              <select className={inputCls} value={form.ward_id} onChange={e => { set('ward_id', e.target.value); set('bed_id', '') }}>
                <option value="">Select…</option>
                {filteredWards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Bed (pre-assign)</label>
              <select className={inputCls} value={form.bed_id} onChange={e => set('bed_id', e.target.value)}>
                <option value="">Select…</option>
                {filteredBeds.map(b => <option key={b.id} value={b.id}>{b.bed_number} ({b.bed_type})</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-5 py-2.5 text-sm rounded-xl border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-6 py-2.5 text-sm rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2 font-medium">
            {saving && <Loader2 size={14} className="animate-spin" />} Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EmergencyAdmission() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState(defaultForm())
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const [doctors, setDoctors]         = useState([])
  const [departments, setDepartments] = useState([])
  const [wards, setWards]             = useState([])
  const [beds, setBeds]               = useState([])
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [done, setDone]               = useState(null)        // created emergency record
  const [alertSending, setAlertSending] = useState(false)
  const [alertSent, setAlertSent]     = useState(false)
  const [editOpen, setEditOpen]       = useState(false)

  // Load resources
  useEffect(() => {
    api.get('/clinic/doctors').then(r => setDoctors(Array.isArray(r) ? r : [])).catch(() => {})
    api.get('/inpatient/departments').then(r => setDepartments(Array.isArray(r) ? r : [])).catch(() => {})
    api.get('/inpatient/wards').then(r => setWards(Array.isArray(r) ? r : [])).catch(() => {})
    api.get('/inpatient/beds').then(r => setBeds(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  const filteredWards = form.department_id
    ? wards.filter(w => String(w.department_id) === String(form.department_id))
    : wards

  const filteredBeds = form.ward_id
    ? beds.filter(b => String(b.ward_id) === String(form.ward_id) && b.status === 'vacant')
    : []

  const submit = async () => {
    if (!form.triage_level) { setError('Select triage severity'); return }
    setSaving(true); setError('')
    try {
      const vitals = {}
      if (form.bp) vitals.bp = form.bp
      if (form.pulse) vitals.pulse = form.pulse
      if (form.spo2) vitals.spo2 = form.spo2
      if (form.temp) vitals.temp = form.temp
      if (form.rr) vitals.rr = form.rr
      if (form.gcs) vitals.gcs = form.gcs

      const r = await api.post('/inpatient/emergency', {
        triage_level: form.triage_level,
        patient_name: form.patient_name || null,
        gender: form.gender || null,
        mobile: form.mobile || null,
        age: form.age ? parseInt(form.age) : null,
        chief_complaint: form.chief_complaint || null,
        brought_by: form.brought_by || null,
        eta_minutes: form.eta_minutes ? parseInt(form.eta_minutes) : null,
        caller_name: form.caller_name || null,
        caller_mobile: form.caller_mobile || null,
        doctor_id: form.doctor_id ? parseInt(form.doctor_id) : null,
        department_id: form.department_id ? parseInt(form.department_id) : null,
        ward_id: form.ward_id ? parseInt(form.ward_id) : null,
        bed_id: form.bed_id ? parseInt(form.bed_id) : null,
        initial_vitals: Object.keys(vitals).length ? vitals : null,
      })
      setDone(r)
      window.dispatchEvent(new CustomEvent('bharatcliniq:refresh'))
    } catch (e) {
      setError(e?.message || 'Registration failed')
    }
    setSaving(false)
  }

  const sendAlert = async () => {
    if (!done) return
    setAlertSending(true)
    try {
      const r = await api.post(`/inpatient/emergency/${done.id}/alert`)
      setDone(r)
      setAlertSent(true)
      window.dispatchEvent(new CustomEvent('bharatcliniq:refresh'))
    } catch (e) {
      alert(e?.message || 'Failed to send alert')
    }
    setAlertSending(false)
  }

  const markArrived = async () => {
    if (!done) return
    try {
      await api.post(`/inpatient/emergency/${done.id}/arrived`)
      navigate('/admissions')
    } catch (e) {
      alert(e?.message || 'Failed')
    }
  }

  const triageConfig = TRIAGE.find(t => t.id === (done?.triage_level || form.triage_level))

  // ── Success screen ─────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        {/* Status card */}
        <div className={`rounded-2xl border-2 p-6 ${triageConfig?.light || 'bg-orange-50 border-orange-300'}`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${triageConfig?.bg || 'bg-orange-500'} text-white mb-2`}>
                {triageConfig?.label || done.triage_level}
              </div>
              <h2 className="text-xl font-bold text-gray-900">{done.admission_number}</h2>
              <p className="text-sm text-gray-600 mt-0.5">EN ROUTE — {done.patient_name}</p>
            </div>
            <div className="text-right text-xs text-gray-500">
              {done.eta_minutes && <div className="flex items-center gap-1 justify-end"><Clock size={11} /> {done.eta_minutes} min ETA</div>}
              {done.brought_by && <div className="capitalize mt-0.5">{done.brought_by.replace('_', ' ')}</div>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {done.doctor_name && (
              <div className="bg-white/70 rounded-xl px-3 py-2">
                <div className="text-xs text-gray-500">Doctor</div>
                <div className="font-semibold">{done.doctor_name}</div>
              </div>
            )}
            {(done.ward_name || done.bed_number) && (
              <div className="bg-white/70 rounded-xl px-3 py-2">
                <div className="text-xs text-gray-500">Ward / Bed</div>
                <div className="font-semibold">{done.ward_name || '—'} / {done.bed_number || '—'}</div>
              </div>
            )}
            {done.chief_complaint && (
              <div className="bg-white/70 rounded-xl px-3 py-2 col-span-2">
                <div className="text-xs text-gray-500">Chief Complaint</div>
                <div className="font-medium">{done.chief_complaint}</div>
              </div>
            )}
            {done.initial_vitals && Object.keys(done.initial_vitals).length > 0 && (
              <div className="bg-white/70 rounded-xl px-3 py-2 col-span-2">
                <div className="text-xs text-gray-500 mb-1">Initial Vitals</div>
                <div className="flex flex-wrap gap-3 text-xs font-mono font-bold">
                  {done.initial_vitals.bp && <span>BP {done.initial_vitals.bp}</span>}
                  {done.initial_vitals.pulse && <span>Pulse {done.initial_vitals.pulse}</span>}
                  {done.initial_vitals.spo2 && <span>SpO₂ {done.initial_vitals.spo2}%</span>}
                  {done.initial_vitals.temp && <span>Temp {done.initial_vitals.temp}°C</span>}
                  {done.initial_vitals.gcs && <span>GCS {done.initial_vitals.gcs}</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Alert status */}
        {done.alert_sent_at && !done.alert_ack_at && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <Bell size={16} className="text-red-500 animate-pulse" />
            <div className="text-sm text-red-700 font-medium">Alert sent — waiting for team acknowledgement</div>
          </div>
        )}
        {done.alert_ack_at && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircle2 size={16} className="text-green-600" />
            <div className="text-sm text-green-700 font-medium">Alert accepted by {done.alert_ack_by_name}</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {/* Send Alert */}
          {!done.alert_sent_at || done.alert_ack_at ? (
            <button onClick={sendAlert} disabled={alertSending}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-50 shadow-lg shadow-red-200">
              {alertSending ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
              {alertSent ? 'Re-Send Alert' : 'Send Alert to Care Team'}
            </button>
          ) : (
            <button disabled className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-100 text-red-400 rounded-xl font-bold text-sm cursor-not-allowed">
              <Bell size={16} className="animate-pulse" /> Alert Sent — Awaiting Ack
            </button>
          )}

          <button onClick={() => setEditOpen(true)}
            className="px-5 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
            <Edit3 size={14} /> Edit Details
          </button>

          <button onClick={markArrived}
            className="px-5 py-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 flex items-center gap-2">
            <LogIn size={14} /> Mark Arrived
          </button>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={() => { setDone(null); setForm(defaultForm()); setAlertSent(false) }}
            className="flex-1 py-2.5 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600">
            Register Another Emergency
          </button>
          <button onClick={() => navigate('/')}
            className="flex-1 py-2.5 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600">
            Back to Dashboard
          </button>
        </div>

        {editOpen && (
          <EditEmergencyModal
            emrg={done}
            doctors={doctors}
            departments={departments}
            wards={wards}
            beds={beds}
            onDone={async () => {
              setEditOpen(false)
              try {
                const updated = await api.get(`/inpatient/admissions/${done.id}`)
                if (updated) {
                  const r = await api.get('/inpatient/emergency')
                  const found = (Array.isArray(r) ? r : []).find(e => e.id === done.id)
                  if (found) setDone(found)
                }
              } catch {}
            }}
            onClose={() => setEditOpen(false)}
          />
        )}
      </div>
    )
  }

  // ── Registration form ──────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" /> Emergency Pre-Registration
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Register while patient is en route — all fields fully editable after save</p>
        </div>
      </div>

      {/* Triage */}
      <Section title="1 — Triage Severity">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TRIAGE.map(t => (
            <button key={t.id} onClick={() => set('triage_level', t.id)}
              className={`flex flex-col items-center py-4 px-2 rounded-2xl border-2 transition font-bold text-sm ${
                form.triage_level === t.id
                  ? `${t.bg} text-white border-transparent shadow-lg`
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
              }`}>
              <span className="text-base">{t.label}</span>
              <span className={`text-xs font-normal mt-0.5 ${form.triage_level === t.id ? 'text-white/80' : 'text-gray-400'}`}>{t.sub}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Patient Identity */}
      <Section title="2 — Patient Identity (can be partial)">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Name <span className="text-gray-400 font-normal">(leave blank if unidentified)</span></label>
            <input className={inputCls} value={form.patient_name} onChange={e => set('patient_name', e.target.value)}
              placeholder="Full name or leave blank for unidentified" />
          </div>
          <div>
            <label className={labelCls}>Approximate Age</label>
            <input type="number" className={inputCls} value={form.age} onChange={e => set('age', e.target.value)} placeholder="Years" />
          </div>
          <div>
            <label className={labelCls}>Gender</label>
            <select className={inputCls} value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option value="">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Mobile Number <span className="text-gray-400 font-normal">(if known)</span></label>
            <input className={inputCls} value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="10-digit mobile" />
          </div>
        </div>
      </Section>

      {/* Emergency Details */}
      <Section title="3 — Emergency Details">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Chief Complaint / Injury Description *</label>
            <textarea className={inputCls} rows={2} value={form.chief_complaint}
              onChange={e => set('chief_complaint', e.target.value)}
              placeholder="e.g. Road traffic accident, chest pain, severe burns…" />
          </div>
          <div>
            <label className={labelCls}>Brought By</label>
            <div className="flex flex-wrap gap-2">
              {BROUGHT_BY.map(b => (
                <button key={b.v} onClick={() => set('brought_by', b.v)}
                  className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition ${
                    form.brought_by === b.v ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:border-red-200'
                  }`}>{b.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>ETA (minutes)</label>
            <input type="number" min="1" max="120" className={inputCls} value={form.eta_minutes}
              onChange={e => set('eta_minutes', e.target.value)} placeholder="e.g. 8" />
          </div>
          <div>
            <label className={labelCls}>Caller / Informant Name</label>
            <input className={inputCls} value={form.caller_name} onChange={e => set('caller_name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Caller Mobile</label>
            <input className={inputCls} value={form.caller_mobile} onChange={e => set('caller_mobile', e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Initial Vitals */}
      <Section title="4 — Initial Vitals (from paramedic / caller — optional)">
        <div className="grid grid-cols-3 gap-3">
          {[
            ['bp',    'BP (mmHg)',    '120/80'],
            ['pulse', 'Pulse (bpm)',  '72'],
            ['spo2',  'SpO₂ (%)',     '98'],
            ['temp',  'Temp (°C)',    '37.0'],
            ['rr',    'RR (/min)',    '16'],
            ['gcs',   'GCS (3–15)',   '15'],
          ].map(([k, lbl, ph]) => (
            <div key={k}>
              <label className={labelCls}>{lbl}</label>
              <input className={inputCls} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} />
            </div>
          ))}
        </div>
      </Section>

      {/* Resource Assignment */}
      <Section title="5 — Pre-Assign Resources">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Department</label>
            <select className={inputCls} value={form.department_id}
              onChange={e => { set('department_id', e.target.value); set('ward_id', ''); set('bed_id', '') }}>
              <option value="">Select department…</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Assigned Doctor</label>
            <select className={inputCls} value={form.doctor_id} onChange={e => set('doctor_id', e.target.value)}>
              <option value="">Select doctor…</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` — ${d.specialty}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Ward</label>
            <select className={inputCls} value={form.ward_id}
              onChange={e => { set('ward_id', e.target.value); set('bed_id', '') }}>
              <option value="">Select ward…</option>
              {filteredWards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Bed (pre-assign)</label>
            <select className={inputCls} value={form.bed_id} onChange={e => set('bed_id', e.target.value)}
              disabled={!form.ward_id}>
              <option value="">Select bed…</option>
              {filteredBeds.map(b => <option key={b.id} value={b.id}>{b.bed_number} — {b.bed_type}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      <button onClick={submit} disabled={saving || !form.triage_level}
        className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold text-base hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-red-200 transition">
        {saving ? <Loader2 size={20} className="animate-spin" /> : <AlertTriangle size={20} />}
        Pre-Register Emergency — EN ROUTE
      </button>
    </div>
  )
}
