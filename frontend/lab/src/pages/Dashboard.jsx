import { useState, useEffect } from 'react'
import api from '../api/client'
import { FlaskConical, Clock, CheckCircle, Loader2 } from 'lucide-react'
export default function Dashboard() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/lab/orders', { params: { limit: 200 } }).then(r => setOrders(Array.isArray(r) ? r : [])).finally(() => setLoading(false)) }, [])
  const pending   = orders.filter(o => o.status === 'pending' || o.status === 'sample_collected')
  const inProcess = orders.filter(o => o.status === 'processing')
  const completed = orders.filter(o => o.status === 'completed')
  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-400"/></div>
  return (
    <div>
      <div className="page-header"><h1 className="page-title">Lab Dashboard</h1></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card p-5 flex items-center gap-4"><div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background:'#F5821E18'}}><Clock size={22} style={{color:'#F5821E'}}/></div><div><div className="text-2xl font-bold" style={{color:'#F5821E'}}>{pending.length}</div><div className="text-xs text-gray-500">Pending Orders</div></div></div>
        <div className="card p-5 flex items-center gap-4"><div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background:'#3B82F618'}}><FlaskConical size={22} style={{color:'#3B82F6'}}/></div><div><div className="text-2xl font-bold" style={{color:'#3B82F6'}}>{inProcess.length}</div><div className="text-xs text-gray-500">Processing</div></div></div>
        <div className="card p-5 flex items-center gap-4"><div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background:'#16A34A18'}}><CheckCircle size={22} style={{color:'#16A34A'}}/></div><div><div className="text-2xl font-bold" style={{color:'#16A34A'}}>{completed.length}</div><div className="text-xs text-gray-500">Completed</div></div></div>
      </div>
      {pending.length > 0 && <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-700">Pending Orders</div>
        <div className="table-wrapper"><table className="table"><thead><tr><th className="th">Order #</th><th className="th">Patient</th><th className="th">Tests</th><th className="th">Status</th></tr></thead>
        <tbody className="divide-y divide-gray-100">{pending.slice(0,10).map(o=><tr key={o.id} className="tr-hover">
          <td className="td font-mono text-xs">LAB-{o.id}</td>
          <td className="td font-medium">{o.patient?.full_name||'—'}</td>
          <td className="td">{o.items?.length||0} test{(o.items?.length||0)!==1?'s':''}</td>
          <td className="td"><span className={`badge ${o.status==='pending'?'badge-yellow':o.status==='processing'?'badge-blue':'badge-green'}`}>{o.status?.replace('_',' ')}</span></td>
        </tr>)}</tbody></table></div>
      </div>}
      {pending.length === 0 && <div className="card p-10 text-center text-gray-400"><CheckCircle size={40} className="mx-auto mb-3 text-green-400"/><div className="font-medium">All caught up! No pending orders.</div></div>}
    </div>
  )
}
