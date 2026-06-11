import { useEffect, useState } from 'react'
import { Video, Loader2, AlertTriangle, Clock, RefreshCw, User } from 'lucide-react'
import api from '../api/client'

function todayIST() {
  const d = new Date(new Date().getTime() + 5.5 * 3600000)
  return d.toISOString().slice(0, 10)
}

const STATE_META = {
  scheduled:   { label: 'Scheduled',   dot: 'bg-gray-400' },
  ready:       { label: 'Waiting',     dot: 'bg-amber-400 animate-pulse' },
  in_progress: { label: 'Live',        dot: 'bg-green-500 animate-pulse' },
  completed:   { label: 'Completed',   dot: 'bg-gray-300' },
  expired:     { label: 'Expired',     dot: 'bg-red-400' },
}

function StatPill({ label, count, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center gap-3">
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <div>
        <div className="text-2xl font-extrabold" style={{ color }}>{count}</div>
        <div className="text-xs text-gray-500 font-medium">{label}</div>
      </div>
    </div>
  )
}

export default function Telehealth() {
  const [appts, setAppts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  const load = () => {
    setLoading(true)
    api.get('/appointments', { params: { appointment_date: todayIST(), limit: 200 } })
      .then(data => {
        const list = Array.isArray(data) ? data : (data.items || data.results || [])
        setAppts(list.filter(a => a.mode === 'telehealth'))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const live      = appts.filter(a => a.telehealth_state === 'in_progress' || a.status === 'in_progress').length
  const waiting   = appts.filter(a => ['scheduled','ready','pending','confirmed'].includes(a.telehealth_state || a.status) && a.status !== 'completed').length
  const completed = appts.filter(a => a.status === 'completed').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Video size={22} className="text-emerald-600" /> Telehealth Monitor
          </h1>
          <p className="text-sm text-gray-500 mt-1">Today's video consultations — view only</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatPill label="Live Now"  count={live}      color="#16a34a" />
        <StatPill label="Waiting"   count={waiting}   color="#d97706" />
        <StatPill label="Completed" count={completed} color="#64748b" />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-400" />
        </div>
      ) : appts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Video size={40} className="mb-3 opacity-25" />
          <p className="text-sm font-medium text-gray-500">No telehealth appointments today</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Time', 'Patient', 'Doctor', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appts.map(a => {
                const stateKey = a.telehealth_state || (a.status === 'in_progress' ? 'in_progress' : a.status === 'completed' ? 'completed' : 'scheduled')
                const meta = STATE_META[stateKey] || STATE_META.scheduled
                return (
                  <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                        <Clock size={13} className="text-gray-400" />
                        {a.appointment_time || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 flex-shrink-0">
                          {(a.patient_name || 'P')[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{a.patient_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">{a.doctor_name || '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
