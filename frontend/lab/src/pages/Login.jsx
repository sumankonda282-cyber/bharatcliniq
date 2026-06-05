import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, AlertCircle, FlaskConical, Microscope, ClipboardList, KeyRound } from 'lucide-react'

const FEATURES = [
  { icon: FlaskConical,  text: 'View & process incoming lab test orders' },
  { icon: Microscope,    text: 'Enter and verify patient test results' },
  { icon: ClipboardList, text: 'Manage test catalog and pricing' },
]

export default function Login() {
  const [form, setForm]       = useState({ identifier: '', password: '' })
  const [showPw, setShowPw]   = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
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

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Left branded panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 text-white"
        style={{ background: 'linear-gradient(145deg, #0F2557 0%, #1a3a7a 100%)' }}
      >
        <div>
          <div className="text-2xl font-extrabold tracking-tight">BHaratCliniq</div>
          <div className="text-xs font-semibold mt-1 tracking-wider uppercase" style={{ color: '#F5821E' }}>
            Laboratory Portal
          </div>
        </div>
        <div>
          <h2 className="text-4xl font-extrabold leading-tight mb-4">
            Lab Results,<br />
            <span style={{ color: '#F5821E' }}>Delivered Fast.</span>
          </h2>
          <p className="text-blue-200 text-lg mb-8">
            Process test orders, enter results, and deliver digital reports — all in one workflow.
          </p>
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(245,130,30,0.2)' }}
              >
                <Icon size={16} style={{ color: '#F5821E' }} />
              </div>
              <span className="text-blue-100 text-sm">{text}</span>
            </div>
          ))}
        </div>
        <div className="text-xs" style={{ color: '#93c5fd' }}>BHaratCliniq · Laboratory Portal</div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden text-center mb-8">
            <div className="text-2xl font-extrabold" style={{ color: '#0F2557' }}>BHaratCliniq</div>
            <div className="text-xs font-semibold tracking-wider uppercase mt-1" style={{ color: '#F5821E' }}>
              Laboratory Portal
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
            <h2 className="text-2xl font-extrabold mb-1" style={{ color: '#0F2557' }}>Lab Sign In</h2>
            <p className="text-gray-500 text-sm mb-6">Lab technician access</p>

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
                style={{ background: '#0F2557' }}
              >
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…</>
                  : 'Sign In to Lab'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
