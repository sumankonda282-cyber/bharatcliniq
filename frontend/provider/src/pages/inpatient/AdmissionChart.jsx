import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api/client'
import {
  ArrowLeft, Activity, FileText, Stethoscope, ClipboardList,
  ArrowLeftRight, BedDouble, AlertCircle, RefreshCw, Plus, Trash2,
  Settings2, Copy, CheckCircle2, ChevronDown, Printer, Banknote, Mic, MicOff,
  UserCheck, X as XIcon, Search,
} from 'lucide-react'
import { PageLoader } from '../../components/ui/Spinner'
import InpatientBilling from './InpatientBilling'

// ── Smart Phrases ─────────────────────────────────────────────────────────────
const SMART_PHRASES = [
  { trigger: '.ros',    text: 'Review of Systems: Cardiovascular: No chest pain, palpitations, or edema. Respiratory: No shortness of breath or cough. GI: No nausea, vomiting, or abdominal pain. Neuro: No headache, dizziness, or focal weakness.' },
  { trigger: '.pe',     text: 'Physical Examination:\nGeneral: Alert and oriented x3, no acute distress.\nCVS: Regular rate and rhythm, no murmurs.\nResp: Clear to auscultation bilaterally.\nAbdomen: Soft, non-tender, non-distended.\nExtremities: No edema.' },
  { trigger: '.normal', text: 'Within normal limits.' },
  { trigger: '.stable', text: 'Patient is clinically stable. Vitals within acceptable range. No acute distress noted.' },
  { trigger: '.dc',     text: 'Discussed with patient and family. Risks, benefits, and alternatives explained. Patient agreeable to plan.' },
  { trigger: '.fu',     text: 'Follow-up in clinic in 1-2 weeks. Return to ER if symptoms worsen.' },
  { trigger: '.diet',   text: 'Diet: As tolerated. Encourage adequate hydration and balanced nutrition.' },
  { trigger: '.bp',     text: 'Blood pressure controlled on current regimen. Continue antihypertensive therapy.' },
  { trigger: '.dm',     text: 'Diabetes managed. Blood glucose monitoring advised. Continue current antidiabetic regimen.' },
  { trigger: '.ecg',    text: 'ECG reviewed. Normal sinus rhythm. No acute ST changes or arrhythmia noted.' },
]

function SmartTextarea({ value, onChange, placeholder, rows = 4, disabled = false }) {
  const [showDrop, setShowDrop] = useState(false)
  const [matches, setMatches]   = useState([])
  const [listening, setListening] = useState(false)
  const ref = useRef(null)
  const recogRef = useRef(null)

  const onKeyUp = e => {
    const before = e.target.value.slice(0, e.target.selectionStart)
    const word = (before.match(/(\S+)$/) || [])[1] || ''
    if (word.startsWith('.') && word.length > 1) {
      const hits = SMART_PHRASES.filter(p => p.trigger.startsWith(word))
      setMatches(hits); setShowDrop(hits.length > 0)
    } else { setShowDrop(false) }
  }

  const insert = phrase => {
    const ta = ref.current
    const pos = ta.selectionStart
    const newBefore = ta.value.slice(0, pos).replace(/(\S+)$/, phrase.text)
    const newVal = newBefore + ta.value.slice(pos)
    onChange({ target: { value: newVal } })
    setShowDrop(false)
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = newBefore.length }, 0)
  }

  const startDictation = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Voice dictation not supported in this browser. Use Chrome.'); return }
    const recog = new SR()
    recog.continuous = true
    recog.interimResults = true
    recog.lang = 'en-IN'
    recogRef.current = recog
    recog.onresult = (e) => {
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
      }
      if (final) {
        onChange({ target: { value: value + (value && !value.endsWith(' ') ? ' ' : '') + final } })
      }
    }
    recog.onerror = () => setListening(false)
    recog.onend = () => setListening(false)
    recog.start()
    setListening(true)
  }

  const stopDictation = () => {
    recogRef.current?.stop()
    setListening(false)
  }

  return (
    <div className="relative">
      <textarea ref={ref} value={value} onChange={onChange} onKeyUp={onKeyUp}
        onBlur={() => setTimeout(() => setShowDrop(false), 150)}
        placeholder={placeholder} rows={rows} disabled={disabled}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none disabled:bg-gray-50 pr-10 ${listening ? 'border-red-400 bg-red-50 focus:ring-red-400' : 'border-gray-300 focus:ring-blue-500'}`} />
      {showDrop && (
        <div className="absolute z-50 left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {matches.map(p => (
            <button key={p.trigger} type="button" onMouseDown={() => insert(p)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0">
              <span className="font-mono font-bold text-blue-600 text-xs">{p.trigger}</span>
              <span className="text-gray-500 text-xs ml-2">{p.text.slice(0, 55)}…</span>
            </button>
          ))}
        </div>
      )}
      {!disabled && (
        <button
          type="button"
          onMouseDown={listening ? stopDictation : startDictation}
          title={listening ? 'Stop dictation' : 'Start voice dictation'}
          className={`absolute right-2 bottom-2 p-1 rounded-full transition-all ${
            listening
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
          }`}
        >
          {listening ? <MicOff size={14} /> : <Mic size={14} />}
        </button>
      )}
      {listening && (
        <p className="text-xs text-red-500 animate-pulse mt-1">🎤 Listening… speak now. Click mic to stop.</p>
      )}
    </div>
  )
}

// ── Note Templates ────────────────────────────────────────────────────────────
const NOTE_TEMPLATES = {
  'SOAP Progress':       { subjective: '[Chief complaint and history of present illness]', objective: '[Physical exam findings]\n[Relevant lab/imaging results]', assessment: '[Clinical impression and diagnosis]', plan: '[Treatment plan, medications, consults ordered]' },
  'Post-Op Note':        { subjective: 'Post-operative day [X]. Patient reports [symptoms].', objective: 'Wound: [clean/dry/intact]. Vitals stable.', assessment: 'Post-op day [X] status. [Complications if any].', plan: 'Continue wound care. [Pain management]. Follow up with surgeon in [X] days.' },
  'Consult Note':        { subjective: 'Consulted by Dr. [Name] for [reason]. Patient presents with [history].', objective: '[Relevant examination findings]', assessment: '[Consultant impression]', plan: '[Recommendations]\n[Follow-up plan]' },
  'Deterioration Event': { subjective: 'Patient noted to have acute change in condition at [time].', objective: 'Vitals: [document]. Physical exam: [findings].', assessment: 'Acute deterioration — [suspected cause].', plan: '[Immediate interventions]\n[Investigations ordered]\n[Family notified: Yes/No]' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    active:            'bg-green-100 text-green-800',
    discharge_pending: 'bg-amber-100 text-amber-800',
    discharged:        'bg-gray-100 text-gray-600',
    transferred:       'bg-blue-100 text-blue-800',
  }
  const label = {
    active:            'Active',
    discharge_pending: 'Discharge Pending',
    discharged:        'Discharged',
    transferred:       'Transferred',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {label[status] || status}
    </span>
  )
}

function NoteTypeBadge({ type }) {
  const styles = {
    progress:  'bg-blue-100 text-blue-800',
    consult:   'bg-purple-100 text-purple-800',
    procedure: 'bg-orange-100 text-orange-800',
    event:     'bg-red-100 text-red-800',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[type] || 'bg-gray-100 text-gray-600'}`}>
      {type?.charAt(0).toUpperCase() + type?.slice(1)}
    </span>
  )
}

