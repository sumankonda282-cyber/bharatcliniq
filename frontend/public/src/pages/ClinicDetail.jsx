import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  MapPin, Phone, Mail, Stethoscope, Clock,
  User, ArrowLeft, Building2, Calendar,
  BadgeCheck, IndianRupee, GraduationCap, Globe, Languages
} from 'lucide-react'
import { publicApi } from '../api/client'
import Navbar from '../components/Navbar'

const PATIENT_URL = import.meta.env.VITE_PATIENT_URL || 'https://bharatcliniq-patient.vercel.app'

// Avatar from initials
function Avatar({ name, photoUrl, size = 'lg' }) {
  const dim = size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-16 h-16 text-xl'
  const initials = (name || 'D')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${dim} rounded-full object-cover flex-shrink-0`}
      />
    )
  }
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white`}
      style={{ background: '#0F2557' }}
    >
      {initials}
    </div>
  )
}

function AvailabilityBadge({ telehealth }) {
  if (telehealth === true) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-green-50 text-green-700 border border-green-200">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        Available Online
      </span>
    )
  }
  if (telehealth === false) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-600 border border-gray-200">
        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
        In-Person Only
      </span>
    )
  }
  return null
}

function InfoRow({ icon: Icon, label, value, iconColor }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0">
        <Icon className="w-4 h-4" style={{ color: iconColor || '#0F2557' }} />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-700 font-medium mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function DoctorProfile({ doctor, clinic }) {
  const [bookHovered, setBookHovered] = useState(false)

  const fullAddress = [
    doctor.address || clinic?.address,
    doctor.city || clinic?.city,
    doctor.state || clinic?.state,
    doctor.pincode || clinic?.pincode,
  ].filter(Boolean).join(', ')

  const mapsAddress = fullAddress || doctor.name || ''

  const handleBook = () => {
    const bookUrl = `${PATIENT_URL}/appointments?doctor_id=${doctor.id}&doctor_name=${encodeURIComponent(doctor.name)}&specialty=${encodeURIComponent(doctor.specialty || '')}`
    window.open(bookUrl, '_blank')
  }

  const achievements = doctor.achievements || doctor.qualifications || []
  const languages = doctor.languages || doctor.languages_spoken

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <Avatar name={doctor.name} photoUrl={doctor.photo_url} size="lg" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-extrabold" style={{ color: '#0F2557' }}>{doctor.name}</h1>
              {doctor.is_verified && (
                <BadgeCheck className="w-5 h-5 text-green-500 flex-shrink-0" title="Verified Doctor" />
              )}
            </div>

            {doctor.specialty && (
              <p className="text-base font-semibold mt-1" style={{ color: '#CC1414' }}>{doctor.specialty}</p>
            )}

            {doctor.qualification && (
              <p className="text-sm text-gray-500 mt-0.5">{doctor.qualification}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <AvailabilityBadge telehealth={doctor.telehealth_available ?? doctor.is_online} />
              {doctor.mci_verified && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <BadgeCheck className="w-3 h-3" /> MCI Verified
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-gray-100">
          <InfoRow
            icon={Clock}
            label="Experience"
            value={doctor.experience_years !== undefined ? `${doctor.experience_years} years` : undefined}
            iconColor="#F5821E"
          />
          <InfoRow
            icon={Building2}
            label="Health Center"
            value={doctor.clinic_name || doctor.health_center_name || clinic?.name}
            iconColor="#0F2557"
          />
          <InfoRow
            icon={MapPin}
            label="Location"
            value={[doctor.city || clinic?.city, doctor.state || clinic?.state].filter(Boolean).join(', ') || undefined}
            iconColor="#CC1414"
          />
          <InfoRow
            icon={Clock}
            label="Working Hours"
            value={doctor.working_hours}
            iconColor="#0F2557"
          />
          <InfoRow
            icon={Languages || Globe}
            label="Languages"
            value={Array.isArray(languages) ? languages.join(', ') : languages}
            iconColor="#0F2557"
          />
          <InfoRow
            icon={IndianRupee}
            label="Consultation Fee"
            value={doctor.fee !== undefined ? `₹${doctor.fee}` : undefined}
            iconColor="#22c55e"
          />
          {(doctor.phone || clinic?.phone) && (
            <InfoRow icon={Phone} label="Contact" value={doctor.phone || clinic?.phone} iconColor="#0F2557" />
          )}
          {(doctor.email || clinic?.email) && (
            <InfoRow icon={Mail} label="Email" value={doctor.email || clinic?.email} iconColor="#0F2557" />
          )}
        </div>
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#0F2557' }}>
            <GraduationCap className="w-5 h-5" /> Qualifications & Achievements
          </h2>
          <ul className="space-y-2">
            {achievements.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <BadgeCheck className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                {typeof item === 'string' ? item : item.title || item.name || JSON.stringify(item)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Location */}
      {(fullAddress || mapsAddress) && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: '#0F2557' }}>
            <MapPin className="w-5 h-5" style={{ color: '#CC1414' }} /> Location
          </h2>
          {fullAddress && <p className="text-sm text-gray-600 mb-3">{fullAddress}</p>}
          <a
            href={`https://www.google.com/maps/search/${encodeURIComponent(mapsAddress)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl text-white"
            style={{ background: '#0F2557' }}
          >
            <MapPin className="w-4 h-4" /> Get Directions
          </a>
        </div>
      )}

      {/* Book Appointment CTA */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <h2 className="text-lg font-bold mb-1" style={{ color: '#0F2557' }}>Book an Appointment</h2>
        <p className="text-sm text-gray-500 mb-4">Online booking is coming soon. For now, call the clinic to book.</p>

        <div className="relative inline-block group">
          <button
            onClick={handleBook}
            onMouseEnter={() => setBookHovered(true)}
            onMouseLeave={() => setBookHovered(false)}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-white text-base transition-all shadow-md"
            style={{ background: bookHovered ? '#b01010' : '#CC1414' }}
          >
            <Calendar className="w-5 h-5" /> Book Appointment
          </button>
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
            Online booking launching soon — call to book
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
          </div>
        </div>
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
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#0F2557', borderTopColor: 'transparent' }}></div>
          <p className="text-gray-500">Loading profile...</p>
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
          <p className="text-gray-500 text-lg mb-2">Profile not found</p>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <Link to="/clinics" className="btn-primary">Browse Clinics</Link>
        </div>
      </div>
    )
  }

  // If the API returned a single doctor object, render the rich doctor profile
  const doctors = clinic.doctors || []
  const isDirectDoctor = !!(clinic.specialty && (clinic.experience_years !== undefined || clinic.qualification))

  if (isDirectDoctor) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to="/clinics" className="inline-flex items-center gap-1 text-gray-500 hover:text-[#0F2557] text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Clinics
          </Link>
          <DoctorProfile doctor={clinic} clinic={null} />
        </div>
      </div>
    )
  }

  // Clinic detail page
  const fullAddress = [clinic.address, clinic.city, clinic.state, clinic.pincode].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Clinic Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to="/clinics" className="inline-flex items-center gap-1 text-gray-500 hover:text-[#0F2557] text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Clinics
          </Link>
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: '#EEF2FF' }}>
              {clinic.logo_url ? (
                <img src={clinic.logo_url} alt={clinic.name} className="w-20 h-20 rounded-2xl object-cover" />
              ) : (
                <Building2 className="w-10 h-10" style={{ color: '#0F2557' }} />
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
                    <Stethoscope className="w-4 h-4 text-[#0F2557]" />
                    {clinic.specialty}
                  </div>
                )}
                {(clinic.city || clinic.state) && (
                  <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                    <MapPin className="w-4 h-4 text-[#0F2557]" />
                    {[clinic.city, clinic.state].filter(Boolean).join(', ')}
                  </div>
                )}
                {clinic.phone && (
                  <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                    <Phone className="w-4 h-4 text-[#0F2557]" />
                    {clinic.phone}
                  </div>
                )}
                {clinic.email && (
                  <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                    <Mail className="w-4 h-4 text-[#0F2557]" />
                    {clinic.email}
                  </div>
                )}
              </div>
              {clinic.address && (
                <div className="mt-3 space-y-2">
                  <p className="text-gray-500 text-sm">{fullAddress}</p>
                  <div className="flex gap-2 flex-wrap">
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(fullAddress || clinic.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                      style={{ background: '#0F2557' }}
                    >
                      <MapPin className="w-3.5 h-3.5" /> Get Directions
                    </a>
                  </div>
                </div>
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
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
            <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No doctors listed yet</p>
          </div>
        ) : (
          <div className="space-y-6">
            {doctors.map(doctor => (
              <DoctorProfile key={doctor.id} doctor={doctor} clinic={clinic} />
            ))}
          </div>
        )}

        {/* Location Map */}
        {(clinic.address || clinic.city) && (
          <div className="mt-10 bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" style={{ color: '#CC1414' }} /> Location
            </h2>
            <p className="text-gray-600 text-sm mb-4">{fullAddress}</p>
            <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 280 }}>
              <iframe
                title="Clinic Location"
                width="100%"
                height="100%"
                loading="lazy"
                style={{ border: 0 }}
                src={`https://maps.google.com/maps?q=${encodeURIComponent([clinic.name, clinic.address, clinic.city, clinic.state, 'India'].filter(Boolean).join(', '))}&output=embed`}
                allowFullScreen
              />
            </div>
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent([clinic.name, clinic.address, clinic.city, clinic.state, 'India'].filter(Boolean).join(', '))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium"
              style={{ color: '#0F2557' }}
            >
              <MapPin className="w-3.5 h-3.5" /> Open in Google Maps
            </a>
          </div>
        )}

        {/* About */}
        {clinic.description && (
          <div className="mt-10 bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">About the Clinic</h2>
            <p className="text-gray-600 leading-relaxed">{clinic.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}
