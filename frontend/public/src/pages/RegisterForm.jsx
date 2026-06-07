import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Building2, Pill, FlaskConical, ChevronRight, Check, CheckCircle, ArrowLeft, Mail, Phone } from 'lucide-react'
import { publicApi } from '../api/client'
import BrandLogo from '../components/BrandLogo'

// ── Shared constants ────────────────────────────────────────────────────────
const DEPARTMENTS = [
  'General Medicine', 'Cardiology', 'Dermatology', 'Pediatrics',
  'Orthopedics', 'Gynecology & Obstetrics', 'Neurology', 'Ophthalmology',
  'ENT (Ear Nose Throat)', 'Psychiatry & Mental Health', 'Dentistry',
  'Ayurveda', 'Homeopathy', 'Physiotherapy & Rehabilitation',
  'Radiology & Imaging', 'Pathology & Laboratory', 'Oncology',
  'Nephrology', 'Gastroenterology', 'Endocrinology & Diabetology',
  'Pulmonology', 'Urology', 'Rheumatology', 'Neonatology',
  'Emergency & Trauma', 'Surgical Oncology', 'Plastic Surgery',
  'Neurosurgery', 'Cardiothoracic Surgery', 'Vascular Surgery',
  'Palliative Care', 'Dietetics & Nutrition',
]

const DIAGNOSTIC_SERVICES = [
  'Blood Tests & Haematology', 'Biochemistry', 'Microbiology & Culture',
  'Histopathology & Cytology', 'X-Ray', 'Ultrasound / Sonography',
  'CT Scan', 'MRI', 'Echocardiography', 'ECG / EEG',
  'Mammography', 'Bone Density (DEXA)', 'PET Scan',
  'Home Sample Collection', 'Corporate Health Packages',
]

const PHARMACY_SPECIALIZATIONS = [
  'Allopathy', 'Ayurveda', 'Homeopathy', 'Surgical Supplies', 'Baby & Mother Care', 'Cosmetics',
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

// ── Config by type ──────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  clinic:     { label: 'Clinic',            Icon: Building2,    color: '#0F2557', steps: ['Basic Info', 'Departments & Services', 'Doctor & Admin', 'Review & Submit'] },
  hospital:   { label: 'Hospital',          Icon: Building2,    color: '#CC1414', steps: ['Basic Info', 'Departments', 'Facilities', 'Staff Contacts', 'Review & Submit'] },
  pharmacy:   { label: 'Pharmacy',          Icon: Pill,         color: '#138808', steps: ['Basic Info', 'Services', 'Owner / Manager & Submit'] },
  diagnostic: { label: 'Diagnostic Center', Icon: FlaskConical, color: '#7C3AED', steps: ['Basic Info', 'Services', 'Owner / Manager & Submit'] },
}

// ── Reusable helpers ─────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/"><BrandLogo size="md" /></Link>
          <Link to="/clinics" className="text-gray-600 hover:text-gray-900 font-medium text-sm hidden md:block">Find Care</Link>
        </div>
      </div>
    </nav>
  )
}

