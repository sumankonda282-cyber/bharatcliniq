import { createContext, useContext, useState, useRef, useCallback } from 'react'
import api from '../api/client'
import { useAuth } from './AuthContext'
import { X, Delete } from 'lucide-react'

const PinContext = createContext(null)

export function PinProvider({ children }) {
  const { user } = useAuth()
  const [show, setShow]         = useState(false)
  const [pin, setPin]           = useState('')
  const [error, setError]       = useState('')
  const [verifying, setVerifying] = useState(false)
  const resolveRef = useRef(null)
  const rejectRef  = useRef(null)

  const requestPin = useCallback(() => {
    return new Promise((resolve, reject) => {
      resolveRef.current = resolve
      rejectRef.current  = reject
      setPin(''); setError(''); setShow(true)
    })
  }, [])

  const verify = async (p) => {
    setVerifying(true); setError('')
    try {
      const result = await api.post('/auth/staff/pin-verify', { staff_id: user?.id, pin: p })
      if (result.verified) {
        setShow(false); setPin('')
        resolveRef.current?.(result)
      } else {
        setError('Incorrect PIN. Try again.'); setPin('')
      }
    } catch (e) {
      setError(e?.detail || 'PIN verification failed'); setPin('')
    } finally { setVerifying(false) }
  }

  const handleKey = (val) => {
    if (verifying) return
    if (val === 'del') { setPin(p => p.slice(0, -1)); return }
    const next = pin + val
    setPin(next)
    if (next.length === 4) verify(next)
  }

  const cancel = () => {
    setShow(false); setPin(''); setError('')
    rejectRef.current?.(new Error('PIN entry cancelled'))
  }

  return (
    <PinContext.Provider value={{ requestPin }}>
      {children}
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Confirm Identity</h3>
              <button onClick={cancel} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4 text-center">Documenting as <strong>{user?.full_name}</strong></p>

            {/* PIN dots */}
            <div className="flex justify-center gap-3 mb-4">
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 transition-colors ${
                  i < pin.length ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'
                }`} />
              ))}
            </div>

            {error && <p className="text-red-600 text-xs text-center mb-3">{error}</p>}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {['1','2','3','4','5','6','7','8','9','','0','del'].map((k, i) => (
                <button key={i} disabled={verifying || !k}
                  onClick={() => k && handleKey(k)}
                  className={`h-12 rounded-xl text-lg font-semibold transition-colors ${
                    !k ? 'invisible' :
                    k === 'del' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' :
                    'bg-gray-50 text-gray-900 hover:bg-emerald-50 hover:text-emerald-800 active:bg-emerald-100'
                  }`}
                >
                  {k === 'del' ? <Delete size={18} className="mx-auto" /> : k}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </PinContext.Provider>
  )
}

export const usePin = () => useContext(PinContext)
