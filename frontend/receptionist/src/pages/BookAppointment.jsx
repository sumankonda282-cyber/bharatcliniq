import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, CalendarPlus, Search, Loader2, CheckCircle2, Phone, Footprints, Globe, X } from 'lucide-react'
import api from '../api/client'

const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10)

const SOURCES = [
  { value: 'offline', label: 'Walk-in',  icon: Footprints },
  { value: 'phone',   label: 'Phone',    icon: Phone },
  { value: 'online',  label: 'Online',   icon: Globe },
]

const defaultForm = () => ({
  doctor_id: '', appointment_date: istToday(), appointment_time: '',
  visit_type: 'fresh', mode: 'offline', fee: '', reason: '',
})

export default function BookAppointment() {
  const navigate = useNavigate()
  const location = useLocation()

  const [doctors, setDoctors] = useState([])
  const [patient, setPatient] = useState(location.state?.patient || null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const timer = useRef(null)

  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    api.get('/clinic/doctors').then(r => setDoctors(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await api.get('/patients', { params: { search: q.trim(), limit: 8 } })
        setResults(Array.isArray(r) ? r : [])
      } catch { setResults([]) }
      setSearching(false)
    }, 300)
    return () => timer.current && clearTimeout(timer.current)
  }, [q])

  const pickDoctor = (id) => {
    set('doctor_id', id)
    const d = doctors.find(x => String(x.id) === String(id))
    if (d && !form.fee) set('fee', d.consultation_fee || '')
  }

  const submit = async () => {
    if (!patient) { setError('Select a patient first'); return }
    if (!form.doctor_id) { setError('Select a doctor'); return }
    if (!form.appointment_date || !form.appointment_time) { setError('Pick date and time'); return }
    setSaving(true); setError('')
    try {
      const r = await api.post('/appointments', {
        patient_id: patient.id,
        doctor_id: parseInt(form.doctor_id),
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        visit_type: form.visit_type,
        mode: form.mode,
        fee: form.fee === '' ? null : parseFloat(form.fee),
        reason: form.reason || null,
      })
      setDone(r)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Booking failed')
    }
    setSaving(false)
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/front-desk')}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarPlus size={20} className="text-emerald-600" /> Book Appointment
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Search or confirm patient, then pick doctor and slot</p>
        </div>
      </div>

      {done ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <CheckCircle2 size={52} className="mx-auto text-emerald-500 mb-4" />
          <p className="text-xl font-bold text-gray-800">Appointment Booked!</p>
          <p className="text-sm text-gray-500 mt-2">
            {patient?.full_name} · {done.appointment_date} at {done.appointment_time}
          </p>
          {done.token_number != null && (
            <div className="mt-4">
              <span className="text-sm text-gray-500">Token </span>
              <span className="text-3xl font-bold text-blue-700">#{done.token_number}</span>
            </div>
          )}
          <div className="flex justify-center gap-3 mt-8">
            <button onClick={() => navigate('/front-desk')}
              className="px-5 py-2.5 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 font-medium">
              Back to Front Desk
            </button>
            <button onClick={() => { setDone(null); setPatient(null); setForm(defaultForm()); setQ('') }}
              className="px-5 py-2.5 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-medium">
              Book Another
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">

          {/* Patient Selection */}
          {!patient ? (
            <div>
              <label className={labelCls}>Find Patient (name / BHID / mobile)</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                {searching && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
                <input autoFocus className={inputCls + ' pl-9'} value={q}
                  onChange={e => setQ(e.target.value)} placeholder="Start typing…" />
              </div>
              <div className="mt-2 divide-y divide-gray-50 max-h-64 overflow-auto rounded-xl border border-gray-100">
                {results.map(p => (
                  <button key={p.id} onClick={() => setPatient(p)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center justify-between transition">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{p.full_name}</p>
                      <p className="text-xs text-gray-400">{p.bh_id || p.clinic_patient_id} · {p.mobile || 'no mobile'}</p>
                    </div>
                    <span className="text-xs text-gray-400">{p.age != null ? `${p.age}y` : ''} {p.gender || ''}</span>
                  </button>
                ))}
                {q.trim().length >= 2 && !searching && results.length === 0 && (
                  <p className="px-4 py-4 text-sm text-gray-400">
                    No patient found — <button onClick={() => navigate('/front-desk/register')} className="text-blue-600 hover:underline">Register them first</button>
                  </p>
                )}
                {q.trim().length < 2 && (
                  <p className="px-4 py-4 text-sm text-gray-400">Type at least 2 characters to search</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">{patient.full_name}</p>
                <p className="text-xs text-gray-500">
                  {patient.bh_id || patient.clinic_patient_id} · Mobile: <span className="font-mono font-medium text-gray-700">{patient.mobile || '—'}</span>
                </p>
              </div>
              <button onClick={() => setPatient(null)} className="text-xs text-emerald-700 hover:underline font-medium">Change</button>
            </div>
          )}

          {patient && (
            <>
              {/* Visit Mode */}
              <div>
                <label className={labelCls}>How did they come?</label>
                <div className="grid grid-cols-3 gap-2">
                  {SOURCES.map(s => {
                    const Icon = s.icon
                    const on = form.mode === s.value
                    return (
                      <button key={s.value} type="button" onClick={() => set('mode', s.value)}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm border transition ${on
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'}`}>
                        <Icon size={14} /> {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Appointment Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Doctor</label>
                  <select className={inputCls} value={form.doctor_id} onChange={e => pickDoctor(e.target.value)}>
                    <option value="">Select doctor…</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` — ${d.specialty}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Date</label>
                  <input type="date" className={inputCls} value={form.appointment_date}
                    onChange={e => set('appointment_date', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Time</label>
                  <input type="time" className={inputCls} value={form.appointment_time}
                    onChange={e => set('appointment_time', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Visit Type</label>
                  <select className={inputCls} value={form.visit_type} onChange={e => set('visit_type', e.target.value)}>
                    <option value="fresh">Fresh</option>
                    <option value="followup">Follow-up</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Consultation Fee (₹)</label>
                  <input type="number" className={inputCls} value={form.fee}
                    onChange={e => set('fee', e.target.value)} placeholder="0" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Reason / Chief Complaint (optional)</label>
                  <input className={inputCls} value={form.reason}
                    onChange={e => set('reason', e.target.value)} placeholder="e.g. fever since 2 days" />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3">{error}</p>}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => navigate('/front-desk')}
              className="px-5 py-2.5 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 font-medium">
              Cancel
            </button>
            <button onClick={submit} disabled={saving || !patient}
              className="px-6 py-2.5 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 font-medium">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Book Appointment
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