function StepIndicator({ steps, current, color }) {
  return (
    <div className="flex items-center justify-between mb-10 overflow-x-auto pb-2">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center flex-shrink-0">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
              i < current ? 'bg-green-500 text-white' : i === current ? 'text-white' : 'bg-gray-200 text-gray-500'
            }`} style={i === current ? { background: color } : {}}>
              {i < current ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs mt-1.5 font-medium whitespace-nowrap ${i <= current ? 'text-gray-700' : 'text-gray-400'}`}>
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 w-6 sm:w-10 mx-1 mb-4 transition-colors ${i < current ? 'bg-green-500' : 'bg-gray-200'}`} />
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
  `w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all ${err ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-blue-200'}`

function NavButtons({ onBack, onNext, onSubmit, color, submitting, nextLabel = 'Continue', isLast = false }) {
  return (
    <div className="flex gap-3 mt-8">
      {onBack && (
        <button onClick={onBack} disabled={submitting}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 border-2 rounded-xl font-semibold text-sm"
          style={{ borderColor: color, color }}>
          Back
        </button>
      )}
      <button
        onClick={isLast ? onSubmit : onNext}
        disabled={submitting}
        className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
        style={{ background: color }}>
        {submitting
          ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting...</>
          : isLast ? 'Submit Registration' : <>{nextLabel} <ChevronRight className="w-4 h-4" /></>}
      </button>
    </div>
  )
}

// ── Multi-select checkbox grid ───────────────────────────────────────────────
function CheckboxGrid({ options, selected, onChange, label, required, error, searchable = true }) {
  const [q, setQ] = useState('')
  const filtered = searchable && q ? options.filter(o => o.toLowerCase().includes(q.toLowerCase())) : options
  const toggle = (opt) => {
    const next = selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt]
    onChange(next)
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-600">*</span>}
          {selected.length > 0 && <span className="ml-2 text-xs font-normal text-blue-600">({selected.length} selected)</span>}
        </label>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => onChange(options)} className="text-blue-600 hover:underline">Select All</button>
          <button type="button" onClick={() => onChange([])} className="text-gray-500 hover:underline">Clear</button>
        </div>
      </div>
      {searchable && (
        <input
          type="text" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search..." className={`${inputCls(false)} mb-2`} />
      )}
      <div className="border border-gray-200 rounded-xl p-3 max-h-60 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
        {filtered.map(opt => (
          <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1">
            <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="rounded" />
            {opt}
          </label>
        ))}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

// ── Basic Info step (shared) ─────────────────────────────────────────────────
function BasicInfoStep({ data, onChange, onNext, color, typeLabel, extraFields }) {
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!data.clinic_name?.trim()) e.clinic_name = 'Name is required'
    if (!data.city?.trim()) e.city = 'City is required'
    if (!data.state) e.state = 'State is required'
    if (!data.phone?.trim() || !/^[6-9]\d{9}$/.test(data.phone)) e.phone = 'Valid 10-digit phone required'
    if (!data.email?.trim() || !/\S+@\S+\.\S+/.test(data.email)) e.email = 'Valid email required'
    if (!data.address?.trim()) e.address = 'Address is required'
    if (extraFields) {
      const extraErrors = extraFields.validate(data)
      Object.assign(e, extraErrors)
    }
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
      <h2 className="text-xl font-bold mb-1" style={{ color }}>{typeLabel} Details</h2>
      <p className="text-gray-500 text-sm mb-6">Tell us about your {typeLabel.toLowerCase()}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={`${typeLabel} Name`} required error={errors.clinic_name}>
          <input type="text" {...inp('clinic_name')} placeholder={`e.g. City ${typeLabel}`} />
        </Field>
        {extraFields?.typeField && extraFields.typeField(inp, errors, onChange)}
        <Field label="City" required error={errors.city}>
          <input type="text" {...inp('city')} placeholder="e.g. Mumbai" />
        </Field>
        <Field label="State" required error={errors.state}>
          <select {...inp('state')}>
            <option value="">Select state</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Phone" required error={errors.phone}>
          <input type="tel" {...inp('phone')} maxLength={10} placeholder="10-digit number" />
        </Field>
        <Field label="Email" required error={errors.email}>
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
        <Field label="Website (optional)">
          <input type="url" {...inp('website')} placeholder="https://..." />
        </Field>
        {extraFields?.extraInputs && extraFields.extraInputs(inp, errors, onChange, data)}
      </div>
      <NavButtons onNext={() => { if (validate()) onNext() }} color={color} />
    </div>
  )
}

// ── Doctor / Admin contact block ─────────────────────────────────────────────
function DoctorAdminBlock({ data, onChange, errors, showAdmin = true }) {
  const inp = (k) => ({
    value: data[k] || '',
    onChange: e => onChange(k, e.target.value),
    className: inputCls(errors[k]),
  })
  return (
    <>
      <h3 className="font-semibold text-gray-700 mb-3 mt-5">Primary Doctor</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Doctor's Full Name" required error={errors.doctor_name}>
          <input type="text" {...inp('doctor_name')} placeholder="Dr. Firstname Lastname" />
        </Field>
        <Field label="Doctor's Email" required error={errors.doctor_email}>
          <input type="email" {...inp('doctor_email')} placeholder="doctor@example.com" />
        </Field>
        <Field label="Doctor's Phone" required error={errors.doctor_phone}>
          <input type="tel" {...inp('doctor_phone')} maxLength={10} placeholder="10-digit number" />
        </Field>
        <Field label="Specialty" required error={errors.doctor_specialty}>
          <input type="text" list="reg-specialty-list" {...inp('doctor_specialty')} placeholder="e.g. Cardiology, Oncology..." />
          <datalist id="reg-specialty-list">
            {DEPARTMENTS.map(s => <option key={s} value={s} />)}
          </datalist>
        </Field>
        <Field label="Qualification" required error={errors.qualification}>
          <input type="text" {...inp('qualification')} placeholder="e.g. MBBS, MD" />
        </Field>
        <Field label="MCI Registration Number" required error={errors.mci_number}>
          <input type="text" {...inp('mci_number')} placeholder="e.g. MH/12345/2010" />
        </Field>
      </div>

      {showAdmin && (
        <>
          <h3 className="font-semibold text-gray-700 mb-3 mt-6">Admin / Manager Contact</h3>
          <p className="text-xs text-gray-400 mb-3">Can be same as the doctor above.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Admin Name" error={errors.admin_name}>
              <input type="text" {...inp('admin_name')} placeholder="Full name" />
            </Field>
            <Field label="Admin Phone" error={errors.admin_phone}>
              <input type="tel" {...inp('admin_phone')} maxLength={10} placeholder="10-digit number" />
            </Field>
            <Field label="Admin Email" error={errors.admin_email}>
              <input type="email" {...inp('admin_email')} placeholder="admin@example.com" />
            </Field>
            <Field label="Designation" error={errors.admin_designation}>
              <input type="text" {...inp('admin_designation')} placeholder="e.g. Practice Manager" />
            </Field>
          </div>
        </>
      )}

      <h3 className="font-semibold text-gray-700 mb-2 mt-6">Set Login Password</h3>
      <p className="text-xs text-gray-400 mb-3">Your email will be your username. Set a password to activate your account after approval.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Password" required error={errors.admin_password}>
          <input type="password" {...inp('admin_password')} placeholder="Min. 8 characters" autoComplete="new-password" />
        </Field>
        <Field label="Confirm Password" required error={errors.confirm_password}>
          <input type="password" {...inp('confirm_password')} placeholder="Re-enter password" autoComplete="new-password" />
        </Field>
      </div>
    </>
  )
}

