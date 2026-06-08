import { useState, useCallback } from 'react'
import { Stethoscope, Plus, Loader2, X, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import api from '../api/client'
import PatientList from '../components/PatientList'
import { useAuth } from '../contexts/AuthContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const todayISO = () => new Date().toISOString().slice(0, 10)
const nowTime  = () => {
  const n = new Date()
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`
}

const PLAN_FIELDS = [
  { key: 'plan_medications',   label: 'Medications',          placeholder: 'Continue current medications / changes...' },
  { key: 'plan_investigations',label: 'Investigations',       placeholder: 'Blood tests, imaging, ECG...' },
  { key: 'plan_activity',      label: 'Activity / Mobility',  placeholder: 'Bed rest / Ambulate with support...' },
  { key: 'plan_diet',          label: 'Diet',                 placeholder: 'Low salt / High fluid / NPO...' },
  { key: 'plan_review',        label: 'Review / Follow-up',   placeholder: 'Review in 24 hrs / Reassess if worsens...' },
]

const EMPTY_FORM = {
  round_date: todayISO(),
  round_time: nowTime(),
  no_change: false,
  condition: 'Stable',
  // vitals (auto-pulled but editable)
  bp_systolic: '', bp_diastolic: '', temperature: '', pulse: '', spo2: '', rr: '', pain_score: '',
  // SOAP
  subjective: '',
  objective: '',
  assessment: '',
  // Plan breakdown
  plan_medications: '',
  plan_investigations: '',
  plan_activity: '',
  plan_diet: '',
  plan_review: '',
}

// ── Round Card ────────────────────────────────────────────────────────────────

function RoundCard({ round }) {
  const [expanded, setExpanded] = useState(true)
  const isNoChange = round.no_change || (!round.subjective && !round.objective)

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: '#065F46' }}>
            <Stethoscope size={14} />
          </div>
          <div className="text-left">
            <div className="font-semibold text-gray-800 text-sm">
              {round.doctor_name || round.written_by || 'Doctor'}
              {isNoChange && (
                <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-normal">No Change</span>
              )}
            </div>
            <div className="text-xs text-gray-400">{fmtDateTime(round.round_date || round.created_at)}</div>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-gray-100">
          {/* Vitals strip */}
          {(round.bp_systolic || round.temperature || round.pulse || round.spo2) && (
            <div className="mt-3 flex flex-wrap gap-3 p-3 rounded-xl bg-gray-50 text-xs">
              {round.bp_systolic  && <span><b className="text-gray-500">BP</b> {round.bp_systolic}/{round.bp_diastolic} mmHg</span>}
              {round.temperature  && <span><b className="text-gray-500">Temp</b> {round.temperature}°C</span>}
              {round.pulse        && <span><b className="text-gray-500">Pulse</b> {round.pulse} bpm</span>}
              {round.spo2         && <span><b className="text-gray-500">SpO₂</b> {round.spo2}%</span>}
              {round.rr           && <span><b className="text-gray-500">RR</b> {round.rr}/min</span>}
              {round.pain_score != null && round.pain_score !== '' && (
                <span><b className="text-gray-500">Pain</b> {round.pain_score}/10</span>
              )}
            </div>
          )}

          {isNoChange ? (
            <div className="mt-3 p-3 rounded-xl bg-blue-50 text-sm text-blue-800">
              <b>Plan Continue</b> — Patient reviewed. No change in clinical condition or management plan.
              {round.condition && <span className="ml-2 text-blue-600">Condition: {round.condition}</span>}
              {round.subjective && <div className="mt-1 text-blue-700">{round.subjective}</div>}
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ['S — Subjective', round.subjective],
                ['O — Objective / Examination', round.objective],
                ['A — Assessment / Diagnosis', round.assessment],
              ].map(([label, val]) => val ? (
                <div key={label} className={label.startsWith('O') ? 'md:col-span-2' : ''}>
                  <div className="text-xs font-bold text-emerald-700 mb-1">{label}</div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{val}</p>
                </div>
              ) : null)}

              {/* Plan breakdown */}
              {PLAN_FIELDS.some(pf => round[pf.key]) && (
                <div className="md:col-span-2">
                  <div className="text-xs font-bold text-emerald-700 mb-2">P — Plan</div>
                  <div className="space-y-1.5">
                    {PLAN_FIELDS.map(pf => round[pf.key] ? (
                      <div key={pf.key} className="flex gap-2 text-sm">
                        <span className="text-gray-400 text-xs font-semibold min-w-[100px] pt-0.5">{pf.label}</span>
                        <span className="text-gray-700 whitespace-pre-wrap flex-1">{round[pf.key]}</span>
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}

              {/* Fallback plain plan */}
              {!PLAN_FIELDS.some(pf => round[pf.key]) && round.plan && (
                <div className="md:col-span-2">
                  <div className="text-xs font-bold text-emerald-700 mb-1">P — Plan</div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{round.plan}</p>
                </div>
              )}
            </div>
          )}

          {/* Signature */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
            <CheckCircle size={14} className="text-emerald-600" />
            <span className="text-xs text-gray-500">
              Signed by <b>{round.doctor_name || round.written_by || 'Doctor'}</b> · {fmtDateTime(round.created_at || round.round_date)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Ward Round Form ───────────────────────────────────────────────────────────

function RoundForm({ admissionId, lastVitals, onClose, onSaved }) {
  const { user } = useAuth()
  const [form, setForm]     = useState({
    ...EMPTY_FORM,
    // Pre-fill vitals from last recorded
    bp_systolic:  lastVitals?.bp_systolic  || '',
    bp_diastolic: lastVitals?.bp_diastolic || '',
    temperature:  lastVitals?.temperature  || '',
    pulse:        lastVitals?.pulse        || '',
    spo2:         lastVitals?.spo2         || '',
    rr:           lastVitals?.respiration_rate || '',
    pain_score:   lastVitals?.pain_score   ?? '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const set = k => v => setForm(f => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setSubmitting(true); setSubmitError('')
    try {
      const payload = {
        round_date: `${form.round_date}T${form.round_time}:00`,
        no_change: form.no_change,
        condition: form.condition,
        bp_systolic:  form.bp_systolic  ? Number(form.bp_systolic)  : undefined,
        bp_diastolic: form.bp_diastolic ? Number(form.bp_diastolic) : undefined,
        temperature:  form.temperature  ? Number(form.temperature)  : undefined,
        pulse:        form.pulse        ? Number(form.pulse)        : undefined,
        spo2:         form.spo2         ? Number(form.spo2)         : undefined,
        rr:           form.rr           ? Number(form.rr)           : undefined,
        pain_score:   form.pain_score   !== '' ? Number(form.pain_score) : undefined,
        subjective:   form.subjective   || undefined,
        objective:    form.objective    || undefined,
        assessment:   form.assessment   || undefined,
        plan: PLAN_FIELDS.map(pf => form[pf.key] ? `${pf.label}: ${form[pf.key]}` : '').filter(Boolean).join('\n') || undefined,
        ...Object.fromEntries(PLAN_FIELDS.map(pf => [pf.key, form[pf.key] || undefined])),
      }
      await api.post(`/inpatient/admissions/${admissionId}/rounds`, payload)
      onSaved()
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl z-10 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Ward Round</h3>
            <div className="text-xs text-gray-400 mt-0.5">{user?.full_name} · {fmtDate(form.round_date)}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Date</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.round_date} onChange={set('round_date')} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Time</label>
              <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.round_time} onChange={set('round_time')} />
            </div>
          </div>

          {/* Quick No-Change toggle */}
          <div
            onClick={() => setForm(f => ({ ...f, no_change: !f.no_change }))}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer select-none transition-all ${
              form.no_change
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              form.no_change ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
            }`}>
              {form.no_change && <CheckCircle size={14} className="text-white" />}
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-700">Plan Continue — No Change</div>
              <div className="text-xs text-gray-400">Patient reviewed, no change in condition or management</div>
            </div>
          </div>

          {/* Condition (always shown) */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-2">Patient Condition</label>
            <div className="flex gap-2 flex-wrap">
              {['Improving', 'Stable', 'Unchanged', 'Deteriorating'].map(c => (
                <button key={c} type="button"
                  onClick={() => setForm(f => ({ ...f, condition: c }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    form.condition === c
                      ? c === 'Improving' ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                        : c === 'Stable' ? 'bg-blue-100 border-blue-400 text-blue-800'
                        : c === 'Unchanged' ? 'bg-gray-200 border-gray-400 text-gray-800'
                        : 'bg-red-100 border-red-400 text-red-800'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Vitals strip — always visible */}
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">
              Vitals
              {lastVitals && <span className="ml-2 text-xs text-gray-400 font-normal">(pre-filled from last recorded)</span>}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">BP Systolic</label>
                <input type="number" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="120" value={form.bp_systolic} onChange={set('bp_systolic')} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">BP Diastolic</label>
                <input type="number" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="80" value={form.bp_diastolic} onChange={set('bp_diastolic')} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Temp (°C)</label>
                <input type="number" step="0.1" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="37.2" value={form.temperature} onChange={set('temperature')} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Pulse (bpm)</label>
                <input type="number" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="82" value={form.pulse} onChange={set('pulse')} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">SpO₂ (%)</label>
                <input type="number" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="98" value={form.spo2} onChange={set('spo2')} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">RR (/min)</label>
                <input type="number" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="18" value={form.rr} onChange={set('rr')} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Pain (0–10)</label>
                <input type="number" min="0" max="10" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="3" value={form.pain_score} onChange={set('pain_score')} />
              </div>
            </div>
          </div>

          {/* SOAP sections — hidden if No Change */}
          {!form.no_change && (
            <>
              <div className="border-t border-gray-100 pt-4">
                <div className="text-xs font-bold text-emerald-700 mb-3 uppercase tracking-wider">SOAP Note</div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      <span className="text-emerald-700 font-bold">S</span> — Subjective
                      <span className="text-gray-400 font-normal ml-1">(patient's complaints)</span>
                    </label>
                    <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                      rows={3} placeholder="Patient reports mild headache, no chest pain. Sleep adequate..."
                      value={form.subjective} onChange={set('subjective')} />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      <span className="text-emerald-700 font-bold">O</span> — Objective
                      <span className="text-gray-400 font-normal ml-1">(examination findings)</span>
                    </label>
                    <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                      rows={3} placeholder="Alert, oriented. Chest clear. Abdomen soft, non-tender..."
                      value={form.objective} onChange={set('objective')} />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      <span className="text-emerald-700 font-bold">A</span> — Assessment
                      <span className="text-gray-400 font-normal ml-1">(diagnosis / clinical impression)</span>
                    </label>
                    <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                      rows={2} placeholder="Hypertensive crisis — improving. Renal function stable..."
                      value={form.assessment} onChange={set('assessment')} />
                  </div>

                  {/* Plan breakdown */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-2">
                      <span className="text-emerald-700 font-bold">P</span> — Plan
                    </label>
                    <div className="space-y-2">
                      {PLAN_FIELDS.map(pf => (
                        <div key={pf.key} className="flex gap-2 items-start">
                          <span className="text-xs font-semibold text-gray-400 pt-2 min-w-[110px]">{pf.label}</span>
                          <input
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder={pf.placeholder}
                            value={form[pf.key]} onChange={set(pf.key)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* No-change optional note */}
          {form.no_change && (
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Additional Note (optional)</label>
              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                rows={2} placeholder="e.g. Patient seems anxious, reassured..."
                value={form.subjective} onChange={set('subjective')} />
            </div>
          )}

          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle size={15} />{submitError}
            </div>
          )}

          {/* Signature line */}
          <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <CheckCircle size={14} className="text-emerald-600" />
            Signing as: <b className="text-gray-700">{user?.full_name}</b> · {new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>

          <div className="flex gap-2 pb-1">
            <button type="submit" disabled={submitting}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
              style={{ background: '#065F46' }}>
              {submitting
                ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" />Saving…</span>
                : form.no_change ? 'Sign — Plan Continue' : 'Sign & Save Round Note'
              }
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WardRounds() {
  const { user } = useAuth()
  const canWrite = ['doctor', 'clinic_admin', 'provider'].includes(user?.role)
  const [selected, setSelected]   = useState(null)
  const [rounds, setRounds]       = useState([])
  const [lastVitals, setLastVitals] = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [saved, setSaved]         = useState(false)

  const fetchRounds = useCallback((adm) => {
    setLoading(true); setError('')
    Promise.all([
      api.get(`/inpatient/admissions/${adm.id}/rounds`)
        .then(d => Array.isArray(d) ? d : (d.items || d.results || [])),
      api.get(`/inpatient/admissions/${adm.id}/vitals`)
        .then(d => {
          const items = Array.isArray(d) ? d : (d.items || d.results || [])
          return items.length > 0 ? items[0] : null
        }).catch(() => null),
    ])
      .then(([r, v]) => { setRounds(r); setLastVitals(v) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = (adm) => { setSelected(adm); setSaved(false); fetchRounds(adm) }

  const handleSaved = () => {
    setShowForm(false); setSaved(true)
    fetchRounds(selected)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Ward Rounds</h1>
      </div>

      <div className="flex gap-4 h-[calc(100vh-160px)]">
        <PatientList selectedId={selected?.id} onSelect={handleSelect} />

        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="card h-full flex items-center justify-center">
              <div className="empty-state">
                <Stethoscope size={40} className="empty-state-icon" />
                <span className="empty-state-text">Select a patient to view ward rounds</span>
              </div>
            </div>
          ) : (
            <div className="card p-5">
              {/* Patient header */}
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <h2 className="font-bold text-gray-800 text-lg">
                    {selected.patient?.full_name || selected.patient_name}
                  </h2>
                  <p className="text-sm text-gray-500">{selected.admission_number}</p>
                </div>
                <div className="flex items-center gap-2">
                  {saved && (
                    <span className="flex items-center gap-1 text-emerald-700 text-sm">
                      <CheckCircle size={14} />Round saved
                    </span>
                  )}
                  {canWrite && (
                    <button
                      onClick={() => { setShowForm(true); setSaved(false) }}
                      className="flex items-center gap-1.5 text-sm text-white px-4 py-2 rounded-xl transition-colors"
                      style={{ background: '#065F46' }}>
                      <Plus size={15} />New Ward Round
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-gray-300" />
                </div>
              ) : error ? (
                <div className="text-sm text-red-600 p-3">{error}</div>
              ) : rounds.length === 0 ? (
                <div className="empty-state py-12">
                  <Stethoscope size={32} className="empty-state-icon" />
                  <span className="empty-state-text">No round notes yet — start the first round above</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {rounds.map((r, i) => <RoundCard key={r.id || i} round={r} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showForm && selected && (
        <RoundForm
          admissionId={selected.id}
          lastVitals={lastVitals}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
