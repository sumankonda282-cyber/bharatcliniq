import { useState, useEffect, useCallback } from 'react'
import {
  Activity, AlertTriangle, ClipboardList, FileText,
  CheckCircle, Plus, ChevronDown
} from 'lucide-react'
import PatientList from '../components/PatientList'
import GCSForm from '../components/assessments/GCSForm'
import BradenForm from '../components/assessments/BradenForm'
import MorseForm from '../components/assessments/MorseForm'
import PainForm from '../components/assessments/PainForm'
import IOChartForm from '../components/assessments/IOChartForm'
import WoundCareForm from '../components/assessments/WoundCareForm'
import RestraintForm from '../components/assessments/RestraintForm'
import api from '../api/client'

// ── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoStr) {
  if (!isoStr) return null
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function riskBadge(noteType, noteText) {
  try {
    const d = JSON.parse(noteText)
    if (d.type === 'Braden') {
      const t = d.total
      if (t <= 9)  return { label: 'Very High Risk', color: 'bg-red-100 text-red-700' }
      if (t <= 12) return { label: 'High Risk',      color: 'bg-orange-100 text-orange-700' }
      if (t <= 14) return { label: 'Moderate Risk',  color: 'bg-yellow-100 text-yellow-700' }
      return null
    }
    if (d.type === 'Morse') {
      const t = d.total
      if (t >= 45) return { label: 'High Fall Risk', color: 'bg-red-100 text-red-700' }
      if (t >= 25) return { label: 'Med Fall Risk',  color: 'bg-yellow-100 text-yellow-700' }
      return null
    }
  } catch {}
  return null
}

// ── Assessment modal wrapper ──────────────────────────────────────────────────

function AssessmentModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-800 text-lg">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>
        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Placeholder form for unimplemented assessments ────────────────────────────

function PlaceholderForm({ title, onClose }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400">
        <div>
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">{title}</p>
          <p className="text-sm mt-1">Coming soon</p>
        </div>
      </div>
      <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4 flex justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
      </div>
    </div>
  )
}

// ── Assessment card ────────────────────────────────────────────────────────────

