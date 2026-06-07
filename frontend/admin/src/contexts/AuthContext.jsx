import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../api'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token')
    if (!token) { setLoading(false); return }
    authApi.me()
      .then(u => setUser(u))
      .catch(err => { if (err?.response?.status === 401 || err?.status === 401) sessionStorage.removeItem('admin_token') })
      .finally(() => setLoading(false))
  }, [])

  const login = async (identifier, password) => {
    const data = await authApi.login(identifier, password)
    sessionStorage.setItem('admin_token', data.access_token)
    setUser({ id: data.user_id, full_name: data.full_name, email: identifier, user_type: data.user_type })
    authApi.me().then(me => setUser(me)).catch(() => {})
  }

  const logout = () => {
    sessionStorage.removeItem('admin_token')
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}
