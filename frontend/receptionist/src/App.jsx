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
import AccountSettings from './pages/AccountSettings'
import Admissions from './pages/Admissions'
import BedBoard from './pages/BedBoard'
import InpatientBilling from './pages/InpatientBilling'
import Telehealth from './pages/Telehealth'
import MaintenanceDashboard from './pages/MaintenanceDashboard'
import Board from './pages/scheduler/Board'
import Setup from './pages/scheduler/Setup'
import Groups from './pages/scheduler/Groups'
import Leaves from './pages/scheduler/Leaves'
import Patterns from './pages/scheduler/Patterns'
import PublishLog from './pages/scheduler/PublishLog'
import { Loader2 } from 'lucide-react'

function ManagerOnly({ children }) {
  const { user } = useAuth()
  return ['clinic_manager', 'clinic_admin'].includes(user?.role) ? children : <Navigate to="/" replace />
}

function SchedulerOnly({ children }) {
  const { user } = useAuth()
  return ['clinic_manager', 'clinic_admin'].includes(user?.role) ? children : <Navigate to="/" replace />
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
        <Route path="telehealth"   element={<Telehealth />} />
        <Route path="patients" element={<Patients />} />
        <Route path="billing" element={<Billing />} />
        <Route path="queue" element={<Queue />} />
        <Route path="staff" element={<ManagerOnly><StaffManagement /></ManagerOnly>} />
        <Route path="admissions" element={<Admissions />} />
        <Route path="bed-board" element={<BedBoard />} />
        <Route path="inpatient-billing" element={<InpatientBilling />} />
        <Route path="maintenance" element={<MaintenanceDashboard />} />
        <Route path="account" element={<AccountSettings />} />
        <Route path="scheduler" element={<SchedulerOnly><Board /></SchedulerOnly>} />
        <Route path="scheduler/setup" element={<SchedulerOnly><Setup /></SchedulerOnly>} />
        <Route path="scheduler/groups" element={<SchedulerOnly><Groups /></SchedulerOnly>} />
        <Route path="scheduler/leaves" element={<SchedulerOnly><Leaves /></SchedulerOnly>} />
        <Route path="scheduler/patterns" element={<SchedulerOnly><Patterns /></SchedulerOnly>} />
        <Route path="scheduler/publish-log" element={<SchedulerOnly><PublishLog /></SchedulerOnly>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
