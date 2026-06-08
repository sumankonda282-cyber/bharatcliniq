import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BedDouble, Activity, ClipboardList, Pill,
  Stethoscope, ArrowLeftRight, LogOut, Menu, X, Sun, Sunset, Moon,
  FileText, ClipboardCheck, KeyRound, Settings
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useWardSession } from '../contexts/WardSessionContext'
import ChatWidget from './ChatWidget'
import logoImg from '../assets/logo.png'

// ── Nav definitions ───────────────────────────────────────────────────────────

const NURSE_NAV = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard',    end: true },
  { to: '/ward-board',   icon: BedDouble,       label: 'Ward Board'             },
  { to: '/vitals',       icon: Activity,        label: 'Vitals'                 },
  { to: '/notes',        icon: ClipboardList,   label: 'Nursing Notes'          },
  { to: '/mar',          icon: Pill,            label: 'MAR'                    },
  { to: '/assessments',  icon: ClipboardCheck,  label: 'Assessments'            },
  { to: '/handoff',      icon: ArrowLeftRight,  label: 'Shift Handoff'          },
]

const PROVIDER_NAV = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard',    end: true },
  { to: '/ward-board',    icon: BedDouble,       label: 'Ward Board'             },
  { to: '/rounds',        icon: Stethoscope,     label: 'Ward Rounds'            },
  { to: '/progress-notes',icon: FileText,        label: 'Progress Notes'         },
  { to: '/orders',        icon: ClipboardList,   label: 'Orders',   disabled: true },
  { to: '/handoff',       icon: ArrowLeftRight,  label: 'Shift Handoff'          },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function getShift() {
  const h = new Date().getHours()
  if (h >= 6 && h < 14)  return { label: 'Morning',   icon: Sun,    color: '#F5821E', range: '6am–2pm'   }
  if (h >= 14 && h < 22) return { label: 'Afternoon',  icon: Sunset, color: '#d97706', range: '2pm–10pm'  }
  return                         { label: 'Night',      icon: Moon,   color: '#6366f1', range: '10pm–6am'  }
}

function formatDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

