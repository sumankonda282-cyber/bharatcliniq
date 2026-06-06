
import { useState, useEffect } from 'react'
import { usePin } from '../../contexts/PinContext'
import { AlertTriangle } from 'lucide-react'
import api from '../../api/client'
import SignatureBlock from '../SignatureBlock'

const FACES = [
  { score: 0, emoji: '😊', label: 'No hurt' },
  { score: 2, emoji: '😐', label: 'Hurts little bit' },
  { score: 4, emoji: '🙁', label: 'Hurts little more' },
  { score: 6, emoji: '😣', label: 'Hurts even more' },
  { score: 8, emoji: '😖', label: 'Hurts whole lot' },
  { score: 10, emoji: '😭', label: 'Hurts worst' },
]

const CPOT_ITEMS = [
  { key: 'facial', label: 'Facial expression', max: 2, options: [
    { value: 0, label: '0 — Relaxed, neutral' },
    { value: 1, label: '1 — Tense' },
    { value: 2, label: '2 — Grimacing' },
  ]},
  { key: 'body', label: 'Body movements', max: 2, options: [
    { value: 0, label: '0 — Absence of movements' },
    { value: 1, label: '1 — Protection' },
    { value: 2, label: '2 — Restlessness' },
  ]},
  { key: 'muscle', label: 'Muscle tension', max: 2, options: [
    { value: 0, label: '0 — Relaxed' },
    { value: 1, label: '1 — Tense, rigid' },
    { value: 2, label: '2 — Very tense or rigid' },
  ]},
  { key: 'ventilator', label: 'Ventilator compliance / Vocalization', max: 2, options: [
    { value: 0, label: '0 — Tolerating ventilator or no vocalization' },
    { value: 1, label: '1 — Coughing but tolerating' },
    { value: 2, label: '2 — Fighting ventilator or crying out' },
  ]},
]

const PAIN_CHARS = ['Sharp', 'Dull', 'Burning', 'Aching', 'Cramping', 'Stabbing', 'Throbbing', 'Radiating']
const AGG_FACTORS = ['Movement', 'Deep breathing', 'Position', 'Food', 'Other']
const RELIEF_FACTORS = ['Rest', 'Medication', 'Heat', 'Cold', 'Position', 'Other']

