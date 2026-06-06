
import { useState, useEffect, useCallback } from 'react'
import { usePin } from '../../contexts/PinContext'
import { Plus, Trash2 } from 'lucide-react'
import api from '../../api/client'
import SignatureBlock from '../SignatureBlock'
import DictationTextarea from '../DictationTextarea'

const WOUND_TYPES = ['Surgical', 'Pressure injury', 'Diabetic ulcer', 'Traumatic', 'Arterial', 'Venous', 'Other']
const STAGES      = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Unstageable', 'Deep tissue injury', 'Superficial', 'Partial thickness', 'Full thickness']
const EXUDATE_AMT = ['None', 'Minimal', 'Moderate', 'Heavy']
const EXUDATE_TYP = ['Serous', 'Serosanguinous', 'Sanguinous', 'Purulent']
const PERIWOUND   = ['Normal', 'Erythema', 'Maceration', 'Induration', 'Oedema']
const ODOUR       = ['None', 'Mild', 'Moderate', 'Strong']

function newWound() {
  return {
    id: Date.now(),
    label: '', location: '', type: '', stage: '',
    length: '', width: '', depth: '',
    granulating: '', sloughy: '', necrotic: '', epithelializing: '',
    exudateAmt: '', exudateType: '',
    periwound: '', odour: '',
    painScore: 0,
    treatment: '', dressing: '', nextChange: '', notes: '',
  }
}

