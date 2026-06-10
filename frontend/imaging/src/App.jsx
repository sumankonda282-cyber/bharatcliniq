import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Loader2 } from 'lucide-react'
import Toaster from './components/Toaster'
import InstallPrompt from './components/InstallPrompt'
import Layout from './components/Layout'
import Login from './pages/Login'
import SetPasswordScreen from './pages/SetPasswordScreen'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import PendingReports from './pages/PendingReports'
import ReportWriter from './pages/ReportWriter'
import Billing from './pages/Billing'
import Reports from './pages/Reports'
import PatientHistory from './pages/PatientHistory'
import Templates from './pages/Templates'
import Schedule from './pages/Schedule'
import ReferringDoctors from './pages/ReferringDoctors'
import PendingReview from './pages/PendingReview'
import AccountSettings from './pages/AccountSettings'

function Spinner() {
  return <div className="h-screen flex items-center justify-center"><Loader2 size={36} className="animate-spin text-gray-400" /></div>
}

function Guard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return user ? children : <Navigate to="/login" replace />
}

function LoginRoute() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return user ? <Navigate to="/" replace /> : <Login />
}


function ForceResetGuard({ children }) {
  const { user, refreshUser } = useAuth()
  if (user?.force_reset) return <SetPasswordScreen onDone={refreshUser} />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster />
      <InstallPrompt appName="BH Imaging" />
      <BrowserRouter>
        <ForceResetGuard>
        <Routes>
          <Route path="/login"   element={<LoginRoute />} />
          <Route path="/account" element={<Guard><AccountSettings /></Guard>} />
          <Route element={<Guard><Layout /></Guard>}>
            <Route index               element={<Dashboard />} />
            <Route path="pending"        element={<PendingReports />} />
            <Route path="pending-review" element={<PendingReview />} />
            <Route path="report-writer"  element={<ReportWriter />} />
            <Route path="orders"         element={<Orders />} />
            <Route path="schedule"       element={<Schedule />} />
            <Route path="referring"      element={<ReferringDoctors />} />
            <Route path="billing"        element={<Billing />} />
            <Route path="reports"        element={<Reports />} />
            <Route path="patients"       element={<PatientHistory />} />
            <Route path="templates"      element={<Templates />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ForceResetGuard>
      </BrowserRouter>
    </AuthProvider>
  )
}
