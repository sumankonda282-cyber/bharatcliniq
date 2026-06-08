import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Search, Calendar, FileText, Pill, FlaskConical,
  ReceiptText, BarChart3, ChevronRight, Star,
  Users, Building2, ArrowRight, Menu, X,
  MapPin, Shield, Clock, CheckCircle, Video
} from 'lucide-react'
import { publicApi } from '../api/client'
import BrandLogo from '../components/BrandLogo'

const PROVIDER_URL = import.meta.env.VITE_PROVIDER_URL || 'https://provider.bharathhealthsystems.com'
const PATIENT_URL  = import.meta.env.VITE_PATIENT_URL  || 'https://my.bharathhealthsystems.com'

function Navbar() {
  const [open, setOpen] = useState(false)
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/"><BrandLogo size="md" /></Link>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/clinics" className="text-gray-600 hover:text-[#0F2557] font-medium transition-colors text-sm">Find Clinics</Link>
            <Link to="/telehealth" className="text-gray-600 hover:text-[#0F2557] font-medium transition-colors text-sm flex items-center gap-1">
              <Video className="w-3.5 h-3.5" style={{ color: '#F5821E' }} />Telehealth
            </Link>
            <Link to="/pharmacy" className="text-gray-600 hover:text-[#0F2557] font-medium transition-colors text-sm flex items-center gap-1">
              <Pill className="w-3.5 h-3.5" style={{ color: '#F5821E' }} />Order Medicine
            </Link>
            <Link to="/booking/check" className="text-gray-600 hover:text-[#0F2557] font-medium transition-colors text-sm">My Booking</Link>
            <Link to="/register" className="text-gray-600 hover:text-[#0F2557] font-medium transition-colors text-sm">Register Free</Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <a
              href={PROVIDER_URL}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all"
              style={{ borderColor: '#0F2557', color: '#0F2557' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#0F2557'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#0F2557' }}
            >
              Provider Login
            </a>
            <a
              href={PATIENT_URL}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm text-white transition-all"
              style={{ background: '#CC1414' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#b01010' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#CC1414' }}
            >
              My Health Portal
            </a>
          </div>

          <button className="md:hidden p-2 text-gray-600" onClick={() => setOpen(!open)}>
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden pb-4 pt-2 flex flex-col gap-2 border-t border-gray-100">
            <Link to="/clinics" className="text-gray-600 font-medium px-2 py-2 text-sm" onClick={() => setOpen(false)}>Find Clinics</Link>
            <Link to="/pharmacy" className="text-gray-600 font-medium px-2 py-2 text-sm" onClick={() => setOpen(false)}>Order Medicine</Link>
            <Link to="/booking/check" className="text-gray-600 font-medium px-2 py-2 text-sm" onClick={() => setOpen(false)}>My Booking</Link>
            <Link to="/register" className="text-gray-600 font-medium px-2 py-2 text-sm" onClick={() => setOpen(false)}>Register Free</Link>
            <div className="flex gap-2 mt-1">
              <a href={PROVIDER_URL} className="flex-1 text-center py-2 rounded-xl border-2 font-semibold text-sm" style={{ borderColor: '#0F2557', color: '#0F2557' }}>Provider Login</a>
              <a href={PATIENT_URL} className="flex-1 text-center py-2 rounded-xl font-semibold text-sm text-white" style={{ background: '#CC1414' }}>My Health Portal</a>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer style={{ background: '#0F2557' }} className="text-blue-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div>
            <div className="mb-4">
              <BrandLogo size="md" light />
            </div>
            <p className="text-xs text-blue-300 mt-2 mb-1 font-medium tracking-wider uppercase">India's Digital Health Network</p>
            <p className="text-sm leading-relaxed text-blue-200 mt-3">
              Connecting patients with quality healthcare across India. India's trusted digital health network.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">For Patients</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/clinics" className="hover:text-white transition-colors">Find Clinics</Link></li>
              <li><Link to="/book" className="hover:text-white transition-colors">Book Appointment</Link></li>
              <li><Link to="/pharmacy" className="hover:text-white transition-colors">Order Medicine</Link></li>
              <li><Link to="/booking/check" className="hover:text-white transition-colors">Check Booking Status</Link></li>
              <li><a href={PATIENT_URL} className="hover:text-white transition-colors">My Health Portal</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">For Clinics</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/register" className="hover:text-white transition-colors">Register Free</Link></li>
              <li><a href={PROVIDER_URL} className="hover:text-white transition-colors">Provider Dashboard</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Contact</h4>
            <ul className="space-y-2.5 text-sm">
              <li>support@bharathhealthsystems.com</li>
              <li>1800-XXX-XXXX (Toll Free)</li>
              <li>Mon–Sat, 9am–6pm IST</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-blue-800 mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-blue-300">
          <p>© {new Date().getFullYear()} BHarath Health Systems. All rights reserved.</p>
          <p>Made with ❤️ in India</p>
        </div>
      </div>
    </footer>
  )
}

const FEATURES = [
  { icon: Calendar, title: 'Online Appointments', desc: 'Patients book slots 24/7. Automated reminders reduce no-shows by 60%.', color: '#CC1414' },
  { icon: FileText, title: 'Digital EMR', desc: 'Paperless electronic medical records. Secure, searchable patient history.', color: '#0F2557' },
  { icon: Pill, title: 'Pharmacy Module', desc: 'Integrated dispensing, inventory alerts, and prescription tracking.', color: '#F5821E' },
  { icon: FlaskConical, title: 'Lab Integration', desc: 'Order tests, receive reports digitally, share with patients instantly.', color: '#138808' },
  { icon: ReceiptText, title: 'Smart Billing', desc: 'GST-ready invoicing, insurance claims, and UPI/card payments.', color: '#7C3AED' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Revenue trends, patient flow, and performance insights at a glance.', color: '#0891B2' },
]

const TESTIMONIALS = [
  {
    name: 'Dr. Priya Sharma',
    role: 'General Physician, Mumbai',
    avatar: 'PS',
    rating: 5,
    text: 'BHarath Health Systems transformed my practice. Patient wait times dropped by 40% and billing became completely hassle-free.',
    color: '#CC1414',
  },
  {
    name: 'Rajesh Kumar',
    role: 'Patient, Bangalore',
    avatar: 'RK',
    rating: 5,
    text: 'Finding a good doctor used to take hours. Now I book appointments in 2 minutes from my phone. Excellent service!',
    color: '#0F2557',
  },
  {
    name: 'Dr. Amit Patel',
    role: 'Cardiologist, Ahmedabad',
    avatar: 'AP',
    rating: 5,
    text: "The EMR system is intuitive and the analytics help me understand my clinic's growth month over month.",
    color: '#F5821E',
  },
]

function CitySearch({ value, onChange, cities, placeholder = 'Select city' }) {
  const [input, setInput] = useState(value || '')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const filtered = input.trim()
    ? cities.filter(c => c.toLowerCase().startsWith(input.toLowerCase())).sort()
    : [...cities].sort()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (c) => { setInput(c); onChange(c); setOpen(false) }
  const clear = () => { setInput(''); onChange(''); setOpen(false) }

  return (
    <div ref={ref} className="relative w-full">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
      <input
        type="text"
        value={input}
        onChange={e => { setInput(e.target.value); onChange(''); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-3 rounded-xl text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 text-sm bg-white"
        style={{ '--tw-ring-color': '#0F2557' }}
      />
      {input && (
        <button type="button" onClick={clear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto text-sm">
          <li
            className="px-3 py-2 cursor-pointer hover:bg-gray-50 text-gray-400 italic"
            onMouseDown={() => select('')}
          >All Cities</li>
          {filtered.map(c => (
            <li key={c} className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-gray-700"
              onMouseDown={() => select(c)}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [stats, setStats] = useState(null)
  const [cities, setCities] = useState([])

  useEffect(() => {
    publicApi.getStats().then(setStats).catch(() => setStats(null))
    publicApi.getCities().then(data => {
      setCities(Array.isArray(data) ? data : data.cities || [])
    }).catch(() => {
      setCities(['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad'])
    })
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (city) params.set('city', city)
    if (search) params.set('q', search)
    navigate(`/clinics?${params.toString()}`)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Navbar />

      {/* Hero */}
      <section
        style={{ background: '#0F2557', position: 'relative', overflow: 'hidden' }}
        className="text-white py-24 px-4"
      >
        {/* Geometric background pattern */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.06,
          backgroundImage: 'radial-gradient(circle at 20% 50%, #F5821E 0%, transparent 50%), radial-gradient(circle at 80% 20%, #CC1414 0%, transparent 40%)',
        }} />
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full pointer-events-none" style={{ background: 'rgba(245,130,30,0.08)' }} />
        <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'rgba(204,20,20,0.08)' }} />

        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-8"
            style={{ background: 'rgba(245,130,30,0.2)', color: '#F5821E', border: '1px solid rgba(245,130,30,0.3)' }}>
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Trusted by {stats ? `${stats.clinics.toLocaleString('en-IN')}+` : '—'} clinics across India
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6" style={{ letterSpacing: '-0.02em' }}>
            Healthcare at Your
            <br />
            <span style={{ color: '#F5821E' }}>Fingertips</span>
          </h1>
          <p className="text-lg md:text-xl text-blue-200 mb-10 max-w-2xl mx-auto leading-relaxed">
            Book appointments, access medical records, and manage your entire healthcare journey — all in one trusted platform.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="bg-white rounded-2xl p-2 flex flex-col sm:flex-row gap-2 max-w-2xl mx-auto shadow-2xl">
            <div className="flex-none sm:w-48">
              <CitySearch value={city} onChange={setCity} cities={cities} placeholder="Search city..." />
            </div>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Doctor name, specialty, clinic..."
                className="w-full pl-10 pr-4 py-3 rounded-xl text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 text-sm"
                style={{ '--tw-ring-color': '#0F2557' }}
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-xl font-semibold text-white text-sm whitespace-nowrap transition-colors"
              style={{ background: '#CC1414' }}
              onMouseEnter={e => e.currentTarget.style.background = '#b01010'}
              onMouseLeave={e => e.currentTarget.style.background = '#CC1414'}
            >
              Find a Clinic
            </button>
          </form>

          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Link to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}
            >
              Register Free <ArrowRight className="w-4 h-4" />
            </Link>
            <a href={PATIENT_URL}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: '#F5821E', color: 'white' }}
            >
              My Health Portal <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Stats ribbon */}
      <section className="bg-white py-10 border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { label: 'Registered Clinics', value: stats ? stats.clinics : null, icon: Building2, color: '#CC1414' },
              { label: 'Verified Doctors', value: stats ? stats.doctors : null, icon: Users, color: '#0F2557' },
              { label: 'Appointments Booked', value: stats ? stats.bookings : null, icon: Calendar, color: '#F5821E' },
              { label: 'Cities Covered', value: stats ? stats.cities : null, icon: MapPin, color: '#138808' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1"
                  style={{ background: color + '15' }}>
                  <Icon className="w-6 h-6" style={{ color }} />
                </div>
                <div className="text-3xl font-extrabold" style={{ color }}>
                  {value === null
                    ? <span className="text-gray-300 text-xl">—</span>
                    : value === 0
                      ? '0'
                      : value.toLocaleString('en-IN')}
                </div>
                <div className="text-gray-500 text-sm font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4" style={{ background: '#F0F4F8' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold" style={{ color: '#0F2557' }}>
              Everything your clinic needs
            </h2>
            <p className="text-lg text-gray-500 mt-3">One platform to manage your entire clinic operations</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div
                key={title}
                className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow group"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all"
                  style={{ background: color + '15' }}
                >
                  <Icon className="w-6 h-6" style={{ color }} />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#0F2557' }}>{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold" style={{ color: '#0F2557' }}>How It Works</h2>
            <p className="text-lg text-gray-500 mt-3">Simple steps to get started with BHarath Health Systems</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#CC141415' }}>
                  <Users className="w-5 h-5" style={{ color: '#CC1414' }} />
                </div>
                <h3 className="text-2xl font-bold" style={{ color: '#0F2557' }}>For Patients</h3>
              </div>
              <div className="space-y-6">
                {[
                  { step: '01', title: 'Search a Clinic', desc: 'Browse clinics by city, specialty, or doctor name. Read profiles and check availability.' },
                  { step: '02', title: 'Book an Appointment', desc: 'Select your preferred doctor, date, and time slot. Fill in basic patient details.' },
                  { step: '03', title: 'Visit & Get Treated', desc: 'Show your confirmation code at the clinic. Your medical history is ready digitally.' },
                ].map(item => (
                  <div key={item.step} className="flex gap-5">
                    <div className="w-12 h-12 text-white rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: '#CC1414' }}>
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1" style={{ color: '#0F2557' }}>{item.title}</h4>
                      <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0F255715' }}>
                  <Building2 className="w-5 h-5" style={{ color: '#0F2557' }} />
                </div>
                <h3 className="text-2xl font-bold" style={{ color: '#0F2557' }}>For Clinics</h3>
              </div>
              <div className="space-y-6">
                {[
                  { step: '01', title: 'Register Your Clinic', desc: 'Fill in clinic and doctor details. Submit for approval. We verify within 24 hours.' },
                  { step: '02', title: 'Set Up Your Profile', desc: 'Add doctors, configure time slots, set consultation fees, and upload logo.' },
                  { step: '03', title: 'Start Accepting Bookings', desc: 'Go live on BHarath Health Systems. Manage appointments, EMR, billing — all from one dashboard.' },
                ].map(item => (
                  <div key={item.step} className="flex gap-5">
                    <div className="w-12 h-12 text-white rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: '#0F2557' }}>
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1" style={{ color: '#0F2557' }}>{item.title}</h4>
                      <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4" style={{ background: '#F0F4F8' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold" style={{ color: '#0F2557' }}>Trusted across India</h2>
            <p className="text-lg text-gray-500 mt-3">What our doctors and patients say</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 text-white rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ background: t.color }}>
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#0F2557' }}>{t.name}</div>
                    <div className="text-gray-500 text-xs">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Telehealth Promo */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0F2557 0%, #1a3a7a 100%)' }}>
            <div className="flex flex-col lg:flex-row items-center gap-10 p-10 lg:p-14">
              <div className="flex-1 text-white">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6"
                  style={{ background: 'rgba(245,130,30,0.2)', color: '#F5821E', border: '1px solid rgba(245,130,30,0.3)' }}>
                  <Video className="w-4 h-4" /> Telehealth — Now Available
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
                  See a Doctor<br /><span style={{ color: '#F5821E' }}>From Home</span>
                </h2>
                <p className="text-blue-200 text-lg mb-8 leading-relaxed max-w-lg">
                  Book a video consultation with verified doctors. Secure call, digital prescription, and complete records — all in one place.
                </p>
                <div className="flex flex-wrap gap-4 mb-8">
                  {[
                    { icon: CheckCircle, text: 'Verified Doctors' },
                    { icon: Shield, text: 'Secure & Private' },
                    { icon: Clock, text: 'No Waiting Room' },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2 text-sm text-blue-200">
                      <Icon className="w-4 h-4" style={{ color: '#F5821E' }} />{text}
                    </div>
                  ))}
                </div>
                <Link to="/telehealth"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-white"
                  style={{ background: '#F5821E' }}>
                  <Video className="w-4 h-4" /> Browse Telehealth Doctors
                </Link>
              </div>
              <div className="flex-shrink-0 grid grid-cols-1 gap-4 w-full lg:w-72">
                {[
                  { step: '1', title: 'Choose a Doctor', desc: 'Browse by specialty' },
                  { step: '2', title: 'Book a Slot', desc: 'Pick your preferred time' },
                  { step: '3', title: 'Join the Call', desc: 'From My Health Portal' },
                  { step: '4', title: 'Get Prescription', desc: 'Digital, straight to you' },
                ].map(item => (
                  <div key={item.step} className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ background: '#F5821E' }}>{item.step}</div>
                    <div>
                      <div className="text-white font-semibold text-sm">{item.title}</div>
                      <div className="text-blue-200 text-xs">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 px-4" style={{ background: '#0F2557' }}>
        <div className="max-w-3xl mx-auto text-center text-white">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,130,30,0.2)' }}>
              <Shield className="w-8 h-8" style={{ color: '#F5821E' }} />
            </div>
          </div>
          <h2 className="text-3xl font-extrabold mb-4">Ready to modernize your clinic?</h2>
          <p className="text-blue-200 mb-8 text-lg leading-relaxed">
            Join clinics already on BHarath Health Systems. Registration is free. Go live in 24 hours.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm text-white transition-all"
              style={{ background: '#CC1414' }}
              onMouseEnter={e => e.currentTarget.style.background = '#b01010'}
              onMouseLeave={e => e.currentTarget.style.background = '#CC1414'}
            >
              Register Your Practice <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/clinics"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}
            >
              Browse Clinics
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
