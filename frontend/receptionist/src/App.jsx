import InstallPrompt from './components/InstallPrompt'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Appointments from './pages/Appointments'
import Patients from './pages/Patients'
import Billing from './pages/Billing'
import Queue from './pages/Queue'
import StaffManagement from './pages/StaffManagement'
import SetPassword from './pages/SetPassword'
import { Loader2 } from 'lucide-react'

function ManagerOnly({ children }) {
  const { user } = useAuth()
  return user?.role === 'clinic_manager' ? children : <Navigate to="/" replace />
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 size={36} className="animate-spin text-gray-400" />
    </div>
  )

  // Force password reset — all routes redirect here until done
  if (user && user.force_reset) {
    return (
      <Routes>
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="*" element={<Navigate to="/set-password" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/set-password" element={user ? <Navigate to="/" replace /> : <Navigate to="/login" replace />} />

      <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Dashboard />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="patients" element={<Patients />} />
        <Route path="billing" element={<Billing />} />
        <Route path="queue" element={<Queue />} />
        <Route path="staff" element={<ManagerOnly><StaffManagement /></ManagerOnly>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <>
        <InstallPrompt appName="BH Reception" />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </>
    </AuthProvider>
  )
}
