import { useState } from 'react'
import { HelpCircle, X, Wrench, Phone, ChevronRight, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'

const PORTAL_SOURCE = 'CareChart'
const IT_PHONE = '+91 90000 00000'

const CATEGORIES = [
  { value: 'facility',    label: 'Facility / Infrastructure' },
  { value: 'equipment',   label: 'Medical Equipment' },
  { value: 'it_software', label: 'IT / Computers' },
  { value: 'other',       label: 'Other' },
]
const PRIORITIES = [
  { value: 'urgent', label: '🔴 Urgent' },
  { value: 'high',   label: '🟠 High' },
  { value: 'medium', label: '🟡 Medium' },
  { value: 'low',    label: '🟢 Low' },
]

const EMPTY = { title: '', category: 'facility', priority: 'medium', location: '', description: '' }

export default function HelpWidget({ open, onClose }) {
  const { user } = useAuth()
  const [path, setPath]     = useState(null)
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [done, setDone]     = useState(false)
  const [error, setError]   = useState('')

  const reset = () => { setPath(null); setForm(EMPTY); setDone(false); setError('') }
  const close = () => { onClose(); setTimeout(reset, 300) }

  const submit = async e => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true); setError('')
    try {
      await api.post('/maintenance/requests', { ...form, portal_source: PORTAL_SOURCE })
      setDone(true)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to submit. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ background: '#065F46' }}>
          <div className="flex items-center gap-2 text-white">
            <HelpCircle size={18} />
            <span className="font-semibold text-sm">Help &amp; Support</span>
            <span className="text-white/50 text-xs ml-1">· {PORTAL_SOURCE}</span>
          </div>
          <button onClick={close} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5">
          {!path && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-4">What do you need help with?</p>
              <button onClick={() => setPath('internal')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all text-left group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#d1fae5' }}>
                  <Wrench size={18} style={{ color: '#065F46' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 text-sm">Report an Issue</div>
                  <div className="text-xs text-gray-500 mt-0.5">Bed, equipment, facility, or hospital IT problem</div>
                </div>
                <ChevronRight size={16} className="text-gray-400 group-hover:text-emerald-600 flex-shrink-0" />
              </button>
              <button onClick={() => setPath('it')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#dbeafe' }}>
                  <Phone size={18} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 text-sm">Contact IT Support</div>
                  <div className="text-xs text-gray-500 mt-0.5">Software bugs, login issues, BharatCliniq help</div>
                </div>
                <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
              </button>
            </div>
          )}

          {path === 'it' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#dbeafe' }}>
                <Phone size={24} className="text-blue-600" />
              </div>
              <div className="text-sm font-semibold text-gray-800 mb-1">BharatCliniq IT Support</div>
              <div className="text-xs text-gray-500 mb-4">Available Mon–Sat, 9 AM – 7 PM</div>
              <a href={`tel:${IT_PHONE.replace(/\s/g, '')}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
                style={{ background: '#1d4ed8' }}>
                <Phone size={15} />{IT_PHONE}
              </a>
              <button onClick={reset} className="block mx-auto mt-4 text-xs text-gray-400 hover:text-gray-600">← Back</button>
            </div>
          )}

          {path === 'internal' && !done && (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Issue Title *</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Brief description of the issue" value={form.title} required
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Location (optional)</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Ward A, Bed 5, Lab Room 2" value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Details (optional)</label>
                <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  rows={3} placeholder="Describe the problem in more detail..." value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="text-xs text-gray-400">
                Submitting as <span className="font-medium text-gray-600">{user?.full_name || user?.email}</span> · {PORTAL_SOURCE}
              </div>
              {error && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  <AlertTriangle size={13} />{error}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={reset} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Back</button>
                <button type="submit" disabled={saving || !form.title.trim()}
                  className="flex-1 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#065F46' }}>
                  {saving ? <><Loader2 size={14} className="animate-spin" />Submitting…</> : 'Submit Request'}
                </button>
              </div>
            </form>
          )}

          {path === 'internal' && done && (
            <div className="text-center py-6">
              <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" />
              <div className="font-semibold text-gray-800 mb-1">Request Submitted</div>
              <div className="text-xs text-gray-500 mb-5">The maintenance team has been notified.</div>
              <button onClick={close} className="px-6 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: '#065F46' }}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
