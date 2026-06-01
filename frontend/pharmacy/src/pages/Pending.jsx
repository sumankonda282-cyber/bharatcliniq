import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { Pill, CheckCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
export default function Pending() {
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [dispensing, setDispensing] = useState(null)
  const load = useCallback(() => {
    setLoading(true)
    api.get('/pharmacy/pending').then(r => setPrescriptions(Array.isArray(r) ? r : [])).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  const dispense = async id => {
    setDispensing(id)
    try { await api.post(`/pharmacy/prescriptions/${id}/dispense`); load() }
    catch {}
    finally { setDispensing(null) }
  }
  return (
    <div>
      <div className="page-header"><h1 className="page-title">Pending Prescriptions</h1><span className="text-sm text-gray-500">{prescriptions.length} pending</span></div>
      {loading ? <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-400"/></div>
       : prescriptions.length === 0 ? <div className="card p-16 text-center text-gray-400"><CheckCircle size={40} className="mx-auto mb-3 opacity-30"/><p className="font-medium">All prescriptions dispensed</p></div>
       : <div className="space-y-3">{prescriptions.map(rx => (
        <div key={rx.id} className="card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(expanded === rx.id ? null : rx.id)}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white" style={{ background: '#CC1414' }}>Rx</div>
              <div>
                <div className="font-semibold text-gray-800">{rx.patient?.full_name || 'Patient #' + rx.patient_id}</div>
                <div className="text-xs text-gray-500">by {rx.doctor?.full_name || 'Doctor'} · {rx.created_at ? new Date(rx.created_at).toLocaleDateString('en-IN') : ''}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge badge-yellow">{rx.items?.length || 0} items</span>
              {expanded === rx.id ? <ChevronUp size={18} className="text-gray-400"/> : <ChevronDown size={18} className="text-gray-400"/>}
            </div>
          </div>
          {expanded === rx.id && (
            <div className="border-t border-gray-100 px-5 py-4">
              {rx.diagnosis && <p className="text-sm text-gray-600 mb-3"><span className="font-medium">Diagnosis:</span> {rx.diagnosis}</p>}
              <div className="space-y-2 mb-4">
                {(rx.items || []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2 text-sm">
                    <span className="font-medium">{item.medicine_name || item.drug_name}</span>
                    <span className="text-gray-500">{item.dosage} · {item.frequency} · {item.duration}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => dispense(rx.id)} disabled={dispensing === rx.id} className="btn-success">
                {dispensing === rx.id ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Dispensing…</> : <><CheckCircle size={16}/>Mark Dispensed</>}
              </button>
            </div>
          )}
        </div>
       ))}</div>}
    </div>
  )
}
