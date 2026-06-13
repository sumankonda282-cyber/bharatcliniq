import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api/client'
import { cachedFetch } from '../utils/cache'
import { Calendar, Pill, Heart, CheckCircle, Users, ShieldCheck, RefreshCw, Copy, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import logoImg from '../assets/logo.png'

function HistoryPinSection() {
  const [pin, setPin] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef(null)

  const startCountdown = (expiry) => {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      const secs = Math.max(0, Math.round((new Date(expiry) - Date.now()) / 1000))
      setSecondsLeft(secs)
      if (secs === 0) clearInterval(timerRef.current)
    }, 1000)
  }

  const generate = async () => {
    setLoading(true)
    try {
      const res = await api.post('/portal/pin/generate')
      const data = res?.data || res
      setPin(data.pin)
      setExpiresAt(data.expires_at)
      startCountdown(data.expires_at)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    api.get('/portal/pin').then(res => {
      const data = res?.data || res
      if (data?.pin && data?.expires_at && new Date(data.expires_at) > new Date()) {
        setPin(data.pin)
        setExpiresAt(data.expires_at)
        startCountdown(data.expires_at)
      }
    }).catch(() => {})
    return () => clearInterval(timerRef.current)
  }, [])

  const expired = secondsLeft === 0 && pin
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  return (
    <div className="mt-5 pt-4 border-t border-white/10">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} style={{ color: '#fbbf24' }} />
          <span className="text-xs font-semibold" style={{ color: '#93c5fd' }}>Clinical History Access PIN</span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-50"
          style={{ background: 'rgba(245,130,30,0.2)', color: '#fbbf24' }}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          {pin ? 'New PIN' : 'Generate PIN'}
        </button>
      </div>

      {pin && !expired ? (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-extrabold tracking-[0.25em] font-mono" style={{ color: '#F5821E' }}>
              {pin}
            </span>
            <button
              onClick={() => { navigator.clipboard.writeText(pin); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} style={{ color: '#93c5fd' }} />}
            </button>
          </div>
          <div className="text-right">
            <div className="text-xs font-mono font-semibold" style={{ color: secondsLeft < 300 ? '#f87171' : '#86efac' }}>
              {mins}:{String(secs).padStart(2, '0')}
            </div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>remaining</div>
          </div>
        </div>
      ) : pin && expired ? (
        <p className="text-xs" style={{ color: '#f87171' }}>PIN expired — generate a new one to share.</p>
      ) : (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Share this PIN + your BHID with a doctor at another health center to grant temporary access to your history.
        </p>
      )}
    </div>
  )
}

const STATUS_COLORS = {
  pending: 'badge-yellow', confirmed: 'badge-blue', completed: 'badge-green',
  cancelled: 'badge-gray', in_progress: 'badge-blue',
}

