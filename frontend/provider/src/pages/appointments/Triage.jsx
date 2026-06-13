import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { appointmentsApi } from '../../api'
import { format } from 'date-fns'
import { Activity, User, Clock, ChevronLeft } from 'lucide-react'
import VitalsForm from '../../components/clinical/VitalsForm'

const STATUS_COLORS = {
  pending: 'badge-yellow', confirmed: 'badge-blue',
  in_progress: 'badge-purple', completed: 'badge-green',
}

export default function Triage() {
  const navigate = useNavigate()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [date, setDate] = useState(today)
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    setLoading(true)
    appointmentsApi.list({ appointment_date: date, limit: 100 })
      .then(r => {
        const list = (Array.isArray(r) ? r : []).filter(a => a.status !== 'cancelled')
        setQueue(list)
        if (list.length > 0 && !selected) setSelected(list[0])
      })
      .finally(() => setLoading(false))
  }, [date])

  const handleSelect = (appt) => setSelected(appt)

  const handleSaved = (savedVitals) => {
    // Advance to in_progress if still waiting
    if (selected && ['pending', 'confirmed'].includes(selected.status)) {
      appointmentsApi.update(selected.id, { status: 'in_progress' })
        .then(() => {
          setQueue(q => q.map(a => a.id === selected.id ? { ...a, status: 'in_progress' } : a))
          setSelected(s => ({ ...s, status: 'in_progress' }))
        })
        .catch(() => {})
    }
  }

  return (
    <div className="flex gap-6 h-full min-h-0">
      {/* Queue sidebar */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        <div className="card p-3">
          <input type="date" className="input text-sm" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="card overflow-hidden flex-1 flex flex-col">
          <div className="px-4 py-2.5 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
            <span>Today's Queue</span>
            {!loading && <span className="font-normal text-gray-400">{queue.length} patients</span>}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
            ) : queue.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No patients for {date}</div>
            ) : queue.map(a => (
              <button key={a.id}
                onClick={() => handleSelect(a)}
                className={`w-full text-left px-4 py-3 transition-colors hover:bg-blue-50 ${
                  selected?.id === a.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-semibold text-sm text-gray-900 truncate">{a.patient_name || '—'}</span>
                  <span className={`${STATUS_COLORS[a.status] || 'badge-gray'} flex-shrink-0 text-[10px]`}>
                    {a.status?.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock size={11} /> {a.appointment_time}
                  {a.doctor_name && <span>· {a.doctor_name}</span>}
                </div>
                {a.reason && <div className="text-xs text-gray-400 italic mt-0.5 truncate">"{a.reason}"</div>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vitals panel */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="card p-12 text-center text-gray-400">
            <Activity size={36} className="mx-auto mb-2 opacity-30" />
            <p>Select a patient to record vitals</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Patient header */}
            <div className="card p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <User size={22} className="text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg text-gray-900">{selected.patient_name}</div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-0.5">
                  <span className="flex items-center gap-1"><Clock size={13} /> {selected.appointment_time}</span>
                  {selected.doctor_name && <span>Dr. {selected.doctor_name}</span>}
                  {selected.reason && <span className="italic truncate max-w-xs">"{selected.reason}"</span>}
                </div>
              </div>
              <span className={STATUS_COLORS[selected.status] || 'badge-gray'}>
                {selected.status?.replace('_', ' ')}
              </span>
            </div>

            {/* Shared vitals form */}
            <div className="card p-5">
              <VitalsForm
                patientId={selected.patient_id}
                appointmentId={selected.id}
                onSaved={handleSaved}
              />
            </div>

            <button onClick={() => navigate('/appointments')}
              className="text-sm text-gray-500 hover:underline flex items-center gap-1">
              <ChevronLeft size={14} /> Back to Appointments
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
