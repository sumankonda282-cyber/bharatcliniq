import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertCircle } from 'lucide-react'

export default function PinSetup() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pin, setPin]         = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]     = useState('')
  const [saved, setSaved]     = useState(false)

  const isSequential = (p) => {
    for (let i = 0; i < p.length - 1; i++) {
      if (Math.abs(parseInt(p[i+1]) - parseInt(p[i])) !== 1) return false
    }
    return true
  }

  const hasRepeated = (p) => new Set(p).size < 2

  const submit = async e => {
    e.preventDefault(); setError('')
    if (pin.length !== 4)           { setError('PIN must be 4 digits'); return }
    if (isSequential(pin))          { setError('PIN cannot be sequential (e.g. 1234)'); return }
    if (hasRepeated(pin))           { setError('PIN cannot have all same digits'); return }
    if (pin !== confirm)            { setError('PINs do not match'); return }
    try {
      await api.post('/auth/staff/pin-setup', { staff_id: user.id, pin })
      setSaved(true)
      setTimeout(() => navigate('/'), 1500)
    } catch (e) { setError(e?.detail || 'Failed to save PIN') }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-50 p-4">
      <div className="bg-white rounded-2xl shadow-md p-6 w-full max-w-xs space-y-4">
        <h2 className="font-bold text-lg text-emerald-900">Set Documentation PIN</h2>
        <p className="text-sm text-gray-500">Your 4-digit PIN is used to authenticate clinical documentation.</p>
        {saved ? (
          <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 size={18} /> PIN saved successfully!</div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">New PIN (4 digits)</label>
              <input className="input text-center tracking-widest text-lg" type="password"
                inputMode="numeric" maxLength={4} value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} required />
            </div>
            <div>
              <label className="label">Confirm PIN</label>
              <input className="input text-center tracking-widest text-lg" type="password"
                inputMode="numeric" maxLength={4} value={confirm}
                onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))} required />
            </div>
            {error && <div className="flex items-center gap-2 text-red-600 text-sm"><AlertCircle size={14} />{error}</div>}
            <button type="submit" className="w-full py-2 bg-emerald-700 text-white rounded-xl font-semibold hover:bg-emerald-800">
              Save PIN
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
