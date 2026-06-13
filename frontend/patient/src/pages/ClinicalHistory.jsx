import { useState, useEffect, useMemo } from 'react'
import {
  ChevronDown, Calendar, Stethoscope, Building2, FileText, X,
  Activity, FlaskConical, Pill, ClipboardList, MessageSquare, Video, Printer,
} from 'lucide-react'
import api from '../api/client'
import { cachedFetch } from '../utils/cache'

const fmtDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''

function Section({ icon: Icon, title, children }) {
  return (
    <div className="py-3 border-t border-gray-100 first:border-t-0">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} style={{ color: '#F5821E' }} />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</span>
      </div>
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line pl-6">{children}</div>
    </div>
  )
}

function VitalsRow({ vitals }) {
  const items = [
    vitals.bp && { label: 'BP', value: `${vitals.bp} mmHg` },
    vitals.pulse && { label: 'Pulse', value: `${vitals.pulse} bpm` },
    vitals.temperature && { label: 'Temp', value: `${vitals.temperature}°F` },
    vitals.spo2 && { label: 'SpO₂', value: `${vitals.spo2}%` },
    vitals.weight_kg && { label: 'Weight', value: `${vitals.weight_kg} kg` },
    vitals.height_cm && { label: 'Height', value: `${vitals.height_cm} cm` },
    vitals.blood_sugar && { label: 'Sugar', value: `${vitals.blood_sugar} mg/dL` },
  ].filter(Boolean)
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(v => (
        <span key={v.label} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-xs font-medium" style={{ color: '#0F2557' }}>
          <span className="text-gray-400">{v.label}</span> {v.value}
        </span>
      ))}
    </div>
  )
}

