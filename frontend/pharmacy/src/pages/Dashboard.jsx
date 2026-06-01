import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { Pill, Package, CheckCircle, Loader2, TrendingUp, IndianRupee, PackagePlus, BarChart2 } from 'lucide-react'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function Dashboard() {
  const [pending, setPending] = useState([])
  const [medicines, setMedicines] = useState([])
  const [allRx, setAllRx] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/pharmacy/pending'),
      api.get('/pharmacy/medicines', { params: { limit: 200 } }),
      api.get('/pharmacy/all'),
      api.get('/billing/invoices', { params: { limit: 200 } }),
    ]).then(([p, m, all, inv]) => {
      setPending(Array.isArray(p) ? p : [])
      setMedicines(Array.isArray(m) ? m : [])
      setAllRx(Array.isArray(all) ? all : [])
      const invData = Array.isArray(inv) ? inv : (Array.isArray(inv?.invoices) ? inv.invoices : [])
      setInvoices(invData)
    }).finally(() => setLoading(false))
  }, [])

  const today = todayStr()

  const lowStock = medicines.filter(m => (m.stock_quantity || 0) < 10)
  const dispensedToday = useMemo(() =>
    allRx.filter(rx => rx.status === 'dispensed' && rx.created_at && rx.created_at.slice(0, 10) === today).length,
    [allRx, today]
  )
  const revenueToday = useMemo(() =>
    invoices
      .filter(inv => inv.status === 'paid' && inv.created_at && inv.created_at.slice(0, 10) === today)
      .reduce((s, inv) => s + (Number(inv.total_amount) || 0), 0),
    [invoices, today]
  )

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-400"/></div>
  return (
    <div>
      <div className="page-header"><h1 className="page-title">Pharmacy Dashboard</h1></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background:'#CC141418'}}><Pill size={22} style={{color:'#CC1414'}}/></div>
          <div><div className="text-2xl font-bold" style={{color:'#0F2557'}}>{pending.length}</div><div className="text-xs text-gray-500">Pending Rx</div></div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background:'#F5821E18'}}><Package size={22} style={{color:'#F5821E'}}/></div>
          <div><div className="text-2xl font-bold" style={{color:'#0F2557'}}>{medicines.length}</div><div className="text-xs text-gray-500">Total Medicines</div></div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background:'#DC262618'}}><Package size={22} style={{color:'#DC2626'}}/></div>
          <div><div className="text-2xl font-bold" style={{color:'#DC2626'}}>{lowStock.length}</div><div className="text-xs text-gray-500">Low Stock (&lt;10)</div></div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background:'#16a34a18'}}><TrendingUp size={22} style={{color:'#16a34a'}}/></div>
          <div><div className="text-2xl font-bold" style={{color:'#16a34a'}}>{dispensedToday}</div><div className="text-xs text-gray-500">Dispensed Today</div></div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background:'#0F255718'}}><IndianRupee size={22} style={{color:'#0F2557'}}/></div>
          <div><div className="text-2xl font-bold" style={{color:'#0F2557'}}>₹{revenueToday.toFixed(0)}</div><div className="text-xs text-gray-500">Revenue Today</div></div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-5 mb-6">
        <div className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wider">Quick Actions</div>
        <div className="flex gap-3">
          <Link to="/pending" className="btn-primary"><Pill size={15}/>View Pending Rx</Link>
          <Link to="/stock-in" className="btn-secondary"><PackagePlus size={15}/>Receive Stock</Link>
          <Link to="/reports" className="btn-secondary"><BarChart2 size={15}/>View Reports</Link>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-700 flex items-center gap-2"><Pill size={16} style={{color:'#CC1414'}}/>Pending Prescriptions</div>
          <div className="table-wrapper"><table className="table"><thead><tr><th className="th">Rx #</th><th className="th">Patient</th><th className="th">Doctor</th><th className="th">Date</th></tr></thead>
          <tbody className="divide-y divide-gray-100">{pending.slice(0,10).map(rx=><tr key={rx.id} className="tr-hover"><td className="td font-mono text-xs">RX-{rx.id}</td><td className="td font-medium">{rx.patient?.full_name||'—'}</td><td className="td text-gray-500">{rx.doctor?.full_name||'—'}</td><td className="td text-gray-500">{rx.created_at?new Date(rx.created_at).toLocaleDateString('en-IN'):'—'}</td></tr>)}</tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}
