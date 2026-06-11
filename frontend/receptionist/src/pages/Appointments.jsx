import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { cachedGet, TTL } from '../utils/cache'
import { Plus, Search, Loader2, CalendarDays, X } from 'lucide-react'

const STATUS_COLORS = { scheduled:'badge-yellow', waiting:'badge-yellow', in_progress:'badge-purple', completed:'badge-green', cancelled:'badge-red', no_show:'badge-gray' }
const VISIT_TYPES = ['walk_in', 'scheduled', 'follow_up', 'emergency']
const STATUSES = ['scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show']

export default function Appointments() {
  const [appts, setAppts] = useState([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [form, setForm] = useState({ patient_id: '', doctor_id: '', appointment_date: date, appointment_time: '09:00', visit_type: 'walk_in', notes: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [filterDoctor, setFilterDoctor] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMode, setFilterMode]     = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api.get('/appointments', { params: { appointment_date: date, limit: 200 } })
      .then(r => setAppts(Array.isArray(r) ? r : []))
      .finally(() => setLoading(false))
  }, [date])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    cachedGet('recep_patients_list', () => api.get('/patients', { params: { limit: 500 } }), TTL.SHORT)
      .then(r => setPatients(Array.isArray(r) ? r : [])).catch(() => {})
    cachedGet('recep_doctors_list', () => api.get('/clinic/doctors'), TTL.MEDIUM)
      .then(r => setDoctors(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  const updateStatus = async (id, status) => {
    try { await api.put(`/appointments/${id}`, { status }); load() } catch {}
  }

  const book = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await api.post('/appointments', { ...form, patient_id: parseInt(form.patient_id), doctor_id: parseInt(form.doctor_id) })
      setShowNew(false); load()
    } catch (ex) { setErr(ex.message) }
    finally { setSaving(false) }
  }

  const doctorNames = [...new Set(appts.map(a => a.doctor_name).filter(Boolean))]
  const hasFilters = filterDoctor || filterStatus || filterMode

  const visible = appts.filter(a => {
    if (filterDoctor && a.doctor_name !== filterDoctor) return false
    if (filterStatus && a.status !== filterStatus) return false
    if (filterMode && a.visit_type !== filterMode) return false
    return true
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h1 className="page-title">Appointments</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-auto" />
          <button onClick={() => setShowNew(true)} className="btn-primary"><Plus size={16} />Book Appointment</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select className="input w-auto text-sm py-1.5" value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)}>
          <option value="">All Doctors</option>
          {doctorNames.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="input w-auto text-sm py-1.5" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input w-auto text-sm py-1.5" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
          <option value="">All Types</option>
          {VISIT_TYPES.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setFilterDoctor(''); setFilterStatus(''); setFilterMode('') }}
            className="btn-secondary text-xs py-1 px-3 flex items-center gap-1">
            <X size={12} />Clear
          </button>
        )}
        {hasFilters && (
          <span className="text-xs text-gray-400 self-center">{visible.length} of {appts.length}</span>
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#0F2557' }}>Book New Appointment</h3>
            <form onSubmit={book} className="space-y-3">
              <div>
                <label className="label">Patient *</label>
                <select className="input" value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))} required>
                  <option value="">Select patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} — {p.mobile}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Doctor *</label>
                <select className="input" value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))} required>
                  <option value="">Select doctor</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.staff?.full_name || 'Dr. ' + d.id} — {d.specialty}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date *</label>
                  <input type="date" className="input" value={form.appointment_date} onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Time *</label>
                  <input type="time" className="input" value={form.appointment_time} onChange={e => setForm(f => ({ ...f, appointment_time: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="label">Visit Type</label>
                <select className="input" value={form.visit_type} onChange={e => setForm(f => ({ ...f, visit_type: e.target.value }))}>
                  <option value="walk_in">Walk-in</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
              </div>
              {err && <p className="text-red-600 text-sm">{err}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Booking…' : 'Book'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
            <p>{appts.length === 0 ? 'No appointments for this date' : 'No appointments match the filters'}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th className="th">#</th><th className="th">Patient</th><th className="th">Doctor</th><th className="th">Time</th><th className="th">Type</th><th className="th">Status</th><th className="th">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map(a => (
                  <tr key={a.id} className="tr-hover">
                    <td className="td font-bold" style={{ color: '#0F2557' }}>#{a.token_number || a.id}</td>
                    <td className="td font-medium">{a.patient_name || '—'}</td>
                    <td className="td text-gray-500">{a.doctor_name || '—'}</td>
                    <td className="td">{a.appointment_time || '—'}</td>
                    <td className="td capitalize">{a.visit_type?.replace('_', ' ') || '—'}</td>
                    <td className="td"><span className={`badge ${STATUS_COLORS[a.status] || 'badge-gray'}`}>{a.status}</span></td>
                    <td className="td">
                      {a.status === 'scheduled' && <button onClick={() => updateStatus(a.id, 'waiting')} className="btn-secondary text-xs py-1 px-2">Check In</button>}
                      {a.status === 'waiting' && <button onClick={() => updateStatus(a.id, 'in_progress')} className="btn-navy text-xs py-1 px-2">Start</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
