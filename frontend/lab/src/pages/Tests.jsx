import { useState, useEffect } from 'react'
import api from '../api/client'
import { Loader2, AlertCircle, Plus, X, ClipboardList, CheckCircle } from 'lucide-react'

const EMPTY_FORM = {
  name: '',
  code: '',
  price: '',
  turnaround_hours: '',
  category: '',
  description: '',
}

function AddTestModal({ onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const submit = async e => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = {
        name: form.name,
        code: form.code,
        ...(form.price !== '' && { price: parseFloat(form.price) }),
        ...(form.turnaround_hours !== '' && { turnaround_hours: parseInt(form.turnaround_hours, 10) }),
        ...(form.category && { category: form.category }),
        ...(form.description && { description: form.description }),
      }
      await api.post('/lab/tests', payload)
      setSuccess(true)
      setTimeout(() => { onSaved(); onClose() }, 900)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,37,87,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-lg" style={{ color: '#0F2557' }}>Add New Test</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Test Name <span className="text-red-500">*</span></label>
                <input
                  className="input"
                  placeholder="e.g. Complete Blood Count"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Test Code <span className="text-red-500">*</span></label>
                <input
                  className="input"
                  placeholder="e.g. CBC"
                  value={form.code}
                  onChange={e => set('code', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Category</label>
                <input
                  className="input"
                  placeholder="e.g. Hematology"
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Price (₹)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 250"
                  value={form.price}
                  onChange={e => set('price', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Turnaround Time (hours)</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  placeholder="e.g. 24"
                  value={form.turnaround_hours}
                  onChange={e => set('turnaround_hours', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="label">Description</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Brief description of the test…"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>
            </div>
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                <CheckCircle size={16} /><span>Test added successfully!</span>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : 'Add Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Tests() {
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)

  const fetchTests = () => {
    setLoading(true); setError('')
    api.get('/lab/tests')
      .then(r => setTests(Array.isArray(r) ? r : []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchTests() }, [])

  const formatPrice = p => p != null ? `₹${Number(p).toLocaleString('en-IN')}` : '—'
  const formatTAT = h => h ? (h >= 24 ? `${Math.round(h / 24)}d` : `${h}h`) : '—'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Test Catalog</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={16} /> Add Test
        </button>
      </div>

      {loading && <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-400" /></div>}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {!loading && !error && tests.length === 0 && (
        <div className="card p-16 text-center">
          <ClipboardList size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No tests in catalog</p>
          <p className="text-gray-400 text-sm mt-1">Add your first test to get started.</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-4 mx-auto">
            <Plus size={16} /> Add First Test
          </button>
        </div>
      )}

      {!loading && tests.length > 0 && (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Test Name</th>
                  <th className="th">Code</th>
                  <th className="th">Category</th>
                  <th className="th">Price</th>
                  <th className="th">Turnaround</th>
                  <th className="th">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tests.map(test => (
                  <tr key={test.id} className="tr-hover">
                    <td className="td font-medium text-gray-800">{test.name}</td>
                    <td className="td">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg">{test.code}</span>
                    </td>
                    <td className="td">
                      {test.category
                        ? <span className="badge badge-blue">{test.category}</span>
                        : <span className="text-gray-400">—</span>
                      }
                    </td>
                    <td className="td font-medium" style={{ color: '#0F2557' }}>{formatPrice(test.price)}</td>
                    <td className="td text-gray-600">{formatTAT(test.turnaround_hours)}</td>
                    <td className="td text-gray-500 text-xs max-w-xs truncate">{test.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <AddTestModal
          onClose={() => setShowModal(false)}
          onSaved={fetchTests}
        />
      )}
    </div>
  )
}
