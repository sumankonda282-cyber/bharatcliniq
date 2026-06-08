import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft, Activity, Pill, ClipboardList, FileText, Loader2,
  AlertTriangle, ChevronDown, ChevronUp, Plus, CheckCircle, X,
  FlaskConical, Stethoscope, Utensils, BarChart2, Printer,
  Thermometer, Heart, Wind, Droplets, PenLine, RefreshCw,
  ClipboardCheck, ArrowRightLeft, PillIcon
} from 'lucide-react'
import api from '../api/client'
import { usePin } from '../contexts/PinContext'
import IOChartForm from '../components/assessments/IOChartForm'
import BradenForm from '../components/assessments/BradenForm'
import GCSForm from '../components/assessments/GCSForm'
import MorseForm from '../components/assessments/MorseForm'
import PainForm from '../components/assessments/PainForm'
import WoundCareForm from '../components/assessments/WoundCareForm'
import RestraintForm from '../components/assessments/RestraintForm'

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

const NORMAL = {
  temperature:     { min: 36.1, max: 37.2 },
  pulse:           { min: 60,   max: 100  },
  bp_systolic:     { min: 90,   max: 140  },
  bp_diastolic:    { min: 60,   max: 90   },
  spo2:            { min: 95,   max: 100  },
  respiration_rate:{ min: 12,   max: 20   },
  pain_score:      { min: 0,    max: 3    },
}

function isAbnormal(key, val) {
  if (val == null || val === '') return false
  const r = NORMAL[key]
  if (!r) return false
  const n = Number(val)
  return n < r.min || n > r.max
}

function vitalColor(key, val) {
  if (val == null || val === '') return 'text-gray-400'
  return isAbnormal(key, val) ? 'text-red-600 font-bold' : 'text-emerald-700 font-semibold'
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values, width = 120, height = 40, color = '#065F46' }) {
  if (!values || values.length === 0) {
    return <span className="text-xs text-gray-300">No data</span>
  }
  if (values.length === 1) {
    const cx = width / 2
    const cy = height / 2
    return (
      <svg width={width} height={height}>
        <circle cx={cx} cy={cy} r={3} fill={color} />
      </svg>
    )
  }
  const nums = values.map(Number).filter(v => !isNaN(v))
  if (nums.length < 2) return <span className="text-xs text-gray-300">No data</span>
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const range = max - min || 1
  const pad = 4
  const points = nums.map((v, i) => {
    const x = pad + (i / (nums.length - 1)) * (width - 2 * pad)
    const y = pad + ((max - v) / range) * (height - 2 * pad)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pad + ((nums.length - 1) / (nums.length - 1)) * (width - 2 * pad)}
        cy={pad + ((max - nums[nums.length - 1]) / range) * (height - 2 * pad)}
        r={3}
        fill={color}
      />
    </svg>
  )
}

// ── Patient Banner ────────────────────────────────────────────────────────────