function VisitRow({ visit, open, onToggle }) {
  const headline = visit.note?.complaints || visit.note?.reason_for_visit || visit.reason
  return (
    <div className="card overflow-hidden">
      {/* Collapsed row */}
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors">
        <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-white"
          style={{ background: visit.has_documentation ? '#0F2557' : '#94a3b8' }}>
          <FileText size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: '#0F2557' }}>{fmtDate(visit.date)}</span>
            {visit.mode === 'telehealth' && (
              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#F5821E20', color: '#F5821E' }}>
                <Video size={10} />Virtual
              </span>
            )}
            {!visit.has_documentation && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">No record</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
            <span className="inline-flex items-center gap-1"><Stethoscope size={11} />{visit.doctor_name}</span>
            {visit.doctor_specialty && <span className="text-gray-400">{visit.doctor_specialty}</span>}
            <span className="inline-flex items-center gap-1"><Building2 size={11} />{visit.clinic_name}</span>
          </div>
          {headline && <div className="text-xs text-gray-400 mt-0.5 truncate">{headline}</div>}
        </div>
        <ChevronDown size={18} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-5 pb-4 border-t border-gray-100" style={{ background: '#FAFBFD' }}>
          <div className="flex flex-wrap gap-x-6 gap-y-1 py-3 text-xs text-gray-500">
            <span><strong className="text-gray-700">Date:</strong> {fmtDate(visit.date)} {visit.time && `· ${visit.time}`}</span>
            <span><strong className="text-gray-700">Doctor:</strong> {visit.doctor_name}{visit.doctor_specialty && ` (${visit.doctor_specialty})`}</span>
            {visit.doctor_specialty && <span><strong className="text-gray-700">Specialty:</strong> {visit.doctor_specialty}</span>}
            <span><strong className="text-gray-700">Health Center:</strong> {visit.clinic_name}{visit.clinic_city && `, ${visit.clinic_city}`}</span>
            <span><strong className="text-gray-700">Visit:</strong> {visit.mode === 'telehealth' ? 'Telehealth' : 'In-person'}{visit.visit_type && ` · ${visit.visit_type}`}</span>
          </div>

          {!visit.has_documentation ? (
            <p className="text-sm text-gray-400 italic py-3">No clinical documentation recorded for this visit.</p>
          ) : (
            <>
              {(visit.note?.complaints || visit.note?.reason_for_visit) && (
                <Section icon={MessageSquare} title="Complaints / Reason for Visit">
                  {visit.note.complaints || visit.note.reason_for_visit}
                </Section>
              )}
              {visit.note?.past_history && (
                <Section icon={ClipboardList} title="Past History">{visit.note.past_history}</Section>
              )}
              {visit.vitals && (
                <Section icon={Activity} title="Vitals"><VitalsRow vitals={visit.vitals} /></Section>
              )}
              {visit.note?.examination && (
                <Section icon={Stethoscope} title="Examination Findings">{visit.note.examination}</Section>
              )}
              {(visit.tests.length > 0 || visit.note?.investigations) && (
                <Section icon={FlaskConical} title="Tests & Investigations">
                  {visit.tests.map(t => (
                    <div key={t.order_id} className="mb-1">
                      <span className="font-medium">{(t.test_names || []).join(', ') || t.order_id}</span>
                      <span className="text-xs text-gray-400 ml-2">({t.status})</span>
                      {t.clinical_notes && <div className="text-xs text-gray-500">{t.clinical_notes}</div>}
                    </div>
                  ))}
                  {visit.note?.investigations && <div className="mt-1">{visit.note.investigations}</div>}
                </Section>
              )}
              {visit.note?.assessment && (
                <Section icon={FileText} title="Assessment / Diagnosis">{visit.note.assessment}</Section>
              )}
              {(visit.medications.length > 0 || visit.note?.medications_text) && (
                <Section icon={Pill} title="Medications Prescribed">
                  {visit.medications.map((m, i) => (
                    <div key={i} className="mb-1">
                      <span className="font-medium">{m.name}</span>
                      {[m.dosage, m.frequency, m.duration].filter(Boolean).length > 0 && (
                        <span className="text-gray-500"> — {[m.dosage, m.frequency, m.duration].filter(Boolean).join(' · ')}</span>
                      )}
                      {m.instructions && <div className="text-xs text-gray-500">{m.instructions}</div>}
                    </div>
                  ))}
                  {visit.note?.medications_text && <div className="mt-1">{visit.note.medications_text}</div>}
                </Section>
              )}
              {visit.note?.plan_counselling && (
                <Section icon={MessageSquare} title="Plan, Suggestions & Counselling">
                  {visit.note.plan_counselling}
                  {visit.note.follow_up_days && (
                    <div className="text-xs font-medium mt-1" style={{ color: '#CC1414' }}>
                      Follow-up in {visit.note.follow_up_days} days
                    </div>
                  )}
                </Section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function MedicalHistory() {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)

  // Filters
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [visitType, setVisitType] = useState('')
  const [filterSpecialty, setFilterSpecialty] = useState('')
  const [filterClinic, setFilterClinic] = useState('')

  useEffect(() => {
    cachedFetch('clinical_history', () => api.get('/portal/clinical-history'), (d) => {
      setVisits(d?.visits || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const specialties = useMemo(() => [...new Set(visits.map(v => v.doctor_specialty).filter(Boolean))], [visits])
  const clinics = useMemo(() => [...new Set(visits.map(v => v.clinic_name).filter(Boolean))], [visits])

  const filtered = visits.filter(v => {
    if (fromDate && v.date < fromDate) return false
    if (toDate && v.date > toDate) return false
    if (visitType === 'telehealth' && v.mode !== 'telehealth') return false
    if (visitType === 'in_person' && v.mode === 'telehealth') return false
    if (filterSpecialty && v.doctor_specialty !== filterSpecialty) return false
    if (filterClinic && v.clinic_name !== filterClinic) return false
    return true
  })

  const hasFilters = fromDate || toDate || visitType || filterSpecialty || filterClinic

  const clearFilters = () => {
    setFromDate(''); setToDate(''); setVisitType(''); setFilterSpecialty(''); setFilterClinic('')
  }

  return (
    <div>
      <style>{`@media print { .no-print { display: none !important; } .card { box-shadow: none !important; border: 1px solid #e5e7eb !important; } }`}</style>

      {/* Filters bar */}
      <div className="no-print">
        <div className="flex flex-wrap gap-2 mb-5">
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="input sm:w-40" style={{ colorScheme: 'light' }} />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="input sm:w-40" style={{ colorScheme: 'light' }} />
          </div>
          <select value={visitType} onChange={e => setVisitType(e.target.value)} className="input sm:w-40">
            <option value="">All Visit Types</option>
            <option value="in_person">In-Person</option>
            <option value="telehealth">Telehealth</option>
          </select>
          <select value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)} className="input sm:w-48">
            <option value="">All Specialties</option>
            {specialties.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterClinic} onChange={e => setFilterClinic(e.target.value)} className="input sm:w-52">
            <option value="">All Health Centers</option>
            {clinics.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters}
              className="inline-flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
              <X size={14} />Clear
            </button>
          )}
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors ml-auto">
            <Printer size={14} />Print
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#0F2557', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{hasFilters ? 'No visits match these filters' : 'No visit history yet'}</p>
          <p className="text-sm mt-1">{hasFilters ? 'Try clearing the filters.' : 'Your consultation records will appear here after your visits.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 no-print">{filtered.length} visit{filtered.length !== 1 ? 's' : ''}{hasFilters ? ' (filtered)' : ''}</p>
          {filtered.map(v => (
            <VisitRow key={v.appointment_id} visit={v}
              open={openId === v.appointment_id}
              onToggle={() => setOpenId(openId === v.appointment_id ? null : v.appointment_id)} />
          ))}
        </div>
      )}
    </div>
  )
}
