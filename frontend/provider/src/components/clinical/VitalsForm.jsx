/**
 * Standardized vitals collection form — used in:
 *   - Triage page (receptionist)
 *   - Encounter chart (nurse/provider inline edit)
 *   - Patient chart sidebar
 *
 * Props:
 *   patientId     {number}   required
 *   appointmentId {number}   required
 *   initialValues {object}   pre-fill from existing vitals record
 *   compact       {boolean}  2-col grid instead of 4-col (for sidebars/modals)
 *   readOnly      {boolean}  display-only mode
 *   onSaved       {fn}       called with the saved vitals object after successful POST
 *   hideHeader    {boolean}  suppress the "Vitals" heading row
 */

import { useState } from 'react'
import api from '../../api/client'
import { Activity, Save, CheckCircle, Edit2, AlertTriangle } from 'lucide-react'

// ── Field definitions ──────────────────────────────────────────────────────────
export const VITALS_FIELDS = [
  {
    key: 'blood_pressure_systolic',
    label: 'BP Systolic',
    unit: 'mmHg',
    min: 50, max: 250,
    normal: [90, 120],
    high: 140,
    group: 'bp',
  },
  {
    key: 'blood_pressure_diastolic',
    label: 'BP Diastolic',
    unit: 'mmHg',
    min: 30, max: 150,
    normal: [60, 80],
    high: 90,
    group: 'bp',
  },
  {
    key: 'pulse_rate',
    label: 'Pulse Rate',
    unit: 'bpm',
    min: 20, max: 300,
    normal: [60, 100],
    low: 60,
    high: 100,
  },
  {
    key: 'temperature',
    label: 'Temperature',
    unit: '°F',
    min: 90, max: 110,
    step: '0.1',
    normal: [97, 99],
    high: 100.4,
  },
  {
    key: 'weight_kg',
    label: 'Weight',
    unit: 'kg',
    min: 1, max: 300,
    step: '0.1',
  },
  {
    key: 'height_cm',
    label: 'Height',
    unit: 'cm',
    min: 30, max: 250,
    step: '0.1',
  },
  {
    key: 'oxygen_saturation',
    label: 'SpO₂',
    unit: '%',
    min: 50, max: 100,
    normal: [95, 100],
    low: 94,
    critical: 90,
  },
  {
    key: 'blood_sugar',
    label: 'Blood Sugar (RBS)',
    unit: 'mg/dL',
    min: 20, max: 600,
    step: '0.1',
    normal: [70, 140],
    high: 200,
  },
]

// ── Clinical interpretation helpers ───────────────────────────────────────────
function flagValue(field, val) {
  if (!val || !field) return null
  const n = parseFloat(val)
  if (field.critical !== undefined && n <= field.critical) return 'critical'
  if (field.low !== undefined && n < field.low) return 'low'
  if (field.high !== undefined && n > field.high) return 'high'
  if (field.normal && (n < field.normal[0] || n > field.normal[1])) return 'abnormal'
  return 'normal'
}

const FLAG_STYLE = {
  normal:   { color: '#16a34a', bg: '#f0fdf4', label: '✓' },
  abnormal: { color: '#ca8a04', bg: '#fefce8', label: '!' },
  low:      { color: '#2563eb', bg: '#eff6ff', label: '↓' },
  high:     { color: '#ea580c', bg: '#fff7ed', label: '↑' },
  critical: { color: '#CC1414', bg: '#fef2f2', label: '‼' },
}

function bmiCalc(weight, height) {
  if (!weight || !height) return null
  const bmi = parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)
  if (isNaN(bmi)) return null
  let cat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese'
  return { value: bmi.toFixed(1), cat }
}

function mapBpCategory(sys, dia) {
  const s = parseFloat(sys), d = parseFloat(dia)
  if (!s || !d) return null
  if (s < 120 && d < 80)  return { label: 'Normal BP',       color: '#16a34a' }
  if (s < 130 && d < 80)  return { label: 'Elevated BP',     color: '#ca8a04' }
  if (s < 140 || d < 90)  return { label: 'Stage 1 HTN',     color: '#ea580c' }
  return                          { label: 'Stage 2 HTN',     color: '#CC1414' }
}

