
import { useState, useEffect } from 'react'
import { usePin } from '../../contexts/PinContext'
import { Plus } from 'lucide-react'
import api from '../../api/client'
import SignatureBlock from '../SignatureBlock'
import DictationTextarea from '../DictationTextarea'

const RESTRAINT_TYPES = ['Wrist', 'Ankle', 'Vest', 'Mitten', 'Full body', 'Other']
const ALTERNATIVES    = ['Verbal redirection', 'Environmental modification', 'Bed alarm', 'Sitter', 'Family presence']
const SKIN_STATUS     = ['Intact', 'Redness', 'Abrasion', 'Other']
const PT_RESPONSE     = ['Calm', 'Agitated', 'Unresponsive']

const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function newCheck() {
  return {
    id: Date.now(),
    time: nowTime(),
    skinCondition: '',
    capRefill: null,
    sensation: null,
    movement: null,
    repositioned: null,
    response: '',
  }
}

export default function RestraintForm({ admission, onClose, onSaved }) {
  const { requestPin } = usePin()
  const [type, setType]               = useState('')
  const [indication, setIndication]   = useState('')
  const [orderRef, setOrderRef]       = useState('')
  const [alternatives, setAlternatives] = useState([])
  const [patientInformed, setPatientInformed] = useState(null)
  const [ptResponse, setPtResponse]   = useState('')
  const [skinAssessment, setSkinAssessment] = useState('')
  const [capRefill, setCapRefill]     = useState(null)
  const [sensation, setSensation]     = useState(null)
  const [movement, setMovement]       = useState(null)
  const [timeApplied, setTimeApplied] = useState(nowTime())
  const [removalCriteria, setRemovalCriteria] = useState('')
  const [checks, setChecks]           = useState([])
  // Removal
  const [timeRemoved, setTimeRemoved] = useState('')
  const [removalReason, setRemovalReason] = useState('')
  const [finalSkin, setFinalSkin]     = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState(null)
  const [verifiedIdentity, setVerifiedIdentity] = useState(null)
  const [signed, setSigned]           = useState(false)
  const [signedAt, setSignedAt]       = useState(null)

  const draftKey = admission ? `draft_assessment_restraint_${admission.id}` : null

  useEffect(() => {
    if (!draftKey) return
    const raw = localStorage.getItem(draftKey)
    if (!raw) return
    try {
      const d = JSON.parse(raw)
      if (d.type) setType(d.type)
      if (d.indication) setIndication(d.indication)
      if (d.orderRef) setOrderRef(d.orderRef)
      if (d.alternatives) setAlternatives(d.alternatives)
      if (d.patientInformed !== undefined) setPatientInformed(d.patientInformed)
      if (d.ptResponse) setPtResponse(d.ptResponse)
      if (d.skinAssessment) setSkinAssessment(d.skinAssessment)
      if (d.capRefill !== undefined) setCapRefill(d.capRefill)
      if (d.sensation !== undefined) setSensation(d.sensation)
      if (d.movement !== undefined) setMovement(d.movement)
      if (d.timeApplied) setTimeApplied(d.timeApplied)
      if (d.removalCriteria) setRemovalCriteria(d.removalCriteria)
      if (d.checks) setChecks(d.checks)
    } catch {}
  }, [draftKey])

  useEffect(() => {
    if (!draftKey) return
    localStorage.setItem(draftKey, JSON.stringify({
      type, indication, orderRef, alternatives, patientInformed, ptResponse,
      skinAssessment, capRefill, sensation, movement, timeApplied, removalCriteria, checks,
    }))
  }, [type, indication, orderRef, alternatives, patientInformed, ptResponse, skinAssessment, capRefill, sensation, movement, timeApplied, removalCriteria, checks, draftKey])

  const toggleAlternative = (val) => {
    setAlternatives(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])
  }

  const updateCheck = (id, field, val) => {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c))
  }

  const YNButton = ({ value, onChange, trueLabel='Yes', falseLabel='No' }) => (
    <div className="flex gap-2">
      {[true, false].map(v => (
        <button key={String(v)} onClick={() => onChange(v)}
          className={`px-3 py-1 text-xs rounded border transition-colors ${
            value === v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
          }`}>
          {v ? trueLabel : falseLabel}
        </button>
      ))}
    </div>
  )

  const handleSave = async () => {
    if (!indication.trim()) { setError('Clinical indication is required.'); return }
    if (!orderRef.trim())   { setError('Physician order reference is required.'); return }
    setSaving(true); setError(null)
    try {
      const identity = await requestPin('Authenticate to save Restraint documentation')
      setVerifiedIdentity(identity)
      await api.post(`/inpatient/admissions/${admission.id}/notes`, {
        note_type: 'assessment',
        note_text: JSON.stringify({
          type: 'Restraint',
          restraintType: type, indication, orderRef,
          alternativesTried: alternatives, patientInformed,
          patientResponse: ptResponse, skinAssessment,
          neurovascular: { capRefill, sensation, movement },
          timeApplied, removalCriteria,
          checks,
          removal: timeRemoved ? { timeRemoved, removalReason, finalSkin } : null,
          recorded_by: identity.full_name,
        }),
      })
      localStorage.removeItem(draftKey)
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
        {/* Type */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Type of Restraint</p>
          <div className="flex flex-wrap gap-2">
            {RESTRAINT_TYPES.map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  type === t ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                }`}>{t}</button>
            ))}
          </div>
        </div>

        {/* Indication */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Indication <span className="text-red-500">*</span></label>
          <DictationTextarea value={indication} onChange={e => setIndication(e.target.value)} rows={2}
            placeholder="Required: clinical justification for restraint use" />
        </div>

        {/* Order ref */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Physician Order Reference <span className="text-red-500">*</span></label>
          <input type="text" value={orderRef} onChange={e => setOrderRef(e.target.value)}
            placeholder="e.g. Dr. Sharma verbal order 14:30, Order #1234"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Alternatives */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Least Restrictive Alternatives Tried</p>
          <div className="space-y-1.5">
            {ALTERNATIVES.map(alt => (
              <label key={alt} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={alternatives.includes(alt)}
                  onChange={() => toggleAlternative(alt)} className="accent-emerald-600 w-4 h-4" />
                <span className="text-sm text-gray-700">{alt}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Patient/family informed */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Patient / Family Informed</p>
          <YNButton value={patientInformed} onChange={setPatientInformed} />
        </div>

        {/* Patient response */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Patient Response</p>
          <div className="flex gap-2">
            {PT_RESPONSE.map(r => (
              <button key={r} onClick={() => setPtResponse(r)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  ptResponse === r ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                }`}>{r}</button>
            ))}
          </div>
        </div>

        {/* Skin assessment */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Skin Assessment at Application</p>
          <div className="flex gap-2 flex-wrap">
            {SKIN_STATUS.map(s => (
              <button key={s} onClick={() => setSkinAssessment(s)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  skinAssessment === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                }`}>{s}</button>
            ))}
          </div>
        </div>

        {/* Neurovascular */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Neurovascular Check (Initial)</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Capillary refill &lt;2s</span>
              <YNButton value={capRefill} onChange={setCapRefill} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Sensation intact</span>
              <YNButton value={sensation} onChange={setSensation} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Movement present</span>
              <YNButton value={movement} onChange={setMovement} />
            </div>
          </div>
        </div>

        {/* Timing */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Applied</label>
            <input type="time" value={timeApplied} onChange={e => setTimeApplied(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Criteria for Removal</label>
          <input type="text" value={removalCriteria} onChange={e => setRemovalCriteria(e.target.value)}
            placeholder="e.g. Patient cooperative and calm for >2h"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Q2H check log */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Q2H Check Log</p>
            <button onClick={() => setChecks(prev => [...prev, newCheck()])}
              className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800">
              <Plus size={14} /> Add Q2H Check
            </button>
          </div>
          {checks.length === 0 && <p className="text-sm text-gray-400">No checks recorded yet.</p>}
          <div className="space-y-3">
            {checks.map(c => (
              <div key={c.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Time</label>
                    <input type="time" value={c.time} onChange={e => updateCheck(c.id, 'time', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-24" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Skin</label>
                    <select value={c.skinCondition} onChange={e => updateCheck(c.id, 'skinCondition', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm">
                      <option value="">—</option>
                      {SKIN_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  {[
                    ['Cap refill <2s', 'capRefill'],
                    ['Sensation intact', 'sensation'],
                    ['Movement present', 'movement'],
                    ['Repositioned', 'repositioned'],
                  ].map(([lbl, key]) => (
                    <div key={key} className="flex items-center gap-1">
                      <span className="text-gray-600">{lbl}:</span>
                      <YNButton value={c[key]} onChange={v => updateCheck(c.id, key, v)} />
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <label className="block text-xs text-gray-500 mb-0.5">Patient response</label>
                  <div className="flex gap-1">
                    {PT_RESPONSE.map(r => (
                      <button key={r} onClick={() => updateCheck(c.id, 'response', r)}
                        className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                          c.response === r ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-300'
                        }`}>{r}</button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Removal section */}
        <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
          <p className="text-sm font-semibold text-orange-800 mb-3">Restraint Removal</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Time Removed</label>
              <input type="time" value={timeRemoved} onChange={e => setTimeRemoved(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Final Skin Assessment</label>
              <select value={finalSkin} onChange={e => setFinalSkin(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                <option value="">—</option>
                {SKIN_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-2">
            <label className="block text-xs text-gray-600 mb-1">Reason for removal</label>
            <input type="text" value={removalReason} onChange={e => setRemovalReason(e.target.value)}
              placeholder="e.g. Patient cooperative, order discontinued"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
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
