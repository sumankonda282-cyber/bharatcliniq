import { useEffect, useState } from 'react'
import { Pill, Plus, Loader2, X, AlertCircle, CheckCircle } from 'lucide-react'
import api from '../api/client'
import PatientList from '../components/PatientList'

const STATUS_BADGE = {
  scheduled: 'badge-blue',
  given: 'badge-green',
  missed: 'badge-red',
  held: 'badge-orange',
  refused: 'badge-gray',
}

function formatTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
}

function isPast(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

const EMPTY_MED_FORM = { medicine_name: '', dose: '', route: 'oral', scheduled_time: '', notes: '' }

export default function MAR() {
  const [selected, setSelected] = useState(null)
  const [marItems, setMarItems] = useState([])
  const [marLoading, setMarLoading] = useState(false)
  const [marError, setMarError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [medForm, setMedForm] = useState(EMPTY_MED_FORM)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState('')
  const [actionLoading, setActionLoading] = useState({})
  const [holdModal, setHoldModal] = useState(null) // { id }
  const [holdReason, setHoldReason] = useState('')

  const fetchMAR = (admId) => {
    setMarLoading(true); setMarError('')
    api.get(`/inpatient/admissions/${admId}/mar`)
      .then(data => setMarItems(Array.isArray(data) ? data : (data.items || data.results || [])))
      .catch(err => setMarError(err.message))
      .finally(() => setMarLoading(false))
  }

  const handleSelect = (adm) => {
    setSelected(adm); fetchMAR(adm.id)
  }

  const patchItem = async (marId, payload) => {
    setActionLoading(s => ({ ...s, [marId]: true }))
    try {
      await api.patch(`/inpatient/mar/${marId}`, payload)
      fetchMAR(selected.id)
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(s => ({ ...s, [marId]: false }))
    }
  }

  const markGiven = (id) => patchItem(id, { status: 'given', administered_at: new Date().toISOString() })
  const markMissed = (id) => patchItem(id, { status: 'missed' })
  const submitHold = async () => {
    if (!holdReason.trim()) return
    await patchItem(holdModal, { status: 'held', hold_reason: holdReason })
    setHoldModal(null); setHoldReason('')
  }

  const handleAddMed = async e => {
    e.preventDefault(); setAddSubmitting(true); setAddError('')
    try {
      await api.post(`/inpatient/admissions/${selected.id}/mar`, medForm)
      setShowAddModal(false); setMedForm(EMPTY_MED_FORM)
      fetchMAR(selected.id)
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAddSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Medication Administration Record</h1>
      </div>

      <div className="flex gap-4 h-[calc(100vh-160px)]">
        <PatientList selectedId={selected?.id} onSelect={handleSelect} />

        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="card h-full flex items-center justify-center">
              <div className="empty-state">
                <Pill size={40} className="empty-state-icon" />
                <span className="empty-state-text">Select a patient to view MAR</span>
              </div>
            </div>
          ) : (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-bold text-gray-800">
                    {selected.patient?.full_name || selected.patient_name}
                  </h2>
                  <p className="text-sm text-gray-500">{selected.admission_number}</p>
                </div>
                <button onClick={() => { setShowAddModal(true); setAddError('') }} className="btn-primary">
                  <Plus size={15} />Add Medication Order
                </button>
              </div>

              {marLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
              ) : marError ? (
                <div className="text-sm text-red-600 p-3">{marError}</div>
              ) : marItems.length === 0 ? (
                <div className="empty-state py-8">
                  <Pill size={28} className="empty-state-icon" />
                  <span className="empty-state-text">No medication orders</span>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="th">Medicine</th>
                        <th className="th">Dose</th>
                        <th className="th">Route</th>
                        <th className="th">Scheduled</th>
                        <th className="th">Status</th>
                        <th className="th">Administered</th>
                        <th className="th">By</th>
                        <th className="th">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-50">
                      {marItems.map((item) => {
                        const canAct = item.status === 'scheduled' && isPast(item.scheduled_time)
                        const loading = actionLoading[item.id]
                        return (
                          <tr key={item.id} className="tr-hover">
                            <td className="td font-medium text-gray-900">{item.medicine_name}</td>
                            <td className="td">{item.dose || '—'}</td>
                            <td className="td capitalize">{item.route || '—'}</td>
                            <td className="td text-xs">{formatTime(item.scheduled_time)}</td>
                            <td className="td">
                              <span className={STATUS_BADGE[item.status] || 'badge-gray'}>
                                {item.status || 'scheduled'}
                              </span>
                            </td>
                            <td className="td text-xs">{formatTime(item.administered_at)}</td>
                            <td className="td text-xs text-gray-500">{item.administered_by || '—'}</td>
                            <td className="td">
                              {canAct && (
                                <div className="flex gap-1 flex-wrap">
                                  <button
                                    disabled={loading}
                                    onClick={() => markGiven(item.id)}
                                    className="btn-success py-1 px-2 text-xs"
                                  >
                                    {loading ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                                    Given
                                  </button>
                                  <button
                                    disabled={loading}
                                    onClick={() => markMissed(item.id)}
                                    className="btn-danger py-1 px-2 text-xs"
                                  >
                                    Missed
                                  </button>
                                  <button
                                    disabled={loading}
                                    onClick={() => { setHoldModal(item.id); setHoldReason('') }}
                                    className="btn py-1 px-2 text-xs bg-orange-100 text-orange-700 hover:bg-orange-200"
                                  >
                                    Hold
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Medication Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-800 text-lg">Add Medication Order</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddMed} className="space-y-4">
              <div>
                <label className="label">Medicine Name</label>
                <input className="input" required placeholder="e.g., Paracetamol 500mg"
                  value={medForm.medicine_name} onChange={e => setMedForm(f => ({ ...f, medicine_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Dose</label>
                  <input className="input" placeholder="e.g., 500mg"
                    value={medForm.dose} onChange={e => setMedForm(f => ({ ...f, dose: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Route</label>
                  <select className="input" value={medForm.route} onChange={e => setMedForm(f => ({ ...f, route: e.target.value }))}>
                    <option value="oral">Oral</option>
                    <option value="iv">IV</option>
                    <option value="im">IM</option>
                    <option value="sc">SC</option>
                    <option value="topical">Topical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Scheduled Time</label>
                <input className="input" type="datetime-local"
                  value={medForm.scheduled_time} onChange={e => setMedForm(f => ({ ...f, scheduled_time: e.target.value }))} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} placeholder="Additional instructions..."
                  value={medForm.notes} onChange={e => setMedForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {addError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle size={15} />{addError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={addSubmitting} className="btn-primary flex-1">
                  {addSubmitting ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Add Order'}
                </button>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hold Reason Modal */}
      {holdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setHoldModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
            <h3 className="font-bold text-gray-800 mb-4">Hold Medication</h3>
            <label className="label">Reason for hold</label>
            <textarea className="input mb-4" rows={3} placeholder="Enter reason..."
              value={holdReason} onChange={e => setHoldReason(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={submitHold} disabled={!holdReason.trim()} className="btn-primary flex-1">Confirm Hold</button>
              <button onClick={() => setHoldModal(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
