import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  Activity, Search, CheckCircle, Clock, XCircle, Calendar,
  User, Building2, ArrowLeft, Phone, AlertCircle
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
          <div className="flex items-center gap-6">
            <Link to="/clinics" className="text-gray-600 hover:text-primary-600 font-medium text-sm">Find Clinics</Link>
            <Link to="/book" className="btn-primary text-sm py-2 px-4">Book Appointment</Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

const STATUS_CONFIG = {
  confirmed: {
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-50',
    border: 'border-green-200',
    label: 'Confirmed',
    badgeClass: 'bg-green-100 text-green-700',
  },
  pending: {
    icon: Clock,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    label: 'Pending',
    badgeClass: 'bg-yellow-100 text-yellow-700',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'Cancelled',
    badgeClass: 'bg-red-100 text-red-700',
  },
  completed: {
    icon: CheckCircle,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    label: 'Completed',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status?.toLowerCase()] || STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${cfg.badgeClass}`}>
      <Icon className="w-4 h-4" />
      {cfg.label}
    </span>
  )
}

function BookingCard({ booking }) {
  const status = booking.status?.toLowerCase() || 'pending'
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = cfg.icon

  return (
    <div className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-6`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Icon className={`w-8 h-8 ${cfg.color}`} />
          <div>
            <p className="text-sm text-gray-500">Booking Status</p>
            <StatusBadge status={status} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-1">Confirmation Code</p>
          <p className="text-2xl font-bold text-primary-700 tracking-widest">{booking.confirmation_code || booking.code}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {booking.patient_name && (
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-primary-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Patient</p>
              <p className="font-semibold text-gray-900">{booking.patient_name}</p>
            </div>
          </div>
        )}
        {booking.doctor_name && (
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-primary-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Doctor</p>
              <p className="font-semibold text-gray-900">{booking.doctor_name}</p>
              {booking.doctor_specialty && <p className="text-xs text-gray-500">{booking.doctor_specialty}</p>}
            </div>
          </div>
        )}
        {booking.clinic_name && (
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-primary-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Clinic</p>
              <p className="font-semibold text-gray-900">{booking.clinic_name}</p>
              {booking.clinic_address && <p className="text-xs text-gray-500">{booking.clinic_address}</p>}
            </div>
          </div>
        )}
        {booking.date && (
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-primary-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Date & Time</p>
              <p className="font-semibold text-gray-900">{booking.date}</p>
              {booking.slot && <p className="text-xs text-gray-500">{booking.slot}</p>}
            </div>
          </div>
        )}
        {booking.mobile && (
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-primary-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Mobile</p>
              <p className="font-semibold text-gray-900">{booking.mobile}</p>
            </div>
          </div>
        )}
        {booking.reason && (
          <div className="sm:col-span-2 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400">Reason</p>
              <p className="text-gray-700 text-sm">{booking.reason}</p>
            </div>
          </div>
        )}
      </div>

      {status === 'confirmed' && (
        <div className="mt-4 bg-green-600 text-white rounded-xl p-4 text-sm">
          <p className="font-semibold mb-1">Instructions for your visit</p>
          <p className="text-green-100">Please arrive 10 minutes early. Bring a valid ID and this confirmation code. The clinic will confirm your appointment.</p>
        </div>
      )}
      {status === 'cancelled' && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p className="font-semibold mb-1">This appointment has been cancelled</p>
          <p>Please contact the clinic or book a new appointment.</p>
        </div>
      )}
    </div>
  )
}

export default function BookingStatus() {
  const { code } = useParams()
  const navigate = useNavigate()
  const isCheckMode = code === 'check'

  const [inputCode, setInputCode] = useState('')
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(!isCheckMode)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isCheckMode && code) {
      fetchBooking(code)
    }
  }, []) // eslint-disable-line

  const fetchBooking = async (c) => {
    setLoading(true)
    setError('')
    try {
      const data = await publicApi.getBookingStatus(c)
      setBooking(data.booking || data)
    } catch (err) {
      setError(err.message || 'Booking not found. Please check your confirmation code.')
      setBooking(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (!inputCode.trim()) return
    navigate(`/booking/${inputCode.trim().toUpperCase()}`)
    fetchBooking(inputCode.trim())
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-gray-500 hover:text-primary-600 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Booking Status</h1>
        <p className="text-gray-500 mb-8">Enter your confirmation code to view appointment details.</p>

        {/* Search input */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <input
            type="text"
            value={inputCode}
            onChange={e => setInputCode(e.target.value.toUpperCase())}
            placeholder="Enter confirmation code (e.g. BC3X7YZ)"
            className="input flex-1 uppercase tracking-widest font-mono"
            maxLength={20}
          />
          <button type="submit" className="btn-primary px-5" disabled={loading}>
            <Search className="w-4 h-4" />
          </button>
        </form>

        {loading ? (
          <div className="flex flex-col items-center py-20">
            <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500">Looking up your booking...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16 card">
            <XCircle className="w-14 h-14 text-red-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-800 mb-2">Booking Not Found</h3>
            <p className="text-gray-500 text-sm mb-6">{error}</p>
            <Link to="/book" className="btn-primary">Book an Appointment</Link>
          </div>
        ) : booking ? (
          <div>
            <BookingCard booking={booking} />
            <div className="flex gap-3 mt-6 justify-center">
              <Link to="/clinics" className="btn-outline">Find More Clinics</Link>
              <Link to="/book" className="btn-primary">Book Another</Link>
            </div>
          </div>
        ) : !isCheckMode ? null : (
          <div className="text-center py-16 card">
            <Calendar className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700 mb-2">Enter your booking code above</h3>
            <p className="text-gray-400 text-sm">The confirmation code was sent to you after booking</p>
          </div>
        )}
      </div>
    </div>
  )
}
