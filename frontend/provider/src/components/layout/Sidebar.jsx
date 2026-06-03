import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  LayoutDashboard, Users, Calendar, Stethoscope, Pill,
  FlaskConical, Scan, Receipt, BarChart3, Send, Settings,
  ShieldCheck, LogOut, ChevronRight, Building2
} from 'lucide-react'
import BrandLogo from '../BrandLogo'

const ALL_NAV = [
  { to: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard, roles: ['clinic_admin','doctor','receptionist','pharmacist','lab_tech','imaging_tech'] },
  { to: '/patients',     label: 'Patients',     icon: Users,           roles: ['clinic_admin','doctor','receptionist'] },
  { to: '/appointments', label: 'Appointments', icon: Calendar,        roles: ['clinic_admin','doctor','receptionist'] },
  { to: '/doctor-desk',  label: 'Doctor Desk',  icon: Stethoscope,     roles: ['doctor','clinic_admin'] },
  { to: '/pharmacy',     label: 'Pharmacy',     icon: Pill,            roles: ['pharmacist','clinic_admin'] },
  { to: '/lab',          label: 'Laboratory',   icon: FlaskConical,    roles: ['lab_tech','clinic_admin','doctor'] },
  { to: '/imaging',      label: 'Imaging',      icon: Scan,            roles: ['imaging_tech','clinic_admin','doctor'] },
  { to: '/billing',      label: 'Billing',      icon: Receipt,         roles: ['clinic_admin','receptionist'] },
  { to: '/analytics',   label: 'Analytics',    icon: BarChart3,       roles: ['clinic_admin'] },
  { to: '/referrals',    label: 'Referrals',    icon: Send,            roles: ['clinic_admin','doctor'] },
  { to: '/admin',        label: 'Clinic Admin', icon: Settings,        roles: ['clinic_admin'] },
  { to: '/platform',     label: 'Platform',     icon: ShieldCheck,     userType: 'platform_admin' },
]

export default function Sidebar({ onClose }) {
  const { user, logout, isPlatformAdmin } = useAuth()
  const navigate = useNavigate()

  const visible = ALL_NAV.filter(item => {
    if (item.userType === 'platform_admin') return isPlatformAdmin
    if (!item.roles) return true
    return item.roles.includes(user?.role)
  })

  const handleLogout = () => { logout(); navigate('/login') }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <aside
      className="relative left-0 top-0 h-screen w-60 flex flex-col z-40 shadow-xl"
      style={{ background: '#0F2557' }}
    >
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <BrandLogo size="sm" light />
        <div className="text-xs font-semibold mt-1.5 tracking-wider uppercase" style={{ color: '#F5821E' }}>
          Doctor Portal
        </div>
      </div>

      {/* Clinic info */}
      {user?.clinic_name && (
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs text-blue-300">
            <Building2 size={12} />
            <span className="truncate">{user.clinic_name}</span>
          </div>
          {!user.clinic_verified && (
            <div className="mt-1 text-xs" style={{ color: '#F5821E' }}>⚠ Pending verification</div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {visible.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mb-0.5 transition-all group ${
                isActive
                  ? 'text-white'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`
            }
            style={({ isActive }) => isActive ? { background: '#CC1414' } : {}}
          >
            <item.icon size={17} />
            <span className="flex-1">{item.label}</span>
            <ChevronRight size={13} className="opacity-0 group-hover:opacity-50 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: '#F5821E' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{user?.full_name}</div>
            <div className="text-xs text-blue-300 capitalize">{user?.role?.replace(/_/g, ' ')}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs text-blue-300 hover:text-red-400 transition-colors w-full"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
