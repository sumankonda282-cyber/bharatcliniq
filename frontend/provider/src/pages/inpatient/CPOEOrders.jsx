import { useState, useEffect, useCallback } from 'react'
import api from '../../api/client'
import { checkInteractions, checkAllergyConflict } from '../../data/drugInteractions'
import {
  Plus, AlertTriangle, AlertCircle, Info, XCircle, ChevronDown, ChevronUp,
  Pill, FlaskConical, Activity, Utensils, PersonStanding, Bell, Stethoscope,
  CheckCircle2, Clock, Ban,
} from 'lucide-react'

const ROUTES   = ['PO','IV','IM','SC','SL','TOP','INH','PR','NG']
const FREQS    = ['OD','BD','TDS','QID','Q4H','Q6H','Q8H','Q12H','HS','AC','PC','PRN','STAT','CONT']
const ORDER_TYPES = [
  { value: 'lab',       label: 'Lab', icon: FlaskConical },
  { value: 'imaging',   label: 'Imaging', icon: Activity },
  { value: 'procedure', label: 'Procedure', icon: Stethoscope },
  { value: 'diet',      label: 'Diet', icon: Utensils },
  { value: 'activity',  label: 'Activity', icon: PersonStanding },
  { value: 'nursing',   label: 'Nursing', icon: Bell },
  { value: 'consult',   label: 'Consult', icon: Stethoscope },
]

const SEVERITY_STYLE = {
  major:    { bg: 'bg-red-50',    border: 'border-red-400',   text: 'text-red-800',   icon: XCircle,      label: 'Major' },
  moderate: { bg: 'bg-amber-50',  border: 'border-amber-400', text: 'text-amber-800', icon: AlertTriangle, label: 'Moderate' },
  minor:    { bg: 'bg-blue-50',   border: 'border-blue-400',  text: 'text-blue-800',  icon: Info,         label: 'Minor' },
}

const EMPTY_MED = {
  drug_name: '', generic_name: '', dose: '', route: 'PO', frequency: 'OD',
  duration_days: '', instructions: '', is_prn: false, prn_reason: '',
  is_stat: false, is_continuous: false, iv_rate: '', iv_fluid: '', iv_volume_ml: '',
  notes: '',
}

