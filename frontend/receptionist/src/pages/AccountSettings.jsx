import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, CheckCircle, AlertCircle, KeyRound, Lock, LogOut } from 'lucide-react'

const API = import.meta.env.VITE_API_URL ?? ''
const ACCENT = '#1e3a5f'

function useApi() {
  const { token } = useAuth()
  return (url, opts = {}) => fetch(`${API}${url}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Error'); return d })
}

function ChangePasswordForm() {
  const api = useApi()
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [show, setShow] = useState({ cur: false, nw: false, cn: false })
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    if (form.new_password !== form.confirm) { setStatus({ ok: false, msg: 'Passwords do not match' }); return }
    setLoading(true); setStatus(null)
    try {
      const r = await api('/api/v1/auth/staff/change-password', { method: 'POST', body: JSON.stringify({ current_password: form.current_password, new_password: form.new_password }) })
      setStatus({ ok: true, msg: r.message }); setForm({ current_password: '', new_password: '', confirm: '' })
    } catch (e) { setStatus({ ok: false, msg: e.message }) }
    finally { setLoading(false) }
  }

  const fields = [
    { key: 'current_password', label: 'Current Password', sk: 'cur' },
    { key: 'new_password', label: 'New Password', sk: 'nw' },
    { key: 'confirm', label: 'Confirm New Password', sk: 'cn' },
  ]

  return (
    <form onSubmit={submit} className="space-y-3">
      {fields.map(f => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
          <div className="relative">
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-200"
              type={show[f.sk] ? 'text' : 'password'} value={form[f.key]}
              onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} required />
            <button type="button" onClick={() => setShow(s => ({ ...s, [f.sk]: !s[f.sk] }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {show[f.sk] ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-400">Min 8 chars — uppercase, lowercase, number, special character</p>
      {status && (
        <div className={`flex items-center gap-2 p-2 rounded-xl text-sm ${status.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {status.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}{status.msg}
        </div>
      )}
      <button type="submit" disabled={loading}
        className="w-full py-2 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
        style={{ background: ACCENT }}>
        {loading ? 'Changing…' : 'Change Password'}
      </button>
    </form>
  )
}

function PinManagement() {
  const api = useApi()
  const [pinStatus, setPinStatus] = useState(null)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { api('/api/v1/auth/staff/pin-status').then(setPinStatus).catch(() => {}) }, [])

  const save = async e => {
    e.preventDefault(); setLoading(true); setMsg(null)
    try {
      const r = await api('/api/v1/auth/staff/pin-setup', { method: 'POST', body: JSON.stringify({ pin }) })
      setMsg({ ok: true, msg: r.detail }); setPin('')
      api('/api/v1/auth/staff/pin-status').then(setPinStatus).catch(() => {})
    } catch (e) { setMsg({ ok: false, msg: e.message }) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      {pinStatus && (
        <div className="text-xs text-gray-500 space-y-1">
          <div>PIN: <span className={pinStatus.has_pin ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>{pinStatus.has_pin ? 'Set' : 'Not set'}</span></div>
          {pinStatus.pin_reset_required && <div className="text-amber-600 font-medium">PIN reset required by manager</div>}
          {pinStatus.is_locked && <div className="text-red-600">PIN locked until {new Date(pinStatus.locked_until).toLocaleTimeString()}</div>}
        </div>
      )}
      <form onSubmit={save} className="space-y-2">
        <label className="block text-xs font-medium text-gray-600">{pinStatus?.has_pin ? 'Change PIN' : 'Set PIN'}</label>
        <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          type="password" maxLength={4} inputMode="numeric" pattern="[0-9]{4}"
          placeholder="4-digit PIN" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} required />
        <p className="text-xs text-gray-400">Cannot be sequential (1234) or repeated (1111)</p>
        {msg && (
          <div className={`flex items-center gap-2 p-2 rounded-xl text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}{msg.msg}
          </div>
        )}
        <button type="submit" disabled={loading || pin.length !== 4}
          className="w-full py-2 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
          style={{ background: ACCENT }}>
          {loading ? 'Saving…' : pinStatus?.has_pin ? 'Change PIN' : 'Set PIN'}
        </button>
      </form>
    </div>
  )
}

function LogoutAll() {
  const api = useApi()
  const { logout } = useAuth()
  const [loading, setLoading] = useState(false)
  const go = async () => {
    if (!confirm('Log out from all devices?')) return
    setLoading(true)
    try { await api('/api/v1/auth/staff/logout', { method: 'POST' }); logout() }
    catch (e) { alert(e.message) }
    finally { setLoading(false) }
  }
  return (
    <button onClick={go} disabled={loading}
      className="w-full py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-100 disabled:opacity-50">
      <LogOut size={14} />{loading ? 'Logging out…' : 'Log Out From All Devices'}
    </button>
  )
}

export default function AccountSettings() {
  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Account Settings</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4"><Lock size={16} style={{ color: ACCENT }} /><h2 className="font-semibold text-gray-800">Change Password</h2></div>
        <ChangePasswordForm />
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4"><KeyRound size={16} style={{ color: ACCENT }} /><h2 className="font-semibold text-gray-800">PIN Management</h2></div>
        <PinManagement />
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Session Security</h2>
        <LogoutAll />
      </div>
    </div>
  )
}
