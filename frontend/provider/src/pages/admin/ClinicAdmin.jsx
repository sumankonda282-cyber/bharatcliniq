import { useState, useEffect } from 'react'
import { clinicApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import { Settings, Users, UserPlus, Building2, Calendar, Plus, Edit2, ToggleLeft, ToggleRight, Clock } from 'lucide-react'

const ROLES = ['doctor', 'receptionist', 'pharmacist', 'lab_tech', 'imaging_tech', 'clinic_admin']
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const ROLE_COLORS = {
  clinic_admin: 'badge-purple', doctor: 'badge-blue', receptionist: 'badge-green',
  pharmacist: 'badge-yellow', lab_tech: 'badge-orange', imaging_tech: 'badge-gray',
}

export default function ClinicAdmin() {
  const [tab, setTab] = useState('staff')
  const [staff, setStaff] = useState([])
  const [branches, setBranches] = useState([])
  const [profile, setProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  // Staff modal
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newStaff, setNewStaff] = useState({ full_name: '', email: '', mobile: '', role: 'receptionist', password: '', specialty: '', consultation_fee: 500 })
  const [saving, setSaving] = useState(false)

  // Schedule modal
  const [scheduleDoctor, setScheduleDoctor] = useState(null)
  const [scheduleForm, setScheduleForm] = useState({ day_of_week: 'monday', start_time: '09:00', end_time: '17:00', slot_minutes: 15, branch_id: '' })

  // Profile edit
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({})

  const load = () => {
    setLoading(true)
    Promise.all([
      clinicApi.getStaff(),
      clinicApi.getBranches(),
      clinicApi.getProfile(),
      clinicApi.getSubscription(),
    ]).then(([s, b, p, sub]) => {
      setStaff(s.data || [])
      setBranches(b.data || [])
      setProfile(p.data)
      setProfileForm(p.data)
      setSubscription(sub.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleAddStaff = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await clinicApi.addStaff(newStaff)
      setShowAddStaff(false)
      setNewStaff({ full_name: '', email: '', mobile: '', role: 'receptionist', password: '', specialty: '', consultation_fee: 500 })
      load()
    } finally { setSaving(false) }
  }

  const handleToggle = async (id) => {
    await clinicApi.updateStaff(id, { is_active: !staff.find(s => s.id === id)?.is_active })
    load()
  }

  const handleSaveSchedule = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await clinicApi.setSchedule(scheduleDoctor.profile_id, { ...scheduleForm, branch_id: scheduleForm.branch_id || (branches[0]?.id) })
      setScheduleDoctor(null)
    } finally { setSaving(false) }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await clinicApi.updateProfile(profileForm)
      setEditProfile(false)
      load()
    } finally { setSaving(false) }
  }

  const doctors = staff.filter(s => s.role === 'doctor')

  if (loading) return <PageLoader />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Clinic Administration</h1>
      </div>

      {/* Subscription Banner */}
      {subscription && (
        <div className="card p-4 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Settings size={18} className="text-purple-600" />
            </div>
            <div>
              <div className="font-semibold capitalize">{subscription.plan} Plan</div>
              <div className="text-xs text-gray-400">
                {subscription.usage.doctors}/{subscription.limits.doctors} doctors · {subscription.usage.branches}/{subscription.limits.branches} branches
              </div>
            </div>
          </div>
          <span className={`badge ${subscription.status === 'active' ? 'badge-green' : 'badge-red'}`}>{subscription.status}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-5 w-fit">
        {[
          { key: 'staff', label: 'Staff', icon: Users },
          { key: 'schedule', label: 'Schedules', icon: Calendar },
          { key: 'profile', label: 'Clinic Profile', icon: Building2 },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {/* Staff Tab */}
      {tab === 'staff' && (
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold">Staff Members ({staff.length})</h2>
            <button onClick={() => setShowAddStaff(true)} className="btn-primary text-sm"><UserPlus size={14} />Add Staff</button>
          </div>
          <div className="table-wrapper rounded-xl border-0">
            <table className="table">
              <thead><tr>
                <th className="th">Name</th><th className="th">Email</th><th className="th">Mobile</th>
                <th className="th">Role</th><th className="th">Status</th><th className="th">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map(s => (
                  <tr key={s.id} className="tr-hover">
                    <td className="td font-medium">{s.full_name}</td>
                    <td className="td text-gray-500 text-sm">{s.email || '—'}</td>
                    <td className="td text-sm">{s.mobile || '—'}</td>
                    <td className="td"><span className={ROLE_COLORS[s.role] || 'badge-gray'}>{s.role?.replace('_', ' ')}</span></td>
                    <td className="td">
                      <span className={s.is_active ? 'badge-green' : 'badge-red'}>{s.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="td">
                      <button onClick={() => handleToggle(s.id)} className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1">
                        {s.is_active ? <ToggleRight size={14} className="text-green-500" /> : <ToggleLeft size={14} />}
                        {s.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedules Tab */}
      {tab === 'schedule' && (
        <div className="space-y-3">
          {doctors.length === 0 ? (
            <div className="card p-8 text-center text-gray-400"><Calendar size={32} className="mx-auto mb-2 opacity-30" /><p>No doctors found. Add doctors from the Staff tab.</p></div>
          ) : doctors.map(doc => (
            <div key={doc.id} className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{doc.full_name}</div>
                  <div className="text-sm text-gray-400">{doc.specialty || 'General'}</div>
                </div>
                <button onClick={() => setScheduleDoctor(doc)} className="btn-secondary text-sm"><Clock size={14} />Set Schedule</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profile Tab */}
      {tab === 'profile' && profile && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">Clinic Profile</h2>
            {editProfile ? (
              <div className="flex gap-2">
                <button onClick={handleSaveProfile} disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : 'Save'}</button>
                <button onClick={() => setEditProfile(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setEditProfile(true)} className="btn-secondary text-sm"><Edit2 size={13} />Edit</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Clinic Name', 'name'],
              ['Specialty', 'specialty'],
              ['Phone', 'phone'],
              ['Email', 'email'],
              ['Address', 'address'],
              ['City', 'city'],
              ['State', 'state'],
              ['Pincode', 'pincode'],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="label">{label}</label>
                {editProfile ? (
                  <input className="input" value={profileForm[key] || ''} onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.value }))} />
                ) : (
                  <div className="text-sm text-gray-700 py-2 px-3 bg-gray-50 rounded-lg">{profile[key] || '—'}</div>
                )}
              </div>
            ))}
            <div className="col-span-2">
              <label className="label">Description</label>
              {editProfile ? (
                <textarea className="input resize-none" rows={3} value={profileForm.description || ''} onChange={e => setProfileForm(f => ({ ...f, description: e.target.value }))} />
              ) : (
                <div className="text-sm text-gray-700 py-2 px-3 bg-gray-50 rounded-lg min-h-[60px]">{profile.description || '—'}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      <Modal open={showAddStaff} onClose={() => setShowAddStaff(false)} title="Add Staff Member" size="lg">
        <form onSubmit={handleAddStaff} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Full Name *</label>
              <input className="input" required value={newStaff.full_name} onChange={e => setNewStaff(s => ({ ...s, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={newStaff.email} onChange={e => setNewStaff(s => ({ ...s, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Mobile</label>
              <input className="input" type="tel" value={newStaff.mobile} onChange={e => setNewStaff(s => ({ ...s, mobile: e.target.value }))} />
            </div>
            <div>
              <label className="label">Role *</label>
              <select className="input" value={newStaff.role} onChange={e => setNewStaff(s => ({ ...s, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Password *</label>
              <input className="input" type="password" required value={newStaff.password} onChange={e => setNewStaff(s => ({ ...s, password: e.target.value }))} placeholder="Min 8 characters" />
            </div>
            {newStaff.role === 'doctor' && (
              <>
                <div>
                  <label className="label">Specialty</label>
                  <input className="input" placeholder="Cardiology, General…" value={newStaff.specialty} onChange={e => setNewStaff(s => ({ ...s, specialty: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Consultation Fee (₹)</label>
                  <input className="input" type="number" value={newStaff.consultation_fee} onChange={e => setNewStaff(s => ({ ...s, consultation_fee: e.target.value }))} />
                </div>
              </>
            )}
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
            {saving ? 'Adding…' : 'Add Staff Member'}
          </button>
        </form>
      </Modal>

      {/* Schedule Modal */}
      <Modal open={!!scheduleDoctor} onClose={() => setScheduleDoctor(null)} title={`Set Schedule — ${scheduleDoctor?.full_name}`}>
        <form onSubmit={handleSaveSchedule} className="space-y-4">
          <div>
            <label className="label">Day of Week</label>
            <select className="input" value={scheduleForm.day_of_week} onChange={e => setScheduleForm(s => ({ ...s, day_of_week: e.target.value }))}>
              {DAYS.map(d => <option key={d} value={d} className="capitalize">{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Branch</label>
            <select className="input" value={scheduleForm.branch_id} onChange={e => setScheduleForm(s => ({ ...s, branch_id: e.target.value }))}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Time</label>
              <input className="input" type="time" value={scheduleForm.start_time} onChange={e => setScheduleForm(s => ({ ...s, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="label">End Time</label>
              <input className="input" type="time" value={scheduleForm.end_time} onChange={e => setScheduleForm(s => ({ ...s, end_time: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Slot Duration (minutes)</label>
            <select className="input" value={scheduleForm.slot_minutes} onChange={e => setScheduleForm(s => ({ ...s, slot_minutes: parseInt(e.target.value) }))}>
              {[10, 15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m} min</option>)}
            </select>
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
