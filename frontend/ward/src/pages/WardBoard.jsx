import { useEffect, useState, useCallback } from 'react'
import { BedDouble, RefreshCw, Loader2, X, Activity, ClipboardList } from 'lucide-react'
import api from '../api/client'

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000 / 60
  if (diff < 60) return `${Math.round(diff)}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return `${Math.round(diff / 1440)}d ago`
}

function BedChip({ bed, onClick }) {
  const status = bed.status || (bed.current_admission ? 'occupied' : 'vacant')
  const base = 'relative rounded-xl p-3 border-2 cursor-pointer transition-all select-none min-w-[120px]'

  if (status === 'maintenance') {
    return (
      <div className={`${base} bg-gray-100 border-gray-300 cursor-default opacity-70`}>
        <div className="text-xs font-bold text-gray-500">Bed {bed.bed_number}</div>
        <div className="text-xs text-gray-400 mt-1">Maintenance</div>
      </div>
    )
  }
  if (status === 'occupied') {
    const adm = bed.current_admission || {}
    const name = adm.patient?.full_name || adm.patient_name || 'Occupied'
    const admNo = adm.admission_number || `#${adm.id || ''}`
    return (
      <div
        className={`${base} bg-red-50 border-red-400 hover:border-red-600 hover:shadow-md`}
        onClick={() => onClick(bed)}
      >
        <div className="text-xs font-bold text-red-700">Bed {bed.bed_number}</div>
        <div className="text-xs font-medium text-red-900 mt-1 truncate max-w-[100px]">{name}</div>
        <div className="text-xs text-red-500">{admNo}</div>
      </div>
    )
  }
  // vacant
  return (
    <div className={`${base} bg-green-50 border-green-300 cursor-default`}>
      <div className="text-xs font-bold text-green-700">Bed {bed.bed_number}</div>
      <div className="text-xs text-green-500 mt-1">Vacant</div>
    </div>
  )
}

function SlideOver({ bed, onClose }) {
  const [vitals, setVitals] = useState(null)
  const [note, setNote] = useState(null)
  const [loading, setLoading] = useState(true)
  const adm = bed?.current_admission
  const admId = adm?.id

  useEffect(() => {
    if (!admId) { setLoading(false); return }
    Promise.all([
      api.get(`/inpatient/admissions/${admId}/vitals`).catch(() => null),
      api.get(`/inpatient/admissions/${admId}/notes`).catch(() => null),
    ]).then(([v, n]) => {
      const vArr = Array.isArray(v) ? v : (v?.items || v?.results || [])
      const nArr = Array.isArray(n) ? n : (n?.items || n?.results || [])
      setVitals(vArr[0] || null)
      setNote(nArr[0] || null)
    }).finally(() => setLoading(false))
  }, [admId])

  if (!bed) return null
  const name = adm?.patient?.full_name || adm?.patient_name || 'Unknown'

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-sm bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ background: '#065F46' }}>
          <div>
            <div className="text-white font-bold">Bed {bed.bed_number}</div>
            <div className="text-emerald-200 text-sm">{name}</div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 size={28} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity size={15} style={{ color: '#065F46' }} />
                <span className="font-semibold text-gray-800 text-sm">Latest Vitals</span>
              </div>
              {vitals ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Temp', vitals.temperature != null ? `${vitals.temperature}°C` : '—'],
                    ['Pulse', vitals.pulse != null ? `${vitals.pulse} bpm` : '—'],
                    ['BP', vitals.bp_systolic != null ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : '—'],
                    ['SpO2', vitals.spo2 != null ? `${vitals.spo2}%` : '—'],
                    ['RR', vitals.respiration_rate != null ? `${vitals.respiration_rate}/min` : '—'],
                    ['Pain', vitals.pain_score != null ? `${vitals.pain_score}/10` : '—'],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-2.5">
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="font-semibold text-sm text-gray-800">{val}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No vitals recorded yet.</p>
              )}
              {vitals?.recorded_at && (
                <p className="text-xs text-gray-400 mt-2">Recorded {timeAgo(vitals.recorded_at)}</p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList size={15} style={{ color: '#065F46' }} />
                <span className="font-semibold text-gray-800 text-sm">Latest Nursing Note</span>
              </div>
              {note ? (
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge-blue">{note.note_type || 'general'}</span>
                    <span className="text-xs text-gray-400">{timeAgo(note.written_at || note.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-4">{note.note || note.content || '—'}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No nursing notes yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function WardBoard() {
  const [beds, setBeds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dept, setDept] = useState('all')
  const [selectedBed, setSelectedBed] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchBeds = useCallback(() => {
    api.get('/inpatient/beds/board')
      .then(data => {
        setBeds(Array.isArray(data) ? data : (data.beds || data.items || []))
        setLastRefresh(new Date())
        setError('')
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchBeds()
    const timer = setInterval(fetchBeds, 60000)
    return () => clearInterval(timer)
  }, [fetchBeds])

  const departments = ['all', ...new Set(beds.map(b => b.ward?.name || b.ward_name || b.department || '').filter(Boolean))]

  const filtered = dept === 'all'
    ? beds
    : beds.filter(b => (b.ward?.name || b.ward_name || b.department || '') === dept)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ward Board</h1>
          <p className="text-gray-500 text-sm mt-1">
            Real-time bed overview · Auto-refreshes every 60s
          </p>
        </div>
        <button onClick={fetchBeds} className="btn-secondary">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {departments.map(d => (
          <button
            key={d}
            onClick={() => setDept(d)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
              dept === d
                ? 'text-white border-transparent'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
            style={dept === d ? { background: '#065F46' } : {}}
          >
            {d === 'all' ? 'All Wards' : d}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <BedDouble size={40} className="empty-state-icon" />
          <span className="empty-state-text">No beds found</span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            {filtered.map(bed => (
              <BedChip key={bed.id} bed={bed} onClick={setSelectedBed} />
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-400 inline-block" />Vacant</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-400 inline-block" />Occupied</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-300 inline-block" />Maintenance</span>
            <span className="ml-auto">Last updated: {lastRefresh.toLocaleTimeString()}</span>
          </div>
        </>
      )}

      {selectedBed && <SlideOver bed={selectedBed} onClose={() => setSelectedBed(null)} />}
    </div>
  )
}
