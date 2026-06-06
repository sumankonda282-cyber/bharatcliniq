import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/client'
import SmartTextarea from '../../components/SmartTextarea'
import CPOEOrders from './CPOEOrders'
import {
  ArrowLeft, User, Bed, Activity, ClipboardList, FileText,
  CheckCircle2, AlertTriangle, Clock, Save, ChevronDown, Plus, Lock,
  Stethoscope, HeartPulse, ListOrdered, Receipt, History,
} from 'lucide-react'

const TABS = [
  { id: 'overview',   label: 'Overview',         icon: User },
  { id: 'notes',      label: 'Progress Notes',   icon: FileText },
  { id: 'vitals',     label: 'Vitals',            icon: HeartPulse },
  { id: 'rounds',     label: 'Ward Rounds',       icon: Stethoscope },
  { id: 'orders',     label: 'Orders',            icon: ListOrdered },
  { id: 'timeline',   label: 'Timeline',          icon: History },
  { id: 'discharge',  label: 'Discharge Summary', icon: ClipboardList },
  { id: 'billing',    label: 'Billing',           icon: Receipt },
]

const NOTE_TEMPLATES = {
  soap: `SUBJECTIVE:\n\nOBJECTIVE:\nVitals: T__ P__ RR__ BP__/__ SpO2__%\n\nASSESSMENT:\n\nPLAN:\n`,
  postop: `PROCEDURE: \nANAESTHESIA: \nFINDINGS: \nCOMPLICATIONS: None\nESTIMATED BLOOD LOSS: \nPOST-OP ORDERS: \nCONDITION: Stable`,
  consult: `REASON FOR CONSULT: \n\nCLINICAL SUMMARY: \n\nEXAMINATION: \n\nIMPRESSION: \n\nRECOMMENDATIONS:\n`,
  deterioration: `REASON FOR NOTE: Acute clinical deterioration\n\nTIME NOTED: \nVITALS: T__ P__ RR__ BP__/__ SpO2__%\nGCS: \nACTIONS TAKEN: \nNOTIFIED: \nPLAN: `,
}

function SignatureBlock({ isSigned, signerName, signerCredentials, signedAt, onSign }) {
  if (isSigned) {
    return (
      <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-800">
        <CheckCircle2 size={14} />
        <span>Signed by <strong>{signerName}</strong> {signerCredentials} — {signedAt}</span>
        <Lock size={12} className="ml-auto text-emerald-600" />
      </div>
    )
  }
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-amber-700 bg-amber-50 border border-amber-300 rounded-lg p-2 hover:bg-amber-100">
      <input type="checkbox" onChange={e => e.target.checked && onSign()} />
      I attest that this documentation is accurate and complete
    </label>
  )
}