function AssessmentCard({ assessment, lastNote, onClick }) {
  const badge = lastNote ? riskBadge(lastNote.note_type, lastNote.note_text) : null
  const ago   = lastNote ? timeAgo(lastNote.created_at || lastNote.timestamp) : null

  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-emerald-400 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`p-2 rounded-lg ${assessment.iconBg}`}>
          <assessment.Icon size={18} className={assessment.iconColor} />
        </div>
        {ago && <span className="text-xs text-gray-400">{ago}</span>}
      </div>
      <p className="font-semibold text-gray-800 text-sm leading-snug group-hover:text-emerald-700">{assessment.name}</p>
      {badge && (
        <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${badge.color}`}>
          {badge.label}
        </span>
      )}
      {!badge && ago && (
        <p className="text-xs text-gray-400 mt-1">Last: {ago}</p>
      )}
    </button>
  )
}

// ── Definitions ───────────────────────────────────────────────────────────────

const NURSING_ASSESSMENTS = [
  { key: 'gcs',       name: 'Glasgow Coma Scale (GCS)',    Icon: Activity,       iconBg: 'bg-blue-100',   iconColor: 'text-blue-600',   noteType: 'gcs'       },
  { key: 'braden',    name: 'Braden Scale',                Icon: AlertTriangle,  iconBg: 'bg-orange-100', iconColor: 'text-orange-600', noteType: 'braden'    },
  { key: 'morse',     name: 'Morse Fall Risk Scale',       Icon: AlertTriangle,  iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600', noteType: 'morse'     },
  { key: 'pain',      name: 'Pain Assessment',             Icon: Activity,       iconBg: 'bg-red-100',    iconColor: 'text-red-600',    noteType: 'pain'      },
  { key: 'io',        name: 'I&O Charting',                Icon: ClipboardList,  iconBg: 'bg-teal-100',   iconColor: 'text-teal-600',   noteType: 'io'        },
  { key: 'wound',     name: 'Wound Care Documentation',    Icon: FileText,       iconBg: 'bg-pink-100',   iconColor: 'text-pink-600',   noteType: 'wound'     },
  { key: 'restraint', name: 'Restraint Documentation',     Icon: ClipboardList,  iconBg: 'bg-purple-100', iconColor: 'text-purple-600', noteType: 'restraint' },
  { key: 'shift',     name: 'Shift Assessment',            Icon: CheckCircle,    iconBg: 'bg-emerald-100',iconColor: 'text-emerald-600',noteType: 'shift'     },
]

const PROVIDER_ASSESSMENTS = [
  { key: 'hp',       name: 'History & Physical (H&P)',     Icon: FileText,      iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', noteType: 'hp'       },
  { key: 'proc',     name: 'Procedure Note',               Icon: ClipboardList, iconBg: 'bg-gray-100',   iconColor: 'text-gray-600',   noteType: 'proc'     },
  { key: 'event',    name: 'Event / Deterioration Note',   Icon: AlertTriangle, iconBg: 'bg-red-100',    iconColor: 'text-red-600',    noteType: 'event'    },
  { key: 'consult',  name: 'Consult Note',                 Icon: FileText,      iconBg: 'bg-blue-100',   iconColor: 'text-blue-600',   noteType: 'consult'  },
]

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Assessments() {
  const [selectedAdmission, setSelectedAdmission] = useState(null)
  const [openModal, setOpenModal]                 = useState(null)
  const [lastNotes, setLastNotes]                 = useState({})

  const loadLastNotes = useCallback(async (admission) => {
    if (!admission) return
    try {
      const data = await api.get(`/inpatient/admissions/${admission.id}/notes?note_type=assessment`)
      const list = Array.isArray(data) ? data : (data.items || data.notes || [])
      const byType = {}
      list.forEach(n => {
        try {
          const parsed = JSON.parse(n.note_text)
          const key = parsed.type?.toLowerCase()
          if (key && !byType[key]) byType[key] = n
        } catch {}
      })
      setLastNotes(byType)
    } catch {}
  }, [])

  useEffect(() => {
    loadLastNotes(selectedAdmission)
  }, [selectedAdmission, loadLastNotes])

  const handleSelect = (admission) => {
    setSelectedAdmission(admission)
    setOpenModal(null)
  }

  const handleSaved = () => {
    loadLastNotes(selectedAdmission)
    setOpenModal(null)
  }

  const patientName = selectedAdmission
    ? (selectedAdmission.patient_name || selectedAdmission.patient?.full_name || `Admission #${selectedAdmission.id}`)
    : null

  function renderModal() {
    if (!openModal || !selectedAdmission) return null
    const props = { admission: selectedAdmission, onClose: () => setOpenModal(null), onSaved: handleSaved }
    const title = [...NURSING_ASSESSMENTS, ...PROVIDER_ASSESSMENTS].find(a => a.key === openModal)?.name || openModal
    const FormComponent = {
      gcs:      GCSForm,
      braden:   BradenForm,
      morse:    MorseForm,
      pain:     PainForm,
      io:       IOChartForm,
      wound:    WoundCareForm,
      restraint: RestraintForm,
    }[openModal]

    return (
      <AssessmentModal title={title} onClose={() => setOpenModal(null)}>
        {FormComponent
          ? <FormComponent {...props} />
          : <PlaceholderForm title={title} onClose={() => setOpenModal(null)} />
        }
      </AssessmentModal>
    )
  }

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      {/* Patient list sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-widest">Patients</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PatientList selectedId={selectedAdmission?.id} onSelect={handleSelect} />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        {!selectedAdmission ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <ClipboardList size={40} className="mb-3 opacity-30" />
            <p className="font-medium">Select a patient to begin assessment</p>
          </div>
        ) : (
          <>
            {/* Patient header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-800">{patientName}</h1>
                <p className="text-sm text-gray-500">
                  Bed {selectedAdmission.bed_label || selectedAdmission.bed?.label || selectedAdmission.bed_number || '—'}
                  {selectedAdmission.patient?.mrn ? ` · MRN ${selectedAdmission.patient.mrn}` : ''}
                </p>
              </div>
            </div>

            {/* Nursing Assessments */}
            <section className="mb-8">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Activity size={14} /> Nursing Assessments
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {NURSING_ASSESSMENTS.map(a => (
                  <AssessmentCard
                    key={a.key}
                    assessment={a}
                    lastNote={lastNotes[a.key] || lastNotes[a.noteType]}
                    onClick={() => setOpenModal(a.key)}
                  />
                ))}
              </div>
            </section>

            {/* Provider Assessments */}
            <section>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <FileText size={14} /> Provider Assessments
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {PROVIDER_ASSESSMENTS.map(a => (
                  <AssessmentCard
                    key={a.key}
                    assessment={a}
                    lastNote={lastNotes[a.key] || lastNotes[a.noteType]}
                    onClick={() => setOpenModal(a.key)}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {renderModal()}
    </div>
  )
}
