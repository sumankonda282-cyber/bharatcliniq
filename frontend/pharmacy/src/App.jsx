import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pending from './pages/Pending'
import History from './pages/History'
import Inventory from './pages/Inventory'
import StockIn from './pages/StockIn'
import Billing from './pages/Billing'
import Reports from './pages/Reports'
import { Loader2 } from 'lucide-react'
function Guard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 size={36} className="animate-spin text-gray-400"/></div>
  return user ? children : <Navigate to="/login" replace/>
}
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login/>}/>
          <Route element={<Guard><Layout/></Guard>}>
            <Route index element={<Dashboard/>}/>
            <Route path="pending"   element={<Pending/>}/>
            <Route path="history"   element={<History/>}/>
            <Route path="inventory" element={<Inventory/>}/>
            <Route path="stock-in"  element={<StockIn/>}/>
            <Route path="billing"   element={<Billing/>}/>
            <Route path="reports"   element={<Reports/>}/>
          </Route>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
