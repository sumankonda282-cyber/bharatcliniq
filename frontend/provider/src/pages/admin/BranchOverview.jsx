import { useState, useEffect } from 'react'
import { clinicApi, appointmentsApi, billingApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import {
  Building2, Calendar, TrendingUp, Clock, Users,
  Activity, RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'

const today = format(new Date(), 'yyyy-MM-dd')

function SummaryTile({ label, value, icon: Icon, color }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    green:  'bg-green-50 text-green-700 border-green-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  const iconColors = {
    blue:   'text-blue-500',
    green:  'text-green-500',
    orange: 'text-orange-500',
    purple: 'text-purple-500',
  }
  return (
    <div className={`card p-4 border ${colors[color]} flex items-center gap-4`}>
      <div className={`p-2.5 rounded-xl bg-white/70 ${iconColors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-2xl font-bold">{value ?? '—'}</div>
        <div className="text-xs font-medium mt-0.5 opacity-80">{label}</div>
      </div>
    </div>
  )
}

function MiniProgressBar({ completed, total }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Completion</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function StatusPill({ label, count, color }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {count} {label}
    </span>
  )
}

export default function BranchOverview() {
  const [branches, setBranches]     = useState([])
  const [appts, setAppts]           = useState([])
  const [invoices, setInvoices]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const [branchRes, apptRes, invoiceRes] = await Promise.all([
        clinicApi.getBranches(),
        appointmentsApi.list({ appointment_date: today, limit: 500 }),
        billingApi.getInvoices({ limit: 200 }),
      ])
      setBranches(Array.isArray(branchRes) ? branchRes : branchRes?.branches ?? [])
      setAppts(Array.isArray(apptRes) ? apptRes : apptRes?.appointments ?? [])
      setInvoices(Array.isArray(invoiceRes) ? invoiceRes : invoiceRes?.invoices ?? [])
    } catch {
      setError('Failed to load branch data. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <PageLoader />

  // Per-branch stats
  const branchStats = branches.map(branch => {
    const bAppts = appts.filter(a =>
      a.branch_id === branch.id || a.branch?.id === branch.id
    )
    const bInvoices = invoices.filter(inv =>
      (inv.branch_id === branch.id || inv.branch?.id === branch.id) &&
      inv.status === 'paid' &&
      (inv.created_at || '').startsWith(today)
    )
    const revenue    = bInvoices.reduce((s, inv) => s + parseFloat(inv.total_amount || 0), 0)
    const waiting    = bAppts.filter(a => a.status === 'pending' || a.status === 'confirmed').length
    const inProgress = bAppts.filter(a => a.status === 'in_progress').length
    const completed  = bAppts.filter(a => a.status === 'completed').length
    const cancelled  = bAppts.filter(a => a.status === 'cancelled').length
    const pendingRx  = bAppts.filter(a => a.prescription_status === 'pending').length
    return { branch, bAppts, revenue, waiting, inProgress, completed, cancelled, pendingRx }
  })

  // Summary ribbon
  const totalAppts   = appts.length
  const totalRevenue = invoices
    .filter(inv => inv.status === 'paid' && (inv.created_at || '').startsWith(today))
    .reduce((s, inv) => s + parseFloat(inv.total_amount || 0), 0)
  const pendingBills  = invoices.filter(inv => inv.status === 'pending').length
  const activeDoctors = [...new Set(
    appts.filter(a => a.status !== 'cancelled').map(a => a.doctor_id || a.doctor?.id).filter(Boolean)
  )].length

  // Combined totals
  const combinedWaiting    = branchStats.reduce((s, b) => s + b.waiting, 0)
  const combinedInProgress = branchStats.reduce((s, b) => s + b.inProgress, 0)
  const combinedCompleted  = branchStats.reduce((s, b) => s + b.completed, 0)
  const combinedCancelled  = branchStats.reduce((s, b) => s + b.cancelled, 0)
  const combinedRevenue    = branchStats.reduce((s, b) => s + b.revenue, 0)
  const combinedPendingRx  = branchStats.reduce((s, b) => s + b.pendingRx, 0)

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Branch Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(), 'EEEE, MMMM d, yyyy')} &bull; {branches.length} branch{branches.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Summary Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryTile label="Total OPD Today"     value={totalAppts}   icon={Calendar}   color="blue"   />
        <SummaryTile label="Total Revenue Today" value={`₹${totalRevenue.toLocaleString('en-IN')}`} icon={TrendingUp} color="green" />
        <SummaryTile label="Pending Bills"       value={pendingBills} icon={Clock}      color="orange" />
        <SummaryTile label="Active Doctors"      value={activeDoctors} icon={Users}     color="purple" />
      </div>

      {/* Branch Cards */}
      {branches.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>No branches found. Add branches in Clinic Admin settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {branchStats.map(({ branch, bAppts, revenue, waiting, inProgress, completed, cancelled, pendingRx }) => (
            <div key={branch.id} className="card p-5 hover:shadow-md transition-shadow">
              {/* Branch header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex-shrink-0">
                  <Building2 size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{branch.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{branch.city || branch.address || 'No location'}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  branch.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {branch.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Status pills */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                <StatusPill label="Waiting"     count={waiting}    color="bg-yellow-100 text-yellow-700" />
                <StatusPill label="In Progress" count={inProgress} color="bg-purple-100 text-purple-700" />
                <StatusPill label="Completed"   count={completed}  color="bg-green-100 text-green-700"  />
                <StatusPill label="Cancelled"   count={cancelled}  color="bg-gray-100 text-gray-500"    />
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <MiniProgressBar completed={completed} total={bAppts.length} />
              </div>

              {/* Revenue + pending Rx */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                <div>
                  <div className="text-xs text-gray-500">Revenue Today</div>
                  <div className="text-base font-bold text-green-700 mt-0.5">
                    ₹{revenue.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Pending Prescriptions</div>
                  <div className={`text-base font-bold mt-0.5 ${pendingRx > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                    {pendingRx}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Branches Combined */}
      {branches.length > 0 && (
        <div className="card p-5 border-2 border-blue-200 bg-blue-50/30">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-blue-600" />
            <h2 className="font-bold text-gray-900">All Branches Combined</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Appointments', value: totalAppts,        color: 'text-gray-900' },
              { label: 'Waiting',            value: combinedWaiting,    color: 'text-yellow-700' },
              { label: 'In Progress',        value: combinedInProgress, color: 'text-purple-700' },
              { label: 'Completed',          value: combinedCompleted,  color: 'text-green-700' },
              { label: 'Cancelled',          value: combinedCancelled,  color: 'text-gray-500' },
              { label: 'Revenue Today',      value: `₹${combinedRevenue.toLocaleString('en-IN')}`, color: 'text-green-700' },
            ].map(item => (
              <div key={item.label} className="text-center">
                <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
          {combinedPendingRx > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200 text-sm text-orange-700 font-medium">
              {combinedPendingRx} pending prescription{combinedPendingRx !== 1 ? 's' : ''} across all branches
            </div>
          )}
        </div>
      )}
    </div>
  )
}
