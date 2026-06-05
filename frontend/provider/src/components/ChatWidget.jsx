import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, X, Send, ChevronLeft, ChevronDown, Users } from 'lucide-react'
import api from '../api/client'

const ROLE_LABEL = {
  doctor: 'Doctors', nurse: 'Nurses', receptionist: 'Reception',
  pharmacist: 'Pharmacy', lab_tech: 'Lab', lab_technician: 'Lab',
  imaging_technician: 'Imaging', clinic_manager: 'Management',
  clinic_admin: 'Management',
}

const PRESENCE_COLOR = { online: '#16a34a', away: '#f59e0b', offline: '#9ca3af' }

// Distinct avatar colors per role
const ROLE_COLOR = {
  doctor: '#0F2557', nurse: '#0891b2', receptionist: '#7c3aed',
  pharmacist: '#15803d', lab_tech: '#b45309', lab_technician: '#b45309',
  imaging_technician: '#be185d', clinic_manager: '#CC1414', clinic_admin: '#CC1414',
}

const SHORTCUTS = [
  { label: '💊 Rx Ready',      body: '💊 Prescription is ready for the patient.' },
  { label: '🧪 Sample Ready',  body: '🧪 Lab sample collected and ready for testing.' },
  { label: '🩻 Report Ready',  body: '🩻 Imaging report is ready for review.' },
  { label: '📋 Patient Ready', body: '📋 Patient is ready for consultation.' },
  { label: '💰 Bill Ready',    body: '💰 Invoice generated, please collect payment.' },
  { label: '⚠️ Urgent',        body: '⚠️ Urgent attention needed for this patient.' },
]

function Avatar({ name, role, size = 9, presence }) {
  const color = ROLE_COLOR[role] || '#6b7280'
  const px = size * 4
  return (
    <div className="relative flex-shrink-0" style={{ width: px, height: px }}>
      <div
        className="w-full h-full rounded-full flex items-center justify-center font-bold text-white text-sm"
        style={{ background: color }}
      >
        {name?.[0]?.toUpperCase() || '?'}
      </div>
      {presence && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-white"
          style={{ width: 10, height: 10, background: PRESENCE_COLOR[presence] || PRESENCE_COLOR.offline }}
        />
      )}
    </div>
  )
}

