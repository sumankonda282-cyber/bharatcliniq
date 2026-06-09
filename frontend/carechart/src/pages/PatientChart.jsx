import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft, Activity, Pill, FileText, Loader2, AlertTriangle,
  ChevronDown, ChevronUp, Plus, X, FlaskConical, Printer,
  LayoutDashboard, ClipboardCheck, Scissors, PenLine, Search,
  Lock, User, Calendar, ArrowRight, PillIcon, Bell, Settings,
  CheckCircle2, Circle
} from 'lucide-react'
import api from '../api/client'
import { usePin } from '../contexts/PinContext'
import AllergySearch from '../components/AllergySearch'

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_SECTIONS = [
  { id: 'dashboard',   label: 'Patient Dashboard',       icon: LayoutDashboard },
  { id: 'provider',    label: 'Provider View',           icon: FileText },
  { id: 'mar',         label: 'MAR',                     icon: Pill },
  { id: 'medications', label: 'Medication Chart',        icon: PillIcon },
  { id: 'orders',      label: 'Orders / Investigations', icon: FlaskConical },
  { id: 'notes',       label: 'Notes / Assessments',     icon: ClipboardCheck },
  { id: 'flowsheet',   label: 'Patient Flow Sheet',      icon: Activity },
  { id: 'periop',      label: 'Perioperative',           icon: Scissors },
]

const FREQ_SLOTS = {
  'OD':  ['08:00'],
  'BD':  ['08:00','20:00'],
  'TDS': ['06:00','14:00','22:00'],
  'QID': ['06:00','12:00','18:00','00:00'],
  'Q8H': ['06:00','14:00','22:00'],
  'Q6H': ['06:00','12:00','18:00','00:00'],
  'Q4H': ['06:00','10:00','14:00','18:00','22:00','02:00'],
  'HS':  ['22:00'],
  'PRN': [],
  'STAT':[],
}

const COMMON_MEDS = [
  { name: 'Amoxicillin 500mg',              freq: 'TDS', route: 'Oral' },
  { name: 'Metformin 500mg',                freq: 'BD',  route: 'Oral' },
  { name: 'Atorvastatin 40mg',              freq: 'OD',  route: 'Oral' },
  { name: 'Amlodipine 5mg',                 freq: 'OD',  route: 'Oral' },
  { name: 'Pantoprazole 40mg',              freq: 'OD',  route: 'Oral' },
  { name: 'Ceftriaxone 1g',                 freq: 'BD',  route: 'IV'   },
  { name: 'Paracetamol 500mg',              freq: 'TDS', route: 'Oral' },
  { name: 'Tramadol 50mg',                  freq: 'PRN', route: 'Oral' },
  { name: 'Ondansetron 4mg',                freq: 'PRN', route: 'IV'   },
  { name: 'Aspirin 75mg',                   freq: 'OD',  route: 'Oral' },
  { name: 'Losartan 50mg',                  freq: 'OD',  route: 'Oral' },
  { name: 'Furosemide 40mg',                freq: 'BD',  route: 'IV'   },
  { name: 'Metoprolol 25mg',                freq: 'BD',  route: 'Oral' },
  { name: 'Insulin Actrapid (sliding scale)',freq: 'PRN', route: 'SC'   },
  { name: 'Prednisolone 10mg',              freq: 'OD',  route: 'Oral' },
]

const NORMAL_RANGES = {
  temperature:      { min: 36.1, max: 37.2 },
  pulse:            { min: 60,   max: 100  },
  bp_systolic:      { min: 90,   max: 140  },
  bp_diastolic:     { min: 60,   max: 90   },
  spo2:             { min: 95,   max: 100  },
  respiration_rate: { min: 12,   max: 20   },
  pain_score:       { min: 0,    max: 3    },
}

const DOT_PHRASES = {
  '.soap':  'S: Patient reports [complaint].\nO: Vitals stable. Exam: [findings].\nA: [assessment].\nP: [plan].',
  '.shift': 'Shift note: Patient [status]. Vitals [normal/abnormal]. Medications administered as ordered. Plan: Continue current management.',
  '.normal':'Normal findings. Vitals within normal limits. Patient comfortable and cooperative.',
  '.pain':  'Pain: Score [0-10]/10. Location: [site]. Character: [quality]. Duration: [time].',
  '.fall':  'Fall risk assessed. Score: [Morse]. Precautions in place.',
}

const ASSESSMENT_FORMS = [
  { id: 'pain',      label: 'Pain Assessment',              category: 'Clinical'       },
  { id: 'braden',    label: 'Braden Scale (Pressure Ulcer)',category: 'Clinical'       },
  { id: 'morse',     label: 'Morse Fall Scale',             category: 'Clinical'       },
  { id: 'gcs',       label: 'Glasgow Coma Scale',           category: 'Neuro'          },
  { id: 'io',        label: 'Intake & Output Chart',        category: 'Clinical'       },
  { id: 'wound',     label: 'Wound Care Assessment',        category: 'Clinical'       },
  { id: 'restraint', label: 'Restraint Assessment',         category: 'Safety'         },
  { id: 'nutrition', label: 'Nutrition Screening',          category: 'Clinical'       },
  { id: 'discharge', label: 'Discharge Readiness',          category: 'Discharge'      },
  { id: 'consent',   label: 'Informed Consent',             category: 'Medico-Legal'   },
  { id: 'incident',  label: 'Incident Report',              category: 'Safety'         },
  { id: 'anesthesia',label: 'Anesthesia Pre-Op',            category: 'Perioperative'  },
]

