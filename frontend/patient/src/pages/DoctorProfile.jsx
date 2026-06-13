import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Stethoscope, Building2, Globe, Award, Clock, Video, Star, CalendarCheck } from 'lucide-react'

export default function DoctorProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [doctor, setDoctor] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/public/doctors/${id}`)
      .then(r => setDoctor(r?.data || r))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#c7d2e5', borderTopColor: '#0F2557' }} />
    </div>
  )

  if (!doctor) return (
    <div className="text-center py-20 text-gray-400">Doctor profile not found.</div>
  )

  const languages = doctor.languages
    ? (Array.isArray(doctor.languages) ? doctor.languages : doctor.languages.split(',').map(l => l.trim()).filter(Boolean))
    : []

  const quals = doctor.qualification
    ? (Array.isArray(doctor.qualification) ? doctor.qualification : doctor.qualification.split(',').map(q => q.trim()).filter(Boolean))
    : []

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800">
        <ArrowLeft size={16} /> Back
      </button>

      {/* Hero card */}
      <div className="card p-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 text-white text-2xl font-bold"
            style={{ background: 'linear-gradient(135deg, #0F2557, #1a3a7a)' }}>
            {(doctor.name || 'D').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ color: '#0F2557' }}>
              {/^dr\.?\s/i.test(doctor.name || '') ? doctor.name : `Dr. ${doctor.name}`}
            </h1>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
              <Stethoscope size={13} style={{ color: '#F5821E' }} />
              {doctor.specialty}
              {doctor.experience_years > 0 && <span className="text-gray-300">·</span>}
              {doctor.experience_years > 0 && <span>{doctor.experience_years} yrs experience</span>}
            </div>
            {doctor.clinic && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                <Building2 size={12} />
                {doctor.clinic.name}{doctor.clinic.city ? `, ${doctor.clinic.city}` : ''}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {doctor.mci_verified && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                  <Award size={11} /> MCI Verified
                </span>
              )}
              {doctor.telehealth_enabled && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <Video size={11} /> Telehealth Available
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            {doctor.fee > 0 && (
              <div>
                <div className="text-2xl font-bold" style={{ color: '#0F2557' }}>₹{doctor.fee}</div>
                <div className="text-xs text-gray-400">Consultation fee</div>
              </div>
            )}
            {doctor.telehealth_fee > 0 && (
              <div className="mt-1">
                <div className="text-sm font-semibold text-blue-700">₹{doctor.telehealth_fee}</div>
                <div className="text-xs text-gray-400">Online fee</div>
              </div>
            )}
          </div>
        </div>

        {doctor.bio && (
          <p className="mt-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">{doctor.bio}</p>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {quals.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Award size={15} style={{ color: '#0F2557' }} />
              <h2 className="font-semibold text-sm" style={{ color: '#0F2557' }}>Qualifications</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {quals.map((q, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700">{q}</span>
              ))}
            </div>
          </div>
        )}

        {languages.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe size={15} style={{ color: '#0F2557' }} />
              <h2 className="font-semibold text-sm" style={{ color: '#0F2557' }}>Languages Known</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {languages.map((l, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-50 text-orange-700">{l}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Book button */}
      <button
        onClick={() => navigate('/appointments/book', { state: { prefillDoctorId: doctor.id } })}
        className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
        style={{ background: '#CC1414' }}
      >
        <CalendarCheck size={16} /> Book Appointment with Dr. {doctor.name?.split(' ')[0]}
      </button>
    </div>
  )
}
