import { useState, useEffect } from 'react'
import { pharmacyApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import { Pill, Plus, Package, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function Pharmacy() {
  const { user } = useAuth()
  const [tab, setTab] = useState('pending')
  const [medicines, setMedicines] = useState([])
  const [pending, setPending] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddMed, setShowAddMed] = useState(false)
  const [newMed, setNewMed] = useState({ name: '', generic_name: '', category: '', form: '', strength: '', unit_price: '', stock_quantity: '', reorder_level: 10 })
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      pharmacyApi.getMedicines({ search, limit: 100 }),
      pharmacyApi.getPending(),
    ]).then(([m, p]) => {
      setMedicines(Array.isArray(m) ? m : [])
      setPending(Array.isArray(p) ? p : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [search])

  const handleDispense = async (id) => {
    await pharmacyApi.dispense(id)
    load()
  }

  const handleAddMed = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await pharmacyApi.addMedicine(user.branch_id, newMed)
      setShowAddMed(false)
      setNewMed({ name: '', generic_name: '', category: '', form: '', strength: '', unit_price: '', stock_quantity: '', reorder_level: 10 })
      load()
    } finally {
      setSaving(false)
    }
  }

  const lowStock = medicines.filter(m => m.stock_quantity <= m.reorder_level)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pharmacy</h1>
        <button onClick={() => setShowAddMed(true)} className="btn-primary"><Plus size={16} />Add Medicine</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><Pill size={18} className="text-blue-600" /></div>
          <div><div className="text-xl font-bold">{medicines.length}</div><div className="text-xs text-gray-500">Total Medicines</div></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center"><AlertTriangle size={18} className="text-yellow-600" /></div>
          <div><div className="text-xl font-bold">{lowStock.length}</div><div className="text-xs text-gray-500">Low Stock</div></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center"><Package size={18} className="text-orange-600" /></div>
          <div><div className="text-xl font-bold">{pending.length}</div><div className="text-xs text-gray-500">Pending Dispensing</div></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4 w-fit">
        {['pending', 'inventory'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>{t}</button>
        ))}
      </div>

      {/* Pending Prescriptions */}
      {tab === 'pending' && (
        <div className="card">
          {loading ? <PageLoader /> : pending.length === 0 ? (
            <div className="p-10 text-center text-gray-400"><CheckCircle size={32} className="mx-auto mb-2 opacity-30" /><p>No pending prescriptions</p></div>
          ) : (
            <div className="table-wrapper rounded-xl border-0">
              <table className="table">
                <thead><tr>
                  <th className="th">Rx #</th><th className="th">Patient</th><th className="th">Doctor</th>
                  <th className="th">Items</th><th className="th">Time</th><th className="th">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {pending.map(rx => (
                    <tr key={rx.id} className="tr-hover">
                      <td className="td font-mono">RX-{rx.id}</td>
                      <td className="td font-medium">{rx.patient_name || rx.patient?.full_name}</td>
                      <td className="td text-gray-500">{rx.doctor_name || '—'}</td>
                      <td className="td">
                        <div className="text-xs space-y-0.5">
                          {(rx.items || []).map((item, i) => (
                            <div key={i} className="text-gray-600">{item.medicine_name || item.medicine?.name} · {item.dosage} · {item.duration}</div>
                          ))}
                        </div>
                      </td>
                      <td className="td text-xs text-gray-400">{new Date(rx.created_at).toLocaleTimeString('en-IN')}</td>
                      <td className="td">
                        <button onClick={() => handleDispense(rx.id)} className="btn-success text-xs py-1">
                          <CheckCircle size={13} />Dispense
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Inventory */}
      {tab === 'inventory' && (
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" placeholder="Search medicines…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          {loading ? <PageLoader /> : (
            <div className="table-wrapper rounded-xl border-0">
              <table className="table">
                <thead><tr>
                  <th className="th">Name</th><th className="th">Generic</th><th className="th">Form</th>
                  <th className="th">Strength</th><th className="th">Stock</th><th className="th">Price</th><th className="th">Status</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {medicines.map(m => (
                    <tr key={m.id} className="tr-hover">
                      <td className="td font-medium">{m.name}</td>
                      <td className="td text-gray-500 text-xs">{m.generic_name || '—'}</td>
                      <td className="td text-xs">{m.form || '—'}</td>
                      <td className="td text-xs">{m.strength || '—'}</td>
                      <td className="td font-mono">{m.stock_quantity}</td>
                      <td className="td">₹{m.unit_price || '—'}</td>
                      <td className="td">
                        {m.stock_quantity <= m.reorder_level
                          ? <span className="badge-yellow">Low Stock</span>
                          : <span className="badge-green">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Medicine Modal */}
      <Modal open={showAddMed} onClose={() => setShowAddMed(false)} title="Add Medicine to Inventory">
        <form onSubmit={handleAddMed} className="space-y-3">
          {[
            ['name', 'Medicine Name *', 'text', true],
            ['generic_name', 'Generic Name', 'text', false],
            ['category', 'Category', 'text', false],
            ['form', 'Form (Tablet/Syrup/Injection)', 'text', false],
            ['strength', 'Strength (e.g. 500mg)', 'text', false],
            ['unit_price', 'Unit Price (₹)', 'number', false],
            ['stock_quantity', 'Stock Quantity', 'number', false],
            ['reorder_level', 'Reorder Level', 'number', false],
          ].map(([k, label, type, req]) => (
            <div key={k}>
              <label className="label">{label}</label>
              <input className="input" type={type} required={req} value={newMed[k]} onChange={e => setNewMed(m => ({ ...m, [k]: e.target.value }))} />
            </div>
          ))}
          <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
            {saving ? 'Adding…' : 'Add Medicine'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
