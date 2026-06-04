import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [branding, setBranding] = useState(null)
  const [loading, setLoading]   = useState(true)

  const loadBranding = useCallback(async (clinicId) => {
    if (!clinicId) return
    try {
      const r = await api.get(`/public/branding/${clinicId}`)
      setBranding(r.data)
    } catch {}
  }, [])

  const loadUser = useCallback(async () => {
    const token    = localStorage.getItem('access_token')
    const userType = localStorage.getItem('user_type')
    if (!token) { setLoading(false); return }
    try {
      const res = userType === 'platform_admin'
        ? await authApi.platformMe()
        : await authApi.me()
      setUser(res)
      if (res.clinic_id) loadBranding(res.clinic_id)
    } catch {
      localStorage.clear()
    } finally {
      setLoading(false)
    }
  }, [loadBranding])

  useEffect(() => { loadUser() }, [loadUser])

  const login = async (identifier, password, isPlatform = false) => {
    const res = isPlatform
      ? await authApi.platformLogin(identifier, password)
      : await authApi.login(identifier, password)
    const { access_token, refresh_token, ...userData } = res
    localStorage.setItem('access_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)
    localStorage.setItem('user_type', userData.user_type)
    setUser(userData)
    if (userData.clinic_id) loadBranding(userData.clinic_id)
    return userData
  }

  const refreshUser = async () => {
    const res = await authApi.me()
    setUser(res)
    return res
  }

  const logout = () => {
    localStorage.clear()
    setUser(null)
  }

  const hasRole = (...roles) => roles.includes(user?.role)
  const isPlatformAdmin = user?.user_type === 'platform_admin'

  return (
    <AuthContext.Provider value={{ user, branding, loading, login, logout, hasRole, isPlatformAdmin, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
