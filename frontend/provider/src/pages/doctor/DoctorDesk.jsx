import { useState, useEffect } from 'react'
import { doctorApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import { Stethoscope, Clock, CheckCircle, ChevronRight, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'

const STATUS_COLORS = {
  pending: 'badge-yellow', confirmed: 'badge-blue',
  in_progress: 'badge-purple', completed: 'badge-green',
}

export default function DoctorDesk() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(today)

  useEffect(() => {
    setLoading(true)
    doctorApi.getQueue({ date })
      .then(r => setQueue(r.data || []))
      .finally(() => setLoading(false))
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
      <div className="grid grid-cols-3 gap-4 mb-6">
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
        <div className="space-y-3">
          {queue.map(appt => (
            <Link
              key={appt.id}
              to={`/encounter/${appt.id}`}
              className="card p-4 flex items-center gap-4 hover:border-blue-300 hover:shadow-md transition-all block"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                #{appt.token_number || appt.id}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{appt.patient_name}</div>
                <div className="text-sm text-gray-500">{appt.reason || 'No reason specified'}</div>
                <div className="text-xs text-gray-400 mt-0.5">{appt.appointment_time}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={STATUS_COLORS[appt.status] || 'badge-gray'}>{appt.status.replace('_', ' ')}</span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
