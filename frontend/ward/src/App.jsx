import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import WardBoard from './pages/WardBoard'
import Vitals from './pages/Vitals'
import NursingNotes from './pages/NursingNotes'
import MAR from './pages/MAR'
import WardRounds from './pages/WardRounds'
import ShiftHandoff from './pages/ShiftHandoff'
import { Loader2 } from 'lucide-react'

function Guard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 size={36} className="animate-spin text-gray-400" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function LoginRoute() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 size={36} className="animate-spin text-gray-400" />
    </div>
  )
  return user ? <Navigate to="/" replace /> : <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route element={<Guard><Layout /></Guard>}>
            <Route index element={<Dashboard />} />
            <Route path="ward-board" element={<WardBoard />} />
            <Route path="vitals" element={<Vitals />} />
            <Route path="notes" element={<NursingNotes />} />
            <Route path="mar" element={<MAR />} />
            <Route path="rounds" element={<WardRounds />} />
            <Route path="handoff" element={<ShiftHandoff />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
