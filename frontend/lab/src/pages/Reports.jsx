import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { Loader2, AlertCircle, BarChart2, ChevronDown, ChevronUp, Calendar, Clock, FileText, FlaskConical } from 'lucide-react'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr)
}

function calcTAT(order) {
  if (!order.created_at) return null
  const end = order.completed_at ? new Date(order.completed_at) : (order.updated_at ? new Date(order.updated_at) : null)
  if (!end) return null
  const mins = Math.round((end - new Date(order.created_at)) / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
}

function calcTATMinutes(order) {
  if (!order.created_at) return null
  const end = order.completed_at ? new Date(order.completed_at) : (order.updated_at ? new Date(order.updated_at) : null)
  if (!end) return null
  return Math.round((end - new Date(order.created_at)) / 60000)
}

function formatMinutes(mins) {
  if (mins == null) return 'N/A'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
}

function isOnDate(dateStr, targetDate) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const t = new Date(targetDate)
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

function SectionHeader({ title, icon: Icon, expanded, onToggle, color }) {
  return (
    <button
      onClick={onToggle}
      className="w-full card px-5 py-4 flex items-center justify-between text-left transition-all hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <span className="font-semibold text-gray-800">{title}</span>
      </div>
      {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
    </button>
  )
}

// --- a) Daily Workload ---
function DailyWorkload({ allOrders }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const dayOrders = allOrders.filter(o => isOnDate(o.created_at, date))

  const stats = {
    total: dayOrders.length,
    collected: dayOrders.filter(o => ['sample_collected', 'processing', 'completed'].includes(o.status)).length,
    resultsEntered: dayOrders.filter(o => ['processing', 'completed'].includes(o.status)).length,
    completed: dayOrders.filter(o => o.status === 'completed').length,
    pending: dayOrders.filter(o => o.status === 'pending').length,
  }

  return (
    <div className="px-5 pb-5 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-3 mb-4">
        <input
          type="date"
          className="input w-auto"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        <span className="text-sm text-gray-500">{dayOrders.length} order{dayOrders.length !== 1 ? 's' : ''} on this date</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        {[
          { label: 'Total Orders', value: stats.total, color: '#0F2557' },
          { label: 'Samples Collected', value: stats.collected, color: '#2563EB' },
          { label: 'Results Entered', value: stats.resultsEntered, color: '#7C3AED' },
          { label: 'Completed', value: stats.completed, color: '#16A34A' },
          { label: 'Pending', value: stats.pending, color: '#F5821E' },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {dayOrders.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Order #</th>
                  <th className="th">Patient</th>
                  <th className="th">Tests</th>
                  <th className="th">Status</th>
                  <th className="th">TAT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dayOrders.map(o => (
                  <tr key={o.id} className="tr-hover">
                    <td className="td font-mono text-xs text-gray-500">LAB-{o.id}</td>
                    <td className="td font-medium">{o.patient?.full_name || '—'}</td>
                    <td className="td text-sm">
                      {(o.items || []).map((item, i) => (
                        <span key={i} className="inline-block mr-1 text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                          {item.test?.name || item.test_name || `#${item.id}`}
                        </span>
                      ))}
                    </td>
                    <td className="td">
                      <span className={`badge ${
                        o.status === 'completed' ? 'badge-green' :
                        o.status === 'processing' ? 'badge-purple' :
                        o.status === 'sample_collected' ? 'badge-blue' : 'badge-yellow'
                      }`}>{o.status?.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="td text-xs text-gray-500">{calcTAT(o) || 'In progress'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-gray-400">
          <Calendar size={32} className="mx-auto mb-2" />
          <p>No orders found for this date.</p>
        </div>
      )}
    </div>
  )
}

// --- b) TAT Report ---
function TATReport({ completedOrders }) {
  const tats = completedOrders.map(o => calcTATMinutes(o)).filter(t => t != null)
  const avg = tats.length ? Math.round(tats.reduce((a, b) => a + b, 0) / tats.length) : null
  const min = tats.length ? Math.min(...tats) : null
  const max = tats.length ? Math.max(...tats) : null

  return (
    <div className="px-5 pb-5 pt-3 border-t border-gray-100">
      {completedOrders.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Clock size={32} className="mx-auto mb-2" />
          <p>No completed orders found.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {[
              { label: 'Average TAT', value: formatMinutes(avg), color: '#0F2557' },
              { label: 'Fastest', value: formatMinutes(min), color: '#16A34A' },
              { label: 'Slowest', value: formatMinutes(max), color: '#CC1414' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="card overflow-hidden">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th className="th">Order #</th>
                    <th className="th">Patient</th>
                    <th className="th">Tests</th>
                    <th className="th">Ordered</th>
                    <th className="th">Completed</th>
                    <th className="th">TAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {completedOrders.map(o => (
                    <tr key={o.id} className="tr-hover">
                      <td className="td font-mono text-xs text-gray-500">LAB-{o.id}</td>
                      <td className="td font-medium">{o.patient?.full_name || '—'}</td>
                      <td className="td text-xs text-gray-500">{o.items?.length || 0} tests</td>
                      <td className="td text-xs text-gray-500">{formatDate(o.created_at)}</td>
                      <td className="td text-xs text-gray-500">{formatDate(o.completed_at || o.updated_at)}</td>
                      <td className="td">
                        <span className="font-medium text-sm" style={{ color: '#0F2557' }}>
                          {calcTAT(o) || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// --- c) Pending Reports ---
function PendingReports({ allOrders }) {
  const pendingOrders = allOrders.filter(o => ['processing', 'sample_collected'].includes(o.status))

  function timePending(dateStr) {
    if (!dateStr) return '—'
    const diff = Date.now() - new Date(dateStr).getTime()
    const hrs = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    if (hrs === 0) return `${mins}m`
    if (hrs < 24) return `${hrs}h ${mins}m`
    return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
  }

  // Group by doctor
  const byDoctor = {}
  for (const order of pendingOrders) {
    const doc = order.doctor?.full_name || order.referred_by || 'Unknown'
    if (!byDoctor[doc]) byDoctor[doc] = []
    byDoctor[doc].push(order)
  }

  return (
    <div className="px-5 pb-5 pt-3 border-t border-gray-100">
      {pendingOrders.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <FileText size={32} className="mx-auto mb-2" />
          <p>No pending reports. All done!</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="text-sm text-gray-500 mb-1">
            <span className="font-semibold text-gray-700">{pendingOrders.length}</span> orders pending finalization, grouped by referring doctor
          </div>
          {Object.entries(byDoctor).map(([doctor, orders]) => (
            <div key={doctor}>
              <div className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                Dr. {doctor}
                <span className="badge badge-yellow">{orders.length} pending</span>
              </div>
              <div className="card overflow-hidden">
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="th">Order #</th>
                        <th className="th">Patient</th>
                        <th className="th">Tests</th>
                        <th className="th">Status</th>
                        <th className="th">Pending Since</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orders.map(o => (
                        <tr key={o.id} className="tr-hover">
                          <td className="td font-mono text-xs text-gray-500">LAB-{o.id}</td>
                          <td className="td font-medium">{o.patient?.full_name || '—'}</td>
                          <td className="td text-xs text-gray-500">{o.items?.length || 0} tests</td>
                          <td className="td">
                            <span className={`badge ${o.status === 'processing' ? 'badge-purple' : 'badge-blue'}`}>
                              {o.status?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="td text-xs font-medium" style={{ color: '#F5821E' }}>
                            {timePending(o.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- d) Test-wise Summary ---
function TestSummary({ allOrders, tests }) {
  const testCounts = {}
  for (const order of allOrders) {
    for (const item of (order.items || [])) {
      const name = item.test?.name || item.test_name || `Test #${item.test_id || item.id}`
      testCounts[name] = (testCounts[name] || 0) + 1
    }
  }

  // Merge with test catalog
  const summaryMap = {}
  for (const test of tests) {
    summaryMap[test.name] = { name: test.name, code: test.code, count: testCounts[test.name] || 0 }
  }
  for (const [name, count] of Object.entries(testCounts)) {
    if (!summaryMap[name]) summaryMap[name] = { name, code: null, count }
  }

  const sorted = Object.values(summaryMap).sort((a, b) => b.count - a.count)

  return (
    <div className="px-5 pb-5 pt-3 border-t border-gray-100">
      {sorted.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <FlaskConical size={32} className="mx-auto mb-2" />
          <p>No test data available.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((item, idx) => (
            <div key={item.name} className="flex items-center gap-4 bg-gray-50 rounded-xl px-4 py-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: idx < 3 ? '#0F2557' : '#9CA3AF' }}>
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 truncate">{item.name}</div>
                {item.code && <div className="text-xs text-gray-400 font-mono">{item.code}</div>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="h-2 rounded-full bg-blue-100 w-24 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${sorted[0].count > 0 ? (item.count / sorted[0].count) * 100 : 0}%`,
                      background: '#0F2557'
                    }}
                  />
                </div>
                <span className="badge badge-blue min-w-[40px] text-center">{item.count}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Reports() {
  const [allOrders, setAllOrders] = useState([])
  const [completedOrders, setCompletedOrders] = useState([])
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState({ workload: true, tat: false, pending: false, tests: false })

  const toggle = key => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [ordersRes, completedRes, testsRes] = await Promise.all([
        api.get('/lab/orders', { params: { limit: 500 } }),
        api.get('/lab/orders', { params: { status: 'completed', limit: 100 } }),
        api.get('/lab/tests'),
      ])
      setAllOrders(Array.isArray(ordersRes) ? ordersRes : [])
      setCompletedOrders(Array.isArray(completedRes) ? completedRes : [])
      setTests(Array.isArray(testsRes) ? testsRes : [])
    } catch (err) {
      setError(err.message || 'Failed to load reports data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-400" /></div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <button onClick={fetchData} className="btn-secondary text-sm">Refresh Data</button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-5">
          <AlertCircle size={16} />{error}
        </div>
      )}

      <div className="space-y-4">
        {/* Daily Workload */}
        <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
          <SectionHeader title="Daily Workload Report" icon={Calendar} expanded={expanded.workload} onToggle={() => toggle('workload')} color="#0F2557" />
          {expanded.workload && <DailyWorkload allOrders={allOrders} />}
        </div>

        {/* TAT Report */}
        <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
          <SectionHeader title="Turnaround Time (TAT) Report" icon={Clock} expanded={expanded.tat} onToggle={() => toggle('tat')} color="#7C3AED" />
          {expanded.tat && <TATReport completedOrders={completedOrders} />}
        </div>

        {/* Pending Reports */}
        <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
          <SectionHeader title="Pending Reports" icon={FileText} expanded={expanded.pending} onToggle={() => toggle('pending')} color="#F5821E" />
          {expanded.pending && <PendingReports allOrders={allOrders} />}
        </div>

        {/* Test-wise Summary */}
        <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
          <SectionHeader title="Test-wise Summary" icon={BarChart2} expanded={expanded.tests} onToggle={() => toggle('tests')} color="#CC1414" />
          {expanded.tests && <TestSummary allOrders={allOrders} tests={tests} />}
        </div>
      </div>
    </div>
  )
}
