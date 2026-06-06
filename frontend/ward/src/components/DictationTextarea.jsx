import { useState, useRef } from 'react'
import { Mic, MicOff } from 'lucide-react'

export default function DictationTextarea({ value, onChange, placeholder, rows = 4, disabled = false, className = '' }) {
  const [listening, setListening] = useState(false)
  const recogRef = useRef(null)

  const toggle = () => {
    if (listening) { recogRef.current?.stop(); setListening(false); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Voice dictation requires Chrome or Edge browser.'); return }
    const r = new SR()
    r.continuous = true; r.interimResults = false; r.lang = 'en-IN'
    recogRef.current = r
    r.onresult = e => {
      const transcript = Array.from(e.results)
        .slice(e.resultIndex)
        .map(x => x[0].transcript)
        .join(' ')
        .trim()
      onChange({ target: { value: value + (value && !value.endsWith(' ') ? ' ' : '') + transcript } })
    }
    r.onerror = () => setListening(false)
    r.onend  = () => setListening(false)
    r.start(); setListening(true)
  }

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none pr-10
          ${listening ? 'border-red-400 bg-red-50 focus:ring-red-400' : 'border-gray-300 focus:ring-emerald-500'}
          ${disabled ? 'bg-gray-50' : ''}
          ${className}`}
      />
      {!disabled && (
        <button type="button" onMouseDown={toggle}
          title={listening ? 'Stop dictation' : 'Start voice dictation (Chrome/Edge)'}
          className={`absolute right-2 bottom-2 p-1.5 rounded-full transition-all ${
            listening ? 'bg-red-500 text-white animate-pulse shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-emerald-100 hover:text-emerald-600'
          }`}>
          {listening ? <MicOff size={13} /> : <Mic size={13} />}
        </button>
      )}
      {listening && (
        <p className="text-xs text-red-500 mt-1 animate-pulse">🎤 Listening… speak clearly. Tap mic to stop.</p>
      )}
    </div>
  )
}
