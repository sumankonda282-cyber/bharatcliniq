import { useState, useEffect } from 'react'
import api from '../api/client'
import { CalendarDays, Users, CreditCard, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ color: '#0F2557' }}>{value ?? '—'}</div>
        <div className="text-xs text-gray-500 font-medium">{label}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [appts, setAppts] = useState([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    api.get('/appointments', { params: { appointment_date: today, limit: 100 } })
      .then(r => setAppts(Array.isArray(r) ? r : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [today])

  const waiting   = appts.filter(a => a.status === 'scheduled' || a.status === 'waiting').length
  const completed = appts.filter(a => a.status === 'completed').length
  const cancelled = appts.filter(a => a.status === 'cancelled').length

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Staff Dashboard</h1><span className="text-sm text-gray-500">{new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}</span></div>
      {loading ? <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-400" /></div> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={CalendarDays} label="Total Today"   value={appts.length} color="#0F2557" />
            <StatCard icon={Clock}        label="Waiting"       value={waiting}      color="#F5821E" />
            <StatCard icon={CheckCircle}  label="Completed"     value={completed}    color="#16A34A" />
            <StatCard icon={XCircle}      label="Cancelled"     value={cancelled}    color="#CC1414" />
          </div>
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-700">Today's Schedule</div>
            {appts.length === 0 ? (
              <div className="p-10 text-center text-gray-400"><CalendarDays size={32} className="mx-auto mb-2 opacity-30" /><p>No appointments today</p></div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th className="th">Token</th><th className="th">Patient</th><th className="th">Doctor</th><th className="th">Time</th><th className="th">Status</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {appts.map(a => (
                      <tr key={a.id} className="tr-hover">
                        <td className="td font-bold text-center" style={{ color: '#0F2557' }}>#{a.token_number || a.id}</td>
                        <td className="td font-medium">{a.patient_name || '—'}</td>
                        <td className="td text-gray-500">{a.doctor_name || '—'}</td>
                        <td className="td">{a.appointment_time ? new Date('1970-01-01T' + a.appointment_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td className="td">
                          <span className={`badge ${a.status === 'completed' ? 'badge-green' : a.status === 'cancelled' ? 'badge-red' : a.status === 'in_progress' ? 'badge-purple' : 'badge-yellow'}`}>{a.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