export default function CPOEOrders({ admissionId, patientAllergies = [] }) {
  const [tab, setTab]                   = useState('medications')
  const [medOrders, setMedOrders]       = useState([])
  const [clinicalOrders, setClinicalOrders] = useState([])
  const [showMedForm, setShowMedForm]   = useState(false)
  const [showClinForm, setShowClinForm] = useState(false)
  const [medForm, setMedForm]           = useState(EMPTY_MED)
  const [clinForm, setClinForm]         = useState({ order_type: 'lab', order_detail: '', priority: 'routine', instructions: '' })
  const [alerts, setAlerts]             = useState([])
  const [allergyAlerts, setAllergyAlerts] = useState([])
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  const loadOrders = useCallback(async () => {
    if (!admissionId) return
    try {
      const [meds, clin] = await Promise.all([
        api.get(`/inpatient/admissions/${admissionId}/orders`),
        api.get(`/inpatient/admissions/${admissionId}/clinical-orders`),
      ])
      setMedOrders(meds)
      setClinicalOrders(clin)
    } catch {}
  }, [admissionId])

  useEffect(() => { loadOrders() }, [loadOrders])

  const onDrugChange = (field, value) => {
    const updated = { ...medForm, [field]: value }
    setMedForm(updated)
    if (field === 'drug_name' || field === 'generic_name') {
      const name = updated.drug_name + ' ' + (updated.generic_name || '')
      setAlerts(checkInteractions(name, medOrders))
      setAllergyAlerts(checkAllergyConflict(name, patientAllergies))
    }
  }

  const submitMed = async () => {
    if (!medForm.drug_name || !medForm.dose || !medForm.route || !medForm.frequency) {
      setError('Drug name, dose, route and frequency are required.'); return
    }
    setSaving(true); setError('')
    try {
      await api.post(`/inpatient/admissions/${admissionId}/orders`, {
        ...medForm,
        duration_days: medForm.duration_days ? parseInt(medForm.duration_days) : null,
        iv_volume_ml:  medForm.iv_volume_ml  ? parseInt(medForm.iv_volume_ml)  : null,
      })
      setMedForm(EMPTY_MED); setAlerts([]); setAllergyAlerts([])
      setShowMedForm(false)
      loadOrders()
    } catch (e) { setError(e?.detail || 'Failed to save order') }
    finally { setSaving(false) }
  }

  const discontinue = async (orderId) => {
    const reason = window.prompt('Reason for discontinuation:')
    if (reason === null) return
    try {
      await api.post(`/inpatient/orders/${orderId}/discontinue`, { reason })
      loadOrders()
    } catch {}
  }

  const submitClin = async () => {
    if (!clinForm.order_detail) { setError('Order detail required.'); return }
    setSaving(true); setError('')
    try {
      await api.post(`/inpatient/admissions/${admissionId}/clinical-orders`, clinForm)
      setClinForm({ order_type: 'lab', order_detail: '', priority: 'routine', instructions: '' })
      setShowClinForm(false)
      loadOrders()
    } catch (e) { setError(e?.detail || 'Failed to save order') }
    finally { setSaving(false) }
  }

  const statusBadge = (s) => {
    const map = {
      active:        'bg-emerald-100 text-emerald-800',
      held:          'bg-amber-100 text-amber-800',
      discontinued:  'bg-red-100 text-red-700',
      completed:     'bg-gray-100 text-gray-600',
      pending:       'bg-blue-100 text-blue-800',
      acknowledged:  'bg-indigo-100 text-indigo-800',
      in_progress:   'bg-purple-100 text-purple-800',
    }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[s] || 'bg-gray-100 text-gray-600'}`}>{s}</span>
  }

  const priorityBadge = (p) => {
    const map = { stat: 'bg-red-100 text-red-800', urgent: 'bg-amber-100 text-amber-800', routine: 'bg-gray-100 text-gray-600' }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[p] || 'bg-gray-100'}`}>{p}</span>
  }

  const isIV = medForm.route === 'IV'

  return (
    <div className="space-y-4">
      {/* Tab row */}
      <div className="flex gap-2 border-b border-gray-200">
        {[['medications', 'Medications', Pill], ['clinical', 'Clinical Orders', FlaskConical]].map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} /> {label}
            <span className="ml-1 text-xs bg-gray-100 rounded-full px-1.5">
              {id === 'medications' ? medOrders.filter(o => o.status === 'active').length : clinicalOrders.filter(o => o.status !== 'completed').length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Medications tab ─────────────────────────────────────────────────── */}
      {tab === 'medications' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => { setShowMedForm(v => !v); setError('') }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              <Plus size={14} /> New Order
            </button>
          </div>

          {/* New Med Order Form */}
          {showMedForm && (
            <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50 space-y-3">
              <h4 className="font-semibold text-indigo-900 text-sm">New Medication Order</h4>

              {/* Allergy alerts */}
              {allergyAlerts.map((a, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-red-100 border border-red-400 rounded-lg text-red-800 text-xs">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span><strong>ALLERGY ALERT:</strong> Patient is allergic to <strong>{a.allergen_name || a.allergen}</strong></span>
                </div>
              ))}

              {/* Drug-drug interaction alerts */}
              {alerts.map((a, i) => {
                const s = SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.minor
                const Icon = s.icon
                return (
                  <div key={i} className={`flex items-start gap-2 p-2 ${s.bg} border ${s.border} rounded-lg ${s.text} text-xs`}>
                    <Icon size={14} className="flex-shrink-0 mt-0.5" />
                    <span><strong>{s.label} Interaction</strong> with {a.conflictWith}: {a.message}</span>
                  </div>
                )
              })}

              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">Drug Name *</label>
                  <input className="input" placeholder="e.g. Amoxicillin" value={medForm.drug_name}
                    onChange={e => onDrugChange('drug_name', e.target.value)} />
                </div>
                <div>
                  <label className="label">Generic Name</label>
                  <input className="input" placeholder="Generic/brand" value={medForm.generic_name}
                    onChange={e => onDrugChange('generic_name', e.target.value)} />
                </div>
                <div>
                  <label className="label">Dose *</label>
                  <input className="input" placeholder="500mg" value={medForm.dose}
                    onChange={e => setMedForm(f => ({ ...f, dose: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Route *</label>
                  <select className="input" value={medForm.route}
                    onChange={e => setMedForm(f => ({ ...f, route: e.target.value }))}>
                    {ROUTES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Frequency *</label>
                  <select className="input" value={medForm.frequency}
                    onChange={e => setMedForm(f => ({ ...f, frequency: e.target.value }))}>
                    {FREQS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Duration (days)</label>
                  <input className="input" type="number" min="1" placeholder="7" value={medForm.duration_days}
                    onChange={e => setMedForm(f => ({ ...f, duration_days: e.target.value }))} />
                </div>
              </div>

              {/* IV infusion fields */}
              {isIV && (
                <div className="grid grid-cols-3 gap-2 p-2 bg-white rounded-lg border border-indigo-200">
                  <div>
                    <label className="label">IV Fluid</label>
                    <select className="input" value={medForm.iv_fluid}
                      onChange={e => setMedForm(f => ({ ...f, iv_fluid: e.target.value }))}>
                      <option value="">Select</option>
                      {['NS (0.9%)', 'D5W', 'RL', 'DNS', 'D10W', 'Sterile Water'].map(x => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Volume (mL)</label>
                    <input className="input" type="number" placeholder="100" value={medForm.iv_volume_ml}
                      onChange={e => setMedForm(f => ({ ...f, iv_volume_ml: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Rate (mL/hr)</label>
                    <input className="input" placeholder="50 mL/hr" value={medForm.iv_rate}
                      onChange={e => setMedForm(f => ({ ...f, iv_rate: e.target.value }))} />
                  </div>
                </div>
              )}

              {/* Flags row */}
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={medForm.is_stat}
                    onChange={e => setMedForm(f => ({ ...f, is_stat: e.target.checked }))} />
                  <span className="font-semibold text-red-700">STAT</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={medForm.is_prn}
                    onChange={e => setMedForm(f => ({ ...f, is_prn: e.target.checked }))} />
                  PRN
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={medForm.is_continuous}
                    onChange={e => setMedForm(f => ({ ...f, is_continuous: e.target.checked }))} />
                  Continuous infusion
                </label>
              </div>

              {medForm.is_prn && (
                <div>
                  <label className="label">PRN Indication</label>
                  <input className="input" placeholder="e.g. for pain score ≥ 5" value={medForm.prn_reason}
                    onChange={e => setMedForm(f => ({ ...f, prn_reason: e.target.value }))} />
                </div>
              )}

              <div>
                <label className="label">Special Instructions</label>
                <input className="input" placeholder="e.g. with food, dilute in 100 mL NS over 30 min" value={medForm.instructions}
                  onChange={e => setMedForm(f => ({ ...f, instructions: e.target.value }))} />
              </div>

              {error && <p className="text-red-600 text-xs">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowMedForm(false); setMedForm(EMPTY_MED); setAlerts([]); setAllergyAlerts([]) }}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={submitMed} disabled={saving}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Place Order'}
                </button>
              </div>
            </div>
          )}

          {/* Orders list */}
          <div className="space-y-2">
            {medOrders.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-6">No medication orders yet.</p>
            )}
            {medOrders.map(o => (
              <div key={o.id} className={`border rounded-xl p-3 ${o.status === 'active' ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{o.drug_name}</span>
                      {o.generic_name && <span className="text-gray-500 text-xs">({o.generic_name})</span>}
                      {o.is_stat && <span className="px-1.5 py-0.5 bg-red-600 text-white text-xs rounded font-bold">STAT</span>}
                      {o.is_prn && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-xs rounded font-semibold">PRN</span>}
                      {statusBadge(o.status)}
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">
                      {o.dose} · {o.route} · {o.frequency}
                      {o.duration_days && ` · ${o.duration_days}d`}
                      {o.instructions && <span className="text-gray-400"> — {o.instructions}</span>}
                    </div>
                    {o.is_continuous && o.iv_fluid && (
                      <div className="text-xs text-indigo-600 mt-0.5">
                        IV: {o.iv_fluid} {o.iv_volume_ml && `${o.iv_volume_ml}mL`} @ {o.iv_rate}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      Ordered by {o.orderer_name} · {o.ordered_at ? new Date(o.ordered_at).toLocaleString('en-IN') : ''}
                    </div>
                  </div>
                  {o.status === 'active' && (
                    <button onClick={() => discontinue(o.id)}
                      className="flex-shrink-0 p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Discontinue">
                      <Ban size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Clinical Orders tab ─────────────────────────────────────────────── */}
      {tab === 'clinical' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => { setShowClinForm(v => !v); setError('') }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              <Plus size={14} /> New Order
            </button>
          </div>

          {showClinForm && (
            <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50 space-y-3">
              <h4 className="font-semibold text-indigo-900 text-sm">New Clinical Order</h4>
              <div>
                <label className="label">Order Type</label>
                <div className="flex flex-wrap gap-2">
                  {ORDER_TYPES.map(({ value, label, icon: Icon }) => (
                    <button key={value}
                      onClick={() => setClinForm(f => ({ ...f, order_type: value }))}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        clinForm.order_type === value
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                      }`}>
                      <Icon size={11} /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Order Detail *</label>
                <input className="input" placeholder={`e.g. CBC with differential, Chest X-Ray PA view…`}
                  value={clinForm.order_detail}
                  onChange={e => setClinForm(f => ({ ...f, order_detail: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={clinForm.priority}
                    onChange={e => setClinForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="stat">STAT</option>
                  </select>
                </div>
                <div>
                  <label className="label">Instructions</label>
                  <input className="input" placeholder="Special instructions" value={clinForm.instructions}
                    onChange={e => setClinForm(f => ({ ...f, instructions: e.target.value }))} />
                </div>
              </div>
              {error && <p className="text-red-600 text-xs">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowClinForm(false)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={submitClin} disabled={saving}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Place Order'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {clinicalOrders.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-6">No clinical orders yet.</p>
            )}
            {clinicalOrders.map(o => {
              const TypeIcon = ORDER_TYPES.find(t => t.value === o.order_type)?.icon || FlaskConical
              return (
                <div key={o.id} className={`border rounded-xl p-3 ${o.status === 'completed' ? 'bg-gray-50 opacity-60' : 'bg-white'}`}>
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 bg-gray-100 rounded-lg flex-shrink-0">
                      <TypeIcon size={14} className="text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{o.order_detail}</span>
                        {priorityBadge(o.priority)}
                        {statusBadge(o.status)}
                      </div>
                      {o.instructions && <div className="text-xs text-gray-500 mt-0.5">{o.instructions}</div>}
                      <div className="text-xs text-gray-400 mt-1">
                        {o.order_type} · {o.orderer_name} · {o.ordered_at ? new Date(o.ordered_at).toLocaleString('en-IN') : ''}
                      </div>
                      {o.result_notes && (
                        <div className="mt-1 p-1.5 bg-emerald-50 rounded text-xs text-emerald-800">
                          <CheckCircle2 size={10} className="inline mr-1" />{o.result_notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
