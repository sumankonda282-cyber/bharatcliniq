import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { toast } from '../utils/toast'

const STYLES = {
  success: { Icon: CheckCircle,   wrap: 'bg-green-50  border-green-200',  txt: 'text-green-800',  ico: 'text-green-500'  },
  error:   { Icon: AlertCircle,   wrap: 'bg-red-50    border-red-200',    txt: 'text-red-800',    ico: 'text-red-500'    },
  warning: { Icon: AlertTriangle, wrap: 'bg-yellow-50 border-yellow-200', txt: 'text-yellow-800', ico: 'text-yellow-500' },
  info:    { Icon: Info,          wrap: 'bg-blue-50   border-blue-200',   txt: 'text-blue-800',   ico: 'text-blue-500'   },
}

export default function Toaster() {
  const [toasts, setToasts] = useState([])
  useEffect(() => { toast._register(setToasts) }, [])
  if (!toasts.length) return null
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map(t => {
        const s = STYLES[t.type] || STYLES.info
        return (
          <div key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg pointer-events-auto
              ${s.wrap} animate-in slide-in-from-right-4 duration-300`}>
            <s.Icon size={17} className={`flex-shrink-0 mt-0.5 ${s.ico}`} />
            <span className={`flex-1 text-sm font-medium leading-snug ${s.txt}`}>{t.msg}</span>
            <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
