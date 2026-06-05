import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Clock, Building2, ShieldCheck,
  ClipboardList, BarChart3, LogOut, Menu, X, Search, CreditCard
} from 'lucide-react'

const NAV = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pending',       icon: Clock,           label: 'Pending Approvals' },
  { to: '/clinics',       icon: Building2,       label: 'All Clinics' },
  { to: '/subscriptions', icon: CreditCard,      label: 'Subscriptions' },
  { to: '/staff',         icon: ShieldCheck,     label: 'Staff Verification' },
  { to: '/audit',         icon: ClipboardList,   label: 'Audit Log' },
  { to: '/reports',       icon: BarChart3,       label: 'Reports' },
  { to: '/bhid',          icon: Search,          label: 'BH ID Lookup' },
]

function getInitials(email) {
  if (!email) return '?'
  return email.slice(0, 2).toUpperCase()
}

function Sidebar({ onClose }) {
  const { user, logout } = useAuth()
  return (
    <aside className="w-60 flex flex-col h-full bg-gray-900 border-r border-gray-800">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-800 flex items-center justify-between">
        <div>
          <div className="text-white font-extrabold text-base tracking-tight">BharatCliniq</div>
          <div className="text-xs font-bold mt-0.5 tracking-widest uppercase" style={{ color: '#F5821E' }}>
            Super Admin
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            onClick={onClose}
            className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}>
            <Icon size={16} />{label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'rgba(245,130,30,0.2)', color: '#F5821E' }}
          >
            {getInitials(user?.email || user?.full_name)}
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold truncate">{user?.email || user?.full_name}</div>
            <div className="text-gray-500 text-xs">Super Admin</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut size={15} />Sign Out
        </button>
      </div>
    </aside>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}
      <div className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setOpen(false)} />
      </div>
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900 sticky top-0 z-30">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-800">
            <Menu size={22} />
          </button>
          <span className="font-bold text-sm text-white">BharatCliniq Admin</span>
        </div>
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
