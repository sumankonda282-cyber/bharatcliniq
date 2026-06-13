import { useState, useEffect, useMemo } from 'react'
import api from '../api/client'
import { cachedFetch } from '../utils/cache'
import { FlaskConical, ScanLine, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'

const FLAG_COLOR = {
  H: '#CC1414', HH: '#7f1d1d', L: '#1d4ed8', LL: '#1e3a8a',
  N: '#16a34a', A: '#d97706',
}
const FLAG_LABEL = { H: 'High', HH: 'Critical High', L: 'Low', LL: 'Critical Low', N: 'Normal', A: 'Abnormal' }

const MODALITY_COLOR = {
  CT: '#0F2557', MR: '#7c3aed', MRI: '#7c3aed', CR: '#0369a1',
  DX: '#0369a1', US: '#059669', NM: '#b45309', PT: '#dc2626',
  MG: '#be185d', OT: '#6b7280',
}

function StatusBadge({ flag }) {
  if (!flag) {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f3f4f6', color: '#6b7280' }}>
        Pending
      </span>
    )
  }
  const configs = {
    HH: { bg: '#7f1d1d', color: '#fff', label: 'Critical High' },
    H:  { bg: '#fef2f2', color: '#CC1414', label: 'High ↑' },
    LL: { bg: '#1e3a8a', color: '#fff', label: 'Critical Low' },
    L:  { bg: '#eff6ff', color: '#1d4ed8', label: 'Low ↓' },
    N:  { bg: '#f0fdf4', color: '#16a34a', label: 'Normal' },
    A:  { bg: '#fffbeb', color: '#d97706', label: 'Abnormal' },
  }
  const c = configs[flag] || { bg: '#f3f4f6', color: '#6b7280', label: flag }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

function orderStatus(order) {
  const flags = (order.result?.observations || []).map(o => o.flag)
  if (flags.includes('HH') || flags.includes('LL')) return 'critical'
  if (flags.includes('H') || flags.includes('L')) return 'abnormal'
  if (flags.length > 0 && flags.every(f => f === 'N')) return 'normal'
  if (flags.includes('A')) return 'abnormal'
  return 'pending'
}

function OrderStatusBadge({ order }) {
  const s = orderStatus(order)
  const configs = {
    critical: { bg: '#7f1d1d', color: '#fff', label: 'Critical' },
    abnormal: { bg: '#fef2f2', color: '#CC1414', label: 'Abnormal' },
    normal:   { bg: '#f0fdf4', color: '#16a34a', label: 'Normal' },
    pending:  { bg: '#fefce8', color: '#ca8a04', label: 'Pending' },
  }
  const c = configs[s]
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

const abnormalScore = (o) => {
  const flags = (o.result?.observations || []).map(ob => ob.flag)
  if (flags.includes('HH') || flags.includes('LL')) return 0
  if (flags.includes('H') || flags.includes('L')) return 1
  if (flags.includes('A')) return 2
  return 3
}

function LabOrderCard({ order }) {
  const [open, setOpen] = useState(false)
  const observations = order.result?.observations || []
  const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : d

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#EEF2FF' }}>
          <FlaskConical size={18} style={{ color: '#0F2557' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 flex items-center gap-2 flex-wrap">
            {(order.test_names || []).join(', ') || order.order_id}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {fmtDate(order.date)} · {order.clinic_name}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <OrderStatusBadge order={order} />
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          {observations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Test</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Result</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Unit</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Normal Range</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {observations.map((obs, i) => {
                    const isAbnormal = obs.flag && obs.flag !== 'N'
                    const arrow = obs.flag === 'H' || obs.flag === 'HH' ? ' ↑' : obs.flag === 'L' || obs.flag === 'LL' ? ' ↓' : ''
                    return (
                      <tr key={i} style={{ background: isAbnormal ? '#fef2f2' : '#fff' }}
                        className="border-b border-gray-100 last:border-0">
                        <td className="px-5 py-3 text-sm text-gray-800">{obs.test_name || obs.name || `Test ${i + 1}`}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-sm"
                            style={{ color: isAbnormal ? (FLAG_COLOR[obs.flag] || '#374151') : '#374151' }}>
                            {obs.value != null ? obs.value : '—'}{arrow}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{obs.unit || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{obs.ref_range || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge flag={obs.flag} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic px-5 py-4">No observations recorded.</p>
          )}

          {order.result?.interpretation && (
            <div className="mx-5 mb-4 mt-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Pathologist Interpretation</p>
              <p className="text-sm text-blue-900">{order.result.interpretation}</p>
            </div>
          )}
          {order.result?.signed_at && (
            <p className="text-xs text-gray-400 px-5 pb-3">
              Signed on {new Date(order.result.signed_at).toLocaleString('en-IN')}
              {order.result.report_hash && <> · Hash: <span className="font-mono">{order.result.report_hash.substring(0, 12)}…</span></>}
            </p>
          )}
          {!order.result && (
            <p className="text-sm text-gray-400 italic px-5 py-4">Results not yet available.</p>
          )}
        </div>
      )}
    </div>
  )
}

function ImagingResultCard({ order }) {
  const [open, setOpen] = useState(false)
  const modColor = MODALITY_COLOR[order.modality] || '#6b7280'

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: modColor + '18' }}>
          <ScanLine size={18} style={{ color: modColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 flex items-center gap-2">
            {order.order_id}
            <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold" style={{ background: modColor }}>
              {order.modality}
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {order.date} · {order.body_part || order.study_description || order.modality_label} · {order.clinic_name}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
            <CheckCircle size={12} /> Signed
          </span>
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {open && order.result && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50 space-y-3">
          {order.result.findings && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Findings</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{order.result.findings}</p>
            </div>
          )}
          {order.result.impression && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Impression</p>
              <p className="text-sm text-blue-900">{order.result.impression}</p>
            </div>
          )}
          {order.result.signed_at && (
            <p className="text-xs text-gray-400">
              Signed on {new Date(order.result.signed_at).toLocaleString('en-IN')}
              {order.result.report_hash && <> · Hash: <span className="font-mono">{order.result.report_hash.substring(0, 12)}…</span></>}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function LabResults() {
  const [labOrders, setLabOrders]         = useState([])
  const [imagingOrders, setImagingOrders] = useState([])
  const [loading, setLoading]             = useState(true)
  const [tab, setTab]                     = useState('lab')

  // Lab filters
  const [sort, setSort]             = useState('latest')
  const [statusFilter, setStatusFilter] = useState('')
  const [fromDate, setFromDate]     = useState('')
  const [toDate, setToDate]         = useState('')
  const [filterClinic, setFilterClinic] = useState('')

  useEffect(() => {
    cachedFetch(
      'lab_results',
      () => Promise.all([
        api.get('/portal/lab-results').catch(() => ({})),
        api.get('/portal/imaging-results').catch(() => ({})),
      ]),
      ([labRes, imgRes]) => {
        setLabOrders(labRes?.data?.lab_results || labRes?.lab_results || [])
        setImagingOrders(imgRes?.data?.imaging_results || imgRes?.imaging_results || [])
        setLoading(false)
      }
    ).catch(() => setLoading(false))
  }, [])

  const clinics = useMemo(() =>
    [...new Set(labOrders.map(o => o.clinic_name).filter(Boolean))],
    [labOrders]
  )

  const filteredLab = useMemo(() => {
    let orders = [...labOrders]

    if (fromDate) orders = orders.filter(o => o.date >= fromDate)
    if (toDate) orders = orders.filter(o => o.date <= toDate)
    if (filterClinic) orders = orders.filter(o => o.clinic_name === filterClinic)
    if (statusFilter) orders = orders.filter(o => orderStatus(o) === statusFilter)

    if (sort === 'latest') orders.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    else if (sort === 'oldest') orders.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    else if (sort === 'abnormal') orders.sort((a, b) => abnormalScore(a) - abnormalScore(b))

    return orders
  }, [labOrders, sort, statusFilter, fromDate, toDate, filterClinic])

  const empty = tab === 'lab' ? labOrders.length === 0 : imagingOrders.length === 0
  const Icon = tab === 'lab' ? FlaskConical : ScanLine

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[['lab', 'Lab Results', FlaskConical], ['imaging', 'Imaging Reports', ScanLine]].map(([k, label, Ic]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={tab === k ? { background: '#0F2557', color: '#fff' } : { color: '#6b7280' }}
          >
            <Ic size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Lab filters */}
      {tab === 'lab' && !loading && labOrders.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <select value={sort} onChange={e => setSort(e.target.value)} className="input sm:w-44">
            <option value="latest">Latest first</option>
            <option value="oldest">Oldest first</option>
            <option value="abnormal">Abnormal first</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input sm:w-40">
            <option value="">All Statuses</option>
            <option value="normal">Normal</option>
            <option value="abnormal">Abnormal</option>
            <option value="critical">Critical</option>
            <option value="pending">Pending</option>
          </select>
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="input sm:w-40" style={{ colorScheme: 'light' }} />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="input sm:w-40" style={{ colorScheme: 'light' }} />
          </div>
          {clinics.length > 1 && (
            <select value={filterClinic} onChange={e => setFilterClinic(e.target.value)} className="input sm:w-52">
              <option value="">All Health Centers</option>
              {clinics.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      )}

      {!loading && empty && (
        <div className="rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <Icon size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-sm">No signed {tab === 'lab' ? 'lab results' : 'imaging reports'} yet</p>
          <p className="text-xs mt-1 text-gray-300">Results appear here once your doctor signs the report</p>
        </div>
      )}

      {!loading && !empty && (
        <div className="space-y-3">
          {tab === 'lab'
            ? filteredLab.length === 0
              ? <div className="rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">No lab results match the current filters.</div>
              : filteredLab.map(o => <LabOrderCard key={o.id} order={o} />)
            : imagingOrders.map(o => <ImagingResultCard key={o.id} order={o} />)}
        </div>
      )}
    </div>
  )
}
