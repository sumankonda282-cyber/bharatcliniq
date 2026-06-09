import InstallPrompt from './components/InstallPrompt'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PendingClinics from './pages/PendingClinics'
import AllClinics from './pages/AllClinics'
import ClinicDetail from './pages/ClinicDetail'
import StaffVerification from './pages/StaffVerification'
import AuditLog from './pages/AuditLog'
import Reports from './pages/Reports'
import BhidLookup from './pages/BhidLookup'
import Subscriptions from './pages/Subscriptions'
import HospitalSettings from './pages/HospitalSettings'
import AssessmentTemplates from './pages/AssessmentTemplates'
import AccountSettings from './pages/AccountSettings'
import TeamAdmins from './pages/TeamAdmins'
import PlansPricing from './pages/PlansPricing'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <>
      <InstallPrompt appName="BH Admin" />
      <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<Dashboard />} />
          <Route path="pending"    element={<PendingClinics />} />
          <Route path="clinics"    element={<AllClinics />} />
          <Route path="clinics/:id" element={<ClinicDetail />} />
          <Route path="staff"      element={<StaffVerification />} />
          <Route path="audit"      element={<AuditLog />} />
          <Route path="reports"    element={<Reports />} />
          <Route path="bhid"          element={<BhidLookup />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="hospital-settings" element={<HospitalSettings />} />
          <Route path="assessment-templates" element={<AssessmentTemplates />} />
          <Route path="account"      element={<AccountSettings />} />
          <Route path="team-admins"  element={<TeamAdmins />} />
          <Route path="pricing"      element={<PlansPricing />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
    </>
  )
}
