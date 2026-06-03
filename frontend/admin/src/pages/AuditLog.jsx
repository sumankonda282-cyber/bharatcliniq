import { useState, useEffect } from 'react'
import { adminApi } from '../api'
import { Search, Download, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'

// ── Action badge config ────────────────────────────────────────────
const ACTION_META = {
  // existing platform actions
  approved_clinic:    { label: 'Approved Clinic',    badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  rejected_clinic:    { label: 'Rejected Clinic',    badge: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  suspended_clinic:   { label: 'Suspended Clinic',   badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  revoked_clinic:     { label: 'Revoked Clinic',     badge: 'bg-red-600/20 text-red-500 border border-red-600/30' },
  reactivated_clinic: { label: 'Reactivated Clinic', badge: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  changed_plan:       { label: 'Changed Plan',       badge: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
  verified_staff:     { label: 'Verified Staff',     badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  rejected_staff:     { label: 'Rejected Staff',     badge: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  // NABH clinical actions
  login:                { label: 'Login',         badge: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  login_failed:         { label: 'Login Failed',  badge: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  prescription_created: { label: 'Prescription',  badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  lab_order:            { label: 'Lab Order',     badge: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
  vital_entry:          { label: 'Vital Entry',   badge: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' },
  appointment:          { label: 'Appointment',   badge: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' },
  invoice:              { label: 'Invoice',       badge: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
}

const ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'login', label: 'Login' },
  { value: 'login_failed', label: 'Login Failed' },
  { value: 'prescription_created', label: 'Prescription' },
  { value: 'lab_order', label: 'Lab Order' },
  { value: 'vital_entry', label: 'Vital Entry' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'approved_clinic', label: 'Approved Clinic' },
  { value: 'rejected_clinic', label: 'Rejected Clinic' },
  { value: 'suspended_clinic', label: 'Suspended Clinic' },
  { value: 'verified_staff', label: 'Verified Staff' },
  { value: 'rejected_staff', label: 'Rejected Staff' },
]

const USER_TYPE_OPTIONS = [
  { value: '', label: 'All Users' },
  { value: 'staff', label: 'Staff' },
  { value: 'patient', label: 'Patient' },
  { value: 'admin', label: 'Admin' },
]

const PAGE_SIZE = 100

function defaultDateRange() {
  const end   = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)
  const fmt = d => d.toISOString().slice(0, 10)
  return { start: fmt(start), end: fmt(end) }
}

function ActionBadge({ action }) {
  const meta = ACTION_META[action] || { label: action, badge: 'bg-gray-700 text-gray-400 border border-gray-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${meta.badge}`}>
      {meta.label}
    </span>
  )
}

export default function AuditLog() {
  const range = defaultDateRange()
  const [logs, setLogs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [startDate, setStartDate] = useState(range.start)
  const [endDate, setEndDate]     = useState(range.end)
  const [userType, setUserType]   = useState('')
  const [action, setAction]       = useState('')
  const [search, setSearch]       = useState('')
  const [offset, setOffset]       = useState(0)
  const [hasMore, setHasMore]     = useState(false)
  const [nabh30, setNabh30]       = useState(null)

  const load = async (newOffset = 0) => {
    setLoading(true)
    const params = { limit: PAGE_SIZE, offset: newOffset }
    if (startDate) params.start_date = startDate
    if (endDate)   params.end_date   = endDate
    if (userType)  params.user_type  = userType
    if (action)    params.action     = action
    if (search)    params.search     = search
    try {
      const data = await adminApi.getAuditLog(params)
      const arr  = Array.isArray(data) ? data : data?.logs ?? []
      setLogs(arr)
      setHasMore(arr.length === PAGE_SIZE)
      setOffset(newOffset)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const loadNabh30 = async () => {
    const end   = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    const fmt = d => d.toISOString().slice(0, 10)
    try {
      const data = await adminApi.getAuditLog({ limit: 500, start_date: fmt(start), end_date: fmt(end) })
      const arr  = Array.isArray(data) ? data : data?.logs ?? []
      const uniqueUsers = [...new Set(arr.map(l => l.user_id || l.admin_id).filter(Boolean))].length
      const staffActions = arr.filter(l =>
        (l.user_type || '').toLowerCase() === 'staff' || l.admin_name
      )
      const mostActive = staffActions.reduce((acc, l) => {
        const key = l.admin_name || l.user_id || 'Unknown'
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {})
      const topEntry = Object.entries(mostActive).sort((a, b) => b[1] - a[1]).slice(0, 1)[0]
      setNabh30({
        total: arr.length,
        uniqueUsers,
        topStaff: topEntry ? `${topEntry[0]} (${topEntry[1]} actions)` : '—',
      })
    } catch {
      setNabh30({ total: 0, uniqueUsers: 0, topStaff: '—' })
    }
  }

  useEffect(() => { load(0); loadNabh30() }, [])

  // Client-side text filter on loaded page
  const filteredLogs = search
    ? logs.filter(l => {
        const q = search.toLowerCase()
        return (
          (l.action || '').toLowerCase().includes(q) ||
          (l.entity_type || '').toLowerCase().includes(q) ||
          (l.target_type || '').toLowerCase().includes(q) ||
          String(l.target_name || l.entity_id || '').toLowerCase().includes(q) ||
          String(l.admin_name || l.user_id || '').toLowerCase().includes(q) ||
          JSON.stringify(l.details || {}).toLowerCase().includes(q)
        )
      })
    : logs

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #audit-print-area, #audit-print-area * { visibility: visible; }
          #audit-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-header { display: block !important; }
          table { font-size: 10px; }
          th, td { padding: 4px 6px !important; }
        }
        .print-header { display: none; }
      `}</style>

      <div>
        {/* Header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title">Audit Trail</h1>
            <p className="text-gray-500 text-sm mt-1">NABH-compliant log of all system actions</p>
          </div>
          <button onClick={() => window.print()} className="btn-primary no-print flex items-center gap-2">
            <Download size={15} />
            Export PDF
          </button>
        </div>

        {/* Filters */}
        <div className="card-p mb-4 flex flex-wrap gap-3 items-end no-print">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
            <input type="date" className="input w-40 py-1.5 text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">End Date</label>
            <input type="date" className="input w-40 py-1.5 text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">User Type</label>
            <select className="input w-36 py-1.5 text-sm" value={userType} onChange={e => setUserType(e.target.value)}>
              {USER_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Action Type</label>
            <select className="input w-52 py-1.5 text-sm" value={action} onChange={e => setAction(e.target.value)}>
              {ACTION_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="text-xs text-gray-500 mb-1 block">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search logs..."
                className="input py-1.5 text-sm pl-8 w-full"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && load(0)}
              />
            </div>
          </div>
          <button onClick={() => load(0)} className="btn-primary py-1.5">
            <Search size={14} />Filter
          </button>
        </div>

        {/* Print-only header */}
        <div className="print-header mb-4">
          <h2 style={{ fontSize: 18, fontWeight: 'bold' }}>BharatCliniq — Audit Trail Report</h2>
          <p style={{ fontSize: 12 }}>Period: {startDate} to {endDate}{action ? ` | Action: ${action}` : ''}{userType ? ` | User: ${userType}` : ''}</p>
          <p style={{ fontSize: 11, color: '#666' }}>Generated: {new Date().toLocaleString('en-IN')}</p>
        </div>

        {/* Table */}
        <div id="audit-print-area">
          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-7 h-7 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No audit records found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th">Timestamp</th>
                      <th className="th">User</th>
                      <th className="th">User Type</th>
                      <th className="th">Action</th>
                      <th className="th">Entity</th>
                      <th className="th">Details</th>
                      <th className="th">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredLogs.map(l => (
                      <tr key={l.id} className="tr-hover">
                        <td className="td text-xs text-gray-400 whitespace-nowrap font-mono">
                          {new Date(l.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="td">
                          <div className="text-white text-sm">{l.admin_name || l.user_id || '—'}</div>
                          {l.user_id && l.admin_name && (
                            <div className="text-xs text-gray-500">ID: {l.user_id}</div>
                          )}
                        </td>
                        <td className="td">
                          <span className="text-xs capitalize text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                            {l.user_type || 'admin'}
                          </span>
                        </td>
                        <td className="td">
                          <ActionBadge action={l.action} />
                        </td>
                        <td className="td">
                          <div className="text-white text-sm">{l.target_name || l.entity_id || '—'}</div>
                          <div className="text-xs text-gray-500 capitalize">
                            {l.entity_type || l.target_type || ''}
                          </div>
                        </td>
                        <td className="td max-w-xs">
                          {l.reason && <div className="text-sm text-gray-300">{l.reason.replace(/_/g, ' ')}</div>}
                          {l.comment && <div className="text-xs text-gray-500">{l.comment}</div>}
                          {l.details && typeof l.details === 'object' && Object.keys(l.details).length > 0 && (
                            <div className="text-xs text-gray-500 truncate max-w-48" title={JSON.stringify(l.details)}>
                              {Object.entries(l.details).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(', ')}
                            </div>
                          )}
                          {!l.reason && !l.comment && (!l.details || Object.keys(l.details || {}).length === 0) && (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="td text-xs text-gray-500 font-mono">
                          {l.ip_address || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {!loading && (filteredLogs.length > 0 || offset > 0) && (
          <div className="flex items-center justify-between mt-3 no-print">
            <span className="text-sm text-gray-500">
              Showing {offset + 1}–{offset + filteredLogs.length}{hasMore ? '+' : ''}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0 || loading}
                className="btn-secondary py-1.5 px-3 disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft size={15} />Prev
              </button>
              <button
                onClick={() => load(offset + PAGE_SIZE)}
                disabled={!hasMore || loading}
                className="btn-secondary py-1.5 px-3 disabled:opacity-40 flex items-center gap-1"
              >
                Next<ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* NABH Compliance Section */}
        <div className="mt-8 card p-5 no-print">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={18} className="text-emerald-400" />
            <h2 className="font-bold text-white">NABH Compliance Status</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Compliance checks */}
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                Active Controls
              </div>
              <div className="space-y-2">
                {[
                  'Audit logging enabled',
                  'User authentication required',
                  'Access control by role',
                  'Data encrypted in transit (HTTPS)',
                  'Session management enforced',
                  'IP address tracking active',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2.5 text-sm">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                      ✓
                    </span>
                    <span className="text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 30-day summary */}
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                Last 30 Days Summary
              </div>
              {nabh30 === null ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  Loading...
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-800/60 rounded-xl">
                    <span className="text-gray-400 text-sm">Total Actions Logged</span>
                    <span className="text-white font-bold text-lg">{nabh30.total.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/60 rounded-xl">
                    <span className="text-gray-400 text-sm">Unique Users Active</span>
                    <span className="text-white font-bold text-lg">{nabh30.uniqueUsers}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/60 rounded-xl">
                    <span className="text-gray-400 text-sm">Most Active Staff</span>
                    <span className="text-white font-semibold text-sm text-right max-w-40 truncate">{nabh30.topStaff}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
