import { useEffect, useState } from 'react'
import { Activity, Plus, Loader2, X, AlertCircle, CheckCircle } from 'lucide-react'
import api from '../api/client'
import PatientList from '../components/PatientList'

const NORMAL_RANGES = {
  temperature: { min: 36, max: 38.5 },
  pulse: { min: 60, max: 100 },
  bp_systolic: { min: 90, max: 140 },
  spo2: { min: 95, max: 100 },
}

function isAbnormal(key, val) {
  if (val == null) return false
  const r = NORMAL_RANGES[key]
  if (!r) return false
  return val < r.min || val > r.max
}

function VitalCell({ val, fieldKey, unit }) {
  const bad = isAbnormal(fieldKey, val)
  return (
    <td className={`td text-center text-xs font-medium ${bad ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
      {val != null ? `${val}${unit || ''}` : '—'}
    </td>
  )
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000 / 60
  if (diff < 60) return `${Math.round(diff)}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return new Date(dateStr).toLocaleDateString()
}

const EMPTY_FORM = {
  temperature: '',
  pulse: '',
  bp_systolic: '',
  bp_diastolic: '',
  spo2: '',
  respiration_rate: '',
  weight: '',
  pain_score: 0,
  notes: '',
}

export default function Vitals() {
  const [selected, setSelected] = useState(null)
  const [vitals, setVitals] = useState([])
  const [vitalsLoading, setVitalsLoading] = useState(false)
  const [vitalsError, setVitalsError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const fetchVitals = (admId) => {
    setVitalsLoading(true); setVitalsError('')
    api.get(`/inpatient/admissions/${admId}/vitals`)
      .then(data => setVitals(Array.isArray(data) ? data : (data.items || data.results || [])))
      .catch(err => setVitalsError(err.message))
      .finally(() => setVitalsLoading(false))
  }

  const handleSelect = (adm) => {
    setSelected(adm); setShowForm(false); setSubmitSuccess(false)
    fetchVitals(adm.id)
  }

  const handleSubmit = async e => {
    e.preventDefault(); setSubmitting(true); setSubmitError(''); setSubmitSuccess(false)
    const payload = {}
    Object.entries(form).forEach(([k, v]) => {
      if (v !== '' && v != null) payload[k] = k === 'notes' ? v : Number(v)
    })
    payload.notes = form.notes
    try {
      await api.post(`/inpatient/admissions/${selected.id}/vitals`, payload)
      setSubmitSuccess(true)
      setForm(EMPTY_FORM)
      setShowForm(false)
      fetchVitals(selected.id)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const recent = vitals.slice(0, 10)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Vitals Charting</h1>
      </div>

      <div className="flex gap-4 h-[calc(100vh-160px)]">
        <PatientList selectedId={selected?.id} onSelect={handleSelect} />

        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="card h-full flex items-center justify-center">
              <div className="empty-state">
                <Activity size={40} className="empty-state-icon" />
                <span className="empty-state-text">Select a patient to view vitals</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-gray-800">
                      {selected.patient?.full_name || selected.patient_name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selected.admission_number} · {selected.ward?.name || ''} / Bed {selected.bed?.bed_number || '—'}
                    </p>
                  </div>
                  <button onClick={() => { setShowForm(v => !v); setSubmitError(''); setSubmitSuccess(false) }} className="btn-primary">
                    <Plus size={15} />
                    Record Vitals
                  </button>
                </div>

                {submitSuccess && (
                  <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                    <CheckCircle size={15} /> Vitals recorded successfully.
                  </div>
                )}

                {showForm && (
                  <form onSubmit={handleSubmit} className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800">New Vitals Entry</h3>
                      <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <label className="label">Temperature (°C)</label>
                        <input className="input" type="number" step="0.1" min="30" max="45" placeholder="37.0"
                          value={form.temperature} onChange={e => setForm(f => ({ ...f, temperature: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Pulse (bpm)</label>
                        <input className="input" type="number" min="20" max="250" placeholder="72"
                          value={form.pulse} onChange={e => setForm(f => ({ ...f, pulse: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">BP Systolic (mmHg)</label>
                        <input className="input" type="number" min="50" max="250" placeholder="120"
                          value={form.bp_systolic} onChange={e => setForm(f => ({ ...f, bp_systolic: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">BP Diastolic (mmHg)</label>
                        <input className="input" type="number" min="30" max="180" placeholder="80"
                          value={form.bp_diastolic} onChange={e => setForm(f => ({ ...f, bp_diastolic: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">SpO2 (%)</label>
                        <input className="input" type="number" min="50" max="100" placeholder="98"
                          value={form.spo2} onChange={e => setForm(f => ({ ...f, spo2: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Respiration Rate (/min)</label>
                        <input className="input" type="number" min="5" max="60" placeholder="16"
                          value={form.respiration_rate} onChange={e => setForm(f => ({ ...f, respiration_rate: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Weight (kg)</label>
                        <input className="input" type="number" step="0.1" min="1" max="300" placeholder="70"
                          value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="label">Pain Score (0–10): {form.pain_score}</label>
                        <input className="w-full accent-emerald-600" type="range" min="0" max="10" step="1"
                          value={form.pain_score} onChange={e => setForm(f => ({ ...f, pain_score: e.target.value }))} />
                        <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0 No pain</span><span>10 Worst</span></div>
                      </div>
                      <div className="col-span-2 md:col-span-3">
                        <label className="label">Notes</label>
                        <textarea className="input" rows={2} placeholder="Any observations..."
                          value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                      </div>
                    </div>
                    {submitError && (
                      <div className="flex items-center gap-2 p-3 mt-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                        <AlertCircle size={15} />{submitError}
                      </div>
                    )}
                    <div className="flex gap-2 mt-4">
                      <button type="submit" disabled={submitting} className="btn-primary">
                        {submitting ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Save Vitals'}
                      </button>
                      <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                    </div>
                  </form>
                )}

                {vitalsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
                ) : vitalsError ? (
                  <div className="text-sm text-red-600 p-3">{vitalsError}</div>
                ) : recent.length === 0 ? (
                  <div className="empty-state py-8">
                    <Activity size={28} className="empty-state-icon" />
                    <span className="empty-state-text">No vitals recorded yet</span>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr>
                          <th className="th">Time</th>
                          <th className="th text-center">Temp (°C)</th>
                          <th className="th text-center">Pulse</th>
                          <th className="th text-center">BP</th>
                          <th className="th text-center">SpO2</th>
                          <th className="th text-center">RR</th>
                          <th className="th text-center">Pain</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-50">
                        {recent.map((v, i) => (
                          <tr key={v.id || i} className="tr-hover">
                            <td className="td text-xs text-gray-500">{timeAgo(v.recorded_at || v.created_at)}</td>
                            <VitalCell val={v.temperature} fieldKey="temperature" />
                            <VitalCell val={v.pulse} fieldKey="pulse" unit=" bpm" />
                            <td className={`td text-center text-xs font-medium ${isAbnormal('bp_systolic', v.bp_systolic) ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                              {v.bp_systolic != null ? `${v.bp_systolic}/${v.bp_diastolic ?? '?'}` : '—'}
                            </td>
                            <VitalCell val={v.spo2} fieldKey="spo2" unit="%" />
                            <td className="td text-center text-xs text-gray-700">{v.respiration_rate ?? '—'}</td>
                            <td className="td text-center text-xs text-gray-700">{v.pain_score ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
