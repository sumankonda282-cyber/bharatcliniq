import { useEffect, useState } from 'react'
import { Stethoscope, Plus, Loader2, X, AlertCircle, CheckCircle } from 'lucide-react'
import api from '../api/client'
import PatientList from '../components/PatientList'
import { useAuth } from '../contexts/AuthContext'

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY_FORM = { round_date: today(), subjective: '', objective: '', assessment: '', plan: '' }

export default function WardRounds() {
  const { user } = useAuth()
  const canWrite = ['doctor', 'clinic_admin'].includes(user?.role)
  const [selected, setSelected] = useState(null)
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const fetchRounds = (admId) => {
    setLoading(true); setError('')
    api.get(`/inpatient/admissions/${admId}/rounds`)
      .then(data => setRounds(Array.isArray(data) ? data : (data.items || data.results || [])))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  const handleSelect = (adm) => {
    setSelected(adm); setSubmitSuccess(false); fetchRounds(adm.id)
  }

  const handleSubmit = async e => {
    e.preventDefault(); setSubmitting(true); setSubmitError('')
    try {
      await api.post(`/inpatient/admissions/${selected.id}/rounds`, form)
      setSubmitSuccess(true); setShowModal(false); setForm(EMPTY_FORM)
      fetchRounds(selected.id)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
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
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-bold text-gray-800">
                    {selected.patient?.full_name || selected.patient_name}
                  </h2>
                  <p className="text-sm text-gray-500">{selected.admission_number}</p>
                </div>
                <div className="flex items-center gap-2">
                  {submitSuccess && (
                    <span className="flex items-center gap-1 text-green-700 text-sm">
                      <CheckCircle size={14} />Round note added
                    </span>
                  )}
                  {canWrite && (
                    <button onClick={() => { setShowModal(true); setForm(EMPTY_FORM); setSubmitError('') }} className="btn-primary">
                      <Plus size={15} />New Round Note
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
              ) : error ? (
                <div className="text-sm text-red-600 p-3">{error}</div>
              ) : rounds.length === 0 ? (
                <div className="empty-state py-8">
                  <Stethoscope size={28} className="empty-state-icon" />
                  <span className="empty-state-text">No round notes yet</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {rounds.map((r, i) => (
                    <div key={r.id || i} className="border border-gray-200 rounded-2xl p-4 bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-semibold text-gray-800 text-sm">
                          {r.doctor_name || r.written_by || 'Doctor'}
                        </div>
                        <div className="text-xs text-gray-400">{timeAgo(r.round_date || r.created_at)}</div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          ['S — Subjective', r.subjective],
                          ['O — Objective', r.objective],
                          ['A — Assessment', r.assessment],
                          ['P — Plan', r.plan],
                        ].map(([label, val]) => val ? (
                          <div key={label}>
                            <div className="text-xs font-semibold text-gray-500 mb-1">{label}</div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{val}</p>
                          </div>
                        ) : null)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Round Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-800 text-lg">New Round Note (SOAP)</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={form.round_date}
                  onChange={e => setForm(f => ({ ...f, round_date: e.target.value }))} required />
              </div>
              {[
                ['subjective', 'S — Subjective', "Patient's complaints, history, symptoms..."],
                ['objective', 'O — Objective', 'Physical examination findings, vitals, labs...'],
                ['assessment', 'A — Assessment', 'Diagnosis, clinical impression...'],
                ['plan', 'P — Plan', 'Management plan, medications, investigations...'],
              ].map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <textarea className="input" rows={3} placeholder={placeholder}
                    value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              {submitError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle size={15} />{submitError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Save Round Note'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
