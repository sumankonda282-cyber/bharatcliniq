
import { useState, useEffect, useCallback } from 'react'
import { usePin } from '../../contexts/PinContext'
import { Plus, Trash2 } from 'lucide-react'
import { usePin } from '../../contexts/PinContext'
import api from '../../api/client'

const INTAKE_TYPES  = ['IV Fluid', 'Oral', 'Blood Product', 'TPN', 'NG Feed', 'Other']
const OUTPUT_TYPES  = ['Urine', 'Drain', 'Emesis', 'Stool', 'Nasogastric', 'Other']
const OUTPUT_CHARS  = ['Clear', 'Cloudy', 'Bloody', 'Other']

const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const todayStr = () => new Date().toISOString().slice(0, 10)

function newIntakeRow() { return { id: Date.now(), time: nowTime(), type: '', description: '', volume: '' } }
function newOutputRow() { return { id: Date.now(), time: nowTime(), type: '', description: '', volume: '', character: '' } }

function shiftOf(timeStr) {
  const h = parseInt(timeStr.split(':')[0], 10)
  if (h < 8)  return '00:00-08:00'
  if (h < 16) return '08:00-16:00'
  return '16:00-24:00'
}

function BalanceBadge({ balance }) {
  const abs = Math.abs(balance)
  const color = abs <= 500 ? 'bg-green-100 text-green-700' : abs <= 1000 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
  return <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${color}`}>
    {balance >= 0 ? '+' : ''}{balance} mL
  </span>
}

export default function IOChartForm({ admission, onClose }) {
  const { requestPin } = usePin()
  const [intakeRows, setIntakeRows]  = useState([newIntakeRow()])
  const [outputRows, setOutputRows]  = useState([newIntakeRow()])
  const [savedEntries, setSavedEntries] = useState([])
  const [savingId, setSavingId]     = useState(null)
  const [error, setError]           = useState(null)

  const loadToday = useCallback(async () => {
    if (!admission) return
    try {
      const data = await api.get(`/inpatient/admissions/${admission.id}/notes?note_type=io_entry`)
      const list = Array.isArray(data) ? data : (data.items || data.notes || [])
      const today = todayStr()
      const filtered = list.filter(n => {
        const created = n.created_at || n.timestamp || ''
        return created.startsWith(today)
      })
      setSavedEntries(filtered.map(n => {
        try { return JSON.parse(n.note_text) } catch { return null }
      }).filter(Boolean))
    } catch {}
  }, [admission])

  useEffect(() => { loadToday() }, [loadToday])

  // Running totals from saved entries
  const savedIntake  = savedEntries.filter(e => e.category === 'intake').reduce((a, e) => a + (Number(e.volume) || 0), 0)
  const savedOutput  = savedEntries.filter(e => e.category === 'output').reduce((a, e) => a + (Number(e.volume) || 0), 0)

  const SHIFTS = ['00:00-08:00', '08:00-16:00', '16:00-24:00']

  const shiftTotals = SHIFTS.map(shift => {
    const intake  = savedEntries.filter(e => e.category === 'intake' && shiftOf(e.time || '12:00') === shift).reduce((a, e) => a + (Number(e.volume) || 0), 0)
    const output  = savedEntries.filter(e => e.category === 'output' && shiftOf(e.time || '12:00') === shift).reduce((a, e) => a + (Number(e.volume) || 0), 0)
    return { shift, intake, output }
  })

  const updateIntake = (id, field, val) => setIntakeRows(rows => rows.map(r => r.id === id ? { ...r, [field]: val } : r))
  const updateOutput = (id, field, val) => setOutputRows(rows => rows.map(r => r.id === id ? { ...r, [field]: val } : r))

  const saveEntry = async (entry) => {
    setSavingId(entry.id); setError(null)
    try {
      const identity = await requestPin('Authenticate to save I&O entry')
      await api.post(`/inpatient/admissions/${admission.id}/notes`, {
        note_type: 'io_entry',
        note_text: JSON.stringify({ ...entry, recorded_by: identity.full_name, date: todayStr() }),
      })
      await loadToday()
    } catch (e) {
      if (e.message !== 'PIN cancelled') setError(e.message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {/* Daily summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Total Intake</p>
            <p className="text-2xl font-bold text-blue-700">{savedIntake} <span className="text-sm font-normal">mL</span></p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">Total Output</p>
            <p className="text-2xl font-bold text-amber-700">{savedOutput} <span className="text-sm font-normal">mL</span></p>
          </div>
          <div className="rounded-lg p-3 text-center border-2 border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Balance</p>
            <BalanceBadge balance={savedIntake - savedOutput} />
          </div>
        </div>

        {/* 8-hour subtotals */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">8-Hour Subtotals</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400">
                  <th className="text-left pb-1">Shift</th>
                  <th className="text-right pb-1">Intake</th>
                  <th className="text-right pb-1">Output</th>
                  <th className="text-right pb-1">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {shiftTotals.map(({ shift, intake, output }) => (
                  <tr key={shift}>
                    <td className="py-1 text-gray-600">{shift}</td>
                    <td className="py-1 text-right text-blue-600">{intake} mL</td>
                    <td className="py-1 text-right text-amber-600">{output} mL</td>
                    <td className="py-1 text-right"><BalanceBadge balance={intake - output} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Intake */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-700">Intake</p>
            <button onClick={() => setIntakeRows(r => [...r, newIntakeRow()])}
              className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800">
              <Plus size={15} /> Add Row
            </button>
          </div>
          <div className="space-y-2">
            {intakeRows.map(row => (
              <div key={row.id} className="flex gap-2 items-end flex-wrap bg-blue-50 rounded-lg p-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Time</label>
                  <input type="time" value={row.time} onChange={e => updateIntake(row.id, 'time', e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-24" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Type</label>
                  <select value={row.type} onChange={e => updateIntake(row.id, 'type', e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm">
                    <option value="">Select…</option>
                    {INTAKE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-gray-500 mb-0.5">Description</label>
                  <input type="text" value={row.description} onChange={e => updateIntake(row.id, 'description', e.target.value)}
                    placeholder="e.g. NS 0.9% 500mL"
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Volume (mL)</label>
                  <input type="number" min="0" value={row.volume} onChange={e => updateIntake(row.id, 'volume', e.target.value)}
                    className="w-24 border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <button
                  onClick={() => saveEntry({ ...row, category: 'intake' })}
                  disabled={savingId === row.id}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingId === row.id ? '…' : 'Save'}
                </button>
                <button onClick={() => setIntakeRows(r => r.filter(x => x.id !== row.id))}
                  className="text-gray-400 hover:text-red-500 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Output */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-700">Output</p>
            <button onClick={() => setOutputRows(r => [...r, newOutputRow()])}
              className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800">
              <Plus size={15} /> Add Row
            </button>
          </div>
          <div className="space-y-2">
            {outputRows.map(row => (
              <div key={row.id} className="flex gap-2 items-end flex-wrap bg-amber-50 rounded-lg p-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Time</label>
                  <input type="time" value={row.time} onChange={e => updateOutput(row.id, 'time', e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-24" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Type</label>
                  <select value={row.type} onChange={e => updateOutput(row.id, 'type', e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm">
                    <option value="">Select…</option>
                    {OUTPUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-gray-500 mb-0.5">Description</label>
                  <input type="text" value={row.description} onChange={e => updateOutput(row.id, 'description', e.target.value)}
                    placeholder="Character / notes"
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Volume (mL)</label>
                  <input type="number" min="0" value={row.volume} onChange={e => updateOutput(row.id, 'volume', e.target.value)}
                    className="w-24 border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Character</label>
                  <select value={row.character} onChange={e => updateOutput(row.id, 'character', e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm">
                    <option value="">—</option>
                    {OUTPUT_CHARS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button
                  onClick={() => saveEntry({ ...row, category: 'output' })}
                  disabled={savingId === row.id}
                  className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                >
                  {savingId === row.id ? '…' : 'Save'}
                </button>
                <button onClick={() => setOutputRows(r => r.filter(x => x.id !== row.id))}
                  className="text-gray-400 hover:text-red-500 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4 flex justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
      </div>
    </div>
  )
}
