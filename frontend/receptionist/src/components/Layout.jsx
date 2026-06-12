import ChatWidget from './ChatWidget'
import HelpWidget from './HelpWidget'
import StaffProfilePanel from './StaffProfilePanel'
import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  CreditCard, LayoutDashboard, LogOut, Users,
  Menu, X, Settings, BedDouble, LayoutGrid, Banknote, Wrench, HelpCircle,
  CalendarRange, UserCircle2, Plane, LayoutTemplate, Send, Monitor,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import BrandLogo from './BrandLogo'
import api from '../api/client'

const MANAGER_BASE_NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/operations',  icon: LayoutGrid,      label: 'Operations' },
  { to: '/patients',    icon: Users,           label: 'Patients' },
]
const MANAGER_NAV = [
  { to: '/staff',       icon: Settings, label: 'Manage Staff' },
  { to: '/maintenance', icon: Wrench,   label: 'Maintenance' },
]
const RECEP_NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/front-desk',  icon: Monitor,         label: 'Front Desk' },
  { to: '/billing',     icon: CreditCard,      label: 'Billing' },
]
const HOSPITAL_NAV = [
  { to: '/admissions',        icon: BedDouble,   label: 'Admissions' },
  { to: '/bed-board',         icon: LayoutGrid,  label: 'Bed Board' },
  { to: '/inpatient-billing', icon: Banknote,    label: 'IPD Billing' },
]
const SCHEDULER_NAV = [
  { to: '/scheduler',           icon: CalendarRange,   label: 'Schedule Board' },
  { to: '/scheduler/groups',    icon: UserCircle2,     label: 'Groups & People' },
  { to: '/scheduler/leaves',    icon: Plane,           label: 'Leaves & PTO' },
  { to: '/scheduler/patterns',  icon: LayoutTemplate,  label: 'Patterns' },
  { to: '/scheduler/publish-log', icon: Send,          label: 'Publish Log' },
  { to: '/scheduler/setup',     icon: Settings,        label: 'Scheduler Setup' },
]

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function formatRole(role) {
  if (!role) return 'Staff'
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function ProfileDropdown({ user, onSettings, onLogout, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
      <div className="px-4 py-3" style={{ background: '#0F2557' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: 'rgba(245,130,30,0.3)', color: '#F5821E' }}>
            {getInitials(user?.full_name || user?.email)}
          </div>
          <div className="min-w-0">
            <div className="text-white font-semibold text-sm truncate">{user?.full_name || user?.email}</div>
            <div className="text-blue-300 text-xs">{formatRole(user?.role)}</div>
          </div>
        </div>
      </div>
      <div className="py-1">
        <button onClick={() => { onSettings(); onClose() }}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
          <Settings size={15} className="text-gray-400" /> Settings &amp; Profile
        </button>
        <div className="border-t border-gray-100 my-1" />
        <button onClick={() => { onLogout(); onClose() }}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors">
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [maintBadge, setMaintBadge] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [profilePanelOpen, setProfilePanelOpen] = useState(false)

  const isManager = ['clinic_manager', 'clinic_admin'].includes(user?.role)
  const isScheduler = isManager
  const isHospital = user?.org_type === 'hospital'
  const NAV = isManager
    ? [...MANAGER_BASE_NAV, ...(isHospital ? HOSPITAL_NAV : []), ...MANAGER_NAV]
    : [...RECEP_NAV, ...(isHospital ? HOSPITAL_NAV : [])]

  useEffect(() => {
    if (!isManager) return
    const fetch = () => api.get('/maintenance/requests/badge').then(r => setMaintBadge(r?.count || 0)).catch(() => {})
    fetch()
    const id = setInterval(fetch, 60000)
    return () => clearInterval(id)
  }, [isManager])

  const sidebar = (
    <aside className="w-60 flex flex-col h-full flex-shrink-0" style={{ background: '#0F2557' }}>
      <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <BrandLogo size="sm" light />
          <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#F5821E' }}>
            {isManager ? 'Manager Portal' : 'Reception Portal'}
          </span>
        </div>
        <button onClick={() => setOpen(false)} className="md:hidden text-white/60 hover:text-white p-1">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}>
            <Icon size={17} className="flex-shrink-0" />
            <span className="flex-1">{label}</span>
            {to === '/maintenance' && maintBadge > 0 && (
              <span className="ml-auto px-1.5 py-0.5 rounded-full text-white text-xs font-bold leading-none bg-red-500">
                {maintBadge}
              </span>
            )}
          </NavLink>
        ))}

        {isScheduler && (
          <>
            <div className="px-3 pt-4 pb-1 text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Scheduler
            </div>
            {SCHEDULER_NAV.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/scheduler'}
                onClick={() => setOpen(false)}
                className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}>
                <Icon size={17} className="flex-shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>
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

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Persistent top bar */}
        <header className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-white sticky top-0 z-30 shadow-sm flex-shrink-0">
          <button onClick={() => setOpen(true)} className="md:hidden p-1.5 rounded-lg text-gray-600 hover:bg-gray-100">
            <Menu size={22} />
          </button>
          <div className="md:hidden"><BrandLogo size="sm" /></div>
          <span className="md:hidden text-xs font-semibold ml-1" style={{ color: '#F5821E' }}>{isManager ? 'Manager' : 'Reception'}</span>

          <div className="flex-1" />

          <button onClick={() => setHelpOpen(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Help & Support">
            <HelpCircle size={16} />
          </button>

          {/* Profile avatar */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(v => !v)}
              className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(15,37,87,0.12)', color: '#0F2557' }}>
                {getInitials(user?.full_name || user?.email)}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold text-gray-800 leading-tight max-w-[120px] truncate">
                  {user?.full_name || user?.email}
                </div>
                <div className="text-xs text-gray-400 leading-tight">{formatRole(user?.role)}</div>
              </div>
            </button>
            {dropdownOpen && (
              <ProfileDropdown
                user={user}
                onSettings={() => setProfilePanelOpen(true)}
                onLogout={logout}
                onClose={() => setDropdownOpen(false)}
              />
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      <ChatWidget />
      <HelpWidget open={helpOpen} onClose={() => setHelpOpen(false)} />
      <StaffProfilePanel open={profilePanelOpen} onClose={() => setProfilePanelOpen(false)} />
    </div>
  )
}
