import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-extrabold text-emerald-800">CareChart</div>
          <div className="text-sm text-emerald-600 mt-1">Ward & Nursing Portal</div>
        </div>
        <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Username / Mobile / Email</label>
              <input className="input" autoFocus value={form.identifier}
                onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input className="input pr-10" type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle size={14} />{error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-emerald-700 text-white rounded-xl font-semibold hover:bg-emerald-800 disabled:opacity-50">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
