import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search, MapPin, Users, ChevronRight, Building2,
  Stethoscope, ArrowLeft, X, Star
} from 'lucide-react'
import { publicApi } from '../api/client'
import BrandLogo from '../components/BrandLogo'

const PROVIDER_URL = import.meta.env.VITE_PROVIDER_URL || 'https://bharatcliniq-provider.vercel.app'
const PATIENT_URL  = import.meta.env.VITE_PATIENT_URL  || 'https://bharatcliniq-patient.vercel.app'

function Navbar() {
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/"><BrandLogo size="md" /></Link>
          <div className="hidden md:flex items-center gap-6">
            <Link to="/clinics" className="font-semibold text-sm" style={{ color: '#CC1414' }}>Find Clinics</Link>
            <Link to="/booking/check" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">My Booking</Link>
            <Link to="/register" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">Register Clinic</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <a href={PROVIDER_URL} className="px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all" style={{ borderColor: '#0F2557', color: '#0F2557' }}>Provider Login</a>
            <a href={PATIENT_URL} className="px-4 py-2 rounded-xl font-semibold text-sm text-white transition-all" style={{ background: '#CC1414' }}>Patient Login</a>
          </div>
        </div>
      </div>
    </nav>
  )
}

const SPECIALTIES = [
  'General Medicine', 'Cardiology', 'Dermatology', 'Pediatrics',
  'Orthopedics', 'Gynecology', 'Neurology', 'Ophthalmology',
  'ENT', 'Psychiatry', 'Dentistry', 'Ayurveda',
]

function StarRating({ rating = 0, max = 5 }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className="w-3.5 h-3.5"
          style={{ fill: i < rating ? '#F5821E' : '#E5E7EB', color: i < rating ? '#F5821E' : '#E5E7EB' }}
        />
      ))}
    </div>
  )
}

function ClinicCard({ clinic }) {
  return (
    <Link to={`/clinics/${clinic.slug}`} className="block bg-white rounded-2xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-all group cursor-pointer">
      <div className="flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all"
          style={{ background: '#0F255710' }}
        >
          {clinic.logo_url ? (
            <img src={clinic.logo_url} alt={clinic.name} className="w-14 h-14 rounded-2xl object-cover" />
          ) : (
            <Building2 className="w-7 h-7" style={{ color: '#0F2557' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate transition-colors group-hover:text-[#CC1414]" style={{ color: '#0F2557' }}>
            {clinic.name}
          </h3>
          <div className="flex items-center gap-1 text-gray-500 text-xs mt-1">
            <Stethoscope className="w-3 h-3 flex-shrink-0" style={{ color: '#F5821E' }} />
            <span className="truncate">{clinic.specialty || 'Multi-Specialty'}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5">
            <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: '#CC1414' }} />
            <span className="truncate">{clinic.city}{clinic.state ? `, ${clinic.state}` : ''}</span>
          </div>
          {clinic.rating > 0 && (
            <div className="mt-1.5">
              <StarRating rating={Math.round(clinic.rating)} />
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
            style={{ background: '#0F255710', color: '#0F2557' }}>
            <Users className="w-3 h-3" />
            {clinic.doctor_count || clinic.doctors?.length || 0} Doctors
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#CC1414] transition-colors" />
        </div>
      </div>
    </Link>
  )
}

export default function FindClinics() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [clinics, setClinics] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    city: searchParams.get('city') || '',
    specialty: searchParams.get('specialty') || '',
  })

  useEffect(() => {
    publicApi.getCities().then(data => {
      setCities(Array.isArray(data) ? data : data.cities || [])
    }).catch(() => {
      setCities(['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad'])
    })
  }, [])

  const fetchClinics = useCallback(async (params) => {
    setLoading(true)
    setError('')
    try {
      const cleanParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v))
      const data = await publicApi.getClinics(cleanParams)
      setClinics(Array.isArray(data) ? data : data.clinics || data.results || [])
    } catch (err) {
      setError(err.message)
      setClinics([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchClinics(filters) }, []) // eslint-disable-line

  const handleSearch = (e) => {
    e.preventDefault()
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    setSearchParams(params)
    fetchClinics(filters)
  }

  const clearFilter = (key) => {
    const newFilters = { ...filters, [key]: '' }
    setFilters(newFilters)
    const params = Object.fromEntries(Object.entries(newFilters).filter(([, v]) => v))
    setSearchParams(params)
    fetchClinics(newFilters)
  }

  const activeFilters = Object.entries(filters).filter(([, v]) => v)

  return (
    <div className="min-h-screen" style={{ background: '#F0F4F8' }}>
      <Navbar />

      {/* Header */}
      <div className="text-white py-10 px-4" style={{ background: '#0F2557' }}>
        <div className="max-w-7xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-1 text-blue-200 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <h1 className="text-3xl font-extrabold mb-1">Find Clinics Near You</h1>
          <p className="text-blue-200">Discover verified clinics and doctors across India</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Filter Bar */}
        <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={filters.q}
                onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
                placeholder="Clinic name, doctor, keyword..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                style={{ '--tw-ring-color': '#0F2557' }}
              />
            </div>
            <select
              value={filters.city}
              onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
              className="md:w-44 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all bg-white"
              style={{ '--tw-ring-color': '#0F2557' }}
            >
              <option value="">All Cities</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filters.specialty}
              onChange={e => setFilters(f => ({ ...f, specialty: e.target.value }))}
              className="md:w-52 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all bg-white"
              style={{ '--tw-ring-color': '#0F2557' }}
            >
              <option value="">All Specialties</option>
              {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white whitespace-nowrap transition-colors"
              style={{ background: '#CC1414' }}
              onMouseEnter={e => e.currentTarget.style.background = '#b01010'}
              onMouseLeave={e => e.currentTarget.style.background = '#CC1414'}
            >
              <Search className="w-4 h-4" /> Search
            </button>
          </div>
        </form>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {activeFilters.map(([key, val]) => (
              <span key={key}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium"
                style={{ background: '#0F255715', color: '#0F2557' }}>
                {val}
                <button onClick={() => clearFilter(key)} className="hover:opacity-70">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: '#0F2557', borderTopColor: 'transparent' }} />
            <p className="text-gray-500">Searching clinics...</p>
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">Could not load clinics</p>
            <p className="text-gray-400 text-sm mb-6">{error}</p>
            <button
              onClick={() => fetchClinics(filters)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white text-sm"
              style={{ background: '#CC1414' }}
            >
              Try Again
            </button>
          </div>
        ) : clinics.length === 0 ? (
          <div className="text-center py-24">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">No clinics found</p>
            <p className="text-gray-400 text-sm">Try adjusting your search filters</p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-4 font-medium">
              <span style={{ color: '#0F2557', fontWeight: 700 }}>{clinics.length}</span>{' '}
              clinic{clinics.length !== 1 ? 's' : ''} found
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {clinics.map(clinic => (
                <ClinicCard key={clinic.id || clinic.slug} clinic={clinic} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
