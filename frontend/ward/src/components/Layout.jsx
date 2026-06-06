import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LayoutDashboard, Pill, ListOrdered, KeyRound, LogOut } from 'lucide-react'

const NAV = [
  { to: '/',       label: 'Dashboard', icon: LayoutDashboard },
  { to: '/mar',    label: 'MAR',        icon: Pill },
  { to: '/orders', label: 'Orders',     icon: ListOrdered },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-emerald-800 text-white px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
        <div className="font-bold text-lg tracking-tight">CareChart</div>
        <div className="flex-1" />
        <span className="text-emerald-200 text-xs">{user?.full_name} · {user?.role}</span>
        <button onClick={() => navigate('/pin-setup')} className="p-1.5 hover:bg-emerald-700 rounded" title="PIN Setup">
          <KeyRound size={14} />
        </button>
        <button onClick={logout} className="p-1.5 hover:bg-emerald-700 rounded" title="Logout">
          <LogOut size={14} />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="bg-white border-t border-gray-200 flex flex-shrink-0">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
                isActive ? 'text-emerald-700' : 'text-gray-500 hover:text-gray-700'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
