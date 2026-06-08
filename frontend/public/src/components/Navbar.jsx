import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Video, Pill } from 'lucide-react'
import BrandLogo from './BrandLogo'

const PROVIDER_URL = import.meta.env.VITE_PROVIDER_URL || 'https://provider.bharathhealthsystems.com'
const PATIENT_URL  = import.meta.env.VITE_PATIENT_URL  || 'https://my.bharathhealthsystems.com'

const NAV_LINKS = [
  { to: '/clinics',       label: 'Find Clinics' },
  { to: '/telehealth',    label: 'Telehealth',    icon: Video, iconColor: '#F5821E' },
  { to: '/pharmacy',      label: 'Medicines',     icon: Pill,  iconColor: '#138808' },
  { to: '/booking/check', label: 'My Booking' },
  { to: '/register',      label: 'Register Free' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className="bg-white sticky top-0 z-50 border-b border-gray-100 transition-shadow duration-200"
      style={{ boxShadow: scrolled ? '0 2px 16px rgba(15,37,87,0.08)' : 'none' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <BrandLogo size="md" />
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label, icon: Icon, iconColor }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-[#0F2557] hover:bg-gray-50 transition-all"
              >
                {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: iconColor }} />}
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-2.5">
            <a
              href={PROVIDER_URL}
              className="inline-flex items-center px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all"
              style={{ borderColor: '#0F2557', color: '#0F2557' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#0F2557'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#0F2557' }}
            >
              Provider Login
            </a>
            <a
              href={PATIENT_URL}
              className="inline-flex items-center px-4 py-2 rounded-xl font-semibold text-sm text-white transition-all"
              style={{ background: '#CC1414' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#b01010' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#CC1414' }}
            >
              My Health Portal
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="lg:hidden pb-4 pt-2 border-t border-gray-100 flex flex-col gap-1">
            {NAV_LINKS.map(({ to, label, icon: Icon, iconColor }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setOpen(false)}
              >
                {Icon && <Icon className="w-4 h-4" style={{ color: iconColor }} />}
                {label}
              </Link>
            ))}
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <a href={PROVIDER_URL}
                className="flex-1 text-center py-2.5 rounded-xl border-2 font-semibold text-sm"
                style={{ borderColor: '#0F2557', color: '#0F2557' }}>
                Provider Login
              </a>
              <a href={PATIENT_URL}
                className="flex-1 text-center py-2.5 rounded-xl font-semibold text-sm text-white"
                style={{ background: '#CC1414' }}>
                My Health Portal
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
