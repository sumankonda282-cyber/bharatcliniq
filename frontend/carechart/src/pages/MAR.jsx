import { useState, useCallback } from 'react'
import { Pill, Plus, X, Loader2, Printer, ChevronLeft, ChevronRight, AlertCircle, Check } from 'lucide-react'
import api from '../api/client'
import PatientList from '../components/PatientList'
import { useAuth } from '../contexts/AuthContext'

// ── Constants ─────────────────────────────────────────────────────────────────

const SLOTS     = ['M', 'A', 'E', 'N']
const SLOT_LABEL = { M: 'M\n6am', A: 'A\n12pm', E: 'E\n6pm', N: 'N\n10pm' }
const SLOT_FULL  = { M: 'Morning (6am)', A: 'Afternoon (12pm)', E: 'Evening (6pm)', N: 'Night (10pm)' }
const SLOT_HOUR  = { M: 6, A: 12, E: 18, N: 22 }

const FREQ_OPTIONS = ['OD', 'BD', 'TDS', 'QID', 'BD AC', 'TDS AC', 'SOS', 'STAT']
const ROUTE_OPTIONS = ['Oral (PO)', 'IV', 'IM', 'SC', 'SL', 'Topical', 'Inhalation', 'Per Rectal (PR)', 'Nasogastric (NG)']

const HOLD_REASONS = ['Patient fasting (NPO)', 'Patient vomiting', 'BP too low', 'Drug not available', 'Patient refused', 'Other']

// ── Cell visual config ────────────────────────────────────────────────────────

