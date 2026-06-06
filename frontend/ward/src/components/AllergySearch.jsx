import { useState } from 'react'
import { X, AlertTriangle, Plus } from 'lucide-react'
import { SNOMED_ALLERGENS } from '../data/snomedAllergies'

const SEVERITY = ['mild', 'moderate', 'severe', 'life-threatening']

export default function AllergySearch({ allergies = [], onChange, disabled = false }) {
  const [query, setQuery]       = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [pending, setPending]   = useState(null) // allergen selected, awaiting severity+reaction

  const filtered = query.length > 1
    ? SNOMED_ALLERGENS.filter(a =>
        a.display.toLowerCase().includes(query.toLowerCase()) ||
        a.category.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  const select = allergen => {
    setQuery(''); setShowDrop(false)
    setPending({ ...allergen, severity: 'moderate', reaction: '' })
  }

  const confirm = () => {
    if (!pending) return
    if (allergies.find(a => a.code === pending.code && a.display === pending.display)) {
      setPending(null); return
    }
    onChange([...allergies, pending])
    setPending(null)
  }

  const remove = idx => onChange(allergies.filter((_, i) => i !== idx))

  const severityColor = s => ({
    'mild': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'moderate': 'bg-orange-100 text-orange-800 border-orange-200',
    'severe': 'bg-red-100 text-red-800 border-red-200',
    'life-threatening': 'bg-red-900 text-white border-red-900',
  }[s] || 'bg-gray-100 text-gray-700')

  return (
    <div>
      {/* Existing allergies */}
      <div className="flex flex-wrap gap-2 mb-2">
        {allergies.map((a, i) => (
          <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border font-medium ${severityColor(a.severity)}`}>
            {a.severity === 'life-threatening' && <AlertTriangle size={10} />}
            {a.display}
            {a.severity && ` · ${a.severity}`}
            {!disabled && (
              <button onMouseDown={() => remove(i)} className="ml-1 hover:opacity-70">
                <X size={10} />
              </button>
            )}
          </span>
        ))}
        {allergies.length === 0 && <span className="text-xs text-gray-400">No known allergies recorded</span>}
      </div>

      {/* Pending confirmation card */}
      {pending && (
        <div className="border border-orange-200 bg-orange-50 rounded-lg p-3 mb-2 text-sm">
          <p className="font-medium text-orange-900 mb-2">Add: <strong>{pending.display}</strong> ({pending.category})</p>
          <div className="flex gap-2 flex-wrap">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Severity</label>
              <select value={pending.severity} onChange={e => setPending(p => ({...p, severity: e.target.value}))}
                className="border border-gray-300 rounded px-2 py-1 text-xs">
                {SEVERITY.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-600 block mb-1">Reaction (optional)</label>
              <input value={pending.reaction} onChange={e => setPending(p => ({...p, reaction: e.target.value}))}
                placeholder="e.g. rash, anaphylaxis"
                className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button onMouseDown={confirm} className="bg-orange-600 text-white text-xs px-3 py-1 rounded-lg hover:bg-orange-700">
              <Plus size={10} className="inline mr-1" />Confirm
            </button>
            <button onMouseDown={() => setPending(null)} className="text-gray-500 text-xs px-3 py-1 rounded-lg hover:bg-gray-100">Cancel</button>
          </div>
        </div>
      )}

      {/* Search input */}
      {!disabled && (
        <div className="relative">
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setShowDrop(true) }}
            onFocus={() => setShowDrop(true)}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
            placeholder="Search allergen (drug, food, environmental)…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          {showDrop && filtered.length > 0 && (
            <div className="absolute z-50 left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filtered.map(a => (
                <button key={a.code + a.display} onMouseDown={() => select(a)}
                  className="w-full text-left px-3 py-2 hover:bg-orange-50 text-sm border-b border-gray-100 last:border-0 flex justify-between">
                  <span className="font-medium">{a.display}</span>
                  <span className="text-xs text-gray-400">{a.category}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1">SNOMED CT coded · Type to search</p>
        </div>
      )}
    </div>
  )
}
