import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, AlertCircle, CheckCircle, Activity, ClipboardList, BedDouble, KeyRound } from 'lucide-react'

const FEATURES = [
  { icon: Activity,      text: 'Chart patient vitals and track trends in real time' },
  { icon: ClipboardList, text: 'Write nursing notes and complete shift handoffs' },
  { icon: BedDouble,     text: 'Manage the ward board, MAR and ward rounds' },
]

const API = import.meta.env.VITE_API_URL ?? ''

export default function Login() {
  const [form, setForm]       = useState({ identifier: '', password: '' })
  const [showPw, setShowPw]   = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode]       = useState('login') // 'login' | 'forgot'
  const [forgotForm, setForgotForm] = useState({ identifier: '', note: '' })
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const { login } = useAuth()

  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(form.identifier, form.password) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const forgotPassword = () => alert(
    'Password Reset\n\n' +
    'Please contact your clinic administrator or the BHaratCliniq super admin to reset your password.\n\n' +
    'Your new temporary password will be sent to your registered email and phone number.'
  )
  const submitForgot = async e => {
    e.preventDefault()
    setForgotLoading(true)
    try {
      await fetch(`${API}/api/v1/auth/staff/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(forgotForm),
      })
      setForgotSent(true)
    } finally {
      setForgotLoading(false)
    }
  }

  if (mode === 'forgot') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50 p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-3xl font-extrabold text-emerald-800">CareChart</div>
            <div className="text-sm text-emerald-600 mt-1">Ward & Nursing Portal</div>
          </div>
          <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
            {forgotSent ? (
              <div className="text-center space-y-4">
                <CheckCircle className="mx-auto text-emerald-600" size={40} />
                <p className="text-sm text-gray-700">Your request has been sent to your clinic manager. They will provide you with a temporary password.</p>
                <button onClick={() => { setMode('login'); setForgotSent(false); setForgotForm({ identifier: '', note: '' }) }}
                  className="w-full py-2.5 bg-emerald-700 text-white rounded-xl font-semibold hover:bg-emerald-800">
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-semibold text-gray-800">Forgot Password</h2>
                <p className="text-xs text-gray-500">Your request will be sent to your clinic manager who will reset your password.</p>
                <form onSubmit={submitForgot} className="space-y-3">
                  <div>
                    <label className="label">Username / Mobile</label>
                    <input className="input" value={forgotForm.identifier}
                      onChange={e => setForgotForm(f => ({ ...f, identifier: e.target.value }))}
                      placeholder="Enter your username or mobile" required />
                  </div>
                  <div>
                    <label className="label">Note (optional)</label>
                    <input className="input" value={forgotForm.note}
                      onChange={e => setForgotForm(f => ({ ...f, note: e.target.value }))}
                      placeholder="e.g. urgently needed for night shift" />
                  </div>
                  <button type="submit" disabled={forgotLoading}
                    className="w-full py-2.5 bg-emerald-700 text-white rounded-xl font-semibold hover:bg-emerald-800 disabled:opacity-50">
                    {forgotLoading ? 'Sending…' : 'Send Request'}
                  </button>
                  <button type="button" onClick={() => setMode('login')}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
                    Back to Login
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Left branded panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 text-white"
        style={{ background: 'linear-gradient(145deg, #065F46 0%, #047857 100%)' }}
      >
        <div>
          <div className="text-2xl font-extrabold tracking-tight">BHaratCliniq</div>
          <div className="text-xs font-semibold mt-1 tracking-wider uppercase" style={{ color: '#6ee7b7' }}>
            CareChart
          </div>
        </div>
        <div>
          <h2 className="text-4xl font-extrabold leading-tight mb-4">
            Patient Care,<br />
            <span style={{ color: '#6ee7b7' }}>Every Shift.</span>
          </h2>
          <p className="text-emerald-200 text-lg mb-8">
            Chart vitals, write nursing notes, manage medications, and hand off seamlessly — all in one place.
          </p>
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(110,231,183,0.2)' }}
              >
                <Icon size={16} style={{ color: '#6ee7b7' }} />
              </div>
              <span className="text-emerald-100 text-sm">{text}</span>
              <button type="button" onClick={() => setMode('forgot')}
                className="text-xs text-emerald-600 hover:underline mt-1 float-right">
                Forgot password?
              </button>
            </div>
          ))}
        </div>
        <div className="text-xs" style={{ color: '#6ee7b7' }}>BHaratCliniq · CareChart</div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden text-center mb-8">
            <div className="text-2xl font-extrabold" style={{ color: '#065F46' }}>BHaratCliniq</div>
            <div className="text-xs font-semibold tracking-wider uppercase mt-1" style={{ color: '#065F46' }}>
              CareChart
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
            <h2 className="text-2xl font-extrabold mb-1" style={{ color: '#0F2557' }}>CareChart Sign In</h2>
            <p className="text-gray-500 text-sm mb-6">Nursing &amp; clinical ward access</p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Username, Mobile or Email</label>
                <input
                  className="input"
                  placeholder="username, mobile or email"
                  value={form.identifier}
                  onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Password</label>
                  <button
                    type="button"
                    onClick={forgotPassword}
                    className="text-xs flex items-center gap-1 hover:underline"
                    style={{ color: '#CC1414' }}
                  >
                    <KeyRound size={11} /> Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-colors flex items-center justify-center gap-2"
                style={{ background: '#065F46' }}
              >
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…</>
                  : 'Sign In to Ward'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
