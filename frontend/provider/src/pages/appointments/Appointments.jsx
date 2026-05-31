import { useState, useEffect } from 'react'
import { appointmentsApi, patientsApi, clinicApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import { Plus, Calendar, Search, RefreshCw, UserPlus } from 'lucide-react'
import { format } from 'date-fns'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'

const STATUS_COLORS = {
  pending: 'badge-yellow', confirmed: 'badge-blue',
  in_progress: 'badge-purple', completed: 'badge-green', cancelled: 'badge-gray',
}

export default function Appointments() {
  const [searchParams] = useSearchParams()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWalkin, setShowWalkin] = useState(searchParams.get('walkin') === '1')
  const [doctors, setDoctors] = useState([])
  const [patients, setPatients] = useState([])
  const [patientSearch, setPatientSearch] = useState('')
  const [walkin, setWalkin] = useState({
    patient_id: '', doctor_id: '', appointment_time: '', reason: '', mode: 'offline'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadAppts = () => {
    setLoading(true)
    appointmentsApi.list({ date, limit: 100 })
      .then(r => setAppointments(r.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAppts() }, [date])

  useEffect(() => {
    clinicApi.getDoctors().then(r => setDoctors(r.data || []))
  }, [])

  useEffect(() => {
    if (!patientSearch || patientSearch.length < 2) return
    const t = setTimeout(() => {
      patientsApi.list({ search: patientSearch, limit: 10 })
        .then(r => setPatients(r.data || []))
    }, 300)
    return () => clearTimeout(t)
  }, [patientSearch])

  const handleStatusChange = async (id, status) => {
    await appointmentsApi.update(id, { status })
    loadAppts()
  }

  const handleWalkin = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await appointmentsApi.create({ ...walkin, appointment_date: date })
      setShowWalkin(false)
      setWalkin({ patient_id: '', doctor_id: '', appointment_time: '', reason: '', mode: 'offline' })
      loadAppts()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create appointment')
    } finally {
      setSaving(false)
    }
  }

  const statusNext = { pending: 'confirmed', confirmed: 'in_progress', in_progress: 'completed' }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Appointments</h1>
        <div className="flex gap-2">
          <button onClick={loadAppts} className="btn-secondary p-2"><RefreshCw size={15} /></button>
          <button onClick={() => setShowWalkin(true)} className="btn-primary">
            <UserPlus size={16} />Walk-in
          </button>
        </div>
      </div>

      {/* Date picker */}
      <div className="card p-4 mb-4 flex items-center gap-4">
        <Calendar size={18} className="text-gray-400" />
        <input
          type="date"
          className="input w-44"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        <div className="text-sm text-gray-500">
          {appointments.length} appointments · {appointments.filter(a => a.status === 'completed').length} completed
        </div>
      </div>

      {/* Queue */}
      <div className="card">
        {loading ? <PageLoader /> : appointments.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Calendar size={36} className="mx-auto mb-2 opacity-30" />
            <p>No appointments for this date</p>
          </div>
        ) : (
          <div className="table-wrapper rounded-xl border-0">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">#</th>
                  <th className="th">Patient</th>
                  <th className="th">Time</th>
                  <th className="th">Doctor</th>
                  <th className="th">Mode</th>
                  <th className="th">Status</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments.map(a => (
                  <tr key={a.id} className="tr-hover">
                    <td className="td font-bold text-blue-600">#{a.token_number || a.id}</td>
                    <td className="td">
                      <div className="font-medium">{a.patient_name || '—'}</div>
                      <div className="text-xs text-gray-400">{a.reason}</div>
                    </td>
                    <td className="td font-mono">{a.appointment_time}</td>
                    <td className="td text-sm text-gray-600">{a.doctor_name || '—'}</td>
                    <td className="td">
                      <span className={`badge ${a.mode === 'online' ? 'badge-blue' : 'badge-gray'}`}>{a.mode}</span>
                    </td>
                    <td className="td">
                      <span className={STATUS_COLORS[a.status] || 'badge-gray'}>{a.status}</span>
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        {statusNext[a.status] && (
                          <button
                            onClick={() => handleStatusChange(a.id, statusNext[a.status])}
                            className="text-xs text-blue-600 hover:underline capitalize"
                          >
                            → {statusNext[a.status].replace('_', ' ')}
                          </button>
                        )}
                        <Link to={`/encounter/${a.id}`} className="text-xs text-purple-600 hover:underline">
                          Desk →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Walk-in Modal */}
      <Modal open={showWalkin} onClose={() => setShowWalkin(false)} title="Add Walk-in Appointment">
        <form onSubmit={handleWalkin} className="space-y-4">
          <div>
            <label className="label">Search Patient</label>
            <input
              className="input"
              placeholder="Type name or mobile…"
              value={patientSearch}
              onChange={e => setPatientSearch(e.target.value)}
            />
            {patients.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
                {patients.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setWalkin(w => ({ ...w, patient_id: p.id }))
                      setPatientSearch(`${p.full_name} (${p.mobile || p.id})`)
                      setPatients([])
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0"
                  >
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-xs text-gray-400">{p.mobile} · {p.uhid || `#${p.id}`}</div>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Patient not found?{' '}
              <Link to="/patients/new" className="text-blue-600 hover:underline">Register new patient</Link>
            </p>
          </div>

          <div>
            <label className="label">Doctor *</label>
            <select className="input" value={walkin.doctor_id} onChange={e => setWalkin(w => ({ ...w, doctor_id: e.target.value }))} required>
              <option value="">Select doctor</option>
              {doctors.map(d => (
                <option key={d.profile_id || d.id} value={d.profile_id || d.id}>{d.full_name} — {d.specialty}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Time *</label>
              <input type="time" className="input" value={walkin.appointment_time} onChange={e => setWalkin(w => ({ ...w, appointment_time: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Mode</label>
              <select className="input" value={walkin.mode} onChange={e => setWalkin(w => ({ ...w, mode: e.target.value }))}>
                <option value="offline">Walk-in (Offline)</option>
                <option value="online">Online</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Reason / Chief Complaint</label>
            <input className="input" placeholder="Fever, follow-up, checkup…" value={walkin.reason} onChange={e => setWalkin(w => ({ ...w, reason: e.target.value }))} />
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

          <button type="submit" disabled={saving || !walkin.patient_id || !walkin.doctor_id} className="btn-primary w-full justify-center">
            {saving ? 'Creating…' : 'Add to Queue'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
