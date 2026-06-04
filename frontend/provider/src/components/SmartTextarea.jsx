import { useRef } from 'react'
import VoiceMicButton from './VoiceMicButton'

/**
 * Drop-in replacement for <textarea> that adds a mic button
 * when mode === 'voice', and larger text + font when mode === 'handwriting'.
 */
export default function SmartTextarea({ mode = 'type', value, onChange, rows = 3, placeholder, className = '', lang = 'en-IN', ...props }) {
  const ref = useRef(null)

  const appendText = (text) => {
    const cur = value || ''
    const sep = cur && !cur.endsWith(' ') && !cur.endsWith('\n') ? ' ' : ''
    onChange(cur + sep + text)
    ref.current?.focus()
  }

  const textareaClass = [
    'input resize-none w-full transition-all',
    mode === 'handwriting' ? 'text-lg leading-relaxed' : 'text-sm',
    className,
  ].join(' ')

  return (
    <div className="relative">
      <textarea
        ref={ref}
        rows={mode === 'handwriting' ? Math.max(rows, 4) : rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={
          mode === 'voice'       ? '🎤 Press mic and speak…'       :
          mode === 'handwriting' ? '✍️  Write with S Pen or stylus…' :
          placeholder
        }
        className={textareaClass}
        style={mode === 'handwriting' ? { fontFamily: 'Georgia, serif', letterSpacing: '0.01em' } : {}}
        {...props}
      />
      {mode === 'voice' && (
        <VoiceMicButton
          onResult={appendText}
          lang={lang}
          className="absolute bottom-2 right-2 w-8 h-8"
        />
      )}
    </div>
  )
}