function formatRole(role) {
  if (!role) return ''
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Brand logo ────────────────────────────────────────────────────────────────

function BrandLogo({ compact }) {
  if (compact) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <img src={logoImg} alt="BHarath Health Systems" style={{ height: 32, width: 'auto' }} />
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <img src={logoImg} alt="BHarath Health Systems" style={{ height: 36, width: 'auto', flexShrink: 0 }} />
      <div>
        <div className="font-extrabold text-base leading-tight" style={{ letterSpacing: '-0.02em' }}>
          <span style={{ color: '#CC1414' }}>BH</span>
          <span className="text-white">arath Health</span>
        </div>
        <div className="text-white font-semibold italic text-xs" style={{ letterSpacing: '0.02em' }}>
          Systems
        </div>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ onClose, compact }) {
  const { user, logout } = useAuth()
  const { mode, department, ward } = useWardSession()
  const navItems = mode === 'provider' ? PROVIDER_NAV : NURSE_NAV

  return (
    <aside
      className={`${compact ? 'w-[60px]' : 'w-56'} flex flex-col h-full flex-shrink-0 transition-all duration-200`}
      style={{ background: '#065F46' }}
    >
      {/* Brand header */}
      <div className={`${compact ? 'px-2 py-4 justify-center' : 'px-4 py-4'} border-b border-white/10 flex items-center justify-between`}>
        <BrandLogo compact={compact} />
        {onClose && (
          <button onClick={onClose} className="md:hidden text-white/60 hover:text-white ml-auto">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Ward info strip */}
      {!compact && department && (
        <div className="px-4 py-1.5 border-b border-white/10">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6ee7b7' }}>
            Ward Portal
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(110,231,183,0.7)' }}>
            {department.name}{ward ? ` · ${ward.name}` : ''}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex-1 ${compact ? 'px-1' : 'px-2'} py-3 overflow-y-auto`}>
        {navItems.map(({ to, icon: Icon, label, end, disabled }) =>
          disabled ? (
            <div
              key={to}
              className={`flex items-center ${compact ? 'justify-center px-2' : 'gap-3 px-3'} py-2 rounded-lg text-sm mb-0.5 cursor-not-allowed`}
              style={{ color: 'rgba(255,255,255,0.3)' }}
              title={label}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!compact && <span>{label}</span>}
              {!compact && (
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                  Soon
                </span>
              )}
            </div>
          ) : (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              title={compact ? label : undefined}
              className={({ isActive }) =>
                `flex items-center ${compact ? 'justify-center px-2' : 'gap-3 px-3'} py-2 rounded-lg text-sm mb-0.5 transition-colors
                 ${isActive
                   ? 'bg-white/15 text-white font-semibold'
                   : 'text-white/70 hover:bg-white/10 hover:text-white'}`
              }
            >
              <Icon size={16} className="flex-shrink-0" />
              {!compact && <span>{label}</span>}
            </NavLink>
          )
        )}
      </nav>

      {/* User footer */}
      <div className={`${compact ? 'px-1' : 'px-2'} py-3 border-t border-white/10`}>
        {!compact && (
          <div className="flex items-center gap-2 px-2 mb-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'rgba(110,231,183,0.2)', color: '#6ee7b7' }}
            >
              {getInitials(user?.full_name || user?.email)}
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate">{user?.full_name || user?.email}</div>
              <div className="text-xs truncate" style={{ color: '#6ee7b7' }}>{formatRole(user?.role)}</div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          title={compact ? 'Sign Out' : undefined}
          className={`flex items-center ${compact ? 'justify-center px-2' : 'gap-2 px-3'} py-2 rounded-lg text-sm w-full text-white/60 hover:bg-white/10 hover:text-white transition-colors`}
        >
          <LogOut size={15} />
          {!compact && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function Layout() {
  const { user, logout } = useAuth()
  const { mode, switchMode, department, ward } = useWardSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const shift = getShift()
  const ShiftIcon = shift.icon
  const location = useLocation()
  const isPatientChart = location.pathname.startsWith('/patient/')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      {/* Mobile sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setOpen(false)} />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar compact={isPatientChart} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 h-screen">
        {/* Top bar */}
        <header className="flex-shrink-0 bg-emerald-800 text-white px-4 py-2.5 flex items-center gap-3">
          <div className="font-bold text-base tracking-tight">CareChart</div>
          <div className="flex-1" />

          {/* Shift indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium" style={{ color: shift.color === '#F5821E' ? '#fbbf24' : shift.color === '#d97706' ? '#fcd34d' : '#a5b4fc' }}>
            <ShiftIcon size={13} />
            <span>{shift.label} ({shift.range})</span>
          </div>

          <span className="hidden md:block text-emerald-200 text-xs">
            {user?.full_name} · {formatRole(user?.role)}
          </span>

          <button onClick={() => navigate('/pin-setup')} className="p-1.5 hover:bg-emerald-700 rounded" title="PIN Setup">
            <KeyRound size={14} />
          </button>
          <button onClick={() => navigate('/account')} className="p-1.5 hover:bg-emerald-700 rounded" title="Account">
            <Settings size={14} />
          </button>
          <button onClick={logout} className="p-1.5 hover:bg-emerald-700 rounded" title="Sign Out">
            <LogOut size={14} />
          </button>
        </header>

        {/* Sub-bar: mode toggle + context */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 py-2 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setOpen(true)} className="md:hidden p-1.5 rounded text-gray-600 hover:bg-gray-100 flex-shrink-0">
              <Menu size={20} />
            </button>
            {department ? (
              <span className="hidden md:block text-xs text-gray-500 truncate">
                {department.name}{ward ? ` · ${ward.name}` : ' · All Wards'}
              </span>
            ) : (
              <span className="hidden md:block text-xs text-gray-400">{formatDate(new Date())}</span>
            )}
          </div>

          {/* Mode toggle */}
          <div className="flex items-center bg-gray-100 rounded-full p-0.5 gap-0.5 flex-shrink-0">
            <button
              onClick={() => switchMode('nurse')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                mode === 'nurse' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Nurse
            </button>
            <button
              onClick={() => switchMode('provider')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                mode === 'provider' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Provider
            </button>
          </div>

          <span className="text-xs text-gray-400 hidden sm:block">{formatDate(new Date())}</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className={isPatientChart ? '' : 'p-4 md:p-6'}>
            <Outlet />
          </div>
        </main>

        <ChatWidget />
      </div>
    </div>
  )
}
