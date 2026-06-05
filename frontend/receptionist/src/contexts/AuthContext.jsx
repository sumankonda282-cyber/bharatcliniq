import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'
import { cacheClear } from '../utils/cache'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('staff_token')
    if (token) {
      api.get('/auth/staff/me')
        .then(u => setUser(u))
        .catch(() => localStorage.clear())
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (identifier, password) => {
    const r = await api.post('/auth/staff/login', { identifier, password })
    const allowed = ['receptionist', 'clinic_admin', 'clinic_manager']
    if (!allowed.includes(r.role)) throw new Error('Access denied. This portal is for reception and management staff only.')
    localStorage.setItem('staff_token', r.access_token)
    if (r.clinic_id) localStorage.setItem('clinic_id', r.clinic_id)
    if (r.branch_id) localStorage.setItem('branch_id', r.branch_id)
    // Use login response directly (has force_reset) then refresh for full me data
    setUser({ ...r, force_reset: r.force_reset })
    if (!r.force_reset) {
      const me = await api.get('/auth/staff/me')
      setUser(me)
    }
    return r
  }

  const refreshUser = async () => {
    const me = await api.get('/auth/staff/me')
    setUser(me)
    return me
  }

  const logout = () => { localStorage.clear(); cacheClear(); setUser(null); window.location.href = '/login' }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
