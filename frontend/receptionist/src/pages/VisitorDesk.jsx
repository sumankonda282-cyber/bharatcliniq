import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, UserCheck, Loader2, Printer, X, CheckCircle, AlertCircle,
  Clock, LogIn, LogOut, Ban, RotateCcw, ChevronDown, ChevronRight,
  ShieldAlert, Users, Edit3, CalendarClock, Settings, Plus, BadgeCheck,
  BedDouble, Ticket, ScanLine, ArrowRight,
} from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'

const istNow = () => new Date(Date.now() + 5.5 * 3600000)
const istToday = () => istNow().toISOString().slice(0, 10)
const fmtDT = (s) => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}
const fmtTime = (s) => {
  if (!s) return '—'
  return new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const STATUS_COLORS = {
  active:      'bg-green-100 text-green-800 border-green-200',
  checked_in:  'bg-blue-100 text-blue-800 border-blue-200',
  checked_out: 'bg-gray-100 text-gray-600 border-gray-200',
  revoked:     'bg-red-100 text-red-700 border-red-200',
}
const STATUS_LABELS = {
  active:      'Active',
  checked_in:  'Checked In',
  checked_out: 'Checked Out',
  revoked:     'Revoked',
}

const ID_PROOFS = ['Aadhaar', 'PAN', 'Passport', 'Driving License', 'Voter ID', 'Other']

function PassBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

// ── Print slip ─────────────────────────────────────────────────────────────────

function PrintSlip({ pass, clinicName, onClose }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-0 w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Screen header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="font-semibold text-gray-800 text-sm">Visitor Pass — Preview</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        {/* Printable slip */}
        <div id="visitor-slip" className="p-5 font-mono text-xs space-y-1 border-b border-dashed border-gray-300">
          <div className="text-center font-bold text-sm mb-1">{clinicName || 'BharatCliniq'}</div>
          <div className="text-center text-gray-500 mb-2">— VISITOR PASS —</div>
          <div className="flex justify-between"><span>Pass Code</span><span className="font-bold tracking-widest">{pass.pass_code}</span></div>
          <div className="flex justify-between"><span>Type</span><span className="capitalize">{pass.pass_type === 'attender' ? 'Attender Pass' : 'Visit Pass'}</span></div>
          <div className="border-t border-dashed border-gray-300 my-1" />
          <div className="flex justify-between"><span>Patient</span><span className="font-semibold">{pass.patient_name}</span></div>
          {pass.ward_name && <div className="flex justify-between"><span>Ward/Bed</span><span>{pass.ward_name}{pass.bed_number ? ` / ${pass.bed_number}` : ''}</span></div>}
          <div className="border-t border-dashed border-gray-300 my-1" />
          <div className="flex justify-between"><span>Visitor</span><span className="font-semibold">{pass.visitor_name}</span></div>
          {pass.relation && <div className="flex justify-between"><span>Relation</span><span>{pass.relation}</span></div>}
          {pass.visitor_mobile && <div className="flex justify-between"><span>Mobile</span><span>{pass.visitor_mobile}</span></div>}
          {pass.id_proof_type && <div className="flex justify-between"><span>ID Proof</span><span>{pass.id_proof_type}</span></div>}
          {pass.id_proof_number && <div className="flex justify-between"><span>ID No.</span><span>{pass.id_proof_number}</span></div>}
          <div className="flex justify-between"><span>Persons</span><span>{pass.persons}</span></div>
          <div className="border-t border-dashed border-gray-300 my-1" />
          <div className="flex justify-between"><span>Valid From</span><span>{fmtDT(pass.valid_from)}</span></div>
          <div className="flex justify-between"><span>Valid Until</span><span>{fmtDT(pass.valid_until)}</span></div>
          {pass.note && <div className="mt-1 text-gray-500">Note: {pass.note}</div>}
          <div className="border-t border-dashed border-gray-300 my-1" />
          <div className="text-center text-gray-400">Issued by {pass.issued_by_name || 'Staff'}</div>
          <div className="text-center text-gray-400">{fmtDT(pass.created_at)}</div>
          {pass.override_note && <div className="text-center text-amber-700 font-semibold">Override: {pass.override_note}</div>}
        </div>

        <div className="p-4 flex gap-2">
          <button onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700">
            <Printer size={14} /> Print
          </button>
          <button onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body > * { display: none !important; }
          #visitor-slip { display: block !important; position: fixed; inset: 0; font-size: 11px; padding: 8mm; }
        }
      `}</style>
    </div>
  )
}

// ── Edit / Revoke / Extend modals ─────────────────────────────────────────────

function RevokeModal({ pass, onDone, onClose }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    setSaving(true)
    try {
      await api.post(`/inpatient/visitor-passes/${pass.id}/revoke`, { reason })
      onDone()
    } catch (e) {
      alert(e?.message || 'Failed')
    }
    setSaving(false)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Ban size={16} className="text-red-500" /> Revoke Pass</h3>
        <p className="text-sm text-gray-600 mb-4">Revoke pass <span className="font-mono font-bold">{pass.pass_code}</span> for {pass.visitor_name}?</p>
        <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300" rows={2}
          placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} />
        <div className="flex gap-2 mt-4">
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2 bg-red-600 text-white text-sm rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={13} className="animate-spin" />} Revoke
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function ExtendModal({ pass, onDone, onClose }) {
  const [until, setUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!until) return
    setSaving(true)
    try {
      await api.post(`/inpatient/visitor-passes/${pass.id}/extend`, { valid_until: until })
      onDone()
    } catch (e) {
      alert(e?.message || 'Failed')
    }
    setSaving(false)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><CalendarClock size={16} className="text-blue-500" /> Extend Pass</h3>
        <p className="text-sm text-gray-600 mb-4">Current expiry: <span className="font-medium">{fmtDT(pass.valid_until)}</span></p>
        <label className="text-xs text-gray-500 font-medium">New Valid Until</label>
        <input type="datetime-local" className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
          value={until} onChange={e => setUntil(e.target.value)} />
        <div className="flex gap-2 mt-4">
          <button onClick={submit} disabled={saving || !until}
            className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={13} className="animate-spin" />} Extend
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function EditPassModal({ pass, onDone, onClose }) {
  const [form, setForm] = useState({
    visitor_name: pass.visitor_name || '',
    relation: pass.relation || '',
    visitor_mobile: pass.visitor_mobile || '',
    id_proof_type: pass.id_proof_type || '',
    id_proof_number: pass.id_proof_number || '',
    persons: pass.persons || 1,
    note: pass.note || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    setSaving(true)
    try {
      await api.put(`/inpatient/visitor-passes/${pass.id}`, form)
      onDone()
    } catch (e) {
      alert(e?.message || 'Failed')
    }
    setSaving(false)
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300'
  const labelCls = 'text-xs text-gray-500 font-medium'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-[480px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2"><Edit3 size={16} /> Edit Pass — {pass.pass_code}</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Visitor Name</label>
              <input className={`${inputCls} mt-1`} value={form.visitor_name} onChange={e => set('visitor_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Relation</label>
              <input className={`${inputCls} mt-1`} value={form.relation} onChange={e => set('relation', e.target.value)} placeholder="e.g. Wife, Son" />
            </div>
            <div>
              <label className={labelCls}>Mobile</label>
              <input className={`${inputCls} mt-1`} value={form.visitor_mobile} onChange={e => set('visitor_mobile', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Persons</label>
              <input type="number" min="1" max="10" className={`${inputCls} mt-1`} value={form.persons} onChange={e => set('persons', parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <label className={labelCls}>ID Proof Type</label>
              <select className={`${inputCls} mt-1`} value={form.id_proof_type} onChange={e => set('id_proof_type', e.target.value)}>
                <option value="">Select…</option>
                {ID_PROOFS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>ID Number</label>
              <input className={`${inputCls} mt-1`} value={form.id_proof_number} onChange={e => set('id_proof_number', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Note</label>
            <input className={`${inputCls} mt-1`} value={form.note} onChange={e => set('note', e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={13} className="animate-spin" />} Save Changes
          </button>
          <button onClick={onClose} className="px-5 py-2.5 text-sm rounded-xl border border-gray-200 hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Pass Row ──────────────────────────────────────────────────────────────────

function PassRow({ pass, onRefresh, clinicName }) {
  const [modal, setModal] = useState(null) // 'revoke' | 'extend' | 'edit' | 'print'
  const [acting, setActing] = useState(null)

  const doAction = async (action) => {
    setActing(action)
    try {
      if (action === 'checkin')  await api.post(`/inpatient/visitor-passes/${pass.id}/checkin`)
      if (action === 'checkout') await api.post(`/inpatient/visitor-passes/${pass.id}/checkout`)
      if (action === 'reprint')  await api.post(`/inpatient/visitor-passes/${pass.id}/reprint`)
      onRefresh()
    } catch (e) {
      alert(e?.message || 'Failed')
    }
    setActing(null)
  }

  const isPast = pass.valid_until && new Date(pass.valid_until) < new Date()

  return (
    <>
      <tr className="tr-hover text-sm">
        <td className="td font-mono font-bold text-blue-700">{pass.pass_code}</td>
        <td className="td">
          <div className="font-medium text-gray-800">{pass.patient_name}</div>
          <div className="text-xs text-gray-400">{pass.admission_number}</div>
        </td>
        <td className="td text-gray-600">
          {pass.ward_name || '—'}{pass.bed_number ? `/${pass.bed_number}` : ''}
        </td>
        <td className="td">
          <div className="font-medium text-gray-800">{pass.visitor_name}</div>
          <div className="text-xs text-gray-400">{pass.relation || ''}{pass.visitor_mobile ? ` · ${pass.visitor_mobile}` : ''}</div>
        </td>
        <td className="td text-center">
          <span className="text-gray-700 font-semibold">{pass.persons}</span>
          <span className="text-gray-400 text-xs"> {pass.pass_type === 'attender' ? 'AT' : 'VP'}</span>
        </td>
        <td className="td text-xs">
          <div>{fmtTime(pass.valid_from)}</div>
          <div className={isPast && pass.status !== 'revoked' ? 'text-red-500 font-medium' : 'text-gray-500'}>{fmtTime(pass.valid_until)}</div>
        </td>
        <td className="td"><PassBadge status={pass.status} /></td>
        <td className="td">
          <div className="flex items-center gap-1 flex-wrap">
            {pass.status === 'active' && !isPast && (
              <button onClick={() => doAction('checkin')} disabled={acting === 'checkin'}
                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition" title="Check In">
                {acting === 'checkin' ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={12} />}
              </button>
            )}
            {pass.status === 'checked_in' && (
              <button onClick={() => doAction('checkout')} disabled={acting === 'checkout'}
                className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition" title="Check Out">
                {acting === 'checkout' ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
              </button>
            )}
            {['active', 'checked_in'].includes(pass.status) && (
              <>
                <button onClick={() => setModal('extend')} className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition" title="Extend">
                  <CalendarClock size={12} />
                </button>
                <button onClick={() => setModal('revoke')} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition" title="Revoke">
                  <Ban size={12} />
                </button>
              </>
            )}
            {pass.status !== 'revoked' && (
              <button onClick={() => setModal('edit')} className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 transition" title="Edit">
                <Edit3 size={12} />
              </button>
            )}
            <button onClick={() => { doAction('reprint'); setModal('print') }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition" title="Print">
              <Printer size={12} />
            </button>
          </div>
        </td>
      </tr>

      {modal === 'revoke' && <RevokeModal pass={pass} onDone={() => { setModal(null); onRefresh() }} onClose={() => setModal(null)} />}
      {modal === 'extend' && <ExtendModal pass={pass} onDone={() => { setModal(null); onRefresh() }} onClose={() => setModal(null)} />}
      {modal === 'edit'   && <EditPassModal pass={pass} onDone={() => { setModal(null); onRefresh() }} onClose={() => setModal(null)} />}
      {modal === 'print'  && <PrintSlip pass={pass} clinicName={clinicName} onClose={() => setModal(null)} />}
    </>
  )
}

// ── Issue Pass Tab ────────────────────────────────────────────────────────────

function IssuePassTab({ onIssued, user }) {
  const isManager = ['clinic_admin', 'clinic_manager'].includes(user?.role)

  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)   // { admission_id, patient_id, patient_name, ward_name, bed_number, admission_number, ... }
  const timer = useRef(null)

  const [form, setForm] = useState({
    pass_type: 'visit',
    visitor_name: '', relation: '', visitor_mobile: '',
    id_proof_type: '', id_proof_number: '',
    persons: 1,
    valid_from: '', valid_until: '',
    note: '', override_note: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [issued, setIssued] = useState(null)
  const [printSlip, setPrintSlip] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await api.get('/inpatient/admissions/search', { params: { q: q.trim() } })
        setResults(Array.isArray(r) ? r : [])
      } catch { setResults([]) }
      setSearching(false)
    }, 300)
    return () => timer.current && clearTimeout(timer.current)
  }, [q])

  const initTimes = () => {
    const now = istNow()
    const pad = n => String(n).padStart(2, '0')
    const dateStr = now.toISOString().slice(0, 10)
    const fromStr = `${dateStr}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    const endHour = Math.min(now.getHours() + 3, 23)
    const toStr = `${dateStr}T${pad(endHour)}:00`
    setForm(f => ({ ...f, valid_from: fromStr, valid_until: toStr }))
  }

  const pickAdmission = (adm) => {
    setSelected(adm)
    setResults([])
    setQ('')
    initTimes()
  }

  const submit = async () => {
    if (!selected) { setError('Select a patient first'); return }
    if (!form.visitor_name.trim()) { setError('Visitor name is required'); return }
    if (!form.valid_from || !form.valid_until) { setError('Set valid from and until times'); return }
    setSaving(true); setError('')
    try {
      const body = {
        admission_id: selected.admission_id,
        pass_type: form.pass_type,
        visitor_name: form.visitor_name.trim(),
        relation: form.relation || null,
        visitor_mobile: form.visitor_mobile || null,
        id_proof_type: form.id_proof_type || null,
        id_proof_number: form.id_proof_number || null,
        persons: parseInt(form.persons) || 1,
        valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
        note: form.note || null,
        override_note: isManager ? (form.override_note || null) : null,
      }
      const r = await api.post('/inpatient/visitor-passes', body)
      setIssued(r)
      onIssued(r)
    } catch (e) {
      setError(e?.message || 'Failed to issue pass')
    }
    setSaving(false)
  }

  const reset = () => {
    setIssued(null); setSelected(null); setQ(''); setResults([])
    setForm({ pass_type: 'visit', visitor_name: '', relation: '', visitor_mobile: '', id_proof_type: '', id_proof_number: '', persons: 1, valid_from: '', valid_until: '', note: '', override_note: '' })
    setError('')
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300'
  const labelCls = 'text-xs font-medium text-gray-500 mb-1 block'

  if (issued) {
    return (
      <div className="max-w-lg mx-auto text-center py-8">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Pass Issued!</h2>
        <div className="text-4xl font-mono font-bold text-blue-700 my-4 tracking-widest">{issued.pass_code}</div>
        <div className="text-sm text-gray-600 mb-1">{issued.patient_name} · {issued.ward_name ? `${issued.ward_name}${issued.bed_number ? `/${issued.bed_number}` : ''}` : 'No ward assigned'}</div>
        <div className="text-sm text-gray-500">Visitor: <span className="font-medium">{issued.visitor_name}</span> ({issued.relation || 'Unknown'}) · {issued.persons} person{issued.persons !== 1 ? 's' : ''}</div>
        <div className="text-sm text-gray-400 mt-1">Valid: {fmtDT(issued.valid_from)} → {fmtDT(issued.valid_until)}</div>
        {issued.override_note && (
          <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Manager Override: {issued.override_note}
          </div>
        )}
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={() => setPrintSlip(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700">
            <Printer size={14} /> Print Pass
          </button>
          <button onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 text-sm rounded-xl font-medium hover:bg-gray-50">
            <Plus size={14} /> Issue Another
          </button>
        </div>
        {printSlip && <PrintSlip pass={issued} clinicName={user?.clinic_name} onClose={() => setPrintSlip(false)} />}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Patient search */}
      {!selected ? (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Search Admitted Patient</h3>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            {searching && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
            <input autoFocus className={inputCls + ' pl-9'} value={q} onChange={e => setQ(e.target.value)}
              placeholder="Name, mobile, admission number…" />
          </div>
          {q.length >= 2 && (
            <div className="mt-2 divide-y divide-gray-50 rounded-xl border border-gray-100 max-h-72 overflow-auto">
              {results.length === 0 && !searching && (
                <p className="px-4 py-4 text-sm text-gray-400 text-center">No admitted patients found</p>
              )}
              {results.map(r => (
                <button key={r.admission_id} onClick={() => pickAdmission(r)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 transition flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{r.patient_name}</p>
                    <p className="text-xs text-gray-400">{r.admission_number} · {r.mobile || 'no mobile'}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div className="flex items-center gap-1"><BedDouble size={11} /> {r.ward_name || 'No ward'}{r.bed_number ? `/${r.bed_number}` : ''}</div>
                    <div className="text-gray-400">{r.dept_name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {q.length < 2 && <p className="text-xs text-gray-400 mt-2">Type at least 2 characters to search</p>}
        </div>
      ) : (
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">{selected.patient_name}</p>
            <p className="text-xs text-gray-500">
              {selected.admission_number} ·{' '}
              <span className="font-medium">{selected.ward_name || 'No ward'}{selected.bed_number ? `/${selected.bed_number}` : ''}</span>
            </p>
          </div>
          <button onClick={() => setSelected(null)} className="text-xs text-blue-600 hover:underline font-medium">Change</button>
        </div>
      )}

      {selected && (
        <div className="card p-5 space-y-4">
          {/* Pass type */}
          <div>
            <label className={labelCls}>Pass Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: 'visit', label: 'Visit Pass', desc: 'Short visit' }, { v: 'attender', label: 'Attender Pass', desc: 'Stay with patient' }].map(opt => (
                <button key={opt.v} onClick={() => set('pass_type', opt.v)}
                  className={`flex flex-col items-start px-4 py-3 rounded-xl border text-left transition ${form.pass_type === opt.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'}`}>
                  <span className="font-semibold text-sm">{opt.label}</span>
                  <span className={`text-xs mt-0.5 ${form.pass_type === opt.v ? 'text-blue-100' : 'text-gray-400'}`}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Visitor details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Visitor Full Name *</label>
              <input className={inputCls} value={form.visitor_name} onChange={e => set('visitor_name', e.target.value)} placeholder="e.g. Anita Kumar" />
            </div>
            <div>
              <label className={labelCls}>Relation to Patient</label>
              <input className={inputCls} value={form.relation} onChange={e => set('relation', e.target.value)} placeholder="e.g. Wife, Son" />
            </div>
            <div>
              <label className={labelCls}>Visitor Mobile</label>
              <input className={inputCls} value={form.visitor_mobile} onChange={e => set('visitor_mobile', e.target.value)} placeholder="10-digit mobile" />
            </div>
            <div>
              <label className={labelCls}>ID Proof Type</label>
              <select className={inputCls} value={form.id_proof_type} onChange={e => set('id_proof_type', e.target.value)}>
                <option value="">Select…</option>
                {ID_PROOFS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>ID Proof Number</label>
              <input className={inputCls} value={form.id_proof_number} onChange={e => set('id_proof_number', e.target.value)} placeholder="ID number" />
            </div>
            <div>
              <label className={labelCls}>Number of Persons</label>
              <input type="number" min="1" max="10" className={inputCls} value={form.persons} onChange={e => set('persons', e.target.value)} />
            </div>
          </div>

          {/* Visit window */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Valid From</label>
              <input type="datetime-local" className={inputCls} value={form.valid_from} onChange={e => set('valid_from', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Valid Until</label>
              <input type="datetime-local" className={inputCls} value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Note (optional)</label>
            <input className={inputCls} value={form.note} onChange={e => set('note', e.target.value)} placeholder="Any special instructions" />
          </div>

          {isManager && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <label className="text-xs font-semibold text-amber-800 mb-1 block flex items-center gap-1">
                <ShieldAlert size={12} /> Manager Override Note (bypasses policy limits)
              </label>
              <input className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-100"
                value={form.override_note} onChange={e => set('override_note', e.target.value)} placeholder="Reason for override (leave blank to use normal policy)" />
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button onClick={submit} disabled={saving}
              className="px-8 py-2.5 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              <Ticket size={14} /> Issue Pass
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Gate Log Tab ──────────────────────────────────────────────────────────────

function GateLogTab({ user }) {
  const [passes, setPasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(istToday())
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyResult, setVerifyResult] = useState(null)
  const [verifying, setVerifying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 200 }
      if (date) params.date = date
      if (statusFilter) params.status = statusFilter
      if (search.trim()) params.q = search.trim()
      const r = await api.get('/inpatient/visitor-passes', { params })
      setPasses(Array.isArray(r) ? r : [])
    } catch { setPasses([]) }
    setLoading(false)
  }, [date, statusFilter, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const h = () => load()
    window.addEventListener('bharatcliniq:refresh', h)
    return () => window.removeEventListener('bharatcliniq:refresh', h)
  }, [load])

  const verify = async () => {
    if (!verifyCode.trim()) return
    setVerifying(true); setVerifyResult(null)
    try {
      const r = await api.get(`/inpatient/visitor-passes/verify/${verifyCode.trim().toUpperCase()}`)
      setVerifyResult({ ok: true, pass: r })
    } catch (e) {
      setVerifyResult({ ok: false, msg: e?.message || 'Pass not found' })
    }
    setVerifying(false)
  }

  const stats = {
    active:      passes.filter(p => p.status === 'active').length,
    checked_in:  passes.filter(p => p.status === 'checked_in').length,
    checked_out: passes.filter(p => p.status === 'checked_out').length,
    revoked:     passes.filter(p => p.status === 'revoked').length,
  }

  return (
    <div className="space-y-4">
      {/* Gate verify bar */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <ScanLine size={15} className="text-blue-600" />
          <span className="font-semibold text-gray-700 text-sm">Gate Verify</span>
        </div>
        <div className="flex gap-2">
          <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 uppercase"
            value={verifyCode} onChange={e => setVerifyCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && verify()}
            placeholder="Enter pass code (VP-XXXXXX)…" />
          <button onClick={verify} disabled={verifying}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {verifying ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />} Verify
          </button>
        </div>
        {verifyResult && (
          <div className={`mt-3 p-4 rounded-xl border ${verifyResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            {verifyResult.ok ? (
              <div className="flex items-start gap-3">
                <BadgeCheck size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-bold text-green-800">{verifyResult.pass.pass_code} — <span className="capitalize">{STATUS_LABELS[verifyResult.pass.status]}</span>{verifyResult.pass.expired ? ' (EXPIRED)' : ''}</div>
                  <div className="text-green-700 mt-0.5">Patient: <b>{verifyResult.pass.patient_name}</b> · {verifyResult.pass.ward_name || 'No ward'}</div>
                  <div className="text-green-600">Visitor: {verifyResult.pass.visitor_name} ({verifyResult.pass.relation || '—'}) · {verifyResult.pass.persons} person{verifyResult.pass.persons !== 1 ? 's' : ''}</div>
                  <div className="text-green-600 text-xs mt-1">Valid: {fmtDT(verifyResult.pass.valid_from)} → {fmtDT(verifyResult.pass.valid_until)}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle size={16} /> {verifyResult.msg}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: '', label: 'All', value: passes.length, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
          { key: 'active', label: 'Active', value: stats.active, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { key: 'checked_in', label: 'Inside', value: stats.checked_in, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { key: 'revoked', label: 'Revoked', value: stats.revoked, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
        ].map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)}
            className={`card p-3 text-center border transition ${s.bg} ${statusFilter === s.key ? 'ring-2 ring-blue-400' : ''}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
            <div className={`text-xs font-medium ${s.color}`}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
          value={date} onChange={e => setDate(e.target.value)} />
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full pl-9 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code, visitor, patient…" />
        </div>
        <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="checked_in">Checked In</option>
          <option value="checked_out">Checked Out</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
        ) : passes.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Ticket size={32} className="mx-auto mb-2 opacity-30" />
            <p>No visitor passes found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Pass Code</th>
                  <th className="th">Patient</th>
                  <th className="th">Ward/Bed</th>
                  <th className="th">Visitor</th>
                  <th className="th text-center">Persons</th>
                  <th className="th">From/Until</th>
                  <th className="th">Status</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {passes.map(p => <PassRow key={p.id} pass={p} onRefresh={load} clinicName={user?.clinic_name} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Policies Tab ──────────────────────────────────────────────────────────────

function PoliciesTab({ user }) {
  const isManager = ['clinic_admin', 'clinic_manager'].includes(user?.role)
  const [policies, setPolicies] = useState([])
  const [wards, setWards] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/inpatient/visitor-policies').catch(() => []),
      api.get('/inpatient/wards').catch(() => []),
    ]).then(([pol, w]) => {
      setPolicies(Array.isArray(pol) ? pol : [])
      setWards(Array.isArray(w) ? w : [])
      setLoading(false)
    })
  }, [])

  const getPolicy = (wardId) => {
    const p = policies.find(p => (wardId ? p.ward_id === wardId : p.ward_id === null))
    return p || { visit_start: '10:00', visit_end: '20:00', max_active: 5, max_persons: 2, attender_allowed: true, lockdown: false }
  }

  const setField = (wardId, field, value) => {
    setPolicies(prev => {
      const existing = prev.find(p => (wardId ? p.ward_id === wardId : p.ward_id === null))
      if (existing) {
        return prev.map(p => (wardId ? p.ward_id === wardId : p.ward_id === null) ? { ...p, [field]: value } : p)
      }
      return [...prev, { ward_id: wardId || null, [field]: value, visit_start: '10:00', visit_end: '20:00', max_active: 5, max_persons: 2, attender_allowed: true, lockdown: false }]
    })
  }

  const save = async (wardId) => {
    const pol = getPolicy(wardId)
    setSaving(true)
    try {
      const r = await api.put('/inpatient/visitor-policies', { ...pol, ward_id: wardId || null })
      setPolicies(prev => {
        const exists = prev.find(p => (wardId ? p.ward_id === wardId : p.ward_id === null))
        if (exists) return prev.map(p => (wardId ? p.ward_id === wardId : p.ward_id === null) ? r : p)
        return [...prev, r]
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      alert(e?.message || 'Failed')
    }
    setSaving(false)
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-300" /></div>

  const PolicyCard = ({ wardId, wardName }) => {
    const pol = getPolicy(wardId)
    return (
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {wardId ? <BedDouble size={15} className="text-blue-500" /> : <Settings size={15} className="text-gray-400" />}
            <h3 className="font-semibold text-gray-800">{wardName}</h3>
          </div>
          {pol.lockdown && (
            <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full border border-red-200">LOCKDOWN</span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 font-medium">Visit Start</label>
            <input type="time" disabled={!isManager}
              className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 disabled:bg-gray-50 disabled:text-gray-400"
              value={pol.visit_start || '10:00'}
              onChange={e => setField(wardId, 'visit_start', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Visit End</label>
            <input type="time" disabled={!isManager}
              className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 disabled:bg-gray-50 disabled:text-gray-400"
              value={pol.visit_end || '20:00'}
              onChange={e => setField(wardId, 'visit_end', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Max Active Passes</label>
            <input type="number" min="1" max="50" disabled={!isManager}
              className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 disabled:bg-gray-50 disabled:text-gray-400"
              value={pol.max_active}
              onChange={e => setField(wardId, 'max_active', parseInt(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Max Persons/Pass</label>
            <input type="number" min="1" max="10" disabled={!isManager}
              className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 disabled:bg-gray-50 disabled:text-gray-400"
              value={pol.max_persons}
              onChange={e => setField(wardId, 'max_persons', parseInt(e.target.value))} />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" disabled={!isManager} checked={!!pol.attender_allowed}
              onChange={e => setField(wardId, 'attender_allowed', e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-sm text-gray-700">Attender passes allowed</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" disabled={!isManager} checked={!!pol.lockdown}
              onChange={e => setField(wardId, 'lockdown', e.target.checked)}
              className="w-4 h-4 rounded accent-red-600" />
            <span className="text-sm text-gray-700">Full Lockdown (no new passes)</span>
          </label>
        </div>

        {isManager && (
          <div className="flex justify-end">
            <button onClick={() => save(wardId)} disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saved ? <><CheckCircle size={13} /> Saved</> : 'Save'}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!isManager && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <ShieldAlert size={14} /> Only managers can edit visiting policies.
        </div>
      )}
      <PolicyCard wardId={null} wardName="Hospital-wide Default" />
      {wards.map(w => <PolicyCard key={w.id} wardId={w.id} wardName={w.name} />)}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VisitorDesk() {
  const { user } = useAuth()
  const [tab, setTab] = useState('issue')
  const [lastIssued, setLastIssued] = useState(null)

  const tabs = [
    { id: 'issue',    label: 'Issue Pass',       icon: Ticket },
    { id: 'gate',     label: 'Gate Log',         icon: UserCheck },
    { id: 'policies', label: 'Visiting Policies', icon: Settings },
  ]

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-2xl">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
                tab === t.id ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'issue'    && <IssuePassTab onIssued={p => { setLastIssued(p); }} user={user} />}
      {tab === 'gate'     && <GateLogTab user={user} />}
      {tab === 'policies' && <PoliciesTab user={user} />}
    </div>
  )
}
