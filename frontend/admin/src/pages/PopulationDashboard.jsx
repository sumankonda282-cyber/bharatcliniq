import { useEffect, useState, useMemo } from 'react'
import api from '../api/client'

// ── helpers ──────────────────────────────────────────────────────────────────
const ORANGE = '#F5821E'
const NAVY   = '#0F2557'

const CATEGORY_COLORS = {
  mental_health: '#6366f1',
  fall_risk:     '#f59e0b',
  pain:          '#ef4444',
  nutrition:     '#10b981',
  cardiology:    '#3b82f6',
  general:       '#8b5cf6',
}
function catColor(cat) {
  return CATEGORY_COLORS[cat] || '#64748b'
}

function truncate(str, n) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 flex flex-col gap-1 min-w-0">
      <span className="text-3xl font-extrabold text-white tabular-nums">{value ?? '—'}</span>
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider leading-tight">{label}</span>
      {sub != null && (
        <span className="text-xs text-gray-500 mt-0.5">{sub}</span>
      )}
    </div>
  )
}

// ── Horizontal bar chart ──────────────────────────────────────────────────────
function HBarChart({ forms }) {
  const top10 = useMemo(() => {
    return [...(forms || [])]
      .sort((a, b) => b.submission_count - a.submission_count)
      .slice(0, 10)
  }, [forms])

  const max = top10[0]?.submission_count || 1
  const rowH = 32
  const labelW = 160
  const barAreaW = 220
  const countW = 40
  const svgW = labelW + barAreaW + countW + 16
  const svgH = top10.length * rowH + 8

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
        Score Distribution by Form
      </h2>
      {top10.length === 0 ? (
        <p className="text-gray-500 text-sm">No submission data yet.</p>
      ) : (
        <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible">
          {top10.map((f, i) => {
            const y = i * rowH + 4
            const barW = Math.max(4, (f.submission_count / max) * barAreaW)
            const color = catColor(f.category)
            return (
              <g key={f.id}>
                {/* label */}
                <text
                  x={labelW - 8}
                  y={y + rowH / 2}
                  dominantBaseline="middle"
                  textAnchor="end"
                  fontSize="11"
                  fill="#9ca3af"
                  fontFamily="inherit"
                >
                  {truncate(f.title, 24)}
                </text>
                {/* bar background */}
                <rect
                  x={labelW}
                  y={y + 6}
                  width={barAreaW}
                  height={rowH - 12}
                  rx="4"
                  fill="#1f2937"
                />
                {/* bar fill */}
                <rect
                  x={labelW}
                  y={y + 6}
                  width={barW}
                  height={rowH - 12}
                  rx="4"
                  fill={color}
                  opacity="0.85"
                />
                {/* count */}
                <text
                  x={labelW + barAreaW + 8}
                  y={y + rowH / 2}
                  dominantBaseline="middle"
                  fontSize="11"
                  fill="#e5e7eb"
                  fontFamily="inherit"
                  fontWeight="600"
                >
                  {f.submission_count}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

// ── Donut chart ───────────────────────────────────────────────────────────────
function donutArc(cx, cy, r, startAngle, endAngle) {
  // angles in radians
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  const large = endAngle - startAngle > Math.PI ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

function DonutChart({ total, unacknowledged }) {
  const acknowledged = Math.max(0, (total || 0) - (unacknowledged || 0))
  const unk = unacknowledged || 0
  const cx = 90, cy = 90, r = 62, innerR = 40
  const strokeW = r - innerR

  // Compute angles
  const totalVal = acknowledged + unk || 1
  const ackFrac = acknowledged / totalVal
  const unkFrac = unk / totalVal

  const startOffset = -Math.PI / 2
  const ackEnd = startOffset + ackFrac * 2 * Math.PI
  const unkEnd = ackEnd + unkFrac * 2 * Math.PI

  const segments = [
    { label: 'Acknowledged', value: acknowledged, color: '#10b981', start: startOffset, end: ackEnd },
    { label: 'Unacknowledged', value: unk, color: '#ef4444', start: ackEnd, end: unkEnd },
  ]

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
        Alert Severity Breakdown
      </h2>
      <div className="flex flex-col items-center gap-4">
        <svg width="180" height="180" viewBox="0 0 180 180">
          {/* background ring */}
          <circle cx={cx} cy={cy} r={(r + innerR) / 2} fill="none" stroke="#1f2937" strokeWidth={strokeW} />
          {total === 0 || total == null ? (
            <circle cx={cx} cy={cy} r={(r + innerR) / 2} fill="none" stroke="#374151" strokeWidth={strokeW} />
          ) : (
            segments.map((seg, i) => {
              if (seg.value === 0) return null
              const mid = (seg.start + seg.end) / 2
              const pathD =
                `M ${cx + r * Math.cos(seg.start)} ${cy + r * Math.sin(seg.start)} ` +
                `A ${r} ${r} 0 ${seg.end - seg.start > Math.PI ? 1 : 0} 1 ` +
                `${cx + r * Math.cos(seg.end)} ${cy + r * Math.sin(seg.end)} ` +
                `L ${cx + innerR * Math.cos(seg.end)} ${cy + innerR * Math.sin(seg.end)} ` +
                `A ${innerR} ${innerR} 0 ${seg.end - seg.start > Math.PI ? 1 : 0} 0 ` +
                `${cx + innerR * Math.cos(seg.start)} ${cy + innerR * Math.sin(seg.start)} Z`
              return <path key={i} d={pathD} fill={seg.color} opacity="0.9" />
            })
          )}
          {/* center text */}
          <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" fontSize="22" fontWeight="800" fill="white" fontFamily="inherit">
            {total ?? 0}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#9ca3af" fontFamily="inherit">
            Total Alerts
          </text>
        </svg>
        {/* legend */}
        <div className="flex flex-col gap-2 w-full px-2">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: seg.color }} />
                <span className="text-gray-300">{seg.label}</span>
              </div>
              <span className="text-white font-bold tabular-nums">{seg.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ points, color }) {
  const w = 200, h = 50
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const xs = points.map((_, i) => (i / (points.length - 1)) * w)
  const ys = points.map((v) => h - ((v - min) / range) * (h - 8) - 4)
  const poly = xs.map((x, i) => `${x},${ys[i]}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={poly} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const SPARKLINES = [
  { label: 'PHQ-9', color: '#6366f1', points: [4, 6, 5, 8, 7, 9, 11, 10, 13, 12, 14, 15] },
  { label: 'GAD-7', color: '#f59e0b', points: [3, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8, 10] },
  { label: 'Morse Fall', color: '#10b981', points: [20, 25, 22, 30, 28, 35, 32, 38, 36, 40, 37, 42] },
]

// ── Form Performance Table ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    published: 'bg-green-900/60 text-green-300 border-green-700',
    draft:     'bg-yellow-900/60 text-yellow-300 border-yellow-700',
    archived:  'bg-gray-800 text-gray-400 border-gray-600',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status] || 'bg-gray-800 text-gray-400 border-gray-600'}`}>
      {status || 'unknown'}
    </span>
  )
}

function CategoryPill({ category }) {
  const color = catColor(category)
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + '22', color, border: `1px solid ${color}55` }}
    >
      {category || 'general'}
    </span>
  )
}

function FormTable({ forms }) {
  const [sortKey, setSortKey] = useState('submission_count')
  const [sortDir, setSortDir] = useState('desc')

  const sorted = useMemo(() => {
    return [...(forms || [])].sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [forms, sortKey, sortDir])

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function sortIcon(key) {
    if (sortKey !== key) return <span className="text-gray-600 ml-1">⇅</span>
    return <span className="ml-1" style={{ color: ORANGE }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const thClass = 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400'
  const thBtn = `${thClass} cursor-pointer hover:text-white select-none`

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Form Performance Table</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/80 border-b border-gray-800">
            <tr>
              <th className={thClass}>Form Title</th>
              <th className={thClass}>Category</th>
              <th className={thBtn} onClick={() => handleSort('submission_count')}>
                Submissions{sortIcon('submission_count')}
              </th>
              <th className={thClass}>Assignments</th>
              <th className={thBtn} onClick={() => handleSort('alert_count')}>
                Alerts{sortIcon('alert_count')}
              </th>
              <th className={thClass}>Last Submission</th>
              <th className={thClass}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sorted.map((f) => {
              let rowCls = 'transition-colors hover:bg-gray-800/50'
              let titleCls = 'text-white font-medium'
              if (f.alert_count > 0) {
                rowCls += ' bg-red-950/20'
              } else if (f.submission_count === 0) {
                rowCls += ' opacity-60'
                titleCls = 'text-gray-400 italic font-normal'
              }
              return (
                <tr key={f.id} className={rowCls}>
                  <td className="px-4 py-3">
                    <span className={titleCls}>{f.title}</span>
                  </td>
                  <td className="px-4 py-3"><CategoryPill category={f.category} /></td>
                  <td className="px-4 py-3 text-center tabular-nums font-semibold text-white">{f.submission_count ?? 0}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-gray-300">{f.assignment_count ?? 0}</td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    <span className={f.alert_count > 0 ? 'text-red-400 font-bold' : 'text-gray-300'}>
                      {f.alert_count ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(f.last_submission_at)}</td>
                  <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No forms found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PopulationDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    api.get('/platform/forms/analytics')
      .then(res => { setData(res.data); setError(null) })
      .catch(err => setError(err?.response?.data?.detail || err.message || 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  const publishedCount = useMemo(() => {
    if (!data?.by_status) return 0
    return data.by_status.published ?? 0
  }, [data])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: ORANGE }}>
          Population Dashboard
        </h1>
        <p className="text-gray-400 text-sm mt-1">Clinical insights across all patients</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-950 border border-red-700 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-5 border border-gray-800 animate-pulse h-24" />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <KpiCard label="Total Submissions"    value={data.total_submissions}    sub="all time" />
            <KpiCard label="Last 30 Days"         value={data.submissions_last_30d} sub="submissions" />
            <KpiCard label="Open Assignments"     value={data.open_assignments}     sub={`of ${data.total_assignments ?? 0} total`} />
            <KpiCard label="Total Alerts"         value={data.total_alerts}         sub="across all forms" />
            <KpiCard label="Unacknowledged"       value={data.unacknowledged_alerts} sub="alerts pending" />
            <KpiCard label="Published Forms"      value={publishedCount}            sub={`of ${data.total_forms ?? 0} total`} />
          </div>

          {/* Two-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <HBarChart forms={data.forms} />
            <DonutChart total={data.total_alerts} unacknowledged={data.unacknowledged_alerts} />
          </div>

          {/* Form Performance Table */}
          <div className="mb-6">
            <FormTable forms={data.forms} />
          </div>
        </>
      )}

      {/* Clinical Score Trends */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
          Clinical Score Trends
        </h2>
        <p className="text-xs text-gray-500 mb-5">
          Score trend graphs will populate as submissions accumulate. Currently showing illustrative data.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {SPARKLINES.map((s) => (
            <div key={s.label} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">{s.label}</span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: s.color + '22', color: s.color }}
                >
                  Illustrative
                </span>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 flex items-center justify-center">
                <Sparkline points={s.points} color={s.color} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
