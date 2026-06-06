
import { useState, useEffect } from 'react'
import { usePin } from '../../contexts/PinContext'
import { AlertTriangle } from 'lucide-react'
import api from '../../api/client'
import SignatureBlock from '../SignatureBlock'

const ITEMS = [
  {
    key: 'falls_history',
    label: 'History of falls in last 3 months',
    options: [{ value: 0, label: 'No (0)' }, { value: 25, label: 'Yes (25)' }],
  },
  {
    key: 'secondary_dx',
    label: 'Secondary diagnosis',
    options: [{ value: 0, label: 'No (0)' }, { value: 15, label: 'Yes (15)' }],
  },
  {
    key: 'ambulatory_aid',
    label: 'Ambulatory aid',
    options: [
      { value: 0,  label: 'None / Bedrest / Nurse assist (0)' },
      { value: 15, label: 'Crutches / Cane / Walker (15)' },
      { value: 30, label: 'Furniture (30)' },
    ],
  },
  {
    key: 'iv_therapy',
    label: 'IV therapy / Heparin lock',
    options: [{ value: 0, label: 'No (0)' }, { value: 20, label: 'Yes (20)' }],
  },
  {
    key: 'gait',
    label: 'Gait',
    options: [
      { value: 0,  label: 'Normal / Bedrest / Immobile (0)' },
      { value: 10, label: 'Weak (10)' },
      { value: 20, label: 'Impaired (20)' },
    ],
  },
  {
    key: 'mental_status',
    label: 'Mental status',
    options: [
      { value: 0,  label: 'Oriented to own ability (0)' },
      { value: 15, label: 'Overestimates / Forgets limitations (15)' },
    ],
  },
]

const INTERVENTIONS = [
  'Fall risk wristband applied',
  'Bed in lowest position, brakes locked',
  'Call bell within reach',
  'Non-slip footwear',
  'Hourly rounding',
  'Environment cleared of hazards',
  'Family educated',
]

function getRisk(score) {
  if (score === null) return null
  if (score <= 24) return { label: 'Low Risk',    bg: 'bg-green-50',  border: 'border-green-300',  text: 'text-green-700' }
  if (score <= 44) return { label: 'Medium Risk', bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700' }
  return                  { label: 'High Risk',   bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700' }
}

export default function MorseForm({ admission, onClose, onSaved }) {
  const { requestPin } = usePin()
  const [scores, setScores]   = useState({})
  const [checked, setChecked] = useState({})
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [verifiedIdentity, setVerifiedIdentity] = useState(null)
  const [signed, setSigned]   = useState(false)
  const [signedAt, setSignedAt] = useState(null)

  const allFilled = ITEMS.every(i => scores[i.key] !== undefined)
  const total = allFilled ? ITEMS.reduce((acc, i) => acc + scores[i.key], 0) : null
  const risk  = getRisk(total)

  useEffect(() => {
    if (!admission) return
    localStorage.setItem(`draft_assessment_morse_${admission.id}`, JSON.stringify({ scores }))
  }, [scores, admission])

  useEffect(() => {
    if (!admission) return
    const raw = localStorage.getItem(`draft_assessment_morse_${admission.id}`)
    if (!raw) return
    try { const d = JSON.parse(raw); if (d.scores) setScores(d.scores) } catch {}
  }, [admission])

  const setScore = (key, val) => setScores(prev => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    if (!allFilled) { setError('Please complete all six items.'); return }
    setSaving(true); setError(null)
    try {
      const identity = await requestPin('Authenticate to save Morse Fall Risk assessment')
      setVerifiedIdentity(identity)
      await api.post(`/inpatient/admissions/${admission.id}/notes`, {
        note_type: 'assessment',
        note_text: JSON.stringify({
          type: 'Morse', scores, total,
          risk_level: risk?.label,
          recorded_by: identity.full_name,
        }),
      })
      localStorage.removeItem(`draft_assessment_morse_${admission.id}`)
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
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Morse Score</p>
          <p className={`text-5xl font-bold mb-1 ${risk ? risk.text : 'text-gray-400'}`}>{total ?? '?'}</p>
          <p className="text-sm font-medium text-gray-600">{risk?.label ?? 'Complete all items'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Low 0–24 · Medium 25–44 · High ≥45</p>
        </div>

        {total !== null && total >= 45 && (
          <div className="flex items-start gap-2 bg-red-100 border border-red-300 rounded-lg px-4 py-3">
            <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm font-semibold text-red-800">High fall risk — implement fall prevention protocol immediately.</p>
          </div>
        )}

        {/* Items */}
        <div className="space-y-4">
          {ITEMS.map(item => (
            <div key={item.key} className="bg-gray-50 rounded-lg p-4">
              <p className="font-semibold text-gray-700 text-sm mb-2">{item.label}</p>
              <div className="space-y-1">
                {item.options.map(o => (
                  <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={item.key}
                      checked={scores[item.key] === o.value}
                      onChange={() => setScore(item.key, o.value)}
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
        {total !== null && total >= 45 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="font-semibold text-amber-900 text-sm mb-2">Fall Prevention Interventions (nurse reference — not saved)</p>
            <div className="space-y-1.5">
              {INTERVENTIONS.map(item => (
                <label key={item} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!checked[item]}
                    onChange={() => setChecked(prev => ({ ...prev, [item]: !prev[item] }))}
                    className="accent-emerald-600 w-4 h-4"
                  />
                  <span className="text-sm text-amber-900">{item}</span>
                </label>
              ))}
            </div>
          </div>
        )}

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
