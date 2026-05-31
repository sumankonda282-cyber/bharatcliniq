import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api/client'
import { Activity, Calendar, Pill, FlaskConical, Receipt, Heart, User } from 'lucide-react'
import { Link } from 'react-router-dom'

const STATUS_COLORS = {
  pending: 'badge-yellow', confirmed: 'badge-blue', completed: 'badge-green',
  cancelled: 'badge-gray', in_progress: 'badge-blue',
}

export default function Dashboard() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/portal/appointments'),
      api.get('/portal/prescriptions'),
    ]).then(([a, p]) => {
      setAppointments((a.data?.appointments || a.data || []).slice(0, 5))
      setPrescriptions((p.data?.prescriptions || p.data || []).slice(0, 3))
    }).finally(() => setLoading(false))
  }, [])

  const pendingRx = prescriptions.filter(p => p.status === 'pending').length

  return (
    <div className="max-w-4xl">
      {/* BHID Health Card */}
      <div className="rounded-2xl p-6 mb-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 50%, #134e4a 100%)' }}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Activity size={20} />
              <span className="font-bold text-sm tracking-wider">BHARATCLINIQ</span>
            </div>
            <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-xs">
              <Heart size={12} />
              Digital Health Card
            </div>
          </div>

          <div className="mb-4">
            <div className="text-teal-200 text-xs mb-1">Patient Name</div>
            <div className="text-2xl font-bold tracking-wide">{user?.full_name}</div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <div className="text-teal-200 text-xs mb-1">BHID / Health ID</div>
              <div className="font-mono text-lg font-bold tracking-widest">
                {user?.bh_id ? user.bh_id.toUpperCase() : 'BH-XXXXXXXX'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-teal-200 text-xs mb-1">Registered Clinics</div>
              <div className="text-xl font-bold">{user?.linked_clinics || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center"><Calendar size={18} className="text-teal-600" /></div>
          <div><div className="text-xl font-bold">{appointments.length}</div><div className="text-xs text-gray-500">Appointments</div></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center"><Pill size={18} className="text-orange-600" /></div>
          <div><div className="text-xl font-bold">{pendingRx}</div><div className="text-xs text-gray-500">Pending Rx</div></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><User size={18} className="text-blue-600" /></div>
          <div><div className="text-xl font-bold">{user?.linked_clinics || 0}</div><div className="text-xs text-gray-500">Clinics</div></div>
        </div>
      </div>

      {/* Recent Appointments */}
      <div className="card mb-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Appointments</h2>
          <Link to="/appointments" className="text-sm text-teal-600 hover:underline">View all</Link>
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-400">Loading…</div>
        ) : appointments.length === 0 ? (
          <div className="p-8 text-center text-gray-400"><Calendar size={32} className="mx-auto mb-2 opacity-30" /><p>No appointments yet</p></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {appointments.map(a => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="font-medium text-sm">{a.clinic_name}</div>
                  <div className="text-xs text-gray-400">Dr. {a.doctor_name} · {a.date} {a.time}</div>
                </div>
                <span className={STATUS_COLORS[a.status] || 'badge-gray'}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'My Prescriptions', to: '/prescriptions', color: 'bg-orange-500', icon: Pill },
          { label: 'Lab Results',      to: '/lab-results',   color: 'bg-blue-500',   icon: FlaskConical },
          { label: 'My Bills',         to: '/bills',         color: 'bg-purple-500', icon: Receipt },
          { label: 'Appointments',     to: '/appointments',  color: 'bg-teal-600',   icon: Calendar },
        ].map(q => (
          <Link key={q.to} to={q.to}
            className={`${q.color} text-white rounded-xl p-4 flex items-center gap-3 hover:opacity-90 transition-opacity`}>
            <q.icon size={20} />
            <span className="font-medium text-sm">{q.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
