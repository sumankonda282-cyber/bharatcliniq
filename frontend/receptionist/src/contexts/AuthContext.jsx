import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('staff_token')
    if (token) {
      api.get('/auth/staff/me').then(u => setUser(u)).catch(() => localStorage.clear()).finally(() => setLoading(false))
    } else setLoading(false)
  }, [])

  const login = async (identifier, password) => {
    const r = await api.post('/auth/staff/login', { identifier, password })
    const allowed = ['receptionist', 'clinic_admin']
    if (!allowed.includes(r.role)) throw new Error('Access denied. This portal is for reception staff only.')
    localStorage.setItem('staff_token', r.access_token)
    if (r.clinic_id) localStorage.setItem('clinic_id', r.clinic_id)
    if (r.branch_id) localStorage.setItem('branch_id', r.branch_id)
    const me = await api.get('/auth/staff/me')
    setUser(me)
  }

  const logout = () => { localStorage.clear(); setUser(null); window.location.href = '/login' }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