function WoundCard({ wound, onChange, onRemove }) {
  const update = (field, val) => onChange({ ...wound, [field]: val })

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <input
          type="text"
          value={wound.label}
          onChange={e => update('label', e.target.value)}
          placeholder="Wound label (e.g. Surgical wound - abdomen)"
          className="flex-1 text-sm font-semibold border-b border-gray-300 focus:outline-none focus:border-emerald-500 py-1 mr-2"
        />
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500">
          <Trash2 size={15} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
          <input type="text" value={wound.location} onChange={e => update('location', e.target.value)}
            placeholder="Anatomical site"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Wound Type</label>
          <select value={wound.type} onChange={e => update('type', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
            <option value="">Select…</option>
            {WOUND_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Stage / Grade</label>
          <select value={wound.stage} onChange={e => update('stage', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
            <option value="">Select…</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Size (cm)</label>
          <div className="flex gap-1">
            {[['L', 'length'], ['W', 'width'], ['D', 'depth']].map(([lbl, key]) => (
              <div key={key} className="flex-1">
                <span className="block text-xs text-gray-400 mb-0.5">{lbl}</span>
                <input type="number" min="0" step="0.1" value={wound[key]} onChange={e => update(key, e.target.value)}
                  className="w-full border border-gray-300 rounded px-1.5 py-1 text-sm" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wound bed */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Wound Bed Composition (%)</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Granulating', 'granulating', 'text-pink-600'],
            ['Sloughy', 'sloughy', 'text-yellow-600'],
            ['Necrotic', 'necrotic', 'text-gray-600'],
            ['Epithelializing', 'epithelializing', 'text-green-600'],
          ].map(([lbl, key, cls]) => (
            <div key={key} className="flex items-center gap-2">
              <span className={`text-xs font-medium w-28 ${cls}`}>{lbl}</span>
              <input type="number" min="0" max="100" value={wound[key]} onChange={e => update(key, e.target.value)}
                className="w-16 border border-gray-300 rounded px-2 py-1 text-sm" />
              <span className="text-xs text-gray-400">%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Exudate, periwound, odour */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Exudate Amount</label>
          <select value={wound.exudateAmt} onChange={e => update('exudateAmt', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
            <option value="">—</option>
            {EXUDATE_AMT.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Exudate Type</label>
          <select value={wound.exudateType} onChange={e => update('exudateType', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
            <option value="">—</option>
            {EXUDATE_TYP.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Periwound Skin</label>
          <select value={wound.periwound} onChange={e => update('periwound', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
            <option value="">—</option>
            {PERIWOUND.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Odour</label>
          <select value={wound.odour} onChange={e => update('odour', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
            <option value="">—</option>
            {ODOUR.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Pain */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Pain at wound site: {wound.painScore}/10</label>
        <input type="range" min="0" max="10" step="1" value={wound.painScore}
          onChange={e => update('painScore', Number(e.target.value))}
          className="w-full accent-emerald-600" />
      </div>

      {/* Treatment, dressing */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Treatment applied</label>
          <input type="text" value={wound.treatment} onChange={e => update('treatment', e.target.value)}
            placeholder="e.g. Saline irrigation"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Dressing used</label>
          <input type="text" value={wound.dressing} onChange={e => update('dressing', e.target.value)}
            placeholder="e.g. Mepilex Border"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Next dressing change</label>
        <input type="date" value={wound.nextChange} onChange={e => update('nextChange', e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
        <DictationTextarea value={wound.notes} onChange={e => update('notes', e.target.value)}
          rows={2} placeholder="Additional wound notes…" />
      </div>
    </div>
  )
}

export default function WoundCareForm({ admission, onClose, onSaved }) {
  const { requestPin } = usePin()
  const [wounds, setWounds]   = useState([newWound()])
  const [prevNotes, setPrevNotes] = useState([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [verifiedIdentity, setVerifiedIdentity] = useState(null)
  const [signed, setSigned]   = useState(false)
  const [signedAt, setSignedAt] = useState(null)

  useEffect(() => {
    if (!admission) return
    api.get(`/inpatient/admissions/${admission.id}/notes?note_type=assessment`)
      .then(data => {
        const list = Array.isArray(data) ? data : (data.items || data.notes || [])
        const woundNotes = list.filter(n => {
          try { return JSON.parse(n.note_text).type === 'WoundCare' } catch { return false }
        })
        setPrevNotes(woundNotes.slice(0, 1))
      })
      .catch(() => {})
  }, [admission])

  useEffect(() => {
    if (!admission) return
    localStorage.setItem(`draft_assessment_wound_${admission.id}`, JSON.stringify({ wounds }))
  }, [wounds, admission])

  useEffect(() => {
    if (!admission) return
    const raw = localStorage.getItem(`draft_assessment_wound_${admission.id}`)
    if (!raw) return
    try { const d = JSON.parse(raw); if (d.wounds?.length) setWounds(d.wounds) } catch {}
  }, [admission])

  const updateWound = (id, updated) => setWounds(ws => ws.map(w => w.id === id ? updated : w))
  const removeWound = (id) => setWounds(ws => ws.filter(w => w.id !== id))

  const handleSave = async () => {
    setSaving(true); setError(null)
    try {
      const identity = await requestPin('Authenticate to save Wound Care documentation')
      setVerifiedIdentity(identity)
      await api.post(`/inpatient/admissions/${admission.id}/notes`, {
        note_type: 'assessment',
        note_text: JSON.stringify({
          type: 'WoundCare',
          wounds,
          recorded_by: identity.full_name,
          recorded_at: new Date().toISOString(),
        }),
      })
      localStorage.removeItem(`draft_assessment_wound_${admission.id}`)
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
        {/* Previous entry comparison */}
        {prevNotes.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">Last wound documentation:</p>
            {(() => {
              try {
                const prev = JSON.parse(prevNotes[0].note_text)
                return prev.wounds?.map((w, i) => (
                  <p key={i} className="text-xs text-blue-600">{w.label || `Wound ${i+1}`} — {w.type} — {w.stage}</p>
                ))
              } catch { return null }
            })()}
          </div>
        )}

        {wounds.map(wound => (
          <WoundCard
            key={wound.id}
            wound={wound}
            onChange={updated => updateWound(wound.id, updated)}
            onRemove={() => removeWound(wound.id)}
          />
        ))}

        <button
          onClick={() => setWounds(ws => [...ws, newWound()])}
          className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-800 font-medium"
        >
          <Plus size={16} /> Add Wound
        </button>

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