// ── Owner/Manager block ──────────────────────────────────────────────────────
function OwnerManagerBlock({ data, onChange, errors }) {
  const inp = (k) => ({
    value: data[k] || '',
    onChange: e => onChange(k, e.target.value),
    className: inputCls(errors[k]),
  })
  return (
    <>
      <h3 className="font-semibold text-gray-700 mb-3">Owner / Manager</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Full Name" required error={errors.owner_name}>
          <input type="text" {...inp('owner_name')} placeholder="Full name" />
        </Field>
        <Field label="Phone" required error={errors.owner_phone}>
          <input type="tel" {...inp('owner_phone')} maxLength={10} placeholder="10-digit number" />
        </Field>
        <Field label="Email" required error={errors.owner_email}>
          <input type="email" {...inp('owner_email')} placeholder="owner@example.com" />
        </Field>
        <Field label="Designation" error={errors.owner_designation}>
          <input type="text" {...inp('owner_designation')} placeholder="e.g. Owner, Director" />
        </Field>
      </div>
      <h3 className="font-semibold text-gray-700 mb-2 mt-6">Set Login Password</h3>
      <p className="text-xs text-gray-400 mb-3">Your email will be your username. Set a password to activate your account after approval.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Password" required error={errors.admin_password}>
          <input type="password" {...inp('admin_password')} placeholder="Min. 8 characters" autoComplete="new-password" />
        </Field>
        <Field label="Confirm Password" required error={errors.confirm_password}>
          <input type="password" {...inp('confirm_password')} placeholder="Re-enter password" autoComplete="new-password" />
        </Field>
      </div>
    </>
  )
}

