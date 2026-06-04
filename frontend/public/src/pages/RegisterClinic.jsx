import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ChevronRight, Check, CheckCircle, ArrowLeft, Mail, Phone, Upload, X } from 'lucide-react'
import { publicApi } from '../api/client'
import BrandLogo from '../components/BrandLogo'

function Navbar() {
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/"><BrandLogo size="md" /></Link>
          <Link to="/clinics" className="text-gray-600 hover:text-gray-900 font-medium text-sm hidden md:block">Find Clinics</Link>
        </div>
      </div>
    </nav>
  )
}

const STEPS = ['Clinic Details', 'Doctor Details', 'Review & Submit']

const CLINIC_TYPES = [
  'General / Primary Care',
  'Multispecialty',
  'Dental',
  'Ayurveda',
  'Homeopathy',
  'Naturopathy',
  'Physiotherapy',
  'Eye Care (Ophthalmology)',
  'Skin & Cosmetic',
  'Diagnostics & Lab',
  'Emergency & Trauma',
  'Mother & Child Care',
  'Mental Health',
  'Other',
]

const DOCTOR_SPECIALTIES = [
  'General Medicine', 'Cardiology', 'Dermatology', 'Pediatrics',
  'Orthopedics', 'Gynecology', 'Neurology', 'Ophthalmology',
  'ENT', 'Psychiatry', 'Dentistry', 'Ayurveda', 'Homeopathy',
  'Physiotherapy', 'Radiology', 'Pathology', 'Oncology',
  'Nephrology', 'Gastroenterology', 'Endocrinology', 'Other',
]

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Delhi', 'Jammu & Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
]

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-between mb-10 overflow-x-auto pb-2">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center flex-shrink-0">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
              i < current ? 'bg-green-500 text-white' : i === current ? 'text-white' : 'bg-gray-200 text-gray-500'
            }`} style={i === current ? { background: '#0F2557' } : {}}>
              {i < current ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs mt-1.5 font-medium whitespace-nowrap ${i <= current ? 'text-gray-700' : 'text-gray-400'}`}>
              {step}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-8 sm:w-14 mx-1 sm:mx-2 mb-4 transition-colors ${i < current ? 'bg-green-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

const inputCls = (err) =>
  `w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all ${err ? 'border-red-400' : 'border-gray-300'}`

const btnPrimary = { background: '#CC1414' }

// ── Step 1: Clinic Details ────────────────────────────────────────────────────
function Step1({ data, onChange, onNext }) {
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!data.clinic_name?.trim()) e.clinic_name = 'Clinic name is required'
    if (!data.specialty) e.specialty = 'Clinic type is required'
    if (!data.city?.trim()) e.city = 'City is required'
    if (!data.state) e.state = 'State is required'
    if (!data.phone?.trim() || !/^[6-9]\d{9}$/.test(data.phone)) e.phone = 'Valid 10-digit phone required'
    if (!data.email?.trim() || !/\S+@\S+\.\S+/.test(data.email)) e.email = 'Valid email required'
    if (!data.address?.trim()) e.address = 'Address is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const inp = (k, extra = {}) => ({
    value: data[k] || '',
    onChange: e => onChange(k, e.target.value),
    className: inputCls(errors[k]),
    ...extra,
  })

  return (
    <div>
      <h2 className="text-xl font-bold mb-1" style={{ color: '#0F2557' }}>Clinic Details</h2>
      <p className="text-gray-500 text-sm mb-6">Tell us about your clinic</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Clinic Name" required error={errors.clinic_name}>
          <input type="text" {...inp('clinic_name')} placeholder="e.g. City Care Clinic" />
        </Field>
        <Field label="Clinic Type" required error={errors.specialty}>
          <select {...inp('specialty')}>
            <option value="">Select clinic type</option>
            {CLINIC_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="City" required error={errors.city}>
          <input type="text" {...inp('city')} placeholder="e.g. Mumbai" />
        </Field>
        <Field label="State" required error={errors.state}>
          <select {...inp('state')}>
            <option value="">Select state</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Clinic Phone" required error={errors.phone}>
          <input type="tel" {...inp('phone')} maxLength={10} placeholder="10-digit number" />
        </Field>
        <Field label="Clinic Email" required error={errors.email}>
          <input type="email" {...inp('email')} placeholder="clinic@example.com" />
        </Field>
        <div className="md:col-span-2">
          <Field label="Full Address" required error={errors.address}>
            <textarea value={data.address || ''} onChange={e => onChange('address', e.target.value)}
              rows={2} placeholder="Street address, landmark..."
              className={`${inputCls(errors.address)} resize-none`} />
          </Field>
        </div>
        <Field label="Pincode">
          <input type="text" {...inp('pincode')} maxLength={6} placeholder="6-digit pincode" />
        </Field>
      </div>
      <button onClick={() => { if (validate()) onNext() }}
        className="mt-8 w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white"
        style={btnPrimary}>
        Continue <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Step 2: Doctor Details ────────────────────────────────────────────────────
function Step2({ data, onChange, onNext, onBack }) {
  const [errors, setErrors] = useState({})
  const fileRef = useRef(null)

  const validate = () => {
    const e = {}
    if (!data.doctor_name?.trim()) e.doctor_name = 'Doctor name is required'
    if (!data.doctor_email?.trim() || !/\S+@\S+\.\S+/.test(data.doctor_email)) e.doctor_email = 'Valid email required — login credentials will be sent here'
    if (!data.doctor_phone?.trim() || !/^[6-9]\d{9}$/.test(data.doctor_phone)) e.doctor_phone = 'Valid 10-digit phone required — credentials also sent via SMS'
    if (!data.doctor_specialty) e.doctor_specialty = 'Specialty is required'
    if (!data.qualification?.trim()) e.qualification = 'Qualification is required'
    if (!data.mci_number?.trim()) e.mci_number = 'MCI registration number is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const inp = (k) => ({
    value: data[k] || '',
    onChange: e => onChange(k, e.target.value),
    className: inputCls(errors[k]),
  })

  return (
    <div>
      <h2 className="text-xl font-bold mb-1" style={{ color: '#0F2557' }}>Primary Doctor Details</h2>
      <p className="text-gray-500 text-sm mb-2">Details of the main consulting doctor / clinic owner</p>

      {/* Credentials notice */}
      <div className="mb-5 rounded-xl p-3 text-xs flex gap-3 items-start" style={{ background: '#0F255510', border: '1px solid #0F255530' }}>
        <span className="text-lg mt-0.5">🔐</span>
        <p style={{ color: '#0F2557' }}>
          No password needed now. Once your clinic is approved, your <strong>username and temporary password</strong> will be sent to the email and phone number you provide below.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Doctor's Full Name" required error={errors.doctor_name}>
          <input type="text" {...inp('doctor_name')} placeholder="Dr. Firstname Lastname" />
        </Field>
        <Field label="Doctor's Email" required error={errors.doctor_email}>
          <input type="email" {...inp('doctor_email')} placeholder="doctor@example.com" />
        </Field>
        <Field label="Doctor's Phone" required error={errors.doctor_phone}>
          <input type="tel" {...inp('doctor_phone')} maxLength={10} placeholder="10-digit mobile number" />
        </Field>
        <Field label="Specialty" required error={errors.doctor_specialty}>
          <select {...inp('doctor_specialty')}>
            <option value="">Select specialty</option>
            {DOCTOR_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Qualification" required error={errors.qualification}>
          <input type="text" {...inp('qualification')} placeholder="e.g. MBBS, MD (Internal Medicine)" />
        </Field>
        <Field label="MCI Registration Number" required error={errors.mci_number}>
          <input type="text" {...inp('mci_number')} placeholder="e.g. MH/12345/2010" />
        </Field>
        <Field label="Experience (years)">
          <input type="number" {...inp('experience_years')} min="0" max="60" placeholder="e.g. 10" />
        </Field>
        <Field label="Consultation Fee (₹)">
          <input type="number" {...inp('fee')} min="0" placeholder="e.g. 500" />
        </Field>
      </div>

      {/* License upload */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Degree / License Document <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        {data.license_file ? (
          <div className="flex items-center gap-3 px-4 py-3 border border-green-300 rounded-xl bg-green-50 text-sm">
            <Upload size={16} className="text-green-600 flex-shrink-0" />
            <span className="text-green-700 font-medium truncate flex-1">{data.license_file.name}</span>
            <button type="button" onClick={() => onChange('license_file', null)}
              className="text-gray-400 hover:text-red-500 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2">
            <Upload size={16} /> Upload PDF, JPG or PNG (max 5MB)
          </button>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f && f.size <= 5 * 1024 * 1024) onChange('license_file', f)
            else if (f) alert('File size must be under 5MB')
            e.target.value = ''
          }} />
        <p className="text-xs text-gray-400 mt-1">MBBS degree, medical council registration certificate, or any valid practitioner license.</p>
      </div>
      <div className="flex gap-3 mt-8">
        <button onClick={onBack} className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 border-2 rounded-xl font-semibold text-sm"
          style={{ borderColor: '#0F2557', color: '#0F2557' }}>Back</button>
        <button onClick={() => { if (validate()) onNext() }}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white"
          style={btnPrimary}>
          Review &amp; Submit <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Review & Submit ───────────────────────────────────────────────────
function Step3({ data, onBack, onSubmit, submitting, error }) {
  const rows = [
    { label: 'Clinic Name',      value: data.clinic_name },
    { label: 'Clinic Type',      value: data.specialty },
    { label: 'City',             value: data.city },
    { label: 'State',            value: data.state },
    { label: 'Clinic Phone',     value: data.phone },
    { label: 'Clinic Email',     value: data.email },
    { label: 'Address',          value: data.address },
    { label: 'Doctor Name',      value: data.doctor_name },
    { label: 'Doctor Email',     value: data.doctor_email },
    { label: 'Doctor Phone',     value: data.doctor_phone },
    { label: 'Doctor Specialty', value: data.doctor_specialty },
    { label: 'Qualification',    value: data.qualification },
    { label: 'MCI Number',       value: data.mci_number },
    { label: 'Experience',       value: data.experience_years ? `${data.experience_years} years` : null },
    { label: 'Consultation Fee', value: data.fee ? `₹${data.fee}` : null },
    { label: 'License Document', value: data.license_file ? data.license_file.name : null },
  ].filter(r => r.value)

  return (
    <div>
      <h2 className="text-xl font-bold mb-1" style={{ color: '#0F2557' }}>Review Your Details</h2>
      <p className="text-gray-500 text-sm mb-6">Please verify all details before submitting.</p>

      <div className="border border-gray-200 rounded-xl overflow-hidden mb-5">
        {rows.map((row, i) => (
          <div key={row.label} className={`flex justify-between items-center px-4 py-3 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
            <span className="text-gray-500 font-medium flex-shrink-0 mr-4">{row.label}</span>
            <span className="font-semibold text-right" style={{ color: '#0F2557' }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Credentials delivery notice */}
      <div className="mb-5 rounded-xl p-4 text-sm" style={{ background: '#0F255510', border: '1px solid #0F255530' }}>
        <p className="font-semibold mb-2" style={{ color: '#0F2557' }}>After approval, credentials will be sent to:</p>
        <div className="flex items-center gap-2 text-gray-600 mb-1"><Mail size={14} /> {data.doctor_email}</div>
        <div className="flex items-center gap-2 text-gray-600"><Phone size={14} /> {data.doctor_phone}</div>
        <p className="text-gray-400 text-xs mt-2">Your username and a one-time password will be sent to both. You will be asked to set a permanent password on first login.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-5">{error}</div>
      )}
      <p className="text-xs text-gray-400 mb-6 leading-relaxed">
        By submitting, you agree to BHaratCliniq's Terms of Service and Privacy Policy. Registration will be reviewed within 24 hours.
      </p>
      <div className="flex gap-3">
        <button onClick={onBack} disabled={submitting}
          className="flex-1 inline-flex items-center justify-center px-6 py-3 border-2 rounded-xl font-semibold text-sm"
          style={{ borderColor: '#0F2557', color: '#0F2557' }}>Back</button>
        <button onClick={onSubmit} disabled={submitting}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
          style={btnPrimary}>
          {submitting
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting...</>
            : 'Submit Registration'}
        </button>
      </div>
    </div>
  )
}

function SuccessScreen() {
  return (
    <div className="text-center py-8">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-12 h-12 text-green-500" />
      </div>
      <h2 className="text-2xl font-bold mb-3" style={{ color: '#0F2557' }}>Registration Submitted!</h2>
      <p className="text-gray-500 mb-2 max-w-sm mx-auto">
        Thank you for registering with BHaratCliniq. Your clinic is <strong className="text-yellow-600">pending approval</strong>.
      </p>
      <p className="text-gray-400 text-sm mb-8 max-w-sm mx-auto">
        Our team reviews registrations within 24 hours. Once approved, your login credentials will be sent directly to your registered email and phone.
      </p>
      <div className="rounded-2xl p-6 max-w-sm mx-auto mb-8 text-sm text-left space-y-4"
        style={{ background: '#0F255508', border: '1px solid #0F255520' }}>
        <h3 className="font-semibold" style={{ color: '#0F2557' }}>What happens next?</h3>
        {[
          'Our team verifies your clinic and doctor credentials',
          'You receive a username + one-time password via email and SMS',
          'Log in and set your permanent password to get started',
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-5 h-5 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
              style={{ background: '#0F2557' }}>{i + 1}</div>
            <p className="text-gray-600">{step}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/" className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 rounded-xl font-semibold text-sm"
          style={{ borderColor: '#0F2557', color: '#0F2557' }}>Go to Homepage</Link>
        <Link to="/clinics" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white"
          style={{ background: '#CC1414' }}>Browse Clinics</Link>
      </div>
    </div>
  )
}

export default function RegisterClinic() {
  const [step, setStep]           = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [formData, setFormData]   = useState({})

  const updateField = (key, value) => setFormData(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      await publicApi.registerClinic({
        clinic: {
          name:    formData.clinic_name,
          specialty: formData.specialty,
          city:    formData.city,
          state:   formData.state,
          phone:   formData.phone,
          email:   formData.email,
          address: formData.address,
          pincode: formData.pincode,
        },
        doctor: {
          full_name:           formData.doctor_name,
          email:               formData.doctor_email,
          mobile:              formData.doctor_phone,
          qualification:       formData.qualification,
          registration_number: formData.mci_number,
          experience_years:    formData.experience_years ? Number(formData.experience_years) : null,
          consultation_fee:    formData.fee ? Number(formData.fee) : 500,
          specialty:           formData.doctor_specialty,
        },
        admin_email: formData.doctor_email,
      })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#F0F4F8' }}>
      <Navbar />
      {!submitted && (
        <div className="text-white py-10 px-4" style={{ background: '#0F2557' }}>
          <div className="max-w-3xl mx-auto">
            <Link to="/" className="inline-flex items-center gap-1 text-blue-200 hover:text-white text-sm mb-3">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
            <h1 className="text-2xl font-extrabold">Register Your Clinic</h1>
            <p className="text-blue-200 text-sm mt-1">Join India's fastest-growing digital clinic platform. Free to register.</p>
          </div>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 py-10">
        {submitted ? (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
            <SuccessScreen />
          </div>
        ) : (
          <>
            <StepIndicator current={step} />
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 md:p-8">
              {step === 0 && <Step1 data={formData} onChange={updateField} onNext={() => setStep(1)} />}
              {step === 1 && <Step2 data={formData} onChange={updateField} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
              {step === 2 && (
                <Step3 data={formData} onBack={() => setStep(1)} onSubmit={handleSubmit}
                  submitting={submitting} error={submitError} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
