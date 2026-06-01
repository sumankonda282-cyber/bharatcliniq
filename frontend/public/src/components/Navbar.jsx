import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import BrandLogo from './BrandLogo'

const PROVIDER_URL = import.meta.env.VITE_PROVIDER_URL || 'https://bharatcliniq-provider.vercel.app'
const PATIENT_URL  = import.meta.env.VITE_PATIENT_URL  || 'https://bharatcliniq-patient.vercel.app'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/"><BrandLogo size="md" /></Link>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/clinics" className="text-sm font-medium text-gray-600 hover:text-[#0F2557] transition-colors">Find Clinics</Link>
            <Link to="/booking/check" className="text-sm font-medium text-gray-600 hover:text-[#0F2557] transition-colors">My Booking</Link>
            <Link to="/register" className="text-sm font-medium text-gray-600 hover:text-[#0F2557] transition-colors">Register Clinic</Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <a href={PROVIDER_URL}
              className="inline-flex items-center px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all"
              style={{ borderColor: '#0F2557', color: '#0F2557' }}
              onMouseEnter={e => { e.currentTarget.style.background='#0F2557'; e.currentTarget.style.color='white' }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#0F2557' }}>
              Provider Login
            </a>
            <a href={PATIENT_URL}
              className="inline-flex items-center px-4 py-2 rounded-xl font-semibold text-sm text-white transition-all"
              style={{ background: '#CC1414' }}
              onMouseEnter={e => { e.currentTarget.style.background='#b01010' }}
              onMouseLeave={e => { e.currentTarget.style.background='#CC1414' }}>
              Patient Login
            </a>
          </div>

          <button className="md:hidden p-2 text-gray-600" onClick={() => setOpen(!open)}>
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden pb-4 pt-2 flex flex-col gap-2 border-t border-gray-100">
            <Link to="/clinics" className="text-gray-600 font-medium px-2 py-2 text-sm" onClick={() => setOpen(false)}>Find Clinics</Link>
            <Link to="/booking/check" className="text-gray-600 font-medium px-2 py-2 text-sm" onClick={() => setOpen(false)}>My Booking</Link>
            <Link to="/register" className="text-gray-600 font-medium px-2 py-2 text-sm" onClick={() => setOpen(false)}>Register Clinic</Link>
            <div className="flex gap-2 mt-1">
              <a href={PROVIDER_URL} className="flex-1 text-center py-2 rounded-xl border-2 font-semibold text-sm" style={{ borderColor:'#0F2557', color:'#0F2557' }}>Provider</a>
              <a href={PATIENT_URL} className="flex-1 text-center py-2 rounded-xl font-semibold text-sm text-white" style={{ background:'#CC1414' }}>Patient</a>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