// ── Review step ───────────────────────────────────────────────────────────────
function ReviewStep({ data, type, onBack, onSubmit, submitting, error, color }) {
  const doctorEmail = data.doctor_email || data.owner_email || ''
  const doctorPhone = data.doctor_phone || data.owner_phone || ''

  const rows = [
    { label: 'Organization Name', value: data.clinic_name },
    { label: 'Type', value: data.org_subtype },
    { label: 'City', value: data.city },
    { label: 'State', value: data.state },
    { label: 'Phone', value: data.phone },
    { label: 'Email', value: data.email },
    { label: 'Departments', value: data.departments?.join(', ') },
    { label: 'Services', value: data.services?.join(', ') },
    { label: 'Total Beds', value: data.total_beds },
    { label: 'ICU Beds', value: data.icu_beds },
    { label: 'OT Count', value: data.ot_count },
    { label: 'Drug License', value: data.drug_license_number },
    { label: 'NABL Accredited', value: data.nabl_accredited ? 'Yes' : undefined },
    { label: 'NABL Number', value: data.nabl_number },
    { label: 'Doctor / Contact', value: data.doctor_name || data.owner_name },
    { label: 'Contact Email', value: doctorEmail },
    { label: 'Contact Phone', value: doctorPhone },
  ].filter(r => r.value)

  return (
    <div>
      <h2 className="text-xl font-bold mb-1" style={{ color }}>Review Your Details</h2>
      <p className="text-gray-500 text-sm mb-6">Please verify all details before submitting.</p>
      <div className="border border-gray-200 rounded-xl overflow-hidden mb-5">
        {rows.map((row, i) => (
          <div key={row.label} className={`flex justify-between items-start px-4 py-3 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
            <span className="text-gray-500 font-medium flex-shrink-0 mr-4">{row.label}</span>
            <span className="font-semibold text-right" style={{ color }}>{row.value}</span>
          </div>
        ))}
      </div>
      {doctorEmail && (
        <div className="mb-5 rounded-xl p-4 text-sm" style={{ background: color + '0D', border: `1px solid ${color}30` }}>
          <p className="font-semibold mb-2" style={{ color }}>After approval, credentials will be sent to:</p>
          <div className="flex items-center gap-2 text-gray-600 mb-1"><Mail size={14} /> {doctorEmail}</div>
          {doctorPhone && <div className="flex items-center gap-2 text-gray-600"><Phone size={14} /> {doctorPhone}</div>}
          <p className="text-gray-400 text-xs mt-2">Your username and a one-time password will be sent to both. You will be asked to set a permanent password on first login.</p>
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-5">{error}</div>}
      <p className="text-xs text-gray-400 mb-6 leading-relaxed">
        By submitting, you agree to BHarath Health Systems' Terms of Service and Privacy Policy. Registration will be reviewed within 24 hours.
      </p>
      <NavButtons onBack={onBack} onSubmit={onSubmit} color={color} isLast submitting={submitting} />
    </div>
  )
}

// ── Success Screen ────────────────────────────────────────────────────────────
function SuccessScreen({ typeLabel, color }) {
  return (
    <div className="text-center py-8">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-12 h-12 text-green-500" />
      </div>
      <h2 className="text-2xl font-bold mb-3" style={{ color }}>Registration Submitted!</h2>
      <p className="text-gray-500 mb-2 max-w-sm mx-auto">
        Thank you for registering your {typeLabel} with BHarath Health Systems. Your application is <strong className="text-yellow-600">pending approval</strong>.
      </p>
      <p className="text-gray-400 text-sm mb-8 max-w-sm mx-auto">
        Our team reviews registrations within 24 hours. Once approved, your login credentials will be sent directly to your registered email and phone.
      </p>
      <div className="rounded-2xl p-6 max-w-sm mx-auto mb-8 text-sm text-left space-y-4"
        style={{ background: color + '0A', border: `1px solid ${color}20` }}>
        <h3 className="font-semibold" style={{ color }}>What happens next?</h3>
        {[
          `Our team verifies your ${typeLabel.toLowerCase()} details`,
          'You receive a username + one-time password via email and SMS',
          'Log in and set your permanent password to get started',
        ].map((s, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-5 h-5 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
              style={{ background: color }}>{i + 1}</div>
            <p className="text-gray-600">{s}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/" className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 rounded-xl font-semibold text-sm"
          style={{ borderColor: color, color }}>Go to Homepage</Link>
        <Link to="/clinics" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white"
          style={{ background: '#CC1414' }}>Browse Clinics</Link>
      </div>
    </div>
  )
}

// ══ CLINIC FLOW ══════════════════════════════════════════════════════════════
function ClinicFlow({ data, onChange, step, setStep, color, onSubmit, submitting, submitError }) {
  const [errors, setErrors] = useState({})

  const validateStep2 = () => {
    const e = {}
    if (!data.departments?.length && data.org_subtype === 'Multispecialty') e.departments = 'Select at least one department'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep3 = () => {
    const e = {}
    if (!data.doctor_name?.trim()) e.doctor_name = 'Required'
    if (!data.doctor_email?.trim() || !/\S+@\S+\.\S+/.test(data.doctor_email)) e.doctor_email = 'Valid email required'
    if (!data.doctor_phone?.trim() || !/^[6-9]\d{9}$/.test(data.doctor_phone)) e.doctor_phone = 'Valid 10-digit phone required'
    if (!data.doctor_specialty?.trim()) e.doctor_specialty = 'Required'
    if (!data.qualification?.trim()) e.qualification = 'Required'
    if (!data.mci_number?.trim()) e.mci_number = 'Required'
    if (!data.admin_password?.trim() || data.admin_password.length < 8) e.admin_password = 'Min. 8 characters required'
    if (data.admin_password !== data.confirm_password) e.confirm_password = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  if (step === 0) return (
    <BasicInfoStep data={data} onChange={onChange} onNext={() => setStep(1)} color={color} typeLabel="Clinic"
      extraFields={{
        typeField: (inp, errors, onChange) => (
          <Field label="Clinic Type" required error={errors.org_subtype}>
            <select value={data.org_subtype || ''} onChange={e => onChange('org_subtype', e.target.value)} className={inputCls(errors.org_subtype)}>
              <option value="">Select type</option>
              <option>Single Specialty</option>
              <option>Multispecialty</option>
              <option>Dental</option>
              <option>Eye Care</option>
              <option>Mental Health</option>
              <option>Mother & Child</option>
              <option>Other</option>
            </select>
          </Field>
        ),
        validate: (d) => {
          const e = {}
          if (!d.org_subtype) e.org_subtype = 'Clinic type is required'
          return e
        },
      }}
    />
  )

  if (step === 1) return (
    <div>
      <h2 className="text-xl font-bold mb-1" style={{ color }}>Departments &amp; Services</h2>
      <p className="text-gray-500 text-sm mb-6">Tell us what specialties you offer</p>
      {data.org_subtype === 'Multispecialty' ? (
        <CheckboxGrid
          options={DEPARTMENTS} selected={data.departments || []}
          onChange={v => onChange('departments', v)}
          label="Departments offered" required error={errors.departments} />
      ) : (
        <Field label="Primary Specialty" required error={errors.departments}>
          <select
            value={(data.departments || [])[0] || ''}
            onChange={e => onChange('departments', [e.target.value])}
            className={inputCls(errors.departments)}>
            <option value="">Select specialty</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
      )}
      <h3 className="font-semibold text-gray-700 mt-6 mb-3">Integrated Modules</h3>
      <p className="text-xs text-gray-400 mb-3">Select what's available at your clinic — this enables the respective staff portals.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          ['has_pharmacy', '💊 In-house Pharmacy', 'Enables Pharmacy portal'],
          ['has_lab', '🔬 In-house Laboratory', 'Enables Lab portal'],
          ['has_imaging', '🩻 Imaging / X-Ray', 'Enables Imaging portal'],
          ['has_inpatient', '🛏️ Inpatient / Observation Beds', 'Enables CareChart ward portal'],
          ['has_telehealth', '📹 Telehealth / Video Consult', 'Enables telehealth module'],
        ].map(([k, label, hint]) => (
          <label key={k} className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50">
            <input type="checkbox" className="mt-0.5" checked={!!data[k]} onChange={e => onChange(k, e.target.checked)} />
            <div><div className="font-medium">{label}</div><div className="text-xs text-gray-400">{hint}</div></div>
          </label>
        ))}
      </div>
      <NavButtons onBack={() => setStep(0)} onNext={() => { if (validateStep2()) setStep(2) }} color={color} />
    </div>
  )

  if (step === 2) return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color }}>Doctor &amp; Admin Details</h2>
      <div className="mb-4 rounded-xl p-3 text-xs flex gap-3 items-start" style={{ background: color + '0D', border: `1px solid ${color}30` }}>
        <span className="text-lg mt-0.5">🔐</span>
        <p style={{ color }}>Set your login password below. Your email will be your username — credentials activate once your registration is approved.</p>
      </div>
      <DoctorAdminBlock data={data} onChange={onChange} errors={errors} showAdmin />
      <NavButtons onBack={() => setStep(1)} onNext={() => { if (validateStep3()) setStep(3) }} color={color} />
    </div>
  )

  if (step === 3) return (
    <ReviewStep data={data} type="clinic" onBack={() => setStep(2)} onSubmit={onSubmit}
      submitting={submitting} error={submitError} color={color} />
  )
}

// ══ HOSPITAL FLOW ══════════════════════════════════════════════════════════════
function HospitalFlow({ data, onChange, step, setStep, color, onSubmit, submitting, submitError }) {
  const [errors, setErrors] = useState({})

  const validateDepts = () => {
    const e = {}
    if (!data.departments?.length) e.departments = 'Select at least one department'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateContacts = () => {
    const e = {}
    if (!data.doctor_name?.trim()) e.doctor_name = 'Required'
    if (!data.doctor_email?.trim() || !/\S+@\S+\.\S+/.test(data.doctor_email)) e.doctor_email = 'Valid email required'
    if (!data.doctor_phone?.trim() || !/^[6-9]\d{9}$/.test(data.doctor_phone)) e.doctor_phone = 'Valid 10-digit phone required'
    if (!data.doctor_specialty?.trim()) e.doctor_specialty = 'Required'
    if (!data.qualification?.trim()) e.qualification = 'Required'
    if (!data.mci_number?.trim()) e.mci_number = 'Required'
    if (!data.admin_password?.trim() || data.admin_password.length < 8) e.admin_password = 'Min. 8 characters required'
    if (data.admin_password !== data.confirm_password) e.confirm_password = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  if (step === 0) return (
    <BasicInfoStep data={data} onChange={onChange} onNext={() => setStep(1)} color={color} typeLabel="Hospital"
      extraFields={{
        typeField: (inp, errors, onChange) => (
          <Field label="Registration Number" required error={errors.reg_number}>
            <input type="text" value={data.reg_number || ''} onChange={e => onChange('reg_number', e.target.value)}
              className={inputCls(errors.reg_number)} placeholder="Hospital registration number" />
          </Field>
        ),
        validate: (d) => {
          const e = {}
          if (!d.reg_number?.trim()) e.reg_number = 'Registration number is required'
          return e
        },
      }}
    />
  )

  if (step === 1) return (
    <div>
      <h2 className="text-xl font-bold mb-1" style={{ color }}>Departments</h2>
      <p className="text-gray-500 text-sm mb-6">Select all departments in your hospital</p>
      <CheckboxGrid
        options={DEPARTMENTS} selected={data.departments || []}
        onChange={v => onChange('departments', v)}
        label="Departments" required error={errors.departments} />
      <NavButtons onBack={() => setStep(0)} onNext={() => { if (validateDepts()) setStep(2) }} color={color} />
    </div>
  )

  if (step === 2) return (
    <div>
      <h2 className="text-xl font-bold mb-1" style={{ color }}>Facilities</h2>
      <p className="text-gray-500 text-sm mb-6">Tell us about your hospital's capacity</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {[['total_beds', 'Total Beds', 'e.g. 100'], ['icu_beds', 'ICU Beds', 'e.g. 10'], ['ot_count', 'Number of OTs', 'e.g. 4']].map(([k, label, ph]) => (
          <Field key={k} label={label}>
            <input type="number" min="0" value={data[k] || ''} onChange={e => onChange(k, e.target.value)}
              className={inputCls(false)} placeholder={ph} />
          </Field>
        ))}
      </div>
      <h3 className="font-semibold text-gray-700 mb-3">Available Services</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          ['has_emergency', '🚨 Emergency / Casualty'],
          ['has_pharmacy', '💊 In-house Pharmacy'],
          ['has_lab', '🔬 Laboratory / Pathology'],
          ['has_imaging', '🩻 Radiology / Imaging'],
          ['has_blood_bank', '🩸 Blood Bank'],
          ['has_ambulance', '🚑 Ambulance Services'],
          ['has_inpatient', '🛏️ Inpatient Wards (CareChart)'],
          ['has_telehealth', '📹 Telehealth / Video Consult'],
        ].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50">
            <input type="checkbox" checked={!!data[k]} onChange={e => onChange(k, e.target.checked)} />
            {label}
          </label>
        ))}
      </div>
      <h3 className="font-semibold text-gray-700 mt-5 mb-3">Accreditation <span className="text-xs font-normal text-gray-400">(select all that apply)</span></h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
        {['NABH', 'JCI', 'ISO 9001:2015', 'NABL', 'CAP', 'Not yet accredited'].map(acc => {
          const selected = Array.isArray(data.accreditation) ? data.accreditation : []
          return (
            <label key={acc} className={`flex items-center gap-2 text-sm text-gray-700 cursor-pointer border rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors ${selected.includes(acc) ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
              <input
                type="checkbox"
                checked={selected.includes(acc)}
                onChange={() => {
                  const next = selected.includes(acc) ? selected.filter(x => x !== acc) : [...selected, acc]
                  onChange('accreditation', next)
                }}
              />
              {acc}
            </label>
          )
        })}
      </div>
      <NavButtons onBack={() => setStep(1)} onNext={() => setStep(3)} color={color} />
    </div>
  )

  if (step === 3) return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color }}>Staff Contacts</h2>
      <div className="mb-4 rounded-xl p-3 text-xs flex gap-3 items-start" style={{ background: color + '0D', border: `1px solid ${color}30` }}>
        <span className="text-lg mt-0.5">🔐</span>
        <p style={{ color }}>Set your login password below. Your email will be your username — credentials activate once approved.</p>
      </div>
      <DoctorAdminBlock data={data} onChange={onChange} errors={errors} showAdmin />
      <NavButtons onBack={() => setStep(2)} onNext={() => { if (validateContacts()) setStep(4) }} color={color} />
    </div>
  )

  if (step === 4) return (
    <ReviewStep data={data} type="hospital" onBack={() => setStep(3)} onSubmit={onSubmit}
      submitting={submitting} error={submitError} color={color} />
  )
}