const DEFAULT_FLOW_STAGES = [
  { id: 'opd',      label: 'OPD',               time: null, sendDoc: '', recvDoc: '', notes: '' },
  { id: 'casualty', label: 'Casualty / ER',      time: null, sendDoc: '', recvDoc: '', notes: '' },
  { id: 'ward',     label: 'Ward',               time: null, sendDoc: '', recvDoc: '', notes: '' },
  { id: 'icu',      label: 'ICU',                time: null, sendDoc: '', recvDoc: '', notes: '' },
  { id: 'ot',       label: 'Operation Theatre',  time: null, sendDoc: '', recvDoc: '', notes: '' },
  { id: 'discharge',label: 'Discharge',          time: null, sendDoc: '', recvDoc: '', notes: '' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return null
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000 / 60
  if (diff < 1) return 'just now'
  if (diff < 60) return `${Math.round(diff)}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return `${Math.round(diff / 1440)}d ago`
}

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(str) {
  if (!str) return '—'
  return new Date(str).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateTime(str) {
  if (!str) return '—'
  return `${fmtDate(str)}, ${fmtTime(str)}`
}

function isAbnormal(key, val) {
  if (val == null || val === '') return false
  const r = NORMAL_RANGES[key]
  if (!r) return false
  const n = Number(val)
  return n < r.min || n > r.max
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values, width = 100, height = 32, color = '#065F46' }) {
  const nums = (values || []).map(Number).filter(v => !isNaN(v))
  if (nums.length < 2) return <span className="block text-xs text-gray-200 text-center">—</span>
  const min = Math.min(...nums), max = Math.max(...nums), range = max - min || 1
  const pad = 3
  const pts = nums.map((v, i) => {
    const x = pad + (i / (nums.length - 1)) * (width - 2 * pad)
    const y = pad + ((max - v) / range) * (height - 2 * pad)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const last = pts[pts.length - 1].split(',')
  return (
    <svg width={width} height={height}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  )
}

// ── Vitals freshness ──────────────────────────────────────────────────────────

function vitalsFreshness(recordedAt) {
  if (!recordedAt) return 'none'
  const mins = (Date.now() - new Date(recordedAt).getTime()) / 60000
  if (mins < 120) return 'green'
  if (mins < 240) return 'yellow'
  return 'red'
}

const FRESHNESS_DOT = {
  green:  'bg-green-400 shadow-green-300',
  yellow: 'bg-yellow-400 shadow-yellow-300',
  red:    'bg-red-500 shadow-red-300 animate-pulse',
  none:   'bg-gray-400',
}

// ── VitalsModal ───────────────────────────────────────────────────────────────

const VITALS_FIELDS = [
  { key: 'temperature',      label: 'Temperature',   unit: '°C',    placeholder: '37.0' },
  { key: 'bp_systolic',      label: 'BP Systolic',   unit: 'mmHg',  placeholder: '120' },
  { key: 'bp_diastolic',     label: 'BP Diastolic',  unit: 'mmHg',  placeholder: '80' },
  { key: 'pulse',            label: 'Pulse',         unit: 'bpm',   placeholder: '72' },
  { key: 'spo2',             label: 'SpO₂',          unit: '%',     placeholder: '98' },
  { key: 'respiration_rate', label: 'Resp Rate',     unit: '/min',  placeholder: '16' },
  { key: 'pain_score',       label: 'Pain Score',    unit: '/10',   placeholder: '0' },
  { key: 'weight',           label: 'Weight',        unit: 'kg',    placeholder: '' },
]

function VitalsModal({ admissionId, onClose, onSaved }) {
  const [vals, setVals]   = useState({})
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]     = useState('')

  const set = k => e => setVals(v => ({ ...v, [k]: e.target.value }))

  const save = async () => {
    setSaving(true); setErr('')
    try {
      const payload = {}
      VITALS_FIELDS.forEach(f => { if (vals[f.key] !== '' && vals[f.key] != null) payload[f.key] = Number(vals[f.key]) })
      payload.notes = notes
      const r = await api.post(`/inpatient/admissions/${admissionId}/vitals`, payload)
      onSaved(r.data)
      onClose()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to save vitals')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Activity size={15} className="text-emerald-600" /> Record Vitals
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {VITALS_FIELDS.map(f => {
            const val = vals[f.key] ?? ''
            const bad = val !== '' && isAbnormal(f.key, Number(val))
            return (
              <div key={f.key}>
                <label className="text-xs text-gray-500 block mb-0.5">{f.label} <span className="text-gray-300">{f.unit}</span></label>
                <input
                  type="number"
                  value={val}
                  onChange={set(f.key)}
                  placeholder={f.placeholder}
                  className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 ${bad ? 'border-red-300 bg-red-50 focus:ring-red-400 text-red-700' : 'border-gray-300 focus:ring-emerald-400'}`}
                />
                {bad && <span className="text-xs text-red-500">Abnormal</span>}
              </div>
            )
          })}
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-0.5">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          </div>
        </div>
        {err && <p className="px-4 pb-2 text-xs text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 px-4 pb-4">
          <button onClick={onClose} className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100">Cancel</button>
          <button onClick={save} disabled={saving}
            className="bg-emerald-600 text-white text-xs px-4 py-1.5 rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Save Vitals
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ClinicalAlerts ────────────────────────────────────────────────────────────

function ClinicalAlerts({ meds, allergies }) {
  const alerts = []
  const active = meds.filter(m => m.is_active !== false && !m.is_past)

  // Drug-allergy conflicts (first word match)
  allergies.forEach(al => {
    const aWord = (al.display || '').toLowerCase().split(' ')[0]
    if (!aWord) return
    active.forEach(m => {
      const mWord = (m.drug_name || m.medication_name || m.name || '').toLowerCase().split(' ')[0]
      if (mWord && (mWord.includes(aWord) || aWord.includes(mWord))) {
        alerts.push({
          type: 'allergy', sev: al.severity,
          msg: `${m.drug_name || m.name} — allergy to ${al.display} (${al.severity || 'unknown severity'})`,
        })
      }
    })
  })

  // Duplicate active medications (same first word)
  const seen = {}
  active.forEach(m => {
    const w = (m.drug_name || m.medication_name || m.name || '').toLowerCase().split(' ')[0]
    if (!w) return
    if (seen[w]) alerts.push({ type: 'duplicate', sev: 'moderate', msg: `Possible duplicate order: ${w}` })
    else seen[w] = true
  })

  if (alerts.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Bell size={11} className="text-red-400" /> Clinical Alerts
        <span className="bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full font-bold">{alerts.length}</span>
      </p>
      <div className="space-y-1">
        {alerts.map((a, i) => {
          const high = a.sev === 'life-threatening' || a.sev === 'severe'
          return (
            <div key={i} className={`text-xs px-3 py-1.5 rounded flex items-start gap-2 ${high ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
              <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
              <span>{a.msg}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── PatientBanner ─────────────────────────────────────────────────────────────

function PatientBanner({ admission, vitals, onBack, onAllergyOpen, onVitalsOpen }) {
  if (!admission) return null
  const p = admission.patient || {}
  const name   = p.full_name || admission.patient_name || 'Unknown'
  const mrn    = p.mrn || admission.mrn || admission.uhid || '—'
  const bhid   = p.bhid || p.bharatcliniq_id || admission.bhid || '—'
  const dob    = p.date_of_birth || admission.date_of_birth
  const age    = dob ? Math.floor((Date.now() - new Date(dob)) / 86400000 / 365.25) : null
  const sex    = (p.gender || p.sex || '').toUpperCase().slice(0, 1) || '?'
  const bg     = p.blood_group || admission.blood_group
  const dept   = admission.department_name || ''
  const ward   = admission.ward_name || '—'
  const bed    = admission.bed_number || '—'
  const ipNo   = admission.admission_number || admission.ip_number || `IP${admission.id}`
  const admitted = admission.admitted_at || admission.admission_date
  const days   = admitted ? Math.max(1, Math.floor((Date.now() - new Date(admitted)) / 86400000) + 1) : null
  const doctor = admission.attending_doctor?.full_name || admission.primary_doctor?.full_name
    || admission.admitting_doctor_name || admission.doctor?.full_name || '—'
  const diag   = admission.primary_diagnosis || admission.diagnosis || '—'
  const lv     = vitals?.[0] || null

  const strip = [
    { label: 'T', key: 'temperature',      val: lv?.temperature != null      ? `${lv.temperature}°C`                              : null },
    { label: 'BP',key: 'bp_systolic',      val: lv?.bp_systolic != null      ? `${lv.bp_systolic}/${lv.bp_diastolic ?? '?'}`      : null },
    { label: 'P', key: 'pulse',            val: lv?.pulse != null            ? `${lv.pulse}`                                      : null },
    { label: 'SpO₂',key:'spo2',           val: lv?.spo2 != null             ? `${lv.spo2}%`                                      : null },
    { label: 'RR',key: 'respiration_rate', val: lv?.respiration_rate != null ? `${lv.respiration_rate}`                           : null },
  ].filter(v => v.val != null)

  return (
    <div className="flex-shrink-0 shadow-md" style={{ background: '#065F46' }}>
      {/* Row 1 — identity */}
      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1">
        <button onClick={onBack} className="text-white/70 hover:text-white flex-shrink-0">
          <ArrowLeft size={17} />
        </button>
        <span className="font-bold text-white text-base truncate">{name}</span>
        {age && <span className="text-emerald-200 text-sm flex-shrink-0">{age}Y/{sex}</span>}
        {bg && <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-bold flex-shrink-0">{bg}</span>}
        <span className="text-xs bg-white/15 text-emerald-100 px-2 py-0.5 rounded font-mono hidden sm:block flex-shrink-0">MRN: {mrn}</span>
        <span className="text-xs bg-white/10 text-emerald-200 px-2 py-0.5 rounded font-mono hidden md:block flex-shrink-0">BHID: {bhid}</span>
        <div className="flex-1" />
        <button
          onClick={onAllergyOpen}
          className="text-xs bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 flex-shrink-0 hover:bg-amber-300 transition-colors"
        >
          <AlertTriangle size={9} /> ALLERGY CHECK
        </button>
        <button onClick={() => window.print()} className="text-white/60 hover:text-white flex-shrink-0 ml-1" title="Print">
          <Printer size={15} />
        </button>
      </div>
      {/* Row 2 — location */}
      <div className="flex items-center gap-3 px-3 pb-1 pt-0.5 flex-wrap">
        <span className="text-xs text-emerald-100">{dept}{ward !== '—' ? ` · ${ward}` : ''}{bed !== '—' ? ` · Bed ${bed}` : ''}</span>
        <span className="text-xs text-white/30">·</span>
        <span className="text-xs text-emerald-200 font-mono">{ipNo}</span>
        {days && <span className="text-xs text-emerald-200">· Day {days}</span>}
        <span className="text-xs text-white/30 hidden sm:block">·</span>
        <span className="text-xs text-emerald-200 hidden sm:block">Dr. <span className="text-white font-medium">{doctor}</span></span>
        {diag !== '—' && <span className="text-xs text-emerald-100/60 truncate max-w-xs hidden md:block" title={diag}>· {diag}</span>}
      </div>
      {/* Row 3 — vitals strip with freshness dot */}
      <div className="flex items-center gap-3 px-3 pb-2 pt-0.5">
        <button
          onClick={onVitalsOpen}
          title="Record vitals"
          className={`w-3 h-3 rounded-full flex-shrink-0 shadow-sm transition-transform hover:scale-125 ${FRESHNESS_DOT[vitalsFreshness(lv?.recorded_at)]}`}
        />
        {strip.map(v => (
          <span key={v.key} className={`text-xs ${isAbnormal(v.key, v.key === 'bp_systolic' ? lv?.bp_systolic : parseFloat(v.val)) ? 'text-red-300 font-bold' : 'text-emerald-100'}`}>
            <span className="text-white/40 mr-0.5">{v.label}:</span>{v.val}
          </span>
        ))}
        {!strip.length && <span className="text-xs text-white/40">No vitals — click dot to record</span>}
        {lv?.recorded_at && (
          <span className="text-xs text-white/35 ml-auto">{timeAgo(lv.recorded_at)}</span>
        )}
      </div>
    </div>
  )
}

// ── AllergyPanel ──────────────────────────────────────────────────────────────

function AllergyPanel({ admissionId, onClose }) {
  const [allergies, setAllergies]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [manualMode, setManualMode]     = useState(false)
  const [manualName, setManualName]     = useState('')
  const [manualReaction, setManualReaction] = useState('')
  const [manualSeverity, setManualSeverity] = useState('moderate')

  useEffect(() => {
    api.get(`/inpatient/admissions/${admissionId}/allergies`)
      .then(r => setAllergies(r.data || []))
      .catch(() => setAllergies([]))
      .finally(() => setLoading(false))
  }, [admissionId])

  const handleChange = async (newList) => {
    const added = newList.find(a => !allergies.some(x => x.code === a.code && x.display === a.display))
    if (!added) { setAllergies(newList); return }
    setSaving(true)
    try {
      await api.post(`/inpatient/admissions/${admissionId}/allergies`, {
        snomed_code:  added.code,
        display_name: added.display,
        reaction:     added.reaction || '',
        severity:     added.severity || 'moderate',
      })
      setAllergies(newList)
    } catch { alert('Failed to save allergy. Please try again.') }
    finally { setSaving(false) }
  }

  const addManual = async () => {
    if (!manualName.trim()) return
    setSaving(true)
    try {
      await api.post(`/inpatient/admissions/${admissionId}/allergies`, {
        snomed_code:  null,
        display_name: manualName.trim(),
        reaction:     manualReaction.trim(),
        severity:     manualSeverity,
      })
      setAllergies(prev => [...prev, {
        code: 'OTHER', display: manualName.trim(),
        category: 'Manual', severity: manualSeverity, reaction: manualReaction.trim(),
      }])
      setManualName(''); setManualReaction(''); setManualSeverity('moderate'); setManualMode(false)
    } catch { alert('Failed to save allergy.') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h2 className="font-semibold text-gray-800">Allergy Review</h2>
            {saving && <Loader2 size={13} className="animate-spin text-gray-400" />}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading
            ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-emerald-600" /></div>
            : (
              <>
                <AllergySearch allergies={allergies} onChange={handleChange} />
                <div className="mt-3 border-t border-gray-100 pt-3">
                  {!manualMode
                    ? (
                      <button onClick={() => setManualMode(true)}
                        className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
                        <Plus size={12} /> Can't find it? Add manually
                      </button>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-medium text-gray-600">Manual entry (no SNOMED code)</p>
                        <input
                          value={manualName}
                          onChange={e => setManualName(e.target.value)}
                          placeholder="Allergen name (e.g. Latex, Shellfish, Contrast dye)"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        />
                        <div className="flex gap-2">
                          <input
                            value={manualReaction}
                            onChange={e => setManualReaction(e.target.value)}
                            placeholder="Reaction (optional)"
                            className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                          <select value={manualSeverity} onChange={e => setManualSeverity(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1.5 text-sm">
                            {['mild','moderate','severe','life-threatening'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={addManual}
                            disabled={!manualName.trim() || saving}
                            className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                          >
                            <Plus size={12} /> Add Allergy
                          </button>
                          <button onClick={() => setManualMode(false)}
                            className="text-gray-500 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-100">Cancel</button>
                        </div>
                      </div>
                    )
                  }
                </div>
              </>
            )
          }
        </div>
      </div>
    </div>
  )
}

// ── ChartNav ──────────────────────────────────────────────────────────────────

function ChartNav({ active, setActive }) {
  return (
    <nav className="flex-shrink-0 flex flex-col py-2 overflow-y-auto" style={{ width: 200, background: '#065F46' }}>
      {CHART_SECTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setActive(id)}
          className={`flex items-center gap-2.5 px-3 py-2.5 text-sm text-left w-full transition-colors ${
            active === id
              ? 'bg-white/15 text-white font-semibold'
              : 'text-white/65 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Icon size={15} className="flex-shrink-0" />
          <span className="truncate text-sm">{label}</span>
        </button>
      ))}
    </nav>
  )
}

// ── Section: Patient Dashboard ─────────────────────────────────────────────────

function OverviewTab({ admission, vitals, meds, allergies, onVitalsOpen }) {
  const p       = admission.patient || {}
  const lv      = vitals[0] || null
  const admitted = admission.admitted_at || admission.admission_date
  const days    = admitted ? Math.max(1, Math.floor((Date.now() - new Date(admitted)) / 86400000) + 1) : '—'
  const dob     = p.date_of_birth || admission.date_of_birth
  const age     = dob ? Math.floor((Date.now() - new Date(dob)) / 86400000 / 365.25) : null

  const vHistory = key => vitals.slice(0, 10).map(v => v[key]).filter(v => v != null).reverse()

  const kpis = [
    { label: 'Day of Admission',  value: days,                           warn: false },
    { label: 'Last Vitals',       value: lv ? timeAgo(lv.recorded_at) : 'Never', warn: !lv },
    { label: 'Active Meds',       value: meds.length,                    warn: false },
    { label: 'Vitals Alerts',     value: lv ? Object.keys(NORMAL_RANGES).filter(k => isAbnormal(k, lv[k])).length : 0,
      warn: lv && Object.keys(NORMAL_RANGES).some(k => isAbnormal(k, lv[k])) },
  ]

  const vCards = [
    { key: 'temperature',      label: 'Temperature',  unit: '°C'   },
    { key: 'pulse',            label: 'Pulse',        unit: ' bpm' },
    { key: 'bp_systolic',      label: 'BP Systolic',  unit: ' mmHg', sec: { key: 'bp_diastolic', label: 'Diastolic' } },
    { key: 'spo2',             label: 'SpO₂',         unit: '%'    },
    { key: 'respiration_rate', label: 'Resp Rate',    unit: '/min' },
    { key: 'pain_score',       label: 'Pain Score',   unit: '/10'  },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* KPI strip — inline, no cards */}
      <div className="flex-shrink-0 flex items-center gap-6 px-4 py-2.5 bg-white border-b border-gray-100 flex-wrap">
        {kpis.map(k => (
          <div key={k.label} className="flex items-baseline gap-1.5">
            <span className={`text-lg font-bold ${k.warn ? 'text-red-600' : 'text-emerald-700'}`}>{k.value}</span>
            <span className="text-xs text-gray-400">{k.label}</span>
          </div>
        ))}
        {lv?.recorded_at && (
          <span className="text-xs text-gray-300 ml-auto">Vitals {timeAgo(lv.recorded_at)}</span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Clinical alerts */}
        <ClinicalAlerts meds={meds} allergies={allergies || []} />

        {/* Vitals — compact inline grid with sparklines */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button onClick={onVitalsOpen} title="Record vitals"
              className={`w-3 h-3 rounded-full flex-shrink-0 shadow-sm transition-transform hover:scale-125 ${FRESHNESS_DOT[vitalsFreshness(lv?.recorded_at)]}`} />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Latest Vitals</p>
            <button onClick={onVitalsOpen}
              className="ml-auto text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
              <Plus size={11} /> Record
            </button>
          </div>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-0 border border-gray-200 rounded-lg overflow-hidden bg-white">
            {vCards.map((v, vi) => {
              const curr = lv?.[v.key]
              const bad  = isAbnormal(v.key, curr)
              const hist = vHistory(v.key)
              return (
                <div key={v.key} className={`px-3 py-2 ${vi > 0 ? 'border-l border-gray-100' : ''} ${bad ? 'bg-red-50' : ''}`}>
                  <div className="text-xs text-gray-400 mb-0.5">{v.label}</div>
                  <div className={`text-base font-bold leading-tight ${bad ? 'text-red-600' : 'text-emerald-700'}`}>
                    {curr != null ? `${curr}${v.unit}` : '—'}
                  </div>
                  {v.sec && lv?.[v.sec.key] != null && (
                    <div className="text-xs text-gray-300">/{lv[v.sec.key]}</div>
                  )}
                  {bad && <AlertTriangle size={10} className="text-red-400 mt-0.5" />}
                  <Sparkline values={hist} width={80} height={24} color={bad ? '#dc2626' : '#065F46'} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Patient + Admission info — two-column prose table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><User size={11} /> Patient</p>
            <dl className="space-y-0.5">
              {[
                ['Name',       p.full_name || admission.patient_name || '—'],
                ['Age / Sex',  age ? `${age} yrs / ${(p.gender||'').toUpperCase().slice(0,1)||'?'}` : '—'],
                ['Blood Group',p.blood_group || '—'],
                ['Contact',    p.phone || p.contact_number || '—'],
                ['Address',    p.address || '—'],
              ].map(([l, v]) => (
                <div key={l} className="flex gap-2 py-0.5 border-b border-gray-50 last:border-0">
                  <dt className="text-xs text-gray-400 w-24 flex-shrink-0">{l}</dt>
                  <dd className="text-xs text-gray-700 font-medium truncate">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Calendar size={11} /> Admission</p>
            <dl className="space-y-0.5">
              {[
                ['Admitted',   fmtDateTime(admission.admitted_at || admission.admission_date)],
                ['Department', admission.department_name || '—'],
                ['Ward / Bed', `${admission.ward_name || '—'} / Bed ${admission.bed_number || '—'}`],
                ['IP Number',  admission.admission_number || admission.ip_number || '—'],
                ['Diagnosis',  admission.primary_diagnosis || '—'],
                ['Doctor',     admission.attending_doctor?.full_name || admission.admitting_doctor_name || '—'],
              ].map(([l, v]) => (
                <div key={l} className="flex gap-2 py-0.5 border-b border-gray-50 last:border-0">
                  <dt className="text-xs text-gray-400 w-24 flex-shrink-0">{l}</dt>
                  <dd className="text-xs text-gray-700 font-medium truncate">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section: Provider View ────────────────────────────────────────────────────

// Assessment form field definitions for inline fill
const FORM_FIELDS = {
  pain:      [{ k:'location', l:'Pain Location' },{ k:'score', l:'Score (0–10)' },{ k:'character', l:'Character (sharp/dull/burning…)' },{ k:'duration', l:'Duration' },{ k:'aggravating', l:'Aggravating factors' },{ k:'relieving', l:'Relieving factors' }],
  braden:    [{ k:'sensory', l:'Sensory perception (1–4)' },{ k:'moisture', l:'Moisture (1–4)' },{ k:'activity', l:'Activity (1–4)' },{ k:'mobility', l:'Mobility (1–4)' },{ k:'nutrition', l:'Nutrition (1–4)' },{ k:'friction', l:'Friction/Shear (1–3)' }],
  morse:     [{ k:'history_falls', l:'Hx of falling — Yes(25)/No(0)' },{ k:'secondary_diag', l:'Secondary diagnosis — Yes(15)/No(0)' },{ k:'ambulatory_aid', l:'Ambulatory aid (0/15/30)' },{ k:'iv', l:'IV/Heparin lock — Yes(20)/No(0)' },{ k:'gait', l:'Gait (0/10/20)' },{ k:'mental_status', l:'Mental status (0/15)' }],
  gcs:       [{ k:'eye', l:'Eye opening (1–4)' },{ k:'verbal', l:'Verbal response (1–5)' },{ k:'motor', l:'Motor response (1–6)' },{ k:'total', l:'GCS Total' },{ k:'interpretation', l:'Interpretation' }],
  io:        [{ k:'oral_intake', l:'Oral intake (ml)' },{ k:'iv_intake', l:'IV fluids (ml)' },{ k:'urine_output', l:'Urine output (ml)' },{ k:'other_output', l:'Other output (ml)' },{ k:'balance', l:'Fluid balance (ml)' }],
  wound:     [{ k:'location', l:'Wound location' },{ k:'size', l:'Size (cm × cm)' },{ k:'depth', l:'Depth' },{ k:'appearance', l:'Wound appearance' },{ k:'exudate', l:'Exudate type/amount' },{ k:'treatment', l:'Treatment applied' }],
  restraint: [{ k:'reason', l:'Reason for restraint' },{ k:'type', l:'Type of restraint' },{ k:'circulation', l:'Circulation check' },{ k:'skin', l:'Skin integrity' },{ k:'behaviour', l:'Behaviour/response' }],
  nutrition: [{ k:'weight', l:'Weight (kg)' },{ k:'bmi', l:'BMI' },{ k:'appetite', l:'Appetite' },{ k:'swallowing', l:'Swallowing status' },{ k:'diet_type', l:'Diet type' }],
  discharge: [{ k:'mobility', l:'Mobility status' },{ k:'understanding', l:'Discharge instructions understood' },{ k:'followup', l:'Follow-up arranged' },{ k:'medications', l:'Medications explained' },{ k:'support', l:'Home support available' }],
  consent:   [{ k:'procedure', l:'Procedure' },{ k:'risks_explained', l:'Risks explained' },{ k:'alternatives', l:'Alternatives discussed' },{ k:'questions', l:'Patient questions addressed' },{ k:'witness', l:'Witness name' }],
  incident:  [{ k:'type', l:'Incident type' },{ k:'time', l:'Time of incident' },{ k:'description', l:'Description' },{ k:'injury', l:'Injury sustained' },{ k:'action', l:'Immediate action taken' }],
  anesthesia:[{ k:'asa_class', l:'ASA classification' },{ k:'airway', l:'Airway assessment' },{ k:'npo_status', l:'NPO status' },{ k:'previous_anesthesia', l:'Previous anaesthesia issues' },{ k:'plan', l:'Anaesthesia plan' }],
}

function formatAssessmentNote(form, data) {
  const fields = FORM_FIELDS[form.id] || []
  const lines  = fields.map(f => `${f.l}: ${data[f.k] || '—'}`).join('\n')
  return `${form.label}\n${'─'.repeat(form.label.length)}\n${lines}`
}

function ProviderView({ admission, notes, setNotes, meds, admissionId }) {
  const { requestPin } = usePin()
  const [text, setText]           = useState('')
  const [noteType, setNoteType]   = useState('Progress Note')
  const [saving, setSaving]       = useState(false)
  const [collapsed, setCollapsed] = useState({})
  const textRef = useRef(null)

  // Right panel state
  const [formSearch, setFormSearch]   = useState('')
  const [selectedForm, setSelectedForm] = useState(null)
  const [formData, setFormData]       = useState({})
  const [formSaving, setFormSaving]   = useState(false)

  const NOTE_TYPES = ['Progress Note','SOAP Note','Nursing Note','Procedure Note','Discharge Summary']

  const filteredForms = formSearch.length > 0
    ? ASSESSMENT_FORMS.filter(f => f.label.toLowerCase().includes(formSearch.toLowerCase()) || f.category.toLowerCase().includes(formSearch.toLowerCase()))
    : ASSESSMENT_FORMS

  const handleInput = e => {
    let val = e.target.value
    for (const [phrase, expansion] of Object.entries(DOT_PHRASES)) {
      if (val.endsWith(phrase)) { val = val.slice(0, -phrase.length) + expansion; break }
    }
    setText(val)
  }

  const submit = async () => {
    if (!text.trim()) return
    setSaving(true)
    try {
      await requestPin('Sign and submit note')
      const r = await api.post(`/inpatient/admissions/${admissionId}/notes`, { note_type: noteType, content: text })
      setNotes(prev => [r.data, ...prev])
      setText('')
    } catch {}
    finally { setSaving(false) }
  }

  const continueSameRx = async () => {
    setSaving(true)
    try {
      await requestPin('Continue same Rx')
      const content = 'Continue same Rx. Patient reviewed. No changes to current medications.'
      await api.post(`/inpatient/admissions/${admissionId}/notes`, { note_type: 'Progress Note', content })
      setNotes(prev => [{ id: Date.now(), note_type: 'Progress Note', content, created_at: new Date().toISOString() }, ...prev])
    } catch {}
    finally { setSaving(false) }
  }

  const submitForm = async () => {
    if (!selectedForm) return
    setFormSaving(true)
    try {
      await requestPin(`Sign ${selectedForm.label}`)
      const content = formatAssessmentNote(selectedForm, formData)
      const r = await api.post(`/inpatient/admissions/${admissionId}/notes`, {
        note_type: selectedForm.label, content,
      }).catch(() => null)
      setNotes(prev => [
        r?.data || { id: Date.now(), note_type: selectedForm.label, content, created_at: new Date().toISOString() },
        ...prev,
      ])
      setSelectedForm(null)
      setFormData({})
      setFormSearch('')
    } catch {}
    finally { setFormSaving(false) }
  }

  const formFields = selectedForm ? (FORM_FIELDS[selectedForm.id] || []) : []

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: compose + timeline ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-gray-100">
        {/* Compose */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 flex-wrap border-b border-gray-100">
            <select value={noteType} onChange={e => setNoteType(e.target.value)}
              className="border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-600 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-emerald-400">
              {NOTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="text-xs text-gray-300 hidden sm:block">.soap .shift .normal .pain .fall</span>
            <div className="flex-1" />
            <button onClick={continueSameRx} disabled={saving || !meds.length}
              className="text-xs text-emerald-600 hover:text-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed">
              Continue Same Rx
            </button>
          </div>
          <textarea ref={textRef} value={text} onChange={handleInput} rows={3}
            placeholder="Write clinical note…"
            className="w-full px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none resize-none placeholder-gray-300" />
          <div className="flex items-center px-3 pb-2 gap-2">
            <span className="text-xs text-gray-300 flex-1">{text.length > 0 ? `${text.length} chars` : ''}</span>
            <button onClick={submit} disabled={!text.trim() || saving}
              className="bg-emerald-600 text-white text-xs px-4 py-1.5 rounded hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1.5">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <PenLine size={12} />} Sign & Submit
            </button>
          </div>
        </div>
        {/* Notes timeline */}
        <div className="flex-1 overflow-y-auto">
          {notes.length === 0 && <p className="text-sm text-gray-400 text-center py-10">No notes yet.</p>}
          {notes.map((n, i) => {
            const isCollapsed = collapsed[i]
            return (
              <div key={n.id || i} className="px-4 py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-semibold text-emerald-700">{n.note_type}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{fmtDateTime(n.created_at)}</span>
                  {n.author?.full_name && (
                    <><span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{n.author.full_name}</span></>
                  )}
                  <button onClick={() => setCollapsed(c => ({...c, [i]: !c[i]}))} className="ml-auto text-gray-300 hover:text-gray-500">
                    {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                  </button>
                </div>
                {!isCollapsed && (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right: assessment form panel ── */}
      <div className="flex-shrink-0 flex flex-col overflow-hidden bg-white" style={{ width: 272 }}>
        <div className="flex-shrink-0 px-3 pt-3 pb-2 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Assessment Forms</p>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2 text-gray-400" />
            <input
              value={formSearch}
              onChange={e => { setFormSearch(e.target.value); setSelectedForm(null); setFormData({}) }}
              placeholder="Search forms…"
              className="w-full border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
        </div>

        {selectedForm ? (
          /* Inline form fill */
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
              <button onClick={() => { setSelectedForm(null); setFormData({}) }} className="text-gray-400 hover:text-gray-600">
                <ArrowLeft size={13} />
              </button>
              <span className="text-xs font-semibold text-gray-700 truncate">{selectedForm.label}</span>
              <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{selectedForm.category}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {formFields.map(f => (
                <div key={f.k}>
                  <label className="text-xs text-gray-500 block mb-0.5">{f.l}</label>
                  <input
                    value={formData[f.k] || ''}
                    onChange={e => setFormData(d => ({...d, [f.k]: e.target.value}))}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
              ))}
              {formFields.length === 0 && (
                <textarea
                  value={formData['notes'] || ''}
                  onChange={e => setFormData(d => ({...d, notes: e.target.value}))}
                  rows={6}
                  placeholder="Enter assessment findings…"
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none"
                />
              )}
            </div>
            <div className="flex-shrink-0 px-3 py-2.5 border-t border-gray-100">
              <button
                onClick={submitForm}
                disabled={formSaving}
                className="w-full bg-emerald-600 text-white text-xs py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {formSaving ? <Loader2 size={12} className="animate-spin" /> : <PenLine size={12} />}
                Sign & Post to Timeline
              </button>
            </div>
          </div>
        ) : (
          /* Form list */
          <div className="flex-1 overflow-y-auto p-1.5">
            {filteredForms.map(f => (
              <button
                key={f.id}
                onClick={() => { setSelectedForm(f); setFormData({}) }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 group transition-colors"
              >
                <span className="block text-xs font-medium text-gray-700 group-hover:text-emerald-700">{f.label}</span>
                <span className="text-xs text-gray-400">{f.category}</span>
              </button>
            ))}
            {filteredForms.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">No forms match "{formSearch}"</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section: MAR ──────────────────────────────────────────────────────────────

function MARTab({ meds, admissionId }) {
  const TODAY = new Date().toISOString().slice(0, 10)
  const [marState, setMarState] = useState({})
  const [loadingMAR, setLoadingMAR] = useState(true)

  const scheduled = meds.filter(m => !m.is_past && m.is_active !== false)
  const allSlots  = [...new Set(scheduled.flatMap(m => FREQ_SLOTS[m.frequency || m.freq || 'OD'] || ['08:00']))].sort()

  // Load saved MAR records for today
  useEffect(() => {
    api.get(`/inpatient/admissions/${admissionId}/mar`, { params: { date: TODAY } })
      .then(r => {
        const saved = {}
        ;(r.data || []).forEach(rec => {
          saved[`${rec.medication_index ?? rec.med_index}-${rec.time_slot}`] = rec.status
        })
        setMarState(saved)
      })
      .catch(() => {})
      .finally(() => setLoadingMAR(false))
  }, [admissionId, TODAY])

  const toggle = (key, val, medIdx, slot) => {
    const next = marState[key] === val ? null : val
    setMarState(s => ({ ...s, [key]: next }))
    api.post(`/inpatient/admissions/${admissionId}/mar`, {
      date: TODAY, medication_index: medIdx, time_slot: slot, status: next,
    }).catch(() => {})
  }

  if (scheduled.length === 0) return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <div className="text-center"><Pill size={32} className="mx-auto mb-2 opacity-30" /><p>No scheduled medications.</p></div>
    </div>
  )

  return (
    <div className="p-4">
      <h2 className="font-semibold text-gray-700 mb-3 text-sm">
        Medication Administration Record — {fmtDate(new Date().toISOString())}
      </h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium w-44">Medication</th>
              <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium w-16">Route</th>
              {allSlots.map(slot => (
                <th key={slot} className="px-2 py-2 text-xs text-gray-500 font-medium text-center min-w-[52px]">{slot}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scheduled.map((m, mi) => {
              const slots   = FREQ_SLOTS[m.frequency || m.freq || 'OD'] || ['08:00']
              const medName = m.drug_name || m.medication_name || m.name || `Med #${mi + 1}`
              return (
                <tr key={mi} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-700 text-xs">{medName}</div>
                    <div className="text-xs text-gray-400">{m.dose || ''}{m.unit ? ` ${m.unit}` : ''} {m.frequency || m.freq || ''}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{m.route || '—'}</td>
                  {allSlots.map(slot => {
                    const isScheduled = slots.includes(slot)
                    const key = `${mi}-${slot}`
                    const st  = marState[key]
                    const now = new Date()
                    const [sh, sm] = slot.split(':').map(Number)
                    const slotPast = now.getHours() > sh || (now.getHours() === sh && now.getMinutes() > sm + 30)
                    if (!isScheduled) return <td key={slot} className="px-2 py-2 text-center text-gray-100">·</td>
                    return (
                      <td key={slot} className={`px-2 py-2 ${!st && slotPast ? 'bg-red-50/40' : ''}`}>
                        <div className="flex flex-col gap-0.5 items-center">
                          <button onClick={() => toggle(key, 'given', mi, slot)}
                            className={`text-xs px-1.5 py-0.5 rounded transition-colors leading-none ${st === 'given' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-700'}`}>G</button>
                          <button onClick={() => toggle(key, 'held', mi, slot)}
                            className={`text-xs px-1.5 py-0.5 rounded transition-colors leading-none ${st === 'held' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600'}`}>H</button>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Section: Medication Chart ─────────────────────────────────────────────────

function MedicationChartSection({ admissionId, meds, setMeds }) {
  const [tab, setTab]       = useState('active')
  const [showLib, setShowLib] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newMed, setNewMed] = useState({ name: '', dose: '', freq: 'OD', route: 'Oral' })

  const addFromLib = async m => {
    const entry = { drug_name: m.name, dose: '', frequency: m.freq, route: m.route, is_active: true }
    try {
      const r = await api.post(`/inpatient/admissions/${admissionId}/medications`, entry)
      setMeds(prev => [r.data, ...prev])
    } catch {
      setMeds(prev => [{ ...entry, id: Date.now() }, ...prev])
    }
    setShowLib(false)
  }

  const addCustom = async () => {
    if (!newMed.name.trim()) return
    const entry = { drug_name: newMed.name, dose: newMed.dose, frequency: newMed.freq, route: newMed.route, is_active: true }
    try {
      const r = await api.post(`/inpatient/admissions/${admissionId}/medications`, entry)
      setMeds(prev => [r.data, ...prev])
    } catch {
      setMeds(prev => [{ ...entry, id: Date.now() }, ...prev])
    }
    setAdding(false)
    setNewMed({ name: '', dose: '', freq: 'OD', route: 'Oral' })
  }

  const filtered = meds.filter(m =>
    tab === 'active' ? (m.is_active !== false) && !m.is_prn && !m.is_past :
    tab === 'prn'    ? m.is_prn :
                       m.is_past || m.is_active === false
  )

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-full p-0.5">
          {[['active','Active'],['prn','PRN'],['past','Past']].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${tab === id ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={() => setShowLib(!showLib)}
          className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
          <Plus size={12} /> From Library
        </button>
        <button onClick={() => setAdding(!adding)}
          className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 flex items-center gap-1">
          <Plus size={12} /> Add Custom
        </button>
      </div>

      {showLib && (
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-600 mb-2">Common Medications</p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_MEDS.map((m, i) => (
              <button key={i} onClick={() => addFromLib(m)}
                className="text-xs bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors">
                {m.name} <span className="text-gray-400">({m.freq} · {m.route})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {adding && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 grid grid-cols-2 md:grid-cols-5 gap-2">
          <input value={newMed.name} onChange={e => setNewMed(p => ({...p, name: e.target.value}))}
            placeholder="Drug name" className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          <input value={newMed.dose} onChange={e => setNewMed(p => ({...p, dose: e.target.value}))}
            placeholder="Dose" className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          <select value={newMed.freq} onChange={e => setNewMed(p => ({...p, freq: e.target.value}))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm">
            {Object.keys(FREQ_SLOTS).map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={newMed.route} onChange={e => setNewMed(p => ({...p, route: e.target.value}))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm">
            {['Oral','IV','IM','SC','Topical','Inhaled','Sublingual','Rectal'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="col-span-2 md:col-span-5 flex gap-2">
            <button onClick={addCustom} disabled={!newMed.name.trim()}
              className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50">Add</button>
            <button onClick={() => setAdding(false)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
        {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No {tab} medications.</p>}
        {filtered.map((m, i) => (
          <div key={m.id || i} className="flex items-center px-4 py-3 gap-3">
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-800 text-sm">{m.drug_name || m.medication_name || m.name || `Med #${i+1}`}</span>
              <span className="text-xs text-gray-400 ml-2">{m.dose || ''}{m.unit ? ` ${m.unit}` : ''} · {m.frequency || m.freq || ''} · {m.route || ''}</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${m.is_prn ? 'bg-orange-100 text-orange-700' : m.is_past || m.is_active === false ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>
              {m.is_prn ? 'PRN' : m.is_past || m.is_active === false ? 'Past' : 'Active'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section: Orders / Investigations ─────────────────────────────────────────

function OrdersInvestigationsSection({ admissionId }) {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [newOrder, setNewOrder] = useState('')
  const [orderType, setOrderType] = useState('Lab')

  useEffect(() => {
    api.get(`/inpatient/admissions/${admissionId}/orders`)
      .then(r => setOrders(r.data || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [admissionId])

  const addOrder = async () => {
    if (!newOrder.trim()) return
    const entry = { test_name: newOrder, order_type: orderType, status: 'pending', ordered_at: new Date().toISOString() }
    try {
      const r = await api.post(`/inpatient/admissions/${admissionId}/orders`, entry)
      setOrders(prev => [r.data, ...prev])
    } catch { setOrders(prev => [{ ...entry, id: Date.now() }, ...prev]) }
    setNewOrder('')
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-emerald-600" /></div>

  return (
    <div className="p-4 space-y-3">
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex gap-2">
        <select value={orderType} onChange={e => setOrderType(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm">
          {['Lab','Imaging','ECG','Procedure','Consult','Other'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={newOrder} onChange={e => setNewOrder(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addOrder()}
          placeholder="Enter order (e.g. CBC, Chest X-Ray)…"
          className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
        <button onClick={addOrder} disabled={!newOrder.trim()}
          className="bg-emerald-600 text-white text-xs px-4 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
          <Plus size={13} /> Order
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
        {orders.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No orders yet.</p>}
        {orders.map((o, i) => (
          <div key={o.id || i}>
            <button onClick={() => setExpanded(e => ({...e, [i]: !e[i]}))}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50">
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${o.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : o.status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {o.status || 'pending'}
              </span>
              <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded flex-shrink-0">{o.order_type || 'Lab'}</span>
              <span className="font-medium text-sm text-gray-800 flex-1">{o.test_name || o.name || 'Order'}</span>
              <span className="text-xs text-gray-400">{fmtDateTime(o.ordered_at || o.created_at)}</span>
              {expanded[i] ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
            </button>
            {expanded[i] && (
              <div className="px-4 pb-3">
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  {o.result ? <pre className="whitespace-pre-wrap">{typeof o.result === 'string' ? o.result : JSON.stringify(o.result, null, 2)}</pre>
                            : <span className="text-gray-400">No results yet.</span>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section: Notes / Assessments ─────────────────────────────────────────────

function NotesAssessmentsSection({ admissionId }) {
  const { requestPin } = usePin()
  const GKEY = `asmGroups_${admissionId}`
  const [catFilter, setCatFilter] = useState('Groups')
  const [search, setSearch]       = useState('')
  const [activeForm, setActiveForm] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [groups, setGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem(GKEY)) || [
      { name: 'Clinical', formIds: ['pain','braden','morse','io','wound'] },
      { name: 'Safety',   formIds: ['gcs','restraint','incident'] },
    ] } catch { return [] }
  })
  const [groupMgr, setGroupMgr] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [activeGroup, setActiveGroup] = useState(groups[0]?.name || '')

  const saveGroups = g => { setGroups(g); localStorage.setItem(GKEY, JSON.stringify(g)) }

  const categories = ['Groups', 'All', ...new Set(ASSESSMENT_FORMS.map(f => f.category))]

  const filtered = catFilter === 'Groups'
    ? (groups.find(g => g.name === activeGroup)?.formIds || []).map(id => ASSESSMENT_FORMS.find(f => f.id === id)).filter(Boolean)
    : ASSESSMENT_FORMS.filter(f =>
        (catFilter === 'All' || f.category === catFilter) &&
        (search === '' || f.label.toLowerCase().includes(search.toLowerCase()))
      )

  const handleSubmit = async formData => {
    try {
      await requestPin('Sign assessment form')
      setSubmissions(prev => [{
        form_id: activeForm.id, form_label: activeForm.label,
        data: formData, signed_at: new Date().toISOString(),
      }, ...prev])
      setActiveForm(null)
    } catch {}
  }

  const toggleFormInGroup = (groupName, formId) => {
    const updated = groups.map(g => {
      if (g.name !== groupName) return g
      const has = g.formIds.includes(formId)
      return { ...g, formIds: has ? g.formIds.filter(id => id !== formId) : [...g.formIds, formId] }
    })
    saveGroups(updated)
  }

  const addGroup = () => {
    if (!newGroupName.trim()) return
    const updated = [...groups, { name: newGroupName.trim(), formIds: [] }]
    saveGroups(updated); setNewGroupName(''); setActiveGroup(newGroupName.trim())
  }

  const removeGroup = name => {
    const updated = groups.filter(g => g.name !== name)
    saveGroups(updated)
    if (activeGroup === name) setActiveGroup(updated[0]?.name || '')
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-64 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col">
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2.5 top-2 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); if (e.target.value) setCatFilter('All') }}
                placeholder="Search forms…"
                className="w-full border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            </div>
            <button onClick={() => setGroupMgr(g => !g)} title="Manage groups"
              className={`p-1.5 rounded-lg border transition-colors ${groupMgr ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-gray-200 text-gray-400 hover:border-emerald-300'}`}>
              <Settings size={13} />
            </button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {categories.map(c => (
              <button key={c} onClick={() => { setCatFilter(c); setSearch('') }}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${catFilter === c ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 text-gray-500 hover:border-emerald-300'}`}>
                {c}
              </button>
            ))}
          </div>
          {catFilter === 'Groups' && groups.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {groups.map(g => (
                <button key={g.name} onClick={() => setActiveGroup(g.name)}
                  className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors ${activeGroup === g.name ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'}`}>
                  <Lock size={8} /> {g.name}
                  <span className="opacity-60">({groups.find(x => x.name === g.name)?.formIds.length || 0})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Group manager */}
        {groupMgr && (
          <div className="border-b border-gray-100 p-3 bg-gray-50 space-y-2">
            <p className="text-xs font-semibold text-gray-600">Manage Groups</p>
            <div className="flex gap-1">
              <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addGroup()}
                placeholder="New group name…"
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400" />
              <button onClick={addGroup} disabled={!newGroupName.trim()}
                className="bg-emerald-600 text-white text-xs px-2 py-1 rounded hover:bg-emerald-700 disabled:opacity-50">Add</button>
            </div>
            {groups.map(g => (
              <div key={g.name} className="flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700">{g.name} <span className="text-gray-400">({g.formIds.length} forms)</span></span>
                <button onClick={() => removeGroup(g.name)} className="text-red-400 hover:text-red-600"><X size={11} /></button>
              </div>
            ))}
            {catFilter === 'Groups' && activeGroup && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Forms in "{activeGroup}":</p>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {ASSESSMENT_FORMS.map(f => {
                    const inGroup = groups.find(g => g.name === activeGroup)?.formIds.includes(f.id)
                    return (
                      <button key={f.id} onClick={() => toggleFormInGroup(activeGroup, f.id)}
                        className={`w-full text-left text-xs px-2 py-1 rounded flex items-center gap-2 ${inGroup ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                        {inGroup ? <CheckCircle2 size={11} /> : <Circle size={11} className="opacity-40" />}
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              {catFilter === 'Groups' ? 'No forms in this group. Use ⚙ to add forms.' : 'No forms found.'}
            </p>
          )}
          {filtered.map(f => (
            <button key={f.id} onClick={() => setActiveForm(f)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${activeForm?.id === f.id ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
              <span className="block text-xs font-medium">{f.label}</span>
              <span className="text-xs text-gray-400">{f.category}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeForm ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={15} /></button>
              <h3 className="font-semibold text-gray-800 text-sm">{activeForm.label}</h3>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{activeForm.category}</span>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-400 text-center py-6">
                {activeForm.label} form loads here.<br />
                <span className="text-xs">Submit the form to generate a signed note in Provider View.</span>
              </p>
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                <button onClick={() => setActiveForm(null)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">Cancel</button>
                <button onClick={() => handleSubmit({ form: activeForm.id })}
                  className="text-xs bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-700 flex items-center gap-1">
                  <PenLine size={12} /> Sign & Submit
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700 mb-3">Submitted Assessments</p>
            {submissions.length === 0
              ? <p className="text-sm text-gray-400 py-8 text-center">No assessments yet. Select a form from the left panel.</p>
              : submissions.map((s, i) => (
                <div key={i} className="border-l-2 border-emerald-200 pl-3 py-1.5 mb-2">
                  <div className="text-xs font-medium text-emerald-700">{s.form_label}</div>
                  <div className="text-xs text-gray-400">{fmtDateTime(s.signed_at)}</div>
                </div>
              ))
            }
          </>
        )}
      </div>
    </div>
  )
}

// ── Section: Patient Flow Sheet ───────────────────────────────────────────────

function PatientFlowSheetSection() {
  const [stages, setStages]       = useState(DEFAULT_FLOW_STAGES)
  const [activeStage, setActive]  = useState(null)
  const [newName, setNewName]     = useState('')
  const [adding, setAdding]       = useState(false)

  const update = (id, field, val) =>
    setStages(ss => ss.map(s => s.id === id ? { ...s, [field]: val } : s))

  const arrive = id =>
    setStages(ss => ss.map(s => s.id === id ? { ...s, time: new Date().toISOString() } : s))

  const addStage = () => {
    if (!newName.trim()) return
    const id = `custom_${Date.now()}`
    setStages(ss => {
      const last = ss.length - 1
      return [...ss.slice(0, last), { id, label: newName.trim(), time: null, sendDoc: '', recvDoc: '', notes: '' }, ...ss.slice(last)]
    })
    setNewName(''); setAdding(false)
  }

  const isDefault = id => DEFAULT_FLOW_STAGES.some(d => d.id === id)

  const sel = stages.find(s => s.id === activeStage)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-700 text-sm">Patient Transfer Flow</h2>
        <button onClick={() => setAdding(true)}
          className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
          <Plus size={12} /> Add Stage
        </button>
      </div>

      {adding && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Stage name (e.g. NICU, Radiology, Burns Ward)…"
            className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
            onKeyDown={e => e.key === 'Enter' && addStage()} />
          <button onClick={addStage} className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg">Add</button>
          <button onClick={() => setAdding(false)} className="text-xs text-gray-500 px-2 py-1.5 rounded-lg hover:bg-gray-100">Cancel</button>
        </div>
      )}

      {/* Flow chart */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center gap-0 min-w-max">
          {stages.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                onClick={() => setActive(activeStage === s.id ? null : s.id)}
                className={`cursor-pointer flex flex-col items-center gap-1 w-28 p-2.5 rounded-xl border-2 transition-all ${
                  s.time ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white hover:border-emerald-200'
                } ${activeStage === s.id ? 'ring-2 ring-emerald-300 ring-offset-1' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${s.time ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {i + 1}
                </div>
                <span className="text-xs font-medium text-gray-700 text-center leading-tight">{s.label}</span>
                {s.time
                  ? <span className="text-xs text-emerald-600 font-medium">{fmtTime(s.time)}</span>
                  : (
                    <button onClick={e => { e.stopPropagation(); arrive(s.id) }}
                      className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded hover:bg-emerald-700 mt-0.5">
                      Arrived
                    </button>
                  )
                }
                {!isDefault(s.id) && (
                  <button onClick={e => { e.stopPropagation(); setStages(ss => ss.filter(x => x.id !== s.id)) }}
                    className="text-gray-300 hover:text-red-400 mt-0.5"><X size={10} /></button>
                )}
              </div>
              {i < stages.length - 1 && (
                <div className="flex items-center px-0.5">
                  <div className="w-5 h-px bg-gray-300" />
                  <ArrowRight size={10} className="text-gray-300 -ml-px" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {sel && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm">{sel.label}</h3>
            {sel.time && <span className="text-xs text-emerald-600 font-medium">Arrived: {fmtDateTime(sel.time)}</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Sending Doctor</label>
              <input value={sel.sendDoc} onChange={e => update(sel.id, 'sendDoc', e.target.value)}
                placeholder="Dr. Name"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Receiving Doctor</label>
              <input value={sel.recvDoc} onChange={e => update(sel.id, 'recvDoc', e.target.value)}
                placeholder="Dr. Name"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Transfer Notes</label>
            <textarea value={sel.notes} onChange={e => update(sel.id, 'notes', e.target.value)}
              rows={2} placeholder="Clinical handover notes…"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section: Perioperative ────────────────────────────────────────────────────

function PerioperativeSection({ admissionId }) {
  const { requestPin } = usePin()
  const [tab, setTab]   = useState('preop')
  const [forms, setForms] = useState({ preop: {}, intraop: {}, postop: {} })
  const [saving, setSaving] = useState(false)

  const FIELDS = {
    preop: [
      { key: 'procedure',         label: 'Planned Procedure'       },
      { key: 'surgeon',           label: 'Surgeon'                 },
      { key: 'anesthetist',       label: 'Anaesthetist'            },
      { key: 'consent_obtained',  label: 'Consent Obtained',  type: 'checkbox' },
      { key: 'fasting_hours',     label: 'Fasting (hours)'         },
      { key: 'premedication',     label: 'Premedication'           },
      { key: 'allergies_checked', label: 'Allergies Verified', type: 'checkbox' },
      { key: 'site_marked',       label: 'Site Marked',       type: 'checkbox' },
      { key: 'notes',             label: 'Notes',             type: 'textarea' },
    ],
    intraop: [
      { key: 'start_time',        label: 'Incision Time',     type: 'time' },
      { key: 'end_time',          label: 'Close Time',        type: 'time' },
      { key: 'anesthesia_type',   label: 'Anaesthesia Type'        },
      { key: 'blood_loss',        label: 'Est. Blood Loss (ml)'    },
      { key: 'fluids_given',      label: 'IV Fluids Given (ml)'    },
      { key: 'complications',     label: 'Intraoperative Complications', type: 'textarea' },
    ],
    postop: [
      { key: 'recovery_time',     label: 'Recovery Room Time', type: 'time' },
      { key: 'vitals_stable',     label: 'Vitals Stable',      type: 'checkbox' },
      { key: 'pain_score',        label: 'Pain Score (0-10)'        },
      { key: 'nausea',            label: 'Nausea/Vomiting',    type: 'checkbox' },
      { key: 'diet',              label: 'Diet Orders'              },
      { key: 'instructions',      label: 'Post-Op Instructions', type: 'textarea' },
    ],
  }

  const setField = (t, k, v) => setForms(f => ({ ...f, [t]: { ...f[t], [k]: v } }))

  const sign = async () => {
    setSaving(true)
    try {
      await requestPin(`Sign ${tab} form`)
      await api.post(`/inpatient/admissions/${admissionId}/perioperative`, { phase: tab, data: forms[tab] })
    } catch {}
    finally { setSaving(false) }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-full p-0.5 w-fit">
        {[['preop','Pre-Op'],['intraop','Intra-Op'],['postop','Post-Op']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${tab === id ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        {(FIELDS[tab] || []).map(f => (
          <div key={f.key}>
            <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
            {f.type === 'textarea'
              ? <textarea value={forms[tab][f.key] || ''} onChange={e => setField(tab, f.key, e.target.value)}
                  rows={2} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none" />
              : f.type === 'checkbox'
              ? <input type="checkbox" checked={!!forms[tab][f.key]} onChange={e => setField(tab, f.key, e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
              : <input type={f.type || 'text'} value={forms[tab][f.key] || ''} onChange={e => setField(tab, f.key, e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            }
          </div>
        ))}
        <div className="flex justify-end pt-2 border-t border-gray-100">
          <button onClick={sign} disabled={saving}
            className="bg-emerald-600 text-white text-xs px-4 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <PenLine size={12} />} Sign & Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main: PatientChart ────────────────────────────────────────────────────────

export default function PatientChart() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [admission, setAdmission] = useState(null)
  const [vitals, setVitals]       = useState([])
  const [notes, setNotes]         = useState([])
  const [meds, setMeds]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [section, setSection]     = useState('dashboard')
  const [showAllergy, setShowAllergy] = useState(false)
  const [showVitals, setShowVitals]   = useState(false)
  const [allergies, setAllergies]     = useState([])

  const load = useCallback(async () => {
    try {
      const [admR, vitR, notR, medR, algR] = await Promise.all([
        api.get(`/inpatient/admissions/${id}`),
        api.get(`/inpatient/admissions/${id}/vitals`),
        api.get(`/inpatient/admissions/${id}/notes`),
        api.get(`/inpatient/admissions/${id}/medications`),
        api.get(`/inpatient/admissions/${id}/allergies`).catch(() => ({ data: [] })),
      ])
      setAdmission(admR.data)
      setVitals(vitR.data || [])
      setNotes(notR.data || [])
      setMeds(medR.data || [])
      setAllergies(algR.data || [])
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load patient chart')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-full gap-2">
      <Loader2 className="animate-spin text-emerald-600" size={20} />
      <span className="text-gray-500 text-sm">Loading chart…</span>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <AlertTriangle className="text-red-400" size={28} />
      <p className="text-red-600 text-sm font-medium">{error}</p>
      <button onClick={() => navigate(-1)} className="text-sm text-emerald-600 flex items-center gap-1">
        <ArrowLeft size={14} /> Go back
      </button>
    </div>
  )

  if (!admission) return null

  const renderSection = () => {
    switch (section) {
      case 'dashboard':   return <OverviewTab admission={admission} vitals={vitals} meds={meds} allergies={allergies} onVitalsOpen={() => setShowVitals(true)} />
      case 'provider':    return <ProviderView admission={admission} notes={notes} setNotes={setNotes} meds={meds} admissionId={id} />
      case 'mar':         return <MARTab meds={meds} admissionId={id} />
      case 'medications': return <MedicationChartSection admissionId={id} meds={meds} setMeds={setMeds} />
      case 'orders':      return <OrdersInvestigationsSection admissionId={id} />
      case 'notes':       return <NotesAssessmentsSection admissionId={id} />
      case 'flowsheet':   return <PatientFlowSheetSection admission={admission} />
      case 'periop':      return <PerioperativeSection admissionId={id} />
      default:            return null
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PatientBanner
        admission={admission}
        vitals={vitals}
        onBack={() => navigate(-1)}
        onAllergyOpen={() => setShowAllergy(true)}
        onVitalsOpen={() => setShowVitals(true)}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ChartNav active={section} setActive={setSection} />
        <div className="flex-1 bg-gray-50 overflow-y-auto">
          {renderSection()}
        </div>
      </div>
      {showAllergy && (
        <AllergyPanel admissionId={id} onClose={() => setShowAllergy(false)} />
      )}
      {showVitals && (
        <VitalsModal
          admissionId={id}
          onClose={() => setShowVitals(false)}
          onSaved={v => { setVitals(prev => [v, ...prev]); setShowVitals(false) }}
        />
      )}
    </div>
  )
}
