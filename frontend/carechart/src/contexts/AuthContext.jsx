import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

const BLOCKED_ROLES = ['platform_admin']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ssoToken = params.get('sso')

    if (ssoToken) {
      // Remove sso param from URL without a page reload
      const cleanUrl = window.location.pathname + (params.toString().replace(/sso=[^&]*&?/, '').replace(/^&/, '') ? `?${params.toString().replace(/sso=[^&]*&?/, '').replace(/^&/, '')}` : '')
      window.history.replaceState({}, '', cleanUrl)

      api.post('/auth/verify-cross-portal-token', { sso_token: ssoToken })
        .then(r => {
          if (BLOCKED_ROLES.includes(r.role)) throw new Error('Access denied')
          localStorage.setItem('staff_token', r.access_token)
          if (r.refresh_token) localStorage.setItem('staff_refresh_token', r.refresh_token)
          if (r.clinic_id)  localStorage.setItem('clinic_id',  String(r.clinic_id))
          if (r.branch_id)  localStorage.setItem('branch_id',  String(r.branch_id))
          setUser(r)
        })
        .catch(() => {
          localStorage.removeItem('staff_token')
        })
        .finally(() => setLoading(false))
      return
    }

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
    return r
  }

  const refreshUser = async () => {
    const u = await api.get('/auth/staff/me')
    setUser(u)
    return u
  }

  const logout = () => {
    localStorage.removeItem('staff_token')
    localStorage.removeItem('staff_refresh_token')
    localStorage.removeItem('clinic_id')
    localStorage.removeItem('branch_id')
    setUser(null)
    window.location.href = '/login'
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
