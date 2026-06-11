import { useState, useEffect, useCallback } from 'react'
import {
  Wrench, Loader2, RefreshCw, X, CheckCircle2, Pencil, Save, ChevronUp, ChevronDown
} from 'lucide-react'
import api from '../api/client'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = [
  { key: 'new',         label: 'New',         color: '#dc2626', bg: '#fef2f2', ring: 'ring-red-300' },
  { key: 'in_progress', label: 'In Progress',  color: '#d97706', bg: '#fffbeb', ring: 'ring-amber-300' },
  { key: 'resolved',    label: 'Resolved',     color: '#059669', bg: '#f0fdf4', ring: 'ring-emerald-300' },
  { key: 'closed',      label: 'Closed',       color: '#6b7280', bg: '#f9fafb', ring: 'ring-gray-300' },
]

const PRIORITY_STYLE = {
  urgent: { badge: 'bg-red-100 text-red-700',    label: '🔴 Urgent' },
  high:   { badge: 'bg-orange-100 text-orange-700', label: '🟠 High' },
  medium: { badge: 'bg-yellow-100 text-yellow-700', label: '🟡 Medium' },
  low:    { badge: 'bg-green-100 text-green-700',   label: '🟢 Low' },
}

const CATEGORY_LABEL = {
  facility:    '🏗 Facility',
  equipment:   '🩺 Equipment',
  it_software: '💻 IT / Software',
  other:       '📋 Other',
}

