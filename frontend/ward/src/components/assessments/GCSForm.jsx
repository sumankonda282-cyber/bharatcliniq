
import { useState, useEffect } from 'react'
import { usePin } from '../../contexts/PinContext'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import api from '../../api/client'
import SignatureBlock from '../SignatureBlock'
import DictationTextarea from '../DictationTextarea'

const EYE_OPTIONS = [
  { value: 4, label: '4 — Spontaneous' },
  { value: 3, label: '3 — To voice' },
  { value: 2, label: '2 — To pain' },
  { value: 1, label: '1 — None' },
]
const VERBAL_OPTIONS = [
  { value: 5, label: '5 — Oriented' },
  { value: 4, label: '4 — Confused' },
  { value: 3, label: '3 — Inappropriate words' },
  { value: 2, label: '2 — Incomprehensible sounds' },
  { value: 1, label: '1 — None' },
  { value: 'T', label: 'T — Intubated' },
]
const MOTOR_OPTIONS = [
  { value: 6, label: '6 — Obeys commands' },
  { value: 5, label: '5 — Localises pain' },
  { value: 4, label: '4 — Withdraws from pain' },
  { value: 3, label: '3 — Abnormal flexion (Decorticate)' },
  { value: 2, label: '2 — Extension (Decerebrate)' },
  { value: 1, label: '1 — None' },
]
const PUPIL_REACTIONS = ['Brisk', 'Sluggish', 'Fixed']
const LIMB_OPTIONS = ['Normal', 'Weak left', 'Weak right', 'Paraplegia', 'Other']

