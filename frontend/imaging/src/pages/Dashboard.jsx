import { useState, useEffect } from 'react'
import api from '../api/client'
import { ScanLine, Clock, CheckCircle, Loader2 } from 'lucide-react'
export default function Dashboard() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/imaging/orders', { params: { limit: 200 } }).then(r => setOrders(Array.isArray(r) ? r : [])).finally(() => setLoading(false)) }, [])
  const pending   = orders.filter(o => o.status === 'pending' || o.status === 'scheduled')
  const inProcess = orders.filter(o => o.status === 'in_progress')
  const completed = orders.filter(o => o.status === 'completed')
  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-400"/></div>
  return (
    <div>
      <div className="page-header"><h1 className="page-title">Imaging Dashboard</h1></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card p-5 flex items-center gap-4"><div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background:'#F5821E18'}}><Clock size={22} style={{color:'#F5821E'}}/></div><div><div className="text-2xl font-bold" style={{color:'#0F2557'}}>{pending.length}</div><div className="text-xs text-gray-500">Pending</div></div></div>
        <div className="card p-5 flex items-center gap-4"><div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background:'#0F255718'}}><ScanLine size={22} style={{color:'#0F2557'}}/></div><div><div className="text-2xl font-bold" style={{color:'#0F2557'}}>{inProcess.length}</div><div className="text-xs text-gray-500">In Progress</div></div></div>
        <div className="card p-5 flex items-center gap-4"><div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background:'#16A34A18'}}><CheckCircle size={22} style={{color:'#16A34A'}}/></div><div><div className="text-2xl font-bold" style={{color:'#0F2557'}}>{completed.length}</div><div className="text-xs text-gray-500">Completed</div></div></div>
      </div>
      {orders.length > 0 && <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-700">Recent Orders</div>
        <div className="table-wrapper"><table className="table"><thead><tr><th className="th">Order #</th><th className="th">Patient</th><th className="th">Type</th><th className="th">Status</th><th className="th">Date</th></tr></thead>
        <tbody className="divide-y divide-gray-100">{orders.slice(0,10).map(o=><tr key={o.id} className="tr-hover">
          <td className="td font-mono text-xs">IMG-{o.id}</td>
          <td className="td font-medium">{o.patient?.full_name||'—'}</td>
          <td className="td">{o.modality||o.body_part||'—'}</td>
          <td className="td"><span className={`badge ${o.status==='completed'?'badge-green':o.status==='in_progress'?'badge-blue':'badge-yellow'}`}>{o.status?.replace('_',' ')}</span></td>
          <td className="td text-gray-500">{o.created_at?new Date(o.created_at).toLocaleDateString('en-IN'):'—'}</td>
        </tr>)}</tbody></table></div>
      </div>}
    </div>
  )
}