function Select({ label, value, onChange, options, placeholder }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:border-blue-400 bg-white text-gray-700"
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

export default function ChatWidget() {
  const [open, setOpen]               = useState(false)
  const [view, setView]               = useState('contacts') // contacts | new | chat
  const [contacts, setContacts]       = useState([])
  const [activeRoom, setActiveRoom]   = useState(null)
  const [activeContact, setActiveContact] = useState(null)
  const [messages, setMessages]       = useState([])
  const [input, setInput]             = useState('')
  const [totalUnread, setTotalUnread] = useState(0)
  const [sending, setSending]         = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  // New message selectors
  const [selBranch, setSelBranch]     = useState('')
  const [selDept, setSelDept]         = useState('')
  const [selPerson, setSelPerson]     = useState('')

  const messagesEndRef = useRef(null)
  const pollAbortRef   = useRef(null)
  const lastMsgIdRef   = useRef(0)
  const myStaffId      = useRef(null)

  useEffect(() => {
    try {
      const token = localStorage.getItem('access_token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        myStaffId.current = payload.sub ? parseInt(payload.sub) : null
      }
    } catch {}
  }, [])

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  // Heartbeat every 60s — keeps presence accurate
  useEffect(() => {
    api.post('/chat/heartbeat').catch(() => {})
    const t = setInterval(() => api.post('/chat/heartbeat').catch(() => {}), 60000)
    return () => clearInterval(t)
  }, [])

  // Poll unread count every 30s when closed
  useEffect(() => {
    if (open) return
    const fetch = () => api.get('/chat/unread').then(d => setTotalUnread(d.total)).catch(() => {})
    fetch()
    const t = setInterval(fetch, 30000)
    return () => clearInterval(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    api.get('/chat/contacts').then(setContacts).catch(() => {})
  }, [open])

  const startPoll = useCallback((roomId) => {
    const ctrl = { running: true }
    pollAbortRef.current = ctrl
    const poll = async () => {
      while (ctrl.running) {
        try {
          const msgs = await api.get(`/chat/rooms/${roomId}/poll?after_id=${lastMsgIdRef.current}`)
          if (!ctrl.running) break
          if (msgs?.length > 0) {
            setMessages(prev => {
              const ids = new Set(prev.map(m => m.id))
              const fresh = msgs.filter(m => !ids.has(m.id))
              if (!fresh.length) return prev
              lastMsgIdRef.current = Math.max(...msgs.map(m => m.id))
              return [...prev, ...fresh]
            })
            setTimeout(scrollToBottom, 50)
          }
        } catch {
          if (!ctrl.running) break
          await new Promise(r => setTimeout(r, 3000))
        }
      }
    }
    poll()
  }, [])

  const stopPoll = () => { if (pollAbortRef.current) pollAbortRef.current.running = false }
  useEffect(() => () => stopPoll(), [])

  const openChat = async (contact) => {
    stopPoll()
    setActiveContact(contact)
    setMessages([])
    lastMsgIdRef.current = 0
    setView('chat')
    setShowShortcuts(false)
    try {
      const { room_id } = await api.post(`/chat/rooms/direct?other_staff_id=${contact.staff_id}`)
      setActiveRoom(room_id)
      const msgs = await api.get(`/chat/rooms/${room_id}/messages`)
      setMessages(msgs)
      if (msgs.length > 0) lastMsgIdRef.current = Math.max(...msgs.map(m => m.id))
      setTimeout(scrollToBottom, 50)
      startPoll(room_id)
      api.get('/chat/contacts').then(setContacts).catch(() => {})
    } catch {}
  }

  const backToContacts = () => {
    stopPoll()
    setView('contacts')
    setActiveRoom(null)
    setActiveContact(null)
    api.get('/chat/contacts').then(setContacts).catch(() => {})
  }

  const sendMsg = async (body, type = 'text') => {
    if (!activeRoom || !body.trim() || sending) return
    setSending(true)
    try {
      const msg = await api.post(`/chat/rooms/${activeRoom}/messages`, { body, msg_type: type })
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev
        lastMsgIdRef.current = Math.max(lastMsgIdRef.current, msg.id)
        return [...prev, msg]
      })
      setInput('')
      setTimeout(scrollToBottom, 50)
    } catch {}
    setSending(false)
  }

  const handleClose = () => {
    stopPoll()
    setOpen(false)
    setView('contacts')
    setActiveRoom(null)
    setActiveContact(null)
  }

  useEffect(() => {
    if (view === 'chat') setTimeout(scrollToBottom, 100)
  }, [messages, view])

  // ── Derived data for new message flow ──────────────────────────────
  const branches = [...new Map(
    contacts.filter(c => c.branch_id).map(c => [c.branch_id, c.branch_name || `Branch ${c.branch_id}`])
  ).entries()].map(([value, label]) => ({ value: String(value), label }))

  const hasBranches = branches.length > 1

  const filteredByBranch = hasBranches && selBranch
    ? contacts.filter(c => String(c.branch_id) === selBranch)
    : contacts

  const departments = [...new Set(filteredByBranch.map(c => ROLE_LABEL[c.role] || c.role))]
    .map(d => ({ value: d, label: d }))

  const filteredByDept = selDept
    ? filteredByBranch.filter(c => (ROLE_LABEL[c.role] || c.role) === selDept)
    : filteredByBranch

  const personOptions = filteredByDept.map(c => ({ value: String(c.staff_id), label: c.full_name }))

  const handleStartChat = () => {
    const contact = contacts.find(c => String(c.staff_id) === selPerson)
    if (contact) { setSelBranch(''); setSelDept(''); setSelPerson(''); openChat(contact) }
  }

  // ── Group contacts by dept for list view ───────────────────────────
  const grouped = contacts.reduce((acc, c) => {
    const dept = ROLE_LABEL[c.role] || c.role
    if (!acc[dept]) acc[dept] = []
    acc[dept].push(c)
    return acc
  }, {})

  const myId = myStaffId.current

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        style={{ background: '#0F2557' }}
        title="Team Chat"
      >
        <MessageCircle size={24} className="text-white" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {/* Chat panel — 30% desktop, 60% mobile, fixed bottom-right */}
      {open && (
        <div
          className="fixed z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{
            bottom: 88, right: 24,
            width: 'min(360px, 60vw)',
            height: 500,
            background: 'white',
            border: '1px solid #e5e7eb',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{ background: '#0F2557' }}>
            {(view === 'chat' || view === 'new') && (
              <button onClick={backToContacts} className="text-white/70 hover:text-white mr-1">
                <ChevronLeft size={20} />
              </button>
            )}
            {view === 'contacts' && <Users size={18} className="text-white" />}
            {view === 'contacts' && <span className="text-white font-semibold text-sm flex-1">Team Chat</span>}
            {view === 'new' && <span className="text-white font-semibold text-sm flex-1">New Message</span>}
            {view === 'chat' && (
              <>
                <Avatar name={activeContact?.full_name} role={activeContact?.role} size={7} presence={activeContact?.presence} />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm truncate">{activeContact?.full_name}</div>
                  <div className="text-blue-200 text-xs">{ROLE_LABEL[activeContact?.role] || activeContact?.role}</div>
                </div>
              </>
            )}
            <button onClick={handleClose} className="text-white/60 hover:text-white ml-auto">
              <X size={18} />
            </button>
          </div>

          {/* ── Contacts list ── */}
          {view === 'contacts' && (
            <>
              <div className="flex-1 overflow-y-auto">
                {contacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
                    <Users size={32} className="mb-2 opacity-40" />
                    <p>No colleagues found</p>
                  </div>
                ) : (
                  Object.entries(grouped).map(([dept, members]) => (
                    <div key={dept}>
                      <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">
                        {dept}
                      </div>
                      {members.map(c => (
                        <button
                          key={c.staff_id}
                          onClick={() => openChat(c)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-50"
                        >
                          <Avatar name={c.full_name} role={c.role} size={9} presence={c.presence} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-800 truncate">{c.full_name}</div>
                            {c.branch_name && (
                              <div className="text-xs text-gray-400 truncate">{c.branch_name}</div>
                            )}
                          </div>
                          {c.unread > 0 && (
                            <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {c.unread > 9 ? '9+' : c.unread}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>

              {/* New message button */}
              <div className="p-3 border-t border-gray-100 flex-shrink-0">
                <button
                  onClick={() => setView('new')}
                  className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-colors"
                  style={{ background: '#0F2557' }}
                >
                  + New Message
                </button>
              </div>
            </>
          )}

          {/* ── New message — Branch → Dept → Person ── */}
          {view === 'new' && (
            <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
              <p className="text-xs text-gray-400">Select who you want to message</p>

              {hasBranches && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Branch</label>
                  <Select
                    value={selBranch}
                    onChange={v => { setSelBranch(v); setSelDept(''); setSelPerson('') }}
                    options={branches}
                    placeholder="All branches"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Department</label>
                <Select
                  value={selDept}
                  onChange={v => { setSelDept(v); setSelPerson('') }}
                  options={departments}
                  placeholder="All departments"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Person</label>
                <Select
                  value={selPerson}
                  onChange={setSelPerson}
                  options={personOptions}
                  placeholder="Select person"
                />
              </div>

              {/* Preview selected person */}
              {selPerson && (() => {
                const c = contacts.find(x => String(x.staff_id) === selPerson)
                return c ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
                    <Avatar name={c.full_name} role={c.role} size={9} presence={c.presence} />
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{c.full_name}</div>
                      <div className="text-xs text-gray-400">{ROLE_LABEL[c.role] || c.role}{c.branch_name ? ` · ${c.branch_name}` : ''}</div>
                    </div>
                  </div>
                ) : null
              })()}

              <button
                onClick={handleStartChat}
                disabled={!selPerson}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-colors mt-auto"
                style={{ background: '#CC1414' }}
              >
                Start Chat
              </button>
            </div>
          )}

          {/* ── Chat view ── */}
          {view === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                {messages.length === 0 && (
                  <div className="flex items-center justify-center h-full text-gray-300 text-xs">
                    Say hello to start the conversation
                  </div>
                )}
                {messages.map(msg => {
                  const isMine = msg.sender_id === myId
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="max-w-[78%] rounded-2xl px-3 py-2 text-sm break-words"
                        style={isMine
                          ? { background: '#0F2557', color: 'white', borderBottomRightRadius: 4 }
                          : { background: '#f3f4f6', color: '#1f2937', borderBottomLeftRadius: 4 }
                        }
                      >
                        {!isMine && (
                          <div className="text-xs font-semibold mb-0.5 opacity-60">{msg.sender_name}</div>
                        )}
                        <div>{msg.body}</div>
                        <div className={`text-xs mt-0.5 ${isMine ? 'text-blue-200' : 'text-gray-400'} text-right`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick shortcuts */}
              {showShortcuts && (
                <div className="px-3 pb-2 flex flex-wrap gap-1.5 border-t border-gray-100 pt-2">
                  {SHORTCUTS.map(s => (
                    <button
                      key={s.label}
                      onClick={() => { sendMsg(s.body, 'shortcut'); setShowShortcuts(false) }}
                      className="text-xs px-2.5 py-1 rounded-full border font-medium hover:bg-gray-50"
                      style={{ borderColor: '#0F2557', color: '#0F2557' }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input bar */}
              <div className="px-3 pb-3 pt-2 border-t border-gray-100 flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowShortcuts(s => !s)}
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base transition-colors"
                  style={{ background: showShortcuts ? '#0F2557' : '#f3f4f6', color: showShortcuts ? 'white' : '#6b7280' }}
                  title="Quick replies"
                >⚡</button>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(input) } }}
                  placeholder="Type a message…"
                  className="flex-1 rounded-full border border-gray-200 px-4 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  style={{ minWidth: 0 }}
                />
                <button
                  onClick={() => sendMsg(input)}
                  disabled={!input.trim() || sending}
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-40"
                  style={{ background: '#0F2557' }}
                >
                  <Send size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