function RadioGroup({ label, options, value, onChange }) {
  return (
    <div className="mb-4">
      <p className="font-semibold text-gray-700 mb-2 text-sm">{label}</p>
      <div className="space-y-1">
        {options.map(o => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={label}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="accent-emerald-600"
            />
            <span className="text-sm text-gray-700">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export default function GCSForm({ admission, onClose, onSaved }) {
  const { requestPin } = usePin()
  const [E, setE] = useState(null)
  const [V, setV] = useState(null)
  const [M, setM] = useState(null)
  const [leftPupilSize, setLeftPupilSize]         = useState('')
  const [leftPupilReaction, setLeftPupilReaction] = useState('')
  const [rightPupilSize, setRightPupilSize]       = useState('')
  const [rightPupilReaction, setRightPupilReaction] = useState('')
  const [limbs, setLimbs]   = useState('')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const [verifiedIdentity, setVerifiedIdentity] = useState(null)
  const [signed, setSigned]   = useState(false)
  const [signedAt, setSignedAt] = useState(null)

  const eNum  = typeof E === 'number' ? E : 1
  const vNum  = V === 'T' ? 1 : (typeof V === 'number' ? V : 1)
  const mNum  = typeof M === 'number' ? M : 1
  const total = (E !== null && V !== null && M !== null) ? eNum + vNum + mNum : null

  const scoreColor = total === null ? 'gray'
    : total >= 13 ? 'green'
    : total >= 9  ? 'orange'
    : 'red'

  const scoreLabel = total === null ? '—'
    : total >= 13 ? 'Mild / No impairment'
    : total >= 9  ? 'Moderate impairment'
    : 'Severe impairment'

  // Auto-save draft
  useEffect(() => {
    if (!admission) return
    const draft = { E, V, M, leftPupilSize, leftPupilReaction, rightPupilSize, rightPupilReaction, limbs, notes }
    localStorage.setItem(`draft_assessment_gcs_${admission.id}`, JSON.stringify(draft))
  }, [E, V, M, leftPupilSize, leftPupilReaction, rightPupilSize, rightPupilReaction, limbs, notes, admission])

  // Load draft
  useEffect(() => {
    if (!admission) return
    const raw = localStorage.getItem(`draft_assessment_gcs_${admission.id}`)
    if (!raw) return
    try {
      const d = JSON.parse(raw)
      if (d.E !== undefined) setE(d.E)
      if (d.V !== undefined) setV(d.V)
      if (d.M !== undefined) setM(d.M)
      if (d.leftPupilSize) setLeftPupilSize(d.leftPupilSize)
      if (d.leftPupilReaction) setLeftPupilReaction(d.leftPupilReaction)
      if (d.rightPupilSize) setRightPupilSize(d.rightPupilSize)
      if (d.rightPupilReaction) setRightPupilReaction(d.rightPupilReaction)
      if (d.limbs) setLimbs(d.limbs)
      if (d.notes) setNotes(d.notes)
    } catch {}
  }, [admission])

  const handleSave = async () => {
    if (E === null || V === null || M === null) { setError('Please complete all three GCS components.'); return }
    setSaving(true); setError(null)
    try {
      const identity = await requestPin('Authenticate to save GCS assessment')
      setVerifiedIdentity(identity)
      await api.post(`/inpatient/admissions/${admission.id}/notes`, {
        note_type: 'assessment',
        note_text: JSON.stringify({
          type: 'GCS', E, V, M, total,
          pupils: { left: { size: leftPupilSize, reaction: leftPupilReaction }, right: { size: rightPupilSize, reaction: rightPupilReaction } },
          limbs, notes,
          recorded_by: identity.full_name,
        }),
      })
      localStorage.removeItem(`draft_assessment_gcs_${admission.id}`)
      if (onSaved) onSaved()
    } catch (e) {
      if (e.message !== 'PIN cancelled') setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSign = () => {
    setSigned(true)
    setSignedAt(new Date().toLocaleString())
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Score display */}
        <div className={`rounded-xl p-4 text-center border-2 ${
          scoreColor === 'green'  ? 'bg-green-50 border-green-300' :
          scoreColor === 'orange' ? 'bg-orange-50 border-orange-300' :
          scoreColor === 'red'    ? 'bg-red-50 border-red-300' :
          'bg-gray-50 border-gray-200'
        }`}>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">GCS Total</p>
          <p className={`text-5xl font-bold mb-1 ${
            scoreColor === 'green'  ? 'text-green-700' :
            scoreColor === 'orange' ? 'text-orange-700' :
            scoreColor === 'red'    ? 'text-red-700' :
            'text-gray-400'
          }`}>{total ?? '?'}</p>
          <p className="text-sm font-medium text-gray-600">{scoreLabel}</p>
          {E !== null && V !== null && M !== null && (
            <p className="text-xs text-gray-400 mt-1">E{E} V{V} M{M}</p>
          )}
        </div>

        {total !== null && total <= 8 && (
          <div className="flex items-start gap-2 bg-red-100 border border-red-300 rounded-lg px-4 py-3">
            <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm font-semibold text-red-800">GCS ≤8: Consider airway protection. Assess for intubation.</p>
          </div>
        )}

        {/* GCS sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <RadioGroup label="Eye Opening (E)" options={EYE_OPTIONS} value={E} onChange={setE} />
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <RadioGroup label="Verbal Response (V)" options={VERBAL_OPTIONS} value={V} onChange={setV} />
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <RadioGroup label="Motor Response (M)" options={MOTOR_OPTIONS} value={M} onChange={setM} />
          </div>
        </div>

        {/* Pupils */}
        <div>
          <p className="font-semibold text-gray-700 mb-3">Pupil Assessment</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { side: 'Left',  size: leftPupilSize,  setSize: setLeftPupilSize,  reaction: leftPupilReaction,  setReaction: setLeftPupilReaction },
              { side: 'Right', size: rightPupilSize, setSize: setRightPupilSize, reaction: rightPupilReaction, setReaction: setRightPupilReaction },
            ].map(({ side, size, setSize, reaction, setReaction }) => (
              <div key={side} className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-600 mb-2">{side} Pupil</p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="number" min="1" max="9" step="0.5"
                    placeholder="mm"
                    value={size}
                    onChange={e => setSize(e.target.value)}
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-gray-400 self-center">mm</span>
                </div>
                <select
                  value={reaction}
                  onChange={e => setReaction(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">Reaction…</option>
                  {PUPIL_REACTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Limb movements */}
        <div>
          <p className="font-semibold text-gray-700 mb-2">Limb Movements</p>
          <div className="flex flex-wrap gap-2">
            {LIMB_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setLimbs(opt)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  limbs === opt
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <DictationTextarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Additional clinical observations…"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {verifiedIdentity && (
          <SignatureBlock
            verifiedIdentity={verifiedIdentity}
            onSign={handleSign}
            signed={signed}
            signedAt={signedAt}
          />
        )}
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || signed}
          className="px-5 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save & Sign'}
        </button>
      </div>
    </div>
  )
}
