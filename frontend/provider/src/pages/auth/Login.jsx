import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Activity, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function Login() {
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [isPlatform, setIsPlatform] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.identifier, form.password, isPlatform)
      if (user.user_type === 'platform_admin') navigate('/platform')
      else navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Activity size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">BharatCliniq</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isPlatform ? 'Platform Administration' : 'Provider Portal — Staff Login'}
          </p>
        </div>

        <div className="card p-8 shadow-lg">
          {/* Toggle */}
          <div className="flex rounded-lg bg-gray-100 p-1 mb-6 text-sm">
            <button
              type="button"
              onClick={() => setIsPlatform(false)}
              className={`flex-1 py-1.5 rounded-md font-medium transition-all ${!isPlatform ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              Clinic Staff
            </button>
            <button
              type="button"
              onClick={() => setIsPlatform(true)}
              className={`flex-1 py-1.5 rounded-md font-medium transition-all ${isPlatform ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              Platform Admin
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email or Mobile</label>
              <input
                className="input"
                placeholder="doctor@clinic.com or 9876543210"
                value={form.identifier}
                onChange={set('identifier')}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set('password')}
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
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Clinic not yet registered?{' '}
            <a href="https://bharatcliniq.com/register" className="text-blue-600 hover:underline">
              Register your clinic
            </a>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          BharatCliniq v2 · Provider Portal
        </p>
      </div>
    </div>
  )
}
