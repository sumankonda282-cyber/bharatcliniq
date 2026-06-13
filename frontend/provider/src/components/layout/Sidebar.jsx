import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  LayoutDashboard, Users, Calendar, Stethoscope, Pill,
  FlaskConical, Scan, Receipt, BarChart3, Send, Settings,
  ShieldCheck, ChevronRight, Building2, LayoutGrid, BedDouble, Activity, ClipboardList, Video
} from 'lucide-react'
import BrandLogo from '../BrandLogo'

const ALL_NAV = [
  { to: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard, roles: ['clinic_admin','doctor','receptionist','pharmacist','lab_tech','imaging_tech'] },
  { to: '/patients',     label: 'Patients',     icon: Users,           roles: ['clinic_admin','doctor','receptionist'] },
  { to: '/appointments', label: 'Appointments', icon: Calendar,        roles: ['clinic_admin','doctor','receptionist'] },
  { to: '/triage',       label: 'Triage',       icon: Activity,        roles: ['clinic_admin','receptionist','nurse'] },
  { to: '/doctor-desk',  label: 'Doctor Desk',  icon: Stethoscope,     roles: ['doctor','clinic_admin'] },
  { to: '/telehealth',   label: 'Telehealth',   icon: Video,           roles: ['doctor','clinic_admin'] },
  { to: '/inpatient',   label: 'Inpatient Desk', icon: BedDouble,     roles: ['doctor','clinic_admin'], hospitalOnly: true },
  { to: '/forms/iview', label: 'iView',          icon: Activity,      roles: ['doctor','nurse','clinic_admin'] },
  { to: '/forms',       label: 'Assessments',   icon: ClipboardList, roles: ['doctor','nurse','clinic_admin'] },
  { to: '/pharmacy',     label: 'Pharmacy',     icon: Pill,            roles: ['pharmacist','clinic_admin'] },
  { to: '/lab',          label: 'Laboratory',   icon: FlaskConical,    roles: ['lab_tech','clinic_admin','doctor'] },
  { to: '/imaging',      label: 'Imaging',      icon: Scan,            roles: ['imaging_tech','clinic_admin','doctor'] },
  { to: '/billing',      label: 'Billing',      icon: Receipt,         roles: ['clinic_admin','receptionist'] },
  { to: '/analytics',   label: 'Analytics',    icon: BarChart3,       roles: ['clinic_admin'] },
  { to: '/referrals',    label: 'Referrals',    icon: Send,            roles: ['clinic_admin','doctor'] },
  { to: '/admin',            label: 'Clinic Admin',    icon: Settings,     roles: ['clinic_admin'] },
  { to: '/inpatient-admin', label: 'Inpatient',       icon: BedDouble,    roles: ['clinic_admin'], hospitalOnly: true },
  { to: '/branch-overview', label: 'Branch Overview', icon: LayoutGrid,   roles: ['clinic_admin'] },
  { to: '/platform',         label: 'Platform',        icon: ShieldCheck,  userType: 'platform_admin' },
]

const API_BASE = import.meta.env.VITE_API_URL || 'https://bharatcliniq-api.onrender.com'

export default function Sidebar({ onClose }) {
  const { user, branding, isPlatformAdmin } = useAuth()

  const visible = ALL_NAV.filter(item => {
    if (item.userType === 'platform_admin') return isPlatformAdmin
    if (!item.roles) return true
    if (!item.roles.includes(user?.role)) return false
    if (item.hospitalOnly && user?.org_type !== 'hospital') return false
    return true
  })

  return (
    <aside
      className="relative left-0 top-0 h-screen w-60 flex flex-col z-40 shadow-xl"
      style={{ background: '#0F2557' }}
    >
      {/* Logo / Brand */}
      <div className="px-5 py-4 border-b border-white/10">
        {branding?.logo_url ? (
          <div className="flex items-center gap-2">
            <img
              src={branding.logo_url.startsWith('/') ? `${API_BASE}${branding.logo_url}` : branding.logo_url}
              alt={branding.brand_name}
              style={{ height: 32, width: 'auto', objectFit: 'contain', borderRadius: 4 }}
            />
            <span className="font-extrabold text-white text-sm leading-tight">{branding.brand_name}</span>
          </div>
        ) : (
          <BrandLogo size="sm" light />
        )}
        <div className="text-xs font-semibold mt-1.5 tracking-wider uppercase" style={{ color: '#F5821E' }}>
          Provider Portal
        </div>
        {user?.clinic_name && (
          <div className="flex items-center gap-1.5 mt-1" >
            <Building2 size={11} style={{ color: '#93c5fd' }} className="flex-shrink-0" />
            <span className="text-xs text-blue-300 truncate">{user.clinic_name}</span>
            {!user.clinic_verified && <span className="text-xs ml-1" style={{ color: '#F5821E' }}>⚠</span>}
          </div>
        )}
      </div>

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

    </aside>
  )
}
