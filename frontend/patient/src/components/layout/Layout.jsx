import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  LayoutDashboard, Calendar, Pill, FlaskConical, Receipt, LogOut,
  Menu, FileText, Smartphone, Video, Settings2, HelpCircle,
  RefreshCw, Copy, Check, ChevronDown, X
} from 'lucide-react'
import BrandLogo from '../BrandLogo'
import InstallPrompt, { useInstallState, InstallModal } from '../InstallPrompt'
import { cacheClear } from '../../utils/cache'

const NAV = [
  { to: '/',              label: 'Dashboard',        icon: LayoutDashboard, end: true },
  { to: '/appointments',  label: 'Appointments',     icon: Calendar },
  { to: '/telehealth',    label: 'Telehealth',       icon: Video },
  { to: '/history',       label: 'Clinical History', icon: FileText },
  { to: '/prescriptions', label: 'Prescriptions',    icon: Pill },
  { to: '/lab-results',   label: 'Lab Results',      icon: FlaskConical },
  { to: '/bills',         label: 'Bills',            icon: Receipt },
]

function BHIDChip({ bhId }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(bhId?.toUpperCase() || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  if (!bhId) return null
  return (
    <button onClick={copy} title="Copy BH ID"
      className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors hover:bg-orange-100"
      style={{ background: '#FFF4E8', color: '#F5821E' }}>
      {bhId.toUpperCase()}
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}

function AvatarMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'P'

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const copyBhId = () => {
    navigator.clipboard.writeText(user?.bh_id?.toUpperCase() || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const go = (path) => { setOpen(false); navigate(path) }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} title={user?.full_name}
        className="flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-full hover:bg-gray-100 transition-colors">
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
          style={{ background: '#CC1414' }}>{initials}</div>
        <ChevronDown size={13} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50">
          {/* Identity */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="font-semibold text-gray-900 text-sm truncate">{user?.full_name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{user?.mobile || user?.email}</div>
            {user?.bh_id && (
              <button onClick={copyBhId} title="Copy BH ID"
                className="mt-2 sm:hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold"
                style={{ background: '#FFF4E8', color: '#F5821E' }}>
                {user.bh_id.toUpperCase()}
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
            )}
          </div>
          {/* Actions */}
          <button onClick={() => go('/settings')}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            <Settings2 size={15} className="text-gray-400" />Settings
          </button>
          <a href="mailto:support@bharathhealthsystems.com?subject=Patient Portal Help"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            <HelpCircle size={15} className="text-gray-400" />Help & Support
          </a>
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-2xl">
              <LogOut size={15} />Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [installing, setInstalling] = useState(false)
  const { canInstall, isIos, installed, install } = useInstallState('BHarath Health')

  const currentLabel = NAV.find(n => {
    if (n.end) return location.pathname === n.to
    return location.pathname === n.to || location.pathname.startsWith(n.to + '/')
  })?.label || (location.pathname === '/settings' ? 'Settings' : 'Portal')

  const handleInstall = async () => {
    setInstalling(true)
    await install()
    setInstalling(false)
    setShowInstallModal(false)
  }

  const handleLogout = () => { logout(); navigate('/login') }

  // Refresh = drop the IndexedDB cache first, otherwise stale data is re-served on reload
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = async () => {
    setRefreshing(true)
    await cacheClear()
    window.location.reload()
  }

  const SidebarContent = ({ mobile = false }) => (
    <div className="flex flex-col h-full" style={{ background: '#0F2557' }}>
      <div className="px-4 py-4 flex items-center justify-between border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <BrandLogo size="sm" light />
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="p-1.5 text-white/50 hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}>
            <item.icon size={17} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      {canInstall && !installed && (
        <div className="px-3 pb-3">
          <button onClick={() => setShowInstallModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(245,130,30,0.15)', color: '#F5821E', border: '1px solid rgba(245,130,30,0.3)' }}>
            <Smartphone size={14} />
            {isIos ? 'Add to Home Screen' : 'Install App'}
          </button>
        </div>
      )}
      <div className="h-3" />
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F0F4F8' }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-52 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-56 flex flex-col"><SidebarContent mobile /></div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Right panel: header + content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Persistent top header */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 lg:px-5 gap-3 flex-shrink-0 z-30">
          <button onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 flex-shrink-0">
            <Menu size={20} />
          </button>

          {/* Section title */}
          <span className="font-bold text-[15px] flex-1 min-w-0 truncate" style={{ color: '#0F2557' }}>
            {currentLabel}
          </span>

          {/* Actions: BHID · Refresh · Avatar (Settings/Help/Sign out live in the avatar menu) */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <BHIDChip bhId={user?.bh_id} />
            <button onClick={handleRefresh} title="Refresh data"
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <AvatarMenu user={user} onLogout={handleLogout} />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      <InstallPrompt appName="BHarath Health" />
      {showInstallModal && (
        <InstallModal appName="BHarath Health" isIos={isIos} installing={installing}
          onInstall={handleInstall} onClose={() => setShowInstallModal(false)} />
      )}
    </div>
  )
}
