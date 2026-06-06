import { useState, useEffect } from 'react'
import { usePin } from '../contexts/PinContext'
import { FileText, ClipboardList, CheckCircle, AlertTriangle } from 'lucide-react'
import PatientList from '../components/PatientList'
import SignatureBlock from '../components/SignatureBlock'
import api from '../api/client'
import DictationTextarea from '../components/DictationTextarea'
import AllergySearch from '../components/AllergySearch'


// ── Template registry ────────────────────────────────────────────────────────

const NURSING_TEMPLATES = [
  {
    key: 'admission_assessment',
    title: 'Admission Assessment',
    description: 'Comprehensive nursing admission documentation including PMH, medications, and care plan.',
    estTime: '15–20 min',
    Icon: ClipboardList,
  },
  {
    key: 'shift_assessment',
    title: 'Shift Assessment',
    description: 'Quick 5-minute per-shift systems review and documentation.',
    estTime: '5 min',
    Icon: CheckCircle,
  },
  {
    key: 'patient_education',
    title: 'Patient Education Note',
    description: 'Document education provided to patient/family and their understanding.',
    estTime: '5–10 min',
    Icon: FileText,
  },
  {
    key: 'incident_report',
    title: 'Incident Report',
    description: 'Internal use only — does not appear in patient chart.',
    estTime: '10 min',
    Icon: AlertTriangle,
    internal: true,
  },
]

const PROVIDER_TEMPLATES = [
  {
    key: 'hp',
    title: 'History & Physical (H&P)',
    description: 'Complete history and physical examination documentation.',
    estTime: '20–30 min',
    Icon: FileText,
  },
  {
    key: 'consult_request',
    title: 'Consult Request',
    description: 'Formal request for specialist consultation.',
    estTime: '5–10 min',
    Icon: ClipboardList,
  },
  {
    key: 'consult_response',
    title: 'Consult Response',
    description: 'Specialist response note with recommendations.',
    estTime: '10–15 min',
    Icon: FileText,
  },
  {
    key: 'transfer_note',
    title: 'Transfer Note',
    description: 'Documentation for patient transfer to another ward or facility.',
    estTime: '10–15 min',
    Icon: FileText,
  },
  {
    key: 'ama',
    title: 'Against Medical Advice (AMA)',
    description: 'Documentation when patient leaves against medical advice.',
    estTime: '10 min',
    Icon: AlertTriangle,
  },
  {
    key: 'death_summary',
    title: 'Death Summary',
    description: 'Summary note for deceased patients.',
    estTime: '15–20 min',
    Icon: FileText,
  },
]

// ── SmartTextarea ────────────────────────────────────────────────────────────

