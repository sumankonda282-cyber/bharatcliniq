
import { useState, useEffect } from 'react'
import { usePin } from '../../contexts/PinContext'
import { AlertTriangle } from 'lucide-react'
import api from '../../api/client'
import SignatureBlock from '../SignatureBlock'

const SUBSCALES = [
  {
    key: 'sensory',
    label: 'Sensory Perception',
    options: [
      { value: 1, label: '1 — Completely limited' },
      { value: 2, label: '2 — Very limited' },
      { value: 3, label: '3 — Slightly limited' },
      { value: 4, label: '4 — No impairment' },
    ],
  },
  {
    key: 'moisture',
    label: 'Moisture',
    options: [
      { value: 1, label: '1 — Constantly moist' },
      { value: 2, label: '2 — Very moist' },
      { value: 3, label: '3 — Occasionally moist' },
      { value: 4, label: '4 — Rarely moist' },
    ],
  },
  {
    key: 'activity',
    label: 'Activity',
    options: [
      { value: 1, label: '1 — Bedfast' },
      { value: 2, label: '2 — Chairfast' },
      { value: 3, label: '3 — Walks occasionally' },
      { value: 4, label: '4 — Walks frequently' },
    ],
  },
  {
    key: 'mobility',
    label: 'Mobility',
    options: [
      { value: 1, label: '1 — Completely immobile' },
      { value: 2, label: '2 — Very limited' },
      { value: 3, label: '3 — Slightly limited' },
      { value: 4, label: '4 — No limitation' },
    ],
  },
  {
    key: 'nutrition',
    label: 'Nutrition',
    options: [
      { value: 1, label: '1 — Very poor' },
      { value: 2, label: '2 — Probably inadequate' },
      { value: 3, label: '3 — Adequate' },
      { value: 4, label: '4 — Excellent' },
    ],
  },
  {
    key: 'friction',
    label: 'Friction & Shear',
    options: [
      { value: 1, label: '1 — Problem' },
      { value: 2, label: '2 — Potential problem' },
      { value: 3, label: '3 — No apparent problem' },
    ],
  },
]

const INTERVENTIONS = [
  'Reposition Q2H',
  'Pressure-relieving mattress',
  'Heel protectors',
  'Skin inspection at each turn',
  'Nutritional assessment',
  'Moisture barrier cream',
]

function getRiskLevel(score) {
  if (score === null) return null
  if (score <= 9)  return { label: 'Very High Risk', color: 'red',    bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700' }
  if (score <= 12) return { label: 'High Risk',      color: 'orange', bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700' }
  if (score <= 14) return { label: 'Moderate Risk',  color: 'yellow', bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700' }
  if (score <= 18) return { label: 'Mild Risk',      color: 'blue',   bg: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-700' }
  return                  { label: 'No Risk',         color: 'green',  bg: 'bg-green-50',  border: 'border-green-300',  text: 'text-green-700' }
}

export default function BradenForm({ admission, onClose, onSaved }) {
  const { requestPin } = usePin()
  const [scores, setScores]     = useState({})
  const [checked, setChecked]   = useState({})
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [verifiedIdentity, setVerifiedIdentity] = useState(null)
  const [signed, setSigned]     = useState(false)
  const [signedAt, setSignedAt] = useState(null)

  const allFilled = SUBSCALES.every(s => scores[s.key] !== undefined)
  const total = allFilled ? SUBSCALES.reduce((acc, s) => acc + scores[s.key], 0) : null
  const risk  = getRiskLevel(total)

  useEffect(() => {
    if (!admission) return
    localStorage.setItem(`draft_assessment_braden_${admission.id}`, JSON.stringify({ scores }))
  }, [scores, admission])

  useEffect(() => {
    if (!admission) return
    const raw = localStorage.getItem(`draft_assessment_braden_${admission.id}`)
    if (!raw) return
    try { const d = JSON.parse(raw); if (d.scores) setScores(d.scores) } catch {}
  }, [admission])

  const setScore = (key, val) => setScores(prev => ({ ...prev, [key]: val }))
  const toggleCheck = (item) => setChecked(prev => ({ ...prev, [item]: !prev[item] }))

  const handleSave = async () => {
    if (!allFilled) { setError('Please complete all six subscales.'); return }
    setSaving(true); setError(null)
    try {
      const identity = await requestPin('Authenticate to save Braden assessment')
      setVerifiedIdentity(identity)
      await api.post(`/inpatient/admissions/${admission.id}/notes`, {
        note_type: 'assessment',
        note_text: JSON.stringify({
          type: 'Braden', scores, total,
          risk_level: risk?.label,
          recorded_by: identity.full_name,
        }),
      })
      localStorage.removeItem(`draft_assessment_braden_${admission.id}`)
      if (onSaved) onSaved()
    } catch (e) {
      if (e.message !== 'PIN cancelled') setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {/* Score */}
        <div className={`rounded-xl p-4 text-center border-2 ${risk ? `${risk.bg} ${risk.border}` : 'bg-gray-50 border-gray-200'}`}>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Braden Score</p>
          <p className={`text-5xl font-bold mb-1 ${risk ? risk.text : 'text-gray-400'}`}>{total ?? '?'}</p>
          <p className="text-sm font-medium text-gray-600">{risk?.label ?? 'Complete all subscales'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Range 6–23</p>
        </div>

        {total !== null && total <= 12 && (
          <div className="flex items-start gap-2 bg-red-100 border border-red-300 rounded-lg px-4 py-3">
            <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm font-semibold text-red-800">
              HIGH PRESSURE ULCER RISK — Implement turning schedule Q2H, pressure-relieving surface, skin protection protocol.
            </p>
          </div>
        )}

        {/* Subscales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SUBSCALES.map(s => (
            <div key={s.key} className="bg-gray-50 rounded-lg p-4">
              <p className="font-semibold text-gray-700 text-sm mb-2">{s.label}</p>
              <div className="space-y-1">
                {s.options.map(o => (
                  <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={s.key}
                      checked={scores[s.key] === o.value}
                      onChange={() => setScore(s.key, o.value)}
                      className="accent-emerald-600"
                    />
                    <span className="text-sm text-gray-700">{o.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Intervention checklist */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="font-semibold text-amber-900 text-sm mb-2">Suggested Interventions (nurse reference — not saved)</p>
          <div className="space-y-1.5">
            {INTERVENTIONS.map(item => (
              <label key={item} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!checked[item]}
                  onChange={() => toggleCheck(item)}
                  className="accent-emerald-600 w-4 h-4"
                />
                <span className="text-sm text-amber-900">{item}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {verifiedIdentity && (
          <SignatureBlock
            verifiedIdentity={verifiedIdentity}
            onSign={() => { setSigned(true); setSignedAt(new Date().toLocaleString()) }}
            signed={signed}
            signedAt={signedAt}
          />
        )}
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4 flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button onClick={handleSave} disabled={saving || signed} className="px-5 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save & Sign'}
        </button>
      </div>
    </div>
  )
}
