import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getInbox, getThread, replyToThread, logout } from '../api'

function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export default function MessagesInbox() {
  const nav = useNavigate()
  const [convs, setConvs]       = useState([])
  const [selected, setSelected] = useState(null)   // client_id
  const [thread, setThread]     = useState([])
  const [reply, setReply]       = useState('')
  const [sending, setSending]   = useState(false)
  const [loading, setLoading]   = useState(true)
  const threadRef = useRef(null)

  async function loadInbox() {
    try {
      const d = await getInbox()
      setConvs(d?.conversations || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  async function openConv(clientId) {
    setSelected(clientId)
    try {
      const d = await getThread(clientId)
      setThread(d?.messages || [])
      setTimeout(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight }, 30)
      loadInbox()  // refresh unread badges
    } catch { /* ignore */ }
  }

  async function send() {
    const t = reply.trim()
    if (!t || sending || !selected) return
    setSending(true)
    try {
      await replyToThread(selected, t)
      setReply('')
      await openConv(selected)
    } catch (e) { alert(e.message) } finally { setSending(false) }
  }

  useEffect(() => { loadInbox(); const id = setInterval(loadInbox, 60000); return () => clearInterval(id) }, [])

  const selectedConv = convs.find(c => c.client_id === selected)

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#F8FAFC' }}>
      {/* Header */}
      <header className="bg-white flex-shrink-0" style={{ borderBottom: '2px solid #29ABE2', boxShadow: '0 1px 8px rgba(41,171,226,0.10)', height: 60 }}>
        <div className="flex items-center justify-between px-4 sm:px-5 h-full">
          <div className="flex items-center gap-3">
            <img src="/pxp-logo.png" alt="PXP Solutions" className="h-9 object-contain" />
            <div className="border-l border-slate-200 pl-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold leading-none mb-0.5">Messages</p>
              <p className="text-sm font-bold text-navy leading-none">Client Inbox</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard" aria-label="Dashboard" className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:border-brand hover:text-brand transition">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <button onClick={() => { logout(); nav('/login') }} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:border-brand hover:text-brand transition">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden p-3 sm:p-4 gap-3 sm:gap-4">
        {/* Conversation list */}
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden flex-1 lg:flex-none lg:w-80 ${selected ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-bold text-navy text-sm">Conversations <span className="text-slate-400 font-normal text-xs">({convs.length})</span></h2>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
            ) : convs.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No messages yet</p>
            ) : convs.map(c => (
              <button key={c.client_id} onClick={() => openConv(c.client_id)}
                className={`w-full text-left px-4 py-3 transition hover:bg-gray-50 ${selected === c.client_id ? 'bg-blue-50 border-l-2 border-brand' : 'border-l-2 border-transparent'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-navy truncate">{c.company || 'Unknown company'}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] text-slate-400">{timeAgo(c.last_at)}</span>
                    {c.unread > 0 && <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{c.unread}</span>}
                  </div>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {c.last_sender === 'staff' && <span className="text-slate-400">You: </span>}{c.last_body}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className={`flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex-col overflow-hidden ${selected ? 'flex' : 'hidden lg:flex'}`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-center text-slate-400">
              <div>
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 7l4-4h10a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12z" /></svg>
                </div>
                <p className="text-sm font-medium text-slate-600">Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
                <button onClick={() => setSelected(null)} className="lg:hidden text-brand">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div>
                  <p className="font-bold text-navy text-sm">{selectedConv?.company || 'Conversation'}</p>
                  <p className="text-xs text-slate-400">{thread.find(m => m.sender_type === 'client')?.sender_name || ''}</p>
                </div>
              </div>

              <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {thread.map(m => (
                  <div key={m.id} className={`flex ${m.sender_type === 'staff' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[75%]">
                      <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        m.sender_type === 'staff' ? 'text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}`}
                        style={m.sender_type === 'staff' ? { background: '#0369A1' } : {}}>
                        {m.order_number ? <p className={`text-[10px] font-bold mb-0.5 ${m.sender_type === 'staff' ? 'text-white/80' : 'text-brand'}`}>Re: Order #{m.order_number}</p> : null}
                        {m.body}
                      </div>
                      <p className={`text-[10px] text-slate-400 mt-0.5 ${m.sender_type === 'staff' ? 'text-right' : ''}`}>
                        {m.sender_type === 'client' ? (m.sender_name || 'Client') : 'You'} • {timeAgo(m.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={e => { e.preventDefault(); send() }} className="p-3 flex gap-2 border-t border-slate-200">
                <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Type your reply…"
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand" />
                <button type="submit" disabled={sending || !reply.trim()} className="btn-primary px-4 disabled:opacity-40">
                  {sending ? 'Sending…' : 'Reply'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
