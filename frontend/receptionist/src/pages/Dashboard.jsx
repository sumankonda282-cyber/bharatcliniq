import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api/client'
import DoctorSlotBoard from '../components/dashboard/DoctorSlotBoard'
import {
  CalendarDays, Clock, CheckCircle, Video, CreditCard, ChevronRight,
  BedDouble, Loader2, Bell, ShieldAlert,
} from 'lucide-react'

function todayIST() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10)
}

const fmt = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })

function StatCard({ icon: Icon, label, value, color, onClick, loading }) {
  return (
    <button onClick={onClick}
      className="card p-5 flex items-center gap-4 w-full text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '18' }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-bold" style={{ color: '#0F2557' }}>
          {loading ? <span className="text-gray-300 text-lg">—</span> : (value ?? 0)}
        </div>
        <div className="text-xs text-gray-500 font-medium">{label}</div>
      </div>
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </button>
  )
}

// ── IPD Snapshot (hospital only) ──────────────────────────────────────────────

function IPDSnapshot() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/inpatient/beds/board')
      .then(r => {
        const beds = Array.isArray(r) ? r : []
        setStats({
          total:    beds.length,
          vacant:   beds.filter(b => b.status === 'vacant').length,
          occupied: beds.filter(b => b.status === 'occupied').length,
          maint:    beds.filter(b => b.status === 'maintenance').length,
        })
      })
      .catch(() => {})
  }, [])

  if (!stats) return null

  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <BedDouble size={15} className="text-gray-400" />
        <span className="font-semibold text-gray-700 text-sm">IPD Bed Snapshot</span>
        <span className="ml-auto text-xs text-gray-400">{stats.total} total beds</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-xl bg-green-50 border border-green-100">
          <div className="text-2xl font-bold text-green-700">{stats.vacant}</div>
          <div className="text-xs text-green-600 font-medium mt-0.5">Vacant</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-red-50 border border-red-100">
          <div className="text-2xl font-bold text-red-700">{stats.occupied}</div>
          <div className="text-xs text-red-600 font-medium mt-0.5">Occupied</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
          <div className="text-2xl font-bold text-gray-500">{stats.maint}</div>
          <div className="text-xs text-gray-500 font-medium mt-0.5">Maintenance</div>
        </div>
      </div>
    </div>
  )
}

// ── Emergency Board (hospital only) ──────────────────────────────────────────

const TRIAGE_ROW = {
  red:    'bg-red-50 border-red-300 text-red-800',
  orange: 'bg-orange-50 border-orange-300 text-orange-800',
  yellow: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  green:  'bg-green-50 border-green-300 text-green-800',
}
const TRIAGE_PILL = {
  red:    'bg-red-600 text-white',
  orange: 'bg-orange-500 text-white',
  yellow: 'bg-yellow-400 text-yellow-900',
  green:  'bg-green-600 text-white',
}

