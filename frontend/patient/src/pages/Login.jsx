import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api/client'
import {
  Phone, Mail, Hash, AlertCircle, Heart, Shield, FileText,
  ArrowLeft, User, ChevronRight, Plus, CheckCircle, Smartphone
} from 'lucide-react'
import BrandLogo from '../components/BrandLogo'

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli', 'Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]

// ── Hero left panel ────────────────────────────────────────────────────────
function HeroPanel() {
  const features = [
    { icon: Heart,    text: 'Complete health history in one place' },
    { icon: FileText, text: 'View & download prescriptions digitally' },
    { icon: Shield,   text: 'Your permanent BH ID — one identity, every clinic' },
  ]
  return (
    <div
      className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 text-white relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0F2557 0%, #1a3a7a 100%)' }}
    >
      <div style={{ position:'absolute', top:'-80px', right:'-80px', width:'320px', height:'320px', borderRadius:'50%', background:'rgba(204,20,20,0.08)' }} />
      <div style={{ position:'absolute', bottom:'-60px', left:'-60px', width:'260px', height:'260px', borderRadius:'50%', background:'rgba(245,130,30,0.08)' }} />
      <div className="relative">
        <BrandLogo size="md" light />
        <div className="text-xs font-semibold mt-2 tracking-wider uppercase" style={{ color: '#F5821E' }}>
          My Health Portal
        </div>
      </div>
      <div className="relative">
        <h2 className="text-4xl font-extrabold leading-tight mb-4" style={{ letterSpacing: '-0.02em' }}>
          Your health records,<br />
          <span style={{ color: '#F5821E' }}>always with you.</span>
        </h2>
        <p className="text-blue-200 text-lg leading-relaxed mb-8">
          Access appointments, prescriptions, lab results, and bills — from any device, any time.
        </p>
        <div className="space-y-4">
          {features.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(245,130,30,0.2)' }}>
                <Icon size={16} style={{ color: '#F5821E' }} />
              </div>
              <span className="text-blue-100 text-sm">{text}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <p className="text-blue-100 text-sm font-medium">New to BHarath Health?</p>
          <p className="text-blue-200 text-xs mt-1">Enter your mobile number → verify OTP → create your free health profile and get a permanent BH ID in under a minute.</p>
        </div>
      </div>
      <div className="relative text-xs" style={{ color: '#93c5fd' }}>
        BHarath Health · India's Digital Health Network
      </div>
    </div>
  )
}

// ── Login method tabs ──────────────────────────────────────────────────────
const LOGIN_METHODS = [
  { key: 'mobile',  label: 'Mobile',  icon: Smartphone },
  { key: 'email',   label: 'Email',   icon: Mail },
  { key: 'bh_id',  label: 'BH ID',   icon: Hash },
]

// ── Step 1: Identifier input (mobile / email / BH ID) ────────────────────
function StepIdentifier({ onNext }) {
  const [method, setMethod] = useState('mobile')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (method === 'mobile') {
        const m = value.replace(/\D/g, '')
        if (m.length !== 10) { setError('Please enter a valid 10-digit mobile number.'); setLoading(false); return }
        const res = await api.post('/auth/patient/send-otp', { mobile: m })
        onNext({ mobile: m, maskedMobile: `+91 ${m}`, devOtp: res.dev_otp })
      } else {
        const res = await api.post('/auth/patient/lookup', { identifier: value.trim(), type: method })
        onNext({ mobile: res.mobile, maskedMobile: res.masked_mobile, devOtp: res.dev_otp })
      }
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const placeholder = method === 'mobile' ? '10-digit mobile number'
    : method === 'email' ? 'Registered email address'
    : 'Your BH ID (e.g. BH9000001234)'

  return (
    <>
      <h2 className="text-2xl font-extrabold mb-1" style={{ color: '#0F2557' }}>Sign In / Register</h2>
      <p className="text-gray-500 text-sm mb-5">OTP will be sent to your registered mobile number</p>

      {/* Method tabs */}
      <div className="flex rounded-xl border border-gray-200 p-1 mb-5 gap-1">
        {LOGIN_METHODS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setMethod(key); setValue(''); setError('') }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={method === key
              ? { background: '#0F2557', color: '#fff' }
              : { color: '#6B7280' }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {method === 'mobile' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile Number</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">+91</span>
              <input
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                placeholder={placeholder}
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={value}
                onChange={e => setValue(e.target.value.replace(/\D/g, ''))}
                required autoFocus
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">New user? Just enter your mobile — you'll create a profile after verification.</p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {method === 'email' ? 'Email Address' : 'BH ID'}
            </label>
            <input
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
              placeholder={placeholder}
              type={method === 'email' ? 'email' : 'text'}
              value={value}
              onChange={e => setValue(e.target.value)}
              required autoFocus
            />
            <p className="text-xs text-gray-400 mt-1.5">
              {method === 'email'
                ? 'OTP will be sent to the mobile number linked to this email.'
                : 'OTP will be sent to the mobile number linked to this BH ID.'}
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
          style={{ background: '#CC1414' }}
        >
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending OTP…</>
            : <><Phone size={16} />Send OTP</>}
        </button>
      </form>
    </>
  )
}

// ── Step 2: OTP verification ───────────────────────────────────────────────
function StepOTP({ mobile, maskedMobile, devOtp, onNext, onBack }) {
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resending, setResending] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (otp.length !== 6) { setError('Please enter the 6-digit OTP.'); return }
    setLoading(true)
    try {
      const res = await api.post('/auth/patient/verify-otp', { mobile, otp })
      const data = res.data || res
      onNext({ verifiedToken: data.verified_token, profiles: data.profiles || [], canAddProfile: data.can_add_profile })
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError('')
    try {
      await api.post('/auth/patient/send-otp', { mobile })
    } catch (err) {
      setError(err.message || 'Failed to resend.')
    } finally {
      setResending(false)
    }
  }

  return (
    <>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back
      </button>
      <h2 className="text-2xl font-extrabold mb-1" style={{ color: '#0F2557' }}>Enter OTP</h2>
      <p className="text-gray-500 text-sm mb-1">OTP sent to <strong>{maskedMobile}</strong></p>
      {devOtp && (
        <div className="text-xs mb-4 px-3 py-1.5 rounded-lg" style={{ background: '#F5821E20', color: '#F5821E' }}>
          Dev mode — OTP: <strong>{devOtp}</strong>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">6-Digit OTP</label>
          <input
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-xl tracking-[0.3em] font-bold text-center focus:outline-none focus:ring-2 transition-all"
            placeholder="------"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            required autoFocus
          />
        </div>
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
          style={{ background: '#CC1414' }}
        >
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying…</>
            : 'Verify OTP'}
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
        >
          {resending ? 'Resending…' : 'Resend OTP'}
        </button>
      </form>
    </>
  )
}

// ── Step 3: Profile selection ──────────────────────────────────────────────
function StepSelectProfile({ verifiedToken, profiles, canAddProfile, onSelect, onCreateNew }) {
  return (
    <>
      <h2 className="text-2xl font-extrabold mb-1" style={{ color: '#0F2557' }}>Who's accessing?</h2>
      <p className="text-gray-500 text-sm mb-6">Select a profile or create a new one</p>
      <div className="space-y-3 mb-4">
        {profiles.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-sm"
              style={{ background: '#0F2557' }}>
              {p.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate" style={{ color: '#0F2557' }}>{p.full_name}</div>
              <div className="text-xs font-mono" style={{ color: '#F5821E' }}>{p.bh_id}</div>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600" />
          </button>
        ))}
      </div>
      {canAddProfile && (
        <button
          onClick={onCreateNew}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 text-sm font-semibold text-gray-500 hover:text-blue-600 transition-all"
        >
          <Plus size={16} /> Add New Profile
        </button>
      )}
      {!canAddProfile && (
        <p className="text-xs text-gray-400 text-center">Maximum 5 profiles reached for this mobile number.</p>
      )}
    </>
  )
}

// ── Step 4: Create new BH profile ─────────────────────────────────────────
function StepCreateProfile({ verifiedToken, onBack, onCreated }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', gender: '', date_of_birth: '', state: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First name and last name are required.')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/patient/create-profile', {
        verified_token: verifiedToken,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        state: form.state || null,
      })
      const data = res.data || res
      onCreated(data)
    } catch (err) {
      setError(err.message || 'Failed to create profile.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to profiles
      </button>
      <h2 className="text-2xl font-extrabold mb-1" style={{ color: '#0F2557' }}>Create Your Health Profile</h2>
      <p className="text-gray-500 text-sm mb-6">A permanent BH ID will be assigned — free for life</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name <span className="text-red-500">*</span></label>
            <input
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
              placeholder="First name"
              value={form.first_name}
              onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
              required autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name <span className="text-red-500">*</span></label>
            <input
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
              placeholder="Last name"
              value={form.last_name}
              onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Date of Birth</label>
          <input
            type="date"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
            value={form.date_of_birth}
            onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Gender</label>
          <select
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all bg-white"
            value={form.gender}
            onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
          <select
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all bg-white"
            value={form.state}
            onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
          >
            <option value="">Select state</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
          style={{ background: '#CC1414' }}
        >
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating profile…</>
            : <><CheckCircle size={16} /> Create Profile & Get BH ID</>}
        </button>
      </form>
    </>
  )
}

