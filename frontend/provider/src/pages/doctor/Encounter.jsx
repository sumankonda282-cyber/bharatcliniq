import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doctorApi, appointmentsApi, pharmacyApi, labApi, encountersApi } from '../../api'
import api from '../../api/client'
import { cachedGet, TTL } from '../../utils/cache'
import { PageLoader } from '../../components/ui/Spinner'
import SearchDropdown from '../../components/SearchDropdown'
import { useAuth } from '../../contexts/AuthContext'
import {
  ArrowLeft, Activity, FileText, Pill, FlaskConical,
  Save, CheckCircle, Plus, Trash2, Scan, Lock, PenLine, BedDouble, X,
} from 'lucide-react'

// ── Advise Admission Modal ────────────────────────────────────────────────────
function AdmissionModal({ appointmentId, patientId, patientName, prefillDiagnosis, onClose, onCreated }) {
  const { user } = useAuth()
  const [departments, setDepartments] = useState([])
  const [form, setForm] = useState({
    department_id: '',
    primary_diagnosis: prefillDiagnosis || '',
    expected_discharge: '',
    urgency: 'routine',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/inpatient/departments')
      .then(r => setDepartments(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => {})
  }, [])

  const submit = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      const payload = {
        patient_id: patientId,
        admitting_doctor_id: user?.id,
        source_appointment_id: parseInt(appointmentId),
        department_id: form.department_id ? parseInt(form.department_id) : undefined,
        admission_type: 'opd_referred',
        primary_diagnosis: form.primary_diagnosis,
        expected_discharge: form.expected_discharge || undefined,
        urgency: form.urgency,
        notes: form.notes,
      }
      const res = await api.post('/inpatient/admissions', payload)
      onCreated(res?.admission_number || res?.id || 'created')
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to create admission')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>Advise Admission</h3>
            <p className="text-sm text-gray-500">{patientName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Department</label>
            <select className="input" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
              <option value="">Select department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Primary Diagnosis</label>
            <textarea className="input resize-none" rows={3} value={form.primary_diagnosis}
              onChange={e => setForm(f => ({ ...f, primary_diagnosis: e.target.value }))}
              placeholder="Provisional diagnosis…" />
          </div>
          <div>
            <label className="label">Expected Discharge</label>
            <input type="date" className="input" value={form.expected_discharge}
              onChange={e => setForm(f => ({ ...f, expected_discharge: e.target.value }))}
              min={new Date().toISOString().split('T')[0]} />
          </div>
          <div>
            <label className="label">Urgency</label>
            <select className="input" value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}>
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Additional clinical notes for receptionist…" />
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

const FIELD_LABELS = [
  ['reason_for_visit',        'Reason for Visit',           3],
  ['patient_complaints',      'Patient Complaints',         4],
  ['past_history',            'Past History',               3],
  ['investigations_findings', 'Investigations & Findings',  4],
  ['medications_prescribed',  'Medications Prescribed',     4],
  ['discharge_assessment',    'Discharge Assessment',       3],
  ['cautions_followup',       'Cautions & Follow-up',       3],
]

export default function Encounter() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('notes')
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')
  const [addendumMode, setAddendumMode] = useState(false)
  const [addendumText, setAddendumText] = useState('')
  const [showAdmission, setShowAdmission] = useState(false)
  const autoSaveRef = useRef(null)
  const isHospital = user?.org_type === 'hospital'

  // Clinical notes (7 fields)
  const [notes, setNotes] = useState({
    reason_for_visit: '', patient_complaints: '', past_history: '',
    investigations_findings: '', medications_prescribed: '',
    discharge_assessment: '', cautions_followup: '',
  })
  const [isLocked, setIsLocked] = useState(false)

  // Prescription
  const [rxItems, setRxItems] = useState([{ medicine_id: null, medicine_name: '', dosage: '', frequency: '', duration: '', instructions: '' }])
  const [rxNotes, setRxNotes] = useState('')

  // Lab
  const [labTests, setLabTests]   = useState([{ test_id: null, test_name: '' }])
  const [labNotes, setLabNotes]   = useState('')

  // Imaging
  const [imagingTests, setImagingTests] = useState([{ test_id: null, test_name: '' }])
  const [imagingNotes, setImagingNotes] = useState('')

  useEffect(() => {
    doctorApi.getEncounter(id)
      .then(r => {
        setData(r)
        if (r.soap_note) {
          const sn = r.soap_note
          setNotes({
            reason_for_visit:        sn.reason_for_visit        || sn.subjective || '',
            patient_complaints:      sn.patient_complaints      || '',
            past_history:            sn.past_history            || '',
            investigations_findings: sn.investigations_findings || sn.objective  || '',
            medications_prescribed:  sn.medications_prescribed  || '',
            discharge_assessment:    sn.discharge_assessment    || sn.assessment || '',
            cautions_followup:       sn.cautions_followup       || sn.plan       || '',
          })
          setIsLocked(!!sn.is_locked)
        } else if (r.triage_complaint) {
          setNotes(n => ({ ...n, reason_for_visit: r.triage_complaint }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  // Auto-save draft every 30s
  useEffect(() => {
    if (isLocked) return
    autoSaveRef.current = setInterval(() => saveDraft(false), 30000)
    return () => clearInterval(autoSaveRef.current)
  }, [notes, isLocked])

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  const saveDraft = async (showMsg = true) => {
    if (isLocked || !data) return
    try {
      await encountersApi.save({ appointment_id: parseInt(id), ...notes, lock: false })
      if (showMsg) flash('Draft saved')
    } catch (e) {
      if (showMsg) flash('Error: ' + e.message)
    }
  }

  const endConsultation = async () => {
    if (!window.confirm('End consultation and lock the record? This cannot be undone.')) return
    setSaving(true)
    try {
      await encountersApi.save({ appointment_id: parseInt(id), ...notes, lock: true })

      // Save prescription if any
      if (rxItems.some(i => i.medicine_name)) {
        const payload = {
          soap: { appointment_id: parseInt(id) },
          prescription: { notes: rxNotes, items: rxItems.filter(i => i.medicine_name) },
        }
        await doctorApi.completeEncounter(id, payload)
      }

      setIsLocked(true)
      flash('Consultation completed and locked')
      setTimeout(() => navigate('/doctor-desk'), 1500)
    } catch (e) {
      flash('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const submitAddendum = async () => {
    if (!addendumText.trim()) return
    setSaving(true)
    try {
      await encountersApi.addendum({ appointment_id: parseInt(id), addendum: addendumText })
      setNotes(n => ({
        ...n,
        cautions_followup: (n.cautions_followup || '') +
          `\n\n[ADDENDUM]\n${addendumText}`,
      }))
      setAddendumText('')
      setAddendumMode(false)
      flash('Addendum added')
    } catch (e) {
      flash('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // Rx helpers
  const addRx = () => setRxItems(i => [...i, { medicine_id: null, medicine_name: '', dosage: '', frequency: '', duration: '', instructions: '' }])
  const rmRx  = (idx) => setRxItems(i => i.filter((_, j) => j !== idx))
  const setRx = (idx, k, v) => setRxItems(i => i.map((item, j) => j === idx ? { ...item, [k]: v } : item))

  // Lab helpers
  const addLab = () => setLabTests(t => [...t, { test_id: null, test_name: '' }])
  const rmLab  = (idx) => setLabTests(t => t.filter((_, j) => j !== idx))
  const setLab = (idx, k, v) => setLabTests(t => t.map((item, j) => j === idx ? { ...item, [k]: v } : item))

  // Imaging helpers
  const addImg = () => setImagingTests(t => [...t, { test_id: null, test_name: '' }])
  const rmImg  = (idx) => setImagingTests(t => t.filter((_, j) => j !== idx))
  const setImg = (idx, k, v) => setImagingTests(t => t.map((item, j) => j === idx ? { ...item, [k]: v } : item))

  const saveLabImaging = async () => {
    setSaving(true)
    try {
      const payload = {
        soap: { appointment_id: parseInt(id) },
        lab_order:     labTests.some(t => t.test_name)     ? { notes: labNotes,     tests: labTests.filter(t => t.test_name) }     : null,
        imaging_order: imagingTests.some(t => t.test_name) ? { notes: imagingNotes, tests: imagingTests.filter(t => t.test_name) } : null,
      }
      await doctorApi.completeEncounter(id, payload)
      flash('Orders saved')
    } catch (e) {
      flash('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />
  if (!data)   return <div className="text-gray-500">Encounter not found</div>

  const patient = data.patient || {}
  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  const TABS = [
    { key: 'notes',   label: 'Clinical Notes', icon: FileText },
    { key: 'rx',      label: 'Prescription',   icon: Pill },
    { key: 'lab',     label: 'Lab Orders',     icon: FlaskConical },
    { key: 'imaging', label: 'Imaging',         icon: Scan },
    { key: 'vitals',  label: 'Vitals',          icon: Activity },
  ]

  return (
    <div className="max-w-4xl">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-secondary p-2"><ArrowLeft size={16} /></button>
          <div>
            <h1 className="page-title">{patient.full_name}</h1>
            <p className="text-sm text-gray-500 font-mono">
              {patient.clinic_patient_id || `#${patient.id}`} · {data.appointment_date} {data.appointment_time}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isHospital && (
            <button onClick={() => setShowAdmission(true)} className="btn-secondary text-blue-700 border-blue-200 hover:bg-blue-50">
              <BedDouble size={15} />Advise Admission
            </button>
          )}
          {isLocked ? (
            <button
              onClick={() => setAddendumMode(v => !v)}
              className="btn-secondary"
            >
              <PenLine size={15} />Addendum
            </button>
          ) : (
            <>
              <button onClick={() => saveDraft(true)} disabled={saving} className="btn-secondary">
                <Save size={15} />{saving ? '…' : 'Save Draft'}
              </button>
              <button onClick={endConsultation} disabled={saving} className="btn-success">
                <CheckCircle size={15} />{saving ? 'Saving…' : 'End Consultation'}
              </button>
            </>
          )}
        </div>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${msg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </div>
      )}

      {/* Locked banner */}
      {isLocked && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <Lock size={15} className="shrink-0" />
          This encounter record is locked. Use Addendum to add notes.
        </div>
      )}

      {/* Addendum box */}
      {addendumMode && (
        <div className="card p-4 mb-4 space-y-3">
          <div className="text-sm font-medium text-gray-700">Add Addendum</div>
          <textarea
            className="input resize-none w-full"
            rows={3}
            value={addendumText}
            onChange={e => setAddendumText(e.target.value)}
            placeholder="Enter addendum note…"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAddendumMode(false); setAddendumText('') }} className="btn-secondary text-sm">Cancel</button>
            <button onClick={submitAddendum} disabled={!addendumText.trim() || saving} className="btn-primary text-sm">
              Submit Addendum
            </button>
          </div>
        </div>
      )}

      {/* Patient summary bar */}
      <div className="card p-4 mb-5">
        <div className="flex flex-wrap gap-5 text-sm">
          <div><span className="text-gray-400">Age</span> <span className="font-medium ml-1">{age != null ? `${age} yrs` : '—'}</span></div>
          <div><span className="text-gray-400">Gender</span> <span className="font-medium ml-1">{patient.gender || '—'}</span></div>
          <div><span className="text-gray-400">Blood</span> <span className="font-semibold text-red-600 ml-1">{patient.blood_group || '—'}</span></div>
          {patient.allergies && <div><span className="text-gray-400">Allergies</span> <span className="font-medium text-orange-600 ml-1">{patient.allergies}</span></div>}
          {data.triage_complaint && <div><span className="text-gray-400">Complaint</span> <span className="font-medium ml-1">{data.triage_complaint}</span></div>}
          {/* Triage vitals inline */}
          {data.vitals && (
            <div className="flex gap-3 text-gray-500 font-mono text-xs items-center">
              {data.vitals.blood_pressure_systolic && <span>BP {data.vitals.blood_pressure_systolic}/{data.vitals.blood_pressure_diastolic}</span>}
              {data.vitals.pulse_rate && <span>P {data.vitals.pulse_rate}</span>}
              {data.vitals.oxygen_saturation && <span>SpO₂ {data.vitals.oxygen_saturation}%</span>}
              {data.vitals.temperature && <span>T {data.vitals.temperature}°F</span>}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-5 w-fit overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* ── Clinical Notes (7 fields) ── */}
      {tab === 'notes' && (
        <div className="card p-6 space-y-5">
          {FIELD_LABELS.map(([key, label, rows]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <textarea
                className="input resize-none"
                rows={rows}
                value={notes[key]}
                disabled={isLocked}
                onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))}
                placeholder={isLocked ? '—' : `Enter ${label.toLowerCase()}…`}
              />
            </div>
          ))}
          {!isLocked && (
            <div className="flex justify-end">
              <button onClick={() => saveDraft(true)} disabled={saving} className="btn-secondary text-sm">
                <Save size={14} />{saving ? '…' : 'Save Draft'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Prescription ── */}
      {tab === 'rx' && (
        <div className="card p-6">
          <div className="space-y-3 mb-4">
            {rxItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-5 gap-2 items-start p-3 bg-gray-50 rounded-lg">
                <div className="col-span-2">
                  <label className="label text-xs">Medicine Name</label>
                  <SearchDropdown
                    value={item.medicine_name}
                    onChange={v => setRx(idx, 'medicine_name', v)}
                    onSelect={s => { setRx(idx, 'medicine_name', s.name + (s.strength ? ' ' + s.strength : '') + (s.form ? ' ' + s.form : '')); setRx(idx, 'medicine_id', s.id) }}
                    fetchSuggestions={q => cachedGet(`med_search_${q.toLowerCase()}`, () => pharmacyApi.searchMedicines(q), TTL.LONG)}
                    placeholder="Search medicine…"
                  />
                </div>
                <div>
                  <label className="label text-xs">Dosage</label>
                  <input className="input text-sm" placeholder="1-0-1" value={item.dosage} onChange={e => setRx(idx, 'dosage', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Duration</label>
                  <input className="input text-sm" placeholder="5 days" value={item.duration} onChange={e => setRx(idx, 'duration', e.target.value)} />
                </div>
                <div className="flex items-end">
                  <button onClick={() => rmRx(idx)} className="btn-secondary p-2 text-red-500 hover:text-red-700 mt-5"><Trash2 size={14} /></button>
                </div>
                <div className="col-span-5">
                  <label className="label text-xs">Instructions</label>
                  <input className="input text-sm" placeholder="After food, with water" value={item.instructions} onChange={e => setRx(idx, 'instructions', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
          <button onClick={addRx} className="btn-secondary text-sm mb-4"><Plus size={14} />Add Medicine</button>
          <div>
            <label className="label">Prescription Notes</label>
            <textarea className="input resize-none" rows={2} value={rxNotes} onChange={e => setRxNotes(e.target.value)} placeholder="General notes…" />
          </div>
        </div>
      )}

      {/* ── Lab Orders ── */}
      {tab === 'lab' && (
        <div className="card p-6">
          <div className="space-y-2 mb-4">
            {labTests.map((t, idx) => (
              <div key={idx} className="flex gap-2">
                <SearchDropdown
                  value={t.test_name}
                  onChange={v => setLab(idx, 'test_name', v)}
                  onSelect={s => { setLab(idx, 'test_name', s.name); setLab(idx, 'test_id', s.id) }}
                  fetchSuggestions={q => cachedGet(`lab_search_${q.toLowerCase()}`, () => labApi.searchTests(q, 'lab'), TTL.LONG)}
                  placeholder="Search lab test…"
                  className="flex-1"
                />
                <button onClick={() => rmLab(idx)} className="btn-secondary p-2 text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <button onClick={addLab} className="btn-secondary text-sm mb-4"><Plus size={14} />Add Test</button>
          <div className="mb-4">
            <label className="label">Clinical Notes</label>
            <textarea className="input resize-none" rows={2} value={labNotes} onChange={e => setLabNotes(e.target.value)} placeholder="Reason for tests…" />
          </div>
          <button onClick={saveLabImaging} disabled={saving} className="btn-primary text-sm">
            <Save size={14} />{saving ? '…' : 'Save Orders'}
          </button>
        </div>
      )}

      {/* ── Imaging ── */}
      {tab === 'imaging' && (
        <div className="card p-6">
          <div className="space-y-2 mb-4">
            {imagingTests.map((t, idx) => (
              <div key={idx} className="flex gap-2">
                <SearchDropdown
                  value={t.test_name}
                  onChange={v => setImg(idx, 'test_name', v)}
                  onSelect={s => { setImg(idx, 'test_name', s.name); setImg(idx, 'test_id', s.id) }}
                  fetchSuggestions={q => cachedGet(`img_search_${q.toLowerCase()}`, () => labApi.searchTests(q, 'imaging'), TTL.LONG)}
                  placeholder="Search imaging study…"
                  className="flex-1"
                />
                <button onClick={() => rmImg(idx)} className="btn-secondary p-2 text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <button onClick={addImg} className="btn-secondary text-sm mb-4"><Plus size={14} />Add Imaging</button>
          <div className="mb-4">
            <label className="label">Clinical Notes</label>
            <textarea className="input resize-none" rows={2} value={imagingNotes} onChange={e => setImagingNotes(e.target.value)} placeholder="Reason for imaging…" />
          </div>
          <button onClick={saveLabImaging} disabled={saving} className="btn-primary text-sm">
            <Save size={14} />{saving ? '…' : 'Save Orders'}
          </button>
        </div>
      )}

      {/* ── Vitals (read-only from triage; receptionist manages this) ── */}
      {tab === 'vitals' && (
        <div className="card p-6">
          {data.vitals ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Blood Pressure', data.vitals.blood_pressure_systolic ? `${data.vitals.blood_pressure_systolic}/${data.vitals.blood_pressure_diastolic} mmHg` : null],
                ['Pulse Rate',     data.vitals.pulse_rate        ? `${data.vitals.pulse_rate} bpm`  : null],
                ['Temperature',    data.vitals.temperature        ? `${data.vitals.temperature} °F`  : null],
                ['SpO₂',           data.vitals.oxygen_saturation  ? `${data.vitals.oxygen_saturation}%` : null],
                ['Weight',         data.vitals.weight_kg          ? `${data.vitals.weight_kg} kg`   : null],
                ['Height',         data.vitals.height_cm          ? `${data.vitals.height_cm} cm`   : null],
                ['Blood Sugar',    data.vitals.blood_sugar        ? `${data.vitals.blood_sugar} mg/dL` : null],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-400 mb-1">{label}</div>
                  <div className="font-semibold text-gray-800">{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <Activity size={32} className="mx-auto mb-2 opacity-30" />
              <p>No vitals recorded yet — receptionist records vitals during triage</p>
            </div>
          )}
        </div>
      )}

      {/* Advise Admission Modal */}
      {showAdmission && (
        <AdmissionModal
          appointmentId={id}
          patientId={patient.id}
          patientName={patient.full_name}
          prefillDiagnosis={notes.discharge_assessment || notes.reason_for_visit || ''}
          onClose={() => setShowAdmission(false)}
          onCreated={(num) => {
            setShowAdmission(false)
            flash(`Admission advised — receptionist will assign bed. Ref: ${num}`)
          }}
        />
      )}
    </div>
  )
}
