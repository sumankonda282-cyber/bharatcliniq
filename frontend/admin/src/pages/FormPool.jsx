import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Pencil,
  Check,
  Archive,
  Copy,
  Share2,
  ClipboardList,
  X,
  Loader2,
  Eye,
  FileText,
  Brain,
  AlertTriangle,
  Building2,
  Stethoscope,
  Activity,
  Syringe,
  HeartPulse,
} from 'lucide-react'
import api from '../api/client'

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all',       label: 'All Forms' },
  { key: 'published', label: 'Published' },
  { key: 'drafts',    label: 'Drafts' },
  { key: 'templates', label: 'Templates' },
  { key: 'retired',   label: 'Retired' },
]

const CATEGORIES = [
  { value: 'all',          label: 'All Categories' },
  { value: 'general',      label: 'General' },
  { value: 'clinical',     label: 'Clinical' },
  { value: 'mental_health',label: 'Mental Health' },
  { value: 'pediatrics',   label: 'Pediatrics' },
  { value: 'vitals',       label: 'Vitals' },
  { value: 'surgical',     label: 'Surgical' },
  { value: 'icu',          label: 'ICU' },
  { value: 'intake',       label: 'Intake' },
  { value: 'assessment',   label: 'Assessment' },
  { value: 'consent',      label: 'Consent' },
  { value: 'discharge',    label: 'Discharge' },
  { value: 'followup',     label: 'Follow-up' },
  { value: 'survey',       label: 'Survey' },
]

// ─── Category Helpers ─────────────────────────────────────────────────────────

const CATEGORY_META = {
  vitals:       { emoji: '🫀', color: 'bg-red-500/20 text-red-400' },
  mental_health:{ emoji: '🧠', color: 'bg-purple-500/20 text-purple-400' },
  safety:       { emoji: '⚠️', color: 'bg-yellow-500/20 text-yellow-400' },
  intake:       { emoji: '🏥', color: 'bg-blue-500/20 text-blue-400' },
  assessment:   { emoji: '📋', color: 'bg-indigo-500/20 text-indigo-400' },
  clinical:     { emoji: '🩺', color: 'bg-teal-500/20 text-teal-400' },
  surgical:     { emoji: '🔬', color: 'bg-cyan-500/20 text-cyan-400' },
  icu:          { emoji: '💊', color: 'bg-rose-500/20 text-rose-400' },
  consent:      { emoji: '✍️', color: 'bg-green-500/20 text-green-400' },
  discharge:    { emoji: '🚶', color: 'bg-orange-500/20 text-orange-400' },
  followup:     { emoji: '📅', color: 'bg-sky-500/20 text-sky-400' },
  survey:       { emoji: '📊', color: 'bg-pink-500/20 text-pink-400' },
  pediatrics:   { emoji: '👶', color: 'bg-lime-500/20 text-lime-400' },
  general:      { emoji: '📄', color: 'bg-gray-500/20 text-gray-400' },
}

function getCategoryMeta(category) {
  return CATEGORY_META[category] || CATEGORY_META.general
}

// ─── Date formatter ───────────────────────────────────────────────────────────

function fmtDate(val) {
  if (!val) return '—'
  try {
    return new Date(val).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return String(val)
  }
}

