import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { PackagePlus, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

const TYPES = [
  { value: 'receive_stock', label: 'Receive Stock', desc: 'Adds to current stock' },
  { value: 'adjustment',    label: 'Adjustment',    desc: 'Overrides to new total' },
  { value: 'return',        label: 'Return',        desc: 'Adds returned stock' },
]

const EMPTY_FORM = {
  medicine_id: '',
  transaction_type: 'receive_stock',
  quantity: '',
  batch_number: '',
  expiry_date: '',
  notes: '',
}

export default function StockIn() {
  const [medicines, setMedicines] = useState([])
  const [loadingMeds, setLoadingMeds] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [recentTransactions, setRecentTransactions] = useState([])

  const loadMedicines = useCallback(() => {
    setLoadingMeds(true)
    api.get('/pharmacy/medicines', { params: { limit: 500 } })
      .then(r => setMedicines(Array.isArray(r) ? r : []))
      .finally(() => setLoadingMeds(false))
  }, [])

  useEffect(() => { loadMedicines() }, [loadMedicines])

  const selectedMed = medicines.find(m => String(m.id) === String(form.medicine_id))

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.medicine_id) { setError('Please select a medicine.'); return }
    const qty = Number(form.quantity)
    if (!qty || qty <= 0) { setError('Please enter a valid quantity.'); return }

    const currentStock = selectedMed?.stock_quantity || 0
    let newTotal
    if (form.transaction_type === 'adjustment') {
      newTotal = qty
    } else {
      // receive_stock and return both add to current
      newTotal = currentStock + qty
    }

    setSaving(true)
    try {
      const payload = {
        quantity: newTotal,
      }
      if (form.batch_number) payload.batch_number = form.batch_number
      if (form.expiry_date) payload.expiry_date = form.expiry_date
      if (form.notes) payload.notes = form.notes

      await api.put(`/pharmacy/medicines/${form.medicine_id}/stock`, payload)

      const txn = {
        id: Date.now(),
        medicine: selectedMed?.name || `Medicine #${form.medicine_id}`,
        type: form.transaction_type,
        qty,
        newTotal,
        batch: form.batch_number || '—',
        notes: form.notes || '—',
        time: new Date().toLocaleTimeString('en-IN', { timeStyle: 'short' }),
      }
      setRecentTransactions(prev => [txn, ...prev])
      setSuccess(`Stock updated. ${selectedMed?.name} now has ${newTotal} units.`)
      setForm(EMPTY_FORM)
      loadMedicines()
    } catch (ex) {
      setError(ex.message || 'Failed to update stock')
    } finally {
      setSaving(false)
    }
  }

  function txnTypeBadge(type) {
    if (type === 'receive_stock') return 'badge badge-green'
    if (type === 'adjustment') return 'badge badge-blue'
    if (type === 'return') return 'badge badge-yellow'
    return 'badge badge-gray'
  }

  function txnTypeLabel(type) {
    return TYPES.find(t => t.value === type)?.label || type
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Receive / Adjust Stock</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="col-span-3">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <PackagePlus size={18} style={{ color: '#0F2557' }} />
              <span className="font-semibold text-gray-800">Stock Transaction</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Medicine selector */}
              <div>
                <label className="label">Medicine *</label>
                {loadingMeds ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                    <Loader2 size={14} className="animate-spin" />Loading medicines…
                  </div>
                ) : (
                  <select
                    className="input"
                    value={form.medicine_id}
                    onChange={set('medicine_id')}
                    required
                  >
                    <option value="">— Select Medicine —</option>
                    {medicines.map(m => (
                      <option key={m.id} value={m.id}>{m.name}{m.generic_name ? ` (${m.generic_name})` : ''}</option>
                    ))}
                  </select>
                )}
                {selectedMed && (
                  <div className="mt-2 px-3 py-2 bg-blue-50 rounded-xl text-sm flex items-center gap-3">
                    <span className="text-gray-500">Current Stock:</span>
                    <span className="font-bold" style={{ color: '#0F2557' }}>{selectedMed.stock_quantity ?? 0} {selectedMed.unit || 'units'}</span>
                    <span className={`badge ml-auto ${(selectedMed.stock_quantity || 0) === 0 ? 'badge-red' : (selectedMed.stock_quantity || 0) <= (selectedMed.reorder_level || 10) ? 'badge-yellow' : 'badge-green'}`}>
                      {(selectedMed.stock_quantity || 0) === 0 ? 'Out of Stock' : (selectedMed.stock_quantity || 0) <= (selectedMed.reorder_level || 10) ? 'Low Stock' : 'In Stock'}
                    </span>
                  </div>
                )}
              </div>

              {/* Transaction type */}
              <div>
                <label className="label">Transaction Type *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                  {TYPES.map(t => (
                    <label
                      key={t.value}
                      className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 cursor-pointer transition-all text-center"
                      style={form.transaction_type === t.value
                        ? { borderColor: '#0F2557', background: '#0F255708' }
                        : { borderColor: '#e5e7eb' }
                      }
                    >
                      <input
                        type="radio"
                        name="transaction_type"
                        value={t.value}
                        checked={form.transaction_type === t.value}
                        onChange={set('transaction_type')}
                        className="sr-only"
                      />
                      <span className="text-sm font-semibold text-gray-700">{t.label}</span>
                      <span className="text-xs text-gray-400">{t.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="label">
                  Quantity *
                  {form.transaction_type !== 'adjustment' && selectedMed && form.quantity && (
                    <span className="ml-2 text-green-600 font-normal">
                      → New total: {(selectedMed.stock_quantity || 0) + Number(form.quantity || 0)}
                    </span>
                  )}
                  {form.transaction_type === 'adjustment' && form.quantity && (
                    <span className="ml-2 text-blue-600 font-normal">
                      → Will set to: {form.quantity}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  placeholder={form.transaction_type === 'adjustment' ? 'Enter new total stock' : 'Enter quantity to add'}
                  value={form.quantity}
                  onChange={set('quantity')}
                  required
                />
              </div>

              {/* Batch + Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Batch Number</label>
                  <input className="input" placeholder="e.g. BT-2024-001" value={form.batch_number} onChange={set('batch_number')} />
                </div>
                <div>
                  <label className="label">Expiry Date</label>
                  <input type="date" className="input" value={form.expiry_date} onChange={set('expiry_date')} />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notes</label>
                <input className="input" placeholder="Reason or notes for this transaction" value={form.notes} onChange={set('notes')} />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle size={15} />{error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                  <CheckCircle size={15} />{success}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => { setForm(EMPTY_FORM); setError(''); setSuccess('') }}
                >
                  Reset
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <><Loader2 size={15} className="animate-spin" />Saving…</> : <><PackagePlus size={15} />Update Stock</>}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="col-span-2">
          <div className="card overflow-hidden h-fit">
            <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-700 text-sm flex items-center gap-2">
              <CheckCircle size={15} style={{ color: '#16a34a' }} />
              Recent Transactions (this session)
            </div>
            {recentTransactions.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                <PackagePlus size={28} className="mx-auto mb-2 opacity-30" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentTransactions.map(txn => (
                  <div key={txn.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-gray-800 truncate">{txn.medicine}</span>
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{txn.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={txnTypeBadge(txn.type)}>{txnTypeLabel(txn.type)}</span>
                      <span className="text-xs text-gray-500">qty: <strong>{txn.qty}</strong></span>
                      <span className="text-xs text-gray-500">→ stock: <strong>{txn.newTotal}</strong></span>
                    </div>
                    {txn.batch !== '—' && <p className="text-xs text-gray-400 mt-1">Batch: {txn.batch}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
