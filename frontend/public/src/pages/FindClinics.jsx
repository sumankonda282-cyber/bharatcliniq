import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search, MapPin, Building2, Stethoscope, ArrowLeft, X,
  Video, CheckCircle, ChevronRight
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
            <Link to="/clinics" className="font-semibold text-sm" style={{ color: '#CC1414' }}>Find Care</Link>
            <Link to="/booking/check" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">My Booking</Link>
            <Link to="/register" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">Register Org</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <a href={PROVIDER_URL} className="px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all" style={{ borderColor: '#0F2557', color: '#0F2557' }}>Provider Login</a>
            <a href={PATIENT_URL} className="px-4 py-2 rounded-xl font-semibold text-sm text-white transition-all" style={{ background: '#CC1414' }}>My Health Portal</a>
          </div>
        </div>
      </div>
    </nav>
  )
}

const SPECIALTIES = [
  'General Medicine', 'General Surgery', 'Cardiology', 'Dermatology', 'Pediatrics',
  'Orthopedics', 'Gynecology & Obstetrics', 'Neurology', 'Ophthalmology',
  'ENT (Ear Nose Throat)', 'Psychiatry & Mental Health', 'Dentistry',
  'Ayurveda', 'Homeopathy', 'Physiotherapy & Rehabilitation',
  'Radiology & Imaging', 'Pathology & Laboratory', 'Oncology',
  'Nephrology', 'Gastroenterology', 'Endocrinology & Diabetology',
  'Pulmonology', 'Urology', 'Rheumatology', 'Neonatology',
  'Emergency & Trauma', 'Neurosurgery', 'Cardiothoracic Surgery',
  'Plastic Surgery', 'Vascular Surgery', 'Palliative Care', 'Dietetics & Nutrition',
]

const CARD_COLORS = ['#0F2557', '#CC1414', '#138808', '#7C3AED', '#0891B2', '#F5821E']

function getInitials(name = '') {
  const w = name.trim().split(/\s+/)
  return w.length >= 2 ? w[0][0] + w[w.length - 1][0] : (w[0] || '?').slice(0, 2)
}

function DoctorCard({ doctor, clinic }) {
  const bg = CARD_COLORS[Math.abs(doctor.id || 0) % CARD_COLORS.length]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all flex flex-col">
      <div className="flex gap-4">
        {/* Avatar */}
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 text-white text-xl font-extrabold uppercase select-none"
          style={{ background: bg }}
        >
          {getInitials(doctor.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-gray-800 text-base leading-tight truncate">{doctor.name}</h3>
              <p className="text-sm font-semibold mt-0.5 truncate" style={{ color: '#CC1414' }}>
                {doctor.specialty || 'General Medicine'}
              </p>
              {doctor.qualification && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{doctor.qualification}</p>
              )}
            </div>
            {doctor.mci_verified && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">
                <CheckCircle className="w-3 h-3" /> Verified
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {(doctor.experience_years || 0) > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                {doctor.experience_years}+ yrs exp
              </span>
            )}
            {(doctor.fee || 0) > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
                ₹{doctor.fee} consult
              </span>
            )}
            {doctor.telehealth_enabled && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-medium flex items-center gap-1">
                <Video className="w-3 h-3" /> Online
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate font-medium text-gray-500">{clinic.name}</span>
            <span>·</span>
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{clinic.city}{clinic.state ? `, ${clinic.state}` : ''}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
        <Link
          to={`/clinics/${clinic.slug}`}
          className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors hover:bg-blue-50"
          style={{ borderColor: '#0F2557', color: '#0F2557' }}
        >
          View Profile
        </Link>
        <Link
          to={`/book?clinic_slug=${clinic.slug}&doctor_id=${doctor.id}`}
          className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#CC1414' }}
        >
          Book Now
        </Link>
      </div>
    </div>
  )
}

