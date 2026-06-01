import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { RefreshCw, Loader2, ClipboardList } from 'lucide-react'

const STATUS_ORDER = { waiting: 0, scheduled: 1, in_progress: 2, completed: 3, cancelled: 4 }

export default function Queue() {
  const [appts, setAppts] = useState([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(() => {
    setLoading(true)
    api.get('/appointments', { params: { appointment_date: today, limit: 200 } })
      .then(r => setAppts(Array.isArray(r) ? r.sort((a, b) => (STATUS_ORDER[a.status] || 0) - (STATUS_ORDER[b.status] || 0)) : []))
      .finally(() => setLoading(false))
  }, [today])

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])

  const active = appts.filter(a => ['scheduled','waiting','in_progress'].includes(a.status))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Live Queue</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Auto-refreshes every 30s</span>
          <button onClick={load} className="btn-secondary"><RefreshCw size={15} /></button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-400" /></div> : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card p-4 text-center border-l-4" style={{ borderColor: '#F5821E' }}><div className="text-3xl font-bold" style={{ color: '#F5821E' }}>{appts.filter(a => a.status === 'waiting').length}</div><div className="text-xs text-gray-500 mt-1">Waiting</div></div>
            <div className="card p-4 text-center border-l-4" style={{ borderColor: '#7C3AED' }}><div className="text-3xl font-bold" style={{ color: '#7C3AED' }}>{appts.filter(a => a.status === 'in_progress').length}</div><div className="text-xs text-gray-500 mt-1">In Consultation</div></div>
            <div className="card p-4 text-center border-l-4" style={{ borderColor: '#16A34A' }}><div className="text-3xl font-bold" style={{ color: '#16A34A' }}>{appts.filter(a => a.status === 'completed').length}</div><div className="text-xs text-gray-500 mt-1">Completed</div></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.length === 0 ? <div className="col-span-3 p-10 text-center text-gray-400 card"><ClipboardList size={32} className="mx-auto mb-2 opacity-30" /><p>Queue is empty</p></div>
             : active.map(a => (
              <div key={a.id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl font-extrabold" style={{ color: '#0F2557' }}>#{a.token_number || a.id}</span>
                  <span className={`badge ${a.status === 'in_progress' ? 'badge-purple' : a.status === 'waiting' ? 'badge-yellow' : 'badge-blue'}`}>{a.status?.replace('_',' ')}</span>
                </div>
                <div className="font-semibold text-gray-800">{a.patient_name || '—'}</div>
                <div className="text-sm text-gray-500">{a.doctor_name || '—'}</div>
                <div className="text-xs text-gray-400 mt-1">{a.appointment_time || ''}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
