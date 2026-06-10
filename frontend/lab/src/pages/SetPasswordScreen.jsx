import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2, Circle, ShieldCheck, LogOut } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'

const ACCENT = '#7C3AED'

const RULES = [
  { key: 'length',  label: '8+ characters',         test: p => p.length >= 8 },
  { key: 'upper',   label: 'One uppercase letter',   test: p => /[A-Z]/.test(p) },
  { key: 'digit',   label: 'One number',             test: p => /\d/.test(p) },
  { key: 'special', label: 'One special character',  test: p => /[!@#$%^&*()\-_=+[\]{}|;:,.<>?]/.test(p) },
]

export default function SetPasswordScreen({ onDone }) {
  const { user, logout } = useAuth()
  const [pw, setPw]           = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [showCf, setShowCf]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const allPassed = RULES.every(r => r.test(pw))
  const matches   = pw === confirm && confirm.length > 0
  const canGo     = allPassed && matches && !saving

  const submit = async e => {
    e.preventDefault()
    if (!canGo) return
    setSaving(true); setError('')
    try {
      await api.post('/auth/staff/set-password', { new_password: pw })
      await onDone()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to set password. Please try again.')
    } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: `${ACCENT}1A` }}>
            <ShieldCheck size={30} style={{ color: ACCENT }} />
          </div>
          <h1 className="text-2xl font-extrabold" style={{ color: '#0F2557' }}>Create Your Password</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Welcome{user?.full_name ? `, ${user.full_name}` : ''}!<br />
            You're signed in with a temporary password.<br />
            Set a personal password to access BH Lab.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 space-y-5">
          {user?.username && (
            <div className="p-3 rounded-xl text-sm flex items-center gap-2 flex-wrap"
              style={{ background: `${ACCENT}0D` }}>
              <span className="text-gray-500 text-xs">Your username:</span>
              <span className="font-mono font-semibold" style={{ color: ACCENT }}>{user.username}</span>
              <span className="text-gray-400 text-xs">— save this for future logins</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  placeholder="Create a strong password"
                  value={pw}
                  onChange={e => { setPw(e.target.value); setError('') }}
                  autoFocus
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {RULES.map(r => {
                const ok       = pw.length > 0 && r.test(pw)
                const touched  = pw.length > 0
                return (
                  <div key={r.key} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                    !touched ? 'bg-gray-50 text-gray-400'
                    : ok ? 'bg-emerald-50 text-violet-700' : 'bg-red-50 text-red-500'
                  }`}>
                    {ok ? <CheckCircle2 size={11} className="flex-shrink-0" /> : <Circle size={11} className="flex-shrink-0" />}
                    {r.label}
                  </div>
                )
              })}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  type={showCf ? 'text' : 'password'}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-1 transition-colors ${
                    confirm.length > 0 ? (matches ? 'border-violet-400 focus:ring-violet-500' : 'border-red-300 focus:ring-red-400') : 'border-gray-200 focus:ring-violet-500 focus:border-violet-500'
                  }`}
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError('') }}
                />
                <button type="button" onClick={() => setShowCf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCf ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirm.length > 0 && !matches && (
                <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
              )}
              {matches && (
                <p className="text-xs text-violet-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Passwords match
                </p>
              )}
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>
            )}

            <button
              type="submit"
              disabled={!canGo}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: ACCENT }}>
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Setting password…</>
                : <><ShieldCheck size={15} />Set Password &amp; Continue</>}
            </button>
          </form>
        </div>

        <button onClick={logout}
          className="flex items-center justify-center gap-1.5 mx-auto mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          <LogOut size={12} /> Sign out
        </button>
        <p className="text-center text-xs text-gray-400 mt-1">
          Need help? Contact your clinic administrator.
        </p>
      </div>
    </div>
  )
}