function EmergencyBoard({ onNavigate }) {
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(() => {
    api.get('/inpatient/emergency', { params: { status: 'en_route' } })
      .then(r => setItems(Array.isArray(r) ? r : []))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    const h = () => load()
    window.addEventListener('bharatcliniq:refresh', h)
    return () => { clearInterval(id); window.removeEventListener('bharatcliniq:refresh', h) }
  }, [load])

  return (
    <div className="card p-4 mb-6" style={{ borderLeft: '4px solid #dc2626' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={15} className="text-red-500" />
          <span className="font-bold text-gray-800 text-sm">Emergency Board</span>
          {items.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
              {items.length} EN ROUTE
            </span>
          )}
        </div>
        <button
          onClick={() => onNavigate('/emergency-admission')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition shadow-sm shadow-red-200">
          <ShieldAlert size={12} /> New Emergency
        </button>
      </div>

      {!loaded ? null : items.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">No emergencies en route</p>
      ) : (
        <div className="space-y-2">
          {items.map(e => (
            <div key={e.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm ${TRIAGE_ROW[e.triage_level] || TRIAGE_ROW.red}`}>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md uppercase flex-shrink-0 ${TRIAGE_PILL[e.triage_level] || TRIAGE_PILL.red}`}>
                {e.triage_level}
              </span>
              <span className="font-semibold flex-1 truncate">{e.patient_name}</span>
              {e.eta_minutes && (
                <span className="text-xs opacity-75 flex items-center gap-0.5 flex-shrink-0">
                  <Clock size={10} /> {e.eta_minutes} min
                </span>
              )}
              {e.doctor_name && (
                <span className="text-xs opacity-75 flex-shrink-0 hidden sm:inline">Dr. {e.doctor_name}</span>
              )}
              {e.alert_sent_at && !e.alert_ack_at && (
                <span className="text-xs font-bold text-red-600 animate-pulse flex-shrink-0">● Alert</span>
              )}
              {e.alert_ack_at && (
                <span className="text-xs font-bold text-green-600 flex-shrink-0">✓ Accepted</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isManager  = ['clinic_manager', 'clinic_admin'].includes(user?.role)
  const isHospital = user?.org_type === 'hospital'

  const [appts, setAppts]       = useState([])
  const [billing, setBilling]   = useState({ collected: 0, pending: 0 })
  const [loading, setLoading]   = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const timerRef = useRef(null)

  const load = useCallback(() => {
    const today = todayIST()
    api.get('/appointments', { params: { appointment_date: today, limit: 200 } })
      .then(r => setAppts(Array.isArray(r) ? r : []))
      .catch(() => {})
      .finally(() => setLoading(false))
    api.get('/billing/invoices', { params: { limit: 200 } })
      .then(r => {
        const list = Array.isArray(r) ? r : []
        const todayInvs = list.filter(i => (i.created_at || '').slice(0, 10) === today)
        setBilling({
          collected: todayInvs.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total_amount || 0), 0),
          pending:   todayInvs.filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.total_amount || 0), 0),
        })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, 30000)
    const h = () => load()
    window.addEventListener('bharatcliniq:refresh', h)
    return () => { clearInterval(timerRef.current); window.removeEventListener('bharatcliniq:refresh', h) }
  }, [load])

  const waiting    = appts.filter(a => ['scheduled', 'waiting'].includes(a.status)).length
  const inProgress = appts.filter(a => a.status === 'in_progress').length
  const completed  = appts.filter(a => a.status === 'completed').length
  const telehealth = appts.filter(a => a.mode === 'telehealth' || a.visit_type === 'telehealth').length

  const goFrontDesk  = (filter) => navigate(`/front-desk${filter ? `?status=${filter}` : ''}`)
  const goBilling    = () => navigate('/billing')
  const goOperations = () => navigate('/operations')
  const goEmergency  = (path = '/emergency-admission') => navigate(path)

  return (
    <div>
      {pendingCount > 0 && (
        <div className="flex items-center gap-1.5 mb-5 text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <Bell size={12} /> {pendingCount} appointment request{pendingCount !== 1 ? 's' : ''} need attention
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon={CalendarDays} label="Total Today"     value={appts.length}  color="#0F2557" loading={loading}
          onClick={() => isManager ? goOperations() : goFrontDesk()} />
        <StatCard icon={Clock}        label="Waiting"         value={waiting}       color="#F5821E" loading={loading}
          onClick={() => isManager ? goOperations() : goFrontDesk('waiting')} />
        <StatCard icon={CalendarDays} label="In Consultation" value={inProgress}    color="#7C3AED" loading={loading}
          onClick={() => isManager ? goOperations() : goFrontDesk('in_progress')} />
        <StatCard icon={CheckCircle}  label="Completed"       value={completed}     color="#16A34A" loading={loading}
          onClick={() => isManager ? goOperations() : goFrontDesk('completed')} />
        <StatCard icon={Video}        label="Telehealth"      value={telehealth}    color="#0891B2" loading={loading}
          onClick={() => isManager ? goOperations() : goFrontDesk('telehealth')} />
      </div>

      {/* Emergency Board (hospital only, non-manager) */}
      {isHospital && !isManager && (
        <EmergencyBoard onNavigate={goEmergency} />
      )}

      {/* Doctor Slot Board — availability, requests, slot control (receptionist) */}
      {!isManager && (
        <DoctorSlotBoard onPendingCount={setPendingCount} />
      )}

      {/* IPD Bed Snapshot (hospital only) */}
      {isHospital && !isManager && (
        <IPDSnapshot />
      )}

      {/* Billing snapshot */}
      <button onClick={goBilling}
        className="card p-4 mb-6 w-full flex items-center gap-4 hover:shadow-md transition-all hover:-translate-y-0.5 text-left">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#16a34a18' }}>
          <CreditCard size={20} style={{ color: '#16a34a' }} />
        </div>
        <div className="flex-1 flex flex-wrap gap-x-8 gap-y-1">
          <div>
            <div className="text-xs text-gray-500">Collected Today</div>
            <div className="font-bold text-green-700">{fmt(billing.collected)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Pending</div>
            <div className="font-bold text-red-600">{fmt(billing.pending)}</div>
          </div>
        </div>
        <div className="text-xs text-gray-400 flex items-center gap-1">
          View Billing <ChevronRight size={14} />
        </div>
      </button>

      {/* Today's schedule */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-700">Today's Schedule</span>
          <button onClick={() => isManager ? goOperations() : goFrontDesk()}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            View all <ChevronRight size={13} />
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
        ) : appts.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
            <p>No appointments today</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">#</th>
                  <th className="th">Patient</th>
                  <th className="th">Doctor</th>
                  <th className="th">Time</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appts.slice(0, 8).map(a => (
                  <tr key={a.id} className="tr-hover cursor-pointer"
                    onClick={() => isManager ? navigate(`/operations/${a.id}`) : goFrontDesk()}>
                    <td className="td font-bold text-center" style={{ color: '#0F2557' }}>#{a.token_number || a.id}</td>
                    <td className="td font-medium">{a.patient_name || '—'}</td>
                    <td className="td text-gray-500 text-sm">{a.doctor_name || '—'}</td>
                    <td className="td text-sm">{a.appointment_time || '—'}</td>
                    <td className="td">
                      <span className={`badge ${
                        a.status === 'completed'   ? 'badge-green' :
                        a.status === 'cancelled'   ? 'badge-red' :
                        a.status === 'in_progress' ? 'badge-purple' : 'badge-yellow'
                      }`}>{(a.status || '').replace(/_/g, ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {appts.length > 8 && (
              <div className="px-5 py-3 text-center border-t border-gray-100">
                <button onClick={() => isManager ? goOperations() : goFrontDesk()}
                  className="text-sm text-blue-600 hover:text-blue-800">
                  +{appts.length - 8} more — View all
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