// ── Main Login component ───────────────────────────────────────────────────
export default function Login() {
  const [step, setStep] = useState('identifier')   // identifier | otp | select | create
  const [mobile, setMobile] = useState('')
  const [maskedMobile, setMaskedMobile] = useState('')
  const [devOtp, setDevOtp] = useState(null)
  const [verifiedToken, setVerifiedToken] = useState('')
  const [profiles, setProfiles] = useState([])
  const [canAdd, setCanAdd] = useState(true)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState('')

  const { loginWithToken } = useAuth()

  const handleIdentifierNext = ({ mobile: m, maskedMobile: mm, devOtp: d }) => {
    setMobile(m)
    setMaskedMobile(mm)
    setDevOtp(d)
    setStep('otp')
  }

  const handleOtpNext = ({ verifiedToken: t, profiles: p, canAddProfile: c }) => {
    setVerifiedToken(t)
    setProfiles(p)
    setCanAdd(c)
    setStep(p.length === 0 ? 'create' : 'select')
  }

  const handleSelect = async (profileId) => {
    setFinalizing(true)
    setError('')
    try {
      const res = await api.post('/auth/patient/select-profile', {
        verified_token: verifiedToken,
        bh_profile_id: profileId,
      })
      const data = res.data || res
      await loginWithToken(data.access_token, data.bh_profile_id)
    } catch (err) {
      setError(err.message || 'Failed to sign in.')
      setFinalizing(false)
    }
  }

  const handleCreated = async (data) => {
    await loginWithToken(data.access_token, data.bh_profile_id)
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <HeroPanel />
      <div className="flex-1 flex items-center justify-center p-6 bg-white lg:bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <BrandLogo size="lg" />
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
            {finalizing ? (
              <div className="flex flex-col items-center py-8 gap-4">
                <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2557', borderTopColor: 'transparent' }} />
                <p className="text-gray-600 font-medium">Signing you in…</p>
              </div>
            ) : step === 'identifier' ? (
              <StepIdentifier onNext={handleIdentifierNext} />
            ) : step === 'otp' ? (
              <StepOTP
                mobile={mobile}
                maskedMobile={maskedMobile}
                devOtp={devOtp}
                onNext={handleOtpNext}
                onBack={() => setStep('identifier')}
              />
            ) : step === 'select' ? (
              <>
                {error && (
                  <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <StepSelectProfile
                  verifiedToken={verifiedToken}
                  profiles={profiles}
                  canAddProfile={canAdd}
                  onSelect={handleSelect}
                  onCreateNew={() => setStep('create')}
                />
              </>
            ) : (
              <StepCreateProfile
                verifiedToken={verifiedToken}
                onBack={() => setStep(profiles.length > 0 ? 'select' : 'otp')}
                onCreated={handleCreated}
              />
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            BHarath Health · My Health Portal · Your data is private & secure
          </p>
        </div>
      </div>
    </div>
  )
}
