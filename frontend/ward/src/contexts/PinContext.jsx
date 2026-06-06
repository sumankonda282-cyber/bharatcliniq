import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useAuth } from './AuthContext'

const PinContext = createContext(null)

function PinModal({ reason, onVerify, onCancel, loading, error, pin, setPin, staffList, selectedStaffId, setSelectedStaffId }) {
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
        <label className="text-xs font-medium text-gray-600 mb-1 block">Documenting as</label>
        <select
          value={selectedStaffId ?? ''}
          onChange={e => setSelectedStaffId(Number(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="" disabled>Select staff member...</option>
          {staffList.map(s => (
            <option key={s.id} value={s.id}>{s.full_name} ({s.role.replace(/_/g, ' ')})</option>
          ))}
        </select>
        <div className="flex justify-center gap-4 mb-4">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-colors ${pin.length > i ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'}`} />
          ))}
        </div>
        {error && <p className="text-red-600 text-xs text-center mb-3">{error}</p>}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1,2,3,4,5,6,7,8,9].map(d => (
            <button key={d} onMouseDown={(e) => { e.preventDefault(); press(String(d)) }}
              className="h-14 rounded-xl bg-gray-50 border border-gray-200 text-xl font-semibold text-gray-800 hover:bg-emerald-50 hover:border-emerald-300 active:scale-95 transition-all">
              {d}
            </button>
          ))}
          <button onMouseDown={(e) => { e.preventDefault(); onCancel() }}
            className="h-14 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 hover:bg-red-50 hover:border-red-200 transition-all">
            Cancel
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); press('0') }}
            className="h-14 rounded-xl bg-gray-50 border border-gray-200 text-xl font-semibold text-gray-800 hover:bg-emerald-50 hover:border-emerald-300 active:scale-95 transition-all">
            0
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); back() }}
            className="h-14 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 text-lg transition-all">
            &#x232B;
          </button>
        </div>
        {loading && <p className="text-center text-sm text-emerald-600 animate-pulse">Verifying...</p>}
      </div>
    </div>
  )
}

export function PinProvider({ children }) {
  const { user } = useAuth()
  const [modal, setModal]                     = useState(null)
  const [staffList, setStaffList]             = useState([])
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')
  const [pin, setPin]                         = useState('')
  const [selectedStaffId, setSelectedStaffId] = useState(null)

  useEffect(() => {
    api.get('/staff/')
      .then(data => {
        const list = Array.isArray(data) ? data : (data.items || data.staff || [])
        setStaffList(list)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (modal && user?.id) setSelectedStaffId(user.id)
  }, [modal, user?.id])

  const requestPin = useCallback((reason = 'Authenticate to continue', options = {}) => {
    return new Promise((resolve, reject) => {
      setModal({ reason, options, resolve, reject })
      setPin('')
      setError('')
    })
  }, [])

  const verify = async () => {
    if (pin.length !== 4) { setError('Enter 4-digit PIN'); return }
    if (!selectedStaffId) { setError('Select staff member'); return }
    setLoading(true); setError('')
    try {
      const r = await api.post('/auth/staff/pin-verify', { pin, staff_id: selectedStaffId })
      modal.resolve(r)
      setModal(null); setPin('')
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Invalid PIN'
      setError(msg)
    } finally { setLoading(false) }
  }

  const cancel = () => {
    modal?.reject(new Error('PIN cancelled'))
    setModal(null); setPin(''); setError('')
  }

  return (
    <PinContext.Provider value={{ requestPin, staffList }}>
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
          staffList={staffList}
          selectedStaffId={selectedStaffId}
          setSelectedStaffId={setSelectedStaffId}
        />
      )}
    </PinContext.Provider>
  )
}

export const usePin = () => useContext(PinContext)
