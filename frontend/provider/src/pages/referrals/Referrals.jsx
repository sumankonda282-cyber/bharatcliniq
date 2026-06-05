import { useState, useEffect, useCallback } from 'react'
import api from '../../api/client'
import { patientsApi, appointmentsApi } from '../../api'
import { cachedFetch, cacheInvalidate, TTL } from '../../utils/cache'
import { PageLoader } from '../../components/ui/Spinner'
import { Send, Inbox, Plus, ChevronDown, ChevronUp, CheckCircle, XCircle, CalendarPlus, X } from 'lucide-react'

// ── Badge helpers ─────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  draft: 'badge-gray',
  sent: 'badge-blue',
  accepted: 'badge-green',
  completed: 'badge-teal',
  cancelled: 'badge-red',
  pending: 'badge-yellow',
  rejected: 'badge-red',
}
const URGENCY_STYLE = { routine: 'badge-gray', urgent: 'badge-yellow', emergency: 'badge-red' }

// ── New Referral Modal ────────────────────────────────────────────────────────
function NewReferralModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    patient_id: '', reason: '', urgency: 'routine',
    clinical_notes: '', to_clinic_name: '',
    specialty: '', referred_doctor: '',
    current_medications: '', relevant_investigations: '',
  })
  const [ptSearch, setPtSearch] = useState('')
  const [patients, setPatients] = useState([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (ptSearch.length < 2) { setPatients([]); return }
    const t = setTimeout(() =>
      patientsApi.list({ search: ptSearch, limit: 10 })
        .then(r => setPatients(Array.isArray(r) ? r : []))
        .catch(() => {}),
      300
    )
    return () => clearTimeout(t)
  }, [ptSearch])

  const submit = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await api.post('/inpatient/referrals', form)
      onCreated()
    } catch (ex) { setErr(ex.message || 'Failed to create referral') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>New Referral</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {/* Patient search */}
          <div>
            <label className="label">Patient *</label>
            <input className="input" placeholder="Search patient by name or mobile…" value={ptSearch} onChange={e => setPtSearch(e.target.value)} />
            {patients.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                {patients.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => { setForm(f => ({ ...f, patient_id: p.id })); setPtSearch(p.full_name); setPatients([]) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0"
                  >{p.full_name} · {p.mobile}</button>
                ))}
              </div>
            )}
            {form.patient_id && !patients.length && (
              <p className="text-xs text-green-600 mt-1">Patient selected</p>
            )}
          </div>

          {/* Referred to */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Specialty</label><input className="input" placeholder="e.g. Cardiology" value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} /></div>
            <div><label className="label">Doctor Name</label><input className="input" placeholder="Dr. Name" value={form.referred_doctor} onChange={e => setForm(f => ({ ...f, referred_doctor: e.target.value }))} /></div>
          </div>
          <div><label className="label">Organisation / Hospital</label><input className="input" placeholder="e.g. Apollo Hospital, Delhi" value={form.to_clinic_name} onChange={e => setForm(f => ({ ...f, to_clinic_name: e.target.value }))} /></div>

          {/* Reason + Urgency */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Reason *</label><input className="input" placeholder="Specialist consultation" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required /></div>
            <div>
              <label className="label">Urgency</label>
              <select className="input" value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
          </div>

          {/* Clinical */}
          <div><label className="label">Clinical Summary</label><textarea className="input resize-none" rows={3} value={form.clinical_notes} onChange={e => setForm(f => ({ ...f, clinical_notes: e.target.value }))} placeholder="History, examination findings, diagnosis…" /></div>
          <div><label className="label">Current Medications</label><textarea className="input resize-none" rows={2} value={form.current_medications} onChange={e => setForm(f => ({ ...f, current_medications: e.target.value }))} placeholder="List current medications…" /></div>
          <div><label className="label">Relevant Investigations</label><textarea className="input resize-none" rows={2} value={form.relevant_investigations} onChange={e => setForm(f => ({ ...f, relevant_investigations: e.target.value }))} placeholder="Lab reports, imaging, other…" /></div>

          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving || !form.patient_id || !form.reason} className="btn-primary flex-1 justify-center">{saving ? 'Sending…' : 'Send Referral'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Create Appointment Modal (for accepted incoming referrals) ────────────────
function CreateApptModal({ referral, onClose, onCreated }) {
  const [form, setForm] = useState({ appointment_date: '', appointment_time: '', doctor_id: '', notes: '' })
  const [doctors, setDoctors] = useState([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/clinic/doctors').then(r => setDoctors(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  const submit = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await appointmentsApi.create({
        patient_id: referral.patient_id,
        doctor_id: form.doctor_id ? parseInt(form.doctor_id) : undefined,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        notes: `Referral: ${referral.reason}. ${form.notes}`.trim(),
        referral_id: referral.id,
      })
      onCreated()
    } catch (ex) { setErr(ex.message || 'Failed to book') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>Book Appointment</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{referral.patient_name} · {referral.reason}</p>
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Date *</label><input type="date" className="input" value={form.appointment_date} onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))} required /></div>
          <div><label className="label">Time *</label><input type="time" className="input" value={form.appointment_time} onChange={e => setForm(f => ({ ...f, appointment_time: e.target.value }))} required /></div>
          <div>
            <label className="label">Doctor</label>
            <select className="input" value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}>
              <option value="">Any available</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </div>
          <div><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes…" /></div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Booking…' : 'Book'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Referral Row (expandable) ─────────────────────────────────────────────────
