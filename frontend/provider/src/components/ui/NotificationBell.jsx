import { useState, useEffect, useRef } from 'react'
import { Bell, Globe, UserCheck, ClipboardList, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { appointmentsApi } from '../../api'
import { useAuth } from '../../contexts/AuthContext'

function useNotifications() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const seenRef = useRef(new Set())

  const refresh = async () => {
    try {
      const newItems = []

      // Online booking requests (receptionist / admin)
      if (['clinic_admin', 'receptionist'].includes(user?.role)) {
        const bookings = await appointmentsApi.listOnlineBookings({ status: 'pending' })
        const list = Array.isArray(bookings) ? bookings : []
        list.forEach(b => {
          const key = `booking-${b.id}`
          if (!seenRef.current.has(key)) {
            newItems.push({
              id: key,
              type: 'booking',
              title: 'New online booking request',
              body: `${b.patient_name} · ${b.booking_date} ${b.booking_time || ''}`,
              to: '/appointments',
              icon: Globe,
              color: '#ca8a04',
              ts: b.created_at,
            })
          }
        })
      }

      setItems(prev => {
        // Merge: keep dismissed items out, add new ones at top
        const existingIds = new Set(prev.map(i => i.id))
        const fresh = newItems.filter(i => !existingIds.has(i.id))
        return [...fresh, ...prev].slice(0, 30)
      })
    } catch { /* silent */ }
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 60_000)
    return () => clearInterval(t)
  }, [user?.role])

  const dismiss = (id) => {
    seenRef.current.add(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const dismissAll = () => {
    items.forEach(i => seenRef.current.add(i.id))
    setItems([])
  }

  return { items, dismiss, dismissAll, refresh }
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { items, dismiss, dismissAll } = useNotifications()

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const count = items.length

  const handleClick = (item) => {
    dismiss(item.id)
    setOpen(false)
    navigate(item.to)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {count > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
            style={{ background: '#CC1414' }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900 text-sm">Notifications</span>
            {count > 0 && (
              <button onClick={dismissAll} className="text-xs text-gray-400 hover:text-gray-600">
                Clear all
              </button>
            )}
          </div>
          {count === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <Bell size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {items.map(item => {
                const Icon = item.icon || Bell
                return (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <button className="flex items-start gap-3 flex-1 text-left" onClick={() => handleClick(item)}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: item.color + '15' }}>
                        <Icon size={14} style={{ color: item.color }} />
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
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
