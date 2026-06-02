import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    const token    = localStorage.getItem('access_token')
    const userType = localStorage.getItem('user_type')
    if (!token) { setLoading(false); return }
    try {
      // Call the correct /me endpoint based on stored user_type
      const res = userType === 'platform_admin'
        ? await authApi.platformMe()
        : await authApi.me()
      setUser(res)
    } catch {
      localStorage.clear()
    } finally {
      setLoading(false)
    }
  }, [])

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
    return userData
  }

  const logout = () => {
    localStorage.clear()
    setUser(null)
  }

  const hasRole = (...roles) => roles.includes(user?.role)
  const isPlatformAdmin = user?.user_type === 'platform_admin'

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole, isPlatformAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
