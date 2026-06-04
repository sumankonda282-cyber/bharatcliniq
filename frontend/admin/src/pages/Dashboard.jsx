import { useState, useEffect } from 'react'
import { adminApi } from '../api'
import { Building2, Clock, CheckCircle, ShieldAlert, XCircle, Users, IndianRupee, TrendingUp, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

function StatCard({ label, value, icon: Icon, color, to }) {
  const colors = {
    navy:    'bg-[#0F2557]/10 text-[#0F2557]',
    indigo:  'bg-[#0F2557]/10 text-[#0F2557]',
    emerald: 'bg-green-500/10 text-green-500',
    amber:   'bg-[#F5821E]/10 text-[#F5821E]',
    red:     'bg-[#CC1414]/10 text-[#CC1414]',
    blue:    'bg-[#0F2557]/10 text-[#0F2557]',
    purple:  'bg-[#0F2557]/10 text-[#0F2557]',
  }
  const card = (
    <div className="card-p flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color] || colors.indigo}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-extrabold text-white">{value ?? '—'}</div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      </div>
    </div>
  )
  return to ? <Link to={to}>{card}</Link> : card
}

export default function Dashboard() {
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getDashboard()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2557', borderTopColor: 'transparent' }} />
    </div>
  )

  if (!data) return <p className="text-gray-500">Failed to load dashboard.</p>

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Platform overview — {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Platform Pulse */}
      <div className="mb-6">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Platform Pulse</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700/50">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1">Total OPD Today</div>
            <div className="text-3xl font-extrabold text-white">{data.opd_today ?? data.appointments_today ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-1">Appointments across all clinics</div>
          </div>
          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700/50">
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Active Clinics</div>
            <div className="text-3xl font-extrabold text-white">{data.active_clinics ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-1">With active subscription</div>
          </div>
          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700/50">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#0F2557' }}>Total Patients</div>
            <div className="text-3xl font-extrabold text-white">{data.total_patients ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-1">Registered on platform</div>
          </div>
          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700/50">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#F5821E' }}>Revenue This Month</div>
            <div className="text-3xl font-extrabold text-white">₹{data.mrr?.toLocaleString('en-IN') ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-1">Platform MRR</div>
          </div>
        </div>
      </div>

      {/* MRR Banner */}
      <div className="rounded-2xl p-5 mb-6 flex items-center justify-between" style={{ background: 'rgba(245,130,30,0.1)', border: '1px solid rgba(245,130,30,0.3)' }}>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#F5821E' }}>Estimated Monthly Revenue</div>
          <div className="text-3xl font-extrabold text-white">₹{data.mrr?.toLocaleString('en-IN')}</div>
          <div className="text-xs text-gray-500 mt-1">Based on active doctors × plan rate</div>
        </div>
        <IndianRupee size={40} style={{ color: 'rgba(245,130,30,0.3)' }} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clinics"      value={data.total_clinics}    icon={Building2}    color="navy" to="/clinics" />
        <StatCard label="Active"             value={data.active_clinics}   icon={CheckCircle}  color="emerald" to="/clinics?status=active" />
        <StatCard label="Pending Approval"   value={data.pending_clinics}  icon={Clock}        color="amber" to="/pending" />
        <StatCard label="Suspended/Revoked"  value={(data.suspended_clinics || 0) + (data.revoked_clinics || 0)} icon={ShieldAlert} color="red" to="/clinics?status=suspended" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Doctors"     value={data.total_doctors}    icon={Users}        color="navy" />
        <StatCard label="Total Patients"     value={data.total_patients}   icon={Users}        color="navy" />
        <StatCard label="Staff Pending Verification" value={data.pending_staff} icon={ShieldCheck} color="amber" to="/staff" />
        <StatCard label="New This Month"     value={data.new_this_month}   icon={TrendingUp}   color="emerald" />
      </div>

      {/* Rate Card */}
      <div className="card-p">
        <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Rate Card</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data.rate_card || {}).map(([plan, info]) => (
            <div key={plan} className="bg-gray-800 rounded-xl p-3">
              <div className="text-xs font-semibold text-gray-400 uppercase mb-1">{plan}</div>
              <div className="text-lg font-extrabold text-white">
                {info.price_per_doctor === 0 ? 'Free' : `₹${info.price_per_doctor}`}
              </div>
              {info.price_per_doctor > 0 && <div className="text-xs text-gray-500">per doctor / month</div>}
              <div className="text-xs text-gray-500 mt-1">Max {info.max_doctors >= 999 ? 'Unlimited' : info.max_doctors} doctors</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
