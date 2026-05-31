import { useState, useEffect } from 'react'
import api from '../api/client'
import { Pill, ChevronDown, ChevronUp } from 'lucide-react'

export default function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api.get('/portal/prescriptions')
      .then(r => setPrescriptions(r.data?.prescriptions || r.data || []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Prescriptions</h1>
      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading…</div>
      ) : prescriptions.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <Pill size={36} className="mx-auto mb-2 opacity-30" />
          <p>No prescriptions on record</p>
        </div>
      ) : (
        <div className="space-y-3">
          {prescriptions.map(rx => (
            <div key={rx.id} className="card overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === rx.id ? null : rx.id)}
              >
                <div>
                  <div className="font-semibold text-gray-900">Prescription #{rx.id}</div>
                  <div className="text-sm text-gray-400 mt-0.5">
                    {rx.date} · {rx.items?.length || 0} medicine{rx.items?.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={rx.status === 'dispensed' ? 'badge-green' : 'badge-yellow'}>
                    {rx.status === 'dispensed' ? 'Dispensed' : 'Pending'}
                  </span>
                  {expanded === rx.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {expanded === rx.id && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <div className="space-y-3">
                    {(rx.items || []).map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Pill size={14} className="text-orange-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm text-gray-900">{item.medicine_name || item.medicine}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
                          </div>
                          {item.instructions && (
                            <div className="text-xs text-gray-400 mt-0.5 italic">{item.instructions}</div>
                          )}
                        </div>
                      </div>
                    ))}
                    {rx.notes && <div className="text-xs text-gray-500 italic mt-2">Note: {rx.notes}</div>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
