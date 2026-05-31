import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { appointmentsApi, patientsApi, billingApi } from '../../api'
import StatCard from '../../components/ui/StatCard'
import { PageLoader } from '../../components/ui/Spinner'
import { Calendar, Users, Receipt, Clock, CheckCircle, AlertCircle, TrendingUp, Activity } from 'lucide-react'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'

const STATUS_BADGE = {
  pending:     'badge-yellow',
  confirmed:   'badge-blue',
  in_progress: 'badge-purple',
  completed:   'badge-green',
  cancelled:   'badge-gray',
}

export default function Dashboard() {
  const { user } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [stats, setStats] = useState(null)
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      appointmentsApi.list({ date: today, limit: 20 }),
      patientsApi.list({ limit: 1 }),
      billingApi.getInvoices({ status: 'paid', limit: 1 }),
    ]).then(([appts, pts, bills]) => {
      const a = appts.data || []
      setQueue(a.slice(0, 10))
      setStats({
        todayAppts: a.length,
        waiting: a.filter(x => x.status === 'pending' || x.status === 'confirmed').length,
        completed: a.filter(x => x.status === 'completed').length,
      })
    }).catch(() => setStats({ todayAppts: 0, waiting: 0, completed: 0 }))
      .finally(() => setLoading(false))
  }, [today])

  if (loading) return <PageLoader />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Good morning, {user?.full_name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <Link to="/appointments" className="btn-primary">
          <Calendar size={16} />
          Today's Queue
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Appointments" value={stats?.todayAppts} icon={Calendar} color="blue" />
        <StatCard label="Waiting" value={stats?.waiting} icon={Clock} color="orange" />
        <StatCard label="Completed" value={stats?.completed} icon={CheckCircle} color="green" />
        <StatCard label="Plan" value={user?.clinic_plan?.toUpperCase() || 'FREE'} icon={Activity} color="purple"
          sub={user?.clinic_verified ? '✓ Verified' : '⚠ Pending verification'} />
      </div>

      {/* Today's Queue */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Today's Appointment Queue</h2>
          <Link to="/appointments" className="text-sm text-blue-600 hover:underline">View all</Link>
        </div>
        {queue.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Calendar size={36} className="mx-auto mb-2 opacity-30" />
            <p>No appointments today</p>
            <Link to="/appointments" className="btn-primary mt-4 inline-flex">Add Walk-in</Link>
          </div>
        ) : (
          <div className="table-wrapper rounded-none border-0">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Token</th>
                  <th className="th">Patient</th>
                  <th className="th">Time</th>
                  <th className="th">Doctor</th>
                  <th className="th">Status</th>
                  <th className="th">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {queue.map(appt => (
                  <tr key={appt.id} className="tr-hover">
                    <td className="td font-mono font-bold text-blue-600">#{appt.token_number || appt.id}</td>
                    <td className="td">
                      <div className="font-medium">{appt.patient_name || appt.patient?.full_name}</div>
                      <div className="text-xs text-gray-400">{appt.patient?.mobile}</div>
                    </td>
                    <td className="td font-mono">{appt.appointment_time}</td>
                    <td className="td text-gray-600">{appt.doctor_name || appt.doctor?.staff?.full_name}</td>
                    <td className="td">
                      <span className={STATUS_BADGE[appt.status] || 'badge-gray'}>{appt.status}</span>
                    </td>
                    <td className="td">
                      {appt.status !== 'completed' && (
                        <Link to={`/encounter/${appt.id}`} className="text-blue-600 text-xs hover:underline">
                          Open →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        {[
          { label: 'Register Patient', to: '/patients/new', color: 'bg-blue-600' },
          { label: 'Add Walk-in',      to: '/appointments?walkin=1', color: 'bg-green-600' },
          { label: 'Create Invoice',   to: '/billing?new=1', color: 'bg-purple-600' },
          { label: 'Lab Orders',       to: '/lab', color: 'bg-orange-600' },
        ].map(a => (
          <Link
            key={a.to}
            to={a.to}
            className={`${a.color} text-white rounded-xl p-4 text-sm font-medium hover:opacity-90 transition-opacity text-center`}
          >
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
