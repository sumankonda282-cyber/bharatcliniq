import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, Loader2, CheckCircle2, Copy, CalendarPlus, X } from 'lucide-react'
import api from '../api/client'
import TermSearch from '../components/TermSearch'

const STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana',
  'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
]

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-']

const empty = {
  full_name: '', mobile: '', date_of_birth: '', gender: '', email: '',
  address: '', city: '', state: '', pincode: '', blood_group: '',
  emergency_contact_name: '', emergency_contact_phone: '', abha_id: '',
}

export default function RegisterPatient() {
  const navigate = useNavigate()
  const [form, setForm] = useState(empty)
  const [doctors, setDoctors] = useState([])
  const [showMedical, setShowMedical] = useState(false)
  const [specialtyDoctor, setSpecialtyDoctor] = useState('')
  const [conditionOptions, setConditionOptions] = useState([])
  const [conditionsLoading, setConditionsLoading] = useState(false)
  const [checked, setChecked] = useState([])
  const [extraConditions, setExtraConditions] = useState([])
  const [allergies, setAllergies] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    api.get('/clinic/doctors').then(r => setDoctors(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!showMedical) return
    const doc = doctors.find(d => String(d.id) === String(specialtyDoctor))
    setConditionsLoading(true)
    api.get('/terminology/conditions', { params: { specialty: doc?.specialty || '', limit: 14 } })
      .then(r => setConditionOptions(r?.conditions || []))
      .catch(() => setConditionOptions([]))
      .finally(() => setConditionsLoading(false))
  }, [showMedical, specialtyDoctor, doctors])

  const toggleCondition = (c) => {
    setChecked(prev => prev.some(x => x.display === c.display)
      ? prev.filter(x => x.display !== c.display)
      : [...prev, { display: c.display, code: c.code }])
  }

  const submit = async () => {
    if (!form.full_name.trim()) { setError('Patient name is required'); return }
    if (!form.mobile.trim()) { setError('Mobile number is required'); return }
    setSaving(true); setError('')
    try {
      const payload = { ...form }
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
      payload.allergies = allergies.length ? allergies.map(a => a.display).join(', ') : null
      const p = await api.post('/patients', payload)
      const allConditions = [...checked, ...extraConditions]
      for (const c of allConditions) {
        try { await api.post(`/patients/${p.id}/tags`, { tag_name: c.display, icd10_code: c.code || null }) } catch {}
      }
      setCreated(p)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Registration failed')
    }
    setSaving(false)
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

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
            <UserPlus size={20} className="text-blue-600" /> Register New Patient
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Fill in patient details — BHID is assigned automatically</p>
        </div>
      </div>

      {created ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <CheckCircle2 size={52} className="mx-auto text-emerald-500 mb-4" />
          <p className="text-xl font-bold text-gray-800">{created.full_name}</p>
          <p className="text-sm text-gray-400 mt-1 mb-5">Successfully registered</p>
          <div className="inline-flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-6 py-4 mb-6">
            <div>
              <p className="text-xs text-blue-400 font-medium mb-1">BHarath Health ID</p>
              <span className="font-mono text-2xl font-bold text-blue-700">{created.bh_id || '—'}</span>
            </div>
            <button onClick={() => navigator.clipboard?.writeText(created.bh_id || '')}
              className="p-2 rounded-lg hover:bg-blue-100 text-blue-500" title="Copy BHID">
              <Copy size={16} />
            </button>
          </div>
          {created.clinic_patient_id && (
            <p className="text-xs text-gray-400 mb-6">Clinic ID: {created.clinic_patient_id}</p>
          )}
          <div className="flex justify-center gap-3">
            <button onClick={() => navigate('/front-desk')}
              className="px-5 py-2.5 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 font-medium">
              Back to Front Desk
            </button>
            <button onClick={() => navigate('/front-desk/book', { state: { patient: created } })}
              className="px-5 py-2.5 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-medium flex items-center gap-2">
              <CalendarPlus size={15} /> Book Appointment
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          {/* Personal Details */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Personal Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Full Name *</label>
                <input className={inputCls} value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Patient full name" />
              </div>
              <div>
                <label className={labelCls}>Mobile *</label>
                <input className={inputCls} value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="10-digit mobile" />
              </div>
              <div>
                <label className={labelCls}>Date of Birth</label>
                <input type="date" className={inputCls} value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Gender</label>
                <select className={inputCls} value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">Select…</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Blood Group</label>
                <select className={inputCls} value={form.blood_group} onChange={e => set('blood_group', e.target.value)}>
                  <option value="">Unknown</option>
                  {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} placeholder="For patient portal access" />
              </div>
              <div>
                <label className={labelCls}>ABHA ID</label>
                <input className={inputCls} value={form.abha_id} onChange={e => set('abha_id', e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label className={labelCls}>City</label>
                <input className={inputCls} value={form.city} onChange={e => set('city', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>State</label>
                <select className={inputCls} value={form.state} onChange={e => set('state', e.target.value)}>
                  <option value="">Select…</option>
                  {STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Pincode</label>
                <input className={inputCls} value={form.pincode} onChange={e => set('pincode', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Address</label>
                <input className={inputCls} value={form.address} onChange={e => set('address', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Emergency Contact Name</label>
                <input className={inputCls} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Emergency Contact Phone</label>
                <input className={inputCls} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              BHID is assigned automatically on save. The patient can sign up on the patient portal using this mobile — records link via BHID.
            </p>
          </div>

          {/* Medical Details (optional) */}
          <div className="border-t border-gray-100 pt-5">
            <button onClick={() => setShowMedical(s => !s)}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              {showMedical ? '− Hide medical details' : '+ Add medical details (optional)'}
            </button>

            {showMedical && (
              <div className="mt-4 space-y-5">
                <div>
                  <label className={labelCls}>Likely consulting doctor (switches condition list)</label>
                  <select className={inputCls} value={specialtyDoctor} onChange={e => setSpecialtyDoctor(e.target.value)}>
                    <option value="">General</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` — ${d.specialty}` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Known Conditions</label>
                  {conditionsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                      <Loader2 size={14} className="animate-spin" /> Loading condition list…
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {conditionOptions.map(c => {
                        const on = checked.some(x => x.display === c.display)
                        return (
                          <button key={c.id} type="button" onClick={() => toggleCondition(c)}
                            className={`px-3 py-1.5 rounded-full text-xs border transition ${on
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                            {c.display}
                          </button>
                        )
                      })}
                      {conditionOptions.length === 0 && <span className="text-xs text-gray-400">No condition list available</span>}
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Other Conditions</label>
                  <TermSearch category="condition" placeholder="e.g. dia → Diabetes mellitus…" allowFreeText
                    onSelect={t => setExtraConditions(prev => prev.some(x => x.display === t.display) ? prev : [...prev, t])} />
                  {extraConditions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {extraConditions.map(c => (
                        <span key={c.display} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs">
                          {c.display}{c.code ? ` (${c.code})` : ''}
                          <button onClick={() => setExtraConditions(prev => prev.filter(x => x.display !== c.display))}><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Allergies</label>
                  <TermSearch category="allergen" placeholder="e.g. peni → Penicillin…" allowFreeText
                    onSelect={t => setAllergies(prev => prev.some(x => x.display === t.display) ? prev : [...prev, t])} />
                  {allergies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {allergies.map(a => (
                        <span key={a.display} className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full text-xs">
                          {a.display}
                          <button onClick={() => setAllergies(prev => prev.filter(x => x.display !== a.display))}><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3">{error}</p>}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => navigate('/front-desk')}
              className="px-5 py-2.5 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 font-medium">
              Cancel
            </button>
            <button onClick={submit} disabled={saving}
              className="px-6 py-2.5 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-medium">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Register Patient
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
