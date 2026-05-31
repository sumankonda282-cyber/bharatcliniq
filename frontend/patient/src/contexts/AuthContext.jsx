import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('patient_token')
    if (!token) { setLoading(false); return }
    api.get('/portal/me')
      .then(r => setUser(r.data))
      .catch(() => localStorage.clear())
      .finally(() => setLoading(false))
  }, [])

  const login = async (identifier, password) => {
    const res = await api.post('/auth/patient/login', { identifier, password })
    localStorage.setItem('patient_token', res.data.access_token)
    const me = await api.get('/portal/me')
    setUser(me.data)
    return me.data
  }

  const logout = () => { localStorage.clear(); setUser(null) }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
