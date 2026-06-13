import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import {
  Stethoscope, Building2, Calendar, Clock, Search, ChevronRight,
  ArrowLeft, CheckCircle, Copy, Check, X, MapPin, Filter, Video
} from 'lucide-react'

const today = new Date().toISOString().split('T')[0]

const SPECIALTIES = [
  'All Specialties', 'General Medicine', 'Cardiology', 'Dermatology',
  'Pediatrics', 'Orthopedics', 'Gynecology', 'Psychiatry', 'ENT',
  'Neurology', 'Ophthalmology', 'Dentistry',
]

function DoctorCard({ doctor, onSelect }) {
  return (
    <button onClick={() => onSelect(doctor)}
      className="w-full card p-4 flex items-center gap-4 hover:shadow-lg hover:border-blue-200 border-2 border-transparent transition-all text-left">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-white text-lg"
        style={{ background: 'linear-gradient(135deg, #0F2557, #1a3a7a)' }}>
        {(doctor.name || 'D').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm" style={{ color: '#0F2557' }}>
          {/^dr\.?\s/i.test(doctor.name || '') ? doctor.name : `Dr. ${doctor.name}`}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
          <Stethoscope size={11} style={{ color: '#F5821E' }} /> {doctor.specialty}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
          <Building2 size={11} /> {doctor.clinic_name}{doctor.city ? ` · ${doctor.city}` : ''}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        {doctor.fee > 0 && (
          <div className="text-sm font-bold mb-1" style={{ color: '#0F2557' }}>₹{doctor.fee}</div>
        )}
        <ChevronRight size={16} className="text-gray-400 ml-auto" />
      </div>
    </button>
  )
}

function SlotPicker({ doctor, onBack, onBooked }) {
  const { user } = useAuth()
  const [date, setDate] = useState(today)
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slot, setSlot] = useState(null)
  const [step, setStep] = useState('slot')   // slot | confirm | done
  const [patientName, setPatientName] = useState(user?.full_name || '')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [booking, setBooking] = useState(null)
  const [copied, setCopied] = useState(false)
  const [visitType, setVisitType] = useState('in_person')

  const fetchSlots = (d) => {
    setLoadingSlots(true); setSlots([]); setSlot(null)
    api.get(`/public/doctors/${doctor.doctor_profile_id || doctor.id}/slots`, { params: { booking_date: d } })
      .then(r => setSlots(Array.isArray(r) ? r : r.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false))
  }

  useEffect(() => { fetchSlots(date) }, []) // eslint-disable-line

  const submit = async () => {
    setSubmitting(true); setError('')
    try {
      const res = await api.post('/portal/book', {
        clinic_id: doctor.clinic_id,
        doctor_id: doctor.doctor_profile_id || doctor.id,
        booking_date: date,
        booking_time: slot,
        patient_name: patientName.trim() || undefined,
        reason: reason.trim() || undefined,
        mode: visitType === 'telehealth' ? 'telehealth' : 'offline',
      })
      setBooking(res); setStep('done')
      onBooked && onBooked()
    } catch (err) {
      setError(err.message || 'Could not complete booking. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div>
      {/* Doctor summary */}
      <div className="card p-4 flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-lg flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0F2557, #1a3a7a)' }}>
          {(doctor.name || 'D').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold" style={{ color: '#0F2557' }}>
            {/^dr\.?\s/i.test(doctor.name || '') ? doctor.name : `Dr. ${doctor.name}`}
          </div>
          <div className="text-xs text-gray-500">{doctor.specialty} · {doctor.clinic_name}</div>
        </div>
        {doctor.fee > 0 && <div className="font-bold text-sm flex-shrink-0" style={{ color: '#0F2557' }}>₹{doctor.fee}</div>}
      </div>

      {step === 'slot' && (
        <div className="card p-6 space-y-5">
          <div>
            <label className="label">Select Date</label>
            <input type="date" value={date} min={today}
              onChange={e => { setDate(e.target.value); fetchSlots(e.target.value) }}
              className="input" style={{ colorScheme: 'light' }} />
          </div>

          <div>
            <label className="label">Available Slots</label>
            {loadingSlots ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-4 rounded-full animate-spin" style={{ borderColor: '#c7d2e5', borderTopColor: '#0F2557' }} />
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Clock size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No slots available on this date</p>
                <p className="text-xs mt-1">Try selecting a different date</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {slots.map(s => {
                  const time = typeof s === 'string' ? s : s.time
                  const avail = typeof s === 'object' ? s.available !== false : true
                  return (
                    <button key={time} disabled={!avail} onClick={() => setSlot(time)}
                      className="py-2 rounded-lg text-xs font-medium border-2 transition-all"
                      style={!avail
                        ? { background: '#f9fafb', color: '#d1d5db', borderColor: '#f3f4f6', cursor: 'not-allowed' }
                        : slot === time
                          ? { background: '#0F2557', color: 'white', borderColor: '#0F2557' }
                          : { background: 'white', color: '#374151', borderColor: '#e5e7eb' }}>
                      {time}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <button onClick={() => setStep('confirm')} disabled={!slot}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: '#CC1414' }}>
            Continue to Confirm
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="card p-6 space-y-4">
          {/* Summary */}
          <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: '#EEF2FF' }}>
            {[
              ['Date', fmtDate(date)],
              ['Time', slot],
              ...(doctor.fee > 0 ? [['Consultation Fee', `₹${doctor.fee}`]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-500">{k}</span>
                <span className="font-semibold text-gray-900">{v}</span>
              </div>
            ))}
          </div>

          <div>
            <label className="label">Type of Visit</label>
            <div className="flex gap-3">
              {[
                { value: 'in_person', label: '🏥 In-Person' },
                { value: 'telehealth', label: '📹 Telehealth (Video)' },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setVisitType(opt.value)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all"
                  style={visitType === opt.value
                    ? { background: '#0F2557', color: 'white', borderColor: '#0F2557' }
                    : { background: 'white', color: '#374151', borderColor: '#e5e7eb' }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {visitType === 'telehealth' && (
              <p className="text-xs text-blue-600 mt-2">A secure video link will be shared before your appointment.</p>
            )}
          </div>

          <div>
            <label className="label">Patient Name</label>
            <input value={patientName} onChange={e => setPatientName(e.target.value)}
              placeholder="Who is this appointment for?" className="input" />
          </div>
          <div>
            <label className="label">Reason for Visit <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              rows={3} placeholder="Briefly describe symptoms or reason..."
              className="input resize-none" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs">{error}</div>
          )}

          <p className="text-xs text-gray-400">
            This appointment is linked to your registered mobile {user?.mobile ? `(${user.mobile})` : ''}.
          </p>

          <div className="flex gap-3">
            <button onClick={() => setStep('slot')}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">
              ← Change Slot
            </button>
            <button onClick={submit} disabled={submitting}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: '#CC1414' }}>
              {submitting
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Booking…</>
                : <><Calendar size={14} /> Confirm Booking</>}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && booking && (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-9 h-9 text-green-500" />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#0F2557' }}>Appointment Booked!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Your request has been sent. The health center will confirm it shortly.
          </p>
          <div className="rounded-2xl p-5 mb-6 mx-auto max-w-xs" style={{ background: '#EEF2FF', border: '2px solid #93c5fd' }}>
            <p className="text-xs text-gray-500 mb-1">Confirmation Code</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-bold tracking-widest" style={{ color: '#0F2557' }}>{booking.confirmation_code}</span>
              <button onClick={() => { navigator.clipboard.writeText(booking.confirmation_code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                className="p-1.5 rounded-lg hover:bg-white/60">
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} style={{ color: '#0F2557' }} />}
              </button>
            </div>
          </div>
          <button onClick={() => window.history.back()}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: '#0F2557' }}>
            View My Appointments
          </button>
        </div>
      )}
    </div>
  )
}

export default function BookAppointmentPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [doctor, setDoctor] = useState(null)
  const [allDoctors, setAllDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [specialty, setSpecialty] = useState('All Specialties')
  const [cityFilter, setCityFilter] = useState('All Cities')
  const [pastDoctors, setPastDoctors] = useState([])
  const [booked, setBooked] = useState(false)

  useEffect(() => {
    // Load all doctors from public directory
    api.get('/public/clinics')
      .then(r => {
        const clinics = Array.isArray(r) ? r : r.clinics || []
        const flat = clinics.flatMap(c =>
          (c.doctors || []).map(d => ({
            ...d,
            clinic_id: c.id,
            clinic_name: c.name,
            city: c.city,
          }))
        )
        setAllDoctors(flat)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Load past visited doctors from appointments
    api.get('/portal/appointments')
      .then(r => {
        const appts = r?.appointments || []
        const completed = appts.filter(a => a.status === 'completed')
        // Deduplicate by doctor_name + clinic_name
        const seen = new Set()
        const unique = completed.filter(a => {
          const key = `${a.doctor_name}|${a.clinic_name}`
          if (seen.has(key)) return false
          seen.add(key); return true
        }).slice(0, 6)
        setPastDoctors(unique)
      })
      .catch(() => {})
  }, []) // eslint-disable-line

  const cities = useMemo(() =>
    ['All Cities', ...new Set(allDoctors.map(d => d.city).filter(Boolean))],
    [allDoctors]
  )

  const filtered = useMemo(() => {
    let list = allDoctors
    if (specialty !== 'All Specialties') list = list.filter(d => d.specialty === specialty)
    if (cityFilter !== 'All Cities') list = list.filter(d => d.city === cityFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.specialty?.toLowerCase().includes(q) ||
        d.clinic_name?.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q)
      )
    }
    return list
  }, [allDoctors, search, specialty, cityFilter])

  // Doctor selected — show slot picker
  if (doctor) {
    return (
      <div>
        <button onClick={() => setDoctor(null)}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 mb-5">
          <ArrowLeft size={16} /> Back to doctors
        </button>
        <SlotPicker doctor={doctor} onBooked={() => setBooked(true)} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Previously visited doctors */}
      {pastDoctors.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#F5821E' }}>
            Previously Visited — Quick Re-book
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pastDoctors.map((a, i) => (
              <button key={i}
                onClick={() => {
                  const match = allDoctors.find(d =>
                    d.name?.toLowerCase() === a.doctor_name?.toLowerCase() &&
                    d.clinic_name?.toLowerCase() === a.clinic_name?.toLowerCase()
                  )
                  if (match) setDoctor(match)
                }}
                className="card p-4 flex items-center gap-3 hover:shadow-md hover:border-orange-200 border-2 border-transparent transition-all text-left">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                  style={{ background: '#F5821E' }}>
                  {(a.doctor_name || 'D').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: '#0F2557' }}>
                    {/^dr\.?\s/i.test(a.doctor_name || '') ? a.doctor_name : `Dr. ${a.doctor_name}`}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 truncate">
                    <Building2 size={10} /> {a.clinic_name}
                  </div>
                </div>
                <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search & filter */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#0F2557' }}>
          Find a Doctor
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Doctor name, specialty, health center, city…"
              className="input pl-9" />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select value={specialty} onChange={e => setSpecialty(e.target.value)}
              className="input pl-9 sm:w-48">
              {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
              className="input pl-9 sm:w-40">
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {(search || specialty !== 'All Specialties' || cityFilter !== 'All Cities') && (
            <button onClick={() => { setSearch(''); setSpecialty('All Specialties'); setCityFilter('All Cities') }}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors">
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="card p-10 text-center">
            <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: '#c7d2e5', borderTopColor: '#0F2557' }} />
            <p className="text-xs text-gray-400 mt-3">Loading doctors…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center text-gray-400">
            <Stethoscope size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No doctors found</p>
            <p className="text-xs mt-1">Try a different name, specialty, or city</p>
          </div>
        ) : (
          <div className="space-y-2">
            {search && <p className="text-xs text-gray-400">{filtered.length} doctor{filtered.length !== 1 ? 's' : ''} found</p>}
            {filtered.map((d, i) => (
              <DoctorCard key={`${d.clinic_id}-${d.id}-${i}`} doctor={d} onSelect={setDoctor} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
