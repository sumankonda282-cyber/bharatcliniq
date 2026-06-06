import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PinProvider } from './contexts/PinContext'
import { Suspense, lazy } from 'react'

const Login     = lazy(() => import('./pages/Login'))
const PinSetup  = lazy(() => import('./pages/PinSetup'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const MAR       = lazy(() => import('./pages/MAR'))
const Orders    = lazy(() => import('./pages/Orders'))
const Layout    = lazy(() => import('./components/Layout'))

function Loader() {
  return <div className="flex items-center justify-center h-screen text-emerald-700">Loading…</div>
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <Loader />

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Suspense fallback={<Loader />}><Login /></Suspense>} />
      <Route element={user ? <Suspense fallback={<Loader />}><Layout /></Suspense> : <Navigate to="/login" replace />}>
        <Route index element={<Suspense fallback={<Loader />}><Dashboard /></Suspense>} />
        <Route path="/mar" element={<Suspense fallback={<Loader />}><MAR /></Suspense>} />
        <Route path="/orders" element={<Suspense fallback={<Loader />}><Orders /></Suspense>} />
        <Route path="/pin-setup" element={<Suspense fallback={<Loader />}><PinSetup /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PinProvider>
          <AppRoutes />
        </PinProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
