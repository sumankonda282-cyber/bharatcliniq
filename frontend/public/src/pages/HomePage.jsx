import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Activity, Search, Calendar, FileText, Pill, FlaskConical,
  ReceiptText, BarChart3, ChevronRight, Star, Phone, MapPin,
  Users, Building2, CheckCircle, ArrowRight, Menu, X
} from 'lucide-react'
import { publicApi } from '../api/client'

function Navbar() {
  const [open, setOpen] = useState(false)
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <Activity className="w-7 h-7 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">BharatCliniq</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/clinics" className="text-gray-600 hover:text-primary-600 font-medium transition-colors">Find Clinics</Link>
            <Link to="/booking/check" className="text-gray-600 hover:text-primary-600 font-medium transition-colors">My Booking</Link>
            <Link to="/register" className="btn-outline text-sm py-2 px-4">Register Clinic</Link>
          </div>
          <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {open && (
          <div className="md:hidden pb-4 flex flex-col gap-3">
            <Link to="/clinics" className="text-gray-600 font-medium px-2 py-2" onClick={() => setOpen(false)}>Find Clinics</Link>
            <Link to="/booking/check" className="text-gray-600 font-medium px-2 py-2" onClick={() => setOpen(false)}>My Booking</Link>
            <Link to="/register" className="btn-primary text-sm py-2 text-center" onClick={() => setOpen(false)}>Register Clinic</Link>
          </div>
        )}
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-6 h-6 text-primary-400" />
              <span className="text-white font-bold text-lg">BharatCliniq</span>
            </div>
            <p className="text-sm leading-relaxed">India's trusted digital clinic platform. Connecting patients with quality healthcare across the nation.</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">For Patients</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/clinics" className="hover:text-white transition-colors">Find Clinics</Link></li>
              <li><Link to="/book" className="hover:text-white transition-colors">Book Appointment</Link></li>
              <li><Link to="/booking/check" className="hover:text-white transition-colors">Check Booking Status</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">For Clinics</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/register" className="hover:text-white transition-colors">Register Your Clinic</Link></li>
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li>support@bharatcliniq.com</li>
              <li>1800-XXX-XXXX (Toll Free)</li>
              <li>Mon–Sat, 9am–6pm IST</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-10 pt-6 text-center text-sm">
          <p>© {new Date().getFullYear()} BharatCliniq. All rights reserved. Made with ❤️ in India.</p>
        </div>
      </div>
    </footer>
  )
}

