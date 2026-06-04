import { useState, useEffect } from 'react'
import api from '../api/client'
import { Calendar, Pill, FlaskConical, Receipt, Loader2, Clock } from 'lucide-react'

const TYPE_CONFIG = {
  appointment: {
    label: 'Appointment',
    icon: Calendar,
    color: '#3B82F6',
    bg: '#EFF6FF',
    border: '#BFDBFE',
  },
  prescription: {
    label: 'Prescription',
    icon: Pill,
    color: '#EF4444',
    bg: '#FEF2F2',
    border: '#FECACA',
  },
  lab: {
    label: 'Lab Result',
    icon: FlaskConical,
    color: '#F97316',
    bg: '#FFF7ED',
    border: '#FED7AA',
  },
  bill: {
    label: 'Bill',
    icon: Receipt,
    color: '#16A34A',
    bg: '#F0FDF4',
    border: '#BBF7D0',
  },
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'appointment', label: 'Appointments' },
  { key: 'prescription', label: 'Prescriptions' },
  { key: 'lab', label: 'Labs' },
  { key: 'bill', label: 'Bills' },
]

function getDate(entry) {
  return entry.date || entry.created_at || entry.appointment_date || entry.result_date || ''
}

function AppointmentCard({ entry }) {
  return (
    <div>
      <div className="font-semibold text-gray-800 text-sm">{entry.clinic_name || entry.clinic?.name || 'Clinic'}</div>
      {entry.doctor_name || entry.doctor?.full_name
        ? <div className="text-xs text-gray-500 mt-0.5">Dr. {entry.doctor_name || entry.doctor?.full_name}</div>
        : null}
      {entry.reason && <div className="text-xs text-gray-600 mt-1">Reason: {entry.reason}</div>}
      {entry.status && (
        <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${
          entry.status === 'completed' ? 'bg-green-100 text-green-700' :
          entry.status === 'cancelled' ? 'bg-red-100 text-red-700' :
          'bg-blue-100 text-blue-700'
        }`}>{entry.status}</span>
      )}
    </div>
  )
}

function PrescriptionCard({ entry }) {
  return (
    <div>
      <div className="font-semibold text-gray-800 text-sm">Prescription</div>
      {(entry.doctor_name || entry.doctor?.full_name) && (
        <div className="text-xs text-gray-500 mt-0.5">Dr. {entry.doctor_name || entry.doctor?.full_name}</div>
      )}
      {entry.diagnosis && <div className="text-xs text-gray-600 mt-1">Diagnosis: {entry.diagnosis}</div>}
      {entry.items?.length > 0 && (
        <div className="text-xs text-gray-500 mt-1">{entry.items.length} medicine(s) prescribed</div>
      )}
      {entry.status && (
        <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">{entry.status}</span>
      )}
    </div>
  )
}

function LabCard({ entry }) {
  return (
    <div>
      <div className="font-semibold text-gray-800 text-sm">{entry.test_name || 'Lab Test'}</div>
      {(entry.doctor_name || entry.doctor?.full_name) && (
        <div className="text-xs text-gray-500 mt-0.5">Dr. {entry.doctor_name || entry.doctor?.full_name}</div>
      )}
      {entry.result_summary && <div className="text-xs text-gray-600 mt-1">{entry.result_summary}</div>}
      {entry.status && (
        <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${
          entry.status === 'completed' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
        }`}>{entry.status}</span>
      )}
    </div>
  )
}

function BillCard({ entry }) {
  return (
    <div>
      <div className="font-semibold text-gray-800 text-sm">
        Invoice {entry.id ? `#INV-${String(entry.id).padStart(4, '0')}` : ''}
      </div>
      {(entry.clinic_name || entry.clinic?.name) && (
        <div className="text-xs text-gray-500 mt-0.5">{entry.clinic_name || entry.clinic?.name}</div>
      )}
      {entry.total_amount != null && (
        <div className="text-sm font-bold text-green-700 mt-1">₹{Number(entry.total_amount).toLocaleString('en-IN')}</div>
      )}
      {entry.status && (
        <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${
          entry.status === 'paid' ? 'bg-green-100 text-green-700' :
          entry.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>{entry.status}</span>
      )}
    </div>
  )
}

export default function Timeline() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    Promise.allSettled([
      api.get('/portal/appointments'),
      api.get('/portal/prescriptions'),
      api.get('/portal/lab-results'),
      api.get('/portal/bills'),
    ]).then(results => {
      const [appts, rxs, labs, bills] = results

      const merged = []

      const apptData = appts.status === 'fulfilled' ? (Array.isArray(appts.value) ? appts.value : []) : []
      apptData.forEach(a => merged.push({ ...a, _type: 'appointment' }))

      const rxData = rxs.status === 'fulfilled' ? (Array.isArray(rxs.value) ? rxs.value : []) : []
      rxData.forEach(r => merged.push({ ...r, _type: 'prescription' }))

      const labData = labs.status === 'fulfilled' ? (Array.isArray(labs.value) ? labs.value : []) : []
      labData.forEach(l => merged.push({ ...l, _type: 'lab' }))

      const billData = bills.status === 'fulfilled' ? (Array.isArray(bills.value) ? bills.value : []) : []
      billData.forEach(b => merged.push({ ...b, _type: 'bill' }))

      merged.sort((a, b) => {
        const da = new Date(getDate(a) || 0).getTime()
        const db = new Date(getDate(b) || 0).getTime()
        return db - da
      })

      setEntries(merged)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? entries : entries.filter(e => e._type === filter)

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={32} className="animate-spin text-gray-400" />
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">My Health Timeline</h1>
        <p className="text-sm text-gray-500 mt-1">Your complete health history in chronological order</p>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
              filter === f.key
                ? 'text-white border-transparent'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            style={filter === f.key ? { background: '#0F2557', borderColor: '#0F2557' } : {}}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Clock size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No entries found</p>
          <p className="text-xs text-gray-400 mt-1">Your health activities will appear here</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-gray-200 left-5" />

          <div className="space-y-4">
            {filtered.map((entry, idx) => {
              const cfg = TYPE_CONFIG[entry._type] || TYPE_CONFIG.appointment
              const Icon = cfg.icon
              const dateStr = getDate(entry)
              const dateDisplay = dateStr
                ? new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'

              return (
                <div key={`${entry._type}-${entry.id}-${idx}`} className="flex gap-4 relative">
                  {/* Dot */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 border-white shadow-sm"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    <Icon size={18} />
                  </div>

                  {/* Card */}
                  <div
                    className="flex-1 rounded-xl p-4 border shadow-sm"
                    style={{ background: cfg.bg, borderColor: cfg.border }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span
                        className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{ background: cfg.color + '20', color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{dateDisplay}</span>
                    </div>
                    {entry._type === 'appointment' && <AppointmentCard entry={entry} />}
                    {entry._type === 'prescription' && <PrescriptionCard entry={entry} />}
                    {entry._type === 'lab' && <LabCard entry={entry} />}
                    {entry._type === 'bill' && <BillCard entry={entry} />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
