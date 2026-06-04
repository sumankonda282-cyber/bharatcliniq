import { useState, useEffect } from 'react'
import { doctorApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import { Stethoscope, Clock, CheckCircle, ChevronRight, Calendar, Video } from 'lucide-react'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'

const STATUS_COLORS = {
  pending: 'badge-yellow', confirmed: 'badge-blue',
  in_progress: 'badge-purple', completed: 'badge-green',
}

function TelehealthConsentModal({ appt, onClose }) {
  const [consented, setConsented] = useState(false)
  const [joining, setJoining] = useState(false)

  const handleJoin = async () => {
    setJoining(true)
    try {
      const data = await doctorApi.joinTelehealth(appt.id)
      window.open(data.url, '_blank', 'noopener')
      onClose()
    } catch {
      alert('Could not start telehealth session. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0F255715' }}>
            <Video size={20} style={{ color: '#0F2557' }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: '#0F2557' }}>Telehealth Consent</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          As per <strong>Telemedicine Practice Guidelines 2020</strong> (MoHFW, India), by joining this session you confirm:
        </p>
        <ul className="text-sm text-gray-600 space-y-2 mb-5 pl-4 list-disc">
          <li>You have verified the patient's identity</li>
          <li>This consultation is appropriate for telehealth</li>
          <li>The session will be logged for compliance</li>
          <li>Patient consent for telemedicine has been obtained</li>
        </ul>
        <label className="flex items-start gap-3 cursor-pointer mb-6">
          <input type="checkbox" checked={consented} onChange={e => setConsented(e.target.checked)} className="mt-0.5 w-4 h-4 flex-shrink-0" />
          <span className="text-sm text-gray-700">I confirm compliance with Telemedicine Practice Guidelines 2020</span>
        </label>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
            Cancel
          </button>
          <button
            onClick={handleJoin}
            disabled={!consented || joining}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: '#0F2557' }}
          >
            {joining ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Video size={14} />}
            Join Session
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DoctorDesk() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(today)
  const [telehealthAppt, setTelehealthAppt] = useState(null)

  useEffect(() => {
    const fetch = () => {
      doctorApi.getQueue({ date })
        .then(r => { setQueue(Array.isArray(r) ? r : []); setLoading(false) })
        .catch(() => setLoading(false))
    }
    setLoading(true)
    fetch()
    if (date === today) {
      const interval = setInterval(fetch, 30_000)
      return () => clearInterval(interval)
    }
  }, [date])

  const waiting  = queue.filter(a => ['pending', 'confirmed'].includes(a.status))
  const inProg   = queue.filter(a => a.status === 'in_progress')
  const done     = queue.filter(a => a.status === 'completed')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Doctor Desk</h1>
        <div className="flex items-center gap-3">
          <input type="date" className="input w-44" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
            <Clock size={18} className="text-yellow-600" />
          </div>
          <div>
            <div className="text-xl font-bold">{waiting.length}</div>
            <div className="text-xs text-gray-500">Waiting</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Stethoscope size={18} className="text-purple-600" />
          </div>
          <div>
            <div className="text-xl font-bold">{inProg.length}</div>
            <div className="text-xs text-gray-500">In Progress</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <CheckCircle size={18} className="text-green-600" />
          </div>
          <div>
            <div className="text-xl font-bold">{done.length}</div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
        </div>
      </div>

      {loading ? <PageLoader /> : queue.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <Calendar size={36} className="mx-auto mb-2 opacity-30" />
          <p>No patients in queue for {date}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {queue.map(appt => (
              <div key={appt.id} className="card p-4 flex items-center gap-4 hover:border-blue-300 hover:shadow-md transition-all">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  #{appt.token_number || appt.id}
                </div>
                <Link to={`/encounter/${appt.id}`} className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    {appt.patient_name}
                    {appt.mode === 'telehealth' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: '#0F2557' }}>
                        <Video size={10} /> Virtual
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{appt.reason || 'No reason specified'}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{appt.appointment_time}</div>
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={STATUS_COLORS[appt.status] || 'badge-gray'}>{appt.status.replace('_', ' ')}</span>
                  {appt.mode === 'telehealth' && ['pending', 'confirmed', 'in_progress'].includes(appt.status) && (
                    <button
                      onClick={() => setTelehealthAppt(appt)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ background: '#F5821E' }}
                    >
                      <Video size={12} /> Join
                    </button>
                  )}
                  <Link to={`/encounter/${appt.id}`}><ChevronRight size={16} className="text-gray-400" /></Link>
                </div>
              </div>
            ))}
          </div>
          {telehealthAppt && (
            <TelehealthConsentModal appt={telehealthAppt} onClose={() => setTelehealthAppt(null)} />
          )}
        </>
      )}
    </div>
  )
}
