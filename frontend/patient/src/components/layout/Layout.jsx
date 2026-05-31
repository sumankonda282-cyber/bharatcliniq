import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Outlet } from 'react-router-dom'
import { Activity, LayoutDashboard, Calendar, Pill, FlaskConical, Receipt, LogOut } from 'lucide-react'
import clsx from 'clsx'

const NAV = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/appointments', label: 'Appointments', icon: Calendar },
  { to: '/prescriptions',label: 'Prescriptions',icon: Pill },
  { to: '/lab-results',  label: 'Lab Results',  icon: FlaskConical },
  { to: '/bills',        label: 'Bills',        icon: Receipt },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-teal-900 text-white flex flex-col">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-teal-800">
          <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
            <Activity size={16} />
          </div>
          <div>
            <div className="font-bold text-sm">BharatCliniq</div>
            <div className="text-xs text-teal-300">My Health</div>
          </div>
        </div>

        {user && (
          <div className="px-4 py-3 border-b border-teal-800">
            <div className="text-sm font-medium truncate">{user.full_name}</div>
            <div className="text-xs text-teal-300">{user.mobile}</div>
          </div>
        )}

        <nav className="flex-1 py-3 px-2">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-all',
                  isActive ? 'bg-teal-600 text-white' : 'text-teal-200 hover:bg-teal-800'
                )
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-teal-800">
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-teal-300 hover:text-red-300 transition-colors">
            <LogOut size={14} />Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
