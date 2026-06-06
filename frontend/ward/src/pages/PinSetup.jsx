import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import api from '../api/client'

function validate(pin) {
  if (pin.length !== 4) return 'PIN must be exactly 4 digits'
  if (all(pin, i => Number(pin[i + 1]) === Number(pin[i]) + 1)) return 'PIN cannot be sequential ascending (e.g. 1234)'
  if (all(pin, i => Number(pin[i]) === Number(pin[i + 1]) + 1)) return 'PIN cannot be sequential descending (e.g. 4321)'
  if (new Set(pin).size === 1) return 'PIN cannot be all the same digit (e.g. 1111)'
  return null
}

function all(pin, fn) {
  return [0, 1, 2].every(fn)
}

export default function PinSetup() {
  const navigate = useNavigate()
  const [step, setStep] = useState('enter') // 'enter' | 'confirm'
  const [firstPin, setFirstPin] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const press = (d) => { if (pin.length < 4) setPin(p => p + d) }
  const back  = () => setPin(p => p.slice(0, -1))

  // Auto-advance when 4 digits entered
  useEffect(() => {
    if (pin.length !== 4) return
    if (step === 'enter') {
      const err = validate(pin)
      if (err) { setError(err); setPin(''); return }
      setFirstPin(pin)
      setPin('')
      setStep('confirm')
      setError('')
    } else {
      // confirm step
      if (pin !== firstPin) {
        setError('PINs do not match. Please try again.')
        setPin('')
        setStep('enter')
        setFirstPin('')
      } else {
        submitPin(pin)
      }
    }
  }, [pin]) // eslint-disable-line react-hooks/exhaustive-deps

  const submitPin = async (finalPin) => {
    setLoading(true); setError('')
    try {
      await api.post('/auth/staff/pin-setup', { pin: finalPin })
      setSuccess(true)
      setTimeout(() => navigate('/ward-setup'), 1500)
    } catch (e) {
      setError(e?.message || 'Failed to set PIN. Please try again.')
      setPin('')
      setStep('enter')
      setFirstPin('')
    } finally {
      setLoading(false)
    }
  }

  const activePinDisplay = step === 'enter' ? pin : pin
  const title = step === 'enter' ? 'Set Your Action PIN' : 'Confirm Your PIN'
  const subtitle = step === 'enter'
    ? 'Your PIN is required before any clinical documentation'
    : 'Re-enter your PIN to confirm'

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#065F46' }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 mx-4">

        {/* Icon + heading */}
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <Shield size={24} className="text-emerald-600" />
          </div>
        </div>

        <h2 className="font-bold text-gray-800 text-center text-lg mb-1">{title}</h2>
        <p className="text-xs text-gray-500 text-center mb-5">{subtitle}</p>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle size={40} className="text-emerald-600" />
            <p className="text-emerald-700 font-semibold">PIN Set Successfully!</p>
            <p className="text-xs text-gray-500">Redirecting to ward setup…</p>
          </div>
        ) : (
          <>
            {/* Step indicator */}
            <div className="flex justify-center gap-2 mb-4">
              <div className={`w-2 h-2 rounded-full ${step === 'enter' ? 'bg-emerald-600' : 'bg-emerald-200'}`} />
              <div className={`w-2 h-2 rounded-full ${step === 'confirm' ? 'bg-emerald-600' : 'bg-gray-200'}`} />
            </div>

            {/* PIN dots */}
            <div className="flex justify-center gap-4 mb-4">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-colors ${
                    activePinDisplay.length > i ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg mb-3">
                <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-600 text-xs">{error}</p>
              </div>
            )}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                <button
                  key={d}
                  onMouseDown={(e) => { e.preventDefault(); press(String(d)) }}
                  className="h-14 rounded-xl bg-gray-50 border border-gray-200 text-xl font-semibold text-gray-800 hover:bg-emerald-50 hover:border-emerald-300 active:scale-95 transition-all"
                >
                  {d}
                </button>
              ))}
              <div /> {/* empty cell */}
              <button
                onMouseDown={(e) => { e.preventDefault(); press('0') }}
                className="h-14 rounded-xl bg-gray-50 border border-gray-200 text-xl font-semibold text-gray-800 hover:bg-emerald-50 hover:border-emerald-300 active:scale-95 transition-all"
              >
                0
              </button>
              <button
                onMouseDown={(e) => { e.preventDefault(); back() }}
                className="h-14 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 text-lg transition-all"
              >
                ⌫
              </button>
            </div>

            {loading && <p className="text-center text-sm text-emerald-600 animate-pulse">Setting PIN…</p>}

            {step === 'confirm' && (
              <button
                onClick={() => { setStep('enter'); setPin(''); setFirstPin(''); setError('') }}
                className="w-full text-xs text-gray-400 hover:text-gray-600 text-center mt-1"
              >
                ← Back to re-enter
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