// ══ PHARMACY FLOW ══════════════════════════════════════════════════════════════
function PharmacyFlow({ data, onChange, step, setStep, color, onSubmit, submitting, submitError }) {
  const [errors, setErrors] = useState({})

  const validateStep2 = () => {
    const e = {}
    setErrors(e)
    return true
  }

  const validateStep2Owner = () => {
    const e = {}
    if (!data.owner_name?.trim()) e.owner_name = 'Required'
    if (!data.owner_phone?.trim() || !/^[6-9]\d{9}$/.test(data.owner_phone)) e.owner_phone = 'Valid 10-digit phone required'
    if (!data.owner_email?.trim() || !/\S+@\S+\.\S+/.test(data.owner_email)) e.owner_email = 'Valid email required'
    if (!data.admin_password?.trim() || data.admin_password.length < 8) e.admin_password = 'Min. 8 characters required'
    if (data.admin_password !== data.confirm_password) e.confirm_password = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  if (step === 0) return (
    <BasicInfoStep data={data} onChange={onChange} onNext={() => setStep(1)} color={color} typeLabel="Pharmacy"
      extraFields={{
        typeField: (inp, errors, onChange) => (
          <Field label="Pharmacy Type" required error={errors.org_subtype}>
            <select value={data.org_subtype || ''} onChange={e => onChange('org_subtype', e.target.value)} className={inputCls(errors.org_subtype)}>
              <option value="">Select type</option>
              <option value="retail">Retail Pharmacy</option>
              <option value="hospital_dispensary">Hospital Dispensary</option>
              <option value="chain_branch">Chain Branch</option>
            </select>
          </Field>
        ),
        validate: (d) => {
          const e = {}
          if (!d.org_subtype) e.org_subtype = 'Pharmacy type is required'
          if (!d.drug_license_number?.trim()) e.drug_license_number = 'Drug license number is required'
          return e
        },
        extraInputs: (inp, errors, onChange, d) => (
          <Field label="Drug License Number" required error={errors.drug_license_number}>
            <input type="text" value={d.drug_license_number || ''} onChange={e => onChange('drug_license_number', e.target.value)}
              className={inputCls(errors.drug_license_number)} placeholder="e.g. DL/MH/12345" />
          </Field>
        ),
      }}
    />
  )

  if (step === 1) return (
    <div>
      <h2 className="text-xl font-bold mb-1" style={{ color }}>Services</h2>
      <p className="text-gray-500 text-sm mb-6">Tell us what your pharmacy offers</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {[
          ['has_prescription_upload', 'Prescription Upload & Pickup'],
          ['has_home_delivery', 'Home Delivery'],
          ['has_online_ordering', 'Online Ordering'],
          ['accepts_insurance', 'Accepts Insurance / TPA'],
        ].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50">
            <input type="checkbox" checked={!!data[k]} onChange={e => onChange(k, e.target.checked)} />
            {label}
          </label>
        ))}
      </div>
      <Field label="Operating Hours">
        <input type="text" value={data.operating_hours || ''} onChange={e => onChange('operating_hours', e.target.value)}
          className={inputCls(false)} placeholder="e.g. Mon–Sat 9AM–9PM" />
      </Field>
      <div className="mt-4">
        <CheckboxGrid
          options={PHARMACY_SPECIALIZATIONS} selected={data.services || []}
          onChange={v => onChange('services', v)}
          label="Specializes In" searchable={false} />
      </div>
      <NavButtons onBack={() => setStep(0)} onNext={() => { if (validateStep2()) setStep(2) }} color={color} />
    </div>
  )

  if (step === 2) return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color }}>Owner / Manager &amp; Review</h2>
      <div className="mb-4 rounded-xl p-3 text-xs flex gap-3 items-start" style={{ background: color + '0D', border: `1px solid ${color}30` }}>
        <span className="text-lg mt-0.5">🔐</span>
        <p style={{ color }}>Set your login password below. Your email will be your username — credentials activate once approved.</p>
      </div>
      <OwnerManagerBlock data={data} onChange={onChange} errors={errors} />
      <NavButtons onBack={() => setStep(1)} onSubmit={() => { if (validateStep2Owner()) onSubmit() }}
        color={color} isLast submitting={submitting} />
      {submitError && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mt-4">{submitError}</div>}
    </div>
  )
}

