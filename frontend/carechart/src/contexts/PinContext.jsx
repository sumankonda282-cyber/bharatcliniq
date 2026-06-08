import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useAuth } from './AuthContext'

const PinContext = createContext(null)

function PinModal({ reason, onVerify, onCancel, loading, error, pin, setPin, staffName }) {
  const press = (d) => { if (pin.length < 4) setPin(p => p + d) }
  const back  = () => setPin(p => p.slice(0, -1))

  useEffect(() => {
    if (pin.length === 4) onVerify()
  }, [pin]) // eslint-disable-line

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 mx-4">
        <h3 className="font-bold text-gray-800 text-center mb-1">Action Authentication</h3>
        <p className="text-sm text-gray-500 text-center mb-4">{reason}</p>

        {/* Auto-identified user — no dropdown needed */}
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
          <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {staffName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-gray-500">Documenting as</div>
            <div className="text-sm font-semibold text-gray-800 truncate">{staffName || 'Staff'}</div>
          </div>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-4 mb-4">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-colors ${
              pin.length > i ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'
            }`} />
          ))}
        </div>

        {error && <p className="text-red-600 text-xs text-center mb-3">{error}</p>}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1,2,3,4,5,6,7,8,9].map(d => (
            <button key={d}
              onMouseDown={e => { e.preventDefault(); press(String(d)) }}
              className="h-14 rounded-xl bg-gray-50 border border-gray-200 text-xl font-semibold text-gray-800 hover:bg-emerald-50 hover:border-emerald-300 active:scale-95 transition-all">
              {d}
            </button>
          ))}
          <button
            onMouseDown={e => { e.preventDefault(); onCancel() }}
            className="h-14 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 hover:bg-red-50 hover:border-red-200 transition-all">
            Cancel
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); press('0') }}
            className="h-14 rounded-xl bg-gray-50 border border-gray-200 text-xl font-semibold text-gray-800 hover:bg-emerald-50 hover:border-emerald-300 active:scale-95 transition-all">
            0
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); back() }}
            className="h-14 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 text-lg transition-all">
            &#x232B;
          </button>
        </div>

        {loading && <p className="text-center text-sm text-emerald-600 animate-pulse">Verifying…</p>}
      </div>
    </div>
  )
}

export function PinProvider({ children }) {
  const { user } = useAuth()
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [pin, setPin]       = useState('')

  const requestPin = useCallback((reason = 'Authenticate to continue', options = {}) => {
    return new Promise((resolve, reject) => {
      setModal({ reason, options, resolve, reject })
      setPin('')
      setError('')
    })
  }, [])

  const verify = async () => {
    if (pin.length !== 4) { setError('Enter your 4-digit PIN'); return }
    setLoading(true); setError('')
    try {
      // Use the currently logged-in user's ID — no selection needed
      const payload = user?.id ? { pin, staff_id: user.id } : { pin }
      const r = await api.post('/auth/staff/pin-verify', payload)
      modal.resolve(r)
      setModal(null); setPin('')
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Invalid PIN'
      setError(msg)
      setPin('')
    } finally { setLoading(false) }
  }

  const cancel = () => {
    modal?.reject(new Error('PIN cancelled'))
    setModal(null); setPin(''); setError('')
  }

  return (
    <PinContext.Provider value={{ requestPin }}>
      {children}
      {modal && (
        <PinModal
          reason={modal.reason}
          onVerify={verify}
          onCancel={cancel}
          loading={loading}
          error={error}
          pin={pin}
          setPin={setPin}
          staffName={user?.full_name || user?.email}
        />
      )}
    </PinContext.Provider>
  )
}

export const usePin = () => useContext(PinContext)
