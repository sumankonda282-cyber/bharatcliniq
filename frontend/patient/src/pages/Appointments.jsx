import { useState, useEffect } from 'react'
import api from '../api/client'
import { cachedFetch } from '../utils/cache'
import { Calendar, Stethoscope, Clock, Video, MapPin } from 'lucide-react'

const STATUS_BADGE = {
  pending: 'badge-yellow', confirmed: 'badge-blue', completed: 'badge-green',
  cancelled: 'badge-gray', in_progress: 'badge-blue',
}

function TelehealthJoinModal({ appt, onClose }) {
  const [consented, setConsented] = useState(false)
  const [joining, setJoining] = useState(false)
  const [err, setErr] = useState('')

  const handleJoin = async () => {
    setJoining(true); setErr('')
    try {
      // Gated by the session state machine: opens 15 min before the slot,
      // closes after the visit ends, revives only if the doctor approves a rejoin.
      const res = await api.post(`/portal/appointments/${appt.id}/join`)
      const url = res.token ? `${res.url}?t=${res.token}` : res.url
      window.open(url, '_blank', 'noopener')
      onClose()
    } catch (e) {
      setErr(e.message || 'Could not join the visit')
    } finally {
      setJoining(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#EEF2FF' }}>
            <Video size={20} style={{ color: '#0F2557' }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: '#0F2557' }}>Join Virtual Consultation</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          You're about to join a secure video consultation with <strong>Dr. {appt.doctor_name}</strong> at <strong>{appt.clinic_name}</strong>.
        </p>
        <ul className="text-sm text-gray-600 space-y-1.5 mb-5 pl-4 list-disc">
          <li>Ensure you're in a private, quiet space</li>
          <li>Allow camera and microphone access when prompted</li>
          <li>The session is secure and not recorded</li>
        </ul>
        <label className="flex items-start gap-3 cursor-pointer mb-6">
          <input type="checkbox" checked={consented} onChange={e => setConsented(e.target.checked)} className="mt-0.5 w-4 h-4 flex-shrink-0" />
          <span className="text-sm text-gray-700">I consent to this telemedicine consultation</span>
        </label>
        {err && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">{err}</div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
          <button onClick={handleJoin} disabled={!consented || joining}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: '#CC1414' }}>
            <Video size={14} /> {joining ? 'Connecting…' : 'Join Now'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ApptCard({ a }) {
  const [showModal, setShowModal] = useState(false)
  const isTelehealth = a.mode === 'telehealth'
  const canJoin = isTelehealth && ['confirmed', 'in_progress', 'pending'].includes(a.status)

  return (
    <div className="card p-4 flex items-start gap-4 hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isTelehealth ? '#0F255710' : '#EEF2FF' }}>
        {isTelehealth ? <Video size={22} style={{ color: '#0F2557' }} /> : <Stethoscope size={22} style={{ color: '#0F2557' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold text-gray-900 text-sm">{a.clinic_name || (a.org_type === 'hospital' ? 'Hospital' : 'Clinic')}</div>
          <span className={`${STATUS_BADGE[a.status] || 'badge-gray'} flex-shrink-0`}>{a.status?.replace('_',' ')}</span>
        </div>
        <div className="text-sm text-gray-500 mt-0.5">Dr. {a.doctor_name || 'Doctor'}</div>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {a.date && <span className="flex items-center gap-1 text-xs text-gray-400"><Calendar size={11} /> {a.date}</span>}
          {a.time && <span className="flex items-center gap-1 text-xs text-gray-400"><Clock size={11} /> {a.time}</span>}
          {a.token_number && (
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full" style={{ background: '#EEF2FF', color: '#0F2557' }}>
              Token #{a.token_number}
            </span>
          )}
          {isTelehealth ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: '#0F2557' }}>
              <Video size={10} /> Virtual
            </span>
          ) : (
            <span className="text-xs text-gray-400 capitalize">{a.mode?.replace('_',' ') || 'Walk-in'}</span>
          )}
        </div>
        {a.reason && <div className="text-xs text-gray-400 mt-1 italic">"{a.reason}"</div>}
        {a.clinic_address && !isTelehealth && (
          <a
            href={`https://www.openstreetmap.org/search?query=${encodeURIComponent([a.clinic_address, a.clinic_city, 'India'].filter(Boolean).join(', '))}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <MapPin size={11} /> Get Directions
          </a>
        )}
        {canJoin && (
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#CC1414' }}
          >
            <Video size={14} /> Join Consultation
          </button>
        )}
      </div>
      {showModal && <TelehealthJoinModal appt={a} onClose={() => setShowModal(false)} />}
    </div>
  )
}

export default function Appointments() {
  const [appts, setAppts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cachedFetch(
      'appointments',
      () => api.get('/portal/appointments'),
      r => { setAppts(r?.appointments || (Array.isArray(r) ? r : [])); setLoading(false) }
    ).catch(() => setLoading(false))
  }, [])

  const upcoming = appts.filter(a => ['pending','confirmed'].includes(a.status))
  const past = appts.filter(a => !['pending','confirmed'].includes(a.status))

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-extrabold" style={{ color: '#0F2557' }}>My Appointments</h1>

      {loading ? (
        <div className="card p-10 text-center text-gray-400 text-sm">Loading…</div>
      ) : appts.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No appointments on record</p>
          <p className="text-sm mt-1">Your clinic will add appointments to your profile.</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#F5821E' }}>Upcoming</h2>
              <div className="space-y-3">{upcoming.map(a => <ApptCard key={a.id} a={a} />)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#0F2557' }}>Past Appointments</h2>
              <div className="space-y-3">{past.map(a => <ApptCard key={a.id} a={a} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
