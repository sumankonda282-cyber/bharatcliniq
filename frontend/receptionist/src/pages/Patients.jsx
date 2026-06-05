import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { cachedFetch, cacheInvalidate, TTL } from '../utils/cache'
import { Plus, Search, Loader2, Users, ChevronDown, ChevronUp, Edit2, Check, X, AlertCircle, CheckCircle } from 'lucide-react'

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
      {type === 'success' ? <CheckCircle size={16} className="text-green-600" /> : <AlertCircle size={16} className="text-red-600" />}
      {msg}
    </div>
  )
}

// ── Inline editable field (Tier 1) ────────────────────────────────────────────
function EditableField({ label, value, fieldKey, patientId, onSaved, onError }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.patch(`/patients/${patientId}/edit-tier1`, { [fieldKey]: draft })
      onSaved(fieldKey, draft)
      setEditing(false)
    } catch (e) {
      onError && onError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          className="input flex-1 py-1 text-sm"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        />
        <button onClick={save} disabled={saving} className="p-1 rounded-lg hover:bg-green-50 text-green-600">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </button>
        <button onClick={() => { setEditing(false); setDraft(value || '') }} className="p-1 rounded-lg hover:bg-red-50 text-red-500">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between group">
      <span className="text-sm text-gray-700">{value || <span className="text-gray-400 italic">—</span>}</span>
      <button
        onClick={() => { setDraft(value || ''); setEditing(true) }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-blue-50 text-blue-500 ml-2"
        title={`Edit ${label}`}
      >
        <Edit2 size={13} />
      </button>
    </div>
  )
}

