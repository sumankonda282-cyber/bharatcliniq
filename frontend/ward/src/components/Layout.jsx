import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, BedDouble, Activity, ClipboardList, Pill,
  Stethoscope, ArrowLeftRight, LogOut, Menu, X, Sun, Sunset, Moon
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ward-board', icon: BedDouble,    label: 'Ward Board' },
  { to: '/vitals',  icon: Activity,        label: 'Vitals' },
  { to: '/notes',   icon: ClipboardList,   label: 'Nursing Notes' },
  { to: '/mar',     icon: Pill,            label: 'MAR' },
  { to: '/rounds',  icon: Stethoscope,     label: 'Ward Rounds' },
  { to: '/handoff', icon: ArrowLeftRight,  label: 'Shift Handoff' },
]

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function getShift() {
  const h = new Date().getHours()
  if (h >= 6 && h < 14) return { label: 'Morning Shift', icon: Sun, color: '#F5821E', range: '6am–2pm' }
  if (h >= 14 && h < 22) return { label: 'Afternoon Shift', icon: Sunset, color: '#d97706', range: '2pm–10pm' }
  return { label: 'Night Shift', icon: Moon, color: '#6366f1', range: '10pm–6am' }
}

function formatDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

function formatRole(role) {
  if (!role) return ''
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function Layout() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const shift = getShift()
  const ShiftIcon = shift.icon

  const sidebar = (
    <aside className="w-60 flex flex-col h-full flex-shrink-0" style={{ background: '#065F46' }}>
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <div className="text-white font-extrabold text-lg tracking-tight">BHaratCliniq</div>
          <div className="text-xs font-semibold mt-0.5 tracking-wider uppercase" style={{ color: '#6ee7b7' }}>
            Ward Portal
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="md:hidden text-white/60 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
          >
            <Icon size={17} />{label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'rgba(110,231,183,0.2)', color: '#6ee7b7' }}
          >
            {getInitials(user?.full_name || user?.email)}
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold truncate">{user?.full_name || user?.email}</div>
            <div className="text-emerald-300 text-xs truncate">{formatRole(user?.role)}</div>
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
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="md:hidden p-1.5 rounded-lg text-gray-600 hover:bg-gray-100">
              <Menu size={22} />
            </button>
            <span className="hidden md:block text-sm text-gray-500">{formatDate(new Date())}</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: shift.color }}>
            <ShiftIcon size={15} />
            <span>{shift.label}</span>
            <span className="text-gray-400 font-normal">({shift.range})</span>
          </div>
        </div>

        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
