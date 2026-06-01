import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { Plus, Search, Package, Loader2, AlertTriangle } from 'lucide-react'
export default function Inventory() {
  const [medicines, setMedicines] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', generic_name: '', category: '', unit: 'tablet', stock_quantity: 0, reorder_level: 10, unit_price: 0 })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const branchId = localStorage.getItem('branch_id')
  const load = useCallback(() => {
    setLoading(true)
    const params = { limit: 200 }
    if (branchId) params.branch_id = branchId
    if (search) params.search = search
    api.get('/pharmacy/medicines', { params }).then(r => setMedicines(Array.isArray(r) ? r : [])).finally(() => setLoading(false))
  }, [search, branchId])
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [load])
  const addMed = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      const payload = { ...form, stock_quantity: Number(form.stock_quantity), reorder_level: Number(form.reorder_level), unit_price: Number(form.unit_price) }
      if (branchId) payload.branch_id = parseInt(branchId)
      await api.post('/pharmacy/medicines', payload)
      setShowAdd(false); load()
    } catch (ex) { setErr(ex.message) }
    finally { setSaving(false) }
  }
  const lowStock = medicines.filter(m => (m.stock_quantity || 0) <= (m.reorder_level || 10))
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Medicine Inventory</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={16}/>Add Medicine</button>
      </div>
      {lowStock.length > 0 && <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-2 text-orange-700 text-sm"><AlertTriangle size={16}/><span><strong>{lowStock.length}</strong> medicines are running low on stock</span></div>}
      <div className="relative mb-4"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input className="input pl-9" placeholder="Search medicines…" value={search} onChange={e => setSearch(e.target.value)}/></div>
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#0F2557' }}>Add Medicine</h3>
            <form onSubmit={addMed} className="space-y-3">
              <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/></div>
              <div><label className="label">Generic Name</label><input className="input" value={form.generic_name} onChange={e=>setForm(f=>({...f,generic_name:e.target.value}))}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Unit</label><select className="input" value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}><option value="tablet">Tablet</option><option value="capsule">Capsule</option><option value="syrup">Syrup (ml)</option><option value="injection">Injection</option><option value="cream">Cream (g)</option><option value="drops">Drops</option></select></div>
                <div><label className="label">Category</label><input className="input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="e.g. Antibiotic"/></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Stock Qty</label><input type="number" className="input" min="0" value={form.stock_quantity} onChange={e=>setForm(f=>({...f,stock_quantity:e.target.value}))}/></div>
                <div><label className="label">Reorder At</label><input type="number" className="input" min="0" value={form.reorder_level} onChange={e=>setForm(f=>({...f,reorder_level:e.target.value}))}/></div>
                <div><label className="label">Unit Price ₹</label><input type="number" className="input" min="0" step="0.01" value={form.unit_price} onChange={e=>setForm(f=>({...f,unit_price:e.target.value}))}/></div>
              </div>
              {err && <p className="text-red-600 text-sm">{err}</p>}
              <div className="flex gap-3 pt-2"><button type="button" onClick={()=>setShowAdd(false)} className="btn-secondary flex-1">Cancel</button><button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Saving…':'Add Medicine'}</button></div>
            </form>
          </div>
        </div>
      )}
      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-400"/></div>
         : medicines.length === 0 ? <div className="p-10 text-center text-gray-400"><Package size={32} className="mx-auto mb-2 opacity-30"/><p>No medicines found</p></div>
         : <div className="table-wrapper"><table className="table">
            <thead><tr><th className="th">Medicine</th><th className="th">Generic</th><th className="th">Unit</th><th className="th">Stock</th><th className="th">Reorder</th><th className="th">Price</th><th className="th">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{medicines.map(m=><tr key={m.id} className="tr-hover">
              <td className="td font-medium">{m.name}</td>
              <td className="td text-gray-500 text-xs">{m.generic_name||'—'}</td>
              <td className="td capitalize">{m.unit||'—'}</td>
              <td className="td font-semibold">{m.stock_quantity??'—'}</td>
              <td className="td text-gray-500">{m.reorder_level??'—'}</td>
              <td className="td">₹{m.unit_price||'—'}</td>
              <td className="td"><span className={`badge ${(m.stock_quantity||0)<=0?'badge-red':(m.stock_quantity||0)<=(m.reorder_level||10)?'badge-yellow':'badge-green'}`}>{(m.stock_quantity||0)<=0?'Out of Stock':(m.stock_quantity||0)<=(m.reorder_level||10)?'Low Stock':'In Stock'}</span></td>
            </tr>)}</tbody>
           </table></div>}
      </div>
    </div>
  )
}
