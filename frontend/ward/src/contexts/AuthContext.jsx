import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

// All staff roles except platform_admin are allowed
const BLOCKED_ROLES = ['platform_admin']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('staff_token')
    if (!token) { setLoading(false); return }
    api.get('/auth/staff/me')
      .then(u => setUser(u))
      .catch(err => {
        const s = err?.status || err?.response?.status
        if (s === 401 || s === 403) localStorage.removeItem('staff_token')
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (identifier, password) => {
    const r = await api.post('/auth/staff/login', { identifier, password })
    if (BLOCKED_ROLES.includes(r.role))
      throw new Error('Access denied. Platform admins cannot access the CareChart.')
    localStorage.setItem('staff_token', r.access_token)
    if (r.refresh_token) localStorage.setItem('staff_refresh_token', r.refresh_token)
    if (r.clinic_id) localStorage.setItem('clinic_id', String(r.clinic_id))
    if (r.branch_id) localStorage.setItem('branch_id', String(r.branch_id))
    setUser(r)
  }

  const logout = () => {
    localStorage.removeItem('staff_token')
    localStorage.removeItem('staff_refresh_token')
    localStorage.removeItem('clinic_id')
    localStorage.removeItem('branch_id')
    setUser(null)
    window.location.href = '/login'
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
