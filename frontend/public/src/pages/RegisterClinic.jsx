import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, Building2, User, Lock, CheckCircle, ArrowLeft,
  ChevronRight, Check, Eye, EyeOff
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
          <Link to="/clinics" className="text-gray-600 hover:text-primary-600 font-medium text-sm hidden md:block">Find Clinics</Link>
        </div>
      </div>
    </nav>
  )
}

const STEPS = ['Clinic Details', 'Doctor Details', 'Admin Account', 'Review & Submit']

const SPECIALTIES = [
  'General Medicine', 'Cardiology', 'Dermatology', 'Pediatrics',
  'Orthopedics', 'Gynecology', 'Neurology', 'Ophthalmology',
  'ENT', 'Psychiatry', 'Dentistry', 'Ayurveda', 'Multi-Specialty',
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
              i < current ? 'bg-green-500 text-white'
              : i === current ? 'bg-primary-600 text-white'
              : 'bg-gray-200 text-gray-500'
            }`}>
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
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

// Step 1: Clinic Details
function Step1({ data, onChange, onNext }) {
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!data.clinic_name?.trim()) e.clinic_name = 'Clinic name is required'
    if (!data.specialty) e.specialty = 'Specialty is required'
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
    className: `input ${errors[k] ? 'border-red-400' : ''}`,
    ...extra,
  })

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Clinic Details</h2>
      <p className="text-gray-500 text-sm mb-6">Tell us about your clinic</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Clinic Name" required error={errors.clinic_name}>
          <input type="text" {...inp('clinic_name')} placeholder="e.g. City Care Clinic" />
        </Field>
        <Field label="Specialty" required error={errors.specialty}>
          <select {...inp('specialty')}>
            <option value="">Select specialty</option>
            {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
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
        <Field label="Phone Number" required error={errors.phone}>
          <input type="tel" {...inp('phone')} maxLength={10} placeholder="10-digit number" />
        </Field>
        <Field label="Email Address" required error={errors.email}>
          <input type="email" {...inp('email')} placeholder="clinic@example.com" />
        </Field>
        <div className="md:col-span-2">
          <Field label="Full Address" required error={errors.address}>
            <textarea
              value={data.address || ''}
              onChange={e => onChange('address', e.target.value)}
              rows={2}
              placeholder="Street address, landmark..."
              className={`input resize-none ${errors.address ? 'border-red-400' : ''}`}
            />
          </Field>
        </div>
        <Field label="Pincode">
          <input type="text" {...inp('pincode')} maxLength={6} placeholder="6-digit pincode" />
        </Field>
      </div>
      <button onClick={() => { if (validate()) onNext() }} className="btn-primary mt-8 w-full">
        Continue <ChevronRight className="w-4 h-4 inline" />
      </button>
    </div>
  )
}

// Step 2: Doctor Details
function Step2({ data, onChange, onNext, onBack }) {
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!data.doctor_name?.trim()) e.doctor_name = 'Doctor name is required'
    if (!data.doctor_specialty) e.doctor_specialty = 'Specialty is required'
    if (!data.qualification?.trim()) e.qualification = 'Qualification is required'
    if (!data.mci_number?.trim()) e.mci_number = 'MCI registration number is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const inp = (k) => ({
    value: data[k] || '',
    onChange: e => onChange(k, e.target.value),
    className: `input ${errors[k] ? 'border-red-400' : ''}`,
  })

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Primary Doctor Details</h2>
      <p className="text-gray-500 text-sm mb-6">Details of the main consulting doctor</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Doctor's Full Name" required error={errors.doctor_name}>
          <input type="text" {...inp('doctor_name')} placeholder="Dr. Firstname Lastname" />
        </Field>
        <Field label="Specialty" required error={errors.doctor_specialty}>
          <select {...inp('doctor_specialty')}>
            <option value="">Select specialty</option>
            {SPECIALTIES.filter(s => s !== 'Multi-Specialty').map(s => <option key={s} value={s}>{s}</option>)}
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
        <Field label="Doctor's Phone (optional)">
          <input type="tel" {...inp('doctor_phone')} maxLength={10} placeholder="10-digit number" />
        </Field>
      </div>
      <div className="flex gap-3 mt-8">
        <button onClick={onBack} className="btn-outline flex-1">Back</button>
        <button onClick={() => { if (validate()) onNext() }} className="btn-primary flex-1">
          Continue <ChevronRight className="w-4 h-4 inline" />
        </button>
      </div>
    </div>
  )
}

// Step 3: Admin credentials
function Step3({ data, onChange, onNext, onBack }) {
  const [errors, setErrors] = useState({})
  const [showPass, setShowPass] = useState(false)

  const validate = () => {
    const e = {}
    if (!data.admin_email?.trim() || !/\S+@\S+\.\S+/.test(data.admin_email)) e.admin_email = 'Valid email required'
    if (!data.admin_password || data.admin_password.length < 8) e.admin_password = 'Password must be at least 8 characters'
    if (data.admin_password !== data.confirm_password) e.confirm_password = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Admin Account</h2>
      <p className="text-gray-500 text-sm mb-6">These credentials will log you into the clinic dashboard</p>
      <div className="space-y-4 max-w-md">
        <Field label="Admin Email" required error={errors.admin_email}>
          <input
            type="email"
            value={data.admin_email || ''}
            onChange={e => onChange('admin_email', e.target.value)}
            placeholder="admin@yourclinic.com"
            className={`input ${errors.admin_email ? 'border-red-400' : ''}`}
          />
        </Field>
        <Field label="Password" required error={errors.admin_password}>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={data.admin_password || ''}
              onChange={e => onChange('admin_password', e.target.value)}
              placeholder="Minimum 8 characters"
              className={`input pr-10 ${errors.admin_password ? 'border-red-400' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPass(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </Field>
        <Field label="Confirm Password" required error={errors.confirm_password}>
          <input
            type="password"
            value={data.confirm_password || ''}
            onChange={e => onChange('confirm_password', e.target.value)}
            placeholder="Re-enter password"
            className={`input ${errors.confirm_password ? 'border-red-400' : ''}`}
          />
        </Field>
      </div>
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 max-w-md">
        <p className="font-medium mb-1">Security Note</p>
        <p>Use a strong password. This account will have full access to your clinic's patient data.</p>
      </div>
      <div className="flex gap-3 mt-8">
        <button onClick={onBack} className="btn-outline flex-1">Back</button>
        <button onClick={() => { if (validate()) onNext() }} className="btn-primary flex-1">
          Review &amp; Submit <ChevronRight className="w-4 h-4 inline" />
        </button>
      </div>
    </div>
  )
}

