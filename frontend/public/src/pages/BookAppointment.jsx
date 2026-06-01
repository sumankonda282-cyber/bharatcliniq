import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
  Calendar, Clock, User, ChevronRight, CheckCircle,
  Phone, Mail, ArrowLeft, Search, Building2, Stethoscope,
  IndianRupee, FileText, Copy, Check
} from 'lucide-react'
import { publicApi } from '../api/client'
import Navbar from '../components/Navbar'

const STEPS = ['Select Doctor', 'Choose Slot', 'Patient Details', 'Confirmation']

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center mb-10">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className={`flex flex-col items-center`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
              i < current ? 'bg-green-500 text-white'
              : i === current ? 'bg-[#0F2557] text-white'
              : 'bg-gray-200 text-gray-500'
            }`}>
              {i < current ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs mt-1.5 font-medium hidden sm:block ${i <= current ? 'text-gray-700' : 'text-gray-400'}`}>
              {step}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-12 sm:w-20 mx-1 sm:mx-2 mb-4 transition-colors ${i < current ? 'bg-green-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// Step 1: Select Clinic + Doctor
function Step1({ onNext }) {
  const [searchParams] = useSearchParams()
  const [clinicId, setClinicId] = useState(searchParams.get('clinicId') || '')
  const [doctorId, setDoctorId] = useState(searchParams.get('doctorId') || '')
  const [searchText, setSearchText] = useState('')
  const [clinics, setClinics] = useState([])
  const [selectedClinic, setSelectedClinic] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadClinicDetail = async (slug, preselectedDoctorId) => {
    setLoading(true)
    try {
      const detail = await publicApi.getClinicBySlug(slug)
      const c = detail.clinic || detail
      setSelectedClinic(c)
      setDoctors(c.doctors || [])
      if (preselectedDoctorId) {
        const d = (c.doctors || []).find(d => String(d.id) === String(preselectedDoctorId))
        if (d) setSelectedDoctor(d)
      }
    } catch {
      setError('Could not load clinic details.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-load if params provided
  useEffect(() => {
    if (clinicId) {
      publicApi.getClinics({ id: clinicId }).then(data => {
        const list = Array.isArray(data) ? data : data.clinics || []
        if (list.length > 0) {
          loadClinicDetail(list[0].slug, doctorId)
        } else {
          setLoading(false)
        }
      }).catch(() => setLoading(false))
    }
  }, []) // eslint-disable-line

  const searchClinics = async () => {
    if (!searchText.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await publicApi.getClinics({ q: searchText })
      setClinics(Array.isArray(data) ? data : data.clinics || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectClinic = async (clinic) => {
    setClinics([])
    setSearchText('')
    setSelectedDoctor(null)
    await loadClinicDetail(clinic.slug)
  }

  const handleNext = () => {
    if (!selectedDoctor) return
    onNext({ clinic: selectedClinic, doctor: selectedDoctor })
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">Select a Clinic & Doctor</h2>

      {!selectedClinic ? (
        <div>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchClinics()}
                placeholder="Search clinic by name or city..."
                className="input pl-10"
              />
            </div>
            <button onClick={searchClinics} disabled={loading} className="btn-primary px-5">
              Search
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          {loading && <p className="text-gray-500 text-sm">Searching...</p>}
          {clinics.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {clinics.map(clinic => (
                <button
                  key={clinic.id}
                  onClick={() => selectClinic(clinic)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-[#EEF2FF] transition-colors border-b last:border-0 text-left"
                >
                  <Building2 className="w-5 h-5 text-[#0F2557] flex-shrink-0" />
                  <div>
                    <div className="font-medium text-gray-900">{clinic.name}</div>
                    <div className="text-sm text-gray-500">{clinic.specialty} · {clinic.city}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                </button>
              ))}
            </div>
          )}
          {!loading && clinics.length === 0 && searchText && (
            <p className="text-gray-400 text-sm text-center py-8">No clinics found. Try a different search.</p>
          )}
          <p className="text-gray-400 text-sm text-center mt-8">or <Link to="/clinics" className="text-[#0F2557] underline">browse all clinics</Link></p>
        </div>
      ) : (
        <div>
          {/* Selected Clinic */}
          <div className="bg-[#EEF2FF] rounded-xl p-4 flex items-center gap-3 mb-6">
            <Building2 className="w-6 h-6 text-[#0F2557]" />
            <div className="flex-1">
              <div className="font-semibold text-gray-900">{selectedClinic.name}</div>
              <div className="text-sm text-gray-500">{selectedClinic.specialty} · {selectedClinic.city}</div>
            </div>
            <button onClick={() => { setSelectedClinic(null); setSelectedDoctor(null) }} className="text-gray-400 hover:text-red-500 text-xs transition-colors">Change</button>
          </div>

          {/* Doctor selection */}
          <h3 className="font-semibold text-gray-800 mb-3">Choose a Doctor</h3>
          {doctors.length === 0 ? (
            <p className="text-gray-400 text-sm">No doctors available for this clinic.</p>
          ) : (
            <div className="space-y-3">
              {doctors.map(doctor => (
                <button
                  key={doctor.id}
                  onClick={() => setSelectedDoctor(doctor)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedDoctor?.id === doctor.id
                      ? 'border-[#0F2557] bg-[#EEF2FF]'
                      : 'border-gray-200 hover:border-primary-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#DBEAFE] rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-[#0F2557]" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{doctor.name}</div>
                      <div className="text-sm text-gray-500">{doctor.specialty}</div>
                    </div>
                    <div className="text-right">
                      {doctor.fee && (
                        <div className="text-[#0F2557] font-semibold text-sm">₹{doctor.fee}</div>
                      )}
                      {doctor.experience_years && (
                        <div className="text-xs text-gray-400">{doctor.experience_years} yrs exp</div>
                      )}
                    </div>
                    {selectedDoctor?.id === doctor.id && (
                      <CheckCircle className="w-5 h-5 text-[#0F2557] ml-2" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleNext}
            disabled={!selectedDoctor}
            className={`mt-8 w-full py-3 rounded-xl font-semibold transition-colors ${
              selectedDoctor ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Continue <ChevronRight className="w-4 h-4 inline" />
          </button>
        </div>
      )}
    </div>
  )
}

// Step 2: Select date + slot
function Step2({ data, onNext, onBack }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchSlots = async (d) => {
    setLoading(true)
    setError('')
    setSlots([])
    setSelectedSlot(null)
    try {
      const result = await publicApi.getDoctorSlots(data.doctor.id, d, data.clinic?.default_branch_id)
      setSlots(Array.isArray(result) ? result : result.slots || [])
    } catch (err) {
      setError('Could not load slots. Please try another date or contact the clinic.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSlots(date)
  }, []) // eslint-disable-line

  const handleDateChange = (e) => {
    setDate(e.target.value)
    fetchSlots(e.target.value)
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Choose Date & Time</h2>
      <div className="bg-[#EEF2FF] rounded-xl p-4 flex items-center gap-3 mb-6">
        <User className="w-5 h-5 text-[#0F2557]" />
        <div>
          <div className="font-medium text-gray-900">{data.doctor.name}</div>
          <div className="text-sm text-gray-500">{data.clinic.name}</div>
        </div>
        {data.doctor.fee && (
          <div className="ml-auto text-[#0F2557] font-semibold">₹{data.doctor.fee}</div>
        )}
      </div>

      <div className="mb-6">
        <label className="label">Select Date</label>
        <input
          type="date"
          value={date}
          min={today}
          onChange={handleDateChange}
          className="input max-w-xs"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-6">
          <div className="w-5 h-5 border-2 border-[#0F2557] border-t-transparent rounded-full animate-spin"></div>
          Loading available slots...
        </div>
      ) : error ? (
        <p className="text-amber-600 text-sm mb-4 bg-amber-50 p-3 rounded-lg">{error}</p>
      ) : null}

      {slots.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">{slots.length} slots available</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {slots.map(slot => {
              const time = typeof slot === 'string' ? slot : slot.time
              const available = typeof slot === 'object' ? slot.available !== false : true
              return (
                <button
                  key={time}
                  disabled={!available}
                  onClick={() => setSelectedSlot(time)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
                    !available ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                    : selectedSlot === time ? 'bg-[#0F2557] text-white border-[#0F2557]'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-[#0F2557]/40'
                  }`}
                >
                  {time}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {slots.length === 0 && !loading && (
        <div className="text-center py-10 bg-gray-50 rounded-xl">
          <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No slots available for this date</p>
          <p className="text-gray-400 text-xs mt-1">Try selecting a different date</p>
        </div>
      )}

      <div className="flex gap-3 mt-8">
        <button onClick={onBack} className="btn-outline flex-1">Back</button>
        <button
          onClick={() => onNext({ date, slot: selectedSlot })}
          disabled={!selectedSlot}
          className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
            selectedSlot ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

// Step 3: Patient details
function Step3({ data, onNext, onBack }) {
  const [form, setForm] = useState({
    patient_name: '',
    mobile: '',
    email: '',
    reason: '',
    age: '',
    gender: '',
  })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.patient_name.trim()) e.patient_name = 'Name is required'
    if (!form.mobile.trim() || !/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = 'Valid 10-digit mobile number required'
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email address'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (validate()) onNext(form)
  }

  const f = (k) => ({
    value: form[k],
    onChange: e => setForm(prev => ({ ...prev, [k]: e.target.value }))
  })

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Patient Details</h2>
      <div className="bg-[#EEF2FF] rounded-xl p-4 mb-6 text-sm">
        <div className="grid grid-cols-2 gap-2 text-gray-600">
          <div><span className="font-medium">Doctor:</span> {data.doctor.name}</div>
          <div><span className="font-medium">Clinic:</span> {data.clinic.name}</div>
          <div><span className="font-medium">Date:</span> {data.date}</div>
          <div><span className="font-medium">Time:</span> {data.slot}</div>
          {data.doctor.fee && <div><span className="font-medium">Fee:</span> ₹{data.doctor.fee}</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Full Name <span className="text-red-500">*</span></label>
          <input {...f('patient_name')} type="text" placeholder="Patient's full name" className={`input ${errors.patient_name ? 'border-red-400' : ''}`} />
          {errors.patient_name && <p className="text-red-500 text-xs mt-1">{errors.patient_name}</p>}
        </div>
        <div>
          <label className="label">Mobile Number <span className="text-red-500">*</span></label>
          <input {...f('mobile')} type="tel" maxLength={10} placeholder="10-digit mobile number" className={`input ${errors.mobile ? 'border-red-400' : ''}`} />
          {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
        </div>
        <div>
          <label className="label">Email Address</label>
          <input {...f('email')} type="email" placeholder="Optional" className={`input ${errors.email ? 'border-red-400' : ''}`} />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>
        <div>
          <label className="label">Age</label>
          <input {...f('age')} type="number" min="0" max="150" placeholder="Patient age" className="input" />
        </div>
        <div>
          <label className="label">Gender</label>
          <select {...f('gender')} className="input">
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Reason for Visit</label>
          <textarea {...f('reason')} rows={3} placeholder="Briefly describe symptoms or reason for consultation..." className="input resize-none" />
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <button onClick={onBack} className="btn-outline flex-1">Back</button>
        <button onClick={handleSubmit} className="btn-primary flex-1">Confirm Booking</button>
      </div>
    </div>
  )
}

// Step 4: Confirmation
function Step4({ booking }) {
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()

  const copyCode = () => {
    navigator.clipboard.writeText(booking.confirmation_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-green-500" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
      <p className="text-gray-500 mb-8">Your appointment has been successfully booked. Save your confirmation code.</p>

      <div className="bg-[#EEF2FF] border-2 border-[#93c5fd] rounded-2xl p-6 mb-8 max-w-sm mx-auto">
        <p className="text-sm text-gray-500 mb-2">Confirmation Code</p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-3xl font-bold text-[#0F2557] tracking-widest">{booking.confirmation_code}</span>
          <button onClick={copyCode} className="p-2 hover:bg-[#DBEAFE] rounded-lg transition-colors" title="Copy code">
            {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-[#0F2557]" />}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 text-left max-w-sm mx-auto mb-8 space-y-3 text-sm">
        {booking.doctor_name && (
          <div className="flex justify-between">
            <span className="text-gray-500">Doctor</span>
            <span className="font-medium">{booking.doctor_name}</span>
          </div>
        )}
        {booking.clinic_name && (
          <div className="flex justify-between">
            <span className="text-gray-500">Clinic</span>
            <span className="font-medium">{booking.clinic_name}</span>
          </div>
        )}
        {booking.date && (
          <div className="flex justify-between">
            <span className="text-gray-500">Date</span>
            <span className="font-medium">{booking.date}</span>
          </div>
        )}
        {booking.slot && (
          <div className="flex justify-between">
            <span className="text-gray-500">Time</span>
            <span className="font-medium">{booking.slot}</span>
          </div>
        )}
        {booking.patient_name && (
          <div className="flex justify-between">
            <span className="text-gray-500">Patient</span>
            <span className="font-medium">{booking.patient_name}</span>
          </div>
        )}
      </div>

      <p className="text-gray-400 text-xs mb-6">Show this code at the clinic reception. You can also check your booking status anytime.</p>

      <div className="flex gap-3 justify-center">
        <button
          onClick={() => navigate(`/booking/${booking.confirmation_code}`)}
          className="btn-outline"
        >
          Check Status
        </button>
        <button onClick={() => navigate('/clinics')} className="btn-primary">Book Another</button>
      </div>
    </div>
  )
}

export default function BookAppointment() {
  const [step, setStep] = useState(0)
  const [bookingData, setBookingData] = useState({})
  const [confirmedBooking, setConfirmedBooking] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const handleStep1 = (data) => {
    setBookingData(prev => ({ ...prev, ...data }))
    setStep(1)
  }
  const handleStep2 = (data) => {
    setBookingData(prev => ({ ...prev, ...data }))
    setStep(2)
  }
  const handleStep3 = async (patientData) => {
    setSubmitting(true)
    setSubmitError('')
    const payload = {
      clinic_id: bookingData.clinic?.id,
      branch_id: bookingData.clinic?.default_branch_id || null,
      doctor_id: bookingData.doctor?.id,
      booking_date: bookingData.date,
      booking_time: bookingData.slot,
      patient_name: patientData.patient_name,
      patient_mobile: patientData.mobile,
      patient_email: patientData.email || undefined,
      reason: patientData.reason || undefined,
    }
    try {
      const result = await publicApi.bookAppointment(payload)
      const booking = result.booking || result
      setConfirmedBooking({
        confirmation_code: booking.confirmation_code || booking.code || 'BC' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        doctor_name: bookingData.doctor?.name,
        clinic_name: bookingData.clinic?.name,
        date: bookingData.date,
        slot: bookingData.slot,
        patient_name: patientData.patient_name,
      })
      setStep(3)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <Link to="/clinics" className="inline-flex items-center gap-1 text-gray-500 hover:text-[#0F2557] text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Clinics
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">Book Appointment</h1>
        </div>

        <StepIndicator current={step} />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          {submitting ? (
            <div className="flex flex-col items-center py-16">
              <div className="w-12 h-12 border-4 border-[#0F2557] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 font-medium">Confirming your booking...</p>
            </div>
          ) : (
            <>
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-600 text-sm">
                  {submitError}
                </div>
              )}
              {step === 0 && <Step1 onNext={handleStep1} />}
              {step === 1 && <Step2 data={bookingData} onNext={handleStep2} onBack={() => setStep(0)} />}
              {step === 2 && <Step3 data={bookingData} onNext={handleStep3} onBack={() => setStep(1)} />}
              {step === 3 && confirmedBooking && <Step4 booking={confirmedBooking} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
