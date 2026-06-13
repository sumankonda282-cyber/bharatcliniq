import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doctorApi, patientsApi, labApi, encountersApi } from '../../api'
import api from '../../api/client'
import { PageLoader } from '../../components/ui/Spinner'
import { useAuth } from '../../contexts/AuthContext'
import {
  ArrowLeft, FileText, Pill, FlaskConical, Save, CheckCircle, Plus, Trash2,
  Lock, PenLine, BedDouble, X, ChevronDown, ChevronRight, Search,
  AlertCircle, Stethoscope, ClipboardList,
} from 'lucide-react'
import VitalsForm from '../../components/clinical/VitalsForm'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const calcAge = dob =>
  dob ? Math.floor((Date.now() - new Date(dob)) / (365.25 * 86400000)) : null

const fmt = (n, fallback = '—') => n ?? fallback

function nextDate(days) {
  return new Date(Date.now() + parseInt(days || 0) * 86400000)
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Demographics Bar ─────────────────────────────────────────────────────────
function DemographicsBar({ patient = {}, vitals = {}, complaint }) {
  const age = calcAge(patient.date_of_birth)
  const genderShort = patient.gender === 'male' ? 'M' : patient.gender === 'female' ? 'F' : patient.gender

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm px-4 md:px-6 py-2.5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        {/* Identity */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-gray-900 truncate">{patient.full_name}</span>
          {patient.clinic_patient_id && (
            <span className="text-xs font-mono text-gray-400 shrink-0">{patient.clinic_patient_id}</span>
          )}
        </div>

        {/* Age / gender / blood group */}
        <div className="flex gap-3 text-gray-600 shrink-0">
          {age != null && <span><span className="text-gray-400">Age</span> <b>{age}y</b></span>}
          {genderShort && <b>{genderShort}</b>}
          {patient.blood_group && (
            <span className="text-red-600 font-bold">{patient.blood_group}</span>
          )}
        </div>

        {/* Vitals */}
        {(vitals.blood_pressure_systolic || vitals.pulse_rate || vitals.oxygen_saturation) && (
          <div className="flex gap-3 text-xs font-mono text-gray-500 shrink-0 border-l pl-4">
            {vitals.blood_pressure_systolic && (
              <span>BP <b className="text-gray-700">{vitals.blood_pressure_systolic}/{vitals.blood_pressure_diastolic}</b></span>
            )}
            {vitals.pulse_rate && <span>P <b className="text-gray-700">{vitals.pulse_rate}</b></span>}
            {vitals.oxygen_saturation && <span>SpO₂ <b className="text-gray-700">{vitals.oxygen_saturation}%</b></span>}
            {vitals.temperature && <span>T <b className="text-gray-700">{vitals.temperature}°F</b></span>}
            {vitals.weight_kg && <span>Wt <b className="text-gray-700">{vitals.weight_kg}kg</b></span>}
            {vitals.blood_sugar && <span>RBS <b className="text-gray-700">{vitals.blood_sugar}</b></span>}
          </div>
        )}

        {/* Allergies */}
        {patient.allergies && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200 shrink-0">
            <AlertCircle size={11} />⚠ {patient.allergies}
          </span>
        )}

        {/* Chief complaint */}
        {complaint && (
          <span className="text-sm text-gray-500 truncate">
            <span className="text-gray-400">CC: </span>{complaint}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Section subheader ────────────────────────────────────────────────────────
function SectionHead({ icon: Icon, title, active, onClick }) {
  return (
    <button
      type="button"
      className={`flex items-center gap-2 w-full text-left py-2 border-b mb-3 transition-colors ${
        active ? 'border-blue-300' : 'border-gray-100 hover:border-gray-300'
      }`}
      onClick={onClick}
    >
      <Icon size={14} className={active ? 'text-blue-600' : 'text-gray-400'} />
      <span className={`text-xs font-bold uppercase tracking-wide ${active ? 'text-blue-700' : 'text-gray-500'}`}>
        {title}
      </span>
      {active && <span className="ml-auto text-xs text-blue-400">▶ Panel open</span>}
    </button>
  )
}

// ─── Chip group (multi or single select) ─────────────────────────────────────
function ChipGroup({ label, options, value, multi = false, onChange }) {
  const selected = multi ? (Array.isArray(value) ? value : []) : value
  return (
    <div className="mb-2.5">
      <div className="text-xs text-gray-500 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const active = multi ? selected.includes(opt) : selected === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() =>
                multi
                  ? onChange(active ? selected.filter(s => s !== opt) : [...selected, opt])
                  : onChange(opt)
              }
              className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                active
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Diagnosis chip ───────────────────────────────────────────────────────────
function DxChip({ code, display, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-medium">
      <span className="font-mono text-blue-400">{code}</span> {display}
      <button type="button" onClick={onRemove} className="hover:text-red-500 ml-0.5">
        <X size={11} />
      </button>
    </span>
  )
}

// ─── Past Visit Card ──────────────────────────────────────────────────────────
function PastVisitCard({ visit }) {
  const [open, setOpen] = useState(false)
  const sn = visit.soap_note || {}
  const vt = visit.vitals   || {}

  const fields = [
    ['Chief Complaint',  sn.reason_for_visit || sn.subjective],
    ['Complaints',       sn.patient_complaints],
    ['Past History',     sn.past_history],
    ['Findings',         sn.investigations_findings || sn.objective],
    ['Assessment',       sn.discharge_assessment   || sn.assessment],
    ['Plan',             sn.cautions_followup      || sn.plan],
  ].filter(([, v]) => v)

  const rxList = visit.prescriptions || []
  const labList = visit.lab_results || []

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {open
          ? <ChevronDown size={15} className="text-gray-400 shrink-0" />
          : <ChevronRight size={15} className="text-gray-400 shrink-0" />
        }
        <div className="flex-1 flex flex-wrap items-center gap-3 text-sm min-w-0">
          <span className="font-medium text-gray-800 shrink-0">
            {visit.appointment_date || visit.visit_date || visit.date}
          </span>
          <span className="text-gray-400 shrink-0">·</span>
          <span className="text-gray-500 shrink-0">{visit.visit_type || visit.appointment_type || 'OPD'}</span>
          {visit.doctor_name && (
            <>
              <span className="text-gray-400 shrink-0">·</span>
              <span className="text-gray-500 shrink-0">Dr. {visit.doctor_name}</span>
            </>
          )}
          {vt.blood_pressure_systolic && (
            <span className="text-xs font-mono text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded shrink-0">
              BP {vt.blood_pressure_systolic}/{vt.blood_pressure_diastolic}
            </span>
          )}
          {(sn.discharge_assessment || sn.assessment) && (
            <span className="text-xs text-gray-400 truncate">
              {(sn.discharge_assessment || sn.assessment).substring(0, 60)}
            </span>
          )}
        </div>
        {(visit.is_locked || sn.is_locked) && (
          <Lock size={12} className="text-gray-300 shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 bg-white space-y-3">
          {/* Vitals */}
          {(vt.blood_pressure_systolic || vt.pulse_rate) && (
            <div className="flex flex-wrap gap-3 text-xs font-mono text-gray-500 bg-gray-50 rounded-lg p-2">
              {vt.blood_pressure_systolic && <span>BP {vt.blood_pressure_systolic}/{vt.blood_pressure_diastolic}</span>}
              {vt.pulse_rate && <span>P {vt.pulse_rate} bpm</span>}
              {vt.oxygen_saturation && <span>SpO₂ {vt.oxygen_saturation}%</span>}
              {vt.temperature && <span>T {vt.temperature}°F</span>}
              {vt.weight_kg && <span>Wt {vt.weight_kg}kg</span>}
            </div>
          )}
          {/* SOAP fields */}
          {fields.map(([label, value]) => (
            <div key={label}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{value}</div>
            </div>
          ))}
          {/* Prescriptions */}
          {rxList.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Medications</div>
              <div className="flex flex-wrap gap-1.5">
                {rxList.map((rx, i) => (
                  <span key={i} className="text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded px-2 py-0.5">
                    <b>{rx.medicine_name || rx.medicine}</b>
                    {rx.dosage && ` · ${rx.dosage}`}
                    {rx.frequency && ` · ${rx.frequency}`}
                    {rx.duration && ` · ${rx.duration}`}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Lab results */}
          {labList.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Lab Results</div>
              <div className="flex flex-wrap gap-1.5">
                {labList.map((r, i) => (
                  <span key={i} className="text-xs bg-gray-50 border border-gray-200 text-gray-600 rounded px-2 py-0.5">
                    {r.test} {r.result && `· ${r.result}`}
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

// ─── Admission Modal (unchanged from original) ────────────────────────────────
function AdmissionModal({ appointmentId, patientId, patientName, prefillDiagnosis, onClose, onCreated }) {
  const { user } = useAuth()
  const [departments, setDepartments] = useState([])
  const [form, setForm] = useState({
    department_id: '', primary_diagnosis: prefillDiagnosis || '',
    expected_discharge: '', urgency: 'routine', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/inpatient/departments').then(r => setDepartments(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  const submit = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      const res = await api.post('/inpatient/admissions', {
        patient_id: patientId,
        admitting_doctor_id: user?.id,
        source_appointment_id: parseInt(appointmentId),
        department_id: form.department_id ? parseInt(form.department_id) : undefined,
        admission_type: 'opd_referred',
        primary_diagnosis: form.primary_diagnosis,
        expected_discharge: form.expected_discharge || undefined,
        urgency: form.urgency,
        notes: form.notes,
      })
      onCreated(res?.admission_number || res?.id || 'created')
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>Advise Admission</h3>
            <p className="text-sm text-gray-500">{patientName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Department</label>
            <select className="input" value={form.department_id}
              onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
              <option value="">Select department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Primary Diagnosis</label>
            <textarea className="input resize-none" rows={2} value={form.primary_diagnosis}
              onChange={e => setForm(f => ({ ...f, primary_diagnosis: e.target.value }))} />
          </div>
          <div>
            <label className="label">Urgency</label>
            <select className="input" value={form.urgency}
              onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}>
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Creating…' : 'Advise Admission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PatientChart() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const autoSaveRef = useRef(null)

  // ── Data
  const [data, setData]         = useState(null)
  const [pastVisits, setPastVisits] = useState([])
  const [loading, setLoading]   = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')
  const [addendumMode, setAddendumMode] = useState(false)
  const [addendumText, setAddendumText] = useState('')
  const [showAdmission, setShowAdmission] = useState(false)

  // ── Clinical notes (7 SOAP fields mapped to our sections)
  const [notes, setNotes] = useState({
    reason_for_visit: '',
    patient_complaints: '',
    past_history: '',
    investigations_findings: '',
    discharge_assessment: '',
    cautions_followup: '',
  })

  // ── Diagnoses (ICD-10 tags)
  const [diagnoses, setDiagnoses]   = useState([])
  const [dxSearch, setDxSearch]     = useState('')
  const [dxResults, setDxResults]   = useState([])

  // ── Orders
  const [labOrders, setLabOrders]         = useState([])
  const [imagingOrders, setImagingOrders] = useState([])
  const [orderNote, setOrderNote]         = useState('')
  const [ordersSaved, setOrdersSaved]     = useState(false)

  // ── Medications
  const [rxItems, setRxItems] = useState([])
  const [rxNotes, setRxNotes] = useState('')

  // ── Plan
  const [followupDays, setFollowupDays] = useState('30')

  // ── Right panel state
  const [activePanel, setActivePanel] = useState(null)
  // 'symptoms' | 'assessment' | 'orders' | 'medications' | 'plan'

  // ── Orders panel
  const [orderTab, setOrderTab]       = useState('lab')
  const [orderSearch, setOrderSearch] = useState('')
  const [orderResults, setOrderResults] = useState([])
  const [orderSearching, setOrderSearching] = useState(false)

  // ── Medications panel
  const [drugSearch, setDrugSearch]     = useState('')
  const [drugResults, setDrugResults]   = useState([])
  const [drugSearching, setDrugSearching] = useState(false)
  const [configDrug, setConfigDrug]     = useState(null)
  const [drugConfig, setDrugConfig]     = useState({
    timing: ['Morning'], frequency: 'OD', duration: '30 days',
    food: 'Before food', counselling: [],
  })
  const [counsellingTips, setCounsellingTips] = useState([])

  // ── Load encounter
  useEffect(() => {
    doctorApi.getEncounter(id)
      .then(r => {
        setData(r)
        const sn = r.soap_note
        if (sn) {
          setNotes({
            reason_for_visit:        sn.reason_for_visit        || sn.subjective || r.triage_complaint || '',
            patient_complaints:      sn.patient_complaints      || '',
            past_history:            sn.past_history            || '',
            investigations_findings: sn.investigations_findings || sn.objective  || '',
            discharge_assessment:    sn.discharge_assessment    || sn.assessment || '',
            cautions_followup:       sn.cautions_followup       || sn.plan       || '',
          })
          setIsLocked(!!sn.is_locked)
        } else if (r.triage_complaint) {
          setNotes(n => ({ ...n, reason_for_visit: r.triage_complaint }))
        }
        // Load past visits
        if (r.patient?.id) {
          patientsApi.getClinical(r.patient.id)
            .then(cr => {
              const raw = cr?.visits || cr?.encounters || []
              setPastVisits(raw.filter(v =>
                String(v.appointment_id) !== String(id) && String(v.id) !== String(id)
              ))
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  // Auto-save every 30s
  useEffect(() => {
    if (isLocked) return
    autoSaveRef.current = setInterval(() => saveDraft(false), 30000)
    return () => clearInterval(autoSaveRef.current)
  }, [notes, isLocked])

  // Diagnosis search
  useEffect(() => {
    if (dxSearch.length < 2) { setDxResults([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/terminology/search', { params: { q: dxSearch, category: 'condition', limit: 8 } })
        setDxResults(Array.isArray(r) ? r : (r?.items || r?.results || []))
      } catch { setDxResults([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [dxSearch])

  // Drug search
  useEffect(() => {
    if (drugSearch.length < 2) { setDrugResults([]); return }
    const t = setTimeout(async () => {
      setDrugSearching(true)
      try {
        const r = await api.get('/terminology/drugs/search', { params: { q: drugSearch, limit: 10 } })
        setDrugResults(Array.isArray(r) ? r : [])
      } catch { setDrugResults([]) }
      finally { setDrugSearching(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [drugSearch])

  // Order search
  useEffect(() => {
    if (orderSearch.length < 2) { setOrderResults([]); return }
    const t = setTimeout(async () => {
      setOrderSearching(true)
      try {
        const r = await labApi.searchTests(orderSearch, orderTab)
        setOrderResults(Array.isArray(r) ? r : [])
      } catch { setOrderResults([]) }
      finally { setOrderSearching(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [orderSearch, orderTab])

  // ── Actions ──────────────────────────────────────────────────────────────────
  const flash = text => { setMsg(text); setTimeout(() => setMsg(''), 3500) }

  const saveDraft = async (showMsg = true) => {
    if (isLocked || !data) return
    try {
      await encountersApi.save({ appointment_id: parseInt(id), ...notes, lock: false })
      if (showMsg) flash('Draft saved')
    } catch (e) {
      if (showMsg) flash('Error saving: ' + e.message)
    }
  }

  const endConsultation = async () => {
    if (!window.confirm('End consultation and lock the record? This cannot be undone.')) return
    setSaving(true)
    try {
      await encountersApi.save({ appointment_id: parseInt(id), ...notes, lock: true })

      if (rxItems.length > 0) {
        await doctorApi.completeEncounter(id, {
          soap: { appointment_id: parseInt(id) },
          prescription: {
            notes: rxNotes,
            items: rxItems.map(rx => ({
              medicine_name: rx.generic,
              dosage: rx.config.timing.join('+'),
              frequency: rx.config.frequency,
              duration: rx.config.duration,
              instructions: [rx.config.food, ...(rx.config.counselling || [])].filter(Boolean).join('; '),
            })),
          },
        })
      }

      if (labOrders.length > 0 || imagingOrders.length > 0) {
        await doctorApi.completeEncounter(id, {
          soap: { appointment_id: parseInt(id) },
          lab_order:     labOrders.length     ? { notes: orderNote, tests: labOrders }     : null,
          imaging_order: imagingOrders.length ? { notes: orderNote, tests: imagingOrders } : null,
        })
      }

      setIsLocked(true)
      flash('Consultation locked')
      setTimeout(() => navigate('/doctor-desk'), 1500)
    } catch (e) {
      flash('Error: ' + e.message)
    } finally { setSaving(false) }
  }

  const submitAddendum = async () => {
    if (!addendumText.trim()) return
    setSaving(true)
    try {
      await encountersApi.addendum({ appointment_id: parseInt(id), addendum: addendumText })
      setAddendumText('')
      setAddendumMode(false)
      flash('Addendum added')
    } catch (e) {
      flash('Error: ' + e.message)
    } finally { setSaving(false) }
  }

  const saveOrders = async () => {
    setSaving(true)
    try {
      await doctorApi.completeEncounter(id, {
        soap: { appointment_id: parseInt(id) },
        lab_order:     labOrders.length     ? { notes: orderNote, tests: labOrders }     : null,
        imaging_order: imagingOrders.length ? { notes: orderNote, tests: imagingOrders } : null,
      })
      setOrdersSaved(true)
      flash('Orders placed successfully')
    } catch (e) {
      flash('Error: ' + e.message)
    } finally { setSaving(false) }
  }

  const selectDrug = async drug => {
    setConfigDrug(drug)
    setDrugSearch('')
    setDrugResults([])
    setDrugConfig({ timing: ['Morning'], frequency: 'OD', duration: '30 days', food: 'Before food', counselling: [] })
    setCounsellingTips([])
    try {
      const r = await api.get('/terminology/drugs/counselling', { params: { generic: drug.generic } })
      setCounsellingTips(r?.tips || [])
    } catch { setCounsellingTips([]) }
  }

  const addMedication = () => {
    if (!configDrug) return
    setRxItems(prev => [...prev, { id: Date.now(), ...configDrug, config: { ...drugConfig } }])
    setConfigDrug(null)
    setCounsellingTips([])
    setDrugConfig({ timing: ['Morning'], frequency: 'OD', duration: '30 days', food: 'Before food', counselling: [] })
  }

  const addOrder = item => {
    const order = { test_id: item.id, test_name: item.name }
    if (orderTab === 'lab') {
      if (!labOrders.find(o => o.test_name === item.name))
        setLabOrders(p => [...p, order])
    } else {
      if (!imagingOrders.find(o => o.test_name === item.name))
        setImagingOrders(p => [...p, order])
    }
    setOrderSearch('')
    setOrderResults([])
  }

  const togglePanel = panel => setActivePanel(p => p === panel ? null : panel)
  const note = (key, val) => setNotes(n => ({ ...n, [key]: val }))

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) return <PageLoader />
  if (!data)   return <div className="p-8 text-gray-400">Encounter not found.</div>

  const patient   = data.patient || {}
  const vitals    = data.vitals  || {}
  const isHospital = user?.org_type === 'hospital'

  return (
    // Break out of Layout's p-4/p-6 padding so demographics bar is truly full-width
    <div className="-mx-4 md:-mx-6 flex flex-col">

      {/* ── Sticky Demographics Bar ── */}
      <DemographicsBar patient={patient} vitals={vitals} complaint={data.triage_complaint} />

      {/* ── Flash message ── */}
      {msg && (
        <div className={`mx-4 md:mx-6 mt-3 px-4 py-2.5 rounded-lg text-sm ${
          msg.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {msg}
        </div>
      )}

      {/* ── Content + Right panel container ── */}
      <div className="flex relative">

        {/* ── Main chart (left, scrollable) ── */}
        <div className="flex-1 px-4 md:px-6 py-5 space-y-4 min-w-0">

          {/* Header row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate(-1)} className="btn-secondary p-2 shrink-0">
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0">
                <h1 className="font-bold text-gray-900 truncate">{patient.full_name}</h1>
                <p className="text-xs text-gray-400 font-mono">{data.appointment_date} {data.appointment_time}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {isHospital && (
                <button onClick={() => setShowAdmission(true)} className="btn-secondary text-sm">
                  <BedDouble size={14} />Admit
                </button>
              )}
              {isLocked ? (
                <button onClick={() => setAddendumMode(v => !v)} className="btn-secondary text-sm">
                  <PenLine size={14} />Addendum
                </button>
              ) : (
                <>
                  <button onClick={() => saveDraft(true)} disabled={saving} className="btn-secondary text-sm">
                    <Save size={14} />{saving ? '…' : 'Save Draft'}
                  </button>
                  <button onClick={endConsultation} disabled={saving} className="btn-success text-sm">
                    <CheckCircle size={14} />{saving ? '…' : 'End & Lock'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Locked banner */}
          {isLocked && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <Lock size={14} className="shrink-0" />
              This record is locked. Use Addendum to add notes.
            </div>
          )}

          {/* Addendum box */}
          {addendumMode && (
            <div className="card p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Add Addendum</p>
              <textarea className="input resize-none w-full" rows={3} value={addendumText}
                onChange={e => setAddendumText(e.target.value)} placeholder="Enter addendum note…" autoFocus />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setAddendumMode(false); setAddendumText('') }}
                  className="btn-secondary text-sm">Cancel</button>
                <button type="button" onClick={submitAddendum} disabled={!addendumText.trim() || saving}
                  className="btn-primary text-sm">Submit Addendum</button>
              </div>
            </div>
          )}

          {/* ═══ Current Visit Card ═══ */}
          <div className="card p-5 space-y-5">

            {/* Visit badge */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <div className={`w-2 h-2 rounded-full shrink-0 ${isLocked ? 'bg-gray-300' : 'bg-green-400 animate-pulse'}`} />
              <span className="text-sm font-semibold text-gray-700">{data.appointment_date}</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500">{isLocked ? 'Locked' : 'Active Visit'}</span>
              {isLocked && <Lock size={13} className="text-gray-300 ml-auto" />}
            </div>

            {/* ── Vitals ── */}
            <div>
              <VitalsForm
                patientId={data.patient?.id}
                appointmentId={data.id}
                initialValues={vitals}
                compact={false}
                readOnly={isLocked}
                onSaved={saved => {
                  // Merge saved vitals into local state so demographics bar updates
                  setData(d => d ? { ...d, vitals: { ...d.vitals, ...saved } } : d)
                }}
              />
            </div>

            {/* ── Symptoms & History ── */}
            <div>
              <SectionHead icon={FileText} title="Symptoms & History"
                active={activePanel === 'symptoms'}
                onClick={() => togglePanel('symptoms')} />
              <div className="space-y-3">
                {[
                  ['reason_for_visit',       'Chief Complaint',       2],
                  ['patient_complaints',      'History of Illness',    3],
                  ['past_history',            'Past History',          2],
                  ['investigations_findings', 'Examination Findings',  3],
                ].map(([key, label, rows]) => (
                  <div key={key}>
                    <label className="label text-xs">{label}</label>
                    <textarea
                      className="input resize-none"
                      rows={rows}
                      value={notes[key]}
                      disabled={isLocked}
                      onFocus={() => setActivePanel('symptoms')}
                      onChange={e => note(key, e.target.value)}
                      placeholder={isLocked ? '—' : `${label}…`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Assessment & Diagnosis ── */}
            <div>
              <SectionHead icon={Stethoscope} title="Assessment & Diagnosis"
                active={activePanel === 'assessment'}
                onClick={() => togglePanel('assessment')} />

              {/* ICD-10 search */}
              {!isLocked && (
                <div className="relative mb-3">
                  <div className="input flex items-center gap-2">
                    <Search size={13} className="text-gray-400 shrink-0" />
                    <input
                      className="flex-1 outline-none text-sm bg-transparent"
                      placeholder="Search diagnosis (ICD-10)…"
                      value={dxSearch}
                      onFocus={() => setActivePanel('assessment')}
                      onChange={e => setDxSearch(e.target.value)}
                    />
                    {dxSearch && (
                      <button type="button" onClick={() => { setDxSearch(''); setDxResults([]) }}>
                        <X size={13} className="text-gray-400" />
                      </button>
                    )}
                  </div>
                  {dxResults.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                      {dxResults.map((r, i) => (
                        <button key={i} type="button"
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0"
                          onClick={() => {
                            if (!diagnoses.find(d => d.code === r.code))
                              setDiagnoses(p => [...p, { code: r.code, display: r.display }])
                            setDxSearch(''); setDxResults([])
                          }}>
                          <span className="font-mono text-xs text-gray-400 mr-2">{r.code}</span>
                          {r.display}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Diagnosis tags */}
              {diagnoses.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {diagnoses.map((d, i) => (
                    <DxChip key={i} code={d.code} display={d.display}
                      onRemove={() => setDiagnoses(p => p.filter((_, j) => j !== i))} />
                  ))}
                </div>
              )}

              <div>
                <label className="label text-xs">Assessment Notes</label>
                <textarea className="input resize-none" rows={2}
                  value={notes.discharge_assessment} disabled={isLocked}
                  onFocus={() => setActivePanel('assessment')}
                  onChange={e => note('discharge_assessment', e.target.value)}
                  placeholder="Clinical assessment, differential diagnosis…" />
              </div>
            </div>

            {/* ── Investigations & Orders ── */}
            <div>
              <SectionHead icon={FlaskConical} title="Investigations & Orders"
                active={activePanel === 'orders'}
                onClick={() => togglePanel('orders')} />

              {/* Placed orders */}
              {(labOrders.length > 0 || imagingOrders.length > 0) ? (
                <div className="space-y-2">
                  {labOrders.length > 0 && (
                    <div className="bg-blue-50 rounded-xl px-3 py-2.5">
                      <div className="text-xs font-semibold text-blue-700 mb-1.5">Lab Orders</div>
                      <div className="flex flex-wrap gap-1.5">
                        {labOrders.map((o, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs bg-white border border-blue-200 text-blue-800 rounded-lg px-2 py-0.5">
                            {o.test_name}
                            {!isLocked && <button type="button" onClick={() => setLabOrders(p => p.filter((_, j) => j !== i))}><X size={10} /></button>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {imagingOrders.length > 0 && (
                    <div className="bg-purple-50 rounded-xl px-3 py-2.5">
                      <div className="text-xs font-semibold text-purple-700 mb-1.5">Imaging</div>
                      <div className="flex flex-wrap gap-1.5">
                        {imagingOrders.map((o, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs bg-white border border-purple-200 text-purple-800 rounded-lg px-2 py-0.5">
                            {o.test_name}
                            {!isLocked && <button type="button" onClick={() => setImagingOrders(p => p.filter((_, j) => j !== i))}><X size={10} /></button>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!isLocked && (
                    <div className="flex items-center gap-2">
                      {!ordersSaved && (
                        <button type="button" onClick={saveOrders} disabled={saving}
                          className="btn-primary text-xs">
                          <Save size={12} />{saving ? '…' : 'Submit Orders'}
                        </button>
                      )}
                      {ordersSaved && <span className="text-xs text-green-600 font-medium">✓ Orders submitted</span>}
                      <button type="button" onClick={() => togglePanel('orders')}
                        className="btn-secondary text-xs">
                        <Plus size={12} />Add more
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                !isLocked && (
                  <button type="button" onClick={() => togglePanel('orders')}
                    className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                    <Plus size={14} className="inline mr-1" />Add lab or imaging orders
                  </button>
                )
              )}
            </div>

            {/* ── Medications ── */}
            <div>
              <SectionHead icon={Pill} title="Medications"
                active={activePanel === 'medications'}
                onClick={() => togglePanel('medications')} />

              {/* Medication list */}
              {rxItems.length > 0 && (
                <div className="space-y-2 mb-3">
                  {rxItems.map(rx => (
                    <div key={rx.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-800 text-sm">{rx.generic}</div>
                          {rx.drug_class && (
                            <div className="text-xs text-gray-400">{rx.drug_class}</div>
                          )}
                          <div className="text-xs text-gray-500 mt-0.5">
                            {rx.config.timing.join(' + ')} · <b>{rx.config.frequency}</b> · {rx.config.duration} · {rx.config.food}
                          </div>
                          {rx.config.counselling?.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {rx.config.counselling.map((c, i) => (
                                <span key={i} className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-700 rounded px-1.5 py-0.5">
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {!isLocked && (
                          <button type="button" onClick={() => setRxItems(p => p.filter(r => r.id !== rx.id))}
                            className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isLocked && (
                <button type="button" onClick={() => togglePanel('medications')}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                  <Plus size={14} className="inline mr-1" />Add medication
                </button>
              )}

              {rxItems.length > 0 && (
                <div className="mt-2">
                  <label className="label text-xs">Prescription Notes</label>
                  <textarea className="input resize-none text-sm" rows={2} value={rxNotes}
                    disabled={isLocked} onChange={e => setRxNotes(e.target.value)}
                    placeholder="General prescription notes…" />
                </div>
              )}
            </div>

            {/* ── Plan & Counselling ── */}
            <div>
              <SectionHead icon={ClipboardList} title="Plan & Counselling"
                active={activePanel === 'plan'}
                onClick={() => togglePanel('plan')} />
              <div className="space-y-3">
                <div>
                  <label className="label text-xs">Plan / Cautions</label>
                  <textarea className="input resize-none" rows={3}
                    value={notes.cautions_followup} disabled={isLocked}
                    onFocus={() => setActivePanel('plan')}
                    onChange={e => note('cautions_followup', e.target.value)}
                    placeholder="Management plan, cautions, lifestyle advice, referrals…" />
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="label text-xs">Follow-up in (days)</label>
                    <input type="number" className="input text-sm w-24" min="1" max="365"
                      value={followupDays} disabled={isLocked}
                      onChange={e => setFollowupDays(e.target.value)} />
                  </div>
                  {followupDays && parseInt(followupDays) > 0 && (
                    <div className="text-xs text-gray-500 mt-4">
                      Next visit: <b>{nextDate(followupDays)}</b>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom actions */}
            {!isLocked && (
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => saveDraft(true)} disabled={saving} className="btn-secondary text-sm">
                  <Save size={14} />{saving ? '…' : 'Save Draft'}
                </button>
                <button type="button" onClick={endConsultation} disabled={saving} className="btn-success text-sm">
                  <CheckCircle size={14} />{saving ? '…' : 'End & Lock Visit'}
                </button>
              </div>
            )}
          </div>

          {/* ═══ Past Visits ═══ */}
          {pastVisits.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Past Visits ({pastVisits.length})
              </h3>
              <div className="space-y-2">
                {pastVisits.map((v, i) => <PastVisitCard key={v.appointment_id || i} visit={v} />)}
              </div>
            </div>
          )}

          <div className="h-8" /> {/* bottom breathing room */}
        </div>

        {/* ═══ Right Panel (contextual overlay) ═══ */}
        {activePanel && (
          <div className="hidden md:flex fixed right-4 top-36 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl z-40 flex-col max-h-[calc(100vh-10rem)] overflow-hidden">

            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-2xl shrink-0">
              <span className="text-sm font-semibold text-gray-700">
                {activePanel === 'symptoms'    && 'Assessment Forms'}
                {activePanel === 'assessment'  && 'Assessment Forms'}
                {activePanel === 'orders'      && 'Add Orders'}
                {activePanel === 'medications' && 'Add Medication'}
                {activePanel === 'plan'        && 'Plan Templates'}
              </span>
              <button type="button" onClick={() => setActivePanel(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-200">
                <X size={14} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">

              {/* ── FORMS panel (symptoms / assessment) ── */}
              {(activePanel === 'symptoms' || activePanel === 'assessment') && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 pb-1">Suggested forms for this visit</p>
                  {[
                    { name: 'PHQ-9 Depression Scale',    desc: 'Mood & depression screening' },
                    { name: 'GAD-7 Anxiety Scale',        desc: 'Generalised anxiety assessment' },
                    { name: 'Pain Assessment (NRS 0–10)', desc: 'Numeric pain rating scale' },
                    { name: 'GCS Score',                  desc: 'Neurological assessment' },
                    { name: 'Vitals Extended',            desc: 'Detailed vitals & anthropometry' },
                  ].map((f, i) => (
                    <button key={i} type="button" onClick={() => navigate('/forms')}
                      className="w-full text-left px-3 py-2.5 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all group">
                      <div className="text-sm font-medium text-gray-700 group-hover:text-blue-700">{f.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{f.desc}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* ── ORDERS panel ── */}
              {activePanel === 'orders' && (
                <div className="space-y-3">
                  {/* Tab */}
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    {['lab', 'imaging'].map(t => (
                      <button key={t} type="button"
                        onClick={() => { setOrderTab(t); setOrderSearch(''); setOrderResults([]) }}
                        className={`flex-1 py-1.5 text-xs rounded-md font-medium capitalize transition-all ${
                          orderTab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                        }`}>
                        {t === 'lab' ? '🧪 Lab' : '🩻 Imaging'}
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div>
                    <div className="input flex items-center gap-2">
                      <Search size={13} className="text-gray-400 shrink-0" />
                      <input className="flex-1 outline-none text-sm bg-transparent"
                        placeholder={`Search ${orderTab} test…`}
                        value={orderSearch} onChange={e => setOrderSearch(e.target.value)} autoFocus />
                      {orderSearching && <span className="text-xs text-gray-400">…</span>}
                    </div>
                    {orderResults.length > 0 && (
                      <div className="mt-1 border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        {orderResults.map((r, i) => (
                          <button key={i} type="button" onClick={() => addOrder(r)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0 transition-colors">
                            {r.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected orders */}
                  {(labOrders.length > 0 || imagingOrders.length > 0) && (
                    <div className="space-y-2">
                      {labOrders.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Lab ({labOrders.length})</div>
                          <div className="flex flex-wrap gap-1">
                            {labOrders.map((o, i) => (
                              <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-2 py-0.5">
                                {o.test_name}
                                <button type="button" onClick={() => setLabOrders(p => p.filter((_, j) => j !== i))}>
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {imagingOrders.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Imaging ({imagingOrders.length})</div>
                          <div className="flex flex-wrap gap-1">
                            {imagingOrders.map((o, i) => (
                              <span key={i} className="inline-flex items-center gap-1 text-xs bg-purple-50 border border-purple-200 text-purple-800 rounded-lg px-2 py-0.5">
                                {o.test_name}
                                <button type="button" onClick={() => setImagingOrders(p => p.filter((_, j) => j !== i))}>
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="label text-xs">Clinical note (optional)</label>
                        <textarea className="input resize-none text-sm" rows={2}
                          value={orderNote} onChange={e => setOrderNote(e.target.value)}
                          placeholder="Reason for investigations…" />
                      </div>
                      <button type="button" onClick={saveOrders} disabled={saving}
                        className="w-full btn-primary text-sm justify-center">
                        <Save size={13} />{saving ? '…' : 'Submit Orders'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── MEDICATIONS panel ── */}
              {activePanel === 'medications' && (
                <div className="space-y-3">
                  {/* Drug search (shown when no drug selected) */}
                  {!configDrug && (
                    <div>
                      <div className="input flex items-center gap-2">
                        <Search size={13} className="text-gray-400 shrink-0" />
                        <input className="flex-1 outline-none text-sm bg-transparent"
                          placeholder="Search drug (generic or brand)…"
                          value={drugSearch} onChange={e => setDrugSearch(e.target.value)} autoFocus />
                        {drugSearching && <span className="text-xs text-gray-400">…</span>}
                      </div>
                      {drugResults.length > 0 && (
                        <div className="mt-1 border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                          {drugResults.map((d, i) => (
                            <button key={i} type="button" onClick={() => selectDrug(d)}
                              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b last:border-0 transition-colors">
                              <div className="text-sm font-medium text-gray-800">{d.generic}</div>
                              <div className="text-xs text-gray-400">
                                {d.drug_class}
                                {d.brands ? ` · ${d.brands.split('|')[0]}` : ''}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Drug configuration */}
                  {configDrug && (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-gray-800">{configDrug.generic}</div>
                          <div className="text-xs text-gray-400">{configDrug.drug_class}</div>
                        </div>
                        <button type="button"
                          onClick={() => { setConfigDrug(null); setCounsellingTips([]) }}
                          className="text-gray-400 hover:text-gray-700 p-1">
                          <X size={14} />
                        </button>
                      </div>

                      <ChipGroup
                        label="When to give"
                        options={['Morning', 'Afternoon', 'Night', 'Bedtime']}
                        value={drugConfig.timing} multi
                        onChange={v => setDrugConfig(c => ({ ...c, timing: v }))}
                      />
                      <ChipGroup
                        label="Frequency"
                        options={['OD', 'BD', 'TDS', 'QID', 'SOS', 'Weekly']}
                        value={drugConfig.frequency}
                        onChange={v => setDrugConfig(c => ({ ...c, frequency: v }))}
                      />
                      <ChipGroup
                        label="Duration"
                        options={['5 days', '7 days', '10 days', '15 days', '30 days', '3 months']}
                        value={drugConfig.duration}
                        onChange={v => setDrugConfig(c => ({ ...c, duration: v }))}
                      />
                      <ChipGroup
                        label="Instructions"
                        options={['Before food', 'After food', 'With food', 'Empty stomach']}
                        value={drugConfig.food}
                        onChange={v => setDrugConfig(c => ({ ...c, food: v }))}
                      />

                      {/* Counselling tips */}
                      {counsellingTips.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1.5 font-medium">Patient Counselling</div>
                          <div className="space-y-1.5">
                            {counsellingTips.map((tip, i) => {
                              const on = drugConfig.counselling.includes(tip)
                              return (
                                <button key={i} type="button"
                                  onClick={() => setDrugConfig(c => ({
                                    ...c,
                                    counselling: on
                                      ? c.counselling.filter(t => t !== tip)
                                      : [...c.counselling, tip],
                                  }))}
                                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                                    on
                                      ? 'bg-yellow-50 border-yellow-300 text-yellow-800 font-medium'
                                      : 'bg-white border-gray-200 text-gray-600 hover:border-yellow-300 hover:bg-yellow-50/40'
                                  }`}>
                                  {on ? '✓ ' : ''}{tip}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <button type="button" onClick={addMedication}
                        className="w-full btn-primary text-sm justify-center">
                        <Plus size={13} />Add to Prescription
                      </button>
                    </div>
                  )}

                  {/* Summary of added meds */}
                  {rxItems.length > 0 && !configDrug && (
                    <div className="border-t pt-3">
                      <div className="text-xs text-gray-400 mb-2">Added ({rxItems.length})</div>
                      {rxItems.map(rx => (
                        <div key={rx.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2.5 py-1.5 mb-1">
                          <span className="font-medium text-gray-700">{rx.generic}</span>
                          <span className="text-gray-400">{rx.config.frequency} · {rx.config.duration}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── PLAN panel ── */}
              {activePanel === 'plan' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 pb-1">Quick-fill plan templates</p>
                  {[
                    {
                      label: 'BP Management',
                      text: 'Continue antihypertensives as prescribed. Low sodium diet. Monitor BP daily. Avoid stress. Walk 30 min/day.',
                    },
                    {
                      label: 'DM Management',
                      text: 'Continue antidiabetics. Diabetic diet — avoid sweets and refined carbohydrates. Monitor fasting and PP blood sugar. Foot care daily.',
                    },
                    {
                      label: 'General Advice',
                      text: 'Rest and adequate hydration. Nutritious diet. Avoid self-medication. Return if symptoms worsen or new symptoms develop.',
                    },
                    {
                      label: 'Post-Infection',
                      text: 'Complete the full antibiotic course. Rest. Plenty of fluids. Return if fever persists beyond 3 days or condition worsens.',
                    },
                    {
                      label: 'Asthma / Respiratory',
                      text: 'Use inhaler as prescribed. Avoid triggers (dust, smoke, cold air). Monitor peak flow. Seek emergency care if severe breathlessness.',
                    },
                  ].map((t, i) => (
                    <button key={i} type="button"
                      onClick={() => note('cautions_followup',
                        notes.cautions_followup ? notes.cautions_followup + '\n\n' + t.text : t.text
                      )}
                      className="w-full text-left px-3 py-2.5 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all group">
                      <div className="text-xs font-bold text-gray-600 group-hover:text-blue-700">{t.label}</div>
                      <div className="text-xs text-gray-400 line-clamp-2 mt-0.5">{t.text}</div>
                    </button>
                  ))}
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* ── Admission Modal ── */}
      {showAdmission && (
        <AdmissionModal
          appointmentId={id}
          patientId={patient.id}
          patientName={patient.full_name}
          prefillDiagnosis={notes.discharge_assessment || notes.reason_for_visit || ''}
          onClose={() => setShowAdmission(false)}
          onCreated={num => { setShowAdmission(false); flash(`Admission advised. Ref: ${num}`) }}
        />
      )}
    </div>
  )
}
