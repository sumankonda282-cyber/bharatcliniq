import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Eye,
  Calculator,
  Camera,
  Paperclip,
  User,
  ChevronDown,
  Star,
  RefreshCw,
  Loader2,
  PenLine,
  Minus,
  FileText,
  Hash,
} from 'lucide-react'
import api from '../api/client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function opLabel(op) {
  const map = {
    equals:       '=',
    not_equals:   '≠',
    greater_than: '>',
    less_than:    '<',
    contains:     'contains',
    is_empty:     'is empty',
    is_not_empty: 'is not empty',
  }
  return map[op] || op
}

// ─── Field Widget Components ──────────────────────────────────────────────────

function FakeInput({ placeholder = 'Enter text…', className = '' }) {
  return (
    <div className={`bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-400 text-sm italic select-none ${className}`}>
      {placeholder}
    </div>
  )
}

function FakeSelect({ placeholder = 'Select an option…' }) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg px-3 py-2 flex items-center justify-between text-gray-400 text-sm select-none">
      <span className="italic">{placeholder}</span>
      <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
    </div>
  )
}

function RadioOptions({ options = [], type = 'radio' }) {
  const items = options.length > 0
    ? options
    : [{ label: 'Option 1', value: 'option_1' }, { label: 'Option 2', value: 'option_2' }]

  return (
    <div className="space-y-1.5 pl-0.5">
      {items.map((opt, i) => (
        <label key={i} className="flex items-center gap-2.5 cursor-not-allowed select-none">
          {type === 'radio' ? (
            <span className="inline-block w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
          ) : (
            <span className="inline-block w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0" />
          )}
          <span className="text-gray-600 text-sm">{typeof opt === 'string' ? opt : opt.label}</span>
        </label>
      ))}
    </div>
  )
}

