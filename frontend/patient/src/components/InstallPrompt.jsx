import { useState, useEffect } from 'react'
import { X, Download, Share, Plus } from 'lucide-react'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}
function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
}

export default function InstallPrompt({ appName = 'BharatCliniq' }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow]                     = useState(false)
  const [ios, setIos]                       = useState(false)
  const [installing, setInstalling]         = useState(false)
  const DISMISS_KEY = `pwa_dismissed_${appName}`

  useEffect(() => {
    // Already installed or dismissed
    if (isInStandaloneMode()) return
    if (sessionStorage.getItem(DISMISS_KEY)) return

    if (isIOS()) {
      // iOS: show manual instructions after 3s
      setIos(true)
      const t = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(t)
    }

    // Android / Chrome / Edge / Desktop
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setInstalling(false)
    setDeferredPrompt(null)
    setShow(false)
    if (outcome === 'accepted') sessionStorage.setItem(DISMISS_KEY, '1')
  }

  const handleDismiss = () => {
    setShow(false)
    sessionStorage.setItem(DISMISS_KEY, '1')
  }

  if (!show) return null

  return (
    <>
      {/* Backdrop blur on mobile */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
           style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
        <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
             style={{ background: '#fff' }}>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4"
               style={{ background: '#0F2557' }}>
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/10 flex items-center justify-center">
              <img src="/android-192x192.png" alt={appName}
                   className="w-full h-full object-cover"
                   onError={e => { e.target.style.display='none' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base leading-tight">{appName}</p>
              <p className="text-blue-200 text-xs mt-0.5">Install for faster access</p>
            </div>
            <button onClick={handleDismiss}
                    className="text-white/60 hover:text-white transition-colors p-1">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            {ios ? (
              <>
                <p className="text-gray-700 text-sm font-semibold mb-3">
                  Add to your Home Screen:
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                         style={{ background: '#0F2557' }}>1</div>
                    <span>Tap the <Share size={14} className="inline mx-1 text-blue-500" /> <strong>Share</strong> button in Safari</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                         style={{ background: '#0F2557' }}>2</div>
                    <span>Tap <Plus size={14} className="inline mx-1 text-blue-500" /> <strong>Add to Home Screen</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                         style={{ background: '#F5821E' }}>3</div>
                    <span>Tap <strong>Add</strong> to confirm</span>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-xl text-xs text-blue-700 font-medium"
                     style={{ background: '#EEF2FF' }}>
                  Works offline · No App Store needed · Instant updates
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-700 text-sm mb-3">
                  Install <strong>{appName}</strong> on your device for a faster, app-like experience — works offline too.
                </p>
                <div className="flex gap-2 flex-wrap text-xs text-gray-500 mb-4">
                  {['Works offline','No App Store','Instant updates','Less storage'].map(f => (
                    <span key={f} className="px-2 py-1 rounded-full bg-gray-100">{f}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 pb-5">
            <button onClick={handleDismiss}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">
              Not now
            </button>
            {!ios && (
              <button onClick={handleInstall} disabled={installing}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity"
                      style={{ background: '#0F2557', opacity: installing ? 0.7 : 1 }}>
                <Download size={15} />
                {installing ? 'Installing…' : 'Install App'}
              </button>
            )}
            {ios && (
              <button onClick={handleDismiss}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                      style={{ background: '#0F2557' }}>
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