function ReferralRow({ r, isIncoming, onAction }) {
  const [expanded, setExpanded] = useState(false)
  const [outcomeNotes, setOutcomeNotes] = useState(r.outcome_notes || '')
  const [savingOutcome, setSavingOutcome] = useState(false)
  const [apptModal, setApptModal] = useState(false)

  const saveOutcome = async () => {
    setSavingOutcome(true)
    try {
      await api.put(`/inpatient/referrals/${r.id}`, { outcome_notes: outcomeNotes })
    } catch (e) { alert(e.message || 'Save failed') }
    finally { setSavingOutcome(false) }
  }

  return (
    <>
      <tr className="tr-hover cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <td className="td font-mono text-xs">{r.referral_code || `REF-${r.id}`}</td>
        <td className="td font-medium">{r.patient_name || '—'}</td>
        <td className="td text-sm text-gray-500">{isIncoming ? (r.from_clinic_name || 'External') : (r.to_clinic_name || r.specialty || 'External')}</td>
        <td className="td text-xs text-gray-600 max-w-xs truncate">{r.reason}</td>
        <td className="td"><span className={`badge ${URGENCY_STYLE[r.urgency] || 'badge-gray'}`}>{r.urgency}</span></td>
        <td className="td"><span className={`badge ${STATUS_STYLE[r.status] || 'badge-gray'}`}>{r.status}</span></td>
        <td className="td text-xs text-gray-400">{r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—'}</td>
        <td className="td">
          <div className="flex items-center gap-1">
            {isIncoming && r.status === 'pending' && (
              <>
                <button onClick={e => { e.stopPropagation(); onAction(r.id, 'accept') }} className="p-1 rounded-lg hover:bg-green-50 text-green-600" title="Accept"><CheckCircle size={16} /></button>
                <button onClick={e => { e.stopPropagation(); onAction(r.id, 'reject') }} className="p-1 rounded-lg hover:bg-red-50 text-red-500" title="Reject"><XCircle size={16} /></button>
              </>
            )}
            {isIncoming && r.status === 'accepted' && (
              <button onClick={e => { e.stopPropagation(); setApptModal(true) }} className="flex items-center gap-1 text-xs text-blue-600 hover:underline px-1">
                <CalendarPlus size={14} />Book
              </button>
            )}
            {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="px-4 pb-4 pt-0 bg-gray-50/60">
            <div className="py-3 space-y-3 text-sm">
              {r.specialty && <p><span className="text-gray-400">Specialty:</span> <span className="font-medium">{r.specialty}</span></p>}
              {r.referred_doctor && <p><span className="text-gray-400">Referred to Doctor:</span> <span className="font-medium">{r.referred_doctor}</span></p>}
              {r.clinical_notes && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Clinical Summary</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{r.clinical_notes}</p>
                </div>
              )}
              {r.current_medications && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Medications</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{r.current_medications}</p>
                </div>
              )}
              {r.relevant_investigations && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Relevant Investigations</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{r.relevant_investigations}</p>
                </div>
              )}
              {/* Outcome notes — editable only if status=completed */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Outcome Notes</p>
                {r.status === 'completed' ? (
                  <div className="flex gap-2 items-start">
                    <textarea
                      className="input resize-none flex-1 text-sm"
                      rows={2}
                      value={outcomeNotes}
                      onChange={e => setOutcomeNotes(e.target.value)}
                      placeholder="Record outcome of this referral…"
                    />
                    <button onClick={saveOutcome} disabled={savingOutcome} className="btn-secondary text-xs py-1.5">
                      {savingOutcome ? '…' : 'Save'}
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">{r.outcome_notes || 'No outcome notes yet'}</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
      {apptModal && (
        <tr><td colSpan={8} className="p-0">
          <CreateApptModal
            referral={r}
            onClose={() => setApptModal(false)}
            onCreated={() => { setApptModal(false); onAction(r.id, 'refresh') }}
          />
        </td></tr>
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Referrals() {
  const [tab, setTab] = useState('outgoing')
  const [outgoing, setOutgoing] = useState([])
  const [incoming, setIncoming] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async (invalidate = false) => {
    setLoading(true)
    try {
      if (invalidate) {
        await cacheInvalidate('referrals_outgoing')
        await cacheInvalidate('referrals_incoming')
      }
      await Promise.all([
        cachedFetch('referrals_outgoing', () => api.get('/inpatient/referrals?direction=outgoing'), r => setOutgoing(Array.isArray(r) ? r : (r?.items || [])), TTL.SHORT),
        cachedFetch('referrals_incoming', () => api.get('/inpatient/referrals?direction=incoming'), r => setIncoming(Array.isArray(r) ? r : (r?.items || [])), TTL.SHORT),
      ])
    } catch {
      // Fall back to old referrals API
      try {
        const [s, recv] = await Promise.all([
          api.get('/referrals/sent'),
          api.get('/referrals/received'),
        ])
        setOutgoing(Array.isArray(s) ? s : [])
        setIncoming(Array.isArray(recv) ? recv : [])
      } catch (e) {
        setErr(e.message || 'Could not load referrals')
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAction = async (id, action) => {
    if (action === 'refresh') { load(true); return }
    try {
      if (action === 'accept') {
        await api.put(`/inpatient/referrals/${id}`, { status: 'accepted' })
      } else if (action === 'reject') {
        await api.put(`/inpatient/referrals/${id}`, { status: 'rejected' })
      }
      load(true)
    } catch (e) { alert(e.message || 'Action failed') }
  }

  const TableHead = () => (
    <thead><tr>
      <th className="th">Code</th>
      <th className="th">Patient</th>
      <th className="th">{tab === 'outgoing' ? 'Referred To' : 'From'}</th>
      <th className="th">Reason</th>
      <th className="th">Urgency</th>
      <th className="th">Status</th>
      <th className="th">Date</th>
      <th className="th"></th>
    </tr></thead>
  )

  const list = tab === 'outgoing' ? outgoing : incoming

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Referrals</h1>
        <button onClick={() => setShowNew(true)} className="btn-primary"><Plus size={16} />New Referral</button>
      </div>

      {err && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">{err}</div>}

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-5 w-fit">
        <button
          onClick={() => setTab('outgoing')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'outgoing' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Send size={13} />Outgoing ({outgoing.length})
        </button>
        <button
          onClick={() => setTab('incoming')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'incoming' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Inbox size={13} />Incoming ({incoming.length})
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <PageLoader /> : (
          <div className="table-wrapper">
            <table className="table">
              <TableHead />
              <tbody className="divide-y divide-gray-100">
                {list.length === 0 ? (
                  <tr><td colSpan={8} className="td text-center text-gray-400 py-10">No referrals</td></tr>
                ) : list.map(r => (
                  <ReferralRow
                    key={r.id}
                    r={r}
                    isIncoming={tab === 'incoming'}
                    onAction={handleAction}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && (
        <NewReferralModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(true) }}
        />
      )}
    </div>
  )
}
