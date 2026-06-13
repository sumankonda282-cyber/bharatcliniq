import { useState, useEffect, useRef } from 'react'
import { Bell, Calendar, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'

const STORAGE_KEY = 'bh_patient_notif_seen'

function loadSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) }
  catch { return new Set() }
}
function saveSeen(set) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])) }
  catch { /* ignore */ }
}

export default function PatientNotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const seenRef = useRef(loadSeen())
  const ref = useRef(null)

  const refresh = async () => {
    try {
      const r = await api.get('/portal/appointments')
      const list = r?.appointments || (Array.isArray(r) ? r : [])
      const newItems = []
      list.forEach(a => {
        if (a.status === 'confirmed') {
          const key = `appt-confirmed-${a.id}`
          if (!seenRef.current.has(key)) {
            newItems.push({
              id: key,
              title: 'Appointment Confirmed',
              body: `${a.clinic_name || 'Health Center'} · ${a.date || ''} ${a.time || ''}`,
              to: '/appointments',
              ts: a.updated_at,
            })
          }
        }
      })
      setItems(prev => {
        const existingIds = new Set(prev.map(i => i.id))
        const fresh = newItems.filter(i => !existingIds.has(i.id))
        return [...fresh, ...prev].slice(0, 20)
      })
    } catch { /* silent */ }
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const dismiss = (id) => {
    seenRef.current.add(id)
    saveSeen(seenRef.current)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const dismissAll = () => {
    items.forEach(i => seenRef.current.add(i.id))
    saveSeen(seenRef.current)
    setItems([])
  }

  const handleClick = (item) => {
    dismiss(item.id)
    setOpen(false)
    navigate(item.to)
  }

  const count = items.length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
            style={{ background: '#CC1414' }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900 text-sm">Notifications</span>
            {count > 0 && (
              <button onClick={dismissAll} className="text-xs text-gray-400 hover:text-gray-600">Clear all</button>
            )}
          </div>
          {count === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <Bell size={26} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {items.map(item => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <button className="flex items-start gap-3 flex-1 text-left" onClick={() => handleClick(item)}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: '#f0fdf4' }}>
                      <Calendar size={14} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800">{item.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{item.body}</div>
                    </div>
                  </button>
                  <button onClick={() => dismiss(item.id)} className="p-0.5 text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
