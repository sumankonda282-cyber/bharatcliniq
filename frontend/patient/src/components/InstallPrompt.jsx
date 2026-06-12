import { useState, useEffect } from 'react'
import { X, Download, Share, Plus, Smartphone } from 'lucide-react'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}
function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
}
function wasDismissedRecently(key) {
  const ts = localStorage.getItem(key)
  if (!ts) return false
  return Date.now() - parseInt(ts) < 3 * 24 * 60 * 60 * 1000
}

export function useInstallState(appName) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [canInstall, setCanInstall]         = useState(false)
  const [isIos, setIsIos]                   = useState(false)
  const [installed, setInstalled]           = useState(false)
  const DISMISS_KEY = `pwa_dismissed_${appName}`
  const [dismissed, setDismissed]           = useState(() => wasDismissedRecently(DISMISS_KEY))

  useEffect(() => {
    if (isInStandaloneMode()) { setInstalled(true); return }
    if (isIOS()) { setIsIos(true); setCanInstall(true); return }
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); setCanInstall(true) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }

  const install = async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') { setInstalled(true); dismiss() }
    setDeferredPrompt(null)
    return outcome === 'accepted'
  }

  return { canInstall, isIos, installed, dismissed, dismiss, install }
}

export function InstallModal({ appName, isIos, onInstall, onClose, installing }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden bg-white">

        <div className="flex items-center gap-3 px-5 py-4" style={{ background: '#0F2557' }}>
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Smartphone size={26} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-base">{appName}</p>
            <p className="text-blue-200 text-xs mt-0.5">Install as an app on your device</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1"><X size={18} /></button>
        </div>

        <div className="px-5 py-5">
          {isIos ? (
            <>
              <p className="text-gray-800 text-sm font-semibold mb-4">3 steps to install on iPhone / iPad:</p>
              <div className="space-y-4">
                {[
                  { n: 1, icon: <Share size={16} className="text-blue-500 inline mx-1" />, text: <>Tap the <Share size={14} className="inline mx-1 text-blue-500" /> <strong>Share</strong> button at the bottom of Safari</> },
                  { n: 2, icon: null, text: <><Plus size={14} className="inline mr-1 text-blue-500" />Scroll down and tap <strong>Add to Home Screen</strong></> },
                  { n: 3, icon: null, text: <>Tap <strong>Add</strong> in the top-right corner</> },
                ].map(s => (
                  <div key={s.n} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5"
                         style={{ background: s.n === 3 ? '#F5821E' : '#0F2557' }}>{s.n}</div>
                    <p className="text-sm text-gray-600 leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-xl text-xs text-blue-700 font-medium" style={{ background: '#EEF2FF' }}>
                ✓ Works offline &nbsp;·&nbsp; ✓ No App Store &nbsp;·&nbsp; ✓ Instant updates
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-700 text-sm mb-4">
                Install <strong>{appName}</strong> on your device. Opens like a native app — no browser bar, faster, works offline.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {['Works offline','No App Store needed','Opens like a native app','Instant updates'].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="text-green-500 font-bold">✓</span>{f}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50">
            Later
          </button>
          {isIos ? (
            <button onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: '#0F2557' }}>
              Got it ✓
            </button>
          ) : (
            <button onClick={onInstall} disabled={installing}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: '#0F2557', opacity: installing ? 0.7 : 1 }}>
              <Download size={15} />
              {installing ? 'Installing…' : 'Install Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function InstallPrompt({ appName = 'BHarath Health' }) {
  const { canInstall, isIos, installed, dismissed, dismiss, install } = useInstallState(appName)
  const [showModal, setShowModal] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(
    () => !!localStorage.getItem(`pwa_banner_dismissed_${appName}`)
  )

  const handleInstall = async () => {
    setInstalling(true)
    await install()
    setInstalling(false)
    setShowModal(false)
  }

  if (installed || !canInstall) return null

  return (
    <>
      {/* Sticky bottom banner — main awareness element */}
      {!bannerDismissed && !showModal && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:left-60"
             style={{ background: '#0F2557', borderTop: '2px solid #F5821E' }}>
          <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Smartphone size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold leading-tight">
                {isIos ? 'Add to Home Screen' : 'Install as App'}
              </p>
              <p className="text-blue-200 text-xs mt-0.5 truncate">
                {isIos
                  ? 'Tap Share → Add to Home Screen in Safari'
                  : 'Faster access, works offline, no browser bar'}
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: '#F5821E' }}>
              {isIos ? 'How?' : 'Install'}
            </button>
            <button
              onClick={() => { setBannerDismissed(true); localStorage.setItem(`pwa_banner_dismissed_${appName}`, '1') }}
              className="flex-shrink-0 p-1 text-white/50 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <InstallModal
          appName={appName}
          isIos={isIos}
          installing={installing}
          onInstall={handleInstall}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