export default function PainForm({ admission, onClose, onSaved }) {
  const { requestPin } = usePin()
  const [tool, setTool]           = useState('NRS')
  const [nrsScore, setNrsScore]   = useState(0)
  const [facesScore, setFacesScore] = useState(null)
  const [cpotScores, setCpotScores] = useState({})
  const [chars, setChars]         = useState([])
  const [location, setLocation]   = useState('')
  const [radiates, setRadiates]   = useState(false)
  const [radiatesWhere, setRadiatesWhere] = useState('')
  const [aggFactors, setAggFactors]   = useState([])
  const [aggOther, setAggOther]       = useState('')
  const [reliefFactors, setReliefFactors] = useState([])
  const [reliefOther, setReliefOther] = useState('')
  const [functionEffect, setFunctionEffect] = useState('')
  const [currentMeds, setCurrentMeds] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [verifiedIdentity, setVerifiedIdentity] = useState(null)
  const [signed, setSigned]   = useState(false)
  const [signedAt, setSignedAt] = useState(null)

  const cpotTotal = CPOT_ITEMS.every(i => cpotScores[i.key] !== undefined)
    ? CPOT_ITEMS.reduce((a, i) => a + cpotScores[i.key], 0)
    : null

  const activeScore = tool === 'NRS' ? nrsScore
    : tool === 'Faces' ? facesScore
    : cpotTotal

  // Auto-save draft
  useEffect(() => {
    if (!admission) return
    const draft = { tool, nrsScore, facesScore, cpotScores, chars, location, radiates, radiatesWhere, aggFactors, aggOther, reliefFactors, reliefOther, functionEffect, currentMeds }
    localStorage.setItem(`draft_assessment_pain_${admission.id}`, JSON.stringify(draft))
  }, [tool, nrsScore, facesScore, cpotScores, chars, location, radiates, radiatesWhere, aggFactors, aggOther, reliefFactors, reliefOther, functionEffect, currentMeds, admission])

  useEffect(() => {
    if (!admission) return
    const raw = localStorage.getItem(`draft_assessment_pain_${admission.id}`)
    if (!raw) return
    try {
      const d = JSON.parse(raw)
      if (d.tool) setTool(d.tool)
      if (d.nrsScore !== undefined) setNrsScore(d.nrsScore)
      if (d.facesScore !== null) setFacesScore(d.facesScore)
      if (d.cpotScores) setCpotScores(d.cpotScores)
      if (d.chars) setChars(d.chars)
      if (d.location) setLocation(d.location)
      if (d.radiates !== undefined) setRadiates(d.radiates)
      if (d.radiatesWhere) setRadiatesWhere(d.radiatesWhere)
      if (d.aggFactors) setAggFactors(d.aggFactors)
      if (d.aggOther) setAggOther(d.aggOther)
      if (d.reliefFactors) setReliefFactors(d.reliefFactors)
      if (d.reliefOther) setReliefOther(d.reliefOther)
      if (d.functionEffect) setFunctionEffect(d.functionEffect)
      if (d.currentMeds) setCurrentMeds(d.currentMeds)
    } catch {}
  }, [admission])

  const toggleList = (list, setList, val) => {
    setList(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])
  }

  const handleSave = async () => {
    setSaving(true); setError(null)
    try {
      const identity = await requestPin('Authenticate to save Pain assessment')
      setVerifiedIdentity(identity)
      await api.post(`/inpatient/admissions/${admission.id}/notes`, {
        note_type: 'assessment',
        note_text: JSON.stringify({
          type: 'Pain', tool, score: activeScore,
          nrsScore: tool === 'NRS' ? nrsScore : undefined,
          facesScore: tool === 'Faces' ? facesScore : undefined,
          cpotScores: tool === 'CPOT' ? cpotScores : undefined,
          cpotTotal: tool === 'CPOT' ? cpotTotal : undefined,
          chars, location,
          radiates, radiatesWhere: radiates ? radiatesWhere : undefined,
          aggFactors: [...aggFactors, ...(aggFactors.includes('Other') ? [aggOther] : [])],
          reliefFactors: [...reliefFactors, ...(reliefFactors.includes('Other') ? [reliefOther] : [])],
          functionEffect, currentMeds,
          recorded_by: identity.full_name,
        }),
      })
      localStorage.removeItem(`draft_assessment_pain_${admission.id}`)
      if (onSaved) onSaved()
    } catch (e) {
      if (e.message !== 'PIN cancelled') setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const nrsColor = nrsScore >= 7 ? 'text-red-600' : nrsScore >= 4 ? 'text-orange-500' : 'text-green-600'

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Tool selector */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Assessment Tool</p>
          <div className="flex gap-2">
            {['NRS', 'Faces', 'CPOT'].map(t => (
              <button
                key={t}
                onClick={() => setTool(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  tool === t ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {tool === 'NRS' ? 'Numeric Rating Scale — for verbal patients'
              : tool === 'Faces' ? 'Wong-Baker FACES — for paediatric or non-verbal patients'
              : 'CPOT — for sedated / non-verbal ICU patients'}
          </p>
        </div>

        {/* NRS */}
        {tool === 'NRS' && (
          <div className="text-center">
            <p className={`text-7xl font-bold mb-2 ${nrsColor}`}>{nrsScore}</p>
            <p className="text-sm text-gray-500 mb-3">
              {nrsScore === 0 ? 'No pain' : nrsScore <= 3 ? 'Mild' : nrsScore <= 6 ? 'Moderate' : 'Severe'}
            </p>
            <input
              type="range" min={0} max={10} step={1}
              value={nrsScore}
              onChange={e => setNrsScore(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0 No pain</span><span>10 Worst pain</span>
            </div>
          </div>
        )}

        {/* Faces */}
        {tool === 'Faces' && (
          <div>
            <div className="flex justify-between gap-1">
              {FACES.map(f => (
                <button
                  key={f.score}
                  onClick={() => setFacesScore(f.score)}
                  className={`flex-1 flex flex-col items-center py-3 rounded-lg border-2 transition-all ${
                    facesScore === f.score ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  <span className="text-3xl">{f.emoji}</span>
                  <span className="text-xs text-gray-500 mt-1">{f.score}</span>
                  <span className="text-xs text-gray-400 text-center leading-tight mt-0.5">{f.label}</span>
                </button>
              ))}
            </div>
            {facesScore !== null && (
              <p className="text-center text-lg font-bold mt-3 text-emerald-700">Selected: {facesScore}/10</p>
            )}
          </div>
        )}

        {/* CPOT */}
        {tool === 'CPOT' && (
          <div className="space-y-3">
            <div className={`text-center p-3 rounded-lg border-2 ${cpotTotal !== null ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
              <p className="text-xs text-gray-500 uppercase tracking-widest">CPOT Total</p>
              <p className="text-4xl font-bold text-emerald-700">{cpotTotal ?? '?'} <span className="text-lg text-gray-400">/ 8</span></p>
            </div>
            {CPOT_ITEMS.map(item => (
              <div key={item.key} className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">{item.label}</p>
                <div className="space-y-1">
                  {item.options.map(o => (
                    <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={item.key}
                        checked={cpotScores[item.key] === o.value}
                        onChange={() => setCpotScores(prev => ({ ...prev, [item.key]: o.value }))}
                        className="accent-emerald-600"
                      />
                      <span className="text-sm text-gray-700">{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Severe pain alert */}
        {activeScore !== null && activeScore >= 7 && tool !== 'CPOT' && (
          <div className="flex items-start gap-2 bg-orange-50 border border-orange-300 rounded-lg px-4 py-3">
            <AlertTriangle size={18} className="text-orange-600 mt-0.5 shrink-0" />
            <p className="text-sm font-semibold text-orange-800">Severe pain — notify physician if pain is unmanaged.</p>
          </div>
        )}

        {/* Pain character */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Pain Character</p>
          <div className="flex flex-wrap gap-2">
            {PAIN_CHARS.map(c => (
              <button key={c} onClick={() => toggleList(chars, setChars, c)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  chars.includes(c) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                }`}>{c}</button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Body Location</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Right lower quadrant, lower back"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Radiation */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Radiation</p>
          <div className="flex items-center gap-4 mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="radiates" checked={!radiates} onChange={() => setRadiates(false)} className="accent-emerald-600" />
              <span className="text-sm">No</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="radiates" checked={radiates} onChange={() => setRadiates(true)} className="accent-emerald-600" />
              <span className="text-sm">Yes</span>
            </label>
          </div>
          {radiates && (
            <input type="text" value={radiatesWhere} onChange={e => setRadiatesWhere(e.target.value)}
              placeholder="Radiates to…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          )}
        </div>

        {/* Aggravating & relieving */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Aggravating Factors</p>
            <div className="space-y-1">
              {AGG_FACTORS.map(f => (
                <label key={f} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={aggFactors.includes(f)}
                    onChange={() => toggleList(aggFactors, setAggFactors, f)} className="accent-emerald-600 w-4 h-4" />
                  <span className="text-sm text-gray-700">{f}</span>
                </label>
              ))}
              {aggFactors.includes('Other') && (
                <input type="text" value={aggOther} onChange={e => setAggOther(e.target.value)}
                  placeholder="Specify…"
                  className="w-full mt-1 border border-gray-300 rounded px-2 py-1 text-sm" />
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Relieving Factors</p>
            <div className="space-y-1">
              {RELIEF_FACTORS.map(f => (
                <label key={f} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={reliefFactors.includes(f)}
                    onChange={() => toggleList(reliefFactors, setReliefFactors, f)} className="accent-emerald-600 w-4 h-4" />
                  <span className="text-sm text-gray-700">{f}</span>
                </label>
              ))}
              {reliefFactors.includes('Other') && (
                <input type="text" value={reliefOther} onChange={e => setReliefOther(e.target.value)}
                  placeholder="Specify…"
                  className="w-full mt-1 border border-gray-300 rounded px-2 py-1 text-sm" />
              )}
            </div>
          </div>
        </div>

        {/* Function effect */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Effect on Function</p>
          <div className="flex flex-wrap gap-2">
            {['None', 'Mild (distracting)', 'Moderate (interferes with tasks)', 'Severe (disabling)'].map(opt => (
              <button key={opt} onClick={() => setFunctionEffect(opt)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  functionEffect === opt ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                }`}>{opt}</button>
            ))}
          </div>
        </div>

        {/* Current analgesics */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current Analgesic Medications</label>
          <input type="text" value={currentMeds} onChange={e => setCurrentMeds(e.target.value)}
            placeholder="e.g. Paracetamol 1g Q6H, Morphine PRN"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
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
