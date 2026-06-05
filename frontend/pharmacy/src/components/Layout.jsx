import ChatWidget from './ChatWidget'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Pill, Package, LogOut, History, PackagePlus, CreditCard, BarChart2, Menu, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pending',    icon: Pill,            label: 'Pending Rx' },
  { to: '/history',    icon: History,         label: 'Rx History' },
  { to: '/inventory',  icon: Package,         label: 'Inventory' },
  { to: '/stock-in',   icon: PackagePlus,     label: 'Receive Stock' },
  { to: '/billing',    icon: CreditCard,      label: 'Billing' },
  { to: '/reports',    icon: BarChart2,       label: 'Reports' },
]

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function Layout() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  const sidebar = (
    <aside className="w-60 flex flex-col h-full flex-shrink-0" style={{ background: '#0F2557' }}>
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <div className="text-white font-extrabold text-lg tracking-tight">BHaratCliniq</div>
          <div className="text-xs font-semibold mt-0.5 tracking-wider uppercase" style={{ color: '#F5821E' }}>
            Pharmacy Portal
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="md:hidden text-white/60 hover:text-white">
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}>
            <Icon size={17} />{label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'rgba(245,130,30,0.25)', color: '#F5821E' }}
          >
            {getInitials(user?.full_name || user?.email)}
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold truncate">{user?.full_name || user?.email}</div>
            <div className="text-blue-300 text-xs">Pharmacist</div>
          </div>
        </div>
        <button onClick={logout} className="sidebar-link w-full"><LogOut size={15} />Sign Out</button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}
      <div className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebar}
      </div>
      <div className="hidden md:flex flex-shrink-0">
        {sidebar}
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-30">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100">
            <Menu size={22} />
          </button>
          <span className="font-bold text-sm" style={{ color: '#0F2557' }}>BHaratCliniq Pharmacy</span>
        </div>
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
      <ChatWidget />
    </div>
  )
}
