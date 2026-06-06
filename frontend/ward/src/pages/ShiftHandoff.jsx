import { useEffect, useState } from 'react'
import { ArrowLeftRight, Printer, Loader2, AlertCircle, Clock, Activity } from 'lucide-react'
import api from '../api/client'
import { useNavigate } from 'react-router-dom'

function timeAgo(dateStr) {
  if (!dateStr) return null
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000 / 3600
  if (diff < 1) return `${Math.round(diff * 60)}m ago`
  if (diff < 24) return `${diff.toFixed(1)}h ago`
  return `${Math.round(diff / 24)}d ago`
}

function isVitalsOverdue(lastVitalAt) {
  if (!lastVitalAt) return true
  return (Date.now() - new Date(lastVitalAt).getTime()) / 1000 / 3600 > 4
}

function getCurrentShiftName() {
  const h = new Date().getHours()
  if (h >= 6 && h < 14) return 'Morning'
  if (h >= 14 && h < 22) return 'Afternoon'
  return 'Night'
}

function PatientHandoffCard({ adm }) {
  const [vitals, setVitals] = useState(null)
  const [note, setNote] = useState(null)

  useEffect(() => {
    api.get(`/inpatient/admissions/${adm.id}/vitals`).then(data => {
      const arr = Array.isArray(data) ? data : (data.items || data.results || [])
      setVitals(arr[0] || null)
    }).catch(() => null)
    api.get(`/inpatient/admissions/${adm.id}/notes`).then(data => {
      const arr = Array.isArray(data) ? data : (data.items || data.results || [])
      setNote(arr[0] || null)
    }).catch(() => null)
  }, [adm.id])

  const name = adm.patient?.full_name || adm.patient_name || 'Unknown'
  const bed = adm.bed?.bed_number || adm.bed_number || '—'
  const ward = adm.ward?.name || adm.ward_name || '—'
  const diag = adm.diagnosis || adm.primary_diagnosis || '—'
  const overdue = isVitalsOverdue(adm.last_vital_at || vitals?.recorded_at)

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-gray-900">{name}</h3>
          <div className="text-sm text-gray-500">{ward} / Bed {bed}</div>
          <div className="text-sm text-gray-500">{diag}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {overdue && (
            <span className="badge-red flex items-center gap-1">
              <Clock size={10} />Vitals overdue
            </span>
          )}
          <span className="badge-gray text-xs">{adm.admission_number}</span>
        </div>
      </div>

      {/* Vitals row */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 mr-2 flex items-center gap-1">
          <Activity size={11} />Vitals:
        </span>
        {vitals ? (
          <>
            {vitals.temperature != null && <span className="badge-gray">{vitals.temperature}°C</span>}
            {vitals.pulse != null && <span className="badge-gray">{vitals.pulse}bpm</span>}
            {vitals.bp_systolic != null && <span className="badge-gray">{vitals.bp_systolic}/{vitals.bp_diastolic}</span>}
            {vitals.spo2 != null && <span className="badge-gray">SpO2 {vitals.spo2}%</span>}
            <span className="text-xs text-gray-400 ml-1">({timeAgo(vitals.recorded_at || vitals.created_at)})</span>
          </>
        ) : (
          <span className="text-xs text-red-500">No vitals recorded</span>
        )}
      </div>

      {/* Latest note */}
      {note && (
        <div className={`rounded-xl p-3 text-sm ${note.note_type === 'shift_handoff' ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-100'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={note.note_type === 'shift_handoff' ? 'badge-yellow' : 'badge-gray'}>
              {note.note_type || 'note'}
            </span>
            <span className="text-xs text-gray-400">{timeAgo(note.written_at || note.created_at)}</span>
          </div>
          <p className="text-gray-700 line-clamp-2">{note.note || note.content}</p>
        </div>
      )}
    </div>
  )
}

export default function ShiftHandoff() {
  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const shift = getCurrentShiftName()

  useEffect(() => {
    api.get('/inpatient/admissions?status=active')
      .then(data => setAdmissions(Array.isArray(data) ? data : (data.items || data.results || [])))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const vitalsOverdueCount = admissions.filter(a => isVitalsOverdue(a.last_vital_at)).length

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Shift Handoff</h1>
          <p className="text-gray-500 text-sm mt-1">{shift} Shift · {admissions.length} active patients</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/notes', { state: { noteType: 'shift_handoff' } })}
            className="btn-primary no-print"
          >
            <ArrowLeftRight size={15} />
            Write Handoff Note
          </button>
          <button onClick={() => window.print()} className="btn-secondary no-print">
            <Printer size={15} />
            Print
          </button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#0F2557' }}>BHaratCliniq — Ward Shift Handoff</h1>
        <p className="text-gray-600">{shift} Shift · {new Date().toLocaleString('en-IN')} · {admissions.length} patients</p>
      </div>

      {vitalsOverdueCount > 0 && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm no-print">
          <AlertCircle size={15} />
          <strong>{vitalsOverdueCount} patient{vitalsOverdueCount !== 1 ? 's' : ''}</strong> with overdue vitals (&gt;4h)
        </div>
      )}

      {error && (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      ) : admissions.length === 0 ? (
        <div className="empty-state">
          <ArrowLeftRight size={40} className="empty-state-icon" />
          <span className="empty-state-text">No active admissions</span>
        </div>
      ) : (
        <div className="max-w-3xl">
          {admissions.map(adm => (
            <PatientHandoffCard key={adm.id} adm={adm} />
          ))}
        </div>
      )}
    </div>
  )
}
