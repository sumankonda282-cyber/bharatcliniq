import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useWardSession } from '../contexts/WardSessionContext'
import api from '../api/client'
import { CheckCircle, Loader2 } from 'lucide-react'

export default function WardSetup() {
  const { user } = useAuth()
  const { setDepartment, setWard, switchMode, mode } = useWardSession()
  const navigate = useNavigate()

  const [departments, setDepartments] = useState([])
  const [wards, setWards] = useState([])
  const [selectedDept, setSelectedDept] = useState(null)
  const [selectedWard, setSelectedWard] = useState(null)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(true)
  const [wardsLoading, setWardsLoading] = useState(false)
  const [error, setError] = useState('')

  // Load departments on mount
  useEffect(() => {
    api.get('/inpatient/departments')
      .then(data => setDepartments(Array.isArray(data) ? data : (data.items || data.departments || [])))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Load wards when department changes
  useEffect(() => {
    if (!selectedDept) { setWards([]); setSelectedWard(null); return }
    setWardsLoading(true)
    api.get('/inpatient/wards', { params: { department_id: selectedDept.id } })
      .then(data => setWards(Array.isArray(data) ? data : (data.items || data.wards || [])))
      .catch(() => setWards([]))
      .finally(() => setWardsLoading(false))
  }, [selectedDept])

  const handleStart = () => {
    if (!selectedDept) { setError('Please select a department'); return }
    setDepartment(selectedDept)
    setWard(selectedWard)
    navigate('/')
  }

  const clinicName = user?.clinic_name || user?.clinic?.name || 'Your Clinic'

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#065F46' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-emerald-700 tracking-tight">BHaratCliniq CareChart</h1>
          <p className="text-gray-500 text-sm mt-1">Select your working location</p>
        </div>

        {/* Hospital (read-only) */}
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6">
          <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">Hospital</p>
            <p className="text-sm font-bold text-emerald-900">{clinicName}</p>
          </div>
        </div>

        {/* Department */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Department <span className="text-red-500">*</span></label>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <Loader2 size={14} className="animate-spin" /> Loading departments…
            </div>
          ) : (
            <select
              value={selectedDept?.id ?? ''}
              onChange={e => {
                const dept = departments.find(d => d.id === Number(e.target.value)) || null
                setSelectedDept(dept)
                setSelectedWard(null)
                setError('')
              }}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select department…</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Ward */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ward</label>
          {wardsLoading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <Loader2 size={14} className="animate-spin" /> Loading wards…
            </div>
          ) : (
            <select
              value={selectedWard?.id ?? ''}
              onChange={e => {
                const w = wards.find(w => w.id === Number(e.target.value)) || null
                setSelectedWard(w)
              }}
              disabled={!selectedDept}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All Wards</option>
              {wards.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Mode selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Mode</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => switchMode('nurse')}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                mode === 'nurse'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 bg-white hover:border-emerald-300'
              }`}
            >
              <div className="text-2xl mb-1">🏥</div>
              <div className="font-bold text-sm text-gray-800">NURSE MODE</div>
              <div className="text-xs text-gray-500 mt-0.5">Vitals, MAR, Nursing notes</div>
            </button>
            <button
              onClick={() => switchMode('provider')}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                mode === 'provider'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 bg-white hover:border-emerald-300'
              }`}
            >
              <div className="text-2xl mb-1">👨‍⚕️</div>
              <div className="font-bold text-sm text-gray-800">PROVIDER MODE</div>
              <div className="text-xs text-gray-500 mt-0.5">Orders, Notes, Rounds, Summary</div>
            </button>
          </div>
        </div>

        {/* Remember settings */}
        <label className="flex items-center gap-2 cursor-pointer mb-6">
          <input
            type="checkbox"
            checked={remember}
            onChange={e => setRemember(e.target.checked)}
            className="w-4 h-4 accent-emerald-600 rounded"
          />
          <span className="text-sm text-gray-600">Remember these settings for next login</span>
        </label>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <button
          onClick={handleStart}
          disabled={!selectedDept}
          className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all
                     bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Ward Session
        </button>
      </div>
    </div>
  )
}