const CELL = {
  given:   { bg: '#d1fae5', fg: '#065f46', border: '#6ee7b7', sym: '✓' },
  held:    { bg: '#ffedd5', fg: '#9a3412', border: '#fdba74', sym: 'H' },
  refused: { bg: '#ffedd5', fg: '#b45309', border: '#fcd34d', sym: 'R' },
  missed:  { bg: '#fee2e2', fg: '#991b1b', border: '#fca5a5', sym: '✗' },
  due:     { bg: '#fef3c7', fg: '#92400e', border: '#fcd34d', sym: '!' },
  pending: { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe', sym: '●' },
  none:    { bg: '#f9fafb', fg: '#d1d5db', border: '#e5e7eb', sym: '—' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSlot(isoTime) {
  if (!isoTime) return null
  const h = new Date(isoTime).getHours()
  if (h >= 4  && h < 10) return 'M'
  if (h >= 10 && h < 16) return 'A'
  if (h >= 16 && h < 20) return 'E'
  return 'N'
}

function dayKey(isoTime) {
  if (!isoTime) return null
  return new Date(isoTime).toISOString().slice(0, 10)
}

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function fmtDay(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })
}

function fmtTime(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function nowHHMM() {
  const n = new Date()
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`
}

function isSlotPast(dateIso, slot) {
  const now = new Date()
  const slotDate = new Date(`${dateIso}T${String(SLOT_HOUR[slot]).padStart(2,'0')}:00:00`)
  return slotDate < now
}

function isToday(dateIso) {
  return dateIso === new Date().toISOString().slice(0, 10)
}

function getAdmissionDates(admission) {
  const today = new Date().toISOString().slice(0, 10)
  const start = (admission.admission_date || admission.created_at || today).slice(0, 10)
  const dates = []
  let cur = new Date(start + 'T00:00:00')
  const end = new Date(today + 'T00:00:00')
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

// ── Group MAR items by drug ───────────────────────────────────────────────────

function groupDrugs(items) {
  const map = {}
  for (const item of items) {
    const isP = !!(item.is_prn || /sos|prn/i.test(item.frequency || '') || /sos|prn/i.test(item.notes || ''))
    const key = `${item.medicine_name}||${item.dose || ''}||${item.route || ''}`
    if (!map[key]) {
      map[key] = {
        key, is_prn: isP,
        name: item.medicine_name,
        dose: item.dose || '',
        route: item.route || '',
        frequency: item.frequency || '',
        stopped_at: item.stopped_at || null,
        items: [],
      }
    }
    map[key].items.push(item)
    // if any item has stopped_at, mark drug
    if (item.stopped_at) map[key].stopped_at = item.stopped_at
  }
  return Object.values(map)
}

// ── CellButton ────────────────────────────────────────────────────────────────

function CellButton({ item, scheduled, dateIso, slot, onOpen }) {
  if (!scheduled) {
    return (
      <div
        className="w-9 h-9 rounded flex items-center justify-center text-xs select-none"
        style={{ background: CELL.none.bg, color: CELL.none.fg, border: `1px solid ${CELL.none.border}` }}
      >
        {CELL.none.sym}
      </div>
    )
  }

  const past = isSlotPast(dateIso, slot)
  let cfg, clickable

  if (!item) {
    cfg = past ? CELL.due : CELL.pending
    clickable = past
  } else {
    cfg = CELL[item.status] || CELL.pending
    clickable = item.status === 'scheduled'
  }

  const tooltip = item
    ? `${item.status}${item.administered_by ? ` · ${item.administered_by}` : ''}${fmtTime(item.administered_at) ? ` · ${fmtTime(item.administered_at)}` : ''}${item.hold_reason ? ` · ${item.hold_reason}` : ''}`
    : past ? 'Overdue — tap to document' : `Due at ${SLOT_FULL[slot]}`

  return (
    <button
      onClick={() => clickable && onOpen({ item, dateIso, slot })}
      title={tooltip}
      className={`w-9 h-9 rounded flex items-center justify-center text-xs font-bold transition-all select-none
        ${clickable ? 'cursor-pointer hover:opacity-75' : 'cursor-default'}`}
      style={{ background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.sym}
    </button>
  )
}

// ── PRN Section ───────────────────────────────────────────────────────────────

function PRNSection({ drugs, onGive }) {
  if (!drugs.length) return null
  return (
    <div className="mt-4">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">SOS / PRN Medications</div>
      <div className="border border-dashed border-gray-300 rounded-xl overflow-hidden">
        {drugs.map((drug, i) => {
          const todayItems = drug.items.filter(it => dayKey(it.scheduled_time || it.administered_at) === new Date().toISOString().slice(0,10))
          return (
            <div key={drug.key} className={`px-4 py-3 ${i > 0 ? 'border-t border-dashed border-gray-200' : ''} ${drug.stopped_at ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-medium text-gray-800 text-sm">{drug.name}</span>
                  {drug.dose && <span className="text-gray-500 text-xs ml-1">{drug.dose}</span>}
                  <span className="text-xs text-gray-400 ml-2">{drug.route?.toUpperCase()} · SOS</span>
                  {drug.stopped_at && <span className="ml-2 text-xs text-red-500 font-semibold">STOPPED</span>}
                </div>
                {!drug.stopped_at && (
                  <button
                    onClick={() => onGive(drug)}
                    className="flex-shrink-0 flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors"
                  >
                    <Plus size={11} />Give Now
                  </button>
                )}
              </div>
              {todayItems.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {todayItems.map((it, j) => (
                    <span key={j} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-xs px-2 py-0.5 rounded-full border border-emerald-200">
                      <Check size={10} />{fmtTime(it.administered_at || it.scheduled_time)}
                      {it.notes && <span className="text-emerald-600">· {it.notes}</span>}
                      {it.administered_by && <span className="text-emerald-500">· {it.administered_by}</span>}
                    </span>
                  ))}
                </div>
              )}
              {todayItems.length === 0 && !drug.stopped_at && (
                <div className="mt-1 text-xs text-gray-400">Not given today</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Admin Popup ───────────────────────────────────────────────────────────────

function AdminPopup({ ctx, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    status: 'given',
    time: nowHHMM(),
    reason: '',
    notes: '',
  })

  if (!ctx) return null
  const { drug, item, dateIso, slot } = ctx
  const isHeld = form.status === 'held'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <div className="font-bold text-gray-800">{drug.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {drug.dose} · {drug.route?.toUpperCase()} · {SLOT_FULL[slot]}
              {dateIso && <span> · {fmtDate(dateIso)}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Action selector */}
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">Action</div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { val: 'given',   label: 'Given',    color: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
                { val: 'held',    label: 'Held',     color: 'bg-orange-50 border-orange-300 text-orange-800'   },
                { val: 'refused', label: 'Refused',  color: 'bg-orange-50 border-orange-200 text-orange-700'   },
                { val: 'missed',  label: 'Missed',   color: 'bg-red-50 border-red-200 text-red-700'            },
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setForm(f => ({ ...f, status: opt.val }))}
                  className={`py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    form.status === opt.val ? opt.color + ' ring-2 ring-offset-1' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
                  style={form.status === opt.val ? { ringColor: 'currentColor' } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          {form.status === 'given' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Time Given</label>
              <input
                type="time"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
              />
            </div>
          )}

          {/* Hold reason */}
          {isHeld && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2">Reason for Hold</div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {HOLD_REASONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setForm(f => ({ ...f, reason: r }))}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      form.reason === r
                        ? 'bg-orange-100 border-orange-300 text-orange-800'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Or type reason..."
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Note (optional)</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Patient tolerated well"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={() => onSave(form)}
            disabled={saving || (isHeld && !form.reason.trim())}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: '#065F46' }}
          >
            {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" />Saving…</span> : 'Save & Sign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PRN Give Popup ────────────────────────────────────────────────────────────

function PRNPopup({ drug, onClose, onSave, saving }) {
  const [form, setForm] = useState({ indication: 'Pain', score: '', time: nowHHMM(), notes: '' })
  if (!drug) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10">
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <div className="font-bold text-gray-800">{drug.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{drug.dose} · {drug.route?.toUpperCase()} · SOS / PRN</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">Indication</div>
            <div className="flex flex-wrap gap-1.5">
              {['Pain', 'Fever', 'Nausea', 'Breathlessness', 'Anxiety', 'Other'].map(ind => (
                <button
                  key={ind}
                  onClick={() => setForm(f => ({ ...f, indication: ind }))}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    form.indication === ind
                      ? 'bg-blue-100 border-blue-300 text-blue-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>
          {form.indication === 'Pain' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Pain Score (0–10)</label>
              <input type="number" min="0" max="10" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} placeholder="e.g. 7" />
            </div>
          )}
          {form.indication === 'Fever' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Temperature (°C)</label>
              <input type="number" step="0.1" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} placeholder="e.g. 38.5" />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Time Given</label>
            <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Note (optional)</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional observations..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="px-5 pb-5">
          <button onClick={() => onSave(form)} disabled={saving}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
            style={{ background: '#1d4ed8' }}>
            {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" />Saving…</span> : 'Save & Sign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Medication Modal ──────────────────────────────────────────────────────

function AddMedModal({ onClose, onSave, saving, error }) {
  const [form, setForm] = useState({
    medicine_name: '', dose: '', route: 'Oral (PO)', frequency: 'OD',
    start_date: new Date().toISOString().slice(0, 10), stop_date: '', notes: '',
  })
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Add Medication Order</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Drug Name <span className="text-red-500">*</span></label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Tab. Amlodipine" required value={form.medicine_name} onChange={f('medicine_name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Dose</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. 10mg" value={form.dose} onChange={f('dose')} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Route</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.route} onChange={f('route')}>
                {ROUTE_OPTIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-2">Frequency</label>
            <div className="flex flex-wrap gap-1.5">
              {FREQ_OPTIONS.map(fr => (
                <button key={fr} type="button"
                  onClick={() => setForm(p => ({ ...p, frequency: fr }))}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    form.frequency === fr
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}>
                  {fr}
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-400">
              {form.frequency === 'OD' && 'Slots: Morning (6am)'}
              {form.frequency === 'BD' && 'Slots: Morning + Night (6am, 10pm)'}
              {form.frequency === 'TDS' && 'Slots: Morning + Afternoon + Night (6am, 12pm, 10pm)'}
              {form.frequency === 'QID' && 'Slots: Morning + Afternoon + Evening + Night'}
              {form.frequency === 'BD AC' && 'Slots: Morning + Evening (before meals)'}
              {form.frequency === 'TDS AC' && 'Slots: Morning + Afternoon + Evening (before meals)'}
              {form.frequency === 'SOS' && 'PRN section — given as needed, no fixed slots'}
              {form.frequency === 'STAT' && 'Immediate — given once now'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Start Date</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.start_date} onChange={f('start_date')} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Stop Date (optional)</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.stop_date} onChange={f('stop_date')} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Instructions / Notes</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Take after food, check BP before giving" value={form.notes} onChange={f('notes')} />
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
              <AlertCircle size={13} />{error}
            </div>
          )}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={() => onSave(form)} disabled={saving || !form.medicine_name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
            style={{ background: '#065F46' }}>
            {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" />Adding…</span> : 'Add to MAR'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MAR() {
  const { user } = useAuth()
  const [selected, setSelected]       = useState(null)
  const [admission, setAdmission]     = useState(null)
  const [marItems, setMarItems]       = useState([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [dates, setDates]             = useState([])
  const [pageStart, setPageStart]     = useState(0)
  const [actionCtx, setActionCtx]     = useState(null)
  const [prnDrug, setPrnDrug]         = useState(null)
  const [actioning, setActioning]     = useState(false)
  const [showAdd, setShowAdd]         = useState(false)
  const [addSaving, setAddSaving]     = useState(false)
  const [addError, setAddError]       = useState('')

  const PAGE = 5 // dates visible at once

  const fetchMAR = useCallback((adm) => {
    setLoading(true); setError('')
    api.get(`/inpatient/admissions/${adm.id}/mar`)
      .then(data => {
        const items = Array.isArray(data) ? data : (data.items || data.results || [])
        setMarItems(items)
        const d = getAdmissionDates(adm)
        setDates(d)
        setPageStart(Math.max(0, d.length - PAGE))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = (adm) => {
    setSelected(adm); setAdmission(adm); fetchMAR(adm)
  }

  const visibleDates = dates.slice(pageStart, pageStart + PAGE)
  const groups = groupDrugs(marItems)
  const scheduled = groups.filter(g => !g.is_prn)
  const prn = groups.filter(g => g.is_prn)

  // Build lookup: drugKey → dateIso → slot → item
  const lookup = {}
  for (const item of marItems) {
    const dk = `${item.medicine_name}||${item.dose || ''}||${item.route || ''}`
    const d  = dayKey(item.scheduled_time)
    const s  = getSlot(item.scheduled_time)
    if (!d || !s) continue
    if (!lookup[dk]) lookup[dk] = {}
    if (!lookup[dk][d]) lookup[dk][d] = {}
    lookup[dk][d][s] = item
  }

  // Determine which slots are scheduled for a drug on a given date
  function isScheduled(drug, dateIso, slot) {
    if (drug.stopped_at && dateIso >= drug.stopped_at.slice(0,10)) return false
    // Check if any item exists for this drug on this date in this slot
    return !!(lookup[drug.key]?.[dateIso]?.[slot])
      // Also include if it was pending/missed and not yet documented
      || (() => {
        // derive from frequency
        const freq = (drug.frequency || '').toUpperCase()
        const slotMap = {
          'OD': ['M'], 'QD': ['M'],
          'BD': ['M','N'], 'BID': ['M','N'],
          'TDS': ['M','A','N'], 'TID': ['M','A','N'],
          'QID': ['M','A','E','N'],
          'BD AC': ['M','E'], 'TDS AC': ['M','A','E'],
        }
        return (slotMap[freq] || []).includes(slot)
      })()
  }

  const handleAdminSave = async (form) => {
    if (!actionCtx) return
    setActioning(true)
    try {
      const { drug, item, dateIso, slot } = actionCtx
      const scheduled_time = new Date(`${dateIso}T${String(SLOT_HOUR[slot]).padStart(2,'0')}:00:00`).toISOString()
      const payload = {
        status: form.status,
        notes: form.notes,
        ...(form.status === 'given'  ? { administered_at: new Date().toISOString() } : {}),
        ...(form.status === 'held'   ? { hold_reason: form.reason } : {}),
      }
      if (item?.id) {
        await api.patch(`/inpatient/mar/${item.id}`, payload)
      } else {
        await api.post(`/inpatient/admissions/${selected.id}/mar`, {
          medicine_name: drug.name, dose: drug.dose, route: drug.route,
          scheduled_time, ...payload,
        })
      }
      setActionCtx(null)
      fetchMAR(selected)
    } catch (err) {
      alert(err.message)
    } finally {
      setActioning(false)
    }
  }

  const handlePRNSave = async (form) => {
    if (!prnDrug) return
    setActioning(true)
    try {
      await api.post(`/inpatient/admissions/${selected.id}/mar`, {
        medicine_name: prnDrug.name,
        dose: prnDrug.dose,
        route: prnDrug.route,
        frequency: 'SOS',
        is_prn: true,
        status: 'given',
        administered_at: new Date().toISOString(),
        notes: `${form.indication}${form.score ? ` ${form.score}` : ''}${form.notes ? ' — ' + form.notes : ''}`,
      })
      setPrnDrug(null)
      fetchMAR(selected)
    } catch (err) {
      alert(err.message)
    } finally {
      setActioning(false)
    }
  }

  const handleAddMed = async (form) => {
    setAddSaving(true); setAddError('')
    try {
      await api.post(`/inpatient/admissions/${selected.id}/mar`, form)
      setShowAdd(false)
      fetchMAR(selected)
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAddSaving(false)
    }
  }

  const isDoctor = ['doctor', 'clinic_admin', 'provider'].includes(user?.role)

  return (
    <div className="flex flex-col h-full">
      <div className="page-header flex-shrink-0">
        <h1 className="page-title">Medication Administration Record (MAR)</h1>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-52 flex-shrink-0 card overflow-y-auto">
          <PatientList selectedId={selected?.id} onSelect={handleSelect} />
        </div>

        <div className="flex-1 overflow-auto min-w-0">
          {!selected ? (
            <div className="card h-full flex items-center justify-center">
              <div className="empty-state">
                <Pill size={40} className="empty-state-icon" />
                <span className="empty-state-text">Select a patient to view MAR</span>
              </div>
            </div>
          ) : loading ? (
            <div className="card h-full flex items-center justify-center">
              <Loader2 size={28} className="animate-spin text-gray-300" />
            </div>
          ) : error ? (
            <div className="card p-6 text-sm text-red-600">{error}</div>
          ) : (
            <div className="card p-4">
              {/* Patient header */}
              <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h2 className="font-bold text-gray-800 text-lg">
                    {selected.patient?.full_name || selected.patient_name}
                  </h2>
                  <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                    <span>{selected.admission_number}</span>
                    {admission?.admission_date && (
                      <span>· Admitted {fmtDate(admission.admission_date.slice(0,10))}</span>
                    )}
                    <span>· Day {dates.length}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                    <Printer size={13} />Print MAR
                  </button>
                  {isDoctor && (
                    <button onClick={() => { setShowAdd(true); setAddError('') }}
                      className="flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-colors"
                      style={{ background: '#065F46' }}>
                      <Plus size={13} />Order Medication
                    </button>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-2 mb-4 text-xs">
                {Object.entries({ given: '✓ Given', held: 'H Held', refused: 'R Refused', missed: '✗ Missed', due: '! Overdue', pending: '● Scheduled' }).map(([k, label]) => (
                  <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{ background: CELL[k].bg, color: CELL[k].fg, border: `1px solid ${CELL[k].border}` }}>
                    {label}
                  </span>
                ))}
              </div>

              {/* Date navigation */}
              {dates.length > PAGE && (
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={() => setPageStart(p => Math.max(0, p - PAGE))} disabled={pageStart === 0}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-gray-500 flex-1 text-center">
                    {fmtDate(visibleDates[0])} — {fmtDate(visibleDates[visibleDates.length - 1])}
                  </span>
                  <button onClick={() => setPageStart(p => Math.min(dates.length - PAGE, p + PAGE))} disabled={pageStart + PAGE >= dates.length}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* MAR Grid */}
              {scheduled.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">No scheduled medications</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ minWidth: 480 }}>
                    <thead>
                      <tr>
                        {/* Drug column header */}
                        <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-3" style={{ minWidth: 180 }}>
                          Medication
                        </th>
                        {/* Date × Slot headers */}
                        {visibleDates.map(d => (
                          <th key={d} colSpan={4} className="pb-2 px-1">
                            <div className={`text-center rounded-lg py-1 ${isToday(d) ? 'bg-emerald-50' : ''}`}>
                              <div className="text-xs font-bold text-gray-700">{fmtDate(d)}</div>
                              <div className="text-xs text-gray-400">{fmtDay(d)}{isToday(d) ? ' · Today' : ''}</div>
                            </div>
                          </th>
                        ))}
                      </tr>
                      <tr>
                        <th className="pb-2" />
                        {visibleDates.map(d => (
                          SLOTS.map(s => (
                            <th key={`${d}-${s}`} className={`text-center pb-2 px-0.5 text-xs font-semibold ${isToday(d) ? 'text-emerald-700' : 'text-gray-400'}`}
                              style={{ width: 36 }}>
                              {s}
                            </th>
                          ))
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scheduled.map((drug, ri) => (
                        <tr key={drug.key}
                          className={`${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${drug.stopped_at ? 'opacity-60' : ''}`}>
                          {/* Drug name cell */}
                          <td className="py-2 pr-3 align-middle">
                            <div className="font-medium text-gray-800 text-sm leading-tight">{drug.name}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {drug.dose} · {drug.route}
                              {drug.frequency && <span className="ml-1 font-semibold text-gray-500">{drug.frequency}</span>}
                              {drug.stopped_at && <span className="ml-2 text-red-500 font-semibold">STOPPED</span>}
                            </div>
                          </td>
                          {/* Slot cells */}
                          {visibleDates.map(d => (
                            SLOTS.map(s => {
                              const sched = isScheduled(drug, d, s)
                              const item  = lookup[drug.key]?.[d]?.[s]
                              return (
                                <td key={`${d}-${s}`} className={`py-2 px-0.5 text-center align-middle ${isToday(d) ? 'bg-emerald-50/30' : ''}`}>
                                  <CellButton
                                    item={item}
                                    scheduled={sched}
                                    dateIso={d}
                                    slot={s}
                                    onOpen={ctx => setActionCtx({ ...ctx, drug })}
                                  />
                                </td>
                              )
                            })
                          ))}
                        </tr>
                      ))}
                      {/* Signature row */}
                      <tr className="border-t-2 border-gray-200">
                        <td className="py-2 pr-3">
                          <div className="text-xs font-semibold text-gray-500">Nurse Signature</div>
                        </td>
                        {visibleDates.map(d => (
                          <td key={d} colSpan={4} className={`py-2 px-1 text-center ${isToday(d) ? 'bg-emerald-50/30' : ''}`}>
                            <div className="text-xs text-gray-400 border border-dashed border-gray-200 rounded py-1 px-1">
                              {user?.full_name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '—'}
                            </div>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* PRN section */}
              <PRNSection drugs={prn} onGive={setPrnDrug} />

              {/* Sub-header times reference */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
                <span><b className="text-gray-600">M</b> Morning — 6:00 AM</span>
                <span><b className="text-gray-600">A</b> Afternoon — 12:00 PM</span>
                <span><b className="text-gray-600">E</b> Evening — 6:00 PM</span>
                <span><b className="text-gray-600">N</b> Night — 10:00 PM</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {actionCtx && (
        <AdminPopup ctx={actionCtx} onClose={() => setActionCtx(null)} onSave={handleAdminSave} saving={actioning} />
      )}
      {prnDrug && (
        <PRNPopup drug={prnDrug} onClose={() => setPrnDrug(null)} onSave={handlePRNSave} saving={actioning} />
      )}
      {showAdd && (
        <AddMedModal onClose={() => setShowAdd(false)} onSave={handleAddMed} saving={addSaving} error={addError} />
      )}
    </div>
  )
}
