import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, CheckCircle2, Loader2 } from 'lucide-react'
import api from '../api/client'

function playBeep(ctx) {
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'square'
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch {}
}

const TRIAGE_BG = {
  red:    'bg-red-600',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  green:  'bg-green-600',
}
const TRIAGE_LABEL = {
  red: 'CRITICAL', orange: 'URGENT', yellow: 'SEMI-URGENT', green: 'STABLE',
}

export default function EmergencyAlertBanner() {
  const [alerts, setAlerts] = useState([])
  const [acking, setAcking] = useState({})
  const audioCtxRef = useRef(null)
  const beepTimerRef = useRef(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await api.get('/inpatient/emergency', { params: { status: 'en_route' } })
      const list = Array.isArray(data) ? data : []
      setAlerts(list.filter(e => e.alert_sent_at && !e.alert_ack_at))
    } catch {}
  }, [])

  useEffect(() => {
    fetchAlerts()
    const id = setInterval(fetchAlerts, 10000)
    const h = () => fetchAlerts()
    window.addEventListener('bharatcliniq:refresh', h)
    return () => { clearInterval(id); window.removeEventListener('bharatcliniq:refresh', h) }
  }, [fetchAlerts])

  useEffect(() => {
    if (alerts.length > 0) {
      let ctx = audioCtxRef.current
      if (!ctx) {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); audioCtxRef.current = ctx } catch {}
      }
      if (ctx) {
        const doBeep = () => {
          if (ctx.state === 'suspended') ctx.resume().then(() => playBeep(ctx)).catch(() => {})
          else playBeep(ctx)
        }
        doBeep()
        if (!beepTimerRef.current) {
          beepTimerRef.current = setInterval(doBeep, 3500)
        }
      }
    } else {
      if (beepTimerRef.current) { clearInterval(beepTimerRef.current); beepTimerRef.current = null }
    }
  }, [alerts.length])

  useEffect(() => () => { if (beepTimerRef.current) clearInterval(beepTimerRef.current) }, [])

  const acknowledge = async (a) => {
    setAcking(p => ({ ...p, [a.id]: true }))
    try {
      await api.post(`/inpatient/emergency/${a.id}/acknowledge`)
      setAlerts(prev => prev.filter(x => x.id !== a.id))
      window.dispatchEvent(new CustomEvent('bharatcliniq:refresh'))
    } catch {}
    setAcking(p => ({ ...p, [a.id]: false }))
  }

  if (alerts.length === 0) return null

  return (
    <div className="flex-shrink-0">
      {alerts.map(a => (
        <div key={a.id}
          className={`${TRIAGE_BG[a.triage_level] || 'bg-red-600'} text-white flex items-center gap-3 px-4 py-2.5`}>
          <Bell size={15} className="flex-shrink-0 animate-bounce" />
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
            <span className="font-bold text-xs px-2 py-0.5 rounded bg-white/20 uppercase tracking-wide">
              {TRIAGE_LABEL[a.triage_level] || (a.triage_level || '').toUpperCase()}
            </span>
            <span className="font-bold">{a.admission_number}</span>
            <span className="opacity-90">{a.patient_name}</span>
            {a.chief_complaint && (
              <span className="text-xs opacity-75 truncate max-w-xs">· {a.chief_complaint}</span>
            )}
            {a.eta_minutes && <span className="text-xs opacity-75">ETA {a.eta_minutes} min</span>}
          </div>
          <button
            onClick={() => acknowledge(a)}
            disabled={acking[a.id]}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 text-sm font-bold flex-shrink-0 transition disabled:opacity-60"
          >
            {acking[a.id]
              ? <Loader2 size={13} className="animate-spin" />
              : <CheckCircle2 size={13} />}
            Accept
          </button>
        </div>
      ))}
    </div>
  )
}
