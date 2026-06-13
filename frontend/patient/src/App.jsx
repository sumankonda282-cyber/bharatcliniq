import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Suspense } from 'react'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Appointments from './pages/Appointments'
import Prescriptions from './pages/Prescriptions'
import LabResults from './pages/LabResults'
import Bills from './pages/Bills'
import ClinicalHistory from './pages/ClinicalHistory'
import Telehealth from './pages/Telehealth'
import TelehealthCall from './pages/TelehealthCall'
import BookAppointmentPage from './pages/BookAppointmentPage'
import Settings from './pages/Settings'
import DoctorProfile from './pages/DoctorProfile'

function Spinner() {
  return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#c7d2e5', borderTopColor: '#0F2557' }} /></div>
}

function Guard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route path="/"              element={<Dashboard />} />
        <Route path="/appointments"  element={<Appointments />} />
        <Route path="/appointments/book" element={<BookAppointmentPage />} />
        <Route path="/settings"      element={<Settings />} />
        <Route path="/prescriptions" element={<Prescriptions />} />
        <Route path="/lab-results"   element={<LabResults />} />
        <Route path="/bills"         element={<Bills />} />
        <Route path="/history"       element={<ClinicalHistory />} />
        <Route path="/timeline"      element={<Navigate to="/history" replace />} />
        <Route path="/telehealth"    element={<Telehealth />} />
        <Route path="/doctors/:id"   element={<DoctorProfile />} />
      </Route>

      {/* Full-screen call — outside Layout */}
      <Route path="/telehealth/call/:appointmentId"
        element={<Guard><TelehealthCall /></Guard>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
