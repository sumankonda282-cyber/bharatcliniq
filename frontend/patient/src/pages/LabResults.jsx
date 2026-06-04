import { useState, useEffect } from 'react'
import api from '../api/client'
import { FlaskConical, ScanLine, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'

const FLAG_COLOR = {
  H: '#CC1414', HH: '#7f1d1d', L: '#1d4ed8', LL: '#1e3a8a',
  N: '#16a34a', A: '#d97706',
}
const FLAG_LABEL = { H: 'High', HH: 'Critical High', L: 'Low', LL: 'Critical Low', N: 'Normal', A: 'Abnormal' }

const MODALITY_COLOR = {
  CT: '#0F2557', MR: '#7c3aed', MRI: '#7c3aed', CR: '#0369a1',
  DX: '#0369a1', US: '#059669', NM: '#b45309', PT: '#dc2626',
  MG: '#be185d', OT: '#6b7280',
}

function FlagBadge({ flag }) {
  if (!flag || flag === 'N') return null
  const color = FLAG_COLOR[flag] || '#6b7280'
  return (
    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: color + '18', color }}>
      {FLAG_LABEL[flag] || flag}
    </span>
  )
}

function LabOrderCard({ order }) {
  const [open, setOpen] = useState(false)
  const hasAbnormal = (order.result?.observations || []).some(o => o.flag && o.flag !== 'N')

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#EEF2FF' }}>
          <FlaskConical size={18} style={{ color: '#0F2557' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 flex items-center gap-2">
            {order.order_id}
            {hasAbnormal && <AlertTriangle size={13} className="text-red-500" />}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {order.date} · {(order.test_names || []).join(', ') || 'Lab tests'} · {order.clinic_name}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
            <CheckCircle size={12} /> Signed
          </span>
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {open && order.result && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50 space-y-3">
          {(order.result.observations || []).length > 0 && (
            <div className="space-y-2">
              {order.result.observations.map((obs, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl border"
                  style={{
                    background: obs.flag && obs.flag !== 'N' ? (FLAG_COLOR[obs.flag] || '#6b7280') + '08' : '#fff',
                    borderColor: obs.flag && obs.flag !== 'N' ? (FLAG_COLOR[obs.flag] || '#6b7280') + '30' : '#f1f5f9',
                  }}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{obs.test_name || obs.name || `Test ${i+1}`}</p>
                    {obs.value != null && (
                      <p className="text-sm font-mono font-bold mt-0.5" style={{ color: obs.flag && obs.flag !== 'N' ? FLAG_COLOR[obs.flag] : '#374151' }}>
                        {obs.value} {obs.unit || ''}
                      </p>
                    )}
                    {obs.ref_range && <p className="text-xs text-gray-400">Ref: {obs.ref_range}</p>}
                  </div>
                  <FlagBadge flag={obs.flag} />
                </div>
              ))}
            </div>
          )}
          {order.result.interpretation && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Pathologist Interpretation</p>
              <p className="text-sm text-blue-900">{order.result.interpretation}</p>
            </div>
          )}
          {order.result.signed_at && (
            <p className="text-xs text-gray-400">
              Signed on {new Date(order.result.signed_at).toLocaleString('en-IN')}
              {order.result.report_hash && <> · Hash: <span className="font-mono">{order.result.report_hash.substring(0, 12)}…</span></>}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ImagingResultCard({ order }) {
  const [open, setOpen] = useState(false)
  const modColor = MODALITY_COLOR[order.modality] || '#6b7280'

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: modColor + '18' }}>
          <ScanLine size={18} style={{ color: modColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 flex items-center gap-2">
            {order.order_id}
            <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold" style={{ background: modColor }}>
              {order.modality}
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {order.date} · {order.body_part || order.study_description || order.modality_label} · {order.clinic_name}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
            <CheckCircle size={12} /> Signed
          </span>
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {open && order.result && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50 space-y-3">
          {order.result.findings && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Findings</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{order.result.findings}</p>
            </div>
          )}
          {order.result.impression && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Impression</p>
              <p className="text-sm text-blue-900">{order.result.impression}</p>
            </div>
          )}
          {order.result.signed_at && (
            <p className="text-xs text-gray-400">
              Signed on {new Date(order.result.signed_at).toLocaleString('en-IN')}
              {order.result.report_hash && <> · Hash: <span className="font-mono">{order.result.report_hash.substring(0, 12)}…</span></>}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function LabResults() {
  const [labOrders, setLabOrders]       = useState([])
  const [imagingOrders, setImagingOrders] = useState([])
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState('lab')

  useEffect(() => {
    Promise.all([
      api.get('/portal/lab-results').catch(() => ({ data: { lab_results: [] } })),
      api.get('/portal/imaging-results').catch(() => ({ data: { imaging_results: [] } })),
    ]).then(([labRes, imgRes]) => {
      setLabOrders(labRes.data?.lab_results || [])
      setImagingOrders(imgRes.data?.imaging_results || [])
    }).finally(() => setLoading(false))
  }, [])

  const empty = tab === 'lab' ? labOrders.length === 0 : imagingOrders.length === 0
  const Icon = tab === 'lab' ? FlaskConical : ScanLine

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-extrabold" style={{ color: '#0F2557' }}>Test Results</h1>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[['lab', 'Lab Results', FlaskConical], ['imaging', 'Imaging Reports', ScanLine]].map(([k, label, Ic]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={tab === k ? { background: '#0F2557', color: '#fff' } : { color: '#6b7280' }}
          >
            <Ic size={14} /> {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      )}

      {!loading && empty && (
        <div className="rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <Icon size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-sm">No signed {tab === 'lab' ? 'lab results' : 'imaging reports'} yet</p>
          <p className="text-xs mt-1 text-gray-300">Results appear here once your doctor signs the report</p>
        </div>
      )}

      {!loading && !empty && (
        <div className="space-y-3">
          {tab === 'lab'
            ? labOrders.map(o => <LabOrderCard key={o.id} order={o} />)
            : imagingOrders.map(o => <ImagingResultCard key={o.id} order={o} />)}
        </div>
      )}
    </div>
  )
}
