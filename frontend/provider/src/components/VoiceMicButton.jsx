import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

export default function VoiceMicButton({ onResult, lang = 'en-IN', className = '' }) {
  const [state, setState] = useState('idle') // idle | listening | error
  const recogRef = useRef(null)

  useEffect(() => () => recogRef.current?.stop(), [])

  if (!SpeechRecognition) return null

  const start = () => {
    const r = new SpeechRecognition()
    r.lang = lang
    r.continuous = false
    r.interimResults = false

    r.onstart  = () => setState('listening')
    r.onresult = (e) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join(' ')
      onResult(text)
      setState('idle')
    }
    r.onerror  = () => setState('idle')
    r.onend    = () => setState('idle')

    recogRef.current = r
    r.start()
    setState('listening')
  }

  const stop = () => {
    recogRef.current?.stop()
    setState('idle')
  }

  return (
    <button
      type="button"
      onMouseDown={start}
      onMouseUp={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      title={state === 'listening' ? 'Release to stop' : 'Hold to speak'}
      className={`flex items-center justify-center rounded-lg transition-all select-none ${className} ${
        state === 'listening'
          ? 'text-white animate-pulse'
          : 'text-gray-400 hover:text-white hover:bg-white/10'
      }`}
      style={state === 'listening' ? { background: '#CC1414' } : {}}
    >
      {state === 'listening' ? <MicOff size={16} /> : <Mic size={16} />}
    </button>
  )
}
