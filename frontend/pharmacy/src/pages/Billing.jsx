import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import api from '../api/client'
import { CreditCard, Loader2, X, IndianRupee, Plus, Trash2, Search, Eye, Printer } from 'lucide-react'

const MAIN_TABS = ['Billing Counter', 'Invoice History']
const INV_TABS = ['Pending', 'Paid', 'All']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function statusBadge(status) {
  if (status === 'paid') return 'badge badge-green'
  if (status === 'partial' || status === 'partially_paid') return 'badge badge-yellow'
  if (status === 'pending') return 'badge badge-red'
  return 'badge badge-gray'
}

function saleTypeBadge(saleType) {
  if (saleType === 'otc') return <span className="badge badge-blue">OTC</span>
  return <span className="badge badge-gray">Rx</span>
}

// ── Print Invoice Modal ──────────────────────────────────────────────────────

function PrintModal({ invoice, onClose }) {
  if (!invoice) return null
  const printRef = useRef()

  function doPrint() {
    const win = window.open('', '_blank')
    win.document.write(`<html><head><title>Invoice</title><style>
      body { font-family: sans-serif; padding: 20px; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
      th { background: #f3f4f6; }
      .right { text-align: right; }
      h2, h3 { margin: 4px 0; }
    </style></head><body>${printRef.current.innerHTML}</body></html>`)
    win.document.close()
    win.print()
  }

  const customer = invoice.customer_name || invoice.patient_name || 'Walk-in Customer'
  const gstBreakup = invoice.gst_breakup || {}

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#0F2557]">Invoice</h3>
          <div className="flex gap-2">
            <button onClick={doPrint} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1">
              <Printer size={14} />Print
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
        </div>
        <div ref={printRef}>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-[#0F2557]">BharatCliniq Pharmacy</h2>
            <p className="text-sm text-gray-500">Invoice #: {invoice.invoice_number || `INV-${invoice.id}`}</p>
            <p className="text-sm text-gray-500">Date: {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString('en-IN') : '—'}</p>
          </div>
          <div className="mb-4 p-3 bg-gray-50 rounded-xl text-sm">
            <p><strong>Customer:</strong> {customer}</p>
            {invoice.customer_mobile && <p><strong>Mobile:</strong> {invoice.customer_mobile}</p>}
            {invoice.prescription_ref && <p><strong>Rx Ref:</strong> {invoice.prescription_ref}</p>}
            <p><strong>Type:</strong> {invoice.sale_type === 'otc' ? 'OTC Walk-in' : 'Prescription'}</p>
          </div>
          <table className="table text-sm mb-4 w-full">
            <thead>
              <tr>
                <th className="th">#</th>
                <th className="th">Item</th>
                <th className="th">HSN</th>
                <th className="th">Qty</th>
                <th className="th">Price</th>
                <th className="th">Disc</th>
                <th className="th">GST%</th>
                <th className="th">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(invoice.items || []).map((item, i) => (
                <tr key={i}>
                  <td className="td">{i + 1}</td>
                  <td className="td">{item.description || item.medicine_name || '—'}</td>
                  <td className="td text-gray-500">{item.hsn_code || '—'}</td>
                  <td className="td">{item.quantity}</td>
                  <td className="td">₹{Number(item.unit_price || 0).toFixed(2)}</td>
                  <td className="td">₹{Number(item.discount_amount || 0).toFixed(2)}</td>
                  <td className="td">{item.gst_rate || 0}%</td>
                  <td className="td font-semibold">₹{Number(item.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end">
            <div className="w-64 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{Number(invoice.subtotal || 0).toFixed(2)}</span></div>
              {Number(invoice.discount || 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>-₹{Number(invoice.discount || 0).toFixed(2)}</span></div>}
              {Object.entries(gstBreakup).map(([rate, data]) => (
                Number(data.gst) > 0 && <div key={rate} className="flex justify-between text-gray-500"><span>GST {rate}%</span><span>₹{Number(data.gst).toFixed(2)}</span></div>
              ))}
              <div className="flex justify-between border-t pt-1 font-bold text-base">
                <span>Grand Total</span><span>₹{Number(invoice.total || 0).toFixed(2)}</span>
              </div>
              {invoice.payment_method && <div className="flex justify-between text-green-700"><span>Paid ({invoice.payment_method})</span><span>₹{Number(invoice.amount_paid || 0).toFixed(2)}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Billing Counter ──────────────────────────────────────────────────────────

function BillingCounter({ onBillCreated }) {
  const [saleType, setSaleType] = useState('otc')
  const [customerName, setCustomerName] = useState('')
  const [customerMobile, setCustomerMobile] = useState('')
  const [prescriptionRef, setPrescriptionRef] = useState('')
  const [medSearch, setMedSearch] = useState('')
  const [medResults, setMedResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [items, setItems] = useState([])
  const [payMethod, setPayMethod] = useState('cash')
  const [amountTendered, setAmountTendered] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [generics, setGenerics] = useState({})
  const [printInvoice, setPrintInvoice] = useState(null)
  const searchDebounce = useRef(null)

  useEffect(() => {
    if (!medSearch.trim()) { setMedResults([]); return }
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      setSearching(true)
      api.get('/pharmacy/medicines/search', { params: { q: medSearch } })
        .then(r => setMedResults(Array.isArray(r) ? r : []))
        .finally(() => setSearching(false))
    }, 300)
  }, [medSearch])

  function addItem(med) {
    setItems(prev => {
      const existing = prev.find(i => i.medicine_id === med.id)
      if (existing) return prev.map(i => i.medicine_id === med.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, {
        medicine_id: med.id,
        description: med.name,
        quantity: 1,
        unit_price: Number(med.unit_price) || 0,
        mrp: med.mrp ? Number(med.mrp) : null,
        gst_rate: med.gst_rate ? Number(med.gst_rate) : 0,
        hsn_code: med.hsn_code || '',
        discount_amount: 0,
        schedule: med.schedule,
      }]
    })
    setMedSearch('')
    setMedResults([])
    if (med.generic_name) {
      api.get('/pharmacy/medicines/suggest-generic', { params: { name: med.name } })
        .then(r => { if (Array.isArray(r) && r.length > 0) setGenerics(g => ({ ...g, [med.id]: r[0] })) })
        .catch(() => {})
    }
  }

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const totals = useMemo(() => {
    let subtotal = 0, totalDisc = 0, totalGst = 0
    const gstByRate = {}
    items.forEach(item => {
      const lineSubtotal = Number(item.unit_price) * Number(item.quantity)
      const disc = Number(item.discount_amount) || 0
      const taxable = lineSubtotal - disc
      const gstRate = Number(item.gst_rate) || 0
      const gst = (taxable * gstRate / 100)
      subtotal += lineSubtotal
      totalDisc += disc
      totalGst += gst
      if (!gstByRate[gstRate]) gstByRate[gstRate] = 0
      gstByRate[gstRate] += gst
    })
    const grand = subtotal - totalDisc + totalGst
    return { subtotal, totalDisc, totalGst, grand, gstByRate }
  }, [items])

  const change = amountTendered ? Number(amountTendered) - totals.grand : null

  async function generateBill() {
    if (items.length === 0) { setError('Add at least one item'); return }
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        sale_type: saleType,
        customer_name: customerName || null,
        customer_mobile: customerMobile || null,
        prescription_ref: prescriptionRef || null,
        payment_method: payMethod,
        items: items.map(i => ({
          description: i.description,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          medicine_id: i.medicine_id || null,
          hsn_code: i.hsn_code || null,
          gst_rate: Number(i.gst_rate) || null,
          discount_amount: Number(i.discount_amount) || 0,
          mrp: i.mrp || null,
          item_type: 'medicine',
        })),
      }
      const inv = await api.post('/billing/invoices', payload)
      const detail = await api.get(`/billing/invoices/${inv.id}`)
      setPrintInvoice(detail)
      setItems([])
      setCustomerName('')
      setCustomerMobile('')
      setPrescriptionRef('')
      setAmountTendered('')
      setGenerics({})
      if (onBillCreated) onBillCreated()
    } catch (ex) {
      setError(ex.message || 'Failed to create invoice')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {printInvoice && <PrintModal invoice={printInvoice} onClose={() => setPrintInvoice(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Sale Type</p>
            <div className="flex gap-2 mb-4">
              {[['otc', 'OTC Walk-in'], ['prescription', 'Linked to Rx']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setSaleType(val)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${saleType === val ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  style={saleType === val ? { background: '#0F2557' } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Customer Name <span className="text-gray-400 font-normal">(Optional)</span></label>
                <input className="input" placeholder="Walk-in customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label className="label">Mobile <span className="text-gray-400 font-normal">(Optional)</span></label>
                <input className="input" placeholder="Customer mobile" value={customerMobile} onChange={e => setCustomerMobile(e.target.value)} />
              </div>
            </div>
            {saleType === 'otc' && (
              <div className="mt-3">
                <label className="label">Prescription Reference <span className="text-gray-400 font-normal">(Optional)</span></label>
                <input className="input" placeholder="External Rx number if any" value={prescriptionRef} onChange={e => setPrescriptionRef(e.target.value)} />
              </div>
            )}
          </div>

          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Add Medicine</p>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9"
                placeholder="Type medicine name to search…"
                value={medSearch}
                onChange={e => setMedSearch(e.target.value)}
              />
              {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
            </div>
            {medResults.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {medResults.map(m => (
                  <button
                    key={m.id}
                    onClick={() => addItem(m)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-center justify-between border-b last:border-0 border-gray-100 transition-colors"
                  >
                    <div>
                      <span className="font-medium text-sm">{m.name}</span>
                      {m.schedule && m.schedule !== 'OTC' && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold">{m.schedule}</span>
                      )}
                      {m.generic_name && <span className="ml-2 text-xs text-gray-400">{m.generic_name}</span>}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-semibold" style={{ color: '#0F2557' }}>₹{m.unit_price || '—'}</div>
                      <div className={`text-xs ${m.in_stock ? 'text-green-600' : 'text-red-500'}`}>{m.in_stock ? `${m.stock_quantity} in stock` : 'Out of stock'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700">Bill Items</div>
              <div className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <div key={idx} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-medium text-sm">{item.description}</span>
                        {item.schedule && item.schedule !== 'OTC' && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold">{item.schedule}</span>
                        )}
                        {item.mrp && <span className="ml-2 text-xs text-gray-400">MRP: ₹{item.mrp}</span>}
                      </div>
                      <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 ml-2">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {generics[item.medicine_id] && (
                      <div className="mb-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
                        Generic available: <strong>{generics[item.medicine_id].name}</strong> at ₹{generics[item.medicine_id].unit_price}
                        <button
                          className="ml-2 underline"
                          onClick={() => {
                            const g = generics[item.medicine_id]
                            updateItem(idx, 'description', g.name)
                            updateItem(idx, 'unit_price', Number(g.unit_price))
                            updateItem(idx, 'medicine_id', g.id)
                          }}
                        >Switch</button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      <div>
                        <label className="label text-xs">Qty</label>
                        <input type="number" className="input py-1" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-xs">Unit Price ₹</label>
                        <input type="number" className="input py-1" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-xs">Discount ₹</label>
                        <input type="number" className="input py-1" min="0" step="0.01" value={item.discount_amount} onChange={e => updateItem(idx, 'discount_amount', Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-xs">GST %</label>
                        <input type="number" className="input py-1" min="0" step="0.01" value={item.gst_rate} onChange={e => updateItem(idx, 'gst_rate', Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="mt-1 text-right text-sm font-semibold text-gray-700">
                      Amount: ₹{((Number(item.unit_price) * Number(item.quantity) - Number(item.discount_amount || 0)) * (1 + Number(item.gst_rate || 0) / 100)).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Bill Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span></div>
              {totals.totalDisc > 0 && <div className="flex justify-between text-green-700"><span>Total Discount</span><span>-₹{totals.totalDisc.toFixed(2)}</span></div>}
              {Object.entries(totals.gstByRate).map(([rate, amount]) =>
                amount > 0 ? (
                  <div key={rate} className="flex justify-between text-gray-500">
                    <span>GST {rate}% slab</span><span>₹{amount.toFixed(2)}</span>
                  </div>
                ) : null
              )}
              <div className="flex justify-between border-t pt-2 font-bold text-lg">
                <span>Grand Total</span><span style={{ color: '#0F2557' }}>₹{totals.grand.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Payment</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {['cash', 'card', 'upi', 'credit'].map(m => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={`py-2 rounded-xl text-sm font-semibold border-2 capitalize transition-all ${payMethod === m ? 'text-white border-transparent' : 'text-gray-600 border-gray-200'}`}
                  style={payMethod === m ? { background: '#0F2557' } : {}}
                >
                  {m}
                </button>
              ))}
            </div>
            {payMethod === 'cash' && (
              <div className="mb-3">
                <label className="label">Amount Tendered ₹</label>
                <input type="number" className="input" min="0" step="0.01" placeholder="Cash received" value={amountTendered} onChange={e => setAmountTendered(e.target.value)} />
                {change !== null && change >= 0 && (
                  <p className="text-green-700 text-sm mt-1 font-semibold">Change: ₹{change.toFixed(2)}</p>
                )}
              </div>
            )}
            {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
            <button
              onClick={generateBill}
              disabled={submitting || items.length === 0}
              className="btn-primary w-full justify-center"
            >
              {submitting ? <><Loader2 size={15} className="animate-spin" />Generating…</> : 'Generate Bill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Invoice History ──────────────────────────────────────────────────────────

function InvoiceHistory() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('Pending')
  const [payModal, setPayModal] = useState(null)
  const [payMethod, setPayMethod] = useState('cash')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [viewInvoice, setViewInvoice] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    api.get('/billing/invoices', { params: { limit: 200 } })
      .then(r => setInvoices(Array.isArray(r) ? r : []))
      .catch(ex => setError(ex.message || 'Failed to load invoices'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const today = todayStr()

  const summaryStats = useMemo(() => {
    const todayInv = invoices.filter(inv => inv.created_at && inv.created_at.slice(0, 10) === today)
    const totalBilledToday = todayInv.reduce((s, i) => s + (Number(i.total_amount) || 0), 0)
    const collectedToday = todayInv.filter(i => i.status === 'paid').reduce((s, i) => s + (Number(i.total_amount) || 0), 0)
    const pendingAmount = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + (Number(i.total_amount) || 0), 0)
    return { totalBilledToday, collectedToday, pendingAmount }
  }, [invoices, today])

  const filtered = useMemo(() => {
    if (tab === 'Pending') return invoices.filter(i => i.status === 'pending' || i.status === 'partially_paid')
    if (tab === 'Paid') return invoices.filter(i => i.status === 'paid')
    return invoices
  }, [invoices, tab])

  async function collectPayment() {
    if (!payModal) return
    setPaying(true)
    setPayError('')
    try {
      await api.post(`/billing/invoices/${payModal.id}/pay`, { payment_method: payMethod })
      setPayModal(null)
      load()
    } catch (ex) {
      setPayError(ex.message || 'Payment failed')
    } finally {
      setPaying(false)
    }
  }

  async function viewDetail(inv) {
    setLoadingDetail(true)
    try {
      const detail = await api.get(`/billing/invoices/${inv.id}`)
      setViewInvoice(detail)
    } catch {
      setViewInvoice(inv)
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <div>
      {viewInvoice && <PrintModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0F255718' }}>
            <IndianRupee size={18} style={{ color: '#0F2557' }} />
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: '#0F2557' }}>₹{summaryStats.totalBilledToday.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Total Billed Today</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#16a34a18' }}>
            <CreditCard size={18} style={{ color: '#16a34a' }} />
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: '#16a34a' }}>₹{summaryStats.collectedToday.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Collected Today</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#CC141418' }}>
            <IndianRupee size={18} style={{ color: '#CC1414' }} />
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: '#CC1414' }}>₹{summaryStats.pendingAmount.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Pending Amount</div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 border border-gray-100 w-fit shadow-sm">
        {INV_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? 'px-4 py-1.5 rounded-lg text-sm font-semibold text-white' : 'px-4 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-800'}
            style={tab === t ? { background: '#0F2557' } : {}}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={30} className="animate-spin text-gray-400" /></div>
      ) : error ? (
        <div className="card p-10 text-center text-red-500">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-14 text-center text-gray-400">
          <CreditCard size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No invoices found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Invoice #</th>
                  <th className="th">Customer</th>
                  <th className="th">Type</th>
                  <th className="th">Amount</th>
                  <th className="th">Status</th>
                  <th className="th">Date</th>
                  <th className="th">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(inv => (
                  <tr key={inv.id} className="tr-hover">
                    <td className="td font-mono text-xs text-gray-600">{inv.invoice_number || `INV-${inv.id}`}</td>
                    <td className="td font-medium">{inv.customer_name || inv.patient_name || 'Walk-in'}</td>
                    <td className="td">{saleTypeBadge(inv.sale_type)}</td>
                    <td className="td font-semibold">₹{Number(inv.total_amount || inv.total || 0).toFixed(2)}</td>
                    <td className="td"><span className={statusBadge(inv.status)}>{inv.status || '—'}</span></td>
                    <td className="td text-gray-500 text-xs whitespace-nowrap">
                      {inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewDetail(inv)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                          disabled={loadingDetail}
                        >
                          <Eye size={14} />
                        </button>
                        {(inv.status === 'pending' || inv.status === 'partially_paid') && (
                          <button
                            className="btn-success text-xs py-1 px-3"
                            onClick={() => { setPayModal(inv); setPayMethod('cash'); setPayError('') }}
                          >
                            Collect
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {payModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: '#0F2557' }}>Collect Payment</h3>
              <button onClick={() => setPayModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
              <div className="flex justify-between mb-1"><span className="text-gray-500">Invoice</span><span className="font-mono text-xs">{payModal.invoice_number || `INV-${payModal.id}`}</span></div>
              <div className="flex justify-between mb-1"><span className="text-gray-500">Customer</span><span className="font-medium">{payModal.customer_name || payModal.patient_name || 'Walk-in'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-bold text-base">₹{Number(payModal.total_amount || payModal.total || 0).toFixed(2)}</span></div>
            </div>
            <div className="mb-4">
              <label className="label">Payment Method</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {['cash', 'card', 'upi', 'credit'].map(m => (
                  <button
                    key={m}
                    onClick={() => setPayMethod(m)}
                    className={`py-2 rounded-xl text-sm font-semibold border capitalize transition-all ${payMethod === m ? 'text-white border-transparent' : 'border-gray-200 text-gray-600'}`}
                    style={payMethod === m ? { background: '#0F2557' } : {}}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {payError && <p className="text-red-600 text-sm mb-3">{payError}</p>}
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setPayModal(null)}>Cancel</button>
              <button className="btn-success flex-1 justify-center" onClick={collectPayment} disabled={paying}>
                {paying ? 'Processing…' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Billing() {
  const [mainTab, setMainTab] = useState('Billing Counter')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pharmacy Billing</h1>
      </div>

      <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-gray-100 w-fit shadow-sm">
        {MAIN_TABS.map(t => (
          <button
            key={t}
            onClick={() => setMainTab(t)}
            className={mainTab === t ? 'px-5 py-2 rounded-lg text-sm font-semibold text-white' : 'px-5 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-800'}
            style={mainTab === t ? { background: '#0F2557' } : {}}
          >
            {t}
          </button>
        ))}
      </div>

      {mainTab === 'Billing Counter'
        ? <BillingCounter key={refreshKey} onBillCreated={() => setRefreshKey(k => k + 1)} />
        : <InvoiceHistory key={refreshKey} />
      }
    </div>
  )
}