function PatientBanner({ admission, onBack }) {
  if (!admission) return null
  const p = admission.patient || {}
  const name = p.full_name || admission.patient_name || 'Unknown'
  const uhid = p.mrn || admission.uhid || '—'
  const dob = p.date_of_birth || admission.date_of_birth
  const age = dob ? Math.floor((Date.now() - new Date(dob)) / 86400000 / 365.25) : null
  const sex = (p.gender || p.sex || '').toUpperCase().slice(0,1) || '—'
  const bg = p.blood_group || admission.blood_group || null
  const ward = admission.ward_name || '—'
  const bed = admission.bed_number || '—'
  const dept = admission.department_name || ''
  const admNo = admission.admission_number || `#${admission.id}`
  const admitted = admission.admitted_at || admission.admission_date
  const days = admitted ? Math.floor((Date.now() - new Date(admitted)) / 86400000) : null
  const doctor = admission.admitting_doctor_name || admission.doctor?.full_name || '—'
  const diag = admission.primary_diagnosis || '—'

  return (
    <div className="sticky top-0 z-20 shadow-md flex-shrink-0" style={{ background: '#065F46' }}>
      {/* Row 1 — identity */}
      <div className="flex items-center gap-3 px-4 pt-2.5 pb-1">
        <button onClick={onBack} className="text-white/70 hover:text-white flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        {/* Name + identifiers */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-bold text-white text-base leading-tight truncate">{name}</span>
          {age && <span className="text-emerald-200 text-sm flex-shrink-0">{age}Y/{sex}</span>}
          {bg && (
            <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-bold flex-shrink-0">{bg}</span>
          )}
          <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded font-mono flex-shrink-0">
            UHID: {uhid}
          </span>
        </div>
        {/* Flags */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
            <AlertTriangle size={9} /> ALLERGY CHECK
          </span>
        </div>
      </div>

      {/* Row 2 — location + admission + diagnosis */}
      <div className="flex items-center gap-4 px-4 pb-2 pt-0.5 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-emerald-200">
          <span className="font-medium text-white">{dept}</span>
          {ward !== '—' && <><span>·</span><span>{ward}</span></>}
          {bed !== '—' && <><span>·</span><span className="font-semibold text-white">Bed {bed}</span></>}
        </div>
        <div className="text-xs text-emerald-200">
          <span className="font-mono text-white">{admNo}</span>
          {days !== null && <span className="ml-1">· Day {days === 0 ? 1 : days + 1}</span>}
        </div>
        <div className="text-xs text-emerald-200 hidden sm:block">
          <span className="text-white/60">Dr.</span> <span className="text-white font-medium">{doctor}</span>
        </div>
        <div className="text-xs text-emerald-100 truncate max-w-xs hidden md:block" title={diag}>
          {diag}
        </div>
      </div>
    </div>
  )
}

// ── Tab Bar ───────────────────────────────────────────────────────────────────

const NURSE_TABS    = ['Overview', 'Vitals', 'I & O', 'Chart', 'MAR', 'Assessments']
const PROVIDER_TABS = ['Overview', 'Vitals', 'I & O', 'Chart', 'MAR', 'Orders', 'Assessments']

function TabBar({ active, setActive, tabs }) {
  return (
    <div className="bg-white border-b border-gray-200 flex overflow-x-auto scrollbar-none flex-shrink-0">
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => setActive(t)}
          className={`px-4 py-3 text-sm font-medium flex-shrink-0 border-b-2 transition-colors ${
            active === t
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ admission, vitals, notes, meds, tasks }) {
  const p = admission.patient || {}
  const latestVital = vitals[0] || null
  const latestNote = notes[0] || null
  const daysAdmitted = admission.admission_date
    ? Math.floor((Date.now() - new Date(admission.admission_date).getTime()) / 86400000)
    : '—'

  const vitalFields = [
    { key: 'temperature',      label: 'Temp',  unit: '°C'  },
    { key: 'pulse',            label: 'Pulse', unit: ' bpm'},
    { key: 'bp_systolic',      label: 'BP',    unit: '', special: 'bp' },
    { key: 'spo2',             label: 'SpO₂',  unit: '%'   },
    { key: 'respiration_rate', label: 'RR',    unit: '/min'},
    { key: 'pain_score',       label: 'Pain',  unit: '/10' },
  ]

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Days Admitted', value: daysAdmitted, color: '#065F46' },
          { label: 'Last Vitals', value: latestVital ? timeAgo(latestVital.recorded_at) : 'Never', color: latestVital ? '#16A34A' : '#CC1414' },
          { label: 'Active Meds', value: meds.length, color: '#7c3aed' },
          { label: 'Pending Tasks', value: tasks, color: '#d97706' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Latest vitals */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 lg:col-span-2">
          <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
            <Activity size={15} className="text-emerald-600" /> Latest Vitals
            {latestVital?.recorded_at && (
              <span className="text-xs text-gray-400 font-normal ml-auto">{timeAgo(latestVital.recorded_at)}</span>
            )}
          </h3>
          {latestVital ? (
            <div className="grid grid-cols-3 gap-2">
              {vitalFields.map(f => {
                let display = '—'
                let colorKey = f.key
                if (f.special === 'bp') {
                  const sys = latestVital.bp_systolic
                  const dia = latestVital.bp_diastolic
                  display = sys != null ? `${sys}/${dia ?? '—'}` : '—'
                  colorKey = 'bp_systolic'
                } else {
                  const v = latestVital[f.key]
                  display = v != null ? `${v}${f.unit}` : '—'
                }
                const bad = isAbnormal(colorKey, latestVital[colorKey])
                return (
                  <div key={f.key} className={`rounded-lg p-3 ${bad ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                    <div className="text-xs text-gray-500">{f.label}</div>
                    <div className={`text-lg font-bold ${bad ? 'text-red-600' : 'text-emerald-700'}`}>{display}</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No vitals recorded yet.</p>
          )}
        </div>

        {/* Active meds */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
            <Pill size={15} className="text-purple-600" /> Active Medications
          </h3>
          {meds.length === 0 ? (
            <p className="text-sm text-gray-400">No active medications.</p>
          ) : (
            <ul className="space-y-1">
              {meds.slice(0, 5).map((m, i) => (
                <li key={i} className="text-xs text-gray-700 py-1 border-b border-gray-50 last:border-0">
                  <span className="font-medium">{m.drug_name || m.medication_name || m.name || `Med #${i + 1}`}</span>
                  {m.dose && <span className="text-gray-400"> · {m.dose}{m.unit ? ` ${m.unit}` : ''} {m.route || ''}</span>}
                </li>
              ))}
              {meds.length > 5 && (
                <li className="text-xs text-emerald-600 font-medium">+ {meds.length - 5} more</li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Latest note */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
            <FileText size={15} className="text-blue-600" /> Recent Nursing Note
          </h3>
          {latestNote ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {latestNote.note_type || 'general'}
                </span>
                <span className="text-xs text-gray-400">{latestNote.written_by || ''}</span>
                <span className="text-xs text-gray-400 ml-auto">{timeAgo(latestNote.written_at || latestNote.created_at)}</span>
              </div>
              <p className="text-sm text-gray-700 line-clamp-4">{latestNote.note_text || latestNote.note || '—'}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No nursing notes yet.</p>
          )}
        </div>

        {/* Demographics */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 text-sm mb-3">Patient Demographics</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {[
              ['DOB', fmtDate(p.date_of_birth)],
              ['Gender', p.gender || p.sex || '—'],
              ['Blood Group', p.blood_group || admission.blood_group || '—'],
              ['Phone', p.phone || p.mobile || '—'],
              ['Emergency Contact', p.emergency_contact || admission.emergency_contact_name || '—'],
              ['Insurance/TPA', admission.insurance_provider || admission.tpa || p.insurance || '—'],
              ['Religion', p.religion || '—'],
              ['Adm Type', admission.admission_type || '—'],
            ].map(([k, v]) => (
              <div key={k} className="py-0.5">
                <span className="text-gray-400">{k}: </span>
                <span className="text-gray-700 font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admission details */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-semibold text-gray-800 text-sm mb-3">Admission Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            ['Admitted On', fmtDate(admission.admission_date)],
            ['Referring Doctor', admission.referring_doctor || '—'],
            ['Expected Discharge', fmtDate(admission.expected_discharge_date)],
            ['Diet', admission.diet_type || admission.diet || '—'],
          ].map(([k, v]) => (
            <div key={k} className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-400 mb-0.5">{k}</div>
              <div className="text-gray-800 font-medium">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Vitals Tab ────────────────────────────────────────────────────────────────

const VITALS_FORM_EMPTY = {
  temperature: '', pulse: '', bp_systolic: '', bp_diastolic: '',
  spo2: '', respiration_rate: '', pain_score: '', blood_glucose: '',
  weight: '', notes: ''
}

function VitalsTab({ admissionId, vitals, onReload }) {
  const { requestPin } = usePin()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(VITALS_FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const sparklineData = (key) => vitals.slice(0, 10).map(v => v[key]).filter(v => v != null).reverse()

  const sparklines = [
    { key: 'bp_systolic',      label: 'BP Systolic', unit: 'mmHg', color: '#CC1414' },
    { key: 'pulse',            label: 'Pulse',       unit: 'bpm',  color: '#7c3aed' },
    { key: 'temperature',      label: 'Temperature', unit: '°C',   color: '#d97706' },
    { key: 'spo2',             label: 'SpO₂',        unit: '%',    color: '#065F46' },
  ]

  const handleSubmit = async e => {
    e.preventDefault()
    setErr('')
    try {
      await requestPin('Record vitals — authenticate to continue')
    } catch { return }
    setSaving(true)
    try {
      const payload = {}
      Object.entries(form).forEach(([k, v]) => {
        if (v !== '' && v != null) payload[k] = Number(v) || v
      })
      await api.post(`/inpatient/admissions/${admissionId}/vitals`, payload)
      setShowForm(false)
      setForm(VITALS_FORM_EMPTY)
      onReload()
    } catch (e) {
      setErr(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* Sparklines */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {sparklines.map(s => {
          const vals = sparklineData(s.key)
          const latest = vals[vals.length - 1]
          return (
            <div key={s.key} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <div className="flex items-end justify-between">
                <span className={`text-lg font-bold ${isAbnormal(s.key, latest) ? 'text-red-600' : 'text-gray-800'}`}>
                  {latest != null ? `${latest}` : '—'}
                  <span className="text-xs font-normal text-gray-400 ml-0.5">{s.unit}</span>
                </span>
                <Sparkline values={vals} width={80} height={32} color={s.color} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Record button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg"
          style={{ background: '#065F46' }}
        >
          <Plus size={15} /> Record Vitals
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Record New Vitals</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { key: 'temperature',       label: 'Temp (°C)',    type: 'number', step: '0.1' },
              { key: 'pulse',             label: 'Pulse (bpm)',  type: 'number' },
              { key: 'bp_systolic',       label: 'BP Sys (mmHg)',type: 'number' },
              { key: 'bp_diastolic',      label: 'BP Dia (mmHg)',type: 'number' },
              { key: 'spo2',              label: 'SpO₂ (%)',     type: 'number' },
              { key: 'respiration_rate',  label: 'RR (/min)',    type: 'number' },
              { key: 'pain_score',        label: 'Pain (0-10)',  type: 'number', min: 0, max: 10 },
              { key: 'blood_glucose',     label: 'Blood Glucose (mg/dL)', type: 'number' },
              { key: 'weight',            label: 'Weight (kg)',  type: 'number', step: '0.1' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                <input
                  type={f.type}
                  step={f.step}
                  min={f.min}
                  max={f.max}
                  value={form[f.key]}
                  onChange={set(f.key)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Optional notes..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {err && <p className="text-red-600 text-xs mt-2">{err}</p>}
          <div className="flex gap-2 mt-4 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50" style={{ background: '#065F46' }}>
              {saving ? 'Saving...' : 'Save Vitals'}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">Vitals History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {['Date/Time','Temp','Pulse','BP','SpO₂','RR','Pain','Notes'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {vitals.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No vitals recorded yet.</td></tr>
              ) : vitals.map((v, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtDateTime(v.recorded_at)}</td>
                  <td className={`px-3 py-2 ${vitalColor('temperature', v.temperature)}`}>
                    {v.temperature != null ? `${v.temperature}°C` : '—'}
                  </td>
                  <td className={`px-3 py-2 ${vitalColor('pulse', v.pulse)}`}>
                    {v.pulse != null ? `${v.pulse}` : '—'}
                  </td>
                  <td className={`px-3 py-2 ${vitalColor('bp_systolic', v.bp_systolic)}`}>
                    {v.bp_systolic != null ? `${v.bp_systolic}/${v.bp_diastolic ?? '—'}` : '—'}
                  </td>
                  <td className={`px-3 py-2 ${vitalColor('spo2', v.spo2)}`}>
                    {v.spo2 != null ? `${v.spo2}%` : '—'}
                  </td>
                  <td className={`px-3 py-2 ${vitalColor('respiration_rate', v.respiration_rate)}`}>
                    {v.respiration_rate != null ? `${v.respiration_rate}` : '—'}
                  </td>
                  <td className={`px-3 py-2 ${vitalColor('pain_score', v.pain_score)}`}>
                    {v.pain_score != null ? `${v.pain_score}/10` : '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{v.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Notes Tab — Cerner-style chronological documentation record ───────────────

const NOTE_TYPES = [
  { value: 'general',    label: 'General Note',       color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'shift',      label: 'Shift Summary',      color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'procedure',  label: 'Procedure Note',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'assessment', label: 'Assessment Note',    color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { value: 'event',      label: 'Incident / Event',   color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'io_entry',   label: 'I & O Entry',        color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { value: 'handoff',    label: 'Shift Handoff',      color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
]

const NOTE_COLOR = Object.fromEntries(NOTE_TYPES.map(t => [t.value, t.color]))
const NOTE_LABEL = Object.fromEntries(NOTE_TYPES.map(t => [t.value, t.label]))

function groupNotesByDate(notes) {
  const groups = {}
  notes.forEach(n => {
    const dt = n.written_at || n.created_at || ''
    const dateKey = dt ? new Date(dt).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Unknown Date'
    if (!groups[dateKey]) groups[dateKey] = []
    groups[dateKey].push(n)
  })
  return groups
}

// ── Chart Feed helpers ────────────────────────────────────────────────────────

const ENTRY_META = {
  vitals:          { label: 'Vitals',           icon: Thermometer,     bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-800 border-blue-200'   },
  nursing_note:    { label: 'Nursing Note',      icon: PenLine,         bg: 'bg-emerald-50',border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  progress_note:   { label: 'Progress Note',     icon: FileText,        bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-800 border-violet-200' },
  ward_round:      { label: 'Ward Round',        icon: Stethoscope,     bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-800 border-amber-200'  },
  medication:      { label: 'Medication',        icon: PillIcon,        bg: 'bg-pink-50',   border: 'border-pink-200',   badge: 'bg-pink-100 text-pink-800 border-pink-200'    },
  transfer:        { label: 'Transfer',          icon: ArrowRightLeft,  bg: 'bg-gray-50',   border: 'border-gray-200',   badge: 'bg-gray-100 text-gray-700 border-gray-200'    },
  session_divider: { label: 'Sign-Off',          icon: CheckCircle,     bg: 'bg-gray-50',   border: 'border-gray-300',   badge: 'bg-gray-200 text-gray-700 border-gray-300'    },
}

function VitalsBlock({ data }) {
  const items = [
    ['Temp', data.temperature != null ? `${data.temperature}°C` : null],
    ['Pulse', data.pulse != null ? `${data.pulse} bpm` : null],
    ['BP', data.bp_systolic != null ? `${data.bp_systolic}/${data.bp_diastolic} mmHg` : null],
    ['SpO2', data.spo2 != null ? `${data.spo2}%` : null],
    ['RR', data.respiration_rate != null ? `${data.respiration_rate}/min` : null],
    ['Pain', data.pain_score != null ? `${data.pain_score}/10` : null],
    ['Weight', data.weight != null ? `${data.weight} kg` : null],
  ].filter(([, v]) => v !== null)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
      {items.map(([label, val]) => (
        <div key={label} className="bg-white rounded-lg border border-gray-100 px-3 py-2">
          <div className="text-xs text-gray-400">{label}</div>
          <div className="font-semibold text-sm text-gray-800">{val}</div>
        </div>
      ))}
      {data.notes && (
        <div className="col-span-2 sm:col-span-4 text-xs text-gray-500 italic mt-1">{data.notes}</div>
      )}
    </div>
  )
}

function SOAPBlock({ data }) {
  const sections = [
    ['Subjective', data.subjective],
    ['Objective', data.objective],
    ['Assessment', data.assessment],
    ['Plan', data.plan],
  ].filter(([, v]) => v)
  if (!sections.length) return null
  return (
    <div className="mt-2 space-y-2">
      {sections.map(([label, text]) => (
        <div key={label}>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">{text}</p>
        </div>
      ))}
    </div>
  )
}

function ChartEntry({ entry }) {
  const meta = ENTRY_META[entry.type] || ENTRY_META.nursing_note
  const Icon = meta.icon

  if (entry.type === 'session_divider') {
    return (
      <div className="relative flex items-center gap-3 py-2 my-1 print:my-0">
        <div className="flex-1 h-px bg-gray-400" />
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-300 text-xs font-semibold text-gray-600 whitespace-nowrap">
          <CheckCircle size={12} className="text-emerald-600" />
          {entry.written_by_name} signed off · {fmtDateTime(entry.timestamp)}
          {entry.data?.shift && <span className="text-gray-400 ml-1">({entry.data.shift} shift)</span>}
        </div>
        <div className="flex-1 h-px bg-gray-400" />
      </div>
    )
  }

  return (
    <div className={`rounded-lg border ${meta.border} ${meta.bg} mb-3 overflow-hidden shadow-sm print:shadow-none print:border-gray-300`}>
      {/* Entry header */}
      <div className="flex items-center gap-2.5 px-4 py-2 border-b border-white/60 bg-white/50">
        <Icon size={14} className="text-gray-500 flex-shrink-0" />
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${meta.badge}`}>
          {entry.data?.note_type
            ? (entry.data.note_type.charAt(0).toUpperCase() + entry.data.note_type.slice(1).replace(/_/g, ' '))
            : meta.label}
        </span>
        <span className="text-sm font-semibold text-gray-800">{entry.written_by_name}</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-500 font-mono">{fmtDateTime(entry.timestamp)}</span>
        {entry.data?.is_significant && (
          <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Significant</span>
        )}
        {entry.data?.is_handoff && (
          <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Handoff Note</span>
        )}
      </div>

      {/* Entry body */}
      <div className="px-4 py-3">
        {entry.type === 'vitals' && <VitalsBlock data={entry.data} />}
        {(entry.type === 'progress_note' || entry.type === 'ward_round') && (
          entry.data?.subjective || entry.data?.objective || entry.data?.assessment || entry.data?.plan
            ? <SOAPBlock data={entry.data} />
            : <p className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">{entry.rendered_text}</p>
        )}
        {(entry.type === 'nursing_note' || entry.type === 'medication' || entry.type === 'transfer') && (
          <p className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">{entry.rendered_text}</p>
        )}
      </div>
    </div>
  )
}

const DOT_PHRASES = {
  '.soap': 'Subjective:\n\nObjective:\n\nAssessment:\n\nPlan:\n',
  '.shift': 'Shift Summary:\n\nPatient Condition:\nStable / Unstable\n\nCare Provided:\n\nPending Tasks:\n',
  '.normal': 'Patient alert and oriented x3. Vital signs within normal limits. No acute distress noted. Comfortable on current management.',
  '.pain': 'Pain Assessment:\nLocation: \nCharacter: \nSeverity (0-10): \nAggravating factors: \nRelieving factors: \nIntervention: \nResponse: ',
  '.fall': 'Fall Prevention:\nMorse Fall Score: \nBed in lowest position: Yes / No\nCall bell within reach: Yes / No\nNon-slip footwear: Yes / No\nBed rails up: Yes / No',
}

function ChartFeedTab({ admissionId, admission }) {
  const { requestPin } = usePin()
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [noteType, setNoteType] = useState('general')
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [signingOff, setSigningOff] = useState(false)
  const [err, setErr] = useState('')

  const fetchTimeline = useCallback(() => {
    setLoading(true)
    api.get(`/inpatient/admissions/${admissionId}/timeline`)
      .then(data => setTimeline(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [admissionId])

  useEffect(() => { fetchTimeline() }, [fetchTimeline])

  const handleTextChange = (e) => {
    let val = e.target.value
    Object.entries(DOT_PHRASES).forEach(([phrase, expansion]) => {
      if (val.endsWith(phrase)) val = val.slice(0, -phrase.length) + expansion
    })
    setNoteText(val)
  }

  const handleSaveNote = async () => {
    if (!noteText.trim()) { setErr('Note text is required'); return }
    setErr('')
    try { await requestPin('Sign and save nursing note') } catch { return }
    setSaving(true)
    try {
      await api.post(`/inpatient/admissions/${admissionId}/notes`, {
        note_type: noteType,
        note_text: noteText,
      })
      setShowForm(false)
      setNoteText('')
      setNoteType('general')
      fetchTimeline()
    } catch (e) {
      setErr(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOff = async () => {
    try { await requestPin('Sign off and close documentation session') } catch { return }
    setSigningOff(true)
    try {
      await api.post(`/inpatient/admissions/${admissionId}/documentation-session`, {})
      fetchTimeline()
    } catch (e) {
      alert(e.message || 'Sign-off failed')
    } finally {
      setSigningOff(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Group timeline by date for display
  const grouped = timeline.reduce((acc, entry) => {
    if (!entry.timestamp) return acc
    const dateKey = new Date(entry.timestamp).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(entry)
    return acc
  }, {})
  const dateKeys = Object.keys(grouped)

  return (
    <div className="max-w-3xl mx-auto print:max-w-none">
      {/* ── Action bar (hidden in print) ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 print:hidden">
        <div className="text-sm font-semibold text-gray-700 flex-1">
          Patient Chart
          <span className="ml-2 text-xs font-normal text-gray-400">({timeline.length} {timeline.length === 1 ? 'entry' : 'entries'})</span>
        </div>
        <button onClick={fetchTimeline} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="Refresh">
          <RefreshCw size={14} />
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
        >
          <Printer size={14} /> Print
        </button>
        <button
          onClick={handleSignOff}
          disabled={signingOff}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-emerald-300 rounded-lg text-emerald-700 hover:bg-emerald-50 font-medium disabled:opacity-50"
        >
          <ClipboardCheck size={14} /> {signingOff ? 'Signing…' : 'Sign & Close'}
        </button>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm hover:opacity-90"
          style={{ background: '#065F46' }}
        >
          <Plus size={15} /> New Note
        </button>
      </div>

      {/* ── Print header (only visible in print) ── */}
      <div className="hidden print:block px-6 py-4 border-b border-gray-400 mb-4">
        <div className="text-lg font-bold text-gray-900">Patient Chart — {admission?.patient_name || 'Unknown'}</div>
        <div className="text-sm text-gray-600 mt-1">
          UHID: {admission?.uhid || '—'} · Admission: {admission?.admission_number || '—'} · Admitted: {fmtDate(admission?.admitted_at)}
          <span className="ml-4">Dept: {admission?.department_name} · Ward: {admission?.ward_name} · Bed: {admission?.bed_number}</span>
        </div>
        <div className="text-xs text-gray-400 mt-1">Printed on {new Date().toLocaleString('en-IN')}</div>
      </div>

      <div className="px-6 py-4">
        {/* New note form */}
        {showForm && (
          <div className="mb-6 bg-white rounded-xl border-2 border-emerald-400 shadow-lg print:hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-emerald-50 rounded-t-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-semibold text-emerald-800">New Note — Draft</span>
              <button onClick={() => { setShowForm(false); setNoteText(''); setErr('') }} className="ml-auto text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {NOTE_TYPES.map(t => (
                  <button key={t.value} onClick={() => setNoteType(t.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                      noteType === t.value ? t.color + ' border' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-500">Note Content</label>
                  <span className="text-xs text-gray-400">Dot phrases: .soap .shift .normal .pain .fall</span>
                </div>
                <textarea rows={7} value={noteText} onChange={handleTextChange} autoFocus
                  placeholder="Begin typing…&#10;Dot phrases: .soap → SOAP format  .shift → Shift summary  .pain → Pain assessment"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none font-mono leading-relaxed" />
              </div>
              {err && <p className="text-red-600 text-xs">{err}</p>}
              <div className="flex items-center gap-3 justify-end pt-1">
                <button onClick={() => { setShowForm(false); setNoteText(''); setErr('') }}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Discard</button>
                <button onClick={handleSaveNote} disabled={saving || !noteText.trim()}
                  className="px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-40 flex items-center gap-2 shadow-sm"
                  style={{ background: '#065F46' }}>
                  <CheckCircle size={14} />
                  {saving ? 'Saving…' : 'Sign & Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20 print:hidden">
            <Loader2 size={28} className="animate-spin text-gray-400" />
          </div>
        )}

        {!loading && timeline.length === 0 && (
          <div className="text-center py-16 text-gray-400 print:hidden">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No chart entries yet</p>
            <p className="text-sm mt-1">Vitals, notes, orders and medications will appear here as they are documented</p>
          </div>
        )}

        {/* Chronological feed grouped by date */}
        {!loading && dateKeys.map((dateKey, di) => (
          <div key={dateKey}>
            <div className="flex items-center gap-3 py-3">
              <div className="flex-1 h-px bg-gray-300" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider px-2 bg-gray-50 whitespace-nowrap print:bg-white">
                {dateKey}
              </span>
              <div className="flex-1 h-px bg-gray-300" />
            </div>

            {grouped[dateKey].map((entry, i) => (
              <ChartEntry key={`${entry.type}-${entry.entry_id}-${i}`} entry={entry} />
            ))}

            {di < dateKeys.length - 1 && <div className="h-px bg-gray-200 my-3 print:bg-gray-400" />}
          </div>
        ))}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          [class*="print:hidden"] { display: none !important; }
          .max-w-3xl { max-width: 100% !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  )
}

// ── MAR Tab ───────────────────────────────────────────────────────────────────

function MARTab({ admissionId, mar, onReload }) {
  const { requestPin } = usePin()
  const [acting, setActing] = useState(null)

  const statusBadge = (status) => {
    const map = {
      given:     'bg-green-100 text-green-700',
      scheduled: 'bg-gray-100 text-gray-600',
      held:      'bg-amber-100 text-amber-700',
      refused:   'bg-red-100 text-red-700',
      missed:    'bg-red-100 text-red-700',
    }
    return map[status?.toLowerCase()] || 'bg-gray-100 text-gray-600'
  }

  const handleAction = async (entryId, newStatus, reason = '') => {
    try { await requestPin(`${newStatus === 'given' ? 'Administer' : 'Hold'} medication`) } catch { return }
    setActing(entryId)
    try {
      await api.patch(`/inpatient/mar/${entryId}`, { status: newStatus, notes: reason })
      onReload()
    } catch (e) {
      alert(e.message || 'Action failed')
    } finally {
      setActing(null)
    }
  }

  // Group by order (drug name)
  const groups = {}
  mar.forEach(entry => {
    const key = entry.drug_name || entry.medication_name || entry.order_id || `Order-${entry.id}`
    if (!groups[key]) groups[key] = []
    groups[key].push(entry)
  })

  const scheduled = Object.entries(groups).filter(([, entries]) =>
    entries.some(e => (e.frequency || '').toLowerCase() !== 'prn')
  )
  const prn = Object.entries(groups).filter(([, entries]) =>
    entries.every(e => (e.frequency || '').toLowerCase() === 'prn')
  )

  const renderGroup = ([drug, entries]) => (
    <div key={drug} className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
        <span className="font-semibold text-sm text-gray-800">{drug}</span>
        {entries[0]?.dose && (
          <span className="text-xs text-gray-500 ml-2">
            {entries[0].dose}{entries[0].unit ? ` ${entries[0].unit}` : ''} · {entries[0].route || ''} · {entries[0].frequency || ''}
          </span>
        )}
      </div>
      <div className="divide-y divide-gray-50">
        {entries.map((e, i) => {
          const isScheduled = e.status?.toLowerCase() === 'scheduled' || !e.status
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xs text-gray-500 w-16 flex-shrink-0">{fmtTime(e.scheduled_time || e.time)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusBadge(e.status)}`}>
                {e.status || 'Scheduled'}
              </span>
              {e.administered_by && (
                <span className="text-xs text-gray-400 truncate">{e.administered_by}</span>
              )}
              {e.administered_at && (
                <span className="text-xs text-gray-400">{fmtTime(e.administered_at)}</span>
              )}
              {isScheduled && (
                <div className="ml-auto flex gap-2">
                  <button
                    disabled={acting === e.id}
                    onClick={() => handleAction(e.id, 'given')}
                    className="px-3 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                  >
                    Give
                  </button>
                  <button
                    disabled={acting === e.id}
                    onClick={() => {
                      const reason = prompt('Reason for hold:')
                      if (reason !== null) handleAction(e.id, 'held', reason)
                    }}
                    className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg disabled:opacity-50"
                  >
                    Hold
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  if (mar.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400">
        <Pill size={32} className="mx-auto mb-2 opacity-40" />
        <p>No medication administration records found.</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {scheduled.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-700 text-sm mb-3">Scheduled Medications</h3>
          {scheduled.map(renderGroup)}
        </div>
      )}
      {prn.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-700 text-sm mb-3">PRN Medications</h3>
          {prn.map(renderGroup)}
        </div>
      )}
    </div>
  )
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

function OrdersTab({ admissionId, orders, onReload }) {
  const { requestPin } = usePin()
  const [acting, setActing] = useState(null)

  const typeChip = (type) => {
    const map = {
      lab:       'bg-blue-100 text-blue-700',
      imaging:   'bg-purple-100 text-purple-700',
      diet:      'bg-green-100 text-green-700',
      nursing:   'bg-teal-100 text-teal-700',
      consult:   'bg-orange-100 text-orange-700',
      procedure: 'bg-red-100 text-red-700',
    }
    return map[type?.toLowerCase()] || 'bg-gray-100 text-gray-600'
  }

  const priorityChip = (p) => {
    if (!p) return 'bg-gray-100 text-gray-500'
    const lc = p.toLowerCase()
    if (lc === 'stat') return 'bg-red-100 text-red-700'
    if (lc === 'urgent') return 'bg-amber-100 text-amber-700'
    return 'bg-gray-100 text-gray-500'
  }

  const statusColor = (s) => {
    const map = {
      pending:       'text-amber-600',
      acknowledged:  'text-blue-600',
      in_progress:   'text-purple-600',
      completed:     'text-emerald-600',
    }
    return map[s?.toLowerCase()] || 'text-gray-500'
  }

  const doAction = async (orderId, action) => {
    try { await requestPin(`${action.charAt(0).toUpperCase() + action.slice(1)} clinical order`) } catch { return }
    setActing(orderId)
    try {
      await api.post(`/inpatient/clinical-orders/${orderId}/${action}`)
      onReload()
    } catch (e) {
      alert(e.message || 'Action failed')
    } finally {
      setActing(null)
    }
  }

  if (orders.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400">
        <ClipboardList size={32} className="mx-auto mb-2 opacity-40" />
        <p>No clinical orders found.</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-3">
      {orders.map((o, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeChip(o.order_type)}`}>
                  {o.order_type || 'Order'}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityChip(o.priority)}`}>
                  {o.priority || 'Routine'}
                </span>
                <span className={`text-xs font-semibold ml-auto ${statusColor(o.status)}`}>
                  {(o.status || 'pending').replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <div className="font-semibold text-sm text-gray-800">{o.order_text || o.description || o.name || `Order #${o.id}`}</div>
              {o.notes && <p className="text-xs text-gray-500 mt-1">{o.notes}</p>}
              <p className="text-xs text-gray-400 mt-1">
                {o.ordered_by && `Ordered by ${o.ordered_by} · `}
                {fmtDateTime(o.created_at || o.ordered_at)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            {o.status?.toLowerCase() === 'pending' && (
              <button
                disabled={acting === o.id}
                onClick={() => doAction(o.id, 'acknowledge')}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                Acknowledge
              </button>
            )}
            {o.status?.toLowerCase() === 'acknowledged' && (
              <button
                disabled={acting === o.id}
                onClick={() => doAction(o.id, 'complete')}
                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
              >
                Complete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Assessments Tab ───────────────────────────────────────────────────────────

function AssessmentModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="font-bold text-gray-800 text-lg">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function PlaceholderForm({ title, onClose }) {
  return (
    <div className="p-8 text-center text-gray-400">
      <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium text-gray-500">{title}</p>
      <p className="text-sm mt-1">Coming soon</p>
      <button onClick={onClose} className="mt-6 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
        Close
      </button>
    </div>
  )
}

const ASSESSMENTS_CONFIG = [
  { key: 'braden',       label: 'Braden Scale',       desc: 'Pressure ulcer risk',      iconBg: 'bg-red-50',    iconColor: 'text-red-500',    Icon: AlertTriangle },
  { key: 'gcs',          label: 'GCS',                desc: 'Consciousness level',       iconBg: 'bg-blue-50',   iconColor: 'text-blue-500',   Icon: Activity      },
  { key: 'morse',        label: 'Morse Fall Scale',   desc: 'Fall risk assessment',      iconBg: 'bg-yellow-50', iconColor: 'text-yellow-600', Icon: AlertTriangle },
  { key: 'pain',         label: 'Pain Assessment',    desc: 'Pain scale & location',     iconBg: 'bg-orange-50', iconColor: 'text-orange-500', Icon: Activity      },
  { key: 'io',           label: 'I&O Chart',          desc: 'Intake & output tracking',  iconBg: 'bg-teal-50',   iconColor: 'text-teal-600',   Icon: BarChart2     },
  { key: 'wound',        label: 'Wound Care',         desc: 'Wound assessment & care',   iconBg: 'bg-purple-50', iconColor: 'text-purple-500', Icon: FileText      },
  { key: 'restraint',    label: 'Restraint',          desc: 'Restraint monitoring',      iconBg: 'bg-gray-50',   iconColor: 'text-gray-500',   Icon: ClipboardList },
  { key: 'nih',          label: 'NIH Stroke Scale',   desc: 'Neurological assessment',   iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500', Icon: Stethoscope   },
  { key: 'nutritional',  label: 'Nutritional Screen', desc: 'Nutritional risk screen',   iconBg: 'bg-green-50',  iconColor: 'text-green-600',  Icon: Utensils      },
  { key: 'skin',         label: 'Skin Assessment',    desc: 'Skin integrity review',     iconBg: 'bg-pink-50',   iconColor: 'text-pink-500',   Icon: FlaskConical  },
]

// ── Dynamic Assessment Form (renders any template from DB) ───────────────────

function DynamicAssessmentForm({ template, admission, onClose }) {
  const { requestPin } = usePin()
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (key, val) => setValues(v => ({ ...v, [key]: val }))

  const handleSave = async () => {
    const missing = template.fields.filter(f => f.required && !values[f.key]?.toString().trim())
    if (missing.length) { setErr(`Required: ${missing.map(f => f.label).join(', ')}`); return }
    setErr('')
    try { await requestPin(`Save ${template.name}`) } catch { return }
    setSaving(true)
    try {
      const lines = template.fields
        .filter(f => values[f.key] !== undefined && values[f.key] !== '')
        .map(f => `${f.label}${f.unit ? ` (${f.unit})` : ''}: ${values[f.key]}`)
      const noteText = `${template.name.toUpperCase()}\nSpecialty: ${template.specialty}\n\n${lines.join('\n')}`
      await api.post(`/inpatient/admissions/${admission.id}/notes`, {
        note_type: 'assessment',
        note_text: noteText,
      })
      onClose()
    } catch (e) {
      setErr(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {template.description && (
        <p className="text-sm text-gray-500 italic">{template.description}</p>
      )}
      <div className="space-y-3">
        {template.fields.map(f => (
          <div key={f.key}>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              {f.label}{f.unit && <span className="text-gray-400 font-normal ml-1">({f.unit})</span>}
              {f.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {f.type === 'text' && (
              <input value={values[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            )}
            {f.type === 'number' && (
              <input type="number" value={values[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            )}
            {f.type === 'textarea' && (
              <textarea rows={3} value={values[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            )}
            {f.type === 'select' && (
              <select value={values[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="">Select…</option>
                {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {f.type === 'radio' && (
              <div className="flex flex-wrap gap-3 mt-1">
                {(f.options || []).map(o => (
                  <label key={o} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name={f.key} value={o} checked={values[f.key] === o}
                      onChange={() => set(f.key, o)} className="accent-emerald-600" />
                    {o}
                  </label>
                ))}
              </div>
            )}
            {f.type === 'checkbox' && (
              <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
                <input type="checkbox" checked={!!values[f.key]}
                  onChange={e => set(f.key, e.target.checked ? 'Yes' : 'No')} className="accent-emerald-600" />
                Yes
              </label>
            )}
          </div>
        ))}
      </div>
      {err && <p className="text-red-600 text-xs">{err}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-40 flex items-center gap-2"
          style={{ background: '#065F46' }}>
          <CheckCircle size={14} />
          {saving ? 'Saving…' : 'Sign & Save'}
        </button>
      </div>
    </div>
  )
}

function AssessmentsTab({ admission }) {
  const [openKey, setOpenKey] = useState(null)
  const [dynamicTemplates, setDynamicTemplates] = useState([])
  const [dynLoading, setDynLoading] = useState(true)
  const [openDynamic, setOpenDynamic] = useState(null)

  useEffect(() => {
    const deptId = admission?.department_id
    const params = deptId ? { department_id: deptId } : {}
    api.get('/inpatient/assessment-templates', { params })
      .then(data => setDynamicTemplates(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setDynLoading(false))
  }, [admission?.id])

  const renderBuiltIn = (key) => {
    const closeModal = () => setOpenKey(null)
    const forms = {
      braden:    <BradenForm admission={admission} onClose={closeModal} />,
      gcs:       <GCSForm admission={admission} onClose={closeModal} />,
      morse:     <MorseForm admission={admission} onClose={closeModal} />,
      pain:      <PainForm admission={admission} onClose={closeModal} />,
      io:        <IOChartForm admission={admission} onClose={closeModal} />,
      wound:     <WoundCareForm admission={admission} onClose={closeModal} />,
      restraint: <RestraintForm admission={admission} onClose={closeModal} />,
    }
    return forms[key] || <PlaceholderForm title={ASSESSMENTS_CONFIG.find(a => a.key === key)?.label || key} onClose={closeModal} />
  }

  const openAssessment = ASSESSMENTS_CONFIG.find(a => a.key === openKey)

  // Group dynamic templates by specialty
  const grouped = dynamicTemplates.reduce((acc, t) => {
    if (!acc[t.specialty]) acc[t.specialty] = []
    acc[t.specialty].push(t)
    return acc
  }, {})

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      {/* Built-in clinical assessments */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Standard Assessments</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {ASSESSMENTS_CONFIG.map(a => (
            <button key={a.key} onClick={() => setOpenKey(a.key)}
              className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-emerald-400 hover:shadow-md transition-all group">
              <div className={`w-9 h-9 rounded-lg ${a.iconBg} flex items-center justify-center mb-3`}>
                <a.Icon size={18} className={a.iconColor} />
              </div>
              <div className="font-semibold text-sm text-gray-800 group-hover:text-emerald-700">{a.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{a.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic templates from superadmin/clinic */}
      {!dynLoading && dynamicTemplates.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Specialty Assessment Forms</p>
          {Object.entries(grouped).map(([specialty, templates]) => (
            <div key={specialty} className="mb-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">{specialty}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {templates.map(t => (
                  <button key={t.id} onClick={() => setOpenDynamic(t)}
                    className="bg-white border border-indigo-100 rounded-xl p-4 text-left hover:border-indigo-400 hover:shadow-md transition-all group">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center mb-3">
                      <FileText size={18} className="text-indigo-500" />
                    </div>
                    <div className="font-semibold text-sm text-gray-800 group-hover:text-indigo-700">{t.name}</div>
                    {t.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.description}</div>}
                    <div className="text-xs text-indigo-400 mt-1">{t.fields?.length || 0} fields</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {dynLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={14} className="animate-spin" /> Loading specialty forms…
        </div>
      )}

      {/* Built-in form modal */}
      {openKey && (
        <AssessmentModal title={openAssessment?.label || openKey} onClose={() => setOpenKey(null)}>
          {renderBuiltIn(openKey)}
        </AssessmentModal>
      )}

      {/* Dynamic template modal */}
      {openDynamic && (
        <AssessmentModal title={openDynamic.name} onClose={() => setOpenDynamic(null)}>
          <DynamicAssessmentForm
            template={openDynamic}
            admission={admission}
            onClose={() => setOpenDynamic(null)}
          />
        </AssessmentModal>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PatientChart() {
  const { admissionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isDoctor = ['doctor', 'clinic_admin', 'provider'].includes(user?.role)
  const [admission, setAdmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('Overview')

  // Tab-specific data
  const [vitals, setVitals] = useState([])
  const [notes, setNotes] = useState([])
  const [mar, setMAR] = useState([])
  const [orders, setOrders] = useState([])
  const [meds, setMeds] = useState([])

  const fetchAdmission = useCallback(() => {
    return api.get(`/inpatient/admissions/${admissionId}`)
      .then(data => setAdmission(data))
      .catch(e => setError(e.message || 'Failed to load patient'))
  }, [admissionId])

  const fetchVitals = useCallback(() => {
    api.get(`/inpatient/admissions/${admissionId}/vitals`)
      .then(data => setVitals(Array.isArray(data) ? data : (data.items || [])))
      .catch(() => {})
  }, [admissionId])

  const fetchNotes = useCallback(() => {
    api.get(`/inpatient/admissions/${admissionId}/notes`)
      .then(data => setNotes(Array.isArray(data) ? data : (data.items || data.notes || [])))
      .catch(() => {})
  }, [admissionId])

  const fetchMAR = useCallback(() => {
    api.get(`/inpatient/admissions/${admissionId}/mar`)
      .then(data => setMAR(Array.isArray(data) ? data : (data.items || data.entries || [])))
      .catch(() => {})
  }, [admissionId])

  const fetchOrders = useCallback(() => {
    api.get(`/inpatient/admissions/${admissionId}/clinical-orders`)
      .then(data => setOrders(Array.isArray(data) ? data : (data.items || data.orders || [])))
      .catch(() => {})
  }, [admissionId])

  const fetchMeds = useCallback(() => {
    api.get(`/inpatient/admissions/${admissionId}/medications`)
      .then(data => setMeds(Array.isArray(data) ? data : (data.items || data.medications || [])))
      .catch(() => setMeds([]))
  }, [admissionId])

  useEffect(() => {
    setLoading(true)
    fetchAdmission().finally(() => setLoading(false))
    fetchVitals()
    fetchNotes()
    fetchMAR()
    fetchOrders()
    fetchMeds()
  }, [admissionId]) // eslint-disable-line

  const pendingTasks = orders.filter(o => o.status === 'pending').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !admission) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle size={32} className="mx-auto mb-3 text-red-400" />
        <p className="text-red-600 font-medium">{error || 'Patient not found'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-emerald-600 underline">Go back</button>
      </div>
    )
  }

  const tabs = isDoctor ? PROVIDER_TABS : NURSE_TABS

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PatientBanner admission={admission} onBack={() => navigate(-1)} />
      <TabBar active={activeTab} setActive={setActiveTab} tabs={tabs} />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {activeTab === 'Overview' && (
          <OverviewTab
            admission={admission}
            vitals={vitals}
            notes={notes}
            meds={meds.length > 0 ? meds : mar.filter(m => m.status?.toLowerCase() === 'scheduled' || !m.status)}
            tasks={pendingTasks}
          />
        )}
        {activeTab === 'Vitals' && (
          <VitalsTab admissionId={admissionId} vitals={vitals} onReload={fetchVitals} />
        )}
        {activeTab === 'I & O' && (
          <div className="p-4 max-w-4xl mx-auto">
            <IOChartForm admission={admission} onClose={null} />
          </div>
        )}
        {activeTab === 'Chart' && (
          <ChartFeedTab admissionId={admissionId} admission={admission} />
        )}
        {activeTab === 'MAR' && (
          <MARTab admissionId={admissionId} mar={mar} onReload={fetchMAR} />
        )}
        {activeTab === 'Orders' && (
          <OrdersTab admissionId={admissionId} orders={orders} onReload={fetchOrders} />
        )}
        {activeTab === 'Assessments' && (
          <AssessmentsTab admission={admission} />
        )}
      </div>
    </div>
  )
}