function capitalize(s) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const styles = {
    draft:     'bg-yellow-900/30 text-yellow-400 border border-yellow-800/50',
    published: 'bg-green-900/30 text-green-400 border border-green-800/50',
    retired:   'bg-gray-700/50 text-gray-400 border border-gray-600/50',
    template:  'bg-blue-900/30 text-blue-400 border border-blue-800/50',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
      {capitalize(status)}
    </span>
  )
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gray-800 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-800 rounded w-3/4" />
          <div className="h-3 bg-gray-800 rounded w-1/2" />
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="h-5 w-16 bg-gray-800 rounded-full" />
        <div className="h-5 w-12 bg-gray-800 rounded-full" />
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-gray-800">
        <div className="h-3 w-20 bg-gray-800 rounded" />
        <div className="flex gap-1">
          {[1, 2, 3].map(i => <div key={i} className="w-7 h-7 bg-gray-800 rounded-lg" />)}
        </div>
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 bg-gray-800 border text-white text-sm px-4 py-3 rounded-xl shadow-lg border-l-4 ${
            t.type === 'error' ? 'border-red-500 border-l-red-500 border-gray-700' : 'border-green-500 border-l-green-500 border-gray-700'
          }`}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="text-gray-500 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Assign Modal ─────────────────────────────────────────────────────────────

function AssignModal({ assignModal, onClose, onAssigned, addToast }) {
  const [clinicsList, setClinicsList] = useState([])
  const [loadingClinics, setLoadingClinics] = useState(true)
  const [selectedClinic, setSelectedClinic] = useState('all')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    setLoadingClinics(true)
    api.get('/clinics')
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.items ?? data?.results ?? [])
        setClinicsList(list)
      })
      .catch(() => setClinicsList([]))
      .finally(() => setLoadingClinics(false))
  }, [])

  async function handleAssign() {
    setAssigning(true)
    try {
      await api.post('/platform/pool/assign', {
        form_id: assignModal.formId,
        clinic_id: selectedClinic === 'all' ? null : selectedClinic,
      })
      addToast(`"${assignModal.formTitle}" assigned successfully.`, 'success')
      onAssigned()
      onClose()
    } catch (err) {
      addToast(err.message || 'Failed to assign form.', 'error')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Add to Pool</h2>
            <p className="text-xs text-gray-500 mt-0.5">Make available for clinical use</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form name */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 mb-5">
          <p className="text-xs text-gray-500 mb-0.5">Form</p>
          <p className="text-white font-medium text-sm">{assignModal.formTitle}</p>
        </div>

        {/* Clinic selector */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Make available to
          </label>

          {loadingClinics ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
              <Loader2 size={16} className="animate-spin" />
              Loading clinics…
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors bg-gray-800 hover:bg-gray-700 border border-gray-700 has-[:checked]:border-[#F5821E]/50 has-[:checked]:bg-[#F5821E]/5">
                <input
                  type="radio"
                  name="clinic"
                  value="all"
                  checked={selectedClinic === 'all'}
                  onChange={() => setSelectedClinic('all')}
                  className="accent-[#F5821E]"
                />
                <div>
                  <p className="text-sm text-white font-medium">All Clinics</p>
                  <p className="text-xs text-gray-500">Globally available to all clinics</p>
                </div>
              </label>

              {clinicsList.map((clinic) => (
                <label
                  key={clinic.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors bg-gray-800 hover:bg-gray-700 border border-gray-700"
                >
                  <input
                    type="radio"
                    name="clinic"
                    value={clinic.id}
                    checked={selectedClinic === clinic.id}
                    onChange={() => setSelectedClinic(clinic.id)}
                    className="accent-[#F5821E]"
                  />
                  <span className="text-sm text-white">
                    {clinic.name || clinic.clinic_name || `Clinic ${clinic.id}`}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:text-white border border-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={assigning}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#F5821E] hover:bg-[#e07319] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {assigning && <Loader2 size={14} className="animate-spin" />}
            Assign to Pool
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Form Card ────────────────────────────────────────────────────────────────

function FormCard({ form, navigate, onPublish, onRetire, onClone, onAssign, actionLoading }) {
  const meta = getCategoryMeta(form.category)

  return (
    <div className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 flex flex-col gap-4 transition-all hover:shadow-lg hover:shadow-black/20">

      {/* Top: icon + title + version */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl ${meta.color} flex items-center justify-center text-xl flex-shrink-0 font-medium`}>
          {meta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm leading-tight truncate" title={form.title}>
            {form.title || 'Untitled Form'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 capitalize">
            {form.category ? form.category.replace(/_/g, ' ') : 'General'}
            {form.subcategory && ` · ${form.subcategory}`}
          </p>
        </div>
        <span className="text-xs font-mono text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700 flex-shrink-0">
          v{form.version ?? 1}
        </span>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge status={form.status || 'draft'} />
        {form.is_iview_enabled && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-900/30 text-indigo-400 border border-indigo-800/50">
            iView
          </span>
        )}
        {(form.is_template || form.status === 'template') && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400 border border-blue-800/50">
            Template
          </span>
        )}
        {form.requires_cosign && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-900/30 text-orange-400 border border-orange-800/50">
            Co-sign
          </span>
        )}
      </div>

      {/* Footer: date + actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-800 mt-auto">
        <span className="text-xs text-gray-600">{fmtDate(form.created_at)}</span>

        <div className="flex items-center gap-1">
          {/* Edit */}
          <button
            onClick={() => navigate(`/forms/builder/${form.id}`)}
            title="Edit form"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <Pencil size={14} />
          </button>

          {/* Preview */}
          <button
            onClick={() => navigate(`/forms/preview/${form.id}`)}
            title="Preview form"
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-gray-800 transition-colors"
          >
            <Eye size={14} />
          </button>

          {/* Publish (draft only) */}
          {form.status === 'draft' && (
            <button
              onClick={() => onPublish(form)}
              disabled={actionLoading[`${form.id}_publish`]}
              title="Publish"
              className="p-1.5 rounded-lg text-green-400 hover:text-green-300 hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {actionLoading[`${form.id}_publish`]
                ? <Loader2 size={14} className="animate-spin" />
                : <Check size={14} />}
            </button>
          )}

          {/* Retire (published only) */}
          {form.status === 'published' && (
            <button
              onClick={() => onRetire(form)}
              disabled={actionLoading[`${form.id}_retire`]}
              title="Retire form"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {actionLoading[`${form.id}_retire`]
                ? <Loader2 size={14} className="animate-spin" />
                : <Archive size={14} />}
            </button>
          )}

          {/* Assign to Pool (published only) */}
          {form.status === 'published' && (
            <button
              onClick={() => onAssign(form)}
              title="Add to Pool"
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#F5821E] hover:bg-gray-800 transition-colors"
            >
              <Share2 size={14} />
            </button>
          )}

          {/* Clone */}
          <button
            onClick={() => onClone(form)}
            disabled={actionLoading[`${form.id}_clone`]}
            title="Clone form"
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            {actionLoading[`${form.id}_clone`]
              ? <Loader2 size={14} className="animate-spin" />
              : <Copy size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ activeTab, onNewForm }) {
  const messages = {
    all:       { title: 'No forms yet', sub: 'Create your first assessment form to get started.' },
    published: { title: 'No published forms', sub: 'Publish a draft form to make it available to clinics.' },
    drafts:    { title: 'No drafts', sub: 'Start building a new form and save it as a draft.' },
    templates: { title: 'No templates', sub: 'Convert a published form to a template.' },
    retired:   { title: 'No retired forms', sub: 'Retired forms will appear here.' },
  }
  const { title, sub } = messages[activeTab] || messages.all

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
        <ClipboardList size={28} className="text-gray-600" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">{sub}</p>
      {activeTab === 'all' || activeTab === 'drafts' ? (
        <button
          onClick={onNewForm}
          className="flex items-center gap-2 bg-[#F5821E] hover:bg-[#e07319] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          New Form
        </button>
      ) : null}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FormPool() {
  const navigate = useNavigate()

  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [assignModal, setAssignModal] = useState(null)
  const [toasts, setToasts] = useState([])
  const [actionLoading, setActionLoading] = useState({})

  // ── Toast helpers ───────────────────────────────────────────────────────

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── Load forms ──────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true)
    api.get('/platform/forms')
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.items ?? data?.results ?? [])
        setForms(list)
        setError('')
      })
      .catch((err) => setError(err.message || 'Failed to load forms.'))
      .finally(() => setLoading(false))
  }, [])

  // ── Action helpers ──────────────────────────────────────────────────────

  function setActionBusy(formId, action, busy) {
    setActionLoading(prev => ({ ...prev, [`${formId}_${action}`]: busy }))
  }

  async function handlePublish(form) {
    setActionBusy(form.id, 'publish', true)
    try {
      await api.post(`/platform/forms/${form.id}/publish`)
      setForms(prev => prev.map(f => f.id === form.id ? { ...f, status: 'published' } : f))
      addToast(`"${form.title}" published.`)
    } catch (err) {
      addToast(err.message || 'Publish failed.', 'error')
    } finally {
      setActionBusy(form.id, 'publish', false)
    }
  }

  async function handleRetire(form) {
    if (!window.confirm(`Retire "${form.title}"? It will no longer be assignable.`)) return
    setActionBusy(form.id, 'retire', true)
    try {
      await api.post(`/platform/forms/${form.id}/retire`)
      setForms(prev => prev.map(f => f.id === form.id ? { ...f, status: 'retired' } : f))
      addToast(`"${form.title}" retired.`)
    } catch (err) {
      addToast(err.message || 'Retire failed.', 'error')
    } finally {
      setActionBusy(form.id, 'retire', false)
    }
  }

  async function handleClone(form) {
    setActionBusy(form.id, 'clone', true)
    try {
      const cloned = await api.post(`/platform/forms/${form.id}/clone`)
      const newForm = cloned?.form ?? cloned?.data ?? cloned
      if (newForm?.id) {
        setForms(prev => [newForm, ...prev])
      } else {
        const data = await api.get('/platform/forms')
        const list = Array.isArray(data) ? data : (data?.items ?? data?.results ?? [])
        setForms(list)
      }
      addToast(`"${form.title}" cloned.`)
    } catch (err) {
      addToast(err.message || 'Clone failed.', 'error')
    } finally {
      setActionBusy(form.id, 'clone', false)
    }
  }

  // ── Tab counts ──────────────────────────────────────────────────────────

  const tabCounts = {
    all:       forms.length,
    published: forms.filter(f => f.status === 'published').length,
    drafts:    forms.filter(f => f.status === 'draft').length,
    templates: forms.filter(f => f.status === 'template' || f.is_template).length,
    retired:   forms.filter(f => f.status === 'retired').length,
  }

  // ── Filtering ───────────────────────────────────────────────────────────

  const filteredForms = forms.filter((form) => {
    if (activeTab === 'published' && form.status !== 'published') return false
    if (activeTab === 'drafts'    && form.status !== 'draft')      return false
    if (activeTab === 'templates' && form.status !== 'template' && !form.is_template) return false
    if (activeTab === 'retired'   && form.status !== 'retired')    return false

    if (categoryFilter !== 'all' && form.category !== categoryFilter) return false

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (
        !form.title?.toLowerCase().includes(q) &&
        !form.category?.toLowerCase().includes(q) &&
        !form.description?.toLowerCase().includes(q)
      ) return false
    }

    return true
  })

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Assessment Forms</h1>
            <p className="text-sm text-gray-500 mt-0.5">Build and manage clinical assessment forms</p>
          </div>
          <button
            onClick={() => navigate('/forms/builder')}
            className="flex items-center gap-2 bg-[#F5821E] hover:bg-[#e07319] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-orange-900/20"
          >
            <Plus size={16} />
            New Form
          </button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="flex gap-0 border-b border-gray-800 px-6 bg-gray-900 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.key
                ? 'border-[#F5821E] text-[#F5821E]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
            {!loading && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                activeTab === tab.key
                  ? 'bg-[#F5821E]/20 text-[#F5821E]'
                  : 'bg-gray-800 text-gray-500'
              }`}>
                {tabCounts[tab.key] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div className="px-6 py-3 flex flex-wrap items-center gap-3 bg-gray-900/50 border-b border-gray-800/50">
        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search forms…"
            className="w-64 bg-gray-800 border border-gray-700 text-white text-sm rounded-xl pl-9 pr-3 py-2 outline-none focus:border-[#F5821E] transition-colors placeholder-gray-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Category */}
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-xl px-3 py-2 outline-none focus:border-[#F5821E] transition-colors appearance-none pr-8"
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        {/* Results count */}
        {!loading && (
          <span className="text-xs text-gray-600 ml-auto">
            {filteredForms.length} form{filteredForms.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-6 py-6">
        {error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ClipboardList size={40} className="text-gray-600 mb-3" />
            <p className="text-gray-400 font-medium mb-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 text-sm text-[#F5821E] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredForms.length === 0 ? (
          <EmptyState activeTab={activeTab} onNewForm={() => navigate('/forms/builder')} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredForms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                navigate={navigate}
                onPublish={handlePublish}
                onRetire={handleRetire}
                onClone={handleClone}
                onAssign={f => setAssignModal({ formId: f.id, formTitle: f.title })}
                actionLoading={actionLoading}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Assign Modal ── */}
      {assignModal && (
        <AssignModal
          assignModal={assignModal}
          onClose={() => setAssignModal(null)}
          onAssigned={() => {}}
          addToast={addToast}
        />
      )}

      {/* ── Toasts ── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
