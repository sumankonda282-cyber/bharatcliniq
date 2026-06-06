import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { WardSessionProvider, useWardSession } from './contexts/WardSessionContext'
import { PinProvider } from './contexts/PinContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import WardBoard from './pages/WardBoard'
import Vitals from './pages/Vitals'
import NursingNotes from './pages/NursingNotes'
import MAR from './pages/MAR'
import WardRounds from './pages/WardRounds'
import ShiftHandoff from './pages/ShiftHandoff'
import WardSetup from './pages/WardSetup'
import PinSetup from './pages/PinSetup'
import Assessments from './pages/Assessments'
import DocumentationTemplates from './pages/DocumentationTemplates'
import { Loader2 } from 'lucide-react'

function AppLoader() {
  return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 size={36} className="animate-spin text-gray-400" />
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()
  const { setupComplete } = useWardSession()

  if (loading) return <AppLoader />

  // Not authenticated → login
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // Authenticated — route based on setup state
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/pin-setup" element={<PinSetup />} />
      <Route path="/ward-setup" element={<WardSetup />} />

      {/* Protected app routes — redirect to ward-setup if not configured */}
      <Route element={setupComplete ? <Layout /> : <Navigate to="/ward-setup" replace />}>
        <Route index element={<Dashboard />} />
        <Route path="ward-board" element={<WardBoard />} />
        <Route path="vitals" element={<Vitals />} />
        <Route path="notes" element={<NursingNotes />} />
        <Route path="mar" element={<MAR />} />
        <Route path="rounds" element={<WardRounds />} />
        <Route path="handoff" element={<ShiftHandoff />} />
        <Route path="assessments" element={<Assessments />} />
        <Route path="templates" element={<DocumentationTemplates />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WardSessionProvider>
          <PinProvider>
            <AppRoutes />
          </PinProvider>
        </WardSessionProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
