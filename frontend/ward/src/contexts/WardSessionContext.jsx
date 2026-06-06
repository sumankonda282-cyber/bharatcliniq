import { createContext, useContext, useState, useEffect } from 'react'

const WardSessionContext = createContext(null)

export function WardSessionProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('ward_mode') || 'nurse')
  const [department, setDepartment] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ward_department') || 'null') } catch { return null }
  })
  const [ward, setWard] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ward_ward') || 'null') } catch { return null }
  })
  const [setupComplete, setSetupComplete] = useState(() => {
    try { return !!JSON.parse(localStorage.getItem('ward_department') || 'null') } catch { return false }
  })

  useEffect(() => {
    localStorage.setItem('ward_mode', mode)
  }, [mode])

  useEffect(() => {
    localStorage.setItem('ward_department', JSON.stringify(department))
    localStorage.setItem('ward_ward', JSON.stringify(ward))
    if (department) setSetupComplete(true)
  }, [department, ward])

  const switchMode = (newMode) => setMode(newMode)

  const clearSession = () => {
    setDepartment(null); setWard(null); setSetupComplete(false)
    localStorage.removeItem('ward_department'); localStorage.removeItem('ward_ward')
  }

  return (
    <WardSessionContext.Provider value={{ mode, switchMode, department, setDepartment, ward, setWard, setupComplete, clearSession }}>
      {children}
    </WardSessionContext.Provider>
  )
}

export const useWardSession = () => useContext(WardSessionContext)
