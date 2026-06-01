import { useState, useEffect } from 'react'
import { referralsApi, patientsApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import { Send, Inbox, Plus } from 'lucide-react'

const STATUS_COLORS = { pending: 'badge-yellow', accepted: 'badge-blue', completed: 'badge-green', rejected: 'badge-red' }
const URGENCY_COLORS = { routine: 'badge-gray', urgent: 'badge-yellow', emergency: 'badge-red' }

export default function Referrals() {
  const [tab, setTab] = useState('sent')
  const [sent, setSent] = useState([])
  const [received, setReceived] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ patient_id: '', reason: '', urgency: 'routine', clinical_notes: '', to_clinic_name: '' })
  const [patients, setPatients] = useState([])
  const [ptSearch, setPtSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([referralsApi.getSent(), referralsApi.getReceived()])
      .then(([s, r]) => { setSent(Array.isArray(s) ? s : []); setReceived(Array.isArray(r) ? r : []) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (ptSearch.length < 2) return
    const t = setTimeout(() => patientsApi.list({ search: ptSearch, limit: 10 }).then(r => setPatients(Array.isArray(r) ? r : [])), 300)
    return () => clearTimeout(t)
  }, [ptSearch])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await referralsApi.create(form)
      setShowNew(false)
      load()
    } finally { setSaving(false) }
  }

  const handleAccept = async (id) => {
    await referralsApi.accept(id)
    load()
  }

  const ReferralRow = ({ r, showAccept }) => (
    <tr className="tr-hover">
      <td className="td font-mono text-xs">{r.referral_code || `REF-${r.id}`}</td>
      <td className="td font-medium">{r.patient_name || '—'}</td>
      <td className="td text-gray-500 text-sm">{showAccept ? (r.from_clinic_name || 'External') : (r.to_clinic_name || 'External')}</td>
      <td className="td text-xs text-gray-600">{r.reason}</td>
      <td className="td"><span className={URGENCY_COLORS[r.urgency] || 'badge-gray'}>{r.urgency}</span></td>
      <td className="td"><span className={STATUS_COLORS[r.status] || 'badge-gray'}>{r.status}</span></td>
      <td className="td text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
      <td className="td">
        {showAccept && r.status === 'pending' && (
          <button onClick={() => handleAccept(r.id)} className="text-xs text-green-600 hover:underline">Accept</button>
        )}
      </td>
    </tr>
  )

  const TableHead = () => (
    <thead><tr>
      <th className="th">Code</th><th className="th">Patient</th><th className="th">Clinic</th>
      <th className="th">Reason</th><th className="th">Urgency</th><th className="th">Status</th><th className="th">Date</th><th className="th"></th>
    </tr></thead>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Referrals</h1>
        <button onClick={() => setShowNew(true)} className="btn-primary"><Plus size={16} />New Referral</button>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4 w-fit">
        <button onClick={() => setTab('sent')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'sent' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          <Send size={13} />Sent ({sent.length})
        </button>
        <button onClick={() => setTab('received')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'received' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          <Inbox size={13} />Received ({received.length})
        </button>
      </div>

      <div className="card">
        {loading ? <PageLoader /> : (
          <div className="table-wrapper rounded-xl border-0">
            <table className="table">
              <TableHead />
              <tbody className="divide-y divide-gray-100">
                {(tab === 'sent' ? sent : received).length === 0 ? (
                  <tr><td colSpan={8} className="td text-center text-gray-400 py-8">No referrals</td></tr>
                ) : (tab === 'sent' ? sent : received).map(r => (
                  <ReferralRow key={r.id} r={r} showAccept={tab === 'received'} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Patient Referral">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Patient *</label>
            <input className="input" placeholder="Search patient…" value={ptSearch} onChange={e => setPtSearch(e.target.value)} />
            {patients.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
                {patients.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => { setForm(f => ({ ...f, patient_id: p.id })); setPtSearch(p.full_name); setPatients([]) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0"
                  >{p.full_name} · {p.mobile}</button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="label">Referring To (Clinic / Hospital)</label>
            <input className="input" placeholder="e.g. Apollo Hospital, Delhi" value={form.to_clinic_name} onChange={e => setForm(f => ({ ...f, to_clinic_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Reason *</label>
              <input className="input" placeholder="Specialist consultation" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Urgency</label>
              <select className="input" value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Clinical Notes</label>
            <textarea className="input resize-none" rows={3} value={form.clinical_notes} onChange={e => setForm(f => ({ ...f, clinical_notes: e.target.value }))} placeholder="History, examination findings, reason for referral…" />
          </div>
          <button type="submit" disabled={saving || !form.patient_id} className="btn-primary w-full justify-center">
            {saving ? 'Sending…' : 'Send Referral'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