// ══ DIAGNOSTIC FLOW ══════════════════════════════════════════════════════════
function DiagnosticFlow({ data, onChange, step, setStep, color, onSubmit, submitting, submitError }) {
  const [errors, setErrors] = useState({})

  const validateStep1 = () => {
    const e = {}
    if (!data.services?.length) e.services = 'Select at least one service'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateOwner = () => {
    const e = {}
    if (!data.owner_name?.trim()) e.owner_name = 'Required'
    if (!data.owner_phone?.trim() || !/^[6-9]\d{9}$/.test(data.owner_phone)) e.owner_phone = 'Valid 10-digit phone required'
    if (!data.owner_email?.trim() || !/\S+@\S+\.\S+/.test(data.owner_email)) e.owner_email = 'Valid email required'
    if (!data.admin_password?.trim() || data.admin_password.length < 8) e.admin_password = 'Min. 8 characters required'
    if (data.admin_password !== data.confirm_password) e.confirm_password = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  if (step === 0) return (
    <BasicInfoStep data={data} onChange={onChange} onNext={() => setStep(1)} color={color} typeLabel="Diagnostic Center"
      extraFields={{
        typeField: (inp, errors, onChange) => (
          <Field label="Center Type" required error={errors.org_subtype}>
            <select value={data.org_subtype || ''} onChange={e => onChange('org_subtype', e.target.value)} className={inputCls(errors.org_subtype)}>
              <option value="">Select type</option>
              <option value="standalone_lab">Standalone Lab</option>
              <option value="imaging_center">Imaging Center</option>
              <option value="full_diagnostic">Full Diagnostic Center</option>
              <option value="hospital_attached">Hospital Attached</option>
            </select>
          </Field>
        ),
        validate: (d) => {
          const e = {}
          if (!d.org_subtype) e.org_subtype = 'Center type is required'
          return e
        },
        extraInputs: (inp, errors, onChange, d) => (
          <>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={!!d.nabl_accredited} onChange={e => onChange('nabl_accredited', e.target.checked)} />
                NABL Accredited
              </label>
            </div>
            {d.nabl_accredited && (
              <Field label="NABL Accreditation Number" error={errors.nabl_number}>
                <input type="text" value={d.nabl_number || ''} onChange={e => onChange('nabl_number', e.target.value)}
                  className={inputCls(errors.nabl_number)} placeholder="e.g. MC-2345" />
              </Field>
            )}
          </>
        ),
      }}
    />
  )

  if (step === 1) return (
    <div>
      <h2 className="text-xl font-bold mb-1" style={{ color }}>Services Offered</h2>
      <p className="text-gray-500 text-sm mb-6">Select all tests and services available at your center</p>
      <CheckboxGrid
        options={DIAGNOSTIC_SERVICES} selected={data.services || []}
        onChange={v => onChange('services', v)}
        label="Services" required error={errors.services} searchable={false} />
      <NavButtons onBack={() => setStep(0)} onNext={() => { if (validateStep1()) setStep(2) }} color={color} />
    </div>
  )

  if (step === 2) return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color }}>Owner / Manager &amp; Review</h2>
      <div className="mb-4 rounded-xl p-3 text-xs flex gap-3 items-start" style={{ background: color + '0D', border: `1px solid ${color}30` }}>
        <span className="text-lg mt-0.5">🔐</span>
        <p style={{ color }}>Set your login password below. Your email will be your username — credentials activate once approved.</p>
      </div>
      <OwnerManagerBlock data={data} onChange={onChange} errors={errors} />
      <NavButtons onBack={() => setStep(1)} onSubmit={() => { if (validateOwner()) onSubmit() }}
        color={color} isLast submitting={submitting} />
      {submitError && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mt-4">{submitError}</div>}
    </div>
  )
}

