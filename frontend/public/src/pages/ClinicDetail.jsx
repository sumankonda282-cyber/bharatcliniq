import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  Activity, MapPin, Phone, Mail, Stethoscope, Clock,
  User, ArrowLeft, Building2, Calendar, ChevronRight,
  Star, BadgeCheck, IndianRupee, GraduationCap
} from 'lucide-react'
import { publicApi } from '../api/client'

function Navbar() {
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <Activity className="w-7 h-7 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">BharatCliniq</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/clinics" className="text-gray-600 hover:text-primary-600 font-medium">Find Clinics</Link>
            <Link to="/register" className="btn-outline text-sm py-2 px-4">Register Clinic</Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

function DoctorCard({ doctor, clinic }) {
  const navigate = useNavigate()
  const handleBook = () => {
    navigate(`/book?clinicId=${clinic?.id || ''}&doctorId=${doctor.id}`)
  }

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
          {doctor.photo_url ? (
            <img src={doctor.photo_url} alt={doctor.name} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <User className="w-8 h-8 text-primary-600" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">{doctor.name}</h3>
              <p className="text-primary-600 text-sm font-medium">{doctor.specialty}</p>
            </div>
            {doctor.is_verified && (
              <BadgeCheck className="w-5 h-5 text-green-500 flex-shrink-0" title="Verified" />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            {doctor.qualification && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <GraduationCap className="w-4 h-4 text-gray-400" />
                <span>{doctor.qualification}</span>
              </div>
            )}
            {doctor.experience_years !== undefined && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>{doctor.experience_years} yrs experience</span>
              </div>
            )}
            {doctor.fee !== undefined && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <IndianRupee className="w-4 h-4 text-gray-400" />
                <span>₹{doctor.fee} consultation fee</span>
              </div>
            )}
          </div>

          {doctor.mci_number && (
            <p className="text-xs text-gray-400 mt-2">MCI Reg: {doctor.mci_number}</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button onClick={handleBook} className="btn-primary text-sm py-2.5">
          <Calendar className="w-4 h-4" /> Book Appointment
        </button>
      </div>
    </div>
  )
}

export default function ClinicDetail() {
  const { slug } = useParams()
  const [clinic, setClinic] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    publicApi.getClinicBySlug(slug)
      .then(data => {
        setClinic(data.clinic || data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading clinic profile...</p>
        </div>
      </div>
    )
  }

  if (error || !clinic) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-24 text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">Clinic not found</p>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <Link to="/clinics" className="btn-primary">Browse Clinics</Link>
        </div>
      </div>
    )
  }

  const doctors = clinic.doctors || []

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Clinic Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to="/clinics" className="inline-flex items-center gap-1 text-gray-500 hover:text-primary-600 text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Clinics
          </Link>
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              {clinic.logo_url ? (
                <img src={clinic.logo_url} alt={clinic.name} className="w-20 h-20 rounded-2xl object-cover" />
              ) : (
                <Building2 className="w-10 h-10 text-primary-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-start gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{clinic.name}</h1>
                {clinic.is_active && (
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full mt-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Active
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">
                {clinic.specialty && (
                  <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                    <Stethoscope className="w-4 h-4 text-primary-500" />
                    {clinic.specialty}
                  </div>
                )}
                {(clinic.city || clinic.state) && (
                  <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                    <MapPin className="w-4 h-4 text-primary-500" />
                    {[clinic.city, clinic.state].filter(Boolean).join(', ')}
                  </div>
                )}
                {clinic.phone && (
                  <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                    <Phone className="w-4 h-4 text-primary-500" />
                    {clinic.phone}
                  </div>
                )}
                {clinic.email && (
                  <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                    <Mail className="w-4 h-4 text-primary-500" />
                    {clinic.email}
                  </div>
                )}
              </div>
              {clinic.address && (
                <p className="text-gray-500 text-sm mt-2">{clinic.address}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Doctors */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Our Doctors
            <span className="ml-2 text-base font-normal text-gray-500">({doctors.length})</span>
          </h2>
        </div>

        {doctors.length === 0 ? (
          <div className="text-center py-16 card">
            <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No doctors listed yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {doctors.map(doctor => (
              <DoctorCard key={doctor.id} doctor={doctor} clinic={clinic} />
            ))}
          </div>
        )}

        {/* About */}
        {clinic.description && (
          <div className="mt-10 card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">About the Clinic</h2>
            <p className="text-gray-600 leading-relaxed">{clinic.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}