const FEATURES = [
  { icon: Calendar, title: 'Online Appointments', desc: 'Patients book slots 24/7. Automated reminders reduce no-shows by 60%.' },
  { icon: FileText, title: 'Digital EMR', desc: 'Paperless electronic medical records. Secure, searchable patient history.' },
  { icon: Pill, title: 'Pharmacy Module', desc: 'Integrated dispensing, inventory alerts, and prescription tracking.' },
  { icon: FlaskConical, title: 'Lab Integration', desc: 'Order tests, receive reports digitally, share with patients instantly.' },
  { icon: ReceiptText, title: 'Smart Billing', desc: 'GST-ready invoicing, insurance claims, and UPI/card payments.' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Revenue trends, patient flow, and performance insights at a glance.' },
]

const TESTIMONIALS = [
  {
    name: 'Dr. Priya Sharma',
    role: 'General Physician, Mumbai',
    avatar: 'PS',
    rating: 5,
    text: 'BharatCliniq transformed my practice. Patient wait times dropped by 40% and billing became completely hassle-free.',
  },
  {
    name: 'Rajesh Kumar',
    role: 'Patient, Bangalore',
    avatar: 'RK',
    rating: 5,
    text: 'Finding a good doctor used to take hours. Now I book appointments in 2 minutes from my phone. Excellent service!',
  },
  {
    name: 'Dr. Amit Patel',
    role: 'Cardiologist, Ahmedabad',
    avatar: 'AP',
    rating: 5,
    text: 'The EMR system is intuitive and the analytics help me understand my clinic\'s growth month over month.',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [stats, setStats] = useState({ clinics: 0, doctors: 0, bookings: 0 })
  const [cities, setCities] = useState([])

  useEffect(() => {
    publicApi.getStats().then(setStats).catch(() => {
      setStats({ clinics: '500+', doctors: '2,000+', bookings: '50,000+' })
    })
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
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary-500 bg-opacity-40 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Trusted by 500+ clinics across India
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            India's Digital<br />
            <span className="text-blue-200">Clinic Platform</span>
          </h1>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Book appointments, access medical records, and manage your healthcare journey — all in one place.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="bg-white rounded-2xl p-2 flex flex-col sm:flex-row gap-2 max-w-2xl mx-auto shadow-2xl">
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              className="flex-none sm:w-44 px-4 py-3 rounded-xl text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">All Cities</option>
              {cities.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by specialty, clinic name..."
                className="w-full pl-10 pr-4 py-3 rounded-xl text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>
            <button type="submit" className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors whitespace-nowrap">
              Find a Clinic
            </button>
          </form>

          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <Link to="/register" className="btn-white text-sm py-2.5 px-5">
              Register Your Clinic <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white py-12 border-b">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-4xl font-bold text-primary-600">{stats.clinics}</div>
              <div className="text-gray-500 mt-1 text-sm font-medium">Registered Clinics</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary-600">{stats.doctors}</div>
              <div className="text-gray-500 mt-1 text-sm font-medium">Verified Doctors</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary-600">{stats.bookings}</div>
              <div className="text-gray-500 mt-1 text-sm font-medium">Appointments Booked</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-gray-50 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="section-title">Everything your clinic needs</h2>
            <p className="section-subtitle">One platform to manage your entire clinic operations</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card hover:shadow-md transition-shadow group">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary-600 transition-colors">
                  <Icon className="w-6 h-6 text-primary-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">Simple steps to get started</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* For Patients */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <Users className="w-6 h-6 text-primary-600" />
                <h3 className="text-2xl font-bold text-gray-900">For Patients</h3>
              </div>
              <div className="space-y-6">
                {[
                  { step: '01', title: 'Search a Clinic', desc: 'Browse clinics by city, specialty, or doctor name. Read profiles and check availability.' },
                  { step: '02', title: 'Book an Appointment', desc: 'Select your preferred doctor, date, and time slot. Fill in basic patient details.' },
                  { step: '03', title: 'Visit & Get Treated', desc: 'Show your confirmation code at the clinic. Your medical history is ready digitally.' },
                ].map(item => (
                  <div key={item.step} className="flex gap-5">
                    <div className="w-12 h-12 bg-primary-600 text-white rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">{item.step}</div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* For Clinics */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <Building2 className="w-6 h-6 text-primary-600" />
                <h3 className="text-2xl font-bold text-gray-900">For Clinics</h3>
              </div>
              <div className="space-y-6">
                {[
                  { step: '01', title: 'Register Your Clinic', desc: 'Fill in clinic and doctor details. Submit for approval. We verify within 24 hours.' },
                  { step: '02', title: 'Set Up Your Profile', desc: 'Add doctors, configure time slots, set consultation fees, and upload logo.' },
                  { step: '03', title: 'Start Accepting Bookings', desc: 'Go live on BharatCliniq. Manage appointments, EMR, billing — all from one dashboard.' },
                ].map(item => (
                  <div key={item.step} className="flex gap-5">
                    <div className="w-12 h-12 bg-green-600 text-white rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">{item.step}</div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
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
      <section className="py-20 bg-primary-50 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="section-title">Trusted across India</h2>
            <p className="section-subtitle">What our doctors and patients say</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="card">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                    <div className="text-gray-500 text-xs">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-primary-600 px-4">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to modernize your clinic?</h2>
          <p className="text-blue-100 mb-8 text-lg">Join 500+ clinics already using BharatCliniq. Registration is free.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="btn-white">Register Your Clinic <ArrowRight className="w-4 h-4" /></Link>
            <Link to="/clinics" className="btn-outline border-white text-white hover:bg-primary-700 hover:border-primary-700">Find Clinics</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
