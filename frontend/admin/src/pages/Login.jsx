import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { ShieldCheck, Loader2, Building2, BarChart3, ClipboardList, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function Login() {
  const { user, login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  if (user) return <Navigate to="/dashboard" replace />

  const submit = async e => {
    e.preventDefault()
    setLoading(true); setError('')
    try { await login(identifier, password) }
    catch (ex) { setError(ex.message) }
    finally { setLoading(false) }
  }

  const features = [
    { icon: Building2,     text: 'Manage all clinics and their subscriptions' },
    { icon: ShieldCheck,   text: 'Approve staff verification requests' },
    { icon: BarChart3,     text: 'View platform-wide reports and MRR' },
    { icon: ClipboardList, text: 'Full audit log across all operations' },
  ]

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Left branded panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 text-white"
        style={{ background: 'linear-gradient(145deg, #0F2557 0%, #1a3a7a 100%)' }}
      >
        <div>
          <div className="text-2xl font-extrabold tracking-tight">BHarath Health</div>
          <div className="text-xs font-semibold mt-1 tracking-widest uppercase" style={{ color: '#F5821E' }}>
            Super Admin Portal
          </div>
        </div>
        <div>
          <h2 className="text-4xl font-extrabold leading-tight mb-4">
            Platform Control,<br />
            <span style={{ color: '#F5821E' }}>At Your Fingertips.</span>
          </h2>
          <p className="text-blue-200 text-lg mb-8">
            Oversee every clinic, subscription, and staff member across the BHarath Health network.
          </p>
          {features.map(({ icon: Icon, text }) => (
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
        <div className="text-xs" style={{ color: '#93c5fd' }}>
          BHarath Health · Super Admin Portal · Restricted Access
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: '#0f172a' }}>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
              style={{ background: 'rgba(15,37,87,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <ShieldCheck size={28} style={{ color: '#F5821E' }} />
            </div>
            <div className="text-xl font-extrabold text-white">BHarath Health</div>
            <div className="text-xs font-semibold tracking-widest uppercase mt-1" style={{ color: '#F5821E' }}>
              Super Admin Portal
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            {/* Desktop heading */}
            <div className="hidden lg:flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(245,130,30,0.15)' }}>
                <ShieldCheck size={20} style={{ color: '#F5821E' }} />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white leading-none">Admin Sign In</h2>
                <p className="text-gray-500 text-xs mt-0.5">Restricted to authorised administrators</p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Username or Email</label>
                <input
                  className="input"
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  required
                  autoFocus
                  placeholder="admin@bharathhealthsystems.com"
                />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl text-red-400 text-sm"
                  style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)' }}>
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-colors flex items-center justify-center gap-2"
                style={{ background: '#0F2557' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#0a1a3e' }}
                onMouseLeave={e => e.currentTarget.style.background = '#0F2557'}
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" />Signing in…</>
                  : <><ShieldCheck size={16} />Sign In to Admin</>}
              </button>
            </form>
          </div>
          <p className="text-center text-gray-600 text-xs mt-4">
            Access restricted to authorised BHarath Health administrators only
          </p>
        </div>
      </div>
    </div>
  )
}
