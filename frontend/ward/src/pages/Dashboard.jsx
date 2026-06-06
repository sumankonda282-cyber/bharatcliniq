import { useEffect, useState } from 'react'
import { BedDouble, Activity, Pill, ArrowLeftRight, Loader2, Clock, User } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'

function timeAgo(dateStr) {
  if (!dateStr) return null
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000 / 60 // minutes
  if (diff < 60) return `${Math.round(diff)}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return `${Math.round(diff / 1440)}d ago`
}

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ color: '#0F2557' }}>{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/inpatient/admissions?status=active')
      .then(data => setAdmissions(Array.isArray(data) ? data : (data.items || data.results || [])))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const vitalsDue = admissions.filter(a => {
    if (!a.last_vital_at) return true
    const diffH = (Date.now() - new Date(a.last_vital_at).getTime()) / 1000 / 3600
    return diffH > 4
  }).length

  // Current shift
  const h = new Date().getHours()
  const shiftName = h >= 6 && h < 14 ? 'Morning' : h >= 14 && h < 22 ? 'Afternoon' : 'Night'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ward Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Welcome back, {user?.full_name || 'Nurse'} · {shiftName} Shift
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={BedDouble}
              label="Active Admissions"
              value={admissions.length}
              color="#065F46"
            />
            <StatCard
              icon={Activity}
              label="Vitals Due"
              value={vitalsDue}
              color={vitalsDue > 0 ? '#CC1414' : '#16A34A'}
              sub="> 4h since last charting"
            />
            <StatCard
              icon={Pill}
              label="MAR Status"
              value="—"
              color="#d97706"
              sub="Check MAR tab"
            />
            <StatCard
              icon={ArrowLeftRight}
              label="Shift Handoff"
              value={shiftName}
              color="#6366f1"
              sub="Handoff tab for notes"
            />
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Today's Active Admissions</h2>
              <span className="badge-green">{admissions.length} patients</span>
            </div>
            {admissions.length === 0 ? (
              <div className="empty-state">
                <User size={32} className="empty-state-icon" />
                <span className="empty-state-text">No active admissions</span>
              </div>
            ) : (
              <div className="table-wrapper rounded-none">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th">Patient</th>
                      <th className="th">Admission #</th>
                      <th className="th">Ward / Bed</th>
                      <th className="th">Diagnosis</th>
                      <th className="th">Last Vitals</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-50">
                    {admissions.map(a => {
                      const name = a.patient?.full_name || a.patient_name || 'Unknown'
                      const admNo = a.admission_number || `#${a.id}`
                      const ward = a.ward?.name || a.ward_name || '—'
                      const bed = a.bed?.bed_number || a.bed_number || '—'
                      const diag = a.diagnosis || a.primary_diagnosis || '—'
                      const ago = timeAgo(a.last_vital_at)
                      const overdue = !a.last_vital_at ||
                        (Date.now() - new Date(a.last_vital_at).getTime()) / 1000 / 3600 > 4
                      return (
                        <tr key={a.id} className="tr-hover">
                          <td className="td font-medium text-gray-900">{name}</td>
                          <td className="td text-gray-500">{admNo}</td>
                          <td className="td">{ward} / {bed}</td>
                          <td className="td text-gray-500 max-w-xs truncate">{diag}</td>
                          <td className="td">
                            {ago ? (
                              <span className={`inline-flex items-center gap-1 text-xs font-medium ${overdue ? 'text-red-600' : 'text-green-700'}`}>
                                <Clock size={11} />{ago}
                              </span>
                            ) : (
                              <span className="text-xs text-red-500 font-medium">Never charted</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
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
