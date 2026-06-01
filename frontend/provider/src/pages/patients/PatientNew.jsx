import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patientsApi } from '../../api'
import { ArrowLeft, Save, User } from 'lucide-react'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export default function PatientNew() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '', mobile: '', email: '', date_of_birth: '', gender: '',
    blood_group: '', address: '', city: '', state: '', pincode: '',
    allergies: '', emergency_contact_name: '', emergency_contact_phone: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.full_name) { setError('Patient name is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await patientsApi.create(form)
      navigate(`/patients/${res.id}`)
    } catch (err) {
      setError(err.message || 'Failed to register patient')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/patients')} className="btn-secondary p-2">
            <ArrowLeft size={16} />
          </button>
          <h1 className="page-title">Register New Patient</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Personal Info */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><User size={16} />Personal Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Full Name *</label>
              <input className="input" placeholder="Patient's full name" value={form.full_name} onChange={set('full_name')} required />
            </div>
            <div>
              <label className="label">Mobile</label>
              <input className="input" type="tel" placeholder="10-digit mobile" value={form.mobile} onChange={set('mobile')} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="patient@email.com" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <input className="input" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
            </div>
            <div>
              <label className="label">Gender</label>
              <select className="input" value={form.gender} onChange={set('gender')}>
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="label">Blood Group</label>
              <select className="input" value={form.blood_group} onChange={set('blood_group')}>
                <option value="">Unknown</option>
                {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Known Allergies</label>
              <input className="input" placeholder="Penicillin, Dust…" value={form.allergies} onChange={set('allergies')} />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Address</label>
              <input className="input" placeholder="Street address" value={form.address} onChange={set('address')} />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" placeholder="City" value={form.city} onChange={set('city')} />
            </div>
            <div>
              <label className="label">State</label>
              <input className="input" placeholder="State" value={form.state} onChange={set('state')} />
            </div>
            <div>
              <label className="label">Pincode</label>
              <input className="input" placeholder="6-digit pincode" value={form.pincode} onChange={set('pincode')} />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Emergency Contact</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="Contact name" value={form.emergency_contact_name} onChange={set('emergency_contact_name')} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="Contact phone" value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            <Save size={16} />
            {saving ? 'Registering…' : 'Register Patient'}
          </button>
          <button type="button" onClick={() => navigate('/patients')} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  )
}
