import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import {
  Building2, Layers, BedDouble, LayoutGrid,
  Plus, Edit2, Trash2, Loader2, X, Check,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
const DEPT_TYPE_COLORS = {
  clinical: 'badge-blue',
  surgical: 'badge-purple',
  diagnostic: 'badge-yellow',
  support: 'badge-gray',
}

const WARD_TYPE_LABELS = {
  general: 'General', hdu: 'HDU', icu: 'ICU',
  isolation: 'Isolation', labour: 'Labour', nicu: 'NICU', paeds: 'Paeds',
}

const BED_STATUS_STYLE = {
  vacant: 'bg-green-100 text-green-700 border-green-200',
  occupied: 'bg-red-100 text-red-700 border-red-200',
  pending_cleaning: 'bg-orange-100 text-orange-700 border-orange-200',
  maintenance: 'bg-gray-100 text-gray-600 border-gray-200',
}

const BED_STATUS_LABELS = {
  vacant: 'Vacant', occupied: 'Occupied',
  pending_cleaning: 'Pending Cleaning', maintenance: 'Maintenance',
}

function Toggle2({ enabled, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
      aria-label={label}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const [config, setConfig] = useState({ org_type: 'clinic', clinic_prefix: '', wards_enabled: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/inpatient/org-config')
      .then(r => setConfig(r || { org_type: 'clinic', clinic_prefix: '', wards_enabled: false }))
      .catch(() => setErr('Could not load config'))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true); setMsg(''); setErr('')
    try {
      await api.put('/inpatient/org-config', config)
      setMsg('Saved successfully')
      setTimeout(() => setMsg(''), 3000)
    } catch (e) { setErr(e.message || 'Save failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-gray-400" /></div>

  return (
    <div className="max-w-lg space-y-5">
      {err && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{err}</div>}
      {msg && <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{msg}</div>}

      <div className="card p-5 space-y-5">
        {/* Org Type */}
        <div>
          <label className="label">Organisation Type</label>
          <div className="flex gap-2 mt-1">
            {['clinic', 'hospital'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setConfig(c => ({ ...c, org_type: type }))}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all capitalize ${config.org_type === type ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {type === 'clinic' ? 'Clinic (Outpatient)' : 'Hospital (Inpatient + Outpatient)'}
              </button>
            ))}
          </div>
        </div>

        {/* MRN Prefix */}
        <div>
          <label className="label">MRN / Clinic ID Prefix</label>
          <input
            className="input"
            value={config.clinic_prefix || ''}
            onChange={e => setConfig(c => ({ ...c, clinic_prefix: e.target.value }))}
            placeholder="e.g. BHC, MED, GH"
            maxLength={6}
          />
          <p className="text-xs text-gray-400 mt-1">Used as prefix for patient IDs (e.g. BHC-0001)</p>
        </div>

        {/* Wards Enabled */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-700">Wards & Bed Management</div>
            <div className="text-xs text-gray-400 mt-0.5">Enable ward/bed tracking for inpatient admissions</div>
          </div>
          <Toggle2
            enabled={config.wards_enabled || false}
            onChange={v => setConfig(c => ({ ...c, wards_enabled: v }))}
            label="Wards enabled"
          />
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary">
        {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : <><Check size={14} />Save Settings</>}
      </button>
    </div>
  )
}

// ── Departments Tab ───────────────────────────────────────────────────────────
function DeptModal({ dept, onClose, onSaved }) {
  const [form, setForm] = useState(dept || { name: '', code: '', dept_type: 'clinical', color_hex: '#0F2557', is_active: true })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      if (dept?.id) {
        await api.put(`/inpatient/departments/${dept.id}`, form)
      } else {
        await api.post('/inpatient/departments', form)
      }
      onSaved()
    } catch (ex) { setErr(ex.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>{dept?.id ? 'Edit Department' : 'Add Department'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
          <div><label className="label">Code *</label><input className="input uppercase" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} maxLength={6} required placeholder="e.g. CARD" /></div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.dept_type} onChange={e => setForm(f => ({ ...f, dept_type: e.target.value }))}>
              {['clinical', 'surgical', 'diagnostic', 'support'].map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1"><label className="label">Color</label><input type="color" className="input h-10 p-1 cursor-pointer" value={form.color_hex || '#0F2557'} onChange={e => setForm(f => ({ ...f, color_hex: e.target.value }))} /></div>
            <div className="flex items-center gap-2 pt-5">
              <Toggle2 enabled={form.is_active !== false} onChange={v => setForm(f => ({ ...f, is_active: v }))} label="Active" />
              <span className="text-sm text-gray-600">Active</span>
            </div>
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DepartmentsTab() {
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [modal, setModal] = useState(null) // null | 'new' | dept object

  const load = useCallback(() => {
    setLoading(true)
    api.get('/inpatient/departments')
      .then(r => setDepts(Array.isArray(r) ? r : []))
      .catch(() => setErr('Could not load departments'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const remove = async id => {
    if (!window.confirm('Delete this department?')) return
    try { await api.delete(`/inpatient/departments/${id}`); load() }
    catch (e) { alert(e.message || 'Delete failed') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-700">Departments</h2>
        <button onClick={() => setModal('new')} className="btn-primary"><Plus size={14} />Add Department</button>
      </div>
      {err && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">{err}</div>}
      {loading ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-400" /></div> : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead><tr>
              <th className="th">Name</th>
              <th className="th">Code</th>
              <th className="th">Type</th>
              <th className="th">Status</th>
              <th className="th"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {depts.length === 0 ? (
                <tr><td colSpan={5} className="td text-center text-gray-400 py-8">No departments yet</td></tr>
              ) : depts.map(d => (
                <tr key={d.id} className="tr-hover">
                  <td className="td font-medium">
                    <div className="flex items-center gap-2">
                      {d.color_hex && <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ background: d.color_hex }} />}
                      {d.name}
                    </div>
                  </td>
                  <td className="td font-mono text-xs text-gray-500">{d.code}</td>
                  <td className="td"><span className={`badge ${DEPT_TYPE_COLORS[d.dept_type] || 'badge-gray'} capitalize`}>{d.dept_type}</span></td>
                  <td className="td">
                    <span className={`badge ${d.is_active ? 'badge-green' : 'badge-gray'}`}>{d.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="td">
                    <div className="flex gap-1">
                      <button onClick={() => setModal(d)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500"><Edit2 size={14} /></button>
                      <button onClick={() => remove(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <DeptModal
          dept={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}

// ── Wards Tab ─────────────────────────────────────────────────────────────────
function WardModal({ ward, departments, onClose, onSaved }) {
  const [form, setForm] = useState(ward || { name: '', floor: '', wing: '', ward_type: 'general', total_beds: '', department_id: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      const payload = { ...form, total_beds: parseInt(form.total_beds) || 0, department_id: form.department_id ? parseInt(form.department_id) : null }
      if (ward?.id) {
        await api.put(`/inpatient/wards/${ward.id}`, payload)
      } else {
        await api.post('/inpatient/wards', payload)
      }
      onSaved()
    } catch (ex) { setErr(ex.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>{ward?.id ? 'Edit Ward' : 'Add Ward'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Floor</label><input className="input" value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} placeholder="e.g. 1, 2, Ground" /></div>
            <div><label className="label">Wing</label><input className="input" value={form.wing} onChange={e => setForm(f => ({ ...f, wing: e.target.value }))} placeholder="e.g. A, East" /></div>
          </div>
          <div>
            <label className="label">Ward Type</label>
            <select className="input" value={form.ward_type} onChange={e => setForm(f => ({ ...f, ward_type: e.target.value }))}>
              {Object.entries(WARD_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label className="label">Total Beds</label><input className="input" type="number" min={0} value={form.total_beds} onChange={e => setForm(f => ({ ...f, total_beds: e.target.value }))} /></div>
          <div>
            <label className="label">Department</label>
            <select className="input" value={form.department_id || ''} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
              <option value="">None</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function WardsTab() {
  const [wards, setWards] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterDept, setFilterDept] = useState('')
  const [modal, setModal] = useState(null)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/inpatient/wards').then(r => setWards(Array.isArray(r) ? r : [])),
      api.get('/inpatient/departments').then(r => setDepartments(Array.isArray(r) ? r : [])),
    ]).catch(() => setErr('Could not load data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const remove = async id => {
    if (!window.confirm('Delete this ward?')) return
    try { await api.delete(`/inpatient/wards/${id}`); load() }
    catch (e) { alert(e.message || 'Delete failed') }
  }

  const filtered = filterDept ? wards.filter(w => String(w.department_id) === filterDept) : wards

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-700">Wards</h2>
          <select className="input text-sm py-1.5 w-48" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary"><Plus size={14} />Add Ward</button>
      </div>
      {err && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">{err}</div>}
      {loading ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-400" /></div> : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead><tr>
              <th className="th">Name</th>
              <th className="th">Floor / Wing</th>
              <th className="th">Type</th>
              <th className="th">Beds</th>
              <th className="th">Department</th>
              <th className="th"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="td text-center text-gray-400 py-8">No wards found</td></tr>
              ) : filtered.map(w => {
                const dept = departments.find(d => d.id === w.department_id)
                return (
                  <tr key={w.id} className="tr-hover">
                    <td className="td font-medium">{w.name}</td>
                    <td className="td text-sm text-gray-500">{[w.floor, w.wing].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="td"><span className="badge badge-blue">{WARD_TYPE_LABELS[w.ward_type] || w.ward_type}</span></td>
                    <td className="td font-mono text-sm">{w.total_beds ?? '—'}</td>
                    <td className="td text-sm text-gray-500">{dept?.name || '—'}</td>
                    <td className="td">
                      <div className="flex gap-1">
                        <button onClick={() => setModal(w)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500"><Edit2 size={14} /></button>
                        <button onClick={() => remove(w.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <WardModal
          ward={modal === 'new' ? null : modal}
          departments={departments}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}

// ── Beds Tab ──────────────────────────────────────────────────────────────────
function BedModal({ wards, onClose, onSaved }) {
  const [form, setForm] = useState({ bed_number: '', bed_type: 'general', ward_id: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await api.post('/inpatient/beds', { ...form, ward_id: parseInt(form.ward_id) })
      onSaved()
    } catch (ex) { setErr(ex.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>Add Bed</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Bed Number *</label><input className="input" value={form.bed_number} onChange={e => setForm(f => ({ ...f, bed_number: e.target.value }))} required placeholder="e.g. B-101" /></div>
          <div>
            <label className="label">Bed Type</label>
            <select className="input" value={form.bed_type} onChange={e => setForm(f => ({ ...f, bed_type: e.target.value }))}>
              {['general', 'icu', 'hdu', 'isolation', 'special'].map(t => <option key={t} value={t} className="capitalize">{t.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Ward *</label>
            <select className="input" value={form.ward_id} onChange={e => setForm(f => ({ ...f, ward_id: e.target.value }))} required>
              <option value="">Select Ward</option>
              {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving…' : 'Add Bed'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BedsTab() {
  const [beds, setBeds] = useState([])
  const [wards, setWards] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterWard, setFilterWard] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/inpatient/beds').then(r => setBeds(Array.isArray(r) ? r : [])),
      api.get('/inpatient/wards').then(r => setWards(Array.isArray(r) ? r : [])),
    ]).catch(() => setErr('Could not load data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id, status) => {
    try { await api.put(`/inpatient/beds/${id}`, { status }); load() }
    catch (e) { alert(e.message || 'Update failed') }
  }

  const filtered = filterWard ? beds.filter(b => String(b.ward_id) === filterWard) : beds

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-700">Beds</h2>
          <select className="input text-sm py-1.5 w-40" value={filterWard} onChange={e => setFilterWard(e.target.value)}>
            <option value="">All Wards</option>
            {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={14} />Add Bed</button>
      </div>
      {err && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">{err}</div>}
      {loading ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-400" /></div> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center text-gray-400"><BedDouble size={32} className="mx-auto mb-2 opacity-30" /><p>No beds found</p></div>
          ) : filtered.map(b => {
            const ward = wards.find(w => w.id === b.ward_id)
            return (
              <div key={b.id} className={`rounded-xl border p-3 ${BED_STATUS_STYLE[b.status] || 'bg-gray-50 border-gray-200'}`}>
                <div className="font-bold text-base mb-0.5">{b.bed_number}</div>
                <div className="text-xs uppercase font-medium mb-1 opacity-70">{b.bed_type}</div>
                <div className="text-xs opacity-60 mb-2 truncate">{ward?.name || '—'}</div>
                <div className="text-xs font-medium">{BED_STATUS_LABELS[b.status] || b.status}</div>
                {/* Status update for maintenance/cleaning */}
                {(b.status === 'maintenance' || b.status === 'pending_cleaning') && (
                  <button
                    onClick={() => updateStatus(b.id, 'vacant')}
                    className="mt-2 w-full text-xs py-1 px-2 rounded-lg bg-white/60 hover:bg-white border border-current font-medium transition-colors"
                  >
                    Mark Vacant
                  </button>
                )}
                {b.status === 'vacant' && (
                  <button
                    onClick={() => updateStatus(b.id, 'maintenance')}
                    className="mt-2 w-full text-xs py-1 px-2 rounded-lg bg-white/60 hover:bg-white border border-current font-medium transition-colors"
                  >
                    Maintenance
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {showAdd && <BedModal wards={wards} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview',    label: 'Overview',     icon: Building2 },
  { key: 'departments', label: 'Departments',  icon: Layers },
  { key: 'wards',       label: 'Wards',        icon: LayoutGrid },
  { key: 'beds',        label: 'Beds',         icon: BedDouble },
]

export default function HospitalSettings() {
  const [tab, setTab] = useState('overview')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Hospital Setup</h1>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'overview'    && <OverviewTab />}
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'wards'       && <WardsTab />}
      {tab === 'beds'        && <BedsTab />}
    </div>
  )
}
