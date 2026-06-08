import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Video, Star, MapPin, Stethoscope, ArrowLeft,
  Clock, CheckCircle, Shield, Smartphone, Search
} from 'lucide-react'
import { publicApi } from '../api/client'
import BrandLogo from '../components/BrandLogo'

const PROVIDER_URL = import.meta.env.VITE_PROVIDER_URL || 'https://provider.bharathhealthsystems.com'
const PATIENT_URL  = import.meta.env.VITE_PATIENT_URL  || 'https://my.bharathhealthsystems.com'

const SPECIALTIES = [
  'General Medicine', 'Cardiology', 'Dermatology', 'Pediatrics',
  'Orthopedics', 'Gynecology', 'Psychiatry', 'ENT',
]

function Navbar() {
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link to="/"><BrandLogo size="md" /></Link>
        <div className="hidden md:flex items-center gap-6">
          <Link to="/clinics" className="text-sm font-medium text-gray-600 hover:text-[#0F2557]">Find Clinics</Link>
          <Link to="/telehealth" className="text-sm font-semibold" style={{ color: '#F5821E' }}>Telehealth</Link>
          <Link to="/register" className="text-sm font-medium text-gray-600 hover:text-[#0F2557]">Register Clinic</Link>
        </div>
        <div className="flex items-center gap-3">
          <a href={PROVIDER_URL} className="hidden md:block px-4 py-2 rounded-xl border-2 font-semibold text-sm" style={{ borderColor:'#0F2557', color:'#0F2557' }}>Provider Login</a>
          <a href={PATIENT_URL} className="px-4 py-2 rounded-xl font-semibold text-sm text-white" style={{ background:'#CC1414' }}>My Health Portal</a>
        </div>
      </div>
    </nav>
  )
}

function DoctorCard({ doctor }) {
  return (
    <Link
      to={`/clinics/${doctor.clinic_slug}`}
      className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-all group block"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-white text-lg"
          style={{ background: 'linear-gradient(135deg, #0F2557 0%, #1a3a7a 100%)' }}>
          {doctor.name?.charAt(0) || 'D'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm truncate" style={{ color: '#0F2557' }}>Dr. {doctor.name}</h3>
          <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5">
            <Stethoscope className="w-3 h-3 flex-shrink-0" style={{ color: '#F5821E' }} />
            <span className="truncate">{doctor.specialty}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400 text-xs mt-0.5">
            <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: '#CC1414' }} />
            <span className="truncate">{doctor.clinic_name} · {doctor.city}</span>
          </div>
          {doctor.experience_years > 0 && (
            <div className="text-xs text-gray-400 mt-0.5">{doctor.experience_years} yrs experience</div>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm font-bold" style={{ color: '#0F2557' }}>
          ₹{doctor.telehealth_fee?.toLocaleString('en-IN') || '—'}
          <span className="text-xs font-normal text-gray-400"> / session</span>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full text-white"
          style={{ background: '#F5821E' }}>
          <Video className="w-3 h-3" />Book Virtual
        </span>
      </div>
    </Link>
  )
}

export default function TelehealthPage() {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [specialty, setSpecialty] = useState('')
  const [search, setSearch] = useState('')

  const load = (sp = specialty) => {
    setLoading(true)
    publicApi.getTelehealthDoctors({ specialty: sp || undefined })
      .then(d => setDoctors(Array.isArray(d) ? d : []))
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const filtered = search
    ? doctors.filter(d =>
        d.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.specialty?.toLowerCase().includes(search.toLowerCase()) ||
        d.clinic_name?.toLowerCase().includes(search.toLowerCase())
      )
    : doctors

  return (
    <div className="min-h-screen" style={{ background: '#F0F4F8' }}>
      <Navbar />

      {/* Hero */}
      <div className="text-white py-14 px-4" style={{ background: 'linear-gradient(135deg, #0F2557 0%, #1a3a7a 100%)' }}>
        <div className="max-w-4xl mx-auto text-center">
          <Link to="/" className="inline-flex items-center gap-1 text-blue-200 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6"
            style={{ background: 'rgba(245,130,30,0.2)', color: '#F5821E', border: '1px solid rgba(245,130,30,0.3)' }}>
            <Video className="w-4 h-4" />
            Telehealth — Consult from Anywhere
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight">
            See a Doctor<br />
            <span style={{ color: '#F5821E' }}>Without Leaving Home</span>
          </h1>
          <p className="text-blue-200 text-lg mb-8 max-w-2xl mx-auto">
            Book a virtual consultation with verified doctors. Secure video call, digital prescription, and complete medical record — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            {[
              { icon: CheckCircle, text: 'Verified Doctors' },
              { icon: Shield, text: 'Secure & Private' },
              { icon: Clock, text: 'No Waiting Room' },
              { icon: Smartphone, text: 'Works on Any Device' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-sm text-blue-200">
                <Icon className="w-4 h-4" style={{ color: '#F5821E' }} />{text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white py-12 px-4 border-b border-gray-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-8" style={{ color: '#0F2557' }}>How Telehealth Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Choose a Doctor', desc: 'Browse telehealth-enabled doctors by specialty' },
              { step: '2', title: 'Book a Slot', desc: 'Pick a date and time that works for you' },
              { step: '3', title: 'Join the Call', desc: 'Click "Join" from your My Health Portal at appointment time' },
              { step: '4', title: 'Get Your Prescription', desc: 'Doctor issues digital prescription directly to your portal' },
            ].map(item => (
              <div key={item.step} className="text-center">
                <div className="w-10 h-10 rounded-full text-white font-bold text-base flex items-center justify-center mx-auto mb-3"
                  style={{ background: '#F5821E' }}>{item.step}</div>
                <h3 className="font-semibold text-sm mb-1" style={{ color: '#0F2557' }}>{item.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Doctor listing */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by doctor name, specialty..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': '#0F2557' }}
            />
          </div>
          <select
            value={specialty}
            onChange={e => { setSpecialty(e.target.value); load(e.target.value) }}
            className="md:w-52 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': '#0F2557' }}
          >
            <option value="">All Specialties</option>
            {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#0F2557', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No telehealth doctors available right now</p>
            <p className="text-sm mt-1">Check back soon — more doctors are enabling virtual consultations.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">{filtered.length} doctor{filtered.length !== 1 ? 's' : ''} available for virtual consultation</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(d => <DoctorCard key={d.doctor_profile_id} doctor={d} />)}
            </div>
          </>
        )}

        {/* CTA if not logged in */}
        <div className="mt-12 bg-white rounded-2xl shadow-md border border-gray-100 p-8 text-center">
          <Video className="w-10 h-10 mx-auto mb-3" style={{ color: '#F5821E' }} />
          <h3 className="text-lg font-bold mb-2" style={{ color: '#0F2557' }}>Ready for your virtual consultation?</h3>
          <p className="text-gray-500 text-sm mb-5">Login to My Health Portal to book and join your telehealth session.</p>
          <a href={PATIENT_URL}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white"
            style={{ background: '#CC1414' }}>
            <Video className="w-4 h-4" />Go to My Health Portal
          </a>
        </div>
      </div>
    </div>
  )
}
