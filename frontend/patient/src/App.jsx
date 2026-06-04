import InstallPrompt from './components/InstallPrompt'
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
import Timeline from './pages/Timeline'

function Spinner() {
  return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>
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
        <Route path="/prescriptions" element={<Prescriptions />} />
        <Route path="/lab-results"   element={<LabResults />} />
        <Route path="/bills"         element={<Bills />} />
        <Route path="/timeline"      element={<Timeline />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <>
      <InstallPrompt appName="BH Health" />
      <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
    </>
