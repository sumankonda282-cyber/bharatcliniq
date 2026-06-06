import { useState, useEffect, useCallback } from 'react'
import api from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import {
  BedDouble, Building2, LayoutGrid, RefreshCw, Loader2,
  ChevronRight, AlertCircle,
} from 'lucide-react'

function StatPill({ label, value, color }) {
  const colors = {
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    gray: 'bg-gray-100 text-gray-600',
    blue: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[color] || colors.gray}`}>
      {value} {label}
    </span>
  )
}

// ── Departments tab ────────────────────────────────────────────────────────────
function DepartmentsTab() {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get('/inpatient/departments')
      .then(r => setDepartments(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => setErr('Failed to load departments'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
  if (err) return <div className="text-red-600 text-sm flex items-center gap-2 py-8"><AlertCircle size={16} />{err}</div>
  if (departments.length === 0) return (
    <div className="text-center py-20 text-gray-400">
      <Building2 size={40} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium">No departments configured</p>
      <p className="text-sm mt-1">Add departments in the Admin Portal &rarr; Hospital Settings</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {departments.map(d => (
        <div key={d.id} className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#EEF2FF' }}>
            <Building2 size={18} style={{ color: '#0F2557' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{d.name}</div>
            {d.description && <div className="text-xs text-gray-500 mt-0.5 truncate">{d.description}</div>}
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {d.ward_count != null && <StatPill label="wards" value={d.ward_count} color="blue" />}
            {d.bed_count != null && <StatPill label="beds" value={d.bed_count} color="gray" />}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Wards tab ─────────────────────────────────────────────────────────────────
function WardsTab() {
  const [departments, setDepartments] = useState([])
  const [wards, setWards] = useState([])
  const [deptFilter, setDeptFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/inpatient/departments')
      .then(r => setDepartments(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => {})
  }, [])

  const loadWards = useCallback(() => {
    setLoading(true)
    const params = deptFilter ? `?department_id=${deptFilter}` : ''
    api.get(`/inpatient/wards${params}`)
      .then(r => setWards(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => setErr('Failed to load wards'))
      .finally(() => setLoading(false))
  }, [deptFilter])

  useEffect(() => { loadWards() }, [loadWards])

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
      ) : err ? (
        <div className="text-red-600 text-sm flex items-center gap-2 py-8"><AlertCircle size={16} />{err}</div>
      ) : wards.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <LayoutGrid size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No wards configured</p>
          <p className="text-sm mt-1">Add wards in the Admin Portal &rarr; Hospital Settings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wards.map(w => (
            <div key={w.id} className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#F0FDF4' }}>
                <LayoutGrid size={18} className="text-green-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{w.name}</div>
                <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                  {w.department_name && <span>{w.department_name}</span>}
                  {w.floor && <span>Floor {w.floor}</span>}
                  {w.wing && <span>Wing {w.wing}</span>}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                {w.bed_count != null && <StatPill label="beds" value={w.bed_count} color="blue" />}
                {w.vacant_count != null && <StatPill label="vacant" value={w.vacant_count} color="green" />}
                {w.occupied_count != null && <StatPill label="occupied" value={w.occupied_count} color="red" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Bed Board tab ─────────────────────────────────────────────────────────────
function BedBoardTab() {
  const [board, setBoard] = useState([])
  const [departments, setDepartments] = useState([])
  const [deptFilter, setDeptFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/inpatient/departments')
      .then(r => setDepartments(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const params = deptFilter ? `?department_id=${deptFilter}` : ''
    api.get(`/inpatient/beds/board${params}`)
      .then(r => setBoard(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [deptFilter])

  useEffect(() => { load() }, [load])

  const wardMap = {}
  board.forEach(bed => {
    const key = bed.ward_id || 'unknown'
    if (!wardMap[key]) wardMap[key] = { id: key, name: bed.ward_name || 'Unknown Ward', floor: bed.floor || '', beds: [] }
    wardMap[key].beds.push(bed)
  })
  const wards = Object.values(wardMap)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
      ) : wards.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BedDouble size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No beds configured</p>
        </div>
      ) : (
        <div className="space-y-5">
          {wards.map(ward => (
            <div key={ward.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between" style={{ background: '#F8FAFF' }}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm" style={{ color: '#0F2557' }}>{ward.name}</span>
                  {ward.floor && <span className="text-xs text-gray-400">Floor {ward.floor}</span>}
                </div>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span><span className="w-2 h-2 rounded-full bg-green-400 inline-block mr-1" />{ward.beds.filter(b => b.status === 'vacant').length} vacant</span>
                  <span><span className="w-2 h-2 rounded-full bg-red-400 inline-block mr-1" />{ward.beds.filter(b => b.status === 'occupied').length} occupied</span>
                </div>
              </div>
              <div className="p-4 flex flex-wrap gap-2">
                {ward.beds.map(bed => {
                  const isVacant = bed.status === 'vacant'
                  const isOccupied = bed.status === 'occupied'
                  const isMaint = bed.status === 'maintenance'
                  return (
                    <div key={bed.id}
                      className={`rounded-xl px-3 py-2 min-w-[100px] max-w-[140px]
                        ${isVacant ? 'bg-green-50 border border-green-200' : ''}
                        ${isOccupied ? 'bg-red-50 border border-red-200' : ''}
                        ${isMaint ? 'bg-gray-100 border border-gray-200 opacity-60' : ''}
                      `}>
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
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function InpatientAdmin() {
  const { user } = useAuth()
  const [tab, setTab] = useState('departments')

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
    { key: 'departments', label: 'Departments', icon: Building2 },
    { key: 'wards',       label: 'Wards',       icon: LayoutGrid },
    { key: 'bedboard',    label: 'Bed Board',   icon: BedDouble },
  ]

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#0F2557' }}>Inpatient Structure</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Read-only view of departments, wards and beds.
          Manage them in <span className="font-medium">Admin Portal &rarr; Hospital Settings</span>.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'wards'       && <WardsTab />}
      {tab === 'bedboard'    && <BedBoardTab />}
    </div>
  )
}