export default function Dashboard() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [guardianOf, setGuardianOf] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cachedFetch(
      'dashboard',
      () => Promise.all([
        api.get('/portal/appointments'),
        api.get('/portal/prescriptions'),
        api.get('/portal/me'),
      ]),
      ([a, p, me]) => {
        setAppointments(a?.data?.appointments || a?.appointments || a?.data || [])
        setPrescriptions((p?.data?.prescriptions || p?.prescriptions || p?.data || []).slice(0, 3))
        const meData = me?.data || me
        setGuardianOf(Array.isArray(meData?.guardian_of) ? meData.guardian_of : [])
        setLoading(false)
      }
    ).catch(() => setLoading(false))
  }, [])

  const pendingRx = prescriptions.filter(p => p.status === 'pending').length
  const upcoming = appointments.filter(a => ['pending', 'confirmed'].includes(a.status)).length
  const completedVisits = appointments.filter(a => a.status === 'completed').length

  return (
    <div className="space-y-5">
      {/* BHID Health Card */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F2557 0%, #1a3a7a 60%, #0a1a3e 100%)' }}>
        {/* Decorative */}
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full pointer-events-none" style={{ background:'rgba(245,130,30,0.12)' }} />
        <div className="absolute -bottom-8 left-1/3 w-40 h-40 rounded-full pointer-events-none" style={{ background:'rgba(204,20,20,0.10)' }} />

        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <img src={logoImg} alt="BHarath Health" style={{ height: 32, width: 'auto' }} />
              <span className="font-extrabold text-sm tracking-wider text-white" style={{ letterSpacing: '-0.01em' }}>BHarath Health Systems</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(245,130,30,0.2)', color: '#fbbf24' }}>
              <Heart size={11} />
              Digital Health Card
            </div>
          </div>

          <div className="mb-5">
            <div className="text-xs mb-1 font-medium" style={{ color: '#93c5fd' }}>Patient Name</div>
            <div className="text-2xl font-bold tracking-wide">{user?.full_name || 'Patient'}</div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs mb-1 font-medium" style={{ color: '#93c5fd' }}>BHID / Health ID</div>
              <div className="font-mono text-lg font-bold tracking-widest" style={{ color: '#F5821E' }}>
                {user?.bh_id ? user.bh_id.toUpperCase() : 'BH-XXXXXXXX'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs mb-1 font-medium" style={{ color: '#93c5fd' }}>Health Centers</div>
              <div className="text-xl font-bold">{user?.linked_clinics || 0}</div>
            </div>
          </div>

          <HistoryPinSection />
        </div>
      </div>

      {/* Stats row — linked clinics already shown on the health card above */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Upcoming Appointments', value: upcoming, icon: Calendar, accent: '#0F2557', lightBg: '#EEF2FF' },
          { label: 'Pending Prescriptions', value: pendingRx, icon: Pill, accent: '#CC1414', lightBg: '#FEF2F2' },
          { label: 'Completed Visits', value: completedVisits, icon: CheckCircle, accent: '#16a34a', lightBg: '#F0FDF4' },
        ].map(stat => (
          <div key={stat.label} className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: stat.lightBg }}>
              <stat.icon size={18} style={{ color: stat.accent }} />
            </div>
            <div>
              <div className="text-xl font-bold" style={{ color: '#0F2557' }}>{loading ? '—' : stat.value}</div>
              <div className="text-xs text-gray-500 leading-tight">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Family Members — guardian_of */}
      {!loading && guardianOf.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Users size={18} style={{ color: '#0F2557' }} />
              <h2 className="font-bold text-base" style={{ color: '#0F2557' }}>Family Members</h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">You are registered as guardian for these patients</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
            {guardianOf.map(p => (
              <div key={p.id} className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm" style={{ color: '#0F2557' }}>{p.full_name}</div>
                  {p.bh_id && (
                    <div className="text-xs font-mono text-gray-400 mt-0.5">{p.bh_id.toUpperCase()}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {p.age !== null && p.age !== undefined ? `${p.age} yrs` : ''}
                    {p.age !== null && p.age !== undefined && p.gender ? ' · ' : ''}
                    {p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : ''}
                  </div>
                </div>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors whitespace-nowrap"
                  style={{ borderColor: '#0F2557', color: '#0F2557' }}
                  onClick={() => {}}
                  title="View records — coming soon"
                >
                  View Records
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent appointments */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-base" style={{ color: '#0F2557' }}>Recent Appointments</h2>
          <Link to="/appointments" className="text-sm font-medium hover:underline" style={{ color: '#CC1414' }}>
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : appointments.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Calendar size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No appointments on record yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {appointments.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3 hover:bg-blue-50/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: '#EEF2FF' }}>
                    <Calendar size={15} style={{ color: '#0F2557' }} />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900">{a.clinic_name}</div>
                    <div className="text-xs text-gray-400">
                      {/^dr\.?\s/i.test(a.doctor_name || '') ? a.doctor_name : `Dr. ${a.doctor_name || ''}`} · {a.date} {a.time && `at ${a.time}`}
                    </div>
                  </div>
                </div>
                <span className={STATUS_COLORS[a.status] || 'badge-gray'}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
