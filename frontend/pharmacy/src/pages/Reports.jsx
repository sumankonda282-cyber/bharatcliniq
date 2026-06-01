import { useState, useEffect, useMemo } from 'react'
import api from '../api/client'
import { BarChart2, ChevronDown, ChevronUp, Loader2, AlertTriangle, Package } from 'lucide-react'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || 'Uncategorized'
    acc[k] = acc[k] || []
    acc[k].push(item)
    return acc
  }, {})
}

function ReportCard({ title, icon: Icon, iconColor, iconBg, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card overflow-hidden">
      <button
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
            <Icon size={17} style={{ color: iconColor }} />
          </div>
          <span className="font-semibold text-gray-800">{title}</span>
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 px-5 py-5">{children}</div>}
    </div>
  )
}

/* ── Daily Dispensing ── */
function DailyDispensing() {
  const [date, setDate] = useState(todayStr())
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get('/pharmacy/all')
      .then(r => setPrescriptions(Array.isArray(r) ? r : []))
      .catch(ex => setError(ex.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const dayRx = useMemo(() =>
    prescriptions.filter(rx => rx.status === 'dispensed' && rx.created_at && rx.created_at.slice(0, 10) === date),
    [prescriptions, date]
  )

  const allItems = dayRx.flatMap(rx => rx.items || [])
  const totalItems = allItems.length

  const medUsage = useMemo(() => {
    const counts = {}
    allItems.forEach(item => {
      const name = item.medicine_name || item.drug_name || 'Unknown'
      counts[name] = (counts[name] || 0) + (item.quantity || 1)
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [allItems])

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
  if (error) return <p className="text-red-500 text-sm">{error}</p>

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div>
          <label className="label">Select Date</label>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#0F2557' }}>{dayRx.length}</div>
          <div className="text-xs text-gray-500 mt-1">Rx Dispensed</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{totalItems}</div>
          <div className="text-xs text-gray-500 mt-1">Total Items</div>
        </div>
      </div>
      {medUsage.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">No dispensing data for this date.</p>
      ) : (
        <div className="table-wrapper">
          <table className="table text-sm">
            <thead><tr><th className="th">#</th><th className="th">Medicine</th><th className="th">Qty Used</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {medUsage.map(([name, qty], i) => (
                <tr key={name} className="tr-hover">
                  <td className="td text-gray-400">{i + 1}</td>
                  <td className="td font-medium">{name}</td>
                  <td className="td font-semibold">{qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Low Stock ── */
function LowStockReport() {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get('/pharmacy/medicines', { params: { limit: 500 } })
      .then(r => setMedicines(Array.isArray(r) ? r : []))
      .catch(ex => setError(ex.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const lowStock = useMemo(() =>
    medicines.filter(m => (m.stock_quantity || 0) <= (m.reorder_level || 10)),
    [medicines]
  )

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
  if (error) return <p className="text-red-500 text-sm">{error}</p>
  if (lowStock.length === 0) return <p className="text-green-600 text-sm text-center py-4 font-medium">All medicines are adequately stocked.</p>

  return (
    <div className="table-wrapper">
      <table className="table text-sm">
        <thead>
          <tr>
            <th className="th">Medicine</th>
            <th className="th">Current Stock</th>
            <th className="th">Reorder Level</th>
            <th className="th">Unit</th>
            <th className="th">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {lowStock.map(m => {
            const stock = m.stock_quantity || 0
            const reorder = m.reorder_level || 10
            const isCritical = stock === 0
            const isVeryLow = stock < reorder / 2
            return (
              <tr
                key={m.id}
                className="tr-hover"
                style={isCritical ? { background: '#fee2e2' } : isVeryLow ? { background: '#fff7ed' } : {}}
              >
                <td className="td font-medium">{m.name}</td>
                <td className="td font-bold" style={isCritical ? { color: '#CC1414' } : isVeryLow ? { color: '#F5821E' } : {}}>{stock}</td>
                <td className="td text-gray-500">{reorder}</td>
                <td className="td capitalize text-gray-500">{m.unit || '—'}</td>
                <td className="td">
                  <span className={`badge ${isCritical ? 'badge-red' : 'badge-yellow'}`}>
                    {isCritical ? 'Critical' : 'Low Stock'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── Inventory Summary ── */
function InventorySummary() {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get('/pharmacy/medicines', { params: { limit: 500 } })
      .then(r => setMedicines(Array.isArray(r) ? r : []))
      .catch(ex => setError(ex.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const byCategory = groupBy(medicines, 'category')
    const totalValue = medicines.reduce((s, m) => s + (m.stock_quantity || 0) * (m.unit_price || 0), 0)
    const outOfStock = medicines.filter(m => (m.stock_quantity || 0) === 0).length
    const maxInCat = Math.max(...Object.values(byCategory).map(arr => arr.length), 1)
    return { byCategory, totalValue, outOfStock, maxInCat }
  }, [medicines])

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
  if (error) return <p className="text-red-500 text-sm">{error}</p>

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#0F2557' }}>{medicines.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Medicines</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <div className="text-xl font-bold text-green-700">₹{stats.totalValue.toFixed(0)}</div>
          <div className="text-xs text-gray-500 mt-1">Total Stock Value</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#CC1414' }}>{stats.outOfStock}</div>
          <div className="text-xs text-gray-500 mt-1">Out of Stock</div>
        </div>
      </div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">By Category</p>
      <div className="space-y-2">
        {Object.entries(stats.byCategory).sort((a, b) => b[1].length - a[1].length).map(([cat, meds]) => (
          <div key={cat} className="flex items-center gap-3 text-sm">
            <span className="w-32 text-gray-600 truncate">{cat}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className="h-4 rounded-full transition-all"
                style={{ width: `${(meds.length / stats.maxInCat) * 100}%`, background: '#0F2557' }}
              />
            </div>
            <span className="w-6 text-right font-semibold text-gray-700">{meds.length}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Stock Expiry ── */
function StockExpiry() {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get('/pharmacy/medicines', { params: { limit: 500 } })
      .then(r => setMedicines(Array.isArray(r) ? r : []))
      .catch(ex => setError(ex.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
  if (error) return <p className="text-red-500 text-sm">{error}</p>

  const hasExpiry = medicines.some(m => m.expiry_date)
  if (!hasExpiry) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 flex items-center gap-3 text-yellow-800 text-sm">
        <AlertTriangle size={18} />
        <span>Expiry tracking not yet configured. No expiry date data found in the medicine records.</span>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <table className="table text-sm">
        <thead>
          <tr>
            <th className="th">Medicine</th>
            <th className="th">Stock</th>
            <th className="th">Unit</th>
            <th className="th">Expiry Date</th>
            <th className="th">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {medicines.filter(m => m.expiry_date).sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date)).map(m => {
            const expDate = new Date(m.expiry_date)
            const now = new Date()
            const daysLeft = Math.floor((expDate - now) / 86400000)
            const isExpired = daysLeft < 0
            const isSoon = daysLeft >= 0 && daysLeft <= 30
            return (
              <tr key={m.id} className="tr-hover" style={isExpired ? { background: '#fee2e2' } : isSoon ? { background: '#fff7ed' } : {}}>
                <td className="td font-medium">{m.name}</td>
                <td className="td">{m.stock_quantity ?? '—'}</td>
                <td className="td capitalize text-gray-500">{m.unit || '—'}</td>
                <td className="td text-gray-600">{new Date(m.expiry_date).toLocaleDateString('en-IN')}</td>
                <td className="td">
                  <span className={`badge ${isExpired ? 'badge-red' : isSoon ? 'badge-yellow' : 'badge-green'}`}>
                    {isExpired ? 'Expired' : isSoon ? `Expires in ${daysLeft}d` : 'OK'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Reports() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pharmacy Reports</h1>
      </div>
      <div className="space-y-4">
        <ReportCard title="Daily Dispensing Report" icon={BarChart2} iconColor="#0F2557" iconBg="#0F255718">
          <DailyDispensing />
        </ReportCard>
        <ReportCard title="Low Stock Report" icon={AlertTriangle} iconColor="#F5821E" iconBg="#F5821E18">
          <LowStockReport />
        </ReportCard>
        <ReportCard title="Inventory Summary" icon={Package} iconColor="#16a34a" iconBg="#16a34a18">
          <InventorySummary />
        </ReportCard>
        <ReportCard title="Stock Expiry Report" icon={Package} iconColor="#CC1414" iconBg="#CC141418">
          <StockExpiry />
        </ReportCard>
      </div>
    </div>
  )
}
