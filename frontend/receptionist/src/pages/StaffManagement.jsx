import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { cacheInvalidate } from '../utils/cache'
import {
  PlusCircle, Eye, EyeOff, AlertCircle, CheckCircle,
  ToggleLeft, ToggleRight, Pencil, X, Loader2, Users,
  Building2, Shield, BookOpen, Phone, Info,
} from 'lucide-react'

const ROLES = [
  { value: 'receptionist',   label: 'Receptionist' },
  { value: 'doctor',         label: 'Doctor' },
  { value: 'nurse',          label: 'Nurse' },
  { value: 'pharmacist',     label: 'Pharmacist' },
  { value: 'lab_technician', label: 'Lab Technician' },
  { value: 'imaging_tech',   label: 'Imaging Technician' },
  { value: 'clinic_manager', label: 'Clinic Manager' },
  { value: 'clinic_admin',   label: 'Admin' },
]

const PORTAL_MAP = {
  doctor:          ['Provider Portal', 'CareChart App'],
  receptionist:    ['Staff Portal (Reception)'],
  pharmacist:      ['Pharmacy Portal', 'CareChart App'],
  lab_technician:  ['Lab Portal', 'CareChart App'],
  imaging_tech:    ['Imaging Portal', 'CareChart App'],
  nurse:           ['CareChart App'],
  clinic_manager:  ['Staff Portal (Manager View)'],
  clinic_admin:    ['All Portals'],
}

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'visiting']
const GENDERS = ['male', 'female', 'other']

const ROLE_BADGE = {
  receptionist:  'bg-blue-100 text-blue-800',
  doctor:        'bg-purple-100 text-purple-800',
  nurse:         'bg-teal-100 text-teal-800',
  pharmacist:    'bg-amber-100 text-amber-800',
  lab_technician:'bg-orange-100 text-orange-800',
  imaging_tech:  'bg-rose-100 text-rose-800',
  clinic_manager:'bg-indigo-100 text-indigo-800',
  clinic_admin:  'bg-gray-100 text-gray-800',
}

const EMPTY_FORM = {
  full_name: '', gender: '', date_of_birth: '',
  email: '', mobile: '', emergency_contact_name: '', emergency_contact_mobile: '', address: '',
  employee_id: '', designation: '', department: '', ward: '',
  employment_type: 'full_time', join_date: '', reporting_manager_id: '',
  role: 'receptionist', secondary_roles: [], password: '',
  qualification: '', registration_number: '', license_expiry_date: '',
  scheduled_removal_date: '', removal_reason: '',
}

const TABS = [
  { id: 'identity',      label: 'Identity',    icon: Users },
  { id: 'job',          label: 'Job Details',  icon: Building2 },
  { id: 'professional', label: 'Professional', icon: BookOpen },
  { id: 'contact',      label: 'Contact',      icon: Phone },
  { id: 'access',       label: 'Access',       icon: Shield },
]

function getPortals(primaryRole, secondaryRoles) {
  const all = [
    ...(PORTAL_MAP[primaryRole] || []),
    ...(secondaryRoles || []).flatMap(r => PORTAL_MAP[r] || []),
  ]
  return [...new Set(all)]
}