export default function AdmissionChart() {
  const { admissionId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [admission, setAdmission] = useState(null)
  const [vitals, setVitals]       = useState([])
  const [notes, setNotes]         = useState([])
  const [rounds, setRounds]       = useState([])
  const [discharge, setDischarge] = useState(null)
  const [charges, setCharges]     = useState([])
  const [loading, setLoading]     = useState(true)

  // Progress note form
  const [noteContent, setNoteContent] = useState('')
  const [noteType, setNoteType]       = useState('progress')
  const [savingNote, setSavingNote]   = useState(false)
  const [noteError, setNoteError]     = useState('')

  // Vital form
  const [vitalForm, setVitalForm]   = useState({ temperature: '', pulse: '', respiratory_rate: '', bp_systolic: '', bp_diastolic: '', spo2: '', pain_score: '', blood_glucose: '', notes: '' })
  const [savingVital, setSavingVital] = useState(false)

  // Ward round form
  const [roundForm, setRoundForm] = useState({ subjective: '', objective: '', assessment: '', plan: '', round_type: 'ward_round' })
  const [savingRound, setSavingRound] = useState(false)

  // Discharge summary
  const [dsForm, setDsForm]         = useState({})
  const [dsSaved, setDsSaved]       = useState('')
  const dsTimer = useRef(null)

  const loadAll = useCallback(async () => {
    if (!admissionId) return
    try {
      const [adm, vs, ns, rs, ds, ch] = await Promise.all([
        api.get(`/inpatient/admissions/${admissionId}`),
        api.get(`/inpatient/admissions/${admissionId}/vitals`).catch(() => []),
        api.get(`/inpatient/admissions/${admissionId}/notes`).catch(() => []),
        api.get(`/inpatient/admissions/${admissionId}/rounds`).catch(() => []),
        api.get(`/inpatient/admissions/${admissionId}/discharge-summary`).catch(() => null),
        api.get(`/inpatient/admissions/${admissionId}/charges`).catch(() => []),
      ])
      setAdmission(adm)
      setVitals(vs || [])
      setNotes(ns || [])
      setRounds(rs || [])
      setDischarge(ds)
      if (ds) setDsForm(ds)
      setCharges(ch || [])
    } catch (e) {
      console.error(e)
    } finally { setLoading(false) }
  }, [admissionId])

  useEffect(() => { loadAll() }, [loadAll])

  // Auto-save discharge summary
  useEffect(() => {
    if (activeTab !== 'discharge' || !admissionId) return
    clearTimeout(dsTimer.current)
    dsTimer.current = setTimeout(async () => {
      try {
        await api.post(`/inpatient/admissions/${admissionId}/discharge-summary`, dsForm)
        setDsSaved('Auto-saved ' + new Date().toLocaleTimeString('en-IN'))
      } catch {}
    }, 3000)
    return () => clearTimeout(dsTimer.current)
  }, [dsForm, activeTab, admissionId])

  const saveNote = async () => {
    if (!noteContent.trim()) { setNoteError('Note content required'); return }
    setSavingNote(true); setNoteError('')
    try {
      await api.post(`/inpatient/admissions/${admissionId}/notes`, { content: noteContent, note_type: noteType })
      setNoteContent('')
      loadAll()
    } catch (e) { setNoteError(e?.detail || 'Failed to save') }
    finally { setSavingNote(false) }
  }

  const saveVital = async () => {
    setSavingVital(true)
    try {
      const payload = {}
      Object.entries(vitalForm).forEach(([k, v]) => { if (v !== '') payload[k] = isNaN(v) ? v : Number(v) })
      await api.post(`/inpatient/admissions/${admissionId}/vitals`, payload)
      setVitalForm({ temperature: '', pulse: '', respiratory_rate: '', bp_systolic: '', bp_diastolic: '', spo2: '', pain_score: '', blood_glucose: '', notes: '' })
      loadAll()
    } catch {}
    finally { setSavingVital(false) }
  }

  const saveRound = async () => {
    setSavingRound(true)
    try {
      await api.post(`/inpatient/admissions/${admissionId}/rounds`, roundForm)
      setRoundForm({ subjective: '', objective: '', assessment: '', plan: '', round_type: 'ward_round' })
      loadAll()
    } catch {}
    finally { setSavingRound(false) }
  }

  const signNote = async (noteId) => {
    try { await api.post(`/inpatient/notes/${noteId}/sign`); loadAll() } catch {}
  }
  const signRound = async (roundId) => {
    try { await api.post(`/inpatient/rounds/${roundId}/sign`); loadAll() } catch {}
  }
  const signDischarge = async () => {
    try { await api.post(`/inpatient/admissions/${admissionId}/discharge-summary/sign`); loadAll() } catch {}
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading chart…</div>
  if (!admission) return <div className="text-red-500 p-4">Admission not found.</div>

  const p = admission.patient || {}
  const age = p.date_of_birth ? Math.floor((new Date() - new Date(p.date_of_birth)) / 31557600000) : '?'

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">{p.full_name}</span>
            <span className="text-gray-500 text-sm">{age}y {p.gender?.[0]}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              admission.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
            }`}>{admission.status}</span>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span>{admission.admission_number}</span>
            {admission.ward && <><Bed size={10} /><span>{admission.ward.name}</span></>}
            {admission.bed && <span>Bed {admission.bed.bed_number}</span>}
            <span>Admitted {new Date(admission.admitted_at).toLocaleDateString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="bg-white border-b border-gray-200 flex overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
              activeTab === id ? 'border-indigo-600 text-indigo-700 bg-indigo-50' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
              <h3 className="font-semibold text-gray-900">Patient</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Name: <strong>{p.full_name}</strong></div>
                <div>Age/Sex: {age}y / {p.gender}</div>
                <div>Mobile: {p.mobile}</div>
                {p.bh_id && <div>BHID: {p.bh_id}</div>}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
              <h3 className="font-semibold text-gray-900">Admission</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div>IP Number: <strong>{admission.admission_number}</strong></div>
                <div>Admitted: {new Date(admission.admitted_at).toLocaleString('en-IN')}</div>
                <div>Doctor: {admission.doctor?.full_name}</div>
                <div>Diagnosis: {admission.primary_diagnosis || '—'}</div>
              </div>
            </div>
            {vitals[0] && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Latest Vitals</h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {vitals[0].temperature && <div className="text-center"><div className="text-gray-500 text-xs">Temp</div><div className="font-semibold">{vitals[0].temperature}°C</div></div>}
                  {vitals[0].pulse       && <div className="text-center"><div className="text-gray-500 text-xs">Pulse</div><div className="font-semibold">{vitals[0].pulse} bpm</div></div>}
                  {vitals[0].bp_systolic && <div className="text-center"><div className="text-gray-500 text-xs">BP</div><div className="font-semibold">{vitals[0].bp_systolic}/{vitals[0].bp_diastolic}</div></div>}
                  {vitals[0].spo2        && <div className="text-center"><div className="text-gray-500 text-xs">SpO₂</div><div className="font-semibold">{vitals[0].spo2}%</div></div>}
                  {vitals[0].pain_score != null && <div className="text-center"><div className="text-gray-500 text-xs">Pain</div><div className="font-semibold">{vitals[0].pain_score}/10</div></div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Notes */}
        {activeTab === 'notes' && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <select className="input w-40 text-sm" value={noteType} onChange={e => setNoteType(e.target.value)}>
                  <option value="progress">Progress Note</option>
                  <option value="post_op">Post-Op Note</option>
                  <option value="consult">Consult Note</option>
                  <option value="deterioration">Deterioration Note</option>
                </select>
                <select className="input flex-1 text-sm" onChange={e => e.target.value && setNoteContent(NOTE_TEMPLATES[e.target.value] || '')}>
                  <option value="">Load template…</option>
                  <option value="soap">SOAP</option>
                  <option value="postop">Post-Op</option>
                  <option value="consult">Consult</option>
                  <option value="deterioration">Deterioration</option>
                </select>
              </div>
              <SmartTextarea rows={10} placeholder="Start typing or load a template…" value={noteContent} onChange={e => setNoteContent(e.target.value)} />
              {noteError && <p className="text-red-600 text-xs">{noteError}</p>}
              <div className="flex gap-2 justify-end">
                {notes[0] && (
                  <button onClick={() => setNoteContent(notes[0].content)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                    Copy Forward
                  </button>
                )}
                <button onClick={saveNote} disabled={savingNote}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  {savingNote ? 'Saving…' : 'Save Note'}
                </button>
              </div>
            </div>
            {notes.map(n => (
              <div key={n.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-500">{n.note_type} · {new Date(n.created_at).toLocaleString('en-IN')} · {n.author_name}</div>
                </div>
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">{n.content}</pre>
                <div className="mt-3">
                  <SignatureBlock isSigned={n.is_signed} signerName={n.signer_name} signerCredentials={n.signer_credentials}
                    signedAt={n.signed_at && new Date(n.signed_at).toLocaleString('en-IN')}
                    onSign={() => signNote(n.id)} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Vitals */}
        {activeTab === 'vitals' && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Record Vitals</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  ['temperature', 'Temperature (°C)'], ['pulse', 'Pulse (bpm)'],
                  ['respiratory_rate', 'Resp Rate (/min)'], ['bp_systolic', 'BP Systolic'],
                  ['bp_diastolic', 'BP Diastolic'], ['spo2', 'SpO₂ (%)'],
                  ['pain_score', 'Pain Score (0-10)'], ['blood_glucose', 'Blood Glucose'],
                ].map(([field, label]) => (
                  <div key={field}>
                    <label className="label">{label}</label>
                    <input className="input" type="number" step="0.1" value={vitalForm[field]}
                      onChange={e => setVitalForm(f => ({ ...f, [field]: e.target.value }))} />
                  </div>
                ))}
                <div className="col-span-2 sm:col-span-3">
                  <label className="label">Notes</label>
                  <input className="input" value={vitalForm.notes}
                    onChange={e => setVitalForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <button onClick={saveVital} disabled={savingVital}
                className="mt-3 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                {savingVital ? 'Saving…' : 'Record Vitals'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs bg-white border border-gray-200 rounded-xl">
                <thead className="bg-gray-50">
                  <tr>{['Time', 'T°', 'P', 'RR', 'BP', 'SpO₂', 'Pain', 'Gluc'].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>{vitals.map(v => (
                  <tr key={v.id} className="border-t border-gray-100">
                    <td className="px-2 py-1.5 text-gray-500">{new Date(v.recorded_at).toLocaleString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-2 py-1.5">{v.temperature || '—'}</td>
                    <td className="px-2 py-1.5">{v.pulse || '—'}</td>
                    <td className="px-2 py-1.5">{v.respiratory_rate || '—'}</td>
                    <td className="px-2 py-1.5">{v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic}` : '—'}</td>
                    <td className="px-2 py-1.5">{v.spo2 ? `${v.spo2}%` : '—'}</td>
                    <td className="px-2 py-1.5">{v.pain_score ?? '—'}</td>
                    <td className="px-2 py-1.5">{v.blood_glucose || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ward Rounds */}
        {activeTab === 'rounds' && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">New Ward Round</h3>
              {[['subjective', 'Subjective (S)'], ['objective', 'Objective (O)'], ['assessment', 'Assessment (A)'], ['plan', 'Plan (P)']].map(([k, l]) => (
                <div key={k}>
                  <label className="label">{l}</label>
                  <SmartTextarea rows={3} value={roundForm[k]} onChange={e => setRoundForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <button onClick={saveRound} disabled={savingRound}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                {savingRound ? 'Saving…' : 'Save Round'}
              </button>
            </div>
            {rounds.map(r => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-2">{new Date(r.created_at).toLocaleString('en-IN')} · {r.author_name}</div>
                {[['Subjective', r.subjective], ['Objective', r.objective], ['Assessment', r.assessment], ['Plan', r.plan]].map(([l, v]) => v && (
                  <div key={l} className="mb-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase">{l}</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{v}</div>
                  </div>
                ))}
                <div className="mt-2">
                  <SignatureBlock isSigned={r.is_signed} signerName={r.signer_name} signerCredentials={r.signer_credentials}
                    signedAt={r.signed_at && new Date(r.signed_at).toLocaleString('en-IN')} onSign={() => signRound(r.id)} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Orders (CPOE) */}
        {activeTab === 'orders' && (
          <div className="max-w-3xl">
            <CPOEOrders admissionId={admissionId} patientAllergies={admission.patient?.allergies || []} />
          </div>
        )}

        {/* Timeline */}
        {activeTab === 'timeline' && (
          <div className="max-w-2xl space-y-2">
            {[...notes, ...rounds, ...vitals].sort((a, b) => new Date(b.created_at || b.recorded_at) - new Date(a.created_at || a.recorded_at)).map((item, i) => {
              const isVital  = 'pulse' in item
              const isRound  = 'subjective' in item
              const time = new Date(item.created_at || item.recorded_at).toLocaleString('en-IN')
              return (
                <div key={i} className="flex gap-3">
                  <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-indigo-400 ring-4 ring-white" />
                  <div className="flex-1 bg-white border border-gray-200 rounded-xl p-3 text-sm">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-0.5">
                      <Clock size={10} />{time}
                      <span className="font-semibold text-gray-700">
                        {isVital ? 'Vitals recorded' : isRound ? 'Ward round' : `${item.note_type} note`}
                      </span>
                    </div>
                    {isVital && <div>{item.temperature && `T ${item.temperature}°C`} {item.pulse && `P ${item.pulse}`} {item.bp_systolic && `BP ${item.bp_systolic}/${item.bp_diastolic}`}</div>}
                    {!isVital && <div className="text-gray-700 line-clamp-2">{item.content || item.assessment || item.subjective}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Discharge Summary */}
        {activeTab === 'discharge' && (
          <div className="max-w-2xl space-y-3">
            {dsSaved && <div className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} />{dsSaved}</div>}
            {[
              ['presenting_complaint', 'Presenting Complaint'],
              ['history', 'History of Present Illness'],
              ['examination', 'Physical Examination'],
              ['investigations', 'Key Investigations'],
              ['diagnosis', 'Final Diagnosis'],
              ['hospital_course', 'Hospital Course & Management'],
              ['procedures_performed', 'Procedures Performed'],
              ['discharge_condition', 'Condition at Discharge'],
              ['discharge_instructions', 'Discharge Instructions'],
              ['medications_at_discharge', 'Medications at Discharge'],
              ['follow_up', 'Follow-up Plan'],
            ].map(([k, l]) => (
              <div key={k} className="bg-white border border-gray-200 rounded-xl p-3">
                <label className="label">{l}</label>
                <SmartTextarea rows={k === 'hospital_course' ? 5 : 3}
                  value={dsForm[k] || ''}
                  onChange={e => setDsForm(f => ({ ...f, [k]: e.target.value }))}
                  disabled={discharge?.is_signed} />
              </div>
            ))}
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <SignatureBlock isSigned={discharge?.is_signed} signerName={discharge?.signer_name}
                signerCredentials={discharge?.signer_credentials}
                signedAt={discharge?.signed_at && new Date(discharge.signed_at).toLocaleString('en-IN')}
                onSign={signDischarge} />
            </div>
          </div>
        )}

        {/* Billing */}
        {activeTab === 'billing' && (
          <div className="max-w-2xl">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>{['Date', 'Type', 'Description', 'Qty', 'Rate', 'Total'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {charges.map(c => (
                    <tr key={c.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-xs text-gray-500">{c.charge_date}</td>
                      <td className="px-3 py-2 text-xs">{c.charge_type}</td>
                      <td className="px-3 py-2">{c.description}</td>
                      <td className="px-3 py-2 text-center">{c.quantity}</td>
                      <td className="px-3 py-2">₹{c.unit_price}</td>
                      <td className="px-3 py-2 font-semibold">₹{c.total}</td>
                    </tr>
                  ))}
                  {charges.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No charges yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
