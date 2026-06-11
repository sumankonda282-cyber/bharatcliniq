import { useState, useEffect, useCallback } from 'react'
import { X, Save, Plus, Trash2 } from 'lucide-react'
import { doctorApi } from '../../api'
import { useAuth } from '../../contexts/AuthContext'

// ── Tag input helper ─────────────────────────────────────────────
function TagInput({ label, tags, onChange }) {
  const [input, setInput] = useState('')

  const add = () => {
    const val = input.trim()
    if (val && !tags.includes(val)) onChange([...tags, val])
    setInput('')
  }

  const remove = (idx) => onChange(tags.filter((_, i) => i !== idx))

  return (
    <div>
      <label className="block text-xs font-semibold text-blue-200 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ background: '#CC1414' }}
          >
            {tag}
            <button type="button" onClick={() => remove(i)} className="hover:opacity-70">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Type and press Enter"
          className="flex-1 px-3 py-1.5 rounded-lg text-sm text-white placeholder-blue-300 outline-none focus:ring-1 focus:ring-orange-400"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-80"
          style={{ background: '#F5821E' }}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Working hours input ──────────────────────────────────────────
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABELS = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

function WorkingHoursInput({ value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-blue-200 mb-2">Working Hours</label>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {DAYS.map(day => (
          <div key={day} className="flex items-center gap-2">
            <span className="text-xs text-blue-300 w-7">{DAY_LABELS[day]}</span>
            <input
              type="text"
              value={value[day] || ''}
              onChange={e => onChange({ ...value, [day]: e.target.value })}
              placeholder="e.g. 9am-5pm"
              className="flex-1 px-2 py-1 rounded text-xs text-white placeholder-blue-400 outline-none focus:ring-1 focus:ring-orange-400"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Toggle ───────────────────────────────────────────────────────
function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-blue-100">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-orange-500' : 'bg-white/20'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </label>
  )
}

// ── Toast ────────────────────────────────────────────────────────
function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] px-4 py-3 rounded-xl shadow-xl text-sm font-semibold text-white transition-all ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
    >
      {message}
    </div>
  )
}

// ── Main Drawer ──────────────────────────────────────────────────
export default function ProfileDrawer({ open, onClose }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const [form, setForm] = useState({
    bio: '',
    experience_years: 0,
    consultation_fee: 0,
    qualifications: [],
    achievements: [],
    languages: [],
    working_hours: {},
    is_online: false,
    telehealth_available: false,
  })

  const load = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const res = await doctorApi.getProfile()
      const d = res.data || res
      setForm({
        bio:                  d.bio || '',
        experience_years:     d.experience_years || 0,
        consultation_fee:     d.consultation_fee || 0,
        qualifications:       Array.isArray(d.qualifications) ? d.qualifications : [],
        achievements:         Array.isArray(d.achievements) ? d.achievements : [],
        languages:            Array.isArray(d.languages) ? d.languages : [],
        working_hours:        d.working_hours || {},
        is_online:            !!d.is_online,
        telehealth_available: !!d.telehealth_available,
      })
    } catch {
      // silently ignore load errors — form stays empty
    } finally {
      setLoading(false)
    }
  }, [open])

  useEffect(() => { load() }, [load])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await doctorApi.updateProfile(form)
      setToast({ message: 'Profile saved successfully', type: 'success' })
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to save'
      setToast({ message: msg, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-80 z-50 flex flex-col shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: '#0F2557' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <span className="text-white font-semibold text-sm">My Profile</span>
          <button
            onClick={onClose}
            className="text-blue-300 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
            style={{ background: '#F5821E' }}
          >
            {initials}
          </div>
          <div>
            <div className="text-white font-semibold text-sm">{user?.full_name}</div>
            <div className="text-xs text-blue-300 capitalize">{user?.role?.replace(/_/g, ' ')}</div>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <div className="text-blue-300 text-sm text-center py-8">Loading…</div>
          ) : (
            <>
              {/* Bio */}
              <div>
                <label className="block text-xs font-semibold text-blue-200 mb-1">Bio</label>
                <textarea
                  rows={3}
                  value={form.bio}
                  onChange={e => set('bio', e.target.value)}
                  placeholder="A brief description about yourself"
                  className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-blue-400 outline-none focus:ring-1 focus:ring-orange-400 resize-none"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                />
              </div>

              {/* Experience + Fee */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">Experience (yrs)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.experience_years}
                    onChange={e => set('experience_years', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-orange-400"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">Consult Fee (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.consultation_fee}
                    onChange={e => set('consultation_fee', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-orange-400"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                  />
                </div>
              </div>

              <TagInput
                label="Qualifications"
                tags={form.qualifications}
                onChange={v => set('qualifications', v)}
              />

              <TagInput
                label="Achievements"
                tags={form.achievements}
                onChange={v => set('achievements', v)}
              />

              <TagInput
                label="Languages"
                tags={form.languages}
                onChange={v => set('languages', v)}
              />

              <WorkingHoursInput
                value={form.working_hours}
                onChange={v => set('working_hours', v)}
              />

              {/* Toggles */}
              <div className="space-y-3 pt-1">
                <Toggle
                  label="Online / Available now"
                  checked={form.is_online}
                  onChange={v => set('is_online', v)}
                />
                <Toggle
                  label="Telehealth available"
                  checked={form.telehealth_available}
                  onChange={v => set('telehealth_available', v)}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#CC1414' }}
          >
            <Save size={15} />
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </>
  )
}