export default function StaffManagement() {
  const [staff, setStaff]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [tab, setTab]             = useState('identity')
  const [showPw, setShowPw]       = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [togglingId, setTogglingId] = useState(null)
  const [filterName, setFilterName]   = useState('')
  const [filterRole, setFilterRole]   = useState('')
  const [filterDept, setFilterDept]   = useState('')
  const [filterType, setFilterType]   = useState('')

  const load = useCallback(async (invalidate = false) => {
    setLoading(true)
    if (invalidate) await cacheInvalidate('recep_staff_list')
    try {
      const data = await api.get('/clinic/staff')
      setStaff(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setTab('identity')
    setError('')
    setSuccess('')
    setModalOpen(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({
      full_name: s.full_name || '',
      gender: s.gender || '',
      date_of_birth: s.date_of_birth || '',
      email: s.email || '',
      mobile: s.mobile || '',
      emergency_contact_name: s.emergency_contact_name || '',
      emergency_contact_mobile: s.emergency_contact_mobile || '',
      address: s.address || '',
      employee_id: s.employee_id || '',
      designation: s.designation || '',
      department: s.department || '',
      ward: s.ward || '',
      employment_type: s.employment_type || 'full_time',
      join_date: s.join_date || '',
      reporting_manager_id: s.reporting_manager_id || '',
      role: s.role || 'receptionist',
      secondary_roles: Array.isArray(s.secondary_roles) ? s.secondary_roles : [],
      password: '',
      qualification: s.qualification || '',
      registration_number: s.registration_number || '',
      license_expiry_date: s.license_expiry_date || '',
      scheduled_removal_date: s.scheduled_removal_date || '',
      removal_reason: s.removal_reason || '',
    })
    setTab('identity')
    setError('')
    setSuccess('')
    setModalOpen(true)
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const toggleSecondaryRole = (role) => {
    const current = form.secondary_roles || []
    f('secondary_roles', current.includes(role) ? current.filter(r => r !== role) : [...current, role])
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password
      if (payload.reporting_manager_id === '') payload.reporting_manager_id = null
      else if (payload.reporting_manager_id) payload.reporting_manager_id = Number(payload.reporting_manager_id)
      if (!payload.date_of_birth) payload.date_of_birth = null
      if (!payload.join_date) payload.join_date = null
      if (!payload.license_expiry_date) payload.license_expiry_date = null
      if (!payload.scheduled_removal_date) payload.scheduled_removal_date = null
      if (!payload.removal_reason) payload.removal_reason = null
      if (!Array.isArray(payload.secondary_roles)) payload.secondary_roles = []

      if (editing) {
        await api.put(`/clinic/staff/${editing.id}`, payload)
        setSuccess(`${form.full_name} updated.`)
      } else {
        await api.post('/clinic/staff', payload)
        setSuccess(`${form.full_name} added successfully.`)
      }
      setModalOpen(false)
      load(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (s) => {
    setTogglingId(s.id)
    try {
      await api.put(`/clinic/staff/${s.id}/toggle`)
      load(true)
    } catch (err) {
      alert(err.message)
    } finally {
      setTogglingId(null)
    }
  }

  const managers = staff.filter(s => ['clinic_manager', 'clinic_admin'].includes(s.role))

  const hasFilters = filterName || filterRole || filterDept || filterType
  const filtered = staff.filter(s => {
    if (filterName && !s.full_name?.toLowerCase().includes(filterName.toLowerCase()) &&
        !s.employee_id?.toLowerCase().includes(filterName.toLowerCase())) return false
    if (filterRole && s.role !== filterRole) return false
    if (filterDept && !s.department?.toLowerCase().includes(filterDept.toLowerCase())) return false
    if (filterType && s.employment_type !== filterType) return false
    return true
  })

  const derivedPortals = getPortals(form.role, form.secondary_roles)

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Manage Staff</h1>
          <p className="text-sm text-gray-500 mt-0.5">{staff.length} staff members · click a row to edit</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm">
          <PlusCircle size={15} />Add Staff
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          <CheckCircle size={15} />{success}
        </div>
      )}

      {/* Smart filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-200 w-48"
          placeholder="Name or employee ID…"
          value={filterName}
          onChange={e => setFilterName(e.target.value)}
        />
        <select
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-200"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
        >
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <input
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-200 w-36"
          placeholder="Department…"
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
        />
        <select
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-200"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">All Types</option>
          {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setFilterName(''); setFilterRole(''); setFilterDept(''); setFilterType('') }}
            className="btn-secondary text-xs py-1 px-3 flex items-center gap-1"
          >
            <X size={12} />Clear
          </button>
        )}
        {hasFilters && (
          <span className="text-xs text-gray-400 self-center">{filtered.length} of {staff.length}</span>
        )}
      </div>

      {/* Staff table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No staff found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider text-left">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role / Designation</th>
                  <th className="px-4 py-3">Department / Ward</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(s)}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">{s.full_name}</div>
                      {s.employee_id && <div className="text-xs text-gray-400">ID: {s.employee_id}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${ROLE_BADGE[s.role] || 'bg-gray-100 text-gray-600'}`}>
                        {s.role?.replace(/_/g, ' ')}
                      </span>
                      {Array.isArray(s.secondary_roles) && s.secondary_roles.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.secondary_roles.map(r => (
                            <span key={r} className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                              +{r.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                      {s.designation && <div className="text-xs text-gray-500 mt-0.5">{s.designation}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {s.department && <div>{s.department}</div>}
                      {s.ward && <div className="text-gray-400">{s.ward}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <div>{s.email || '—'}</div>
                      <div>{s.mobile || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">
                      {s.employment_type?.replace('_', ' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleActive(s)} disabled={togglingId === s.id} className="text-gray-400 hover:text-gray-700 disabled:opacity-50">
                        {s.is_active ? <ToggleRight size={22} className="text-green-500" /> : <ToggleLeft size={22} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-indigo-600 p-1">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl z-10 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{editing ? `Edit: ${editing.full_name}` : 'Add New Staff Member'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>

            <div className="flex gap-1 px-6 pt-3 border-b border-gray-100 overflow-x-auto">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-colors ${tab === id ? 'text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                  style={tab === id ? { background: '#0F2557' } : {}}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto">
              <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

                {tab === 'identity' && (<>
                  <div className="sm:col-span-2">
                    <label className="label">Full Name *</label>
                    <input className="input" required placeholder="Dr. / Mr. / Ms. Full Name"
                      value={form.full_name} onChange={e => f('full_name', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Gender</label>
                    <select className="input" value={form.gender} onChange={e => f('gender', e.target.value)}>
                      <option value="">Select…</option>
                      {GENDERS.map(g => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Date of Birth</label>
                    <input type="date" className="input" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} />
                  </div>
                </>)}

                {tab === 'job' && (<>
                  <div>
                    <label className="label">Employee ID</label>
                    <input className="input" placeholder="EMP001" value={form.employee_id} onChange={e => f('employee_id', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Designation</label>
                    <input className="input" placeholder="e.g. Head Nurse, Resident Doctor" value={form.designation} onChange={e => f('designation', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Department</label>
                    <input className="input" placeholder="e.g. Emergency, ICU, OPD" value={form.department} onChange={e => f('department', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Ward</label>
                    <input className="input" placeholder="e.g. Ward 3, ICU Block A" value={form.ward} onChange={e => f('ward', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Employment Type</label>
                    <select className="input" value={form.employment_type} onChange={e => f('employment_type', e.target.value)}>
                      {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Join Date</label>
                    <input type="date" className="input" value={form.join_date} onChange={e => f('join_date', e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Reporting Manager</label>
                    <select className="input" value={form.reporting_manager_id} onChange={e => f('reporting_manager_id', e.target.value)}>
                      <option value="">None</option>
                      {managers.filter(m => !editing || m.id !== editing.id).map(m => (
                        <option key={m.id} value={m.id}>{m.full_name} ({m.role?.replace(/_/g, ' ')})</option>
                      ))}
                    </select>
                  </div>
                </>)}

                {tab === 'professional' && (<>
                  <div className="sm:col-span-2">
                    <label className="label">Qualification</label>
                    <input className="input" placeholder="e.g. MBBS, MD, B.Sc Nursing, GNM" value={form.qualification} onChange={e => f('qualification', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Registration / License Number</label>
                    <input className="input" placeholder="NMC / MCI / Council number" value={form.registration_number} onChange={e => f('registration_number', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">License Expiry Date</label>
                    <input type="date" className="input" value={form.license_expiry_date} onChange={e => f('license_expiry_date', e.target.value)} />
                  </div>
                </>)}

                {tab === 'contact' && (<>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input" placeholder="staff@clinic.com" value={form.email} onChange={e => f('email', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Mobile</label>
                    <input className="input" placeholder="10-digit mobile" value={form.mobile} onChange={e => f('mobile', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Emergency Contact Name</label>
                    <input className="input" placeholder="Next of kin" value={form.emergency_contact_name} onChange={e => f('emergency_contact_name', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Emergency Contact Mobile</label>
                    <input className="input" placeholder="10-digit mobile" value={form.emergency_contact_mobile} onChange={e => f('emergency_contact_mobile', e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Address</label>
                    <textarea className="input" rows={2} placeholder="Residential address" value={form.address} onChange={e => f('address', e.target.value)} />
                  </div>
                </>)}

                {tab === 'access' && (<>
                  <div>
                    <label className="label">Primary Role *</label>
                    <select className="input" value={form.role} onChange={e => {
                      const newRole = e.target.value
                      f('role', newRole)
                      f('secondary_roles', (form.secondary_roles || []).filter(r => r !== newRole))
                    }}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="label">{editing ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                    <div className="relative">
                      <input className="input pr-10" type={showPw ? 'text' : 'password'}
                        required={!editing} placeholder="Minimum 6 characters"
                        value={form.password} onChange={e => f('password', e.target.value)} />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {!editing && <p className="text-xs text-gray-400 mt-1">Share privately — staff changes it on first login.</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="label">Additional Roles <span className="text-gray-400 font-normal">(optional — for staff with multiple responsibilities)</span></label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">
                      {ROLES.filter(r => r.value !== form.role).map(r => (
                        <label key={r.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            checked={(form.secondary_roles || []).includes(r.value)}
                            onChange={() => toggleSecondaryRole(r.value)}
                          />
                          {r.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="label flex items-center gap-1">
                      <Info size={12} className="text-gray-400" />
                      Portal Access (auto-derived from roles)
                    </label>
                    <div className="flex flex-wrap gap-2 mt-1.5 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      {derivedPortals.length > 0 ? derivedPortals.map(portal => (
                        <span key={portal} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg border border-blue-100">
                          {portal}
                        </span>
                      )) : (
                        <span className="text-xs text-gray-400">No portals assigned</span>
                      )}
                      {form.role === 'nurse' && (form.secondary_roles || []).length === 0 && (
                        <p className="w-full text-xs text-amber-600 mt-1">
                          Nurses access CareChart (mobile app) only. Assign an additional role for portal access.
                        </p>
                      )}
                    </div>
                  </div>

                  {editing && (
                    <div className="sm:col-span-2 border-t border-gray-100 pt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Scheduled Removal</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="label">Removal Date</label>
                          <input type="date" className="input" value={form.scheduled_removal_date} onChange={e => f('scheduled_removal_date', e.target.value)} />
                          <p className="text-xs text-gray-400 mt-1">Staff will be auto-deactivated on this date.</p>
                        </div>
                        <div>
                          <label className="label">Reason</label>
                          <input className="input" placeholder="Resignation, contract end, etc." value={form.removal_reason} onChange={e => f('removal_reason', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  )}
                </>)}
              </div>

              {error && (
                <div className="mx-6 mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{error}
                </div>
              )}

              <div className="px-6 pb-5 flex justify-between items-center border-t border-gray-100 pt-4">
                <div className="flex gap-1">
                  {TABS.map((t) => (
                    <button key={t.id} type="button" onClick={() => setTab(t.id)}
                      className={`w-2 h-2 rounded-full transition-colors ${tab === t.id ? 'bg-indigo-900' : 'bg-gray-200'}`} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary text-sm">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    {editing ? 'Save Changes' : 'Add Staff Member'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
