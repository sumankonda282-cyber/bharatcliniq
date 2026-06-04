import { useState, useEffect } from 'react'

const KEY = 'doctor_input_mode'
const API = import.meta.env.VITE_API_URL || 'https://bharatcliniq.onrender.com'

async function fetchMode() {
  const token = sessionStorage.getItem('access_token')
  if (!token) return null
  try {
    const r = await fetch(`${API}/api/v1/doctor/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!r.ok) return null
    const d = await r.json()
    return d.input_mode || 'type'
  } catch { return null }
}

async function saveMode(mode) {
  const token = sessionStorage.getItem('access_token')
  if (!token) return
  try {
    await fetch(`${API}/api/v1/doctor/profile`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_mode: mode })
    })
  } catch {}
}

export function useInputMode() {
  const [mode, setModeState] = useState(() => sessionStorage.getItem(KEY) || 'type')

  useEffect(() => {
    fetchMode().then(m => { if (m) { setModeState(m); sessionStorage.setItem(KEY, m) } })
  }, [])

  const setMode = (m) => {
    sessionStorage.setItem(KEY, m)
    setModeState(m)
    saveMode(m)
  }

  return { mode, setMode }
}
