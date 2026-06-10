import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { WardSessionProvider, useWardSession } from './contexts/WardSessionContext'
import { PinProvider } from './contexts/PinContext'
import { Loader2 } from 'lucide-react'

const Login                  = lazy(() => import('./pages/Login'))
const SetPasswordScreen      = lazy(() => import('./pages/SetPasswordScreen'))
const PinSetup               = lazy(() => import('./pages/PinSetup'))
const WardSetup              = lazy(() => import('./pages/WardSetup'))
const Dashboard              = lazy(() => import('./pages/Dashboard'))
const PatientList            = lazy(() => import('./pages/PatientList'))
const WardBoard              = lazy(() => import('./pages/WardBoard'))
const Vitals                 = lazy(() => import('./pages/Vitals'))
const NursingNotes           = lazy(() => import('./pages/NursingNotes'))
const MAR                    = lazy(() => import('./pages/MAR'))
const WardRounds             = lazy(() => import('./pages/WardRounds'))
const ShiftHandoff           = lazy(() => import('./pages/ShiftHandoff'))
const Assessments            = lazy(() => import('./pages/Assessments'))
const DocumentationTemplates = lazy(() => import('./pages/DocumentationTemplates'))
const PatientChart           = lazy(() => import('./pages/PatientChart'))
const Orders                 = lazy(() => import('./pages/Orders'))
const AccountSettings        = lazy(() => import('./pages/AccountSettings'))
const DischargeSummary       = lazy(() => import('./pages/DischargeSummary'))
const Layout                 = lazy(() => import('./components/Layout'))

function AppLoader() {
  return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 size={36} className="animate-spin text-gray-400" />
    </div>
  )
}

function AppRoutes() {
  const { user, loading, refreshUser } = useAuth()
  const { setupComplete } = useWardSession()

  if (loading) return <AppLoader />

  if (user?.force_reset) {
    return (
      <Suspense fallback={<AppLoader />}>
        <SetPasswordScreen onDone={refreshUser} />
      </Suspense>
    )
  }

  if (!user) {
    return (
      <Suspense fallback={<AppLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<AppLoader />}>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/pin-setup" element={<PinSetup />} />
        <Route path="/ward-setup" element={<WardSetup />} />
        <Route path="/account" element={<AccountSettings />} />

        <Route element={setupComplete ? <Layout /> : <Navigate to="/ward-setup" replace />}>
          <Route index element={<Dashboard />} />
          <Route path="patients" element={<PatientList />} />
          <Route path="ward-board" element={<WardBoard />} />
          <Route path="vitals" element={<Vitals />} />
          <Route path="notes" element={<NursingNotes />} />
          <Route path="mar" element={<MAR />} />
          <Route path="orders" element={<Orders />} />
          <Route path="rounds" element={<WardRounds />} />
          <Route path="handoff" element={<ShiftHandoff />} />
          <Route path="assessments" element={<Assessments />} />
          <Route path="templates" element={<DocumentationTemplates />} />
          <Route path="discharge" element={<DischargeSummary />} />
          <Route path="progress-notes" element={<WardRounds />} />
          <Route path="patient/:admissionId" element={<PatientChart />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
