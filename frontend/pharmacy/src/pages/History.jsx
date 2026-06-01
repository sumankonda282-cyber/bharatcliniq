import { useState, useEffect, useMemo } from 'react'
import api from '../api/client'
import { History as HistoryIcon, Search, ChevronDown, ChevronUp, Loader2, FileText } from 'lucide-react'

const TABS = ['All', 'Dispensed', 'Pending', 'Cancelled']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function History() {
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('All')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    api.get('/pharmacy/all')
      .then(r => setPrescriptions(Array.isArray(r) ? r : []))
      .catch(ex => setError(ex.message || 'Failed to load history'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const today = todayStr()

  const todayRx = useMemo(() =>
    prescriptions.filter(rx => rx.created_at && rx.created_at.slice(0, 10) === today),
    [prescriptions, today]
  )
  const dispensedToday = todayRx.filter(rx => rx.status === 'dispensed').length
  const pendingCount = prescriptions.filter(rx => rx.status === 'pending').length

  const filtered = useMemo(() => {
    let list = prescriptions
    if (tab !== 'All') list = list.filter(rx => rx.status?.toLowerCase() === tab.toLowerCase())
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      list = list.filter(rx => (rx.patient?.full_name || '').toLowerCase().includes(q))
    }
    if (fromDate) list = list.filter(rx => rx.created_at && rx.created_at.slice(0, 10) >= fromDate)
    if (toDate) list = list.filter(rx => rx.created_at && rx.created_at.slice(0, 10) <= toDate)
    return list
  }, [prescriptions, tab, debouncedSearch, fromDate, toDate])

  function statusBadge(status) {
    const s = (status || '').toLowerCase()
    if (s === 'dispensed') return 'badge badge-green'
    if (s === 'pending') return 'badge badge-yellow'
    if (s === 'cancelled') return 'badge badge-red'
    return 'badge badge-gray'
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dispensing History</h1>
        <span className="text-sm text-gray-500">Print this page for records</span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0F255718' }}>
            <HistoryIcon size={18} style={{ color: '#0F2557' }} />
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: '#0F2557' }}>{todayRx.length}</div>
            <div className="text-xs text-gray-500">Total Today</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#16a34a18' }}>
            <FileText size={18} style={{ color: '#16a34a' }} />
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: '#16a34a' }}>{dispensedToday}</div>
            <div className="text-xs text-gray-500">Dispensed Today</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F5821E18' }}>
            <FileText size={18} style={{ color: '#F5821E' }} />
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: '#F5821E' }}>{pendingCount}</div>
            <div className="text-xs text-gray-500">Pending Count</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by patient name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="label">From Date</label>
          <input type="date" className="input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div>
          <label className="label">To Date</label>
          <input type="date" className="input" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        {(fromDate || toDate || search) && (
          <button className="btn-secondary" onClick={() => { setFromDate(''); setToDate(''); setSearch('') }}>
            Clear Filters
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 border border-gray-100 w-fit shadow-sm">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? 'px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all' : 'px-4 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-800 transition-all'}
            style={tab === t ? { background: '#CC1414' } : {}}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={30} className="animate-spin text-gray-400" /></div>
      ) : error ? (
        <div className="card p-10 text-center text-red-500">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-14 text-center text-gray-400">
          <HistoryIcon size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No prescriptions found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Rx #</th>
                  <th className="th">Patient</th>
                  <th className="th">Doctor</th>
                  <th className="th">Items</th>
                  <th className="th">Dispensed By</th>
                  <th className="th">Date / Time</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(rx => (
                  <>
                    <tr
                      key={rx.id}
                      className="tr-hover cursor-pointer"
                      onClick={() => setExpanded(expanded === rx.id ? null : rx.id)}
                    >
                      <td className="td font-mono text-xs text-gray-600">RX-{rx.id}</td>
                      <td className="td font-medium">{rx.patient?.full_name || '—'}</td>
                      <td className="td text-gray-500">{rx.doctor?.full_name || '—'}</td>
                      <td className="td text-center">
                        <span className="badge badge-blue">{rx.items?.length || 0}</span>
                      </td>
                      <td className="td text-gray-500">{rx.dispensed_by?.full_name || rx.dispensed_by_name || '—'}</td>
                      <td className="td text-gray-500 text-xs whitespace-nowrap">
                        {rx.created_at ? new Date(rx.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                      </td>
                      <td className="td">
                        <span className={statusBadge(rx.status)}>{rx.status || '—'}</span>
                      </td>
                    </tr>
                    {expanded === rx.id && (
                      <tr key={`${rx.id}-exp`}>
                        <td colSpan={7} className="td bg-gray-50 px-8 py-4">
                          {rx.diagnosis && (
                            <p className="text-sm text-gray-600 mb-3">
                              <span className="font-medium">Diagnosis:</span> {rx.diagnosis}
                            </p>
                          )}
                          {(rx.items || []).length === 0 ? (
                            <p className="text-sm text-gray-400">No items on this prescription.</p>
                          ) : (
                            <table className="table text-sm w-full">
                              <thead>
                                <tr>
                                  <th className="th">Medicine</th>
                                  <th className="th">Dosage</th>
                                  <th className="th">Frequency</th>
                                  <th className="th">Duration</th>
                                  <th className="th">Qty</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {rx.items.map((item, i) => (
                                  <tr key={i}>
                                    <td className="td font-medium">{item.medicine_name || item.drug_name || '—'}</td>
                                    <td className="td text-gray-500">{item.dosage || '—'}</td>
                                    <td className="td text-gray-500">{item.frequency || '—'}</td>
                                    <td className="td text-gray-500">{item.duration || '—'}</td>
                                    <td className="td text-gray-500">{item.quantity ?? '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
