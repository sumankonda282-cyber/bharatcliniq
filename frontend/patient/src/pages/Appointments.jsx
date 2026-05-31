import { useState, useEffect } from 'react'
import api from '../api/client'
import { Calendar, Stethoscope } from 'lucide-react'

const S = { pending:'badge-yellow', confirmed:'badge-blue', completed:'badge-green', cancelled:'badge-gray', in_progress:'badge-blue' }

export default function Appointments() {
  const [appts, setAppts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/portal/appointments')
      .then(r => setAppts(r.data?.appointments || r.data || []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Appointments</h1>
      <div className="card">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : appts.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Calendar size={36} className="mx-auto mb-2 opacity-30" />
            <p>No appointments on record</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {appts.map(a => (
              <div key={a.id} className="p-4 flex items-start gap-4">
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Stethoscope size={20} className="text-teal-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-gray-900">{a.clinic_name}</div>
                    <span className={S[a.status] || 'badge-gray'}>{a.status}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">Dr. {a.doctor_name}</div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                    <span>{a.date}</span>
                    <span>{a.time}</span>
                    <span className="capitalize">{a.mode?.replace('_', ' ') || 'Walk-in'}</span>
                    {a.token_number && <span>Token #{a.token_number}</span>}
                  </div>
                  {a.reason && <div className="text-xs text-gray-400 mt-0.5 italic">"{a.reason}"</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
