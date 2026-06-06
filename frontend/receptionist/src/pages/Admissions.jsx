import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import {
  Plus, Search, RefreshCw, BedDouble, UserCheck, LogOut,
  ArrowRightLeft, X, ChevronDown, ChevronUp, Loader2, AlertCircle,
  Clock, Filter,
} from 'lucide-react'

// ── PrimaryDrModal ────────────────────────────────────────────────────────────
function PrimaryDrModal({ admission, onClose, onSuccess }) {
  const [doctors, setDoctors]   = useState([])
  const [query, setQuery]       = useState('')
  const [selected, setSelected] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  useEffect(() => {
    api.get('/staff/?role=doctor')
      .then(r => setDoctors(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => {})
  }, [])

  const filtered = query.length > 0
    ? doctors.filter(d => (d.full_name || d.email || '').toLowerCase().includes(query.toLowerCase()))
    : doctors

  const assign = async () => {
    if (!selected) return
    setSaving(true); setErr('')
    try {
      await api.patch(`/inpatient/admissions/${admission.id}/primary-doctor`, { primary_doctor_id: selected.id })
      onSuccess(`Primary doctor assigned: ${selected.full_name || selected.email}`)
    } catch (_) {
      try {
        await api.patch(`/inpatient/admissions/${admission.id}`, { primary_doctor_id: selected.id })
        onSuccess(`Primary doctor assigned: ${selected.full_name || selected.email}`)
      } catch (ex2) {
        setErr(ex2?.response?.data?.detail || ex2.message || 'Failed to assign doctor')
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0F2557' }}>Assign Primary Doctor</h2>
            <p className="text-sm text-gray-500">{admission.patient_name || `Admission #${admission.admission_number}`}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search doctor…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">No doctors found</p>
            ) : filtered.map(d => (
              <button key={d.id} type="button"
                onClick={() => setSelected(d)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selected?.id === d.id ? 'bg-blue-50 text-blue-800 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>
                {d.full_name || d.email}
                {d.specialization && <span className="text-xs text-gray-400 ml-2">{d.specialization}</span>}
              </button>
            ))}
          </div>
          {err && <p className="text-red-600 text-sm flex items-center gap-1"><AlertCircle size={14} />{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="button" disabled={!selected || saving} onClick={assign}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: '#0F2557' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
              {saving ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function relTime(dt) {
  if (!dt) return '—'
  const diff = Date.now() - new Date(dt)
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function statusBadge(status) {
  const map = {
    active: 'bg-green-100 text-green-800',
    discharge_pending: 'bg-amber-100 text-amber-800',
    discharged: 'bg-gray-100 text-gray-600',
    transferred: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status?.replace('_', ' ')}
    </span>
  )
}

function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
      ${type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
      {type === 'error' ? <AlertCircle size={16} /> : <UserCheck size={16} />}
      {msg}
      <button onClick={onClose}><X size={14} /></button>
    </div>
  )
}

// ── AdmitPatientModal ─────────────────────────────────────────────────────────
function AdmitPatientModal({ onClose, onSuccess }) {
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [departments, setDepartments] = useState([])
  const [insuranceOpen, setInsuranceOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({
    admitting_doctor_id: '',
    department_id: '',
    admission_type: 'direct',
    primary_diagnosis: '',
    expected_discharge: '',
    tpa_id: '',
    insurance_company: '',
    policy_number: '',
    pre_auth_number: '',
  })

  useEffect(() => {
    api.get('/staff/?role=doctor')
      .then(r => setDoctors(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => {})
    api.get('/inpatient/departments')
      .then(r => setDepartments(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (patientSearch.length < 2) { setPatientResults([]); return }
    const t = setTimeout(() => {
      api.get(`/patients/?search=${encodeURIComponent(patientSearch)}`)
        .then(r => setPatientResults((Array.isArray(r) ? r : (r?.items || r?.data || [])).slice(0, 8)))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [patientSearch])

  const submit = async e => {
    e.preventDefault()
    if (!selectedPatient) { setErr('Please select a patient'); return }
    setSaving(true); setErr('')
    try {
      const payload = {
        patient_id: selectedPatient.id,
        admitting_doctor_id: form.admitting_doctor_id ? parseInt(form.admitting_doctor_id) : undefined,
        department_id: form.department_id ? parseInt(form.department_id) : undefined,
        admission_type: form.admission_type,
        primary_diagnosis: form.primary_diagnosis,
        expected_discharge: form.expected_discharge || undefined,
        tpa_id: form.tpa_id || undefined,
        insurance_company: form.insurance_company || undefined,
        policy_number: form.policy_number || undefined,
        pre_auth_number: form.pre_auth_number || undefined,
      }
      await api.post('/inpatient/admissions', payload)
      onSuccess('Admission created successfully')
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to create admission')
    } finally { setSaving(false) }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold" style={{ color: '#0F2557' }}>New Admission</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {/* Patient search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-200">
                <div>
                  <div className="font-semibold text-sm">{selectedPatient.full_name}</div>
                  <div className="text-xs text-gray-500">{selectedPatient.clinic_patient_id || `#${selectedPatient.id}`}</div>
                </div>
                <button type="button" onClick={() => { setSelectedPatient(null); setPatientSearch('') }}
                  className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Search by name or UHID…"
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                {patientResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {patientResults.map(p => (
                      <button key={p.id} type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm"
                        onClick={() => { setSelectedPatient(p); setPatientSearch(''); setPatientResults([]) }}>
                        <span className="font-medium">{p.full_name}</span>
                        <span className="text-gray-400 ml-2 text-xs">{p.clinic_patient_id || `#${p.id}`}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Doctor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admitting Doctor</label>
            <select className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.admitting_doctor_id} onChange={e => f('admitting_doctor_id', e.target.value)}>
              <option value="">Select doctor</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name || d.email}</option>)}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.department_id} onChange={e => f('department_id', e.target.value)}>
              <option value="">Select department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Admission type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Admission Type *</label>
            <div className="flex gap-3">
              {[['opd_referred', 'OPD Referred'], ['direct', 'Direct'], ['emergency', 'Emergency']].map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="admission_type" value={val}
                    checked={form.admission_type === val} onChange={() => f('admission_type', val)}
                    className="accent-blue-600" />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Primary diagnosis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Diagnosis</label>
            <textarea className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3} value={form.primary_diagnosis} onChange={e => f('primary_diagnosis', e.target.value)}
              placeholder="Provisional diagnosis…" />
          </div>

          {/* Expected discharge */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Discharge</label>
            <input type="date" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.expected_discharge} onChange={e => f('expected_discharge', e.target.value)}
              min={new Date().toISOString().split('T')[0]} />
          </div>

          {/* Insurance — collapsible */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setInsuranceOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Insurance / TPA (Optional)
              {insuranceOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {insuranceOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                {[
                  ['tpa_id', 'TPA ID'],
                  ['insurance_company', 'Insurance Company'],
                  ['policy_number', 'Policy Number'],
                  ['pre_auth_number', 'Pre-Auth Number'],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form[key]} onChange={e => f(key, e.target.value)} placeholder={label} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {err && <p className="text-red-600 text-sm flex items-center gap-1"><AlertCircle size={14} />{err}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: '#0F2557' }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {saving ? 'Creating…' : 'Create Admission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── DischargeModal ────────────────────────────────────────────────────────────
function DischargeModal({ admission, onClose, onSuccess }) {
  const [form, setForm] = useState({ discharge_type: 'regular', discharge_reason: '', discharge_notes: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const submit = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await api.post(`/inpatient/admissions/${admission.id}/discharge`, form)
      onSuccess('Patient discharged successfully')
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Discharge failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0F2557' }}>Complete Discharge</h2>
            <p className="text-sm text-gray-500">{admission.patient_name || `Admission #${admission.admission_number}`}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Type *</label>
            <select className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.discharge_type} onChange={e => f('discharge_type', e.target.value)} required>
              <option value="regular">Regular</option>
              <option value="against_advice">Against Medical Advice (LAMA)</option>
              <option value="death">Death</option>
              <option value="transferred">Transferred</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Reason</label>
            <input className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.discharge_reason} onChange={e => f('discharge_reason', e.target.value)}
              placeholder="e.g. Recovered, stable condition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Notes</label>
            <textarea className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4} value={form.discharge_notes} onChange={e => f('discharge_notes', e.target.value)}
              placeholder="Final notes, instructions for patient…" />
          </div>
          {err && <p className="text-red-600 text-sm flex items-center gap-1"><AlertCircle size={14} />{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
              {saving ? 'Processing…' : 'Confirm Discharge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── TransferModal ─────────────────────────────────────────────────────────────
function TransferModal({ admission, onClose, onSuccess }) {
  const [departments, setDepartments] = useState([])
  const [wards, setWards] = useState([])
  const [beds, setBeds] = useState([])
  const [form, setForm] = useState({ to_department_id: '', to_ward_id: '', to_bed_id: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    api.get('/inpatient/departments').then(r => setDepartments(Array.isArray(r) ? r : (r?.items || r?.data || []))).catch(() => {})
  }, [])

  useEffect(() => {
    if (!form.to_department_id) { setWards([]); setBeds([]); f('to_ward_id', ''); f('to_bed_id', ''); return }
    api.get(`/inpatient/wards?department_id=${form.to_department_id}`)
      .then(r => setWards(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => {})
  }, [form.to_department_id])

  useEffect(() => {
    if (!form.to_ward_id) { setBeds([]); f('to_bed_id', ''); return }
    api.get(`/inpatient/beds?ward_id=${form.to_ward_id}`)
      .then(r => setBeds((Array.isArray(r) ? r : (r?.items || r?.data || [])).filter(b => b.status === 'vacant')))
      .catch(() => {})
  }, [form.to_ward_id])

  const submit = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      const payload = {
        to_department_id: form.to_department_id ? parseInt(form.to_department_id) : undefined,
        to_ward_id: form.to_ward_id ? parseInt(form.to_ward_id) : undefined,
        to_bed_id: form.to_bed_id ? parseInt(form.to_bed_id) : undefined,
        reason: form.reason,
      }
      await api.post(`/inpatient/admissions/${admission.id}/transfer`, payload)
      onSuccess('Transfer initiated successfully')
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Transfer failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0F2557' }}>Transfer Patient</h2>
            <p className="text-sm text-gray-500">{admission.patient_name || `Admission #${admission.admission_number}`}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Department</label>
            <select className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.to_department_id} onChange={e => f('to_department_id', e.target.value)}>
              <option value="">Select department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Ward</label>
            <select className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.to_ward_id} onChange={e => f('to_ward_id', e.target.value)} disabled={!wards.length}>
              <option value="">Select ward</option>
              {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Bed (vacant only)</label>
            <select className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.to_bed_id} onChange={e => f('to_bed_id', e.target.value)} disabled={!beds.length}>
              <option value="">Select bed</option>
              {beds.map(b => <option key={b.id} value={b.id}>{b.bed_number}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <textarea className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3} value={form.reason} onChange={e => f('reason', e.target.value)}
              placeholder="Reason for transfer…" required />
          </div>
          {err && <p className="text-red-600 text-sm flex items-center gap-1"><AlertCircle size={14} />{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: '#0F2557' }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <ArrowRightLeft size={15} />}
              {saving ? 'Transferring…' : 'Confirm Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── AssignBedModal ─────────────────────────────────────────────────────────────
function AssignBedModal({ bed, admissions, onClose, onSuccess }) {
  const [selectedAdmission, setSelectedAdmission] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const unassigned = admissions.filter(a => !a.bed_id && a.status === 'active')

  const submit = async e => {
    e.preventDefault()
    if (!selectedAdmission) { setErr('Please select an admission'); return }
    setSaving(true); setErr('')
    try {
      await api.patch(`/inpatient/beds/${bed.id}`, { status: 'occupied', current_admission_id: parseInt(selectedAdmission) })
      await api.patch(`/inpatient/admissions/${selectedAdmission}`, { bed_id: bed.id, ward_id: bed.ward_id })
      onSuccess('Bed assigned successfully')
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Assignment failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0F2557' }}>Assign Bed {bed.bed_number}</h2>
            <p className="text-sm text-gray-500">{bed.ward_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {unassigned.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No unassigned active admissions</p>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Patient (Admitted, No Bed)</label>
              <select className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedAdmission} onChange={e => setSelectedAdmission(e.target.value)} required>
                <option value="">Select patient…</option>
                {unassigned.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.patient_name} — #{a.admission_number}
                  </option>
                ))}
              </select>
            </div>
          )}
          {err && <p className="text-red-600 text-sm flex items-center gap-1"><AlertCircle size={14} />{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving || unassigned.length === 0}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: '#0F2557' }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <BedDouble size={15} />}
              {saving ? 'Assigning…' : 'Assign Bed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── BedBoardPanel ─────────────────────────────────────────────────────────────
function BedBoardPanel({ allAdmissions, onAssignBed, refresh }) {
  const [departments, setDepartments] = useState([])
  const [board, setBoard] = useState([])
  const [loading, setLoading] = useState(true)
  const [deptFilter, setDeptFilter] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const params = deptFilter ? `?department_id=${deptFilter}` : ''
    api.get(`/inpatient/beds/board${params}`)
      .then(r => setBoard(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [deptFilter])

  useEffect(() => {
    api.get('/inpatient/departments').then(r => setDepartments(Array.isArray(r) ? r : (r?.items || r?.data || []))).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load, refresh])

  // Group beds by ward
  const wardMap = {}
  board.forEach(bed => {
    const key = bed.ward_id || 'unknown'
    if (!wardMap[key]) wardMap[key] = { id: key, name: bed.ward_name || 'Unknown Ward', floor: bed.floor || '', beds: [] }
    wardMap[key].beds.push(bed)
  })
  const wards = Object.values(wardMap)

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Filter size={15} className="text-gray-400" />
        <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-gray-400" />
        </div>
      ) : wards.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BedDouble size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No wards configured</p>
          <p className="text-sm">Configure wards in Hospital Settings</p>
        </div>
      ) : (
        <div className="space-y-5">
          {wards.map(ward => (
            <div key={ward.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
                style={{ background: '#F8FAFF' }}>
                <div>
                  <span className="font-semibold text-sm" style={{ color: '#0F2557' }}>{ward.name}</span>
                  {ward.floor && <span className="ml-2 text-xs text-gray-400">Floor {ward.floor}</span>}
                </div>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />
                    {ward.beds.filter(b => b.status === 'vacant').length} vacant
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                    {ward.beds.filter(b => b.status === 'occupied').length} occupied
                  </span>
                </div>
              </div>
              <div className="p-4 flex flex-wrap gap-2">
                {ward.beds.map(bed => (
                  <BedChip key={bed.id} bed={bed}
                    onClick={() => bed.status === 'vacant' ? onAssignBed(bed) : null} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BedChip({ bed, onClick }) {
  const isVacant = bed.status === 'vacant'
  const isMaint = bed.status === 'maintenance'
  const isOccupied = bed.status === 'occupied'

  return (
    <button
      onClick={onClick}
      disabled={!isVacant}
      className={`rounded-xl px-3 py-2 text-left transition-all min-w-[100px] max-w-[140px]
        ${isVacant ? 'bg-green-50 border border-green-200 hover:border-green-400 hover:shadow-sm cursor-pointer' : ''}
        ${isOccupied ? 'bg-red-50 border border-red-200 cursor-default' : ''}
        ${isMaint ? 'bg-gray-100 border border-gray-200 cursor-default opacity-60' : ''}
      `}
    >
      <div className={`text-xs font-bold ${isVacant ? 'text-green-700' : isOccupied ? 'text-red-700' : 'text-gray-500'}`}>
        {bed.bed_number}
      </div>
      {isOccupied && (
        <>
          <div className="text-xs font-medium text-gray-700 truncate mt-0.5">{bed.patient_name || '—'}</div>
          <div className="text-xs text-gray-400 truncate">{bed.admission_number || ''}</div>
        </>
      )}
      {isVacant && <div className="text-xs text-green-600">Vacant</div>}
      {isMaint && <div className="text-xs text-gray-400">Maintenance</div>}
    </button>
  )
}

// ── Main Admissions Page ──────────────────────────────────────────────────────
export default function Admissions() {
  const { user } = useAuth()
  const [tab, setTab] = useState('active')
  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [departments, setDepartments] = useState([])
  const [showAdmit, setShowAdmit] = useState(false)
  const [dischargeTarget, setDischargeTarget] = useState(null)
  const [transferTarget, setTransferTarget] = useState(null)
  const [assignBedTarget, setAssignBedTarget] = useState(null)
  const [primaryDrTarget, setPrimaryDrTarget] = useState(null)
  const [toast, setToast] = useState(null)
  const [refresh, setRefresh] = useState(0)

  const showToast = (msg, type = 'success') => setToast({ msg, type })
  const hideToast = () => setToast(null)

  const loadAdmissions = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (deptFilter) params.set('department_id', deptFilter)
    api.get(`/inpatient/admissions?${params}`)
      .then(r => setAdmissions(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [statusFilter, deptFilter])

  useEffect(() => {
    api.get('/inpatient/departments').then(r => setDepartments(Array.isArray(r) ? r : (r?.items || r?.data || []))).catch(() => {})
  }, [])

  useEffect(() => { loadAdmissions() }, [loadAdmissions, refresh])

  // Discharge queue uses its own call
  const [dischargeQueue, setDischargeQueue] = useState([])
  const [dqLoading, setDqLoading] = useState(false)
  useEffect(() => {
    if (tab !== 'discharge') return
    setDqLoading(true)
    api.get('/inpatient/admissions?status=discharge_pending')
      .then(r => setDischargeQueue(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => {})
      .finally(() => setDqLoading(false))
  }, [tab, refresh])

  const handleSuccess = msg => {
    showToast(msg)
    setRefresh(v => v + 1)
    setShowAdmit(false)
    setDischargeTarget(null)
    setTransferTarget(null)
    setAssignBedTarget(null)
    setPrimaryDrTarget(null)
  }

  if (user?.org_type !== 'hospital') {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <BedDouble size={40} className="mx-auto mb-3 opacity-30" />
          <p>IPD features are only available for hospital accounts.</p>
        </div>
      </div>
    )
  }

  const TABS = [
    { key: 'active', label: 'Active Admissions' },
    { key: 'board', label: 'Bed Board' },
    { key: 'discharge', label: 'Discharge Queue' },
  ]

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F2557' }}>Admissions (IPD)</h1>
          <p className="text-sm text-gray-500 mt-0.5">Inpatient desk — admissions, beds &amp; discharges</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRefresh(v => v + 1)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50">
            <RefreshCw size={14} />Refresh
          </button>
          <button onClick={() => setShowAdmit(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#0F2557' }}>
            <Plus size={15} />New Admission
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
              ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Active Admissions Tab ── */}
      {tab === 'active' && (
        <div>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="active">Active</option>
              <option value="discharge_pending">Discharge Pending</option>
              <option value="discharged">Discharged</option>
              <option value="">All Statuses</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-gray-400" />
            </div>
          ) : admissions.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
              <BedDouble size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">No admissions found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting filters or create a new admission.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100" style={{ background: '#F8FAFF' }}>
                      {['Admission #', 'Patient', 'UHID', 'Department', 'Ward / Bed', 'Doctor', 'Primary Dr', 'Admitted', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {admissions.map(a => (
                      <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: '#0F2557' }}>{a.admission_number || `#${a.id}`}</td>
                        <td className="px-4 py-3 font-medium">{a.patient_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{a.patient_uhid || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{a.department_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{a.ward_name ? `${a.ward_name} / ${a.bed_number || '—'}` : '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{a.admitting_doctor_name || '—'}</td>
                        <td className="px-4 py-3">
                          {a.primary_doctor_name
                            ? <span className="text-sm font-medium text-blue-700">{a.primary_doctor_name}</span>
                            : <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          <span className="flex items-center gap-1"><Clock size={11} />{relTime(a.created_at)}</span>
                        </td>
                        <td className="px-4 py-3">{statusBadge(a.status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => setPrimaryDrTarget(a)}
                              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 text-xs" title="Assign Primary Doctor">
                              <UserCheck size={14} />
                            </button>
                            <button onClick={() => setTransferTarget(a)}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 text-xs" title="Transfer">
                              <ArrowRightLeft size={14} />
                            </button>
                            <button onClick={() => setDischargeTarget(a)}
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 text-xs" title="Discharge">
                              <LogOut size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bed Board Tab ── */}
      {tab === 'board' && (
        <BedBoardPanel
          allAdmissions={admissions}
          onAssignBed={bed => setAssignBedTarget(bed)}
          refresh={refresh}
        />
      )}

      {/* ── Discharge Queue Tab ── */}
      {tab === 'discharge' && (
        <div>
          {dqLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-gray-400" />
            </div>
          ) : dischargeQueue.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
              <UserCheck size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">No patients pending discharge</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dischargeQueue.map(a => (
                <div key={a.id} className="bg-white border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{a.patient_name || '—'}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {a.admission_number || `#${a.id}`} · {a.department_name || '—'} · Admitted {relTime(a.created_at)}
                    </div>
                  </div>
                  <button onClick={() => setDischargeTarget(a)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700">
                    <LogOut size={14} />Complete Discharge
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAdmit && <AdmitPatientModal onClose={() => setShowAdmit(false)} onSuccess={handleSuccess} />}
      {dischargeTarget && <DischargeModal admission={dischargeTarget} onClose={() => setDischargeTarget(null)} onSuccess={handleSuccess} />}
      {transferTarget && <TransferModal admission={transferTarget} onClose={() => setTransferTarget(null)} onSuccess={handleSuccess} />}
      {primaryDrTarget && <PrimaryDrModal admission={primaryDrTarget} onClose={() => setPrimaryDrTarget(null)} onSuccess={handleSuccess} />}
      {assignBedTarget && (
        <AssignBedModal
          bed={assignBedTarget}
          admissions={admissions}
          onClose={() => setAssignBedTarget(null)}
          onSuccess={handleSuccess}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