function SmartTextarea({ value, onChange, placeholder, rows = 3, dotPhrase, hint }) {
  return (
    <div>
      <DictationTextarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
      />
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

// ── Admission Assessment Form ─────────────────────────────────────────────────

function AdmissionAssessmentForm({ admission, onClose, onSaved }) {
  const { requestPin } = usePin()

  const [chiefComplaint, setChiefComplaint] = useState('')
  const [hpi, setHpi]                       = useState('')
  const [pmh, setPmh]                       = useState([])
  const [pmhOther, setPmhOther]             = useState('')
  const [surgicalHistory, setSurgicalHistory] = useState('')
  const [medications, setMedications]       = useState('')
  const [allergiesConfirmed, setAllergiesConfirmed] = useState(null)
  const [allergiesList, setAllergiesList]   = useState('')
  const [allergiesCoded, setAllergiesCoded] = useState([])
  const [ros, setRos]                       = useState([])
  const [examination, setExamination]       = useState('')
  const [impression, setImpression]         = useState('')
  const [plan, setPlan]                     = useState('')
  const [painScore, setPainScore]           = useState(0)
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState(null)
  const [verifiedIdentity, setVerifiedIdentity] = useState(null)
  const [signed, setSigned]                 = useState(false)
  const [signedAt, setSignedAt]             = useState(null)

  const PMH_OPTIONS = ['HTN', 'DM', 'CAD', 'Asthma', 'COPD', 'CKD', 'Other']
  const ROS_SYSTEMS = ['CVS', 'Respiratory', 'GI', 'GU', 'Neuro', 'MSK', 'Skin']

  const draftKey = admission ? `draft_template_admission_${admission.id}` : null

  useEffect(() => {
    if (!draftKey) return
    const raw = localStorage.getItem(draftKey)
    if (!raw) return
    try {
      const d = JSON.parse(raw)
      if (d.chiefComplaint) setChiefComplaint(d.chiefComplaint)
      if (d.hpi) setHpi(d.hpi)
      if (d.pmh) setPmh(d.pmh)
      if (d.pmhOther) setPmhOther(d.pmhOther)
      if (d.surgicalHistory) setSurgicalHistory(d.surgicalHistory)
      if (d.medications) setMedications(d.medications)
      if (d.allergiesConfirmed !== undefined) setAllergiesConfirmed(d.allergiesConfirmed)
      if (d.allergiesList) setAllergiesList(d.allergiesList)
      if (d.ros) setRos(d.ros)
      if (d.examination) setExamination(d.examination)
      if (d.impression) setImpression(d.impression)
      if (d.plan) setPlan(d.plan)
      if (d.painScore !== undefined) setPainScore(d.painScore)
    } catch {}
  }, [draftKey])

  useEffect(() => {
    if (!draftKey) return
    localStorage.setItem(draftKey, JSON.stringify({
      chiefComplaint, hpi, pmh, pmhOther, surgicalHistory, medications,
      allergiesConfirmed, allergiesList, ros, examination, impression, plan, painScore,
    }))
  }, [chiefComplaint, hpi, pmh, pmhOther, surgicalHistory, medications, allergiesConfirmed, allergiesList, ros, examination, impression, plan, painScore, draftKey])

  const toggleList = (list, setList, val) =>
    setList(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])

  const handleSave = async () => {
    if (!chiefComplaint.trim()) { setError('Chief complaint is required.'); return }
    setSaving(true); setError(null)
    try {
      const identity = await requestPin('Authenticate to save Admission Assessment')
      setVerifiedIdentity(identity)
      await api.post(`/inpatient/admissions/${admission.id}/notes`, {
        note_type: 'assessment',
        note_text: JSON.stringify({
          type: 'AdmissionAssessment',
          chiefComplaint, hpi,
          pmh: [...pmh, ...(pmh.includes('Other') ? [pmhOther] : [])],
          surgicalHistory, medications,
          allergies: { confirmed: allergiesConfirmed, list: allergiesList, coded: allergiesCoded },
          reviewOfSystems: ros,
          examination, impression, plan,
          scores: { painScore },
          recorded_by: identity.full_name,
          recorded_at: new Date().toISOString(),
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
        {/* 1. Chief complaint */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">1. Chief Complaint <span className="text-red-500">*</span></label>
          <input type="text" value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)}
            placeholder="[Chief complaint here]"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* 2. HPI */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">2. History of Present Illness</label>
          <SmartTextarea value={hpi} onChange={setHpi} rows={4}
            placeholder="[Describe onset, duration, character, associated symptoms, aggravating/relieving factors, timeline…]" />
        </div>

        {/* 3. PMH */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">3. Past Medical History</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {PMH_OPTIONS.map(opt => (
              <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={pmh.includes(opt)}
                  onChange={() => toggleList(pmh, setPmh, opt)} className="accent-emerald-600 w-4 h-4" />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
          {pmh.includes('Other') && (
            <input type="text" value={pmhOther} onChange={e => setPmhOther(e.target.value)}
              placeholder="Specify other conditions…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          )}
        </div>

        {/* 4. Surgical history */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">4. Surgical History</label>
          <SmartTextarea value={surgicalHistory} onChange={setSurgicalHistory} rows={2}
            placeholder="[Previous surgeries, dates, complications…]" />
        </div>

        {/* 5. Medications */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-semibold text-gray-700">5. Current Medications</label>
            <button
              onClick={() => setMedications('[Copy from MAR]')}
              className="text-xs text-emerald-600 hover:text-emerald-800 border border-emerald-200 rounded px-2 py-0.5"
            >
              Copy from MAR
            </button>
          </div>
          <SmartTextarea value={medications} onChange={setMedications} rows={3}
            placeholder="[List all current medications with doses and frequencies…]" />
        </div>

        {/* 6. Allergies */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">6. Allergies Confirmed</label>
          <div className="flex gap-3 mb-2">
            {[true, false].map(v => (
              <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="allergies_confirmed" checked={allergiesConfirmed === v}
                  onChange={() => setAllergiesConfirmed(v)} className="accent-emerald-600" />
                <span className="text-sm">{v ? 'Yes' : 'No known allergies'}</span>
              </label>
            ))}
          </div>
          {allergiesConfirmed && (
            <AllergySearch
              allergies={allergiesCoded}
              onChange={setAllergiesCoded}
            />
          )}
        </div>

        {/* 7. Review of systems */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">7. Review of Systems</label>
          <div className="flex flex-wrap gap-2">
            {ROS_SYSTEMS.map(sys => (
              <label key={sys} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={ros.includes(sys)}
                  onChange={() => toggleList(ros, setRos, sys)} className="accent-emerald-600 w-4 h-4" />
                <span className="text-sm text-gray-700">{sys}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 8. Physical exam */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">8. Physical Examination</label>
          <SmartTextarea value={examination} onChange={setExamination} rows={4}
            placeholder="[Vitals: T__ HR__ BP__ RR__ SpO2__% · General: … · CVS: … · Resp: … · Abdomen: … · Neuro: …]"
            hint="Dot phrase: type .pe for physical exam template" />
        </div>

        {/* 9. Initial impression */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">9. Initial Impression</label>
          <input type="text" value={impression} onChange={e => setImpression(e.target.value)}
            placeholder="[Primary diagnosis / working diagnosis…]"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* 10. Plan */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">10. Plan</label>
          <SmartTextarea value={plan} onChange={setPlan} rows={4}
            placeholder="[1. Investigations: … 2. Medications: … 3. Monitoring: … 4. Nursing instructions: … 5. Goals: …]"
            hint="Dot phrase: type .plan for plan template" />
        </div>

        {/* Scores */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Clinical Scores</p>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 w-32">Pain Score (NRS)</span>
              <input type="range" min="0" max="10" value={painScore}
                onChange={e => setPainScore(Number(e.target.value))} className="flex-1 accent-emerald-600" />
              <span className="text-sm font-bold text-gray-700 w-8 text-right">{painScore}/10</span>
            </div>
            <div className="flex gap-3">
              <a href="#" onClick={e => { e.preventDefault() }}
                className="text-sm text-emerald-600 hover:underline">→ Complete Morse Fall Risk</a>
              <a href="#" onClick={e => { e.preventDefault() }}
                className="text-sm text-emerald-600 hover:underline">→ Complete Braden Scale</a>
            </div>
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

// ── Shift Assessment Form ─────────────────────────────────────────────────────

function ShiftAssessmentForm({ admission, onClose, onSaved }) {
  const { requestPin } = usePin()

  const [neuroStatus, setNeuroStatus]     = useState('')
  const [aoLevel, setAoLevel]             = useState('')
  const [painScore, setPainScore]         = useState(0)
  const [respStatus, setRespStatus]       = useState('')
  const [o2LPM, setO2LPM]                 = useState('')
  const [ivAccess, setIvAccess]           = useState('')
  const [ivSite, setIvSite]               = useState('')
  const [dietIntake, setDietIntake]       = useState('')
  const [mobility, setMobility]           = useState('')
  const [woundSkin, setWoundSkin]         = useState('')
  const [concerns, setConcerns]           = useState('')
  const [interventions, setInterventions] = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)
  const [verifiedIdentity, setVerifiedIdentity] = useState(null)
  const [signed, setSigned]               = useState(false)
  const [signedAt, setSignedAt]           = useState(null)

  const draftKey = admission ? `draft_template_shift_${admission.id}` : null

  useEffect(() => {
    if (!draftKey) return
    const raw = localStorage.getItem(draftKey)
    if (!raw) return
    try {
      const d = JSON.parse(raw)
      if (d.neuroStatus) setNeuroStatus(d.neuroStatus)
      if (d.aoLevel) setAoLevel(d.aoLevel)
      if (d.painScore !== undefined) setPainScore(d.painScore)
      if (d.respStatus) setRespStatus(d.respStatus)
      if (d.o2LPM) setO2LPM(d.o2LPM)
      if (d.ivAccess) setIvAccess(d.ivAccess)
      if (d.ivSite) setIvSite(d.ivSite)
      if (d.dietIntake) setDietIntake(d.dietIntake)
      if (d.mobility) setMobility(d.mobility)
      if (d.woundSkin) setWoundSkin(d.woundSkin)
      if (d.concerns) setConcerns(d.concerns)
      if (d.interventions) setInterventions(d.interventions)
    } catch {}
  }, [draftKey])

  useEffect(() => {
    if (!draftKey) return
    localStorage.setItem(draftKey, JSON.stringify({
      neuroStatus, aoLevel, painScore, respStatus, o2LPM,
      ivAccess, ivSite, dietIntake, mobility, woundSkin, concerns, interventions,
    }))
  }, [neuroStatus, aoLevel, painScore, respStatus, o2LPM, ivAccess, ivSite, dietIntake, mobility, woundSkin, concerns, interventions, draftKey])

  function BtnGroup({ options, value, onChange }) {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} onClick={() => onChange(opt)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              value === opt ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
            }`}>{opt}</button>
        ))}
      </div>
    )
  }

  const handleSave = async () => {
    setSaving(true); setError(null)
    try {
      const identity = await requestPin('Authenticate to save Shift Assessment')
      setVerifiedIdentity(identity)
      await api.post(`/inpatient/admissions/${admission.id}/notes`, {
        note_type: 'assessment',
        note_text: JSON.stringify({
          type: 'ShiftAssessment',
          neuroStatus: neuroStatus === 'Alert & Oriented' ? `A&O ×${aoLevel}` : neuroStatus,
          painScore,
          respStatus: respStatus === 'On O2' ? `On O2 ${o2LPM} L/min` : respStatus,
          ivAccess, ivSiteCondition: ivSite,
          dietIntake, mobility,
          woundSkin, concerns, interventions,
          recorded_by: identity.full_name,
          recorded_at: new Date().toISOString(),
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

  function Row({ label, children }) {
    return (
      <div className="grid grid-cols-3 gap-4 items-start py-3 border-b border-gray-100 last:border-0">
        <span className="text-sm font-medium text-gray-700 pt-1">{label}</span>
        <div className="col-span-2">{children}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="divide-y divide-gray-100">
          <Row label="1. Neuro Status">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {['Alert & Oriented', 'Confused', 'Unresponsive'].map(opt => (
                  <button key={opt} onClick={() => setNeuroStatus(opt)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      neuroStatus === opt ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                    }`}>{opt}</button>
                ))}
              </div>
              {neuroStatus === 'Alert & Oriented' && (
                <div className="flex gap-2">
                  {['×1', '×2', '×3', '×4'].map(v => (
                    <button key={v} onClick={() => setAoLevel(v)}
                      className={`px-3 py-1 rounded text-sm border transition-colors ${
                        aoLevel === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      }`}>{v}</button>
                  ))}
                </div>
              )}
            </div>
          </Row>

          <Row label="2. Pain Score">
            <div>
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="10" value={painScore}
                  onChange={e => setPainScore(Number(e.target.value))} className="flex-1 accent-emerald-600" />
                <span className={`text-lg font-bold w-8 text-right ${painScore >= 7 ? 'text-red-600' : painScore >= 4 ? 'text-orange-500' : 'text-green-600'}`}>
                  {painScore}
                </span>
              </div>
            </div>
          </Row>

          <Row label="3. Respiratory">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {['Normal', 'Laboured', 'On O2'].map(opt => (
                  <button key={opt} onClick={() => setRespStatus(opt)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      respStatus === opt ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                    }`}>{opt}</button>
                ))}
              </div>
              {respStatus === 'On O2' && (
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="15" step="0.5" value={o2LPM}
                    onChange={e => setO2LPM(e.target.value)}
                    placeholder="L/min"
                    className="w-24 border border-gray-300 rounded px-2 py-1 text-sm" />
                  <span className="text-sm text-gray-500">L/min</span>
                </div>
              )}
            </div>
          </Row>

          <Row label="4. IV Access">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {['Peripheral', 'Central', 'None'].map(opt => (
                  <button key={opt} onClick={() => setIvAccess(opt)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      ivAccess === opt ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                    }`}>{opt}</button>
                ))}
              </div>
              {ivAccess && ivAccess !== 'None' && (
                <div className="flex flex-wrap gap-2">
                  {['Intact', 'Phlebitis', 'Infiltrated'].map(opt => (
                    <button key={opt} onClick={() => setIvSite(opt)}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${
                        ivSite === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}>{opt}</button>
                  ))}
                </div>
              )}
            </div>
          </Row>

          <Row label="5. Diet Intake">
            <div className="flex flex-wrap gap-2">
              {['NPO', '<25%', '25-50%', '50-75%', '>75%'].map(opt => (
                <button key={opt} onClick={() => setDietIntake(opt)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    dietIntake === opt ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                  }`}>{opt}</button>
              ))}
            </div>
          </Row>

          <Row label="6. Mobility">
            <div className="flex flex-wrap gap-2">
              {['Ambulatory', 'With assist', 'Bedrest'].map(opt => (
                <button key={opt} onClick={() => setMobility(opt)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    mobility === opt ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                  }`}>{opt}</button>
              ))}
            </div>
          </Row>

          <Row label="7. Wound / Skin">
            <div className="flex flex-wrap gap-2">
              {['Intact', 'See wound note'].map(opt => (
                <button key={opt} onClick={() => setWoundSkin(opt)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    woundSkin === opt ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                  }`}>{opt}</button>
              ))}
            </div>
          </Row>

          <Row label="8. Patient Concerns">
            <DictationTextarea value={concerns} onChange={e => setConcerns(e.target.value)} rows={2}
              placeholder="Patient / family concerns or complaints…" />
          </Row>

          <Row label="9. Interventions">
            <DictationTextarea value={interventions} onChange={e => setInterventions(e.target.value)} rows={2}
              placeholder="Nursing interventions performed this shift…" />
          </Row>
        </div>

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

        {verifiedIdentity && (
          <div className="mt-4">
            <SignatureBlock
              verifiedIdentity={verifiedIdentity}
              onSign={() => { setSigned(true); setSignedAt(new Date().toLocaleString()) }}
              signed={signed}
              signedAt={signedAt}
            />
          </div>
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

// ── Placeholder ───────────────────────────────────────────────────────────────

function PlaceholderTemplateForm({ title, onClose }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400">
        <div>
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">{title}</p>
          <p className="text-sm mt-1">Template coming soon</p>
        </div>
      </div>
      <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4 flex justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
      </div>
    </div>
  )
}

// ── Template modal ────────────────────────────────────────────────────────────

function TemplateModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-800 text-lg">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </div>
    </div>
  )
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({ template, onUse, disabled }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 ${disabled ? 'opacity-50' : 'hover:border-emerald-400 hover:shadow-md'} transition-all`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-emerald-50">
          <template.Icon size={18} className="text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm">{template.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{template.description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">~{template.estTime}</span>
        {template.internal && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Internal only</span>}
        <button
          onClick={onUse}
          disabled={disabled}
          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          Use Template
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DocumentationTemplates() {
  const [selectedAdmission, setSelectedAdmission] = useState(null)
  const [openTemplate, setOpenTemplate]           = useState(null)

  const patientName = selectedAdmission
    ? (selectedAdmission.patient_name || selectedAdmission.patient?.full_name || `Admission #${selectedAdmission.id}`)
    : null

  const handleSaved = () => setOpenTemplate(null)

  function renderModalContent(key, title) {
    const props = { admission: selectedAdmission, onClose: () => setOpenTemplate(null), onSaved: handleSaved }
    if (key === 'admission_assessment') return <AdmissionAssessmentForm {...props} />
    if (key === 'shift_assessment')     return <ShiftAssessmentForm {...props} />
    return <PlaceholderTemplateForm title={title} onClose={() => setOpenTemplate(null)} />
  }

  const activeTemplate = [...NURSING_TEMPLATES, ...PROVIDER_TEMPLATES].find(t => t.key === openTemplate)

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-widest">Patients</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PatientList selectedId={selectedAdmission?.id} onSelect={adm => { setSelectedAdmission(adm); setOpenTemplate(null) }} />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        {!selectedAdmission ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <FileText size={40} className="mb-3 opacity-30" />
            <p className="font-medium">Select a patient to access documentation templates</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-800">{patientName}</h1>
              <p className="text-sm text-gray-500">
                Bed {selectedAdmission.bed_label || selectedAdmission.bed?.label || '—'} · Documentation Templates
              </p>
            </div>

            {/* Nursing templates */}
            <section className="mb-8">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <ClipboardList size={14} /> Nursing Templates
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {NURSING_TEMPLATES.map(t => (
                  <TemplateCard
                    key={t.key}
                    template={t}
                    onUse={() => setOpenTemplate(t.key)}
                    disabled={false}
                  />
                ))}
              </div>
            </section>

            {/* Provider templates */}
            <section>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <FileText size={14} /> Provider Templates
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROVIDER_TEMPLATES.map(t => (
                  <TemplateCard
                    key={t.key}
                    template={t}
                    onUse={() => setOpenTemplate(t.key)}
                    disabled={false}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {openTemplate && activeTemplate && selectedAdmission && (
        <TemplateModal title={activeTemplate.title} onClose={() => setOpenTemplate(null)}>
          {renderModalContent(openTemplate, activeTemplate.title)}
        </TemplateModal>
      )}
    </div>
  )
}