function ClinicOnlyCard({ clinic }) {
  return (
    <Link to={`/clinics/${clinic.slug}`} className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all group">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: '#0F255710' }}>
          {clinic.logo_url ? (
            <img src={clinic.logo_url} alt={clinic.name} className="w-14 h-14 rounded-2xl object-cover" />
          ) : (
            <Building2 className="w-7 h-7" style={{ color: '#0F2557' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate group-hover:text-[#CC1414] transition-colors" style={{ color: '#0F2557' }}>{clinic.name}</h3>
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
            <Stethoscope className="w-3 h-3 flex-shrink-0" style={{ color: '#F5821E' }} />
            <span className="truncate">{clinic.specialty || 'Multi-Specialty'}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{clinic.city}{clinic.state ? `, ${clinic.state}` : ''}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#CC1414] transition-colors flex-shrink-0 mt-1" />
      </div>
    </Link>
  )
}

function CitySearch({ value, onChange, cities }) {
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
    <div ref={ref} className="relative md:w-44">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
      <input
        type="text"
        value={input}
        onChange={e => { setInput(e.target.value); onChange(''); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search city..."
        className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 bg-white"
        style={{ '--tw-ring-color': '#0F2557' }}
      />
      {input && (
        <button type="button" onClick={clear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto text-sm">
          <li className="px-3 py-2 cursor-pointer hover:bg-gray-50 text-gray-400 italic" onMouseDown={() => select('')}>All Cities</li>
          {filtered.map(c => (
            <li key={c} className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-gray-700" onMouseDown={() => select(c)}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SpecialtySearch({ value, onChange }) {
  const [input, setInput] = useState(value || '')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const filtered = input.trim()
    ? SPECIALTIES.filter(s => s.toLowerCase().includes(input.toLowerCase()))
    : SPECIALTIES

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (s) => { setInput(s); onChange(s); setOpen(false) }
  const clear = () => { setInput(''); onChange(''); setOpen(false) }

  return (
    <div ref={ref} className="relative md:w-52">
      <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
      <input
        type="text"
        value={input}
        onChange={e => { setInput(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search specialty..."
        className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 bg-white"
        style={{ '--tw-ring-color': '#0F2557' }}
      />
      {input && (
        <button type="button" onClick={clear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto text-sm">
          <li className="px-3 py-2 cursor-pointer hover:bg-gray-50 text-gray-400 italic" onMouseDown={() => select('')}>All Specialties</li>
          {filtered.map(s => (
            <li key={s} className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-gray-700" onMouseDown={() => select(s)}>{s}</li>
          ))}
        </ul>
      )}
    </div>
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
  const [retryCount, setRetryCount] = useState(0)
  const retryTimer = useRef(null)

  useEffect(() => {
    publicApi.getCities().then(data => {
      setCities(Array.isArray(data) ? data : data.cities || [])
    }).catch(() => {
      setCities(['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad'])
    })
  }, [])

  const fetchClinics = useCallback(async (params, isRetry = false) => {
    setLoading(true)
    if (!isRetry) setError('')
    try {
      const cleanParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v))
      const data = await publicApi.getClinics(cleanParams)
      setClinics(Array.isArray(data) ? data : data.clinics || data.results || [])
      setRetryCount(0)
      setError('')
    } catch (err) {
      setError(err.message || 'Network Error')
      setClinics([])
      if (!isRetry || retryCount < 2) {
        const next = retryCount + 1
        setRetryCount(next)
        retryTimer.current = setTimeout(() => fetchClinics(params, true), 6000)
      }
    } finally {
      setLoading(false)
    }
  }, [retryCount])

  useEffect(() => {
    fetchClinics(filters)
    return () => { if (retryTimer.current) clearTimeout(retryTimer.current) }
  }, []) // eslint-disable-line

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

  // Flatten clinics → doctor cards
  const doctorCards = []
  const clinicsWithNoDoctors = []
  clinics.forEach(clinic => {
    if (clinic.doctors && clinic.doctors.length > 0) {
      clinic.doctors.forEach(doc => doctorCards.push({ doctor: doc, clinic }))
    } else {
      clinicsWithNoDoctors.push(clinic)
    }
  })
  const totalResults = doctorCards.length + clinicsWithNoDoctors.length

  return (
    <div className="min-h-screen" style={{ background: '#F0F4F8' }}>
      <Navbar />

      {/* Header */}
      <div className="text-white py-10 px-4" style={{ background: '#0F2557' }}>
        <div className="max-w-7xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-1 text-blue-200 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <h1 className="text-3xl font-extrabold mb-1">Find Care Near You</h1>
          <p className="text-blue-200">Discover verified doctors and clinics across India</p>
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
                placeholder="Doctor name, specialty, clinic..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                style={{ '--tw-ring-color': '#0F2557' }}
              />
            </div>
            <CitySearch
              value={filters.city}
              onChange={val => setFilters(f => ({ ...f, city: val }))}
              cities={cities}
            />
            <SpecialtySearch
              value={filters.specialty}
              onChange={val => setFilters(f => ({ ...f, specialty: val }))}
            />
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
            <p className="text-gray-500">Finding doctors and clinics...</p>
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">Could not load results</p>
            {retryCount > 0 && retryCount <= 3 ? (
              <p className="text-amber-600 text-sm mb-2 font-medium">
                Server is waking up... auto-retrying ({retryCount}/3)
              </p>
            ) : (
              <p className="text-gray-400 text-sm mb-6">{error}</p>
            )}
            <button
              onClick={() => { setRetryCount(0); fetchClinics(filters) }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white text-sm"
              style={{ background: '#CC1414' }}
            >
              Try Again
            </button>
          </div>
        ) : totalResults === 0 ? (
          <div className="text-center py-24">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">No results found</p>
            <p className="text-gray-400 text-sm">Try adjusting your search filters or search a different city</p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-5 font-medium">
              <span style={{ color: '#0F2557', fontWeight: 700 }}>{totalResults}</span>{' '}
              result{totalResults !== 1 ? 's' : ''} found
            </p>

            {doctorCards.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {doctorCards.map(({ doctor, clinic }) => (
                  <DoctorCard key={`${clinic.id}-${doctor.id}`} doctor={doctor} clinic={clinic} />
                ))}
              </div>
            )}

            {clinicsWithNoDoctors.length > 0 && (
              <>
                {doctorCards.length > 0 && (
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">More Care Providers</h3>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {clinicsWithNoDoctors.map(clinic => (
                    <ClinicOnlyCard key={clinic.id || clinic.slug} clinic={clinic} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
