import { useState, useEffect } from 'react'
import { clinicApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import { Settings, Users, UserPlus, Building2, Calendar, Plus, Edit2, ToggleLeft, ToggleRight, Clock, CheckCircle, Video, Palette, Upload } from 'lucide-react'
import api from '../../api/client'

const ROLES = ['doctor', 'receptionist', 'pharmacist', 'lab_technician', 'clinic_admin']
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const ROLE_COLORS = {
  clinic_admin: 'badge-purple', doctor: 'badge-blue', receptionist: 'badge-green',
  pharmacist: 'badge-yellow', lab_technician: 'badge-orange',
}

const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60]

const DEFAULT_DAY = { enabled: false, start_time: '09:00', end_time: '17:00', slot_minutes: 30 }

function initWeek() {
  return Object.fromEntries(DAYS.map(d => [d, { ...DEFAULT_DAY }]))
}

function TelehealthFeeInput({ doc, saving, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(doc.telehealth_fee ?? '')

  if (!editing) {
    return (
      <button
        onClick={() => { setVal(doc.telehealth_fee ?? ''); setEditing(true) }}
        className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-gray-400 text-gray-700 min-w-[80px] text-left"
        disabled={!doc.profile_id}
      >
        {doc.telehealth_fee ? `₹${doc.telehealth_fee}` : <span className="text-gray-400">Same as consult</span>}
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type="number"
        className="input py-1.5 text-sm w-24"
        placeholder="e.g. 500"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { onSave(doc, val); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
      />
      <button onClick={() => { onSave(doc, val); setEditing(false) }} className="btn-primary py-1.5 text-xs px-2">{saving ? '…' : 'OK'}</button>
      <button onClick={() => setEditing(false)} className="btn-secondary py-1.5 text-xs px-2">✕</button>
    </div>
  )
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://bharatcliniq.onrender.com'

function BrandingTab({ clinicId, profile }) {
  const [brandName, setBrandName]   = useState(profile.brand_name || '')
  const [brandColor, setBrandColor] = useState(profile.brand_color || '#0F2557')
  const [logoUrl, setLogoUrl]       = useState(profile.logo_url || '')
  const [uploading, setUploading]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState('')

  const uploadLogo = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    setUploading(true)
    try {
      const r = await api.post('/clinic/profile/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setLogoUrl(r.data.logo_url)
      setMsg('Logo uploaded!')
    } catch { setMsg('Upload failed') } finally { setUploading(false) }
  }

  const saveBranding = async () => {
    setSaving(true)
    try {
      await api.put('/clinic/profile', { brand_name: brandName, brand_color: brandColor })
      setMsg('Branding saved! Reload to see changes in the sidebar.')
    } catch { setMsg('Save failed') } finally { setSaving(false) }
  }

  return (
    <div className="card p-6 space-y-6 max-w-lg">
      <div>
        <h2 className="font-semibold text-gray-800 mb-1">Portal Branding</h2>
        <p className="text-xs text-gray-500">Customise how your clinic appears in all portals after login. The BHaratCliniq platform name is replaced with your clinic's brand in the sidebar.</p>
      </div>

      <div>
        <label className="label">Display Name in Portals</label>
        <input className="input" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder={profile.name} />
        <p className="text-xs text-gray-400 mt-1">Leave blank to show your clinic name.</p>
      </div>

      <div>
        <label className="label">Brand Color</label>
        <div className="flex gap-3 items-center">
          <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-12 h-10 rounded cursor-pointer border border-gray-200" />
          <input className="input flex-1" value={brandColor} onChange={e => setBrandColor(e.target.value)} placeholder="#0F2557" />
          <span className="w-8 h-8 rounded-lg border border-gray-200" style={{ background: brandColor }} />
        </div>
      </div>

      <div>
        <label className="label">Clinic Logo</label>
        {logoUrl && (
          <div className="mb-3 flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <img src={logoUrl.startsWith('/') ? `${API_BASE}${logoUrl}` : logoUrl} alt="Logo" style={{ height: 48, objectFit: 'contain' }} />
            <span className="text-xs text-gray-500">{logoUrl}</span>
          </div>
        )}
        <label className="btn-secondary cursor-pointer inline-flex items-center gap-2">
          <Upload size={13} />{uploading ? 'Uploading…' : 'Upload Logo (JPG/PNG/WEBP)'}
          <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={uploadLogo} />
        </label>
        <p className="text-xs text-gray-400 mt-1">Displayed in portal sidebar next to your clinic name.</p>
      </div>

      <button onClick={saveBranding} disabled={saving} className="btn-primary w-full justify-center">
        <Palette size={15} />{saving ? 'Saving…' : 'Save Branding'}
      </button>

      {msg && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">{msg}</p>}
    </div>
  )
}


export default function ClinicAdmin() {
  const [tab, setTab] = useState('staff')
  const [staff, setStaff] = useState([])
  const [doctors, setDoctors] = useState([])
  const [branches, setBranches] = useState([])
  const [profile, setProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  // Staff modal
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newStaff, setNewStaff] = useState({ full_name: '', email: '', mobile: '', role: 'receptionist', password: '', specialty: '', consultation_fee: 500 })
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')

  // Weekly schedule modal
  const [scheduleDoctor, setScheduleDoctor] = useState(null)
  const [weekSchedule, setWeekSchedule] = useState(initWeek())
  const [scheduleBranchId, setScheduleBranchId] = useState('')
  const [scheduleLoading, setScheduleLoading] = useState(false)

  // Telehealth doctor state
  const [telehealthSaving, setTelehealthSaving] = useState({})

  // Profile edit
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({})

  const load = () => {
    setLoading(true)
    Promise.all([
      clinicApi.getStaff(),
      clinicApi.getDoctors(),
      clinicApi.getBranches(),
      clinicApi.getProfile(),
      clinicApi.getSubscription(),
    ]).then(([s, d, b, p, sub]) => {
      setStaff(Array.isArray(s) ? s : [])
      setDoctors(Array.isArray(d) ? d : [])
      setBranches(Array.isArray(b) ? b : [])
      setProfile(p)
      setProfileForm(p)
      setSubscription(sub)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Load existing schedules when schedule modal opens
  useEffect(() => {
    if (!scheduleDoctor) return
    const firstBranch = branches[0]?.id || ''
    setScheduleBranchId(firstBranch)
    setWeekSchedule(initWeek())
    if (!scheduleDoctor.profile_id) return
    setScheduleLoading(true)
    clinicApi.getSchedules(scheduleDoctor.profile_id)
      .then(schedules => {
        if (!Array.isArray(schedules)) return
        setWeekSchedule(prev => {
          const next = { ...prev }
          schedules.forEach(s => {
            if (next[s.day_of_week]) {
              next[s.day_of_week] = {
                enabled: s.is_active !== false,
                start_time: s.start_time || '09:00',
                end_time: s.end_time || '17:00',
                slot_minutes: s.slot_minutes || 30,
              }
            }
          })
          return next
        })
      })
      .catch(() => {})
      .finally(() => setScheduleLoading(false))
  }, [scheduleDoctor])

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

  const handleSaveWeekSchedule = async (e) => {
    e.preventDefault()
    if (!scheduleDoctor?.profile_id) return
    setSaving(true)
    const branchId = scheduleBranchId || branches[0]?.id
    try {
      for (const day of DAYS) {
        const cfg = weekSchedule[day]
        if (!cfg) continue
        await clinicApi.setSchedule(scheduleDoctor.profile_id, {
          day_of_week:  day,
          branch_id:    Number(branchId),
          start_time:   cfg.start_time,
          end_time:     cfg.end_time,
          slot_minutes: cfg.slot_minutes,
          is_active:    cfg.enabled,
        })
      }
      setSaveSuccess(scheduleDoctor.full_name)
      setScheduleDoctor(null)
    } finally { setSaving(false) }
  }

  const quickSetupWorkweek = () => {
    setWeekSchedule(prev => {
      const next = {}
      DAYS.forEach(d => {
        next[d] = {
          ...prev[d],
          enabled: !['saturday', 'sunday'].includes(d),
          start_time: '09:00',
          end_time: '17:00',
          slot_minutes: 30,
        }
      })
      return next
    })
  }

  const toggleDay = (day) => {
    setWeekSchedule(prev => ({ ...prev, [day]: { ...prev[day], enabled: !prev[day].enabled } }))
  }

  const setDayField = (day, field, value) => {
    setWeekSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  const handleTelehealthToggle = async (doc) => {
    if (!doc.profile_id) return
    setTelehealthSaving(s => ({ ...s, [doc.id]: true }))
    try {
      await clinicApi.updateTelehealth(doc.profile_id, { telehealth_enabled: !doc.telehealth_enabled })
      load()
    } finally { setTelehealthSaving(s => ({ ...s, [doc.id]: false })) }
  }

  const handleTelehealthFee = async (doc, fee) => {
    if (!doc.profile_id) return
    setTelehealthSaving(s => ({ ...s, [`fee_${doc.id}`]: true }))
    try {
      await clinicApi.updateTelehealth(doc.profile_id, { telehealth_fee: fee ? Number(fee) : null })
      load()
    } finally { setTelehealthSaving(s => ({ ...s, [`fee_${doc.id}`]: false })) }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await clinicApi.updateProfile(profileForm)
      setEditProfile(false)
      load()
    } finally { setSaving(false) }
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Clinic Administration</h1>
      </div>

      {saveSuccess && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          <CheckCircle size={16} />
          Schedule saved for {saveSuccess}
          <button onClick={() => setSaveSuccess('')} className="ml-auto text-green-500 hover:text-green-700 text-xs">Dismiss</button>
        </div>
      )}

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
          { key: 'staff',      label: 'Staff',         icon: Users },
          { key: 'schedule',   label: 'Schedules',     icon: Calendar },
          { key: 'telehealth', label: 'Telehealth',    icon: Video },
          { key: 'profile',    label: 'Clinic Profile', icon: Building2 },
          { key: 'branding',   label: 'Branding',       icon: Palette },
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
                    <td className="td"><span className={`badge ${ROLE_COLORS[s.role] || 'badge-gray'}`}>{s.role?.replace('_', ' ')}</span></td>
                    <td className="td">
                      <span className={s.is_active ? 'badge badge-green' : 'badge badge-red'}>{s.is_active ? 'Active' : 'Inactive'}</span>
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
            <div className="card p-8 text-center text-gray-400">
              <Calendar size={32} className="mx-auto mb-2 opacity-30" />
              <p>No doctors found. Add doctors from the Staff tab.</p>
            </div>
          ) : doctors.map(doc => (
            <div key={doc.id} className="card p-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="font-semibold">{doc.full_name}</div>
                  <div className="text-sm text-gray-400">{doc.specialty || 'General'}</div>
                  {!doc.profile_id && (
                    <div className="text-xs text-orange-500 mt-0.5">No doctor profile yet — contact support</div>
                  )}
                </div>
                <button
                  onClick={() => setScheduleDoctor(doc)}
                  disabled={!doc.profile_id}
                  className="btn-secondary text-sm disabled:opacity-40"
                >
                  <Clock size={14} />Set Weekly Schedule
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Telehealth Tab */}
      {tab === 'telehealth' && (
        <div className="space-y-4">
          <div className="card p-4 mb-2 flex items-start gap-3" style={{ background: '#0F255708', border: '1px solid #0F255720' }}>
            <Video size={18} style={{ color: '#0F2557', flexShrink: 0, marginTop: 2 }} />
            <div className="text-sm text-gray-600">
              Enable telehealth for doctors to allow patients to book virtual consultations. Set a telehealth fee (defaults to consultation fee if blank).
            </div>
          </div>
          {doctors.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">
              <Video size={32} className="mx-auto mb-2 opacity-30" />
              <p>No doctors found. Add doctors from the Staff tab first.</p>
            </div>
          ) : doctors.map(doc => (
            <div key={doc.id} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="font-semibold">{doc.full_name}</div>
                <div className="text-sm text-gray-400">{doc.specialty || 'General'}</div>
                {!doc.profile_id && <div className="text-xs text-orange-500 mt-0.5">No doctor profile — cannot enable telehealth</div>}
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                {/* Fee input */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Telehealth Fee (₹)</label>
                  <TelehealthFeeInput
                    doc={doc}
                    saving={telehealthSaving[`fee_${doc.id}`]}
                    onSave={handleTelehealthFee}
                  />
                </div>
                {/* Toggle */}
                <button
                  onClick={() => handleTelehealthToggle(doc)}
                  disabled={!doc.profile_id || telehealthSaving[doc.id]}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all disabled:opacity-40"
                  style={doc.telehealth_enabled
                    ? { borderColor: '#0F2557', background: '#0F2557', color: 'white' }
                    : { borderColor: '#D1D5DB', color: '#6B7280' }
                  }
                >
                  {doc.telehealth_enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  {telehealthSaving[doc.id] ? 'Saving…' : (doc.telehealth_enabled ? 'Enabled' : 'Disabled')}
                </button>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="col-span-full">
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

      {tab === 'branding' && profile && (
        <BrandingTab clinicId={profile.id} profile={profile} onSaved={() => {}} />
      )}

      {/* Add Staff Modal */}
      <Modal open={showAddStaff} onClose={() => setShowAddStaff(false)} title="Add Staff Member" size="lg">
        <form onSubmit={handleAddStaff} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-full">
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

      {/* Weekly Schedule Modal */}
      <Modal
        open={!!scheduleDoctor}
        onClose={() => setScheduleDoctor(null)}
        title={`Weekly Schedule — ${scheduleDoctor?.full_name || ''}`}
        size="lg"
      >
        {scheduleLoading ? (
          <div className="flex justify-center py-10 text-gray-400">Loading existing schedule…</div>
        ) : (
          <form onSubmit={handleSaveWeekSchedule} className="space-y-5">
            {/* Branch selector + quick setup */}
            <div className="flex flex-wrap items-end gap-3">
              {branches.length > 1 && (
                <div className="flex-1 min-w-[160px]">
                  <label className="label">Branch</label>
                  <select className="input" value={scheduleBranchId} onChange={e => setScheduleBranchId(e.target.value)}>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={quickSetupWorkweek}
                className="btn-secondary text-sm"
                style={{ borderColor: '#0F2557', color: '#0F2557' }}
              >
                Quick Setup (Mon–Fri, 9am–5pm)
              </button>
            </div>

            {/* Weekly grid */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[120px_1fr_1fr_80px] gap-0 text-xs font-semibold text-gray-500 bg-gray-50 px-4 py-2 border-b border-gray-200">
                <span>Day</span><span>Start</span><span>End</span><span>Slots</span>
              </div>
              {DAYS.map((day) => {
                const cfg = weekSchedule[day] || DEFAULT_DAY
                return (
                  <div
                    key={day}
                    className={`grid grid-cols-[120px_1fr_1fr_80px] gap-3 items-center px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${cfg.enabled ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={() => toggleDay(day)}
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                      <span className={`text-sm font-medium capitalize ${cfg.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                        {day.slice(0, 3).charAt(0).toUpperCase() + day.slice(1, 3)}
                      </span>
                    </label>
                    <input
                      type="time"
                      className="input py-1.5 text-sm disabled:opacity-40"
                      disabled={!cfg.enabled}
                      value={cfg.start_time}
                      onChange={e => setDayField(day, 'start_time', e.target.value)}
                    />
                    <input
                      type="time"
                      className="input py-1.5 text-sm disabled:opacity-40"
                      disabled={!cfg.enabled}
                      value={cfg.end_time}
                      onChange={e => setDayField(day, 'end_time', e.target.value)}
                    />
                    <select
                      className="input py-1.5 text-sm disabled:opacity-40"
                      disabled={!cfg.enabled}
                      value={cfg.slot_minutes}
                      onChange={e => setDayField(day, 'slot_minutes', Number(e.target.value))}
                    >
                      {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m}m</option>)}
                    </select>
                  </div>
                )
              })}
            </div>

            <div className="text-xs text-gray-400">
              Enabled days will be available for patient online bookings. Disabled days show as unavailable.
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setScheduleDoctor(null)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? 'Saving…' : 'Save Schedule'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
