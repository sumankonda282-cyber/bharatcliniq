import { useState, useEffect, useMemo } from 'react'
import api from '../api/client'
import { cachedFetch } from '../utils/cache'
import { Pill, ChevronDown, ChevronUp } from 'lucide-react'

const isActive = (drug) => {
  const d = new Date(drug.rx_date)
  return (Date.now() - d) < 90 * 86400000
}

function DrugRow({ drug, expanded, onToggle }) {
  const active = isActive(drug)
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  return (
    <>
      <tr style={{ background: active ? '#fff' : '#f9fafb', opacity: active ? 1 : 0.8 }}>
        <td className="px-4 py-3">
          <span className="font-semibold text-sm" style={{ color: active ? '#0F2557' : '#6b7280' }}>
            {drug.medicine_name || drug.medicine || '—'}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{drug.dosage || '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{drug.frequency || '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{drug.duration || '—'}</td>
        <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(drug.rx_date)}</td>
        <td className="px-4 py-3">
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Details {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: active ? '#f8faff' : '#f3f4f6' }}>
          <td colSpan={6} className="px-6 py-4">
            <div className="text-sm space-y-1.5">
              <div className="text-gray-700">
                <strong>Prescribed by:</strong> {drug.doctor_name || '—'} on {fmtDate(drug.rx_date)} at {drug.clinic_name || '—'}
              </div>
              <div className="text-gray-600">
                <strong>For:</strong> {drug.rx_notes || '—'}
              </div>
              <div className="text-gray-600">
                <strong>Instructions:</strong> {drug.instructions || '—'}
              </div>
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
                Note: Take as directed. Do not stop medication without consulting your doctor.
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedKey, setExpandedKey] = useState(null)

  // Controls
  const [view, setView] = useState('all') // 'active' | 'all' | 'past'
  const [sort, setSort] = useState('latest')
  const [filterClinic, setFilterClinic] = useState('')
  const [filterDoctor, setFilterDoctor] = useState('')

  useEffect(() => {
    cachedFetch(
      'prescriptions',
      () => api.get('/portal/prescriptions'),
      r => { setPrescriptions(r.data?.prescriptions || r.data || r?.prescriptions || []); setLoading(false) }
    ).catch(() => setLoading(false))
  }, [])

  const allDrugs = useMemo(() =>
    prescriptions.flatMap(rx =>
      (rx.items || []).map(item => ({
        ...item,
        rx_id: rx.id,
        rx_date: rx.date,
        doctor_name: rx.doctor_name,
        clinic_name: rx.clinic_name,
        rx_notes: rx.notes,
        rx_status: rx.status,
      }))
    ),
    [prescriptions]
  )

  const clinics = useMemo(() => [...new Set(allDrugs.map(d => d.clinic_name).filter(Boolean))], [allDrugs])
  const doctors = useMemo(() => [...new Set(allDrugs.map(d => d.doctor_name).filter(Boolean))], [allDrugs])

  const filtered = useMemo(() => {
    let drugs = allDrugs
    if (view === 'active') drugs = drugs.filter(isActive)
    if (view === 'past') drugs = drugs.filter(d => !isActive(d))
    if (filterClinic) drugs = drugs.filter(d => d.clinic_name === filterClinic)
    if (filterDoctor) drugs = drugs.filter(d => d.doctor_name === filterDoctor)

    if (sort === 'latest') drugs = [...drugs].sort((a, b) => new Date(b.rx_date) - new Date(a.rx_date))
    else if (sort === 'oldest') drugs = [...drugs].sort((a, b) => new Date(a.rx_date) - new Date(b.rx_date))
    else if (sort === 'az') drugs = [...drugs].sort((a, b) => (a.medicine_name || '').localeCompare(b.medicine_name || ''))

    return drugs
  }, [allDrugs, view, sort, filterClinic, filterDoctor])

  if (loading) {
    return <div className="card p-10 text-center text-gray-400 text-sm">Loading…</div>
  }

  if (allDrugs.length === 0) {
    return (
      <div className="card p-12 text-center text-gray-400">
        <Pill size={40} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">No prescriptions on record</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {[['active', 'Active'], ['all', 'All'], ['past', 'Past']].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
              style={view === v ? { background: '#0F2557', color: '#fff' } : { color: '#6b7280' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select value={sort} onChange={e => setSort(e.target.value)} className="input sm:w-44">
          <option value="latest">Latest first</option>
          <option value="oldest">Oldest first</option>
          <option value="az">A–Z by drug name</option>
        </select>

        {/* Clinic filter */}
        <select value={filterClinic} onChange={e => setFilterClinic(e.target.value)} className="input sm:w-48">
          <option value="">All Health Centers</option>
          {clinics.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Doctor filter */}
        <select value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)} className="input sm:w-44">
          <option value="">All Doctors</option>
          {doctors.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400 text-sm">No medications match the current filters.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Drug Name</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Dose</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Frequency</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Prescribed</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Details ▼</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((drug, i) => {
                  const key = `${drug.rx_id}-${i}`
                  return (
                    <DrugRow
                      key={key}
                      drug={drug}
                      expanded={expandedKey === key}
                      onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