function ScaleWidget({ field }) {
  const style = field.scale_style || 'nrs'
  const min = field.scale_min ?? field.min ?? 0
  const max = field.scale_max ?? field.max ?? 10
  const midValue = Math.round((min + max) / 2)

  if (style === 'stars') {
    return (
      <div className="flex items-center gap-1.5">
        {Array.from({ length: max - min + 1 }).map((_, i) => (
          <Star
            key={i}
            size={22}
            className={i < Math.ceil((max - min + 1) / 2) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
          />
        ))}
        <span className="text-xs text-gray-400 ml-2">(preview)</span>
      </div>
    )
  }

  if (style === 'slider') {
    const pct = Math.round(((midValue - min) / (max - min)) * 100)
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          {field.left_label && <span className="text-xs text-gray-500 whitespace-nowrap">{field.left_label}</span>}
          <div className="relative flex-1 h-2 bg-gray-200 rounded-full">
            <div className="absolute left-0 top-0 h-2 bg-[#0F2557] rounded-full" style={{ width: `${pct}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-[#0F2557] rounded-full shadow"
              style={{ left: `${pct}%` }}
            />
          </div>
          {field.right_label && <span className="text-xs text-gray-500 whitespace-nowrap">{field.right_label}</span>}
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>{min}</span>
          <span>{midValue}</span>
          <span>{max}</span>
        </div>
      </div>
    )
  }

  // NRS buttons
  const count = max - min + 1
  const getColor = (val) => {
    const pct = (val - min) / (max - min)
    if (pct <= 0.3) return 'border-green-400 text-green-700 bg-green-50'
    if (pct <= 0.6) return 'border-yellow-400 text-yellow-700 bg-yellow-50'
    return 'border-red-400 text-red-700 bg-red-50'
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: count }).map((_, i) => {
          const val = min + i
          const isMid = val === midValue
          return (
            <button
              key={i}
              disabled
              className={`w-9 h-9 text-xs font-semibold rounded-lg border-2 transition-colors ${
                isMid
                  ? getColor(val) + ' ring-2 ring-offset-1 ring-gray-300'
                  : 'border-gray-200 text-gray-500 bg-white'
              }`}
            >
              {val}
            </button>
          )
        })}
      </div>
      {(field.left_label || field.right_label) && (
        <div className="flex justify-between text-xs text-gray-400 px-0.5">
          <span>{field.left_label || ''}</span>
          <span>{field.right_label || ''}</span>
        </div>
      )}
    </div>
  )
}

function NumberWidget({ field }) {
  const rr = field.ref_range || {}
  const hasRef = rr.critical_low != null || rr.critical_high != null || rr.normal_low != null || rr.normal_high != null
  // Also check flat keys (legacy)
  const cl = rr.critical_low ?? field.critical_low
  const nl = rr.normal_low  ?? field.normal_low
  const nh = rr.normal_high ?? field.normal_high
  const ch = rr.critical_high ?? field.critical_high
  const hasRefAny = cl != null || nl != null || nh != null || ch != null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <FakeInput placeholder={field.placeholder || '0'} className="flex-1" />
        {field.unit && (
          <span className="text-sm text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-2 rounded-lg font-medium">
            {field.unit}
          </span>
        )}
      </div>
      {hasRefAny && (
        <div className="flex flex-wrap gap-1.5">
          {cl != null && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">
              Crit. Low &lt; {cl}
            </span>
          )}
          {nl != null && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600 border border-yellow-200 font-medium">
              Normal ≥ {nl}
            </span>
          )}
          {nh != null && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600 border border-yellow-200 font-medium">
              Normal ≤ {nh}
            </span>
          )}
          {ch != null && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">
              Crit. High &gt; {ch}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function TableWidget({ field }) {
  const columns = field.columns || []
  if (columns.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg px-3 py-2 text-gray-400 text-xs italic bg-gray-50">
        Table (no columns defined)
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-[#0F2557]/5">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-[#0F2557] border-b border-gray-200 whitespace-nowrap">
                {typeof col === 'string' ? col : col.header || `Col ${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1].map(ri => (
            <tr key={ri} className="border-b border-gray-100 last:border-0">
              {columns.map((_, ci) => (
                <td key={ci} className="px-3 py-2 text-gray-300 italic text-xs bg-white">—</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LabelWidget({ field }) {
  const style = field.heading_style || field.label_style || field.style || 'h2'
  const text  = field.text_content || field.content || field.label || ''
  const align = field.text_align || field.alignment || 'left'
  const alignCls = { left: 'text-left', center: 'text-center', right: 'text-right' }[align] || 'text-left'

  const cls = {
    h1:      `text-2xl font-bold text-gray-900 ${alignCls}`,
    h2:      `text-xl font-semibold text-gray-800 ${alignCls}`,
    h3:      `text-base font-semibold text-gray-700 ${alignCls}`,
    body:    `text-sm text-gray-600 ${alignCls}`,
    caption: `text-xs text-gray-400 ${alignCls}`,
  }

  if (!text) return <p className={`${cls[style] || cls.body} italic opacity-40`}>Label text…</p>
  return <p className={cls[style] || cls.body}>{text}</p>
}

function SignatureWidget({ field }) {
  return (
    <div className="space-y-1.5">
      <div className="border-2 border-dashed border-gray-300 rounded-xl h-24 flex flex-col items-center justify-center gap-1.5 bg-gray-50 text-gray-400 select-none">
        <PenLine size={20} className="text-gray-300" />
        <span className="text-sm italic">Sign here</span>
      </div>
      {field.include_timestamp !== false && (
        <p className="text-xs text-gray-400 italic">Timestamp: — / — / —  —:—</p>
      )}
      {field.role_required && field.role_required !== 'any' && (
        <p className="text-xs text-gray-500">Required role: <span className="font-medium capitalize">{field.role_required}</span></p>
      )}
    </div>
  )
}

function UploadWidget({ type }) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-xl h-24 flex flex-col items-center justify-center gap-2 bg-gray-50 text-gray-400 select-none hover:border-gray-400 transition-colors">
      {type === 'photo' ? <Camera size={22} className="text-gray-300" /> : <Paperclip size={22} className="text-gray-300" />}
      <span className="text-sm italic">{type === 'photo' ? 'Upload photo' : 'Attach file'}</span>
    </div>
  )
}

function BodyMapWidget({ field }) {
  const view = field.body_map_type || 'front'
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-xl h-32 flex flex-col items-center justify-center gap-2 bg-gray-50 text-gray-400 select-none">
      <User size={28} className="text-gray-300" />
      <span className="text-sm italic">Body diagram — {view}</span>
    </div>
  )
}

function CalculatedWidget({ field }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 space-y-1">
      <p className="text-xs text-blue-600 font-medium">Calculated Field</p>
      <code className="text-xs font-mono text-blue-700 break-all block">
        = {field.formula || '…'}
      </code>
      {field.unit && <p className="text-xs text-blue-500">Unit: {field.unit}</p>}
    </div>
  )
}

function CodingWidget({ type, field }) {
  const stdName = type === 'snomed' ? 'SNOMED CT' : 'LOINC'
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between shadow-sm">
      <span className="text-gray-400 text-sm italic">{field.placeholder || `Search ${stdName}…`}</span>
      {field.code && (
        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
          {field.code}
        </span>
      )}
    </div>
  )
}

// ─── Field Preview (single field) ─────────────────────────────────────────────

function FieldPreview({ field }) {
  const { type } = field
  const hasConditions = Array.isArray(field.conditions) && field.conditions.length > 0

  // Divider — no label wrapper
  if (type === 'divider') {
    return <hr className="border-t border-gray-200 my-1" />
  }

  // Label — no outer label wrapper either
  if (type === 'label') {
    return <LabelWidget field={field} />
  }

  return (
    <div>
      {/* Label row */}
      <div className="flex items-baseline flex-wrap gap-1.5 mb-1.5">
        <span className="text-sm font-semibold text-gray-800">
          {field.label || 'Unlabelled'}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        {field.hidden && (
          <span className="text-xs text-gray-400 italic">(hidden by default)</span>
        )}
      </div>

      {/* field_id dev reference */}
      <p className="text-xs font-mono text-gray-400 mb-1.5">{field.field_id}</p>

      {/* Help text */}
      {field.help_text && (
        <p className="text-xs text-gray-500 mb-2">{field.help_text}</p>
      )}

      {/* Widget by type */}
      {type === 'text'     && <FakeInput placeholder={field.placeholder || 'Enter text…'} />}
      {type === 'textarea' && <FakeInput placeholder={field.placeholder || 'Enter text…'} className="h-20 items-start pt-2 flex" />}
      {type === 'number'   && <NumberWidget field={field} />}
      {type === 'date'     && <FakeInput placeholder="DD / MM / YYYY" />}
      {type === 'time'     && <FakeInput placeholder="HH : MM" />}
      {type === 'datetime' && <FakeInput placeholder="DD / MM / YYYY  HH : MM" />}
      {type === 'radio'    && <RadioOptions options={field.options} type="radio" />}
      {type === 'checkbox' && <RadioOptions options={field.options} type="checkbox" />}
      {type === 'dropdown' && <FakeSelect placeholder={field.placeholder || 'Select an option…'} />}
      {type === 'scale'    && <ScaleWidget field={field} />}
      {type === 'calculated' && <CalculatedWidget field={field} />}
      {type === 'signature'  && <SignatureWidget field={field} />}
      {type === 'photo'    && <UploadWidget type="photo" />}
      {type === 'file'     && <UploadWidget type="file" />}
      {type === 'table'    && <TableWidget field={field} />}
      {type === 'body_map' && <BodyMapWidget field={field} />}
      {type === 'snomed'   && <CodingWidget type="snomed" field={field} />}
      {type === 'loinc'    && <CodingWidget type="loinc" field={field} />}
      {(type === 'rich_text') && (
        <div className="border border-gray-200 rounded-lg px-3 py-3 text-gray-400 text-sm italic min-h-[80px] bg-white">
          {field.text_content || field.content || 'Rich text content…'}
        </div>
      )}
      {type === 'repeating' && (
        <div className="border-2 border-dashed border-gray-200 rounded-lg h-14 flex items-center justify-center text-gray-400 text-sm italic bg-gray-50 gap-2">
          <RefreshCw size={14} />
          Repeating group
        </div>
      )}

      {/* Conditional note */}
      {hasConditions && (
        <p className="text-xs text-purple-500 italic mt-1.5 flex items-center gap-1">
          <Eye size={11} />
          Shown when{' '}
          {field.conditions.map((c, i) => (
            <span key={i}>
              {i > 0 && <span className="font-semibold text-purple-600 mx-0.5">{field.condition_logic || 'AND'}</span>}
              <span className="font-mono">{c.field_id}</span>
              {' '}{opLabel(c.operator)}{' '}
              {!['is_empty', 'is_not_empty'].includes(c.operator) && (
                <span className="font-mono">{c.value}</span>
              )}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

// ─── Section Preview ──────────────────────────────────────────────────────────

function SectionPreview({ section }) {
  const [collapsed, setCollapsed] = useState(false)

  const gridCls = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  }[section.layout ?? 1] || 'grid-cols-1'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl mb-6 overflow-hidden shadow-sm">
      {/* Header */}
      <div
        className={`px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#0F2557]/5 to-transparent ${section.collapsible ? 'cursor-pointer select-none' : ''}`}
        onClick={() => section.collapsible && setCollapsed(v => !v)}
      >
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-gray-800 text-base flex-1">
            {section.title || 'Untitled Section'}
          </h2>
          {section.repeatable && (
            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
              Repeatable
            </span>
          )}
          {section.collapsible && (
            <span className="text-gray-400 text-xs">{collapsed ? 'Expand' : 'Collapse'}</span>
          )}
        </div>
        {section.description && (
          <p className="text-gray-500 text-sm mt-0.5">{section.description}</p>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className={`px-6 py-5 grid ${gridCls} gap-5 bg-white`}>
          {(section.fields || []).length === 0 ? (
            <p className="text-gray-400 text-sm italic col-span-full">No fields in this section.</p>
          ) : (
            section.fields.map((field) => (
              <FieldPreview key={field.id} field={field} />
            ))
          )}
        </div>
      )}

      {/* Repeatable add-row hint */}
      {section.repeatable && !collapsed && (
        <div className="px-6 py-3 border-t border-gray-100 bg-blue-50/50">
          <button disabled className="text-xs text-blue-500 font-medium cursor-not-allowed opacity-60">
            + Add another instance
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Score Preview ────────────────────────────────────────────────────────────

const BAND_STYLES = {
  green:  'bg-green-50 text-green-700 border-green-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  red:    'bg-red-50 text-red-700 border-red-200',
}

function ScoringPanel({ scoringConfig }) {
  if (!scoringConfig) return null
  const bands = [...(scoringConfig.bands || [])].sort((a, b) => a.min - b.min)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-6">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-transparent flex items-center gap-2">
        <Calculator size={16} className="text-indigo-500" />
        <h2 className="font-semibold text-gray-800 text-base">Score Interpretation</h2>
        <span className="ml-auto text-xs text-gray-400 font-mono uppercase">{scoringConfig.type}</span>
      </div>

      {bands.length === 0 ? (
        <p className="px-6 py-4 text-gray-400 text-sm italic">No score bands defined.</p>
      ) : (
        <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {bands.map((band, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border ${BAND_STYLES[band.color] || BAND_STYLES.green}`}
            >
              <span className="font-mono text-sm font-semibold">{band.min}–{band.max}</span>
              <span className="text-sm font-medium">{band.label || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Submit Button (read-only preview) ───────────────────────────────────────

function SubmitArea({ form }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">
          {form?.requires_cosign && (
            <span className="text-orange-500 font-medium mr-2">Co-signature required</span>
          )}
          {form?.time_limit_minutes && (
            <span className="text-gray-400">Time limit: {form.time_limit_minutes} min</span>
          )}
        </p>
      </div>
      <button
        disabled
        className="px-6 py-2.5 bg-[#0F2557] text-white rounded-xl font-semibold text-sm opacity-60 cursor-not-allowed"
      >
        Submit Form
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FormPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState(null)
  const [schema, setSchema] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Use schema passed via location.state if available (inline preview from builder)
    if (location.state?.schema) {
      setSchema(location.state.schema)
      if (location.state?.form) setForm(location.state.form)
      setLoading(false)
      return
    }

    if (!id) {
      setError('No form ID provided.')
      setLoading(false)
      return
    }

    api.get(`/platform/forms/${id}`)
      .then((data) => {
        setForm(data)
        setSchema(data.schema || { sections: [] })
        setError('')
      })
      .catch((err) => setError(err.message || 'Form not found.'))
      .finally(() => setLoading(false))
  }, [id, location.state])

  const sections = schema?.sections ?? []
  const scoringConfig = form?.scoring_config ?? null

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="text-[#0F2557] animate-spin" />
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-xl font-semibold text-gray-800">Form not found</p>
        <p className="text-gray-500 text-sm">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-white text-sm transition-colors hover:bg-gray-700"
        >
          <ArrowLeft size={14} />
          Go back
        </button>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col">

      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button
          onClick={() => form?.id ? navigate(`/forms/builder/${form.id}`) : navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Back to Builder</span>
        </button>

        <div className="flex-1 min-w-0 text-center">
          <span className="font-semibold text-gray-900 text-base truncate block">
            {form?.title || 'Form Preview'}
          </span>
          {form?.category && (
            <p className="text-xs text-gray-400 capitalize">{form.category.replace(/_/g, ' ')}</p>
          )}
        </div>

        <span className="bg-blue-50 text-blue-600 border border-blue-200 text-xs px-3 py-1 rounded-full font-medium flex-shrink-0">
          Preview Mode
        </span>
      </header>

      {/* ── Scoring Banner ── */}
      {scoringConfig && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-2.5 text-sm text-indigo-700 flex items-center gap-2">
          <Calculator size={14} className="flex-shrink-0" />
          <span>
            <span className="font-semibold">Scored Form</span>
            {' — Type: '}
            <span className="font-mono uppercase text-xs">{scoringConfig.type}</span>
            {scoringConfig.bands?.length > 0 && ` · ${scoringConfig.bands.length} score bands`}
          </span>
        </div>
      )}

      {/* ── Form Body ── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8">

        {/* Form header card */}
        {(form?.title || form?.description) && (
          <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 mb-6 shadow-sm">
            <h1 className="text-xl font-bold text-gray-900">{form?.title}</h1>
            {form?.description && (
              <p className="text-gray-500 text-sm mt-1">{form.description}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {form?.is_iview_enabled && (
                <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                  iView Enabled
                </span>
              )}
              {form?.time_limit_minutes && (
                <span className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full">
                  Time limit: {form.time_limit_minutes} min
                </span>
              )}
            </div>
          </div>
        )}

        {/* Sections */}
        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center mb-4">
              <FileText size={24} className="text-gray-300" />
            </div>
            <p className="text-gray-400 text-sm italic">This form has no sections yet.</p>
          </div>
        ) : (
          sections.map((section) => (
            <SectionPreview key={section.id} section={section} />
          ))
        )}

        {/* Score bands */}
        {scoringConfig && <ScoringPanel scoringConfig={scoringConfig} />}

        {/* Submit area */}
        {sections.length > 0 && <SubmitArea form={form} />}
      </main>
    </div>
  )
}
