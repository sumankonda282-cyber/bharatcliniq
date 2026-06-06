import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { Bed, Pill, ListOrdered, Clock } from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/inpatient/admissions', { params: { status: 'active' } })
      .then(d => setAdmissions(Array.isArray(d) ? d : d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-emerald-900">{greeting}, {user?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500">{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'MAR', desc: 'Medication administration', icon: Pill,         color: 'bg-emerald-50 border-emerald-200 text-emerald-800', path: '/mar' },
          { label: 'Orders', desc: 'Active clinical orders',   icon: ListOrdered,  color: 'bg-blue-50 border-blue-200 text-blue-800',     path: '/orders' },
        ].map(({ label, desc, icon: Icon, color, path }) => (
          <button key={label} onClick={() => navigate(path)}
            className={`border rounded-xl p-4 text-left hover:shadow-sm transition-all ${color}`}>
            <Icon size={20} className="mb-1.5" />
            <div className="font-semibold">{label}</div>
            <div className="text-xs opacity-70">{desc}</div>
          </button>
        ))}
      </div>

      {/* Active admissions */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
          <Bed size={15} /> Active Patients ({admissions.length})
        </h2>
        {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
          <div className="space-y-2">
            {admissions.slice(0, 10).map(a => {
              const p = a.patient || {}
              return (
                <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
                    {p.full_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{p.full_name}</div>
                    <div className="text-xs text-gray-500">{a.ward?.name || '—'} · Bed {a.bed?.bed_number || '—'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