const PORTAL_COLORS = {
  CareChart:  '#065F46', Laboratory: '#1d4ed8', Imaging: '#7c3aed',
  Pharmacy:   '#b45309', Reception:  '#0F2557', Provider: '#0369a1', Admin: '#374151',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── EditableRow ───────────────────────────────────────────────────────────────

function EditableRow({ req, idx, onUpdate }) {
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [draft, setDraft]       = useState({})

  const startEdit = () => {
    setDraft({
      title:       req.title,
      category:    req.category,
      priority:    req.priority,
      location:    req.location || '',
      status:      req.status,
      notes:       req.notes || '',
    })
    setEditing(true)
    setSaved(false)
  }

  const cancelEdit = () => { setEditing(false); setDraft({}) }

  const save = async () => {
    setSaving(true)
    try {
      await api.patch(`/maintenance/requests/${req.id}`, draft)
      setSaved(true)
      setEditing(false)
      setTimeout(() => { setSaved(false); onUpdate() }, 800)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // Quick status change without entering full edit mode
  const quickStatus = async e => {
    const status = e.target.value
    try { await api.patch(`/maintenance/requests/${req.id}`, { status }) }
    catch (err) { console.error(err) }
    finally { onUpdate() }
  }

  const st = STATUSES.find(s => s.key === req.status) || STATUSES[0]
  const pri = PRIORITY_STYLE[req.priority] || PRIORITY_STYLE.medium

  return (
    <>
      {/* Main row */}
      <tr className={`border-b border-gray-100 transition-colors ${editing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
        {/* # */}
        <td className="px-3 py-3 text-xs text-gray-400 font-mono w-10">{idx + 1}</td>

        {/* Issue title */}
        <td className="px-3 py-3 min-w-[180px]">
          {editing ? (
            <input
              className="w-full border border-blue-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            />
          ) : (
            <span className="text-sm font-medium text-gray-800">{req.title}</span>
          )}
        </td>

        {/* Category */}
        <td className="px-3 py-3 whitespace-nowrap">
          {editing ? (
            <select
              className="border border-blue-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
              value={draft.category}
              onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
            >
              <option value="facility">Facility</option>
              <option value="equipment">Equipment</option>
              <option value="it_software">IT / Software</option>
              <option value="other">Other</option>
            </select>
          ) : (
            <span className="text-xs text-gray-600">{CATEGORY_LABEL[req.category] || req.category}</span>
          )}
        </td>

        {/* Priority */}
        <td className="px-3 py-3 whitespace-nowrap">
          {editing ? (
            <select
              className="border border-blue-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
              value={draft.priority}
              onChange={e => setDraft(d => ({ ...d, priority: e.target.value }))}
            >
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pri.badge}`}>{pri.label}</span>
          )}
        </td>

        {/* Location / Ward */}
        <td className="px-3 py-3 min-w-[120px]">
          {editing ? (
            <input
              className="w-full border border-blue-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
              placeholder="Ward / Room"
              value={draft.location}
              onChange={e => setDraft(d => ({ ...d, location: e.target.value }))}
            />
          ) : (
            <span className="text-xs text-gray-500">{req.location || <span className="text-gray-300">—</span>}</span>
          )}
        </td>

        {/* Portal source */}
        <td className="px-3 py-3 whitespace-nowrap">
          {req.portal_source ? (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
              style={{ background: PORTAL_COLORS[req.portal_source] || '#6b7280' }}
            >
              {req.portal_source}
            </span>
          ) : <span className="text-gray-300 text-xs">—</span>}
        </td>

        {/* Submitted by */}
        <td className="px-3 py-3 whitespace-nowrap">
          <span className="text-xs text-gray-600">{req.submitter_name || '—'}</span>
        </td>

        {/* Date */}
        <td className="px-3 py-3 whitespace-nowrap">
          <span className="text-xs text-gray-400">{fmtDate(req.created_at)}</span>
        </td>

        {/* Status — quick change always available */}
        <td className="px-3 py-3 whitespace-nowrap">
          {editing ? (
            <select
              className="border border-blue-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
              value={draft.status}
              onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}
            >
              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          ) : (
            <select
              className="text-xs px-2 py-1 rounded-lg border font-medium cursor-pointer focus:outline-none"
              style={{ borderColor: st.color, color: st.color, background: st.bg }}
              value={req.status}
              onChange={quickStatus}
            >
              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          )}
        </td>

        {/* Notes */}
        <td className="px-3 py-3 min-w-[140px]">
          {editing ? (
            <input
              className="w-full border border-blue-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
              placeholder="Manager notes..."
              value={draft.notes}
              onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
            />
          ) : (
            <span className="text-xs text-gray-500 italic">{req.notes || <span className="text-gray-300">—</span>}</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-3 whitespace-nowrap">
          {saved ? (
            <CheckCircle2 size={16} className="text-emerald-500" />
          ) : editing ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                Save
              </button>
              <button onClick={cancelEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 border border-gray-200"
            >
              <Pencil size={11} />Edit
            </button>
          )}
        </td>
      </tr>
    </>
  )
}

// ── MaintenanceDashboard ──────────────────────────────────────────────────────

const COL_KEYS = ['#', 'Issue', 'Category', 'Priority', 'Location / Ward', 'Portal', 'Submitted By', 'Date', 'Status', 'Notes', 'Actions']

export default function MaintenanceDashboard() {
  const [requests, setRequests]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [statusFilter, setStatus]   = useState([])   // [] = all
  const [filterCat, setFilterCat]   = useState('')
  const [filterPri, setFilterPri]   = useState('')
  const [sortKey, setSortKey]       = useState('created_at')
  const [sortAsc, setSortAsc]       = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/maintenance/requests')
      .then(r => setRequests(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const toggleStatus = key =>
    setStatus(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  const counts = STATUSES.reduce((acc, s) => {
    acc[s.key] = requests.filter(r => r.status === s.key).length
    return acc
  }, {})

  const SORT_FN = {
    title:       (a, b) => a.title.localeCompare(b.title),
    category:    (a, b) => a.category.localeCompare(b.category),
    priority:    (a, b) => ['urgent','high','medium','low'].indexOf(a.priority) - ['urgent','high','medium','low'].indexOf(b.priority),
    status:      (a, b) => a.status.localeCompare(b.status),
    created_at:  (a, b) => new Date(b.created_at) - new Date(a.created_at),
    submitter:   (a, b) => (a.submitter_name||'').localeCompare(b.submitter_name||''),
  }

  const filtered = requests
    .filter(r => statusFilter.length === 0 || statusFilter.includes(r.status))
    .filter(r => !filterCat || r.category === filterCat)
    .filter(r => !filterPri || r.priority === filterPri)
    .sort((a, b) => {
      const fn = SORT_FN[sortKey] || SORT_FN.created_at
      return sortAsc ? fn(a, b) : -fn(a, b) * -1 || fn(a, b)
    })

  const handleSort = key => {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  const SortIcon = ({ k }) => sortKey === k
    ? (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
    : <ChevronDown size={12} className="opacity-20" />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
            <Wrench size={18} style={{ color: '#065F46' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Maintenance Requests</h1>
            <p className="text-xs text-gray-400">All portals · {requests.length} total</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </div>

      {/* Stat filter cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map(({ key, label, color, bg, ring }) => {
          const active = statusFilter.includes(key)
          return (
            <button
              key={key}
              onClick={() => toggleStatus(key)}
              className={`rounded-xl p-3 text-left transition-all border-2 ${active ? `ring-2 ${ring} border-transparent` : 'border-transparent'}`}
              style={{ background: bg }}
            >
              <div className="text-2xl font-bold" style={{ color }}>{counts[key] || 0}</div>
              <div className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</div>
              {active && <div className="text-xs mt-1 font-medium" style={{ color }}>● Filtering</div>}
            </button>
          )
        })}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
        >
          <option value="">All Categories</option>
          <option value="facility">🏗 Facility</option>
          <option value="equipment">🩺 Equipment</option>
          <option value="it_software">💻 IT / Software</option>
          <option value="other">📋 Other</option>
        </select>
        <select
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          value={filterPri}
          onChange={e => setFilterPri(e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="urgent">🔴 Urgent</option>
          <option value="high">🟠 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
        {(filterCat || filterPri || statusFilter.length > 0) && (
          <button
            onClick={() => { setFilterCat(''); setFilterPri(''); setStatus([]) }}
            className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-red-50"
          >
            <X size={12} />Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} of {requests.length} requests</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={26} className="animate-spin text-gray-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">
          No requests match the current filters.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 w-10">#</th>
                  {[
                    { label: 'Issue',        key: 'title' },
                    { label: 'Category',     key: 'category' },
                    { label: 'Priority',     key: 'priority' },
                    { label: 'Location / Ward', key: null },
                    { label: 'Portal',       key: null },
                    { label: 'Submitted By', key: 'submitter' },
                    { label: 'Date',         key: 'created_at' },
                    { label: 'Status',       key: 'status' },
                    { label: 'Notes',        key: null },
                    { label: 'Actions',      key: null },
                  ].map(({ label, key }) => (
                    <th
                      key={label}
                      className={`px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap ${key ? 'cursor-pointer hover:text-gray-800 select-none' : ''}`}
                      onClick={key ? () => handleSort(key) : undefined}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {key && <SortIcon k={key} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <EditableRow key={r.id} req={r} idx={i} onUpdate={load} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