// Step 4: Review & Submit
function Step4({ data, onBack, onSubmit, submitting, error }) {
  const rows = [
    { label: 'Clinic Name', value: data.clinic_name },
    { label: 'Specialty', value: data.specialty },
    { label: 'City', value: data.city },
    { label: 'State', value: data.state },
    { label: 'Phone', value: data.phone },
    { label: 'Email', value: data.email },
    { label: 'Address', value: data.address },
    { label: 'Doctor Name', value: data.doctor_name },
    { label: 'Doctor Specialty', value: data.doctor_specialty },
    { label: 'Qualification', value: data.qualification },
    { label: 'MCI Number', value: data.mci_number },
    { label: 'Experience', value: data.experience_years ? `${data.experience_years} years` : null },
    { label: 'Consultation Fee', value: data.fee ? `₹${data.fee}` : null },
    { label: 'Admin Email', value: data.admin_email },
  ].filter(r => r.value)

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Review Your Details</h2>
      <p className="text-gray-500 text-sm mb-6">Please review before submitting. You can go back to make changes.</p>
      <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex justify-between items-center px-4 py-3 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
          >
            <span className="text-gray-500 font-medium flex-shrink-0 mr-4">{row.label}</span>
            <span className="text-gray-900 font-semibold text-right">{row.value}</span>
          </div>
        ))}
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-6">
          {error}
        </div>
      )}
      <p className="text-xs text-gray-400 mb-6 leading-relaxed">
        By submitting, you agree to BharatCliniq's Terms of Service and Privacy Policy. Your registration will be reviewed within 24 hours.
      </p>
      <div className="flex gap-3">
        <button onClick={onBack} disabled={submitting} className="btn-outline flex-1">Back</button>
        <button onClick={onSubmit} disabled={submitting} className="btn-primary flex-1">
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting...
            </span>
          ) : (
            'Submit Registration'
          )}
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
      <h2 className="text-2xl font-bold text-gray-900 mb-3">Registration Submitted!</h2>
      <p className="text-gray-500 mb-2 max-w-sm mx-auto">
        Thank you for registering with BharatCliniq. Your clinic is currently{' '}
        <strong className="text-yellow-600">pending approval</strong>.
      </p>
      <p className="text-gray-400 text-sm mb-8 max-w-sm mx-auto">
        Our team will review your details within 24 hours and notify you at your registered email. Once approved, you'll receive login credentials for your clinic dashboard.
      </p>
      <div className="bg-primary-50 border border-primary-200 rounded-2xl p-6 max-w-sm mx-auto mb-8 text-sm text-left space-y-4">
        <h3 className="font-semibold text-primary-800">What happens next?</h3>
        {[
          'Our team verifies your clinic and doctor credentials',
          'You receive an approval email with dashboard access',
          'Set up your profile, slots, and start accepting bookings',
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-5 h-5 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              {i + 1}
            </div>
            <p className="text-gray-600">{step}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/" className="btn-outline">Go to Homepage</Link>
        <Link to="/clinics" className="btn-primary">Browse Clinics</Link>
      </div>
    </div>
  )
}

export default function RegisterClinic() {
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [formData, setFormData] = useState({})

  const updateField = (key, value) => setFormData(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      await publicApi.registerClinic({
        clinic: {
          name: formData.clinic_name,
          specialty: formData.specialty,
          city: formData.city,
          state: formData.state,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          pincode: formData.pincode,
        },
        doctor: {
          name: formData.doctor_name,
          specialty: formData.doctor_specialty,
          qualification: formData.qualification,
          mci_number: formData.mci_number,
          experience_years: formData.experience_years ? Number(formData.experience_years) : null,
          fee: formData.fee ? Number(formData.fee) : null,
          phone: formData.doctor_phone,
        },
        admin: {
          email: formData.admin_email,
          password: formData.admin_password,
        },
      })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {!submitted && (
        <div className="bg-primary-600 text-white py-8 px-4">
          <div className="max-w-3xl mx-auto">
            <Link to="/" className="inline-flex items-center gap-1 text-blue-200 hover:text-white text-sm mb-3 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
            <h1 className="text-2xl font-bold">Register Your Clinic</h1>
            <p className="text-blue-100 text-sm mt-1">Join India's fastest-growing digital clinic platform. Free to register.</p>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-10">
        {submitted ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <SuccessScreen />
          </div>
        ) : (
          <>
            <StepIndicator current={step} />
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              {step === 0 && <Step1 data={formData} onChange={updateField} onNext={() => setStep(1)} />}
              {step === 1 && <Step2 data={formData} onChange={updateField} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
              {step === 2 && <Step3 data={formData} onChange={updateField} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
              {step === 3 && (
                <Step4
                  data={formData}
                  onBack={() => setStep(2)}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                  error={submitError}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
