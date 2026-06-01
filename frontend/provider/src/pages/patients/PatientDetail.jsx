import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { patientsApi, appointmentsApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import { ArrowLeft, User, Phone, Mail, MapPin, Activity, Calendar, Edit2, Save, X } from 'lucide-react'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export default function PatientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('info')

  useEffect(() => {
    Promise.all([
      patientsApi.get(id),
      appointmentsApi.list({ patient_id: id, limit: 20 }),
    ]).then(([p, a]) => {
      setPatient(p)
      setForm(p)
      setAppointments(Array.isArray(a) ? a : [])
    }).finally(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await patientsApi.update(id, form)
      setPatient(res)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />
  if (!patient) return <div className="text-gray-500">Patient not found</div>

  const age = patient.date_of_birth
    ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} yrs`
    : '—'

  return (
    <div className="max-w-4xl">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/patients')} className="btn-secondary p-2"><ArrowLeft size={16} /></button>
          <div>
            <h1 className="page-title">{patient.full_name}</h1>
            <p className="text-sm text-gray-500">{patient.uhid || patient.bh_id || `Patient #${patient.id}`}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving} className="btn-primary"><Save size={15}/>{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setEditing(false)} className="btn-secondary"><X size={15}/>Cancel</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary"><Edit2 size={15}/>Edit</button>
          )}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Age',          value: age },
          { label: 'Gender',       value: patient.gender || '—' },
          { label: 'Blood Group',  value: patient.blood_group || '—' },
          { label: 'Appointments', value: appointments.length },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-lg font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {['info', 'appointments', 'vitals'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ['Full Name',   'full_name',   'text'],
            ['Mobile',      'mobile',      'tel'],
            ['Email',       'email',       'email'],
            ['Date of Birth','date_of_birth','date'],
            ['Address',     'address',     'text'],
            ['City',        'city',        'text'],
            ['State',       'state',       'text'],
            ['Pincode',     'pincode',     'text'],
            ['Allergies',   'allergies',   'text'],
            ['ABHA ID',     'abha_id',     'text'],
          ].map(([label, key, type]) => (
            <div key={key}>
              <label className="label">{label}</label>
              {editing ? (
                key === 'gender' ? (
                  <select className="input" value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}>
                    <option value="">—</option>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                ) : (
                  <input
                    className="input"
                    type={type}
                    value={form[key] || ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                )
              ) : (
                <div className="text-sm text-gray-700 py-2 px-3 bg-gray-50 rounded-lg">{patient[key] || '—'}</div>
              )}
            </div>
          ))}
          {editing && (
            <div>
              <label className="label">Gender</label>
              <select className="input" value={form.gender || ''} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                <option value="">—</option>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
          )}
        </div>
      )}

      {tab === 'appointments' && (
        <div className="card">
          <div className="table-wrapper rounded-xl border-0">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Time</th>
                  <th className="th">Doctor</th>
                  <th className="th">Status</th>
                  <th className="th">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments.length === 0 ? (
                  <tr><td colSpan={5} className="td text-center text-gray-400 py-8">No appointments yet</td></tr>
                ) : appointments.map(a => (
                  <tr key={a.id} className="tr-hover">
                    <td className="td">{a.appointment_date}</td>
                    <td className="td font-mono">{a.appointment_time}</td>
                    <td className="td">{a.doctor_name || '—'}</td>
                    <td className="td"><span className={`badge badge-${a.status === 'completed' ? 'green' : a.status === 'cancelled' ? 'gray' : 'blue'}`}>{a.status}</span></td>
                    <td className="td text-gray-500 text-xs">{a.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'vitals' && (
        <div className="card p-6 text-center text-gray-400">
          <Activity size={32} className="mx-auto mb-2 opacity-30" />
          <p>Vitals are recorded during appointments</p>
        </div>
      )}
    </div>
  )
}
