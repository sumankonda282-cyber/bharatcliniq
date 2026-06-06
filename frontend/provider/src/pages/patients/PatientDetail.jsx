import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { patientsApi, tagsApi } from '../../api'
import { cachedFetch, cacheInvalidate, TTL } from '../../utils/cache'
import { PageLoader } from '../../components/ui/Spinner'
import {
  ArrowLeft, ChevronDown, ChevronUp, Lock, User,
  Phone, Mail, MapPin, Tag, Plus, X, Edit2, Save,
} from 'lucide-react'
import AllergySearch from '../../components/AllergySearch'

// ── TagInput (same 3-tier system as PatientList) ──────────────────────────────
function TagInput({ patientId, currentTags, onTagsChange }) {
  const [open, setOpen]         = useState(false)
  const [saved, setSaved]       = useState([])
  const [suggestions, setSugs]  = useState([])
  const [freeMode, setFreeMode] = useState(false)
  const [freeText, setFreeText] = useState('')
  const [saveToClinic, setSave] = useState(false)
  const [loading, setLoading]   = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    cachedFetch(
      'tag_suggestions',
      () => tagsApi.getSuggestions(),
      r => { setSaved(r.saved || []); setSugs(r.suggestions || []) },
      TTL.MEDIUM
    ).catch(() => {})
  }, [open])

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const isAssigned = (name) => currentTags.some(t => t.tag_name === name)

  const assign = async (tagName, icd10 = null, save = false) => {
    if (isAssigned(tagName)) return
    setLoading(true)
    try {
      const tag = await patientsApi.assignTag(patientId, { tag_name: tagName, icd10_code: icd10, save_to_clinic: save })
      onTagsChange([...currentTags, tag])
    } finally { setLoading(false) }
  }

  const remove = async (tagId) => {
    await patientsApi.removeTag(patientId, tagId)
    onTagsChange(currentTags.filter(t => t.id !== tagId))
  }

  const submitFree = async () => {
    if (!freeText.trim()) return
    await assign(freeText.trim(), null, saveToClinic)
    setFreeText(''); setSave(false); setFreeMode(false)
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex flex-wrap items-center gap-1">
        {currentTags.map(t => (
          <span key={t.id} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
            {t.tag_name}
            <button onClick={() => remove(t.id)} className="hover:text-red-500 ml-0.5"><X size={10} /></button>
          </span>
        ))}
        <button
          onClick={() => { setOpen(v => !v); setFreeMode(false) }}
          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs text-gray-400 border border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-500"
        >
          <Tag size={10} /><span>Add</span>
        </button>
      </div>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {saved.length > 0 && (
            <div className="px-3 pt-3 pb-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Saved Tags</div>
              <div className="flex flex-wrap gap-1">
                {saved.map(t => (
                  <button key={t.id} disabled={isAssigned(t.tag_name) || loading} onClick={() => assign(t.tag_name, t.icd10_code)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${isAssigned(t.tag_name) ? 'bg-blue-100 text-blue-700 border-blue-200 opacity-50 cursor-default' : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700'}`}>
                    {isAssigned(t.tag_name) ? '✓ ' : ''}{t.tag_name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {suggestions.length > 0 && (
            <div className={`px-3 py-2 ${saved.length > 0 ? 'border-t border-gray-100' : 'pt-3'}`}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Suggested</div>
              <div className="flex flex-wrap gap-1">
                {suggestions.map(s => (
                  <button key={s.tag} disabled={isAssigned(s.tag) || loading} onClick={() => assign(s.tag, s.icd10)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${isAssigned(s.tag) ? 'bg-blue-100 text-blue-700 border-blue-200 opacity-50 cursor-default' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600'}`}>
                    {isAssigned(s.tag) ? '✓ ' : ''}{s.tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-gray-100 px-3 py-2">
            {!freeMode ? (
              <button onClick={() => setFreeMode(true)} className="w-full text-left text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 py-1">
                <Plus size={12} /> Free Tag
              </button>
            ) : (
              <div className="space-y-2">
                <input autoFocus className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Type condition…" value={freeText} onChange={e => setFreeText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitFree()} />
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={saveToClinic} onChange={e => setSave(e.target.checked)} />
                  Save to clinic tag library
                </label>
                <div className="flex gap-2">
                  <button onClick={() => { setFreeMode(false); setFreeText('') }} className="flex-1 text-xs py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">Cancel</button>
                  <button onClick={submitFree} disabled={!freeText.trim() || loading} className="flex-1 text-xs py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">Add</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Accordion section ─────────────────────────────────────────────────────────
function Section({ title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900">{title}</span>
          {badge != null && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{badge}</span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  )
}

// ── Visit row ─────────────────────────────────────────────────────────────────
function VisitRow({ visit }) {
  const [open, setOpen] = useState(false)

  const VISIT_TYPE_COLORS = {
    fresh:    'bg-blue-50 text-blue-700',
    followup: 'bg-purple-50 text-purple-700',
    review:   'bg-teal-50 text-teal-700',
    emergency:'bg-red-50 text-red-700',
  }

  const fields = [
    ['Chief Complaint / Reason',  visit.triage_complaint || visit.reason_for_visit],
    ['Patient Complaints',        visit.patient_complaints],
    ['Past History',              visit.past_history],
    ['Investigations & Findings', visit.investigations_findings],
    ['Medications Prescribed',    visit.medications_prescribed],
    ['Discharge Assessment',      visit.discharge_assessment],
    ['Cautions & Follow-up',      visit.cautions_followup],
  ].filter(([, v]) => v)

  const hasContent = fields.length > 0 || (visit.prescriptions && visit.prescriptions.length > 0) || (visit.lab_results && visit.lab_results.length > 0)

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => hasContent && setOpen(v => !v)}
        className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors ${hasContent ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{visit.visit_date}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${VISIT_TYPE_COLORS[visit.visit_type] || 'bg-gray-100 text-gray-600'}`}>
            {visit.visit_type || 'Fresh'}
          </span>
          {visit.is_locked && <span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700">Completed</span>}
          <span className="text-xs text-gray-400">{visit.doctor_name}</span>
          {visit.vitals && (
            <span className="text-xs text-gray-400 font-mono">
              {visit.vitals.bp && `BP ${visit.vitals.bp}`}
              {visit.vitals.pulse && ` · P ${visit.vitals.pulse}`}
              {visit.vitals.spo2 && ` · SpO₂ ${visit.vitals.spo2}%`}
            </span>
          )}
          {!hasContent && <span className="text-xs text-gray-300 italic">No notes recorded</span>}
        </div>
        {hasContent && (open ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />)}
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-3">
          {/* Vitals full */}
          {visit.vitals && (
            <div className="flex flex-wrap gap-3 text-xs bg-gray-50 rounded-lg px-3 py-2">
              {visit.vitals.bp    && <span><span className="text-gray-400">BP</span> {visit.vitals.bp} mmHg</span>}
              {visit.vitals.pulse && <span><span className="text-gray-400">Pulse</span> {visit.vitals.pulse} bpm</span>}
              {visit.vitals.temp  && <span><span className="text-gray-400">Temp</span> {visit.vitals.temp}°F</span>}
              {visit.vitals.spo2  && <span><span className="text-gray-400">SpO₂</span> {visit.vitals.spo2}%</span>}
              {visit.vitals.weight && <span><span className="text-gray-400">Wt</span> {visit.vitals.weight} kg</span>}
              {visit.vitals.sugar  && <span><span className="text-gray-400">BSL</span> {visit.vitals.sugar} mg/dL</span>}
            </div>
          )}

          {/* Clinical fields */}
          {fields.map(([label, value]) => (
            <div key={label}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{value}</div>
            </div>
          ))}

          {/* Prescriptions */}
          {visit.prescriptions && visit.prescriptions.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Prescriptions</div>
              <ul className="list-disc list-inside space-y-0.5">
                {visit.prescriptions.map((rx, i) => (
                  <li key={i} className="text-sm text-gray-700">{rx}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Lab results */}
          {visit.lab_results && visit.lab_results.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Lab Results</div>
              <div className="flex flex-wrap gap-2">
                {visit.lab_results.map((lab, i) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded border ${lab.status === 'abnormal' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {lab.test}{lab.result ? `: ${lab.result}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Edit form ─────────────────────────────────────────────────────────────────
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

function EditModal({ patient, onSave, onClose }) {
  const [form, setForm] = useState({
    full_name: patient.full_name || '',
    mobile:    patient.mobile    || '',
    email:     patient.email     || '',
    date_of_birth: patient.date_of_birth || '',
    gender:    patient.gender    || '',
    blood_group: patient.blood_group || '',
    allergies: patient.allergies || '',
    address:   patient.address   || '',
    city:      patient.city      || '',
    state:     patient.state     || '',
    pincode:   patient.pincode   || '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  const F = ({ label, k, type = 'text' }) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Edit Patient</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <F label="Full Name"     k="full_name" />
          <F label="Mobile"        k="mobile" type="tel" />
          <F label="Email"         k="email" type="email" />
          <F label="Date of Birth" k="date_of_birth" type="date" />
          <div>
            <label className="label">Gender</label>
            <select className="input" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
              <option value="">—</option>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
          </div>
          <div>
            <label className="label">Blood Group</label>
            <select className="input" value={form.blood_group} onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}>
              <option value="">—</option>
              {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="col-span-2"><F label="Allergies" k="allergies" /></div>
          <div className="col-span-2"><F label="Address" k="address" /></div>
          <F label="City"    k="city" />
          <F label="State"   k="state" />
          <F label="Pincode" k="pincode" />
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">
            <Save size={14} />{saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PatientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [allergiesCoded, setAllergiesCoded] = useState([])

  const load = () => {
    setLoading(true)
    cachedFetch(
      `patient_clinical_${id}`,
      () => patientsApi.getClinical(id),
      d => {
        setData(d)
        // Parse coded allergies if available
        try {
          const coded = d?.demographics?.allergies_coded
          if (coded) setAllergiesCoded(typeof coded === 'string' ? JSON.parse(coded) : coded)
        } catch (_) {}
        setLoading(false)
      },
      TTL.SHORT
    ).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleSave = async (form) => {
    await patientsApi.update(id, form)
    await cacheInvalidate(`patient_clinical_${id}`)
    setEditing(false)
    load()
  }

  const updateTags = (tags) => setData(d => ({ ...d, tags }))

  if (loading) return <PageLoader />
  if (!data) return <div className="p-8 text-gray-500">Patient not found</div>

  const { demographics: d, tags, visits, external } = data
  const age = d.age != null ? (d.age > 0 ? `${d.age} yrs` : '< 1 yr') : '—'

  return (
    <div className="max-w-4xl">
      {editing && (
        <EditModal patient={d} onSave={handleSave} onClose={() => setEditing(false)} />
      )}

      {/* Page header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/patients')} className="btn-secondary p-2"><ArrowLeft size={16} /></button>
          <div>
            <h1 className="page-title">{d.full_name}</h1>
            <p className="text-sm text-gray-500 font-mono">{d.clinic_patient_id}</p>
          </div>
        </div>
        <button onClick={() => setEditing(true)} className="btn-secondary"><Edit2 size={15} />Edit</button>
      </div>

      {/* Summary strip */}
      <div className="card p-4 mb-5 flex flex-wrap items-start gap-6">
        <div className="flex gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Age / Gender</div>
            <div className="font-medium">{age}{d.gender ? ` / ${d.gender}` : ''}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Blood Group</div>
            {d.blood_group
              ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">{d.blood_group}</span>
              : <span className="text-gray-300">—</span>}
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Allergies</div>
            <AllergySearch
              allergies={allergiesCoded}
              onChange={async (newList) => {
                setAllergiesCoded(newList)
                try {
                  await patientsApi.update(id, { allergies_coded: JSON.stringify(newList) })
                  await cacheInvalidate(`patient_clinical_${id}`)
                } catch (_) {}
              }}
            />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 mb-1">Conditions</div>
          <TagInput patientId={parseInt(id)} currentTags={tags || []} onTagsChange={updateTags} />
        </div>
      </div>

      {/* Section 1 — Demographics (collapsed) */}
      <Section title="Demographics" defaultOpen={false}>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {[
            [Phone, 'Mobile',    d.mobile],
            [Mail,  'Email',     d.email],
            [MapPin,'Address',   [d.address, d.city, d.state, d.pincode].filter(Boolean).join(', ')],
            [User,  'Emergency', d.emergency_contact ? `${d.emergency_contact} — ${d.emergency_phone || ''}` : null],
          ].map(([Icon, label, value]) => value ? (
            <div key={label} className="flex items-start gap-2">
              <Icon size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-400">{label}</div>
                <div className="text-gray-700">{value}</div>
              </div>
            </div>
          ) : null)}
          {!d.mobile && !d.email && !d.address && (
            <p className="col-span-2 text-gray-400 text-center py-4">No contact details on file</p>
          )}
        </div>
      </Section>

      {/* Section 2 — Visit History */}
      <Section title="Visit History" badge={visits?.length ?? 0} defaultOpen={true}>
        {visits && visits.length > 0
          ? visits.map((v) => <VisitRow key={v.appointment_id} visit={v} />)
          : <p className="text-center text-gray-400 py-8">No visits recorded</p>
        }
      </Section>

      {/* Section 3 — External Encounters */}
      {external && external.length > 0 && (
        <Section title="External Encounters" badge={external.length} defaultOpen={false}>
          <div className="divide-y divide-gray-100">
            {external.map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                <Lock size={14} className="text-gray-400 shrink-0" />
                <span className="text-gray-700">{e.clinic_name}</span>
                <span className="text-gray-400 text-xs ml-auto">{e.visit_date}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
