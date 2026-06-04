import { Keyboard, Mic, PenLine } from 'lucide-react'

const MODES = [
  { key: 'type',        label: 'Type',        icon: Keyboard, desc: 'Standard keyboard' },
  { key: 'voice',       label: 'Voice',       icon: Mic,      desc: 'Speak to enter' },
  { key: 'handwriting', label: 'Handwriting', icon: PenLine,  desc: 'S Pen / Stylus' },
]

export default function InputModeSelector({ mode, setMode }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl border border-gray-200 bg-gray-50 w-fit">
      {MODES.map(({ key, label, icon: Icon, desc }) => {
        const active = mode === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            title={desc}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              active ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={active ? { background: '#0F2557' } : {}}
          >
            <Icon size={13} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