// ── Correction request modal (Tier 3) ─────────────────────────────────────────
function CorrectionModal({ patient, field, currentValue, onClose, onSubmitted }) {
  const [newValue, setNewValue] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await api.patch(`/patients/${patient.id}/request-correction`, { field, new_value: newValue, reason })
      onSubmitted()
      onClose()
    } catch (ex) { setErr(ex.message || 'Failed to submit') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-1" style={{ color: '#0F2557' }}>Request Correction</h3>
        <p className="text-xs text-gray-500 mb-4">This request will be reviewed by a clinic admin before being applied.</p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Field</label>
            <input className="input bg-gray-50" value={field === 'full_name' ? 'Full Name' : 'Date of Birth'} readOnly />
          </div>
          <div>
            <label className="label">Current Value</label>
            <input className="input bg-gray-50" value={currentValue || '—'} readOnly />
          </div>
          <div>
            <label className="label">Corrected Value *</label>
            <input
              className="input"
              type={field === 'date_of_birth' ? 'date' : 'text'}
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              required
              placeholder={field === 'full_name' ? 'Enter correct name' : ''}
            />
          </div>
          <div>
            <label className="label">Reason *</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
              placeholder="Why is this correction needed?"
            />
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Submitting…' : 'Submit Request'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Patient detail / edit panel ───────────────────────────────────────────────
function PatientDetail({ patient: initialPatient, staffRole, onClose }) {
  const [patient, setPatient] = useState(initialPatient)
  const [toast, setToast] = useState(null)
  const [correctionModal, setCorrectionModal] = useState(null)
  const [corrections, setCorrections] = useState([])
  const [corrLoading, setCorrLoading] = useState(false)
  const [corrErr, setCorrErr] = useState('')

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const onFieldSaved = (fieldKey, val) => {
    setPatient(p => ({ ...p, [fieldKey]: val }))
    showToast('Saved')
  }

  useEffect(() => {
    if (staffRole === 'clinic_admin') {
      setCorrLoading(true)
      api.get(`/patients/${patient.id}/correction-requests`)
        .then(r => setCorrections((r && r.correction_requests) ? r.correction_requests : []))
        .catch(() => setCorrErr('Could not load correction requests'))
        .finally(() => setCorrLoading(false))
    }
  }, [patient.id, staffRole])

  const handleCorrectionAction = async (reqId, action) => {
    try {
      await api.patch(`/patients/${patient.id}/approve-correction/${reqId}?action=${action}`)
      showToast(action === 'approve' ? 'Correction approved and applied' : 'Correction rejected')
      setCorrections(c => c.filter(r => r.request_id !== reqId))
    } catch (e) {
      showToast(e.message || 'Action failed', 'error')
    }
  }

  const tier1Rows = [
    { label: 'Address', key: 'address' },
    { label: 'City', key: 'city' },
    { label: 'State', key: 'state' },
    { label: 'Pincode', key: 'pincode' },
    { label: 'Email', key: 'email' },
    { label: 'Blood Group', key: 'blood_group' },
    { label: 'Allergies', key: 'allergies' },
    { label: 'Emergency Contact Name', key: 'emergency_contact_name' },
    { label: 'Emergency Contact Phone', key: 'emergency_contact_phone' },
    { label: 'Guardian Name', key: 'guardian_name' },
    { label: 'Guardian Mobile', key: 'guardian_mobile' },
  ]

  const pendingCorrections = corrections.filter(r => r.status === 'pending')

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-start justify-end overflow-y-auto">
      <div className="bg-white shadow-2xl w-full max-w-lg min-h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0F2557' }}>{patient.full_name}</h2>
            <p className="text-xs text-gray-400 font-mono">{patient.bh_id || patient.uhid || '—'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Identity fields — Tier 3 (correction request only) */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Identity Fields</h3>
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              {[
                { label: 'Full Name', key: 'full_name', value: patient.full_name },
                { label: 'Date of Birth', key: 'date_of_birth', value: patient.date_of_birth },
              ].map(({ label, key, value }, idx) => (
                <div key={key} className={`flex items-center justify-between px-4 py-3 ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
                  <span className="text-xs text-gray-500 w-32 flex-shrink-0">{label}</span>
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    <span className="text-sm text-gray-800">{value || '—'}</span>
                    <button
                      onClick={() => setCorrectionModal({ field: key, currentValue: value })}
                      className="text-xs px-2 py-0.5 rounded border border-orange-300 text-orange-600 hover:bg-orange-50 transition-colors whitespace-nowrap"
                    >
                      Request Correction
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Editable fields — Tier 1 */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Edit Details</h3>
            <p className="text-xs text-gray-400 mb-3">Hover any field and click the edit icon to update immediately.</p>
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              {tier1Rows.map(({ label, key }, idx) => (
                <div key={key} className={`flex items-start px-4 py-3 gap-3 ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
                  <span className="text-xs text-gray-500 w-36 flex-shrink-0 pt-0.5">{label}</span>
                  <div className="flex-1 min-w-0">
                    <EditableField
                      label={label}
                      value={patient[key]}
                      fieldKey={key}
                      patientId={patient.id}
                      onSaved={onFieldSaved}
                      onError={msg => showToast(msg, 'error')}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Pending corrections — clinic admin only */}
          {staffRole === 'clinic_admin' && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                Pending Corrections
                {pendingCorrections.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">{pendingCorrections.length}</span>
                )}
              </h3>
              {corrLoading && <p className="text-sm text-gray-400">Loading…</p>}
              {corrErr && <p className="text-sm text-red-500">{corrErr}</p>}
              {!corrLoading && pendingCorrections.length === 0 && (
                <p className="text-sm text-gray-400 italic">No pending correction requests</p>
              )}
              {pendingCorrections.map(req => (
                <div key={req.request_id} className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 mb-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 text-sm">
                    <span className="text-xs text-gray-500">Field</span>
                    <span className="font-medium capitalize">{(req.field || '').replace(/_/g, ' ')}</span>
                    <span className="text-xs text-gray-500">Current Value</span>
                    <span className="text-gray-700">{req.old_value || '—'}</span>
                    <span className="text-xs text-gray-500">Requested Value</span>
                    <span className="text-orange-700 font-semibold">{req.new_value}</span>
                    <span className="text-xs text-gray-500">Reason</span>
                    <span className="text-gray-700">{req.reason}</span>
                    <span className="text-xs text-gray-500">Requested By</span>
                    <span>{req.requested_by}</span>
                    <span className="text-xs text-gray-500">Date</span>
                    <span>{req.created_at ? req.created_at.slice(0, 10) : '—'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCorrectionAction(req.request_id, 'approve')}
                      className="btn-primary text-xs py-1.5 px-3"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleCorrectionAction(req.request_id, 'reject')}
                      className="btn-secondary text-xs py-1.5 px-3 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>

      {correctionModal && (
        <CorrectionModal
          patient={patient}
          field={correctionModal.field}
          currentValue={correctionModal.currentValue}
          onClose={() => setCorrectionModal(null)}
          onSubmitted={() => showToast('Correction request submitted — pending clinic admin approval')}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Patients() {
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [form, setForm] = useState({
    full_name: '', mobile: '', date_of_birth: '', gender: '', blood_group: '',
    guardian_name: '', guardian_mobile: '',
  })
  const [showGuardian, setShowGuardian] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [toast, setToast] = useState(null)

  // Best-effort: read role from JWT stored in sessionStorage
  const staffRole = (() => {
    try {
      const token = sessionStorage.getItem('token') || ''
      if (!token) return ''
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.role || ''
    } catch { return '' }
  })()

  const load = useCallback(() => {
    setLoading(true)
    if (!search) {
      cachedFetch(
        'recep_patients_list',
        () => api.get('/patients', { params: { limit: 50 } }),
        r => { setPatients(Array.isArray(r) ? r : []); setLoading(false) },
        TTL.SHORT
      ).catch(() => setLoading(false))
    } else {
      api.get('/patients', { params: { search, limit: 50 } })
        .then(r => setPatients(Array.isArray(r) ? r : []))
        .finally(() => setLoading(false))
    }
  }, [search])

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [load])

  const save = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      const payload = { ...form }
      if (!payload.date_of_birth) delete payload.date_of_birth
      if (!showGuardian || !payload.guardian_name) {
        delete payload.guardian_name
        delete payload.guardian_mobile
      }
      await api.post('/patients', payload)
      await cacheInvalidate('recep_patients_list')
      setShowNew(false)
      setForm({ full_name: '', mobile: '', date_of_birth: '', gender: '', blood_group: '', guardian_name: '', guardian_mobile: '' })
      setShowGuardian(false)
      load()
      setToast({ msg: 'Patient registered successfully' })
    } catch (ex) { setErr(ex.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Patients</h1>
        <button onClick={() => setShowNew(true)} className="btn-primary"><Plus size={16} />Register Patient</button>
      </div>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Search by name or mobile…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Registration modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#0F2557' }}>Register New Patient</h3>
            <form onSubmit={save} className="space-y-3">
              <div><label className="label">Full Name *</label><input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required /></div>
              <div><label className="label">Mobile *</label><input className="input" type="tel" maxLength={10} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Date of Birth</label><input type="date" className="input" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} /></div>
                <div><label className="label">Gender</label><select className="input" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
              </div>
              <div><label className="label">Blood Group</label><select className="input" value={form.blood_group} onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}><option value="">Unknown</option>{'A+ A- B+ B- O+ O- AB+ AB-'.split(' ').map(g => <option key={g} value={g}>{g}</option>)}</select></div>

              {/* Guardian collapsible section */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowGuardian(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span>Add guardian / caretaker (optional)</span>
                  {showGuardian ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>
                {showGuardian && (
                  <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-100 bg-gray-50/50">
                    <p className="text-xs text-gray-500">Fill if registering a child or dependent patient</p>
                    <div>
                      <label className="label">Guardian Name</label>
                      <input className="input" value={form.guardian_name} onChange={e => setForm(f => ({ ...f, guardian_name: e.target.value }))} placeholder="Guardian's full name" />
                    </div>
                    <div>
                      <label className="label">Guardian Mobile</label>
                      <input className="input" type="tel" maxLength={10} value={form.guardian_mobile} onChange={e => setForm(f => ({ ...f, guardian_mobile: e.target.value }))} placeholder="Guardian's mobile number" />
                    </div>
                  </div>
                )}
              </div>

              {err && <p className="text-red-600 text-sm">{err}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowNew(false); setShowGuardian(false) }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving…' : 'Register'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
         : patients.length === 0 ? <div className="p-10 text-center text-gray-400"><Users size={32} className="mx-auto mb-2 opacity-30" /><p>No patients found</p></div>
         : <div className="table-wrapper"><table className="table"><thead><tr><th className="th">Clinic ID</th><th className="th">Name</th><th className="th">Mobile</th><th className="th">Age / Gender</th><th className="th">Blood Group</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{patients.map(p => <tr key={p.id} className="tr-hover">
              <td className="td font-mono text-xs text-gray-500">{p.clinic_patient_id || `#${p.id}`}</td>
              <td className="td font-medium">{p.full_name}</td>
              <td className="td">{p.mobile}</td>
              <td className="td">{p.date_of_birth ? Math.floor((new Date() - new Date(p.date_of_birth)) / 31557600000) + 'y' : '—'} {p.gender ? '· ' + p.gender : ''}</td>
              <td className="td">{p.blood_group || '—'}</td>
            </tr>)}</tbody></table></div>}
      </div>

      {selectedPatient && (
        <PatientDetail
          patient={selectedPatient}
          staffRole={staffRole}
          onClose={() => setSelectedPatient(null)}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type || 'success'} onClose={() => setToast(null)} />}
    </div>
  )
}
