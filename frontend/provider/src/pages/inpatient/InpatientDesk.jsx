import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api/client'
import {
  BedDouble, RefreshCw, X, ChevronRight, ClipboardList,
  AlertCircle, CheckCircle2,
} from 'lucide-react'

// ── QuickRoundModal ───────────────────────────────────────────────────────────
function QuickRoundModal({ admission, onClose, onSaved }) {
  const [form, setForm] = useState({ subjective: '', objective: '', assessment: '', plan: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async e => {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      await api.post(`/inpatient/admissions/${admission.id}/progress-notes`, {
        note_type: 'progress',
        ...form,
      })
      onSaved()
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>Quick Round Note</h3>
            <p className="text-sm text-gray-500">
              {admission.patient_name} · {admission.admission_number}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {[
            ['subjective', 'Subjective', 3],
            ['objective',  'Objective',  3],
            ['assessment', 'Assessment', 2],
            ['plan',       'Plan',       3],
          ].map(([k, label, rows]) => (
            <div key={k}>
              <label className="label">{label}</label>
              <textarea
                className="input resize-none"
                rows={rows}
                value={form[k]}
                onChange={e => set(k, e.target.value)}
                placeholder={`Enter ${label.toLowerCase()}…`}
              />
            </div>
          ))}
          {err && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0" />{err}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving…' : 'Save Round Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    active:            'bg-green-100 text-green-800',
    discharge_pending: 'bg-amber-100 text-amber-800',
    discharged:        'bg-gray-100 text-gray-600',
    transferred:       'bg-blue-100 text-blue-800',
  }
  const label = {
    active:            'Active',
    discharge_pending: 'Discharge Pending',
    discharged:        'Discharged',
    transferred:       'Transferred',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {label[status] || status}
    </span>
  )
}

// ── Days admitted helper ──────────────────────────────────────────────────────
function daysAdmitted(admissionDate) {
  if (!admissionDate) return '—'
  const days = Math.floor((Date.now() - new Date(admissionDate)) / (1000 * 60 * 60 * 24))
  return days === 0 ? 'Today' : `${days}d`
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function InpatientDesk() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [admissions, setAdmissions] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [toast, setToast] = useState('')
  const [quickRound, setQuickRound] = useState(null)  // admission object

  const canRound = user?.role === 'doctor' || user?.role === 'clinic_admin'

  const showToast = msg => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const fetchDepartments = useCallback(async () => {
    try {
      const r = await api.get('/inpatient/departments')
      setDepartments(Array.isArray(r) ? r : (r?.items || r?.data || []))
    } catch (_) {}
  }, [])

  const fetchAdmissions = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const params = {}
      if (deptFilter) params.department_id = deptFilter
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter
      const r = await api.get('/inpatient/admissions', { params })
      setAdmissions(Array.isArray(r) ? r : (r?.items || r?.data || []))
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex.message || 'Failed to load admissions')
    } finally {
      setLoading(false)
    }
  }, [deptFilter, statusFilter])

  useEffect(() => { fetchDepartments() }, [fetchDepartments])
  useEffect(() => { fetchAdmissions() }, [fetchAdmissions])

  return (
    <div className="max-w-7xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl shadow-lg text-sm">
          <CheckCircle2 size={16} />{toast}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <BedDouble size={22} style={{ color: '#0F2557' }} />
          <div>
            <h1 className="page-title">Inpatient Desk</h1>
            <p className="text-sm text-gray-500">
              {loading ? 'Loading…' : (
                <span>
                  <span className="font-semibold text-gray-800">{admissions.length}</span> active admission{admissions.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          {admissions.length > 0 && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white" style={{ background: '#CC1414' }}>
              {admissions.length > 99 ? '99+' : admissions.length}
            </span>
          )}
        </div>
        <button onClick={fetchAdmissions} className="btn-secondary">
          <RefreshCw size={15} />Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <div>
          <label className="label mb-1">Department</label>
          <select
            className="input w-48"
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label mb-1">Status</label>
          <select
            className="input w-44"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="discharge_pending">Discharge Pending</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div className="flex items-center gap-2 p-4 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />{err}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-gray-400">
          <RefreshCw size={28} className="animate-spin opacity-50" />
          <p className="text-sm">Loading admissions…</p>
        </div>
      ) : admissions.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <BedDouble size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No admissions found</p>
          <p className="text-sm mt-1">Try adjusting the filters above</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Admission #', 'Patient Name', 'UHID', 'Dept / Ward / Bed', 'Days', 'Diagnosis', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {admissions.map(adm => (
                  <tr key={adm.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700 whitespace-nowrap">
                      {adm.admission_number || `#${adm.id}`}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {adm.patient_name || adm.patient?.full_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                      {adm.uhid || adm.patient?.clinic_patient_id || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <div className="text-xs">
                        <span className="font-medium">{adm.department_name || adm.department?.name || '—'}</span>
                        {adm.ward_name && <span className="text-gray-400"> / {adm.ward_name}</span>}
                        {adm.bed_number && <span className="text-gray-400"> / Bed {adm.bed_number}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">
                      {daysAdmitted(adm.admission_date || adm.created_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      <div className="truncate text-xs" title={adm.primary_diagnosis}>
                        {adm.primary_diagnosis || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={adm.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/inpatient/admission/${adm.id}`)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors hover:opacity-90"
                          style={{ background: '#0F2557' }}
                        >
                          <ClipboardList size={12} />Chart
                          <ChevronRight size={11} />
                        </button>
                        {canRound && (
                          <button
                            onClick={() => setQuickRound(adm)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Quick Round
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Round Modal */}
      {quickRound && (
        <QuickRoundModal
          admission={quickRound}
          onClose={() => setQuickRound(null)}
          onSaved={() => {
            setQuickRound(null)
            showToast('Round note saved successfully')
          }}
        />
      )}
    </div>
  )
}
