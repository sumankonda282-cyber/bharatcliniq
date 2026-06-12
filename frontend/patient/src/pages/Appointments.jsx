import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { cachedFetch, cacheSet } from '../utils/cache'
import {
  Calendar, Stethoscope, Clock, Video, MapPin, Plus,
  Building2, Globe, CheckCircle, AlertTriangle
} from 'lucide-react'

const STATUS_BADGE = {
  pending: 'badge-yellow', confirmed: 'badge-blue', completed: 'badge-green',
  cancelled: 'badge-gray', in_progress: 'badge-blue',
}

const TABS = ['All', 'Upcoming', 'Completed', 'Cancelled']

function ApptCard({ a }) {
  const navigate = useNavigate()
  const [joining, setJoining] = useState(false)
  const isTelehealth = a.mode === 'telehealth'
  const isOnlineBooking = a.source === 'online_booking'

  // Same secured join flow as the Telehealth page — never link the raw room URL
  const join = async () => {
    setJoining(true)
    try {
      const data = await api.post(`/portal/appointments/${a.id}/join`)
      navigate(`/telehealth/call/${a.id}`, { state: { joinData: data, appt: a } })
    } catch (e) {
      alert(e.message || 'Cannot join yet. Please wait for your appointment time.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="card p-4 flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: isTelehealth ? '#0F255712' : '#EEF2FF' }}>
        {isTelehealth
          ? <Video size={20} style={{ color: '#0F2557' }} />
          : <Stethoscope size={20} style={{ color: '#0F2557' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold text-gray-900 text-sm truncate">{a.clinic_name || 'Health Center'}</div>
          <span className={`${STATUS_BADGE[a.status] || 'badge-gray'} flex-shrink-0 capitalize`}>
            {a.status?.replace('_', ' ')}
          </span>
        </div>
        <div className="text-sm text-gray-500 mt-0.5">
          {/^dr\.?\s/i.test(a.doctor_name || '') ? a.doctor_name : `Dr. ${a.doctor_name || 'Doctor'}`}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {a.date && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar size={11} />
              {new Date(a.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
          {a.time && <span className="flex items-center gap-1 text-xs text-gray-400"><Clock size={11} /> {a.time}</span>}
          {a.token_number && (
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full" style={{ background: '#EEF2FF', color: '#0F2557' }}>
              Token #{a.token_number}
            </span>
          )}
          {a.confirmation_code && (
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF3E7', color: '#F5821E' }}>
              {a.confirmation_code}
            </span>
          )}
          {isOnlineBooking && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#0F255710', color: '#0F2557' }}>
              <Globe size={10} /> Booked Online
            </span>
          )}
          {isTelehealth && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: '#0F2557' }}>
              <Video size={10} /> Virtual
            </span>
          )}
        </div>
        {isOnlineBooking && a.status === 'pending' && (
          <div className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
            <AlertTriangle size={11} className="text-yellow-500" />
            Awaiting confirmation from the health center
          </div>
        )}
        {a.reason && <div className="text-xs text-gray-400 mt-1 italic">"{a.reason}"</div>}
        {a.clinic_address && !isTelehealth && (
          <a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent([a.clinic_address, a.clinic_city, 'India'].filter(Boolean).join(', '))}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <MapPin size={11} /> Get Directions
          </a>
        )}
        {isTelehealth && ['confirmed', 'in_progress', 'pending'].includes(a.status) && (
          <div className="mt-2">
            <button onClick={join} disabled={joining}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: '#CC1414' }}>
              <Video size={12} /> {joining ? 'Joining…' : 'Join Consultation'}
            </button>
          </div>
        )}
        {a.status === 'completed' && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
            <CheckCircle size={11} /> Visit completed
          </div>
        )}
      </div>
    </div>
  )
}

export default function Appointments() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [appts, setAppts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('All')

  useEffect(() => {
    // Deeplink: /appointments?book=1
    if (searchParams.get('book') || searchParams.get('doctor_id')) {
      navigate('/appointments/book', { replace: true })
    }
    cachedFetch(
      'appointments',
      () => api.get('/portal/appointments'),
      r => { setAppts(r?.appointments || (Array.isArray(r) ? r : [])); setLoading(false) }
    ).catch(() => setLoading(false))
  }, []) // eslint-disable-line

  const filtered = appts.filter(a => {
    if (tab === 'Upcoming') return ['pending', 'confirmed'].includes(a.status)
    if (tab === 'Completed') return a.status === 'completed'
    if (tab === 'Cancelled') return a.status === 'cancelled'
    return true
  })

  return (
    <div className="space-y-5">
      {/* Action bar — hidden when there's nothing to filter; empty state owns the Book button */}
      {!(!loading && appts.length === 0) && (
      <div className="flex items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex bg-white rounded-xl border border-gray-200 p-1 gap-0.5 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0"
              style={tab === t
                ? { background: '#0F2557', color: 'white' }
                : { color: '#6b7280' }}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => navigate('/appointments/book')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
          style={{ background: '#CC1414' }}>
          <Plus size={15} /> Book Appointment
        </button>
      </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="card p-10 text-center">
          <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: '#c7d2e5', borderTopColor: '#0F2557' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">
            {tab === 'All' ? 'No appointments yet' : `No ${tab.toLowerCase()} appointments`}
          </p>
          {tab === 'All' && (
            <>
              <p className="text-sm mt-1 mb-5">Book your first appointment with a verified doctor.</p>
              <button onClick={() => navigate('/appointments/book')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#CC1414' }}>
                <Plus size={15} /> Book Appointment
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => <ApptCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  )
}
