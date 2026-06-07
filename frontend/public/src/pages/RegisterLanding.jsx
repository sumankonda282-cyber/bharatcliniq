import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2, Stethoscope, Heart, Pill, FlaskConical, Scan,
  CheckCircle, Mail, Phone, Linkedin
} from 'lucide-react'
import { publicApi } from '../api/client'
import BrandLogo from '../components/BrandLogo'

function Navbar() {
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/"><BrandLogo size="md" /></Link>
          <div className="flex items-center gap-6">
            <Link to="/clinics" className="text-gray-600 hover:text-gray-900 font-medium text-sm hidden md:block">Find Care</Link>
            <Link to="/" className="text-gray-600 hover:text-gray-900 font-medium text-sm hidden md:block">Home</Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

const ENTITY_CARDS = [
  {
    icon: '🏥',
    title: 'Clinic',
    subtitle: 'Single or multi-specialty. GP, dental, eye care, group practice.',
    features: ['Appointments & queue', 'EMR & billing', 'Lab/pharmacy integration', 'All portals included'],
    color: '#0F2557',
    route: '/register/clinic',
    btnLabel: 'Register Clinic',
  },
  {
    icon: '🏨',
    title: 'Hospital',
    subtitle: 'Multi-specialty inpatient care. Wards, ICU, OT, emergency.',
    features: ['Inpatient management', 'Ward & bed board', 'MAR & clinical orders', 'Full billing suite'],
    color: '#CC1414',
    route: '/register/hospital',
    btnLabel: 'Register Hospital',
  },
  {
    icon: '💊',
    title: 'Pharmacy',
    subtitle: 'Standalone retail or hospital dispensary.',
    features: ['Prescription upload & pickup', 'Inventory management', 'Patient history', 'Home delivery support'],
    color: '#138808',
    route: '/register/pharmacy',
    btnLabel: 'Register Pharmacy',
  },
  {
    icon: '🔬',
    title: 'Diagnostic Center',
    subtitle: 'Labs & imaging. Upload prescriptions, collect results.',
    features: ['Test booking', 'Digital reports', 'Doctor referrals', 'Home collection'],
    color: '#7C3AED',
    route: '/register/diagnostic',
    btnLabel: 'Register Center',
  },
]

const PORTALS = [
  { name: 'Receptionist Portal', Icon: Building2, color: '#0F2557', for: 'Receptionist & Admin', features: ['Patient queue', 'Appointments', 'Billing & invoicing'] },
  { name: 'Provider Portal', Icon: Stethoscope, color: '#CC1414', for: 'Doctors & Providers', features: ['EMR', 'SOAP notes', 'e-Prescriptions'] },
  { name: 'CareChart', Icon: Heart, color: '#F5821E', for: 'Ward Nurses', features: ['MAR', 'Vitals monitoring', 'Clinical orders'] },
  { name: 'Pharmacy', Icon: Pill, color: '#138808', for: 'Pharmacy Staff', features: ['Dispensing', 'Inventory alerts', 'Prescriptions'] },
  { name: 'Lab', Icon: FlaskConical, color: '#7C3AED', for: 'Laboratory', features: ['Test orders', 'Digital reports', 'Results delivery'] },
  { name: 'Imaging', Icon: Scan, color: '#0891B2', for: 'Imaging / Radiology', features: ['Scan orders', 'DICOM support', 'Reports'] },
]

const DEMO_PORTALS = [
  { id: 'provider',     label: 'Provider Portal',             Icon: Stethoscope, color: '#CC1414', desc: 'EMR, SOAP notes, e-prescriptions' },
  { id: 'carechart',   label: 'CareChart (Ward Nursing)',     Icon: Heart,       color: '#F5821E', desc: 'MAR, vitals, clinical orders' },
  { id: 'receptionist',label: 'Staff / Receptionist Portal',  Icon: Building2,   color: '#0F2557', desc: 'Appointments, billing, queue' },
  { id: 'lab',         label: 'Lab Portal',                  Icon: FlaskConical, color: '#7C3AED', desc: 'Test orders, digital reports' },
  { id: 'pharmacy',    label: 'Pharmacy Portal',              Icon: Pill,        color: '#138808', desc: 'Dispensing, inventory, prescriptions' },
  { id: 'imaging',     label: 'Imaging / Radiology Portal',  Icon: Scan,        color: '#0891B2', desc: 'Scan orders, DICOM, reports' },
]

const inputCls = (err) =>
  `w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all ${err ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-blue-200'}`

function DemoInquiryForm() {
  const [form, setForm]         = useState({ name: '', phone: '', email: '', org_type: '', portals: [] })
  const [errors, setErrors]     = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [submitError, setSubmitError] = useState('')

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.phone.trim() && !form.email.trim()) e.contact = 'Provide phone or email so we can reach you'
    return e
  }

  const togglePortal = (id) => {
    setForm(f => ({
      ...f,
      portals: f.portals.includes(id) ? f.portals.filter(p => p !== id) : [...f.portals, id],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSubmitting(true)
    setSubmitError('')
    try {
      await publicApi.sendDemoInquiry(form)
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-10 shadow-sm text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Request Received!</h3>
        <p className="text-gray-500 text-sm max-w-xs mx-auto leading-relaxed">
          Our team will contact you within 24 hours to set up your personalized demo environment with sample data.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
      <div className="mb-2">
        <h3 className="font-bold text-gray-800 text-lg">Request Demo Access</h3>
        <p className="text-sm text-gray-500 mt-1">Fill in your details — our team will contact you to set up access.</p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Full name"
          className={inputCls(errors.name)}
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="+91 98765 43210"
            className={inputCls(errors.contact)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="you@example.com"
            className={inputCls(errors.contact)}
          />
        </div>
      </div>
      {errors.contact && <p className="text-red-500 text-xs -mt-2">{errors.contact}</p>}

      {/* Org type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization Type</label>
        <div className="grid grid-cols-2 gap-2">
          {['Hospital', 'Clinic', 'Pharmacy', 'Diagnostic Center', 'Other'].map(type => (
            <label key={type}
              className={`flex items-center gap-2 text-sm cursor-pointer border rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors ${form.org_type === type ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
              <input
                type="radio"
                name="org_type"
                value={type}
                checked={form.org_type === type}
                onChange={e => setForm(f => ({ ...f, org_type: e.target.value }))}
              />
              <span className={form.org_type === type ? 'font-semibold text-blue-700' : ''}>{type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Portal selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Which portals would you like to explore?</label>
        <div className="space-y-2">
          {DEMO_PORTALS.map(p => (
            <label key={p.id}
              className={`flex items-center gap-3 text-sm cursor-pointer border rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors ${form.portals.includes(p.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
              <input
                type="checkbox"
                checked={form.portals.includes(p.id)}
                onChange={() => togglePortal(p.id)}
                className="rounded flex-shrink-0"
              />
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: p.color + '20' }}>
                <p.Icon className="w-3.5 h-3.5" style={{ color: p.color }} />
              </div>
              <div className="min-w-0">
                <span className="font-medium text-gray-800">{p.label}</span>
                <span className="text-gray-400 text-xs ml-1 hidden sm:inline">— {p.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {submitError && (
        <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{submitError}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
        style={{ background: '#0F2557' }}
      >
        {submitting ? (
          <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
        ) : (
          'Request Demo Access →'
        )}
      </button>
    </form>
  )
}

export default function RegisterLanding() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── Section 1: Hero ─────────────────────────────────────────────── */}
      <section className="py-20 px-4 text-center text-white" style={{ background: '#0F2557' }}>
        <div className="max-w-3xl mx-auto">
          <div className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold mb-6 border border-blue-400 text-blue-200">
            Trusted by 500+ healthcare providers
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
            Join India's Digital Health Network
          </h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            <span style={{ color: '#CC1414', fontWeight: 900 }}>BH</span>arath Health Systems powers clinics, hospitals, pharmacies, and diagnostic centers with one integrated platform — patient management, EMR, billing, pharmacy, labs, and more.
          </p>
        </div>
      </section>

      {/* ── Section 2: Entity Type Chooser ──────────────────────────────── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2" style={{ color: '#0F2557' }}>
            What are you registering?
          </h2>
          <p className="text-center text-gray-500 mb-10 text-sm">Choose the option that best describes your organization.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ENTITY_CARDS.map(card => (
              <div key={card.title} className="border-2 rounded-2xl p-6 flex flex-col hover:shadow-lg transition-shadow"
                style={{ borderColor: card.color + '33' }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{card.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: card.color }}>{card.title}</h3>
                    <p className="text-gray-500 text-sm">{card.subtitle}</p>
                  </div>
                </div>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {card.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: card.color }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to={card.route}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
                  style={{ background: card.color }}>
                  {card.btnLabel} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: Portal Showcase ───────────────────────────────────── */}
      <section className="py-16 px-4" style={{ background: '#F8FAFC' }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2" style={{ color: '#0F2557' }}>
            One Platform, Every Department
          </h2>
          <p className="text-center text-gray-500 mb-10 text-sm">Specialized portals for every role in your organization.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PORTALS.map(({ name, Icon, color, for: forRole, features }) => (
              <div key={name} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{name}</h3>
                    <p className="text-xs text-gray-500">{forRole}</p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {features.map(f => (
                    <li key={f} className="text-xs text-gray-600 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: Demo Access (Inquiry Form) ────────────────────────── */}
      <section className="py-16 px-4" style={{ background: '#F0F4F8' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2" style={{ color: '#0F2557' }}>
            Experience Every Portal Before You Register
          </h2>
          <p className="text-center text-gray-500 mb-10 text-sm">
            Request a guided demo. Our team will set up a personalized environment for you — no commitment, no payment required.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left: portal list */}
            <div>
              <h3 className="text-lg font-bold mb-4" style={{ color: '#0F2557' }}>All 6 Portals Included in Demo</h3>
              <div className="space-y-3">
                {DEMO_PORTALS.map(({ id, label, Icon, color, desc }) => (
                  <div key={id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '18' }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl p-4 text-sm" style={{ background: '#0F255710', border: '1px solid #0F255730' }}>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-500" />
                  <p className="text-gray-600">Full-featured demo with sample patient data, appointments, and workflows pre-loaded. Reset on request.</p>
                </div>
              </div>
            </div>

            {/* Right: inquiry form */}
            <DemoInquiryForm />
          </div>
        </div>
      </section>

      {/* ── Section 5: Founder & Contact ─────────────────────────────────── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: '#0F2557' }}>
            Meet the Team
          </h2>

          {/* Founder Card */}
          <div className="flex flex-col items-center mb-14">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-bold text-white mb-4"
              style={{ background: '#0F2557' }}>BH</div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Founder &amp; CEO</p>
            <h3 className="text-xl font-bold mb-3" style={{ color: '#0F2557' }}>
              <span style={{ color: '#CC1414' }}>BH</span>arath Health Systems
            </h3>
            <blockquote className="text-center text-gray-500 italic max-w-md mb-4 leading-relaxed">
              "Building India's healthcare infrastructure, one clinic at a time."
            </blockquote>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <a href="mailto:founder@bharathhealthsystems.com" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                <Mail className="w-4 h-4" /> founder@bharathhealthsystems.com
              </a>
              <a href="#" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                <Linkedin className="w-4 h-4" /> LinkedIn
              </a>
            </div>
          </div>

          {/* Business Contacts */}
          <h3 className="text-lg font-bold text-center mb-6 text-gray-700">Business Inquiries &amp; Marketing</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            {[
              {
                title: 'Business Partnerships',
                lines: ['+91 98765 43210', 'partnerships@bharathhealthsystems.com'],
                icons: [Phone, Mail],
              },
              {
                title: 'Sales & Onboarding',
                lines: ['+91 98765 43211', 'Talk to our team about getting your clinic onboard'],
                icons: [Phone, null],
              },
              {
                title: 'Support',
                lines: ['1800-XXX-XXXX (Toll Free)', 'support@bharathhealthsystems.com'],
                icons: [Phone, Mail],
              },
            ].map(({ title, lines, icons }) => (
              <div key={title} className="border border-gray-200 rounded-2xl p-5">
                <h4 className="font-semibold text-gray-800 mb-3">{title}</h4>
                <div className="space-y-2">
                  {lines.map((line, idx) => {
                    const Icon = icons[idx]
                    return (
                      <div key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                        {Icon && <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />}
                        <span>{line}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-gray-400">
            These are business inquiry contacts. For patient support, use your clinic's helpline.
          </p>
        </div>
      </section>

      {/* ── Section 6: Bottom CTA ─────────────────────────────────────────── */}
      <section className="py-16 px-4 text-white text-center" style={{ background: '#0F2557' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Start your free registration today.</h2>
          <p className="text-blue-200 mb-10">No setup fees. No commitment. Be live in 24 hours.</p>
          <div className="flex flex-wrap justify-center gap-4">
            {ENTITY_CARDS.map(card => (
              <Link key={card.title} to={card.route}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border-2 text-white hover:opacity-90 transition-opacity"
                style={{ borderColor: card.color === '#0F2557' ? '#4A6FBF' : card.color, background: card.color === '#0F2557' ? '#1a3a7a' : card.color }}>
                <span>{card.icon}</span> {card.btnLabel}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