function fmtDateTime(str) {
  if (!str) return '—'
  const d = new Date(str)
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

function VitalsStrip({ v }) {
  if (!v) return null
  return (
    <div className="flex flex-wrap gap-3 text-xs font-mono text-gray-700 bg-blue-50 rounded-lg px-3 py-2">
      {v.temperature    != null && <span>T: {v.temperature}°C</span>}
      {v.pulse_rate     != null && <span>HR: {v.pulse_rate}</span>}
      {(v.blood_pressure_systolic != null) && <span>BP: {v.blood_pressure_systolic}/{v.blood_pressure_diastolic}</span>}
      {v.oxygen_saturation != null && <span>SpO2: {v.oxygen_saturation}%</span>}
      {v.pain_score     != null && <span>Pain: {v.pain_score}/10</span>}
    </div>
  )
}

function isAbnormal(key, val) {
  if (val == null || val === '') return false
  const n = parseFloat(val)
  if (isNaN(n)) return false
  switch (key) {
    case 'temperature':          return n > 38.5 || n < 36
    case 'pulse_rate':           return n > 100 || n < 60
    case 'oxygen_saturation':    return n < 95
    case 'blood_pressure_systolic': return n > 140 || n < 90
    case 'pain_score':           return n >= 7
    default: return false
  }
}

// ── Progress Notes Tab ────────────────────────────────────────────────────────
function ProgressNotesTab({ admissionId, vitals, canWrite }) {
  const [notes, setNotes]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [err, setErr]           = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState('')
  const [copyBanner, setCopyBanner] = useState('')

  const [form, setForm] = useState({
    note_type: 'progress',
    note_date: new Date().toISOString().split('T')[0],
    is_significant: false,
    subjective: '', objective: '', assessment: '', plan: '',
  })
  const [showTemplates, setShowTemplates] = useState(false)

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const fetchNotes = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const r = await api.get(`/inpatient/admissions/${admissionId}/progress-notes`)
      setNotes(Array.isArray(r) ? r : (r?.items || r?.data || []))
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to load notes')
    } finally { setLoading(false) }
  }, [admissionId])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const openModal = () => {
    setForm({ note_type: 'progress', note_date: new Date().toISOString().split('T')[0], is_significant: false, subjective: '', objective: '', assessment: '', plan: '' })
    setCopyBanner('')
    setShowModal(true)
  }

  const applyTemplate = tpl => {
    const t = NOTE_TEMPLATES[tpl]
    if (!t) return
    const hasContent = form.subjective || form.objective || form.assessment || form.plan
    if (hasContent && !window.confirm('Replace current content with template?')) return
    setForm(f => ({ ...f, ...t }))
    setShowTemplates(false)
  }

  const copyFromLast = () => {
    if (!notes.length) return
    const last = notes[0]
    setForm(f => ({ ...f, subjective: last.subjective || '', objective: last.objective || '', assessment: last.assessment || '', plan: last.plan || '' }))
    setCopyBanner(`Copied from ${fmtDateTime(last.created_at || last.note_date)} — review before saving`)
  }

  const submit = async e => {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(`/inpatient/admissions/${admissionId}/progress-notes`, { ...form, note_type: form.note_type })
      setShowModal(false)
      showToast('Progress note saved')
      fetchNotes()
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to save note')
    } finally { setSaving(false) }
  }

  const latestVital = vitals?.[0]
  const lastNote    = notes[0]

  return (
    <div className="lg:flex gap-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl shadow-lg text-sm print:hidden">
          <CheckCircle2 size={16} />{toast}
        </div>
      )}

      {/* Left: notes feed */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Progress Notes</h3>
          {canWrite && (
            <button onClick={openModal} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: '#0F2557' }}>
              <Plus size={14} />New Progress Note
            </button>
          )}
        </div>
        {err && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle size={15} className="shrink-0" />{err}
          </div>
        )}
        {loading ? (
          <div className="flex flex-col items-center py-10 gap-2 text-gray-400">
            <RefreshCw size={22} className="animate-spin opacity-50" />
            <span className="text-sm">Loading notes…</span>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No progress notes yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map(n => (
              <div key={n.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-700">{fmtDateTime(n.created_at || n.note_date)}</span>
                    <NoteTypeBadge type={n.note_type} />
                    {n.is_significant && <span className="text-red-600 font-bold text-sm" title="Significant">⚑</span>}
                  </div>
                  <span className="text-xs text-gray-400">{n.written_by_name || n.written_by || ''}</span>
                </div>
                <div className="space-y-2 text-sm">
                  {n.subjective  && <div><span className="font-semibold text-gray-600 uppercase text-xs tracking-wide">S</span> <span className="text-gray-700 ml-1 whitespace-pre-wrap">{n.subjective}</span></div>}
                  {n.objective   && <div><span className="font-semibold text-gray-600 uppercase text-xs tracking-wide">O</span> <span className="text-gray-700 ml-1 whitespace-pre-wrap">{n.objective}</span></div>}
                  {n.assessment  && <div><span className="font-semibold text-gray-600 uppercase text-xs tracking-wide">A</span> <span className="text-gray-700 ml-1 whitespace-pre-wrap">{n.assessment}</span></div>}
                  {n.plan        && <div><span className="font-semibold text-gray-600 uppercase text-xs tracking-wide">P</span> <span className="text-gray-700 ml-1 whitespace-pre-wrap">{n.plan}</span></div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: sticky reference panel */}
      <div className="lg:w-72 shrink-0 mt-6 lg:mt-0 space-y-4">
        {latestVital && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Latest Vitals</h4>
            <VitalsStrip v={latestVital} />
          </div>
        )}
        {lastNote && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Last Note Summary</h4>
            <div className="text-xs text-gray-500 mb-2">{fmtDateTime(lastNote.created_at || lastNote.note_date)}</div>
            {lastNote.assessment && (
              <div className="mb-1">
                <span className="font-semibold text-gray-600 text-xs">A:</span>
                <p className="text-xs text-gray-700 line-clamp-3 mt-0.5">{lastNote.assessment}</p>
              </div>
            )}
            {lastNote.plan && (
              <div>
                <span className="font-semibold text-gray-600 text-xs">P:</span>
                <p className="text-xs text-gray-700 line-clamp-3 mt-0.5">{lastNote.plan}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Progress Note Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto print:hidden" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-4" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>New Progress Note</h3>
                <div className="flex items-center gap-2">
                  {/* Template picker */}
                  <div className="relative">
                    <button type="button" onClick={() => setShowTemplates(v => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
                      <Settings2 size={14} />Templates<ChevronDown size={12} />
                    </button>
                    {showTemplates && (
                      <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                        {Object.keys(NOTE_TEMPLATES).map(k => (
                          <button key={k} type="button" onClick={() => applyTemplate(k)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0">
                            {k}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={copyFromLast}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                    title="Copy from last note">
                    <Copy size={14} />Copy Last
                  </button>
                </div>
              </div>
              {/* Latest vitals strip in modal */}
              {latestVital && <div className="mt-3"><VitalsStrip v={latestVital} /></div>}
              {copyBanner && (
                <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  {copyBanner}
                </div>
              )}
            </div>
            <form onSubmit={submit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Note Type</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.note_type} onChange={e => setF('note_type', e.target.value)}>
                    <option value="progress">Progress</option>
                    <option value="consult">Consult</option>
                    <option value="procedure">Procedure</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.note_date} onChange={e => setF('note_date', e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.is_significant} onChange={e => setF('is_significant', e.target.checked)}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                <span className="text-red-600 font-bold">⚑</span> Mark as Significant
              </label>
              {[['subjective', 'Subjective', 3], ['objective', 'Objective', 4], ['assessment', 'Assessment', 3], ['plan', 'Plan', 4]].map(([k, label, rows]) => (
                <div key={k}>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</label>
                  <SmartTextarea value={form[k]} onChange={e => setF(k, e.target.value)} placeholder={`Enter ${label.toLowerCase()}… (type . for smart phrases)`} rows={rows} />
                </div>
              ))}
              {err && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0" />{err}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90" style={{ background: '#0F2557' }}>
                  {saving ? 'Saving…' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vitals Tab ────────────────────────────────────────────────────────────────
function VitalsTab({ admissionId }) {
  const [vitals, setVitals]   = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')

  useEffect(() => {
    api.get(`/inpatient/admissions/${admissionId}/vitals`)
      .then(r => setVitals(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(ex => setErr(ex?.response?.data?.detail || ex.message || 'Failed to load vitals'))
      .finally(() => setLoading(false))
  }, [admissionId])

  const cell = (key, val) => (
    <td className={`px-3 py-2.5 text-sm whitespace-nowrap ${isAbnormal(key, val) ? 'text-red-700 font-semibold bg-red-50' : 'text-gray-700'}`}>
      {val ?? '—'}
    </td>
  )

  if (loading) return <div className="flex justify-center py-10"><RefreshCw size={22} className="animate-spin text-gray-400" /></div>
  if (err) return <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"><AlertCircle size={15} />{err}</div>
  if (!vitals.length) return (
    <div className="text-center py-12 text-gray-400">
      <Activity size={36} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium">No vitals recorded yet</p>
    </div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {['Time', 'Temp (°C)', 'Pulse', 'BP', 'SpO2', 'RR', 'Pain', 'By'].map(h => (
              <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {vitals.map((v, i) => (
            <tr key={v.id || i} className="hover:bg-gray-50">
              <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(v.recorded_at || v.created_at)}</td>
              {cell('temperature', v.temperature)}
              {cell('pulse_rate', v.pulse_rate)}
              <td className={`px-3 py-2.5 text-sm whitespace-nowrap ${isAbnormal('blood_pressure_systolic', v.blood_pressure_systolic) ? 'text-red-700 font-semibold bg-red-50' : 'text-gray-700'}`}>
                {v.blood_pressure_systolic != null ? `${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}` : '—'}
              </td>
              {cell('oxygen_saturation', v.oxygen_saturation != null ? `${v.oxygen_saturation}%` : null)}
              <td className="px-3 py-2.5 text-sm text-gray-700">{v.respiratory_rate ?? '—'}</td>
              {cell('pain_score', v.pain_score)}
              <td className="px-3 py-2.5 text-xs text-gray-400">{v.recorded_by_name || v.recorded_by || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Ward Rounds Tab ───────────────────────────────────────────────────────────
function WardRoundsTab({ admissionId, canWrite }) {
  const [rounds, setRounds]   = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({ subjective: '', objective: '', assessment: '', plan: '' })
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const fetchRounds = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/inpatient/admissions/${admissionId}/rounds`)
      setRounds(Array.isArray(r) ? r : (r?.items || r?.data || []))
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to load rounds')
    } finally { setLoading(false) }
  }, [admissionId])

  useEffect(() => { fetchRounds() }, [fetchRounds])

  const submit = async e => {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(`/inpatient/admissions/${admissionId}/rounds`, form)
      setShowForm(false)
      setForm({ subjective: '', objective: '', assessment: '', plan: '' })
      fetchRounds()
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to save round')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Ward Rounds</h3>
        {canWrite && !showForm && (
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: '#0F2557' }}>
            <Plus size={14} />Add Round Note
          </button>
        )}
      </div>
      {err && <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle size={15} />{err}</div>}

      {showForm && (
        <form onSubmit={submit} className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 space-y-3">
          <h4 className="text-sm font-semibold text-blue-900">New Round Note</h4>
          {[['subjective', 'Subjective', 3], ['objective', 'Objective', 4], ['assessment', 'Assessment', 2], ['plan', 'Plan', 3]].map(([k, label, rows]) => (
            <div key={k}>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</label>
              <SmartTextarea value={form[k]} onChange={e => setF(k, e.target.value)} placeholder={`Enter ${label.toLowerCase()}…`} rows={rows} />
            </div>
          ))}
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90" style={{ background: '#0F2557' }}>
              {saving ? 'Saving…' : 'Save Round'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><RefreshCw size={22} className="animate-spin text-gray-400" /></div>
      ) : rounds.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Stethoscope size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No ward rounds recorded yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rounds.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">{fmtDateTime(r.created_at || r.round_date)}</span>
                <span className="text-xs text-gray-400">{r.written_by_name || r.written_by || ''}</span>
              </div>
              <div className="space-y-2 text-sm">
                {r.subjective  && <div><span className="font-semibold text-gray-600 uppercase text-xs tracking-wide">S</span> <span className="text-gray-700 ml-1 whitespace-pre-wrap">{r.subjective}</span></div>}
                {r.objective   && <div><span className="font-semibold text-gray-600 uppercase text-xs tracking-wide">O</span> <span className="text-gray-700 ml-1 whitespace-pre-wrap">{r.objective}</span></div>}
                {r.assessment  && <div><span className="font-semibold text-gray-600 uppercase text-xs tracking-wide">A</span> <span className="text-gray-700 ml-1 whitespace-pre-wrap">{r.assessment}</span></div>}
                {r.plan        && <div><span className="font-semibold text-gray-600 uppercase text-xs tracking-wide">P</span> <span className="text-gray-700 ml-1 whitespace-pre-wrap">{r.plan}</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Timeline Tab ──────────────────────────────────────────────────────────────
function TimelineTab({ admissionId }) {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]       = useState('')

  useEffect(() => {
    api.get(`/inpatient/admissions/${admissionId}/timeline`)
      .then(r => setItems(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(ex => setErr(ex?.response?.data?.detail || ex.message || 'Failed to load timeline'))
      .finally(() => setLoading(false))
  }, [admissionId])

  const iconFor = type => {
    switch (type) {
      case 'vitals':        return <Activity size={15} className="text-blue-500" />
      case 'nursing_note':  return <ClipboardList size={15} className="text-green-500" />
      case 'progress_note': return <FileText size={15} className="text-indigo-500" />
      case 'ward_round':    return <Stethoscope size={15} className="text-purple-500" />
      case 'transfer':      return <ArrowLeftRight size={15} className="text-orange-500" />
      default:              return <FileText size={15} className="text-gray-400" />
    }
  }

  if (loading) return <div className="flex justify-center py-10"><RefreshCw size={22} className="animate-spin text-gray-400" /></div>
  if (err) return <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"><AlertCircle size={15} />{err}</div>
  if (!items.length) return (
    <div className="text-center py-12 text-gray-400">
      <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium">No timeline events yet</p>
    </div>
  )

  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />
      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={item.id || i} className="flex gap-4">
            <div className="relative z-10 flex-shrink-0 w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm">
              {iconFor(item.type)}
            </div>
            <div className="flex-1 bg-white border border-gray-200 rounded-xl p-3 shadow-sm mb-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded capitalize">
                    {item.type?.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{fmtDateTime(item.created_at || item.timestamp)}</span>
              </div>
              <p className="text-sm text-gray-700">{item.summary || item.description || '—'}</p>
              {item.written_by_name && <p className="text-xs text-gray-400 mt-1">By {item.written_by_name}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Discharge Summary Tab ─────────────────────────────────────────────────────
const EMPTY_MED = () => ({ name: '', dose: '', route: 'oral', frequency: '', duration: '' })

function DischargeSummaryTab({ admissionId }) {
  const [summaryId, setSummaryId] = useState(null)
  const [finalized, setFinalized] = useState(false)
  const [finalizedAt, setFinalizedAt] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [saveStatus, setSaveStatus] = useState('clean') // clean | dirty | saving | saved
  const [lastSavedTime, setLastSavedTime] = useState(null)
  const [err, setErr]             = useState('')
  const [saving, setSaving]       = useState(false)
  const saveTimerRef = useRef(null)

  const [form, setForm] = useState({
    admission_diagnosis: '',
    final_diagnosis: '',
    procedures_done: '',
    hospital_course: '',
    condition_at_discharge: 'stable',
    discharge_instructions: '',
    diet_advice: '',
    activity_restrictions: '',
    followup_date: '',
    followup_with: '',
  })
  const [meds, setMeds] = useState([EMPTY_MED()])

  const setF = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    markDirty()
  }

  const markDirty = () => {
    setSaveStatus('dirty')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => autoSave(), 30000)
  }

  useEffect(() => {
    api.get(`/inpatient/admissions/${admissionId}/discharge-summary`)
      .then(r => {
        if (r && (r.id || r.admission_diagnosis != null)) {
          setSummaryId(r.id || null)
          setFinalized(!!r.is_finalized)
          setFinalizedAt(r.finalized_at || null)
          setForm({
            admission_diagnosis:     r.admission_diagnosis || '',
            final_diagnosis:         r.final_diagnosis || '',
            procedures_done:         r.procedures_done || '',
            hospital_course:         r.hospital_course || '',
            condition_at_discharge:  r.condition_at_discharge || 'stable',
            discharge_instructions:  r.discharge_instructions || '',
            diet_advice:             r.diet_advice || '',
            activity_restrictions:   r.activity_restrictions || '',
            followup_date:           r.followup_date || '',
            followup_with:           r.followup_with || '',
          })
          if (r.discharge_medications) {
            try {
              const parsed = typeof r.discharge_medications === 'string' ? JSON.parse(r.discharge_medications) : r.discharge_medications
              if (Array.isArray(parsed) && parsed.length) setMeds(parsed)
            } catch (_) {}
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [admissionId])

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])

  const buildPayload = () => ({ ...form, discharge_medications: JSON.stringify(meds) })

  const autoSave = async () => {
    setSaveStatus('saving')
    try {
      const payload = buildPayload()
      if (summaryId) {
        await api.patch(`/inpatient/admissions/${admissionId}/discharge-summary`, payload)
      } else {
        const r = await api.post(`/inpatient/admissions/${admissionId}/discharge-summary`, payload)
        setSummaryId(r?.id || null)
      }
      setLastSavedTime(new Date())
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('clean'), 5000)
    } catch (_) {
      setSaveStatus('dirty')
    }
  }

  const saveDraft = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    await autoSave()
  }

  const finalize = async () => {
    if (!window.confirm('Finalize and send to Discharge Queue? This will lock the summary.')) return
    setSaving(true)
    try {
      await saveDraft()
      await api.post(`/inpatient/admissions/${admissionId}/discharge-summary/finalize`, {})
      setFinalized(true)
      setFinalizedAt(new Date().toISOString())
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to finalize')
    } finally { setSaving(false) }
  }

  const addMed = () => setMeds(m => [...m, EMPTY_MED()])
  const rmMed  = i => setMeds(m => m.filter((_, j) => j !== i))
  const setMed = (i, k, v) => { setMeds(m => m.map((item, j) => j === i ? { ...item, [k]: v } : item)); markDirty() }

  const SaveIndicator = () => {
    if (saveStatus === 'dirty')  return <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />Unsaved changes</span>
    if (saveStatus === 'saving') return <span className="inline-flex items-center gap-1.5 text-xs text-blue-600"><RefreshCw size={12} className="animate-spin" />Saving…</span>
    if (saveStatus === 'saved')  return <span className="inline-flex items-center gap-1.5 text-xs text-green-600"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Saved {lastSavedTime ? lastSavedTime.toLocaleTimeString() : ''}</span>
    return null
  }

  if (loading) return <div className="flex justify-center py-10"><RefreshCw size={22} className="animate-spin text-gray-400" /></div>

  return (
    <div>
      <style>{`@media print { .print-hidden { display: none !important; } }`}</style>

      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-800">Discharge Summary</h3>
          {finalized && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
              <CheckCircle2 size={12} />Finalized {finalizedAt ? fmtDateTime(finalizedAt) : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator />
          {finalized ? (
            <button onClick={() => window.print()} className="print-hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
              <Printer size={14} />Print Summary
            </button>
          ) : (
            <>
              <button onClick={saveDraft} disabled={saving} className="print-hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
                Save Draft
              </button>
              <button onClick={finalize} disabled={saving} className="print-hidden inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700">
                Finalize &amp; Send to Discharge Queue
              </button>
            </>
          )}
        </div>
      </div>

      {err && <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 print-hidden"><AlertCircle size={15} />{err}</div>}

      <div className="space-y-6">
        {/* Section 1: Diagnoses */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Diagnoses</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Admission Diagnosis</label>
              <SmartTextarea value={form.admission_diagnosis} onChange={e => setF('admission_diagnosis', e.target.value)} placeholder="Primary diagnosis at admission…" rows={2} disabled={finalized} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Final Diagnosis</label>
              <SmartTextarea value={form.final_diagnosis} onChange={e => setF('final_diagnosis', e.target.value)} placeholder="Final confirmed diagnosis…" rows={2} disabled={finalized} />
            </div>
          </div>
        </div>

        {/* Section 2: Hospital Course */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Hospital Course</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Procedures Done</label>
              <SmartTextarea value={form.procedures_done} onChange={e => setF('procedures_done', e.target.value)} placeholder="List procedures performed…" rows={2} disabled={finalized} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hospital Course Summary</label>
              <SmartTextarea value={form.hospital_course} onChange={e => setF('hospital_course', e.target.value)} placeholder="Summary of clinical course during admission…" rows={6} disabled={finalized} />
            </div>
          </div>
        </div>

        {/* Section 3: Condition at Discharge */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Condition at Discharge</h4>
          <div className="flex flex-wrap gap-4">
            {['stable', 'improved', 'deteriorated', 'deceased'].map(c => (
              <label key={c} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="condition_at_discharge" value={c} checked={form.condition_at_discharge === c}
                  onChange={e => setF('condition_at_discharge', e.target.value)} disabled={finalized}
                  className="text-blue-600 focus:ring-blue-500" />
                <span className="text-sm capitalize text-gray-700">{c}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Section 4: Discharge Plan */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Discharge Plan</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Discharge Instructions</label>
              <SmartTextarea value={form.discharge_instructions} onChange={e => setF('discharge_instructions', e.target.value)} placeholder="Instructions for patient/family…" rows={3} disabled={finalized} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Diet Advice</label>
              <SmartTextarea value={form.diet_advice} onChange={e => setF('diet_advice', e.target.value)} placeholder="Dietary recommendations…" rows={2} disabled={finalized} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Activity Restrictions</label>
              <SmartTextarea value={form.activity_restrictions} onChange={e => setF('activity_restrictions', e.target.value)} placeholder="Activity restrictions…" rows={2} disabled={finalized} />
            </div>
          </div>
        </div>

        {/* Section 5: Follow-up */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Follow-up</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Follow-up Date</label>
              <input type="date" disabled={finalized}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                value={form.followup_date} onChange={e => setF('followup_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Follow-up With</label>
              <input type="text" disabled={finalized}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                value={form.followup_with} onChange={e => setF('followup_with', e.target.value)}
                placeholder="Dr. name / specialty…" />
            </div>
          </div>
        </div>

        {/* Section 6: Discharge Medications */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Discharge Medications</h4>
          <div className="space-y-2 mb-3">
            {meds.map((med, i) => (
              <div key={i} className="grid grid-cols-6 gap-2 items-center bg-gray-50 rounded-lg p-2">
                <div className="col-span-2">
                  <input type="text" disabled={finalized} placeholder="Medicine name"
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                    value={med.name} onChange={e => setMed(i, 'name', e.target.value)} />
                </div>
                <div>
                  <input type="text" disabled={finalized} placeholder="Dose"
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                    value={med.dose} onChange={e => setMed(i, 'dose', e.target.value)} />
                </div>
                <div>
                  <select disabled={finalized} value={med.route} onChange={e => setMed(i, 'route', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100">
                    <option value="oral">Oral</option>
                    <option value="iv">IV</option>
                    <option value="im">IM</option>
                    <option value="sc">SC</option>
                  </select>
                </div>
                <div>
                  <input type="text" disabled={finalized} placeholder="Frequency"
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                    value={med.frequency} onChange={e => setMed(i, 'frequency', e.target.value)} />
                </div>
                <div className="flex gap-1">
                  <input type="text" disabled={finalized} placeholder="Duration"
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                    value={med.duration} onChange={e => setMed(i, 'duration', e.target.value)} />
                  {!finalized && (
                    <button type="button" onClick={() => rmMed(i)} className="p-1.5 text-red-500 hover:text-red-700 flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!finalized && (
            <button type="button" onClick={addMed} className="print-hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
              <Plus size={14} />Add Medication
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── PrimaryDrModal ────────────────────────────────────────────────────────────
function PrimaryDrModal({ admissionId, currentDoctorName, onClose, onAssigned }) {
  const [doctors, setDoctors]   = useState([])
  const [query, setQuery]       = useState('')
  const [selected, setSelected] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  useEffect(() => {
    api.get('/staff/?role=doctor')
      .then(r => setDoctors(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => {})
  }, [])

  const filtered = query.length > 0
    ? doctors.filter(d => (d.full_name || d.email || '').toLowerCase().includes(query.toLowerCase()))
    : doctors

  const assign = async () => {
    if (!selected) return
    setSaving(true); setErr('')
    try {
      await api.patch(`/inpatient/admissions/${admissionId}/primary-doctor`, { primary_doctor_id: selected.id })
      onAssigned(selected)
    } catch (ex) {
      // Fallback: try generic patch
      try {
        await api.patch(`/inpatient/admissions/${admissionId}`, { primary_doctor_id: selected.id })
        onAssigned(selected)
      } catch (ex2) {
        setErr(ex2?.response?.data?.detail || ex2.message || 'Failed to assign doctor')
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0F2557' }}>Assign Primary Doctor</h2>
            {currentDoctorName && <p className="text-xs text-gray-400 mt-0.5">Current: {currentDoctorName}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><XIcon size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search doctor…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">No doctors found</p>
            ) : filtered.map(d => (
              <button key={d.id} type="button"
                onClick={() => setSelected(d)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selected?.id === d.id ? 'bg-blue-50 text-blue-800 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>
                {d.full_name || d.email}
                {d.specialization && <span className="text-xs text-gray-400 ml-2">{d.specialization}</span>}
              </button>
            ))}
          </div>
          {err && <p className="text-red-600 text-sm flex items-center gap-1"><AlertCircle size={14} />{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" disabled={!selected || saving} onClick={assign}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: '#0F2557' }}>
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <UserCheck size={14} />}
              {saving ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main AdmissionChart ───────────────────────────────────────────────────────
export default function AdmissionChart() {
  const { admissionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [admission, setAdmission] = useState(null)
  const [patient, setPatient]     = useState(null)
  const [vitals, setVitals]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [err, setErr]             = useState('')
  const [tab, setTab]             = useState('overview')
  const [showPrimaryDrModal, setShowPrimaryDrModal] = useState(false)
  const [primaryDoctorName, setPrimaryDoctorName]   = useState(null)

  const canWrite = user?.role === 'doctor' || user?.role === 'clinic_admin'

  useEffect(() => {
    const fetchAdmission = async () => {
      setLoading(true); setErr('')
      try {
        const r = await api.get(`/inpatient/admissions/${admissionId}`)
        setAdmission(r)
        setPrimaryDoctorName(r?.primary_doctor_name || null)
        const pat = r?.patient || null
        setPatient(pat)
        // If no patient in admission response, try fetching separately
        if (!pat && r?.patient_id) {
          try {
            const pr = await api.get(`/patients/${r.patient_id}`)
            setPatient(pr)
          } catch (_) {}
        }
        // Pre-fetch vitals for sidebar panels
        const vr = await api.get(`/inpatient/admissions/${admissionId}/vitals`).catch(() => null)
        if (vr) setVitals(Array.isArray(vr) ? vr : (vr?.items || vr?.data || []))
      } catch (ex) {
        setErr(ex?.response?.data?.detail || ex.message || 'Failed to load admission')
      } finally { setLoading(false) }
    }
    fetchAdmission()
  }, [admissionId])

  if (loading) return <PageLoader />
  if (err) return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        <AlertCircle size={16} className="shrink-0" />{err}
      </div>
    </div>
  )
  if (!admission) return <div className="text-gray-500 p-8">Admission not found</div>

  const adm = admission
  const pat = patient || adm.patient || {}

  const TABS = [
    { key: 'overview',  label: 'Overview' },
    { key: 'notes',     label: 'Progress Notes' },
    { key: 'vitals',    label: 'Vitals' },
    { key: 'rounds',    label: 'Ward Rounds' },
    { key: 'timeline',  label: 'Timeline' },
    { key: 'discharge', label: 'Discharge Summary' },
    { key: 'billing',   label: 'Billing', icon: Banknote },
  ]

  return (
    <div className="max-w-6xl">
      {/* Top header bar */}
      <div className="mb-5">
        <button onClick={() => navigate('/inpatient')} className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 mb-3 print:hidden">
          <ArrowLeft size={15} />Inpatient Desk
        </button>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: '#0F2557' }}>
                  {pat.full_name || adm.patient_name || '—'}
                </h1>
                <StatusBadge status={adm.status} />
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                <span className="font-mono">UHID: {pat.clinic_patient_id || adm.uhid || '—'}</span>
                <span>Admission: <span className="font-semibold text-gray-700">{adm.admission_number || `#${adm.id}`}</span></span>
                <span>Admitted: {fmtDate(adm.admission_date || adm.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">Primary Dr:</span>
                {(primaryDoctorName || adm?.primary_doctor_name) ? (
                  <span className="text-sm font-medium text-blue-700">{primaryDoctorName || adm.primary_doctor_name}</span>
                ) : (
                  <span className="text-xs text-gray-400 italic">Unassigned</span>
                )}
                {(user?.role === 'clinic_admin' || user?.role === 'doctor') && (
                  <button onClick={() => setShowPrimaryDrModal(true)}
                    className="text-xs text-blue-500 hover:text-blue-700 underline">
                    {(primaryDoctorName || adm?.primary_doctor_name) ? 'Change' : 'Assign'}
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-600">
              {(adm.department_name || adm.department?.name) && (
                <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg">
                  <BedDouble size={14} className="text-gray-400" />
                  {adm.department_name || adm.department?.name}
                  {adm.ward_name && <span className="text-gray-400">/ {adm.ward_name}</span>}
                  {adm.bed_number && <span className="text-gray-400">/ Bed {adm.bed_number}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 w-fit overflow-x-auto print:hidden">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.icon && <t.icon size={14} />}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm min-h-64">
        {tab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Admission details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Admission Details</h3>
              <dl className="space-y-2.5 text-sm">
                {[
                  ['Admission #', adm.admission_number || `#${adm.id}`],
                  ['Admission Type', adm.admission_type?.replace(/_/g, ' ')],
                  ['Department', adm.department_name || adm.department?.name],
                  ['Ward', adm.ward_name],
                  ['Bed', adm.bed_number ? `Bed ${adm.bed_number}` : null],
                  ['Admitting Doctor', adm.admitting_doctor_name || adm.admitting_doctor?.full_name],
                  ['Admission Date', fmtDate(adm.admission_date || adm.created_at)],
                  ['Primary Diagnosis', adm.primary_diagnosis],
                  ['Insurance', adm.insurance_provider || adm.insurance_info],
                ].map(([label, val]) => val ? (
                  <div key={label} className="flex gap-2">
                    <dt className="text-gray-400 w-36 shrink-0">{label}</dt>
                    <dd className="font-medium text-gray-800 capitalize">{val}</dd>
                  </div>
                ) : null)}
              </dl>
            </div>
            {/* Right: Patient info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Patient Information</h3>
              <dl className="space-y-2.5 text-sm">
                {[
                  ['Full Name', pat.full_name],
                  ['UHID', pat.clinic_patient_id || adm.uhid],
                  ['Date of Birth', pat.date_of_birth ? fmtDate(pat.date_of_birth) : null],
                  ['Gender', pat.gender],
                  ['Blood Group', pat.blood_group],
                  ['Phone', pat.phone],
                  ['Allergies', pat.allergies],
                  ['Address', pat.address],
                ].map(([label, val]) => val ? (
                  <div key={label} className="flex gap-2">
                    <dt className="text-gray-400 w-36 shrink-0">{label}</dt>
                    <dd className={`font-medium ${label === 'Allergies' ? 'text-orange-600' : label === 'Blood Group' ? 'text-red-600' : 'text-gray-800'}`}>{val}</dd>
                  </div>
                ) : null)}
              </dl>
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <ProgressNotesTab admissionId={admissionId} vitals={vitals} canWrite={canWrite} />
        )}

        {tab === 'vitals' && (
          <VitalsTab admissionId={admissionId} />
        )}

        {tab === 'rounds' && (
          <WardRoundsTab admissionId={admissionId} canWrite={canWrite} />
        )}

        {tab === 'timeline' && (
          <TimelineTab admissionId={admissionId} />
        )}

        {tab === 'discharge' && (
          <DischargeSummaryTab admissionId={admissionId} />
        )}

        {tab === 'billing' && (
          <InpatientBilling admissionId={admissionId} admission={adm} />
        )}
      </div>

      {showPrimaryDrModal && (
        <PrimaryDrModal
          admissionId={admissionId}
          currentDoctorName={primaryDoctorName || adm?.primary_doctor_name}
          onClose={() => setShowPrimaryDrModal(false)}
          onAssigned={(doctor) => {
            setPrimaryDoctorName(doctor.full_name || doctor.email)
            setAdmission(prev => ({ ...prev, primary_doctor_name: doctor.full_name || doctor.email }))
            setShowPrimaryDrModal(false)
          }}
        />
      )}
    </div>
  )
}
