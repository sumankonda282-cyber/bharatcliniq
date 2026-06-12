import { useState, useEffect } from 'react'
import { X, User, Briefcase, Lock, Loader2, CheckCircle2 } from 'lucide-react'
import api from '../api/client'

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function formatRole(r) {
  if (!r) return 'Staff'
  return r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const TABS = [
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'work',     label: 'Work',     icon: Briefcase },
  { id: 'security', label: 'Security', icon: Lock },
]

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1'
const roInputCls = 'w-full px-3 py-2 text-sm border border-gray-100 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed'

export default function StaffProfilePanel({ open, onClose }) {
  const [tab, setTab] = useState('personal')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  const [form, setForm] = useState({
    full_name: '', mobile: '', phone: '', gender: '',
    date_of_birth: '', address: '',
    emergency_contact_name: '', emergency_contact_mobile: '',
  })

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwErr, setPwErr] = useState('')
  const [pwOk, setPwOk] = useState(false)

  useEffect(() => {
    if (!open) return
    setTab('personal'); setErr(''); setSaved(false)
    setLoading(true)
    api.get('/auth/staff/me').then(d => {
      setProfile(d)
      setForm({
        full_name: d.full_name || '',
        mobile: d.mobile || '',
        phone: d.phone || '',
        gender: d.gender || '',
        date_of_birth: d.date_of_birth || '',
        address: d.address || '',
        emergency_contact_name: d.emergency_contact_name || '',
        emergency_contact_mobile: d.emergency_contact_mobile || '',
      })
    }).catch(() => setErr('Failed to load profile')).finally(() => setLoading(false))
  }, [open])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const saveProfile = async () => {
    setSaving(true); setErr(''); setSaved(false)
    try {
      await api.patch('/auth/staff/me', form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Save failed')
    }
    setSaving(false)
  }

  const savePassword = async () => {
    if (pw.next !== pw.confirm) { setPwErr('Passwords do not match'); return }
    if (pw.next.length < 6) { setPwErr('Password must be at least 6 characters'); return }
    setPwSaving(true); setPwErr('')
    try {
      await api.post('/auth/staff/change-password', { current_password: pw.current, new_password: pw.next })
      setPwOk(true); setPw({ current: '', next: '', confirm: '' })
      setTimeout(() => setPwOk(false), 4000)
    } catch (e) {
      setPwErr(e?.response?.data?.detail || 'Failed to update password')
    }
    setPwSaving(false)
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0"
          style={{ background: '#0F2557' }}>
          <div className="flex items-center gap-3">
            {profile && (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: 'rgba(245,130,30,0.3)', color: '#F5821E' }}>
                {getInitials(profile.full_name || profile.email)}
              </div>
            )}
            <div>
              <div className="text-white font-semibold text-sm">{profile?.full_name || '—'}</div>
              <div className="text-blue-300 text-xs">{formatRole(profile?.role)}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0 bg-white">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* ── Personal ─────────────────────── */}
            {tab === 'personal' && (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Full Name</label>
                    <input className={inputCls} value={form.full_name} onChange={e => set('full_name', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Mobile</label>
                    <input className={inputCls} value={form.mobile} onChange={e => set('mobile', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Alternate Phone</label>
                    <input className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Date of Birth</label>
                    <input type="date" className={inputCls} value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Gender</label>
                    <select className={inputCls} value={form.gender} onChange={e => set('gender', e.target.value)}>
                      <option value="">— select —</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Email</label>
                    <input className={roInputCls} value={profile?.email || '—'} readOnly />
                    <p className="text-xs text-gray-400 mt-1">Contact admin to change email</p>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Address</label>
                    <textarea rows={2} className={inputCls + ' resize-none'} value={form.address} onChange={e => set('address', e.target.value)} />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Emergency Contact</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Name</label>
                      <input className={inputCls} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Mobile</label>
                      <input className={inputCls} value={form.emergency_contact_mobile} onChange={e => set('emergency_contact_mobile', e.target.value)} />
                    </div>
                  </div>
                </div>

                {err && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{err}</p>}
                {saved && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                    <CheckCircle2 size={14} /> Profile saved successfully
                  </div>
                )}
              </div>
            )}

            {/* ── Work ─────────────────────────── */}
            {tab === 'work' && (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Role</label>
                    <input className={roInputCls} value={formatRole(profile?.role)} readOnly />
                  </div>
                  <div>
                    <label className={labelCls}>Employee ID</label>
                    <input className={roInputCls} value={profile?.employee_id || '—'} readOnly />
                  </div>
                  <div>
                    <label className={labelCls}>Designation</label>
                    <input className={roInputCls} value={profile?.designation || '—'} readOnly />
                  </div>
                  <div>
                    <label className={labelCls}>Department</label>
                    <input className={roInputCls} value={profile?.department || '—'} readOnly />
                  </div>
                  <div>
                    <label className={labelCls}>Employment Type</label>
                    <input className={roInputCls} value={profile?.employment_type || '—'} readOnly />
                  </div>
                  <div>
                    <label className={labelCls}>Date of Joining</label>
                    <input className={roInputCls} value={profile?.join_date || '—'} readOnly />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Reports To</label>
                    <input className={roInputCls} value={profile?.reporting_manager_name || '—'} readOnly />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Qualification</label>
                    <input className={roInputCls} value={profile?.qualification || '—'} readOnly />
                  </div>
                  <div>
                    <label className={labelCls}>Clinic</label>
                    <input className={roInputCls} value={profile?.clinic_name || '—'} readOnly />
                  </div>
                </div>
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                  Work details are managed by clinic administration. Contact your manager to update these fields.
                </p>
              </div>
            )}

            {/* ── Security ─────────────────────── */}
            {tab === 'security' && (
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Current Password</label>
                    <input type="password" className={inputCls} placeholder="Enter current password"
                      value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>New Password</label>
                    <input type="password" className={inputCls} placeholder="Minimum 6 characters"
                      value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Confirm New Password</label>
                    <input type="password" className={inputCls} placeholder="Re-enter new password"
                      value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
                  </div>
                  {pwErr && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{pwErr}</p>}
                  {pwOk && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                      <CheckCircle2 size={14} /> Password updated successfully
                    </div>
                  )}
                  <button
                    onClick={savePassword}
                    disabled={pwSaving || !pw.current || pw.next.length < 6}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
                    {pwSaving && <Loader2 size={14} className="animate-spin" />}
                    {pwSaving ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer save (only personal tab) */}
        {tab === 'personal' && !loading && (
          <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-white">
            <button onClick={saveProfile} disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
