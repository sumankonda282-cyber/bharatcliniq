import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('staff_token')
    if (token) {
      api.get('/auth/staff/me')
        .then(u => setUser(u))
        .catch(err => { const s = err?.status || err?.response?.status; if (s === 401 || s === 403) localStorage.removeItem('staff_token') })
        .finally(() => setLoading(false))
    } else { setLoading(false) }
  }, [])

  const login = async (identifier, password) => {
    const r = await api.post('/auth/staff/login', { identifier, password })
    const allowed = ['nurse', 'doctor', 'clinic_admin', 'clinic_manager', 'pharmacist']
    if (!allowed.includes(r.role)) throw new Error('Access denied. CareChart is for ward staff.')
    localStorage.setItem('staff_token', r.access_token)
    if (r.refresh_token) localStorage.setItem('staff_refresh_token', r.refresh_token)
    if (r.clinic_id) localStorage.setItem('clinic_id', r.clinic_id)
    setUser(r)
  }

  const logout = () => {
    localStorage.clear()
    setUser(null)
    window.location.href = '/login'
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
