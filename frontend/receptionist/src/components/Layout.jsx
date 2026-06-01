import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, Users, CreditCard, LayoutDashboard, LogOut, ClipboardList } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/appointments', icon: CalendarDays,    label: 'Appointments' },
  { to: '/patients',     icon: Users,           label: 'Patients' },
  { to: '/billing',      icon: CreditCard,      label: 'Billing' },
  { to: '/queue',        icon: ClipboardList,   label: 'Queue' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="w-56 flex flex-col flex-shrink-0" style={{ background: '#0F2557' }}>
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-white font-extrabold text-lg tracking-tight">BHaratCliniq</div>
          <div className="text-xs font-semibold mt-0.5 tracking-wider uppercase" style={{ color: '#F5821E' }}>Reception</div>
        </div>
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}>
              <Icon size={17} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <div className="text-blue-200 text-xs px-3 mb-2 truncate">{user?.full_name || user?.email}</div>
          <button onClick={logout} className="sidebar-link w-full"><LogOut size={16} />Sign Out</button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
