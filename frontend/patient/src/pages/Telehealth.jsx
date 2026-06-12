import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Video, Clock, Loader2, AlertTriangle, Calendar, CheckCircle2 } from 'lucide-react'
import api from '../api/client'

const STATE_META = {
  scheduled:   { label: 'Scheduled',   color: '#64748b', bg: '#f1f5f9' },
  ready:       { label: 'Doctor Ready',color: '#16a34a', bg: '#dcfce7' },
  in_progress: { label: 'In Progress', color: '#d97706', bg: '#fffbeb' },
  completed:   { label: 'Completed',   color: '#64748b', bg: '#f1f5f9' },
  expired:     { label: 'Expired',     color: '#dc2626', bg: '#fee2e2' },
}

function StatusBadge({ state }) {
  const m = STATE_META[state] || STATE_META.scheduled
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: m.bg, color: m.color }}>
      {state === 'ready' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
      {m.label}
    </span>
  )
}

export default function Telehealth() {
  const navigate = useNavigate()
  const [appts, setAppts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [joiningId, setJoiningId] = useState(null)

  useEffect(() => {
    api.get('/portal/appointments', { params: { limit: 100 } })
      .then(data => {
        const list = Array.isArray(data) ? data : (data.appointments || data.items || data.results || [])
        setAppts(list.filter(a => a.mode === 'telehealth' && ['pending','confirmed','in_progress','completed'].includes(a.status)))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const join = async (appt) => {
    setJoiningId(appt.id)
    try {
      const data = await api.post(`/portal/appointments/${appt.id}/join`)
      navigate(`/telehealth/call/${appt.id}`, { state: { joinData: data, appt } })
    } catch (e) {
      alert(e.message || 'Cannot join yet. Please wait for your appointment time.')
    } finally {
      setJoiningId(null)
    }
  }

  const canJoin = (a) => ['pending', 'confirmed', 'in_progress'].includes(a.status)

  return (
    <div>
      {/* How it works */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 mb-6">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">How it works</p>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>Your doctor opens the session 5–15 minutes before your appointment</li>
          <li>Click <strong>Join Call</strong> — allow camera and microphone when prompted</li>
          <li>Wait in the room until your doctor admits you</li>
        </ol>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={26} className="animate-spin text-gray-400" />
        </div>
      ) : appts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Video size={36} className="mb-3 opacity-25" />
          <p className="text-sm font-medium text-gray-500">No telehealth appointments</p>
          <p className="text-xs text-gray-400 mt-1">Book a video consultation to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appts.map(a => (
            <div key={a.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#0F255710' }}>
                <Video size={20} style={{ color: '#0F2557' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{a.doctor_name || 'Doctor'}</span>
                  <StatusBadge state={a.telehealth_state || (a.status === 'in_progress' ? 'in_progress' : 'scheduled')} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Calendar size={11} />{a.date}</span>
                  <span className="flex items-center gap-1"><Clock size={11} />{a.time || '—'}</span>
                </div>
              </div>
              <div className="flex-shrink-0">
                {canJoin(a) ? (
                  <button
                    onClick={() => join(a)}
                    disabled={joiningId === a.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90"
                    style={{ background: '#CC1414' }}
                  >
                    {joiningId === a.id
                      ? <><Loader2 size={14} className="animate-spin" /> Joining…</>
                      : <><Video size={14} /> Join Call</>}
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <CheckCircle2 size={13} /> {a.status === 'completed' ? 'Completed' : 'Unavailable'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