// ── Read-only display ─────────────────────────────────────────────────────────
export function VitalsDisplay({ values = {}, compact = false }) {
  const bmi = bmiCalc(values.weight_kg, values.height_cm)
  const bp  = mapBpCategory(values.blood_pressure_systolic, values.blood_pressure_diastolic)

  const chips = VITALS_FIELDS
    .map(f => {
      const v = values[f.key]
      if (!v) return null
      const flag = flagValue(f, v)
      const style = FLAG_STYLE[flag] || FLAG_STYLE.normal
      return { label: f.key === 'blood_pressure_systolic'
        ? `BP ${v}/${values.blood_pressure_diastolic ?? '?'} ${f.unit}`
        : `${f.label.replace(' (RBS)','')} ${v} ${f.unit}`,
        flag, style,
        skip: f.key === 'blood_pressure_diastolic', // merged into BP chip
      }
    })
    .filter(Boolean)
    .filter(c => !c.skip)

  if (chips.length === 0) return null

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {chips.map((c, i) => (
          <div key={i}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
            style={{ background: c.style.bg, color: c.style.color, borderColor: c.style.color + '30' }}
          >
            {c.label}
            {c.flag !== 'normal' && (
              <span className="font-bold">{c.style.label}</span>
            )}
          </div>
        ))}
        {bmi && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 bg-gray-50">
            BMI {bmi.value} <span className="text-gray-400">({bmi.cat})</span>
          </div>
        )}
        {bp && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ background: bp.color }}>
            {bp.label}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function VitalsForm({
  patientId,
  appointmentId,
  initialValues = {},
  compact = false,
  readOnly = false,
  onSaved,
  hideHeader = false,
}) {
  const [values, setValues] = useState(
    VITALS_FIELDS.reduce((acc, f) => {
      acc[f.key] = initialValues[f.key] ?? ''
      return acc
    }, {})
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [editMode, setEditMode] = useState(!readOnly || !Object.values(initialValues).some(Boolean))

  const set = (key, val) => {
    setSaved(false)
    setValues(v => ({ ...v, [key]: val }))
  }

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      const payload = { patient_id: patientId, appointment_id: appointmentId }
      VITALS_FIELDS.forEach(f => {
        const v = values[f.key]
        if (v !== '' && v !== null && v !== undefined) {
          payload[f.key] = f.step ? parseFloat(v) : parseInt(v, 10)
        }
      })
      await api.post('/appointments/vitals', payload)
      setSaved(true)
      setEditMode(false)
      onSaved?.(payload)
    } catch (e) {
      setError(e.message || 'Failed to save vitals')
    } finally {
      setSaving(false)
    }
  }

  const bmi = bmiCalc(values.weight_kg, values.height_cm)
  const bp  = mapBpCategory(values.blood_pressure_systolic, values.blood_pressure_diastolic)
  const cols = compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'

  // ── Read-only summary ────────────────────────────────────────────────────────
  if (!editMode) {
    return (
      <div>
        {!hideHeader && (
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={15} style={{ color: '#CC1414' }} />
              <span className="font-semibold text-gray-800 text-sm">Vitals</span>
              {saved && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12} /> Saved</span>}
            </div>
            {!readOnly && (
              <button onClick={() => setEditMode(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <Edit2 size={12} /> Edit
              </button>
            )}
          </div>
        )}
        <VitalsDisplay values={values} compact={compact} />
      </div>
    )
  }

  // ── Edit form ────────────────────────────────────────────────────────────────
  return (
    <div>
      {!hideHeader && (
        <div className="flex items-center gap-2 mb-4">
          <Activity size={15} style={{ color: '#CC1414' }} />
          <span className="font-semibold text-gray-800 text-sm">Vitals</span>
        </div>
      )}

      <div className={`grid ${cols} gap-3`}>
        {VITALS_FIELDS.map(f => {
          const val = values[f.key]
          const flag = flagValue(f, val)
          const style = flag && flag !== 'normal' ? FLAG_STYLE[flag] : null

          return (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{f.label}</label>
              <div className="relative">
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step || '1'}
                  placeholder="—"
                  value={val}
                  onChange={e => set(f.key, e.target.value)}
                  className="input pr-14 text-sm"
                  style={style ? { borderColor: style.color, background: style.bg } : {}}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none select-none">
                  {f.unit}
                </span>
                {style && (
                  <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs font-bold pointer-events-none" style={{ color: style.color }}>
                    {style.label}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Live clinical indicators */}
      {(bp || bmi) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {bp && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
              style={{ background: bp.color }}>
              {bp.label}
            </span>
          )}
          {bmi && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-gray-200 text-gray-700 bg-gray-50">
              BMI {bmi.value} — {bmi.cat}
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
          style={{ background: '#CC1414' }}
        >
          <Save size={14} /> {saving ? 'Saving…' : 'Save Vitals'}
        </button>
        {readOnly && Object.values(initialValues).some(Boolean) && (
          <button onClick={() => setEditMode(false)} className="text-sm text-gray-500 hover:underline">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
