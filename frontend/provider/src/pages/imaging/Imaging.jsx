import { useState, useEffect } from 'react'
import { imagingApi, patientsApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import { Scan, Plus } from 'lucide-react'

const MODALITIES = ['X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'PET Scan', 'Mammography', 'Fluoroscopy']
const STATUS_COLORS = { ordered: 'badge-yellow', processing: 'badge-purple', completed: 'badge-green', cancelled: 'badge-gray' }

export default function Imaging() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [showReport, setShowReport] = useState(null)
  const [form, setForm] = useState({ patient_id: '', modality: '', body_part: '', clinical_notes: '' })
  const [report, setReport] = useState('')
  const [patients, setPatients] = useState([])
  const [ptSearch, setPtSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    imagingApi.getOrders({ limit: 50 })
      .then(r => setOrders(r.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (ptSearch.length < 2) return
    const t = setTimeout(() => {
      patientsApi.list({ search: ptSearch, limit: 10 }).then(r => setPatients(r.data || []))
    }, 300)
    return () => clearTimeout(t)
  }, [ptSearch])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await imagingApi.create(form)
      setShowNew(false)
      setForm({ patient_id: '', modality: '', body_part: '', clinical_notes: '' })
      load()
    } finally { setSaving(false) }
  }

  const handleSaveReport = async () => {
    setSaving(true)
    try {
      await imagingApi.update(showReport.id, { report, status: 'completed' })
      setShowReport(null)
      load()
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Imaging / Radiology</h1>
        <button onClick={() => setShowNew(true)} className="btn-primary"><Plus size={16} />New Order</button>
      </div>

      <div className="card">
        {loading ? <PageLoader /> : orders.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Scan size={36} className="mx-auto mb-2 opacity-30" />
            <p>No imaging orders</p>
          </div>
        ) : (
          <div className="table-wrapper rounded-xl border-0">
            <table className="table">
              <thead><tr>
                <th className="th">Order #</th><th className="th">Patient</th><th className="th">Modality</th>
                <th className="th">Body Part</th><th className="th">Status</th><th className="th">Date</th><th className="th">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(o => (
                  <tr key={o.id} className="tr-hover">
                    <td className="td font-mono">IMG-{o.id}</td>
                    <td className="td font-medium">{o.patient_name || o.patient?.full_name}</td>
                    <td className="td"><span className="badge-purple">{o.modality}</span></td>
                    <td className="td text-gray-500">{o.body_part || '—'}</td>
                    <td className="td"><span className={STATUS_COLORS[o.status] || 'badge-gray'}>{o.status}</span></td>
                    <td className="td text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="td">
                      {o.status !== 'completed' && (
                        <button onClick={() => { setShowReport(o); setReport(o.report || '') }} className="text-xs text-green-600 hover:underline">
                          Add Report
                        </button>
                      )}
                      {o.status === 'completed' && o.report && (
                        <button onClick={() => { setShowReport(o); setReport(o.report) }} className="text-xs text-gray-500 hover:underline">
                          View Report
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Order Modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Imaging Order">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Patient</label>
            <input className="input" placeholder="Search patient…" value={ptSearch} onChange={e => setPtSearch(e.target.value)} />
            {patients.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
                {patients.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => { setForm(f => ({ ...f, patient_id: p.id })); setPtSearch(`${p.full_name}`); setPatients([]) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0"
                  >
                    {p.full_name} · {p.mobile}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="label">Modality *</label>
            <select className="input" value={form.modality} onChange={e => setForm(f => ({ ...f, modality: e.target.value }))} required>
              <option value="">Select</option>
              {MODALITIES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Body Part</label>
            <input className="input" placeholder="e.g. Chest, Abdomen, Knee" value={form.body_part} onChange={e => setForm(f => ({ ...f, body_part: e.target.value }))} />
          </div>
          <div>
            <label className="label">Clinical Notes</label>
            <textarea className="input resize-none" rows={3} value={form.clinical_notes} onChange={e => setForm(f => ({ ...f, clinical_notes: e.target.value }))} />
          </div>
          <button type="submit" disabled={saving || !form.patient_id} className="btn-primary w-full justify-center">
            {saving ? 'Creating…' : 'Create Order'}
          </button>
        </form>
      </Modal>

      {/* Report Modal */}
      <Modal open={!!showReport} onClose={() => setShowReport(null)} title="Imaging Report" size="lg">
        {showReport && (
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              IMG-{showReport.id} · {showReport.modality} · {showReport.body_part}
            </div>
            <div>
              <label className="label">Report / Findings</label>
              <textarea className="input resize-none" rows={8} value={report} onChange={e => setReport(e.target.value)} placeholder="Describe findings, impression, recommendations…" />
            </div>
            <button onClick={handleSaveReport} disabled={saving} className="btn-success w-full justify-center">
              {saving ? 'Saving…' : 'Save Report & Mark Complete'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
