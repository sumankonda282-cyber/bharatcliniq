import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { BedDouble, RefreshCw, Loader2, Filter, Clock } from 'lucide-react'

function BedChip({ bed }) {
  const isVacant = bed.status === 'vacant'
  const isMaint = bed.status === 'maintenance'
  const isOccupied = bed.status === 'occupied'

  return (
    <div className={`rounded-xl px-3 py-2.5 min-w-[120px] max-w-[160px]
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
      {isVacant && <div className="text-xs text-green-600 mt-0.5">Vacant</div>}
      {isMaint && <div className="text-xs text-gray-400 mt-0.5">Maintenance</div>}
    </div>
  )
}

export default function BedBoard() {
  const { user } = useAuth()
  const [board, setBoard] = useState([])
  const [departments, setDepartments] = useState([])
  const [deptFilter, setDeptFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = deptFilter ? `?department_id=${deptFilter}` : ''
    api.get(`/inpatient/beds/board${params}`)
      .then(r => {
        setBoard(Array.isArray(r) ? r : (r?.items || r?.data || []))
        setLastRefreshed(new Date())
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [deptFilter])

  useEffect(() => {
    api.get('/inpatient/departments')
      .then(r => setDepartments(Array.isArray(r) ? r : (r?.items || r?.data || [])))
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => { load() }, 30000)
    return () => clearInterval(interval)
  }, [load])

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

  // Group beds by ward
  const wardMap = {}
  board.forEach(bed => {
    const key = bed.ward_id || 'unknown'
    if (!wardMap[key]) wardMap[key] = { id: key, name: bed.ward_name || 'Unknown Ward', floor: bed.floor || '', beds: [] }
    wardMap[key].beds.push(bed)
  })
  const wards = Object.values(wardMap)

  const totalBeds = board.length
  const vacantBeds = board.filter(b => b.status === 'vacant').length
  const occupiedBeds = board.filter(b => b.status === 'occupied').length
  const maintBeds = board.filter(b => b.status === 'maintenance').length

  return (
    <div className="min-h-screen" style={{ background: '#F0F4F8' }}>
      {/* Header bar */}
      <div className="sticky top-0 z-30 border-b border-gray-200 shadow-sm" style={{ background: '#0F2557' }}>
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BedDouble size={22} className="text-white opacity-80" />
            <div>
              <h1 className="text-lg font-bold text-white">Bed Board</h1>
              <p className="text-xs" style={{ color: '#93B4D0' }}>Live inpatient bed status</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-white">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />
              <span className="font-semibold">{vacantBeds}</span>
              <span className="opacity-60">vacant</span>
            </div>
            <div className="flex items-center gap-1.5 text-white">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
              <span className="font-semibold">{occupiedBeds}</span>
              <span className="opacity-60">occupied</span>
            </div>
            {maintBeds > 0 && (
              <div className="flex items-center gap-1.5 text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" />
                <span className="font-semibold">{maintBeds}</span>
                <span className="opacity-60">maintenance</span>
              </div>
            )}
            <div className="text-white opacity-60 text-xs hidden sm:block">
              {totalBeds} total beds
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#93B4D0' }}>
              <Filter size={12} />
              <select
                className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
                value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                <option value="" style={{ color: '#333' }}>All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id} style={{ color: '#333' }}>{d.name}</option>)}
              </select>
            </div>
            <button onClick={load}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-xs text-white hover:bg-white/20">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Last refreshed indicator */}
      {lastRefreshed && (
        <div className="max-w-screen-2xl mx-auto px-6 pt-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock size={11} />
            Last updated: {lastRefreshed.toLocaleTimeString()} · Auto-refreshes every 30s
          </div>
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-6 py-4">
        {loading && board.length === 0 ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={32} className="animate-spin text-gray-400" />
          </div>
        ) : wards.length === 0 ? (
          <div className="text-center py-32 text-gray-400">
            <BedDouble size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No wards configured</p>
            <p className="text-sm mt-1">Configure wards and beds in Hospital Settings</p>
          </div>
        ) : (
          <div className="space-y-6">
            {wards.map(ward => (
              <div key={ward.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between"
                  style={{ background: '#F8FAFF' }}>
                  <div className="flex items-center gap-2">
                    <BedDouble size={16} style={{ color: '#0F2557' }} />
                    <span className="font-bold text-sm" style={{ color: '#0F2557' }}>{ward.name}</span>
                    {ward.floor && (
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                        Floor {ward.floor}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                      {ward.beds.filter(b => b.status === 'vacant').length} vacant
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                      {ward.beds.filter(b => b.status === 'occupied').length} occupied
                    </span>
                    <span className="font-medium text-gray-700">{ward.beds.length} beds</span>
                  </div>
                </div>
                <div className="p-5 flex flex-wrap gap-3">
                  {ward.beds.map(bed => (
                    <BedChip key={bed.id} bed={bed} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
