import InstallPrompt from './components/InstallPrompt'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Suspense, lazy } from 'react'
import Layout from './components/layout/Layout'
import { PageLoader } from './components/ui/Spinner'
import Login from './pages/auth/Login'
import SetPassword from './pages/auth/SetPassword'

// Lazy-load all pages for performance
const Dashboard      = lazy(() => import('./pages/dashboard/Dashboard'))
const PatientList    = lazy(() => import('./pages/patients/PatientList'))
const PatientDetail  = lazy(() => import('./pages/patients/PatientDetail'))
const PatientNew     = lazy(() => import('./pages/patients/PatientNew'))
const Appointments   = lazy(() => import('./pages/appointments/Appointments'))
const DoctorDesk     = lazy(() => import('./pages/doctor/DoctorDesk'))
const Encounter      = lazy(() => import('./pages/doctor/Encounter'))
const Pharmacy       = lazy(() => import('./pages/pharmacy/Pharmacy'))
const Lab            = lazy(() => import('./pages/lab/Lab'))
const Imaging        = lazy(() => import('./pages/imaging/Imaging'))
const Billing        = lazy(() => import('./pages/billing/Billing'))
const Analytics      = lazy(() => import('./pages/analytics/Analytics'))
const Referrals      = lazy(() => import('./pages/referrals/Referrals'))
const ClinicAdmin    = lazy(() => import('./pages/admin/ClinicAdmin'))
const BranchOverview = lazy(() => import('./pages/admin/BranchOverview'))
const PlatformAdmin  = lazy(() => import('./pages/platform/PlatformAdmin'))

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />

  // Force password reset — blocks all other routes until done
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
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/set-password" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />

      <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"    element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
        <Route path="/patients"     element={<Suspense fallback={<PageLoader />}><PatientList /></Suspense>} />
        <Route path="/patients/new" element={<Suspense fallback={<PageLoader />}><PatientNew /></Suspense>} />
        <Route path="/patients/:id" element={<Suspense fallback={<PageLoader />}><PatientDetail /></Suspense>} />
        <Route path="/appointments" element={<Suspense fallback={<PageLoader />}><Appointments /></Suspense>} />
        <Route path="/doctor-desk"  element={<Suspense fallback={<PageLoader />}><DoctorDesk /></Suspense>} />
        <Route path="/encounter/:id" element={<Suspense fallback={<PageLoader />}><Encounter /></Suspense>} />
        <Route path="/pharmacy"     element={<Suspense fallback={<PageLoader />}><Pharmacy /></Suspense>} />
        <Route path="/lab"          element={<Suspense fallback={<PageLoader />}><Lab /></Suspense>} />
        <Route path="/imaging"      element={<Suspense fallback={<PageLoader />}><Imaging /></Suspense>} />
        <Route path="/billing"      element={<Suspense fallback={<PageLoader />}><Billing /></Suspense>} />
        <Route path="/analytics"    element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
        <Route path="/referrals"    element={<Suspense fallback={<PageLoader />}><Referrals /></Suspense>} />
        <Route path="/admin"        element={<Suspense fallback={<PageLoader />}><ClinicAdmin /></Suspense>} />
        <Route path="/platform"     element={<Suspense fallback={<PageLoader />}><PlatformAdmin /></Suspense>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <>
      <InstallPrompt appName="BH Provider" />
      <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
    </>
