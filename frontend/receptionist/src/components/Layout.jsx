import ChatWidget from './ChatWidget'
import HelpWidget from './HelpWidget'
import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  CalendarDays, Users, CreditCard, LayoutDashboard, LogOut,
  ClipboardList, Menu, X, Settings, BedDouble, LayoutGrid, Banknote, Wrench, HelpCircle, Video,
  CalendarRange, UserCircle2, Plane, LayoutTemplate, Send, Lock, Loader2,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import BrandLogo from './BrandLogo'
import api from '../api/client'

const BASE_NAV = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/appointments', icon: CalendarDays,    label: 'Appointments' },
  { to: '/telehealth',   icon: Video,          label: 'Telehealth' },
  { to: '/patients',     icon: Users,           label: 'Patients' },
  { to: '/billing',      icon: CreditCard,      label: 'Billing' },
  { to: '/queue',        icon: ClipboardList,   label: 'Queue' },
]
const HOSPITAL_NAV = [
  { to: '/admissions',        icon: BedDouble,   label: 'Admissions' },
  { to: '/bed-board',         icon: LayoutGrid,  label: 'Bed Board' },
  { to: '/inpatient-billing', icon: Banknote,    label: 'IPD Billing' },
]
const MANAGER_NAV = [
  { to: '/staff',       icon: Settings, label: 'Manage Staff' },
  { to: '/maintenance', icon: Wrench,   label: 'Maintenance' },
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

export default function Layout() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen]   = useState(false)
  const [maintBadge, setMaintBadge] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)
  const [pwStep, setPwStep]       = useState(false)
  const [pwForm, setPwForm]       = useState({ current: '', next: '' })
  const [pwSaving, setPwSaving]   = useState(false)
  const [pwErr, setPwErr]         = useState('')
  const isManager = user?.role === 'clinic_manager'
  const isAdmin = user?.role === 'clinic_admin'
  const isScheduler = isManager || isAdmin
  const isHospital = user?.org_type === 'hospital'
  const NAV = [
    ...BASE_NAV,
    ...(isHospital ? HOSPITAL_NAV : []),
    ...(isManager ? MANAGER_NAV : []),
  ]

  useEffect(() => {
    if (!isManager) return
    const fetch = () => api.get('/maintenance/requests/badge').then(r => setMaintBadge(r.data?.count || 0)).catch(() => {})
    fetch()
    const id = setInterval(fetch, 60000)
    return () => clearInterval(id)
  }, [isManager])

  const closeProfile = () => { setProfileOpen(false); setPwStep(false); setPwErr(''); setPwForm({ current: '', next: '' }) }

  const handleChangePw = async () => {
    setPwSaving(true); setPwErr('')
    try {
      await api.post('/staff/change-password', { current_password: pwForm.current, new_password: pwForm.next })
      closeProfile()
    } catch (e) {
      setPwErr(e.message || 'Failed to update password')
    } finally {
      setPwSaving(false)
    }
  }

  const sidebar = (
    <aside className="w-60 flex flex-col h-full flex-shrink-0" style={{ background: '#0F2557' }}>
      {/* Brand header */}
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

      {/* Nav */}
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

      {/* User footer */}
      <div className="px-2 py-3 border-t border-white/10">
        <button
          onClick={() => setProfileOpen(true)}
          className="w-full flex items-center gap-3 px-3 mb-2 py-2 rounded-xl text-left transition-colors hover:bg-white/10"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'rgba(245,130,30,0.3)', color: '#F5821E' }}
          >
            {getInitials(user?.full_name || user?.email)}
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold truncate">{user?.full_name || user?.email}</div>
            <div className="text-blue-300 text-xs">{formatRole(user?.role)}</div>
          </div>
        </button>
        <button onClick={logout} className="sidebar-link w-full">
          <LogOut size={15} />Sign Out
        </button>
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
        {/* Mobile topbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-30 shadow-sm">
          <button onClick={() => setOpen(true)} className="md:hidden p-1.5 rounded-lg text-gray-600 hover:bg-gray-100">
            <Menu size={22} />
          </button>
          <div className="md:hidden"><BrandLogo size="sm" /></div>
          <span className="md:hidden text-xs font-semibold ml-1" style={{ color: '#F5821E' }}>Reception</span>
          <div className="flex-1" />
          <button onClick={() => setHelpOpen(true)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Help & Support">
            <HelpCircle size={16} />
          </button>
        </div>
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
      <ChatWidget />
      <HelpWidget open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Profile modal */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeProfile} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 overflow-hidden">
            {!pwStep ? (
              <>
                <div className="px-6 py-5" style={{ background: '#0F2557' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">My Profile</span>
                    <button onClick={closeProfile} className="text-white/60 hover:text-white"><X size={16} /></button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
                      style={{ background: 'rgba(245,130,30,0.3)', color: '#F5821E' }}>
                      {getInitials(user?.full_name || user?.email)}
                    </div>
                    <div>
                      <div className="text-white font-bold text-base leading-tight">{user?.full_name || user?.email}</div>
                      <div className="text-blue-300 text-sm mt-0.5">{formatRole(user?.role)}</div>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 space-y-1">
                  {user?.email && <p className="text-sm text-gray-500 mb-3">{user.email}</p>}
                  <button onClick={() => setPwStep(true)} className="sidebar-link w-full" style={{ color: '#374151', background: 'none' }}>
                    <Lock size={15} />Change Password
                  </button>
                  <button onClick={() => { logout(); closeProfile() }} className="sidebar-link w-full" style={{ color: '#dc2626', background: 'none' }}>
                    <LogOut size={15} />Sign Out
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800">Change Password</h3>
                  <button onClick={() => { setPwStep(false); setPwErr(''); setPwForm({ current: '', next: '' }) }} className="text-gray-400 hover:text-gray-700">
                    <X size={16} />
                  </button>
                </div>
                <div className="px-6 py-4 space-y-3">
                  <div>
                    <label className="label">Current Password</label>
                    <input type="password" className="input" placeholder="Enter current password"
                      value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">New Password</label>
                    <input type="password" className="input" placeholder="Minimum 6 characters"
                      value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} />
                  </div>
                  {pwErr && <p className="text-red-600 text-sm">{pwErr}</p>}
                  <button
                    onClick={handleChangePw}
                    disabled={pwSaving || !pwForm.current || pwForm.next.length < 6}
                    className="btn-primary w-full justify-center"
                  >
                    {pwSaving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                    {pwSaving ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