// ══ MAIN COMPONENT ════════════════════════════════════════════════════════════
export default function RegisterForm() {
  const { type } = useParams()
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.clinic
  const { label: typeLabel, Icon, color, steps } = cfg

  const [step, setStep]               = useState(0)
  const [submitted, setSubmitted]     = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [formData, setFormData]       = useState({ entity_type: type })

  const updateField = (key, value) => setFormData(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const contactEmail = formData.doctor_email || formData.owner_email || formData.email
      await publicApi.registerClinic({
        clinic: {
          name:               formData.clinic_name,
          specialty:          (formData.departments || [])[0] || formData.org_subtype || typeLabel,
          city:               formData.city,
          state:              formData.state,
          phone:              formData.phone,
          email:              formData.email,
          address:            formData.address,
          pincode:            formData.pincode,
          website:            formData.website,
          org_type:           type,
          drug_license_number: formData.drug_license_number,
          nabl_accredited:    formData.nabl_accredited,
          nabl_number:        formData.nabl_number,
          total_beds:         formData.total_beds ? Number(formData.total_beds) : undefined,
          icu_beds:           formData.icu_beds ? Number(formData.icu_beds) : undefined,
          ot_count:           formData.ot_count ? Number(formData.ot_count) : undefined,
          has_pharmacy:       formData.has_pharmacy,
          has_lab:            formData.has_lab,
          has_imaging:        formData.has_imaging,
          has_inpatient:      formData.has_inpatient,
          has_emergency:      formData.has_emergency,
          has_blood_bank:     formData.has_blood_bank,
          has_ambulance:      formData.has_ambulance,
          has_telehealth:     formData.has_telehealth,
          accreditation:      Array.isArray(formData.accreditation) ? formData.accreditation.join(', ') : (formData.accreditation || ''),
          reg_number:         formData.reg_number,
          operating_hours:    formData.operating_hours,
          departments:        formData.departments?.join(', '),
          services:           formData.services?.join(', '),
        },
        doctor: {
          full_name:           formData.doctor_name || formData.owner_name || 'Admin',
          email:               contactEmail,
          mobile:              formData.doctor_phone || formData.owner_phone,
          qualification:       formData.qualification,
          registration_number: formData.mci_number,
          specialty:           formData.doctor_specialty || (formData.departments || [])[0],
        },
        admin_email: contactEmail,
        admin_password: formData.admin_password,
      })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message || 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const flowProps = { data: formData, onChange: updateField, step, setStep, color, onSubmit: handleSubmit, submitting, submitError }

  return (
    <div className="min-h-screen" style={{ background: '#F0F4F8' }}>
      <Navbar />
      {!submitted && (
        <div className="text-white py-10 px-4" style={{ background: color }}>
          <div className="max-w-3xl mx-auto">
            <Link to="/register" className="inline-flex items-center gap-1 text-white/70 hover:text-white text-sm mb-3">
              <ArrowLeft className="w-4 h-4" /> Back to Registration Options
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold">Register Your {typeLabel}</h1>
                <p className="text-white/70 text-sm mt-0.5">Join India's fastest-growing digital health platform. Free to register.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 py-10">
        {submitted ? (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
            <SuccessScreen typeLabel={typeLabel} color={color} />
          </div>
        ) : (
          <>
            <StepIndicator steps={steps} current={step} color={color} />
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 md:p-8">
              {type === 'clinic'     && <ClinicFlow {...flowProps} />}
              {type === 'hospital'   && <HospitalFlow {...flowProps} />}
              {type === 'pharmacy'   && <PharmacyFlow {...flowProps} />}
              {type === 'diagnostic' && <DiagnosticFlow {...flowProps} />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
