import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, X, Send, ChevronLeft, Users } from 'lucide-react'
import api from '../api/client'

const ROLE_LABEL = {
  doctor: 'Doctor', pharmacist: 'Pharmacist', receptionist: 'Receptionist',
  lab_technician: 'Lab Tech', imaging_technician: 'Imaging Tech',
  manager: 'Manager', nurse: 'Nurse',
}
const SHORTCUTS = [
  { label: '💊 Rx Ready',       body: '💊 Prescription is ready for the patient.' },
  { label: '🧪 Sample Ready',   body: '🧪 Lab sample collected and ready for testing.' },
  { label: '🩻 Report Ready',   body: '🩻 Imaging report is ready for review.' },
  { label: '📋 Patient Ready',  body: '📋 Patient is ready for consultation.' },
  { label: '💰 Bill Ready',     body: '💰 Invoice has been generated, please collect payment.' },
  { label: '⚠️ Urgent',         body: '⚠️ Urgent attention needed for this patient.' },
]

export default function ChatWidget() {
  const [open, setOpen]           = useState(false)
  const [view, setView]           = useState('contacts') // contacts | chat
  const [contacts, setContacts]   = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [activeContact, setActiveContact] = useState(null)
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [totalUnread, setTotalUnread] = useState(0)
  const [sending, setSending]     = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const messagesEndRef = useRef(null)
  const pollAbortRef   = useRef(null)
  const lastMsgIdRef   = useRef(0)
  const myStaffId      = useRef(null)

  // Decode staff id from JWT
  useEffect(() => {
    try {
      const token = sessionStorage.getItem('access_token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        myStaffId.current = payload.sub ? parseInt(payload.sub) : null
      }
    } catch {}
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Poll unread count every 30s when closed
  useEffect(() => {
    if (open) return
    const fetchUnread = () => {
      api.get('/chat/unread').then(d => setTotalUnread(d.total)).catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [open])

  // Load contacts when widget opens
  useEffect(() => {
    if (!open) return
    api.get('/chat/contacts').then(setContacts).catch(() => {})
  }, [open])

  // Long-poll loop
  const startPoll = useCallback((roomId) => {
    let running = true
    const controller = { running }
    pollAbortRef.current = controller

    const poll = async () => {
      while (controller.running) {
        try {
          const msgs = await api.get(
            `/chat/rooms/${roomId}/poll?after_id=${lastMsgIdRef.current}`
          )
          if (!controller.running) break
          if (msgs && msgs.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id))
              const newOnes = msgs.filter(m => !existingIds.has(m.id))
              if (newOnes.length === 0) return prev
              lastMsgIdRef.current = Math.max(...msgs.map(m => m.id))
              return [...prev, ...newOnes]
            })
            setTimeout(scrollToBottom, 50)
          }
        } catch {
          if (!controller.running) break
          await new Promise(r => setTimeout(r, 3000))
        }
      }
    }
    poll()
    return controller
  }, [])

  const stopPoll = () => {
    if (pollAbortRef.current) {
      pollAbortRef.current.running = false
    }
  }

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
      // Refresh contacts to reset unread badge
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
    return () => stopPoll()
  }, [])

  useEffect(() => {
    if (view === 'chat') setTimeout(scrollToBottom, 100)
  }, [messages, view])

  const groupedContacts = contacts.reduce((acc, c) => {
    const label = ROLE_LABEL[c.role] || c.role
    if (!acc[label]) acc[label] = []
    acc[label].push(c)
    return acc
  }, {})

  const myId = myStaffId.current

  return (
    <>
      {/* Floating button */}
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

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{ width: 360, height: 500, background: 'white', border: '1px solid #e5e7eb' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{ background: '#0F2557' }}>
            {view === 'chat' && (
              <button onClick={backToContacts} className="text-white/70 hover:text-white mr-1">
                <ChevronLeft size={20} />
              </button>
            )}
            {view === 'contacts' ? (
              <>
                <Users size={18} className="text-white" />
                <span className="text-white font-semibold text-sm flex-1">Team Chat</span>
              </>
            ) : (
              <>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                  style={{ background: '#CC1414' }}>
                  {activeContact?.full_name?.[0]?.toUpperCase()}
                </div>
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

          {/* Contacts view */}
          {view === 'contacts' && (
            <div className="flex-1 overflow-y-auto">
              {contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
                  <Users size={32} className="mb-2 opacity-40" />
                  <p>No colleagues found</p>
                </div>
              ) : (
                Object.entries(groupedContacts).map(([role, members]) => (
                  <div key={role}>
                    <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">
                      {role}
                    </div>
                    {members.map(c => (
                      <button
                        key={c.staff_id}
                        onClick={() => openChat(c)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50"
                      >
                        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                          style={{ background: '#0F2557' }}>
                          {c.full_name?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800 truncate">{c.full_name}</div>
                          <div className="text-xs text-gray-400">{ROLE_LABEL[c.role] || c.role}</div>
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
          )}

          {/* Chat view */}
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
                        className="max-w-[75%] rounded-2xl px-3 py-2 text-sm break-words"
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

              {/* Shortcuts */}
              {showShortcuts && (
                <div className="px-3 pb-2 flex flex-wrap gap-1.5 border-t border-gray-100 pt-2">
                  {SHORTCUTS.map(s => (
                    <button
                      key={s.label}
                      onClick={() => { sendMsg(s.body, 'shortcut'); setShowShortcuts(false) }}
                      className="text-xs px-2.5 py-1 rounded-full border font-medium transition-colors hover:bg-gray-100"
                      style={{ borderColor: '#0F2557', color: '#0F2557' }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-3 pb-3 pt-2 border-t border-gray-100 flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowShortcuts(s => !s)}
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors"
                  style={{ background: showShortcuts ? '#0F2557' : '#f3f4f6', color: showShortcuts ? 'white' : '#6b7280' }}
                  title="Quick replies"
                >
                  ⚡
                </button>
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
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white transition-opacity disabled:opacity-40"
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
