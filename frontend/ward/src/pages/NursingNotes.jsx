import { useEffect, useState } from 'react'
import { ClipboardList, Plus, Loader2, X, AlertCircle, CheckCircle } from 'lucide-react'
import api from '../api/client'
import DictationTextarea from '../components/DictationTextarea'
import PatientList from '../components/PatientList'
import { usePin } from '../contexts/PinContext'
import SignatureBlock from '../components/SignatureBlock'

function getCurrentShift() {
  const h = new Date().getHours()
  if (h >= 6 && h < 14) return 'morning'
  if (h >= 14 && h < 22) return 'afternoon'
  return 'night'
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000 / 60
  if (diff < 60) return `${Math.round(diff)}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return new Date(dateStr).toLocaleDateString()
}

const NOTE_TYPE_COLORS = {
  general: 'badge-blue',
  shift_handoff: 'badge-yellow',
  incident: 'badge-red',
  procedure: 'badge-purple',
}

const EMPTY_FORM = { note_type: 'general', shift: getCurrentShift(), note: '', is_handoff: false }

export default function NursingNotes() {
  const { requestPin } = usePin()
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [notesError, setNotesError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [noteIdentity, setNoteIdentity] = useState(null)  // PIN-verified identity for current note session
  const [noteSigned, setNoteSigned] = useState(false)
  const [noteSignedAt, setNoteSignedAt] = useState('')

  const fetchNotes = (admId) => {
    setNotesLoading(true); setNotesError('')
    api.get(`/inpatient/admissions/${admId}/notes`)
      .then(data => setNotes(Array.isArray(data) ? data : (data.items || data.results || [])))
      .catch(err => setNotesError(err.message))
      .finally(() => setNotesLoading(false))
  }

  const handleSelect = (adm) => {
    setSelected(adm); setSubmitSuccess(false)
    fetchNotes(adm.id)
  }

  const openModal = async () => {
    // Require PIN before opening the note modal
    let identity
    try {
      identity = await requestPin('Add Nursing Note')
    } catch {
      return // User cancelled
    }
    setNoteIdentity(identity)
    setNoteSigned(false)
    setNoteSignedAt('')
    setForm({ ...EMPTY_FORM, shift: getCurrentShift() })
    setSubmitError('')
    setShowModal(true)
  }

  const handleSubmit = async (signed = false) => {
    setSubmitting(true); setSubmitError('')
    const now = new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
    try {
      await api.post(`/inpatient/admissions/${selected.id}/notes`, {
        note_type: form.is_handoff ? 'shift_handoff' : form.note_type,
        shift: form.shift,
        note: form.note,
        is_handoff: form.is_handoff,
        written_by: noteIdentity?.staff_id,
        signed,
        signed_at: signed ? now : null,
        signer_name: signed ? noteIdentity?.full_name : null,
      })
      setSubmitSuccess(true)
      if (signed) { setNoteSigned(true); setNoteSignedAt(now) }
      setShowModal(false)
      fetchNotes(selected.id)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleFormSubmit = async e => {
    e.preventDefault()
    await handleSubmit(false)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Nursing Notes</h1>
      </div>

      <div className="flex gap-4 h-[calc(100vh-160px)]">
        <PatientList selectedId={selected?.id} onSelect={handleSelect} />

        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="card h-full flex items-center justify-center">
              <div className="empty-state">
                <ClipboardList size={40} className="empty-state-icon" />
                <span className="empty-state-text">Select a patient to view notes</span>
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
                      <CheckCircle size={14} /> Note added
                    </span>
                  )}
                  <button onClick={openModal} className="btn-primary">
                    <Plus size={15} />Add Note
                  </button>
                </div>
              </div>

              {notesLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
              ) : notesError ? (
                <div className="text-sm text-red-600 p-3">{notesError}</div>
              ) : notes.length === 0 ? (
                <div className="empty-state py-8">
                  <ClipboardList size={28} className="empty-state-icon" />
                  <span className="empty-state-text">No nursing notes yet</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((n, i) => (
                    <div
                      key={n.id || i}
                      className={`rounded-xl border p-4 ${
                        (n.note_type === 'shift_handoff' || n.is_handoff)
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-100 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={NOTE_TYPE_COLORS[n.note_type] || 'badge-gray'}>
                          {n.note_type || 'general'}
                        </span>
                        {n.shift && (
                          <span className="badge-gray">{n.shift} shift</span>
                        )}
                        {/* Signed / unsigned badge */}
                        {n.signed ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle size={11} />
                            SIGNED · {n.signer_name || n.written_by || ''} · {n.signed_at ? new Date(n.signed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            UNSIGNED DRAFT
                          </span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">
                          {n.written_by || n.nurse_name || ''}
                          {' · '}
                          {timeAgo(n.written_at || n.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.note || n.content || '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Note Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-800 text-lg">Add Nursing Note</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            {noteIdentity && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4 text-sm text-emerald-800">
                <CheckCircle size={14} className="text-emerald-600 flex-shrink-0" />
                <span>Documenting as: <strong>{noteIdentity.full_name}</strong>
                  {noteIdentity.credentials ? ` · ${noteIdentity.credentials}` : ` · ${noteIdentity.role?.replace(/_/g, ' ')}`}
                </span>
              </div>
            )}
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Note Type</label>
                  <select className="input" value={form.note_type} onChange={e => setForm(f => ({ ...f, note_type: e.target.value }))}>
                    <option value="general">General</option>
                    <option value="shift_handoff">Shift Handoff</option>
                    <option value="incident">Incident</option>
                    <option value="procedure">Procedure</option>
                  </select>
                </div>
                <div>
                  <label className="label">Shift</label>
                  <select className="input" value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}>
                    <option value="morning">Morning (6am–2pm)</option>
                    <option value="afternoon">Afternoon (2pm–10pm)</option>
                    <option value="night">Night (10pm–6am)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Note</label>
                <DictationTextarea
                  rows={5}
                  placeholder="Write your nursing note here..."
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                />
                <input type="hidden" required value={form.note} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-emerald-600 rounded"
                  checked={form.is_handoff} onChange={e => setForm(f => ({ ...f, is_handoff: e.target.checked }))} />
                <span className="text-sm text-gray-700 font-medium">Mark as Shift Handoff note</span>
              </label>

              {submitError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle size={15} />{submitError}
                </div>
              )}

              <SignatureBlock
                verifiedIdentity={noteIdentity}
                onSign={() => handleSubmit(true)}
                signed={noteSigned}
                signedAt={noteSignedAt}
              />

              {!noteSigned && (
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={submitting} className="btn-primary flex-1">
                    {submitting ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Save as Draft'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
