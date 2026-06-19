import { useState, useEffect, useRef } from 'react'
import { isOverdue, parseDesigns } from './OrderTable'
import { sendMessage, getMyMessages } from '../api'

// ── Rule-based answer engine (no API, no AI) ──────────────────────────────────

function orderStatusText(o) {
  if (o.shipped) return o.ship_date ? `Shipped on ${o.ship_date}` : 'Shipped'
  if (o.closed) return 'Complete'
  if (o.on_hold) return 'On hold'
  if (isOverdue(o)) return 'Overdue (past requested ship date)'
  return 'In production'
}

function describeOrder(o) {
  const designs = parseDesigns(o.design_name).map(d => d.name)
  const lines = [
    `Order #${o.order_number}${o.customer ? ` — ${o.customer}` : ''}`,
    `Status: ${orderStatusText(o)}`,
  ]
  if (designs.length) lines.push(`Design${designs.length > 1 ? 's' : ''}: ${designs.join(', ')}`)
  if (o.request_to_ship_date) lines.push(`Requested ship: ${o.request_to_ship_date}`)
  if (o.pxp_ae) lines.push(`AE: ${o.pxp_ae}`)
  if (o.tracking_number) lines.push(`Tracking: ${o.tracking_number}`)
  return lines.join('\n')
}

function botAnswer(raw, orders) {
  const q = (raw || '').toLowerCase().trim()
  if (!q) return "Ask me about an order number, your open orders, or tap “Message my AE.”"

  // greeting / help
  if (/^(hi|hey|hello|help|yo|start)\b/.test(q)) {
    return "Hi! I can help with your orders. Try:\n• “Status of order 204512”\n• “How many open orders?”\n• “Who is my AE?”\nOr tap “Message my AE” to reach your rep."
  }

  // order number lookup
  const m = q.match(/\b(\d{4,})\b/)
  if (m) {
    const num = Number(m[1])
    const o = orders.find(x => Number(x.order_number) === num)
    return o ? describeOrder(o) : `I can't find order #${num} in your current view. It may be from another year — try the year selector, or message your AE.`
  }

  const count = (fn) => orders.filter(fn).length
  // counts
  if (/(how many|number of|count)/.test(q) || /\b(open|active|shipped|hold|overdue|total)\b/.test(q)) {
    if (/overdue/.test(q))                      return `You have ${count(isOverdue)} overdue order(s).`
    if (/shipped|delivered/.test(q))            return `${count(o => o.shipped)} of your ${orders.length} orders are shipped.`
    if (/hold/.test(q))                         return `${count(o => o.on_hold)} order(s) are on hold.`
    if (/(open|active|progress|production)/.test(q)) return `You have ${count(o => !o.closed)} order(s) in progress.`
    if (/total|all/.test(q))                    return `You have ${orders.length} orders in the current view.`
  }

  // tracking
  if (/(track|where|shipment|deliver)/.test(q)) {
    return "Open any order to see its live UPS tracking, or give me an order number (e.g. “track 204512”) and I'll show its status."
  }

  // AE / rep
  if (/(my ae|who.*(ae|rep|contact)|account exec|sales rep)/.test(q)) {
    const aes = [...new Set(orders.map(o => o.pxp_ae).filter(Boolean))]
    if (!aes.length) return "I don't see an AE on your orders yet. Tap “Message my AE” and our team will help."
    return aes.length === 1 ? `Your AE is ${aes[0]}.` : `Your orders are handled by: ${aes.join(', ')}.`
  }

  // glossary
  if (/on hold/.test(q))     return "“On hold” means production is paused, usually waiting on art approval or info. Your AE can tell you why."
  if (/in production/.test(q)) return "“In production” means your order is being worked on (art, purchasing, printing) and hasn't shipped yet."
  if (/art|proof|mockup/.test(q)) return "Art status shows whether your design has been finalized. Open an order to see Art / Purchased / Received / Shipped."

  return "I'm not sure about that one. You can ask about a specific order number, your open/shipped/on-hold counts, or tap “Message my AE” and a real person will help."
}

const QUICK_REPLIES = ['My open orders', 'Who is my AE?', 'How many shipped?', 'Track an order']

// ── Widget ────────────────────────────────────────────────────────────────────

export default function ChatWidget({ orders = [] }) {
  const [open, setOpen]   = useState(false)
  const [tab, setTab]     = useState('help')   // 'help' | 'ae'
  const [chat, setChat]   = useState([{ from: 'bot', text: "Hi! I'm the PXP helper. Ask me about your orders, or message your AE anytime." }])
  const [input, setInput] = useState('')

  // AE messaging
  const [thread, setThread]   = useState([])
  const [aeInput, setAeInput] = useState('')
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [unread, setUnread]   = useState(0)

  const bodyRef = useRef(null)
  const aeRef   = useRef(null)

  function scrollSoon(ref) {
    setTimeout(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, 30)
  }

  function ask(text) {
    const t = text.trim()
    if (!t) return
    setChat(c => [...c, { from: 'user', text: t }, { from: 'bot', text: botAnswer(t, orders) }])
    setInput('')
    scrollSoon(bodyRef)
  }

  async function loadThread() {
    setLoadingThread(true)
    try {
      const d = await getMyMessages()
      setThread(d?.messages || [])
      setUnread(0)
      scrollSoon(aeRef)
    } catch { /* ignore */ } finally { setLoadingThread(false) }
  }

  async function send() {
    const t = aeInput.trim()
    if (!t || sending) return
    setSending(true)
    try {
      await sendMessage(t)
      setAeInput('')
      await loadThread()
    } catch (e) { alert(e.message) } finally { setSending(false) }
  }

  // Poll unread count for the AE tab badge while closed
  useEffect(() => {
    let active = true
    async function check() {
      try {
        const d = await getMyMessages()
        if (active) setUnread((d?.messages || []).filter(m => m.sender_type === 'staff' && !m.read_client).length)
      } catch { /* ignore */ }
    }
    check()
    const id = setInterval(check, 60000)
    return () => { active = false; clearInterval(id) }
  }, [])

  useEffect(() => { if (open && tab === 'ae') loadThread() }, [open, tab])

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open help and messages"
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95 print:hidden"
        style={{ background: 'linear-gradient(135deg, #0369A1, #0284C7)', boxShadow: '0 6px 24px rgba(3,105,161,0.45)' }}
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 11-3.6-7.2L21 3v9z" />
          </svg>
        )}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
            {unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-40 w-[92vw] max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-slide-up print:hidden"
          style={{ height: 'min(560px, 75vh)' }}>
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2.5 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0369A1, #0284C7)' }}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-3.6-7.2L21 3v9z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-none">PXP Assistant</p>
              <p className="text-white/70 text-[11px] leading-none mt-0.5">Answers instantly • reach your AE</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 flex-shrink-0">
            {[['help', 'Help'], ['ae', 'My AE']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex-1 py-2.5 text-xs font-bold transition-colors relative"
                style={{ color: tab === id ? '#0369A1' : '#94A3B8' }}>
                {label}
                {id === 'ae' && unread > 0 && <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px]">{unread}</span>}
                {tab === id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: '#0369A1' }} />}
              </button>
            ))}
          </div>

          {/* Help tab */}
          {tab === 'help' && (
            <>
              <div ref={bodyRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50">
                {chat.map((m, i) => (
                  <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                      m.from === 'user' ? 'bg-brand text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}`}
                      style={m.from === 'user' ? { background: '#0369A1' } : {}}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 pt-2 flex flex-wrap gap-1.5 flex-shrink-0 bg-slate-50">
                {QUICK_REPLIES.map(q => (
                  <button key={q} onClick={() => ask(q)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand transition">
                    {q}
                  </button>
                ))}
              </div>
              <form onSubmit={e => { e.preventDefault(); ask(input) }} className="p-3 flex gap-2 flex-shrink-0 bg-slate-50">
                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about your orders…"
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-brand" />
                <button type="submit" className="btn-primary px-3" aria-label="Send">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </form>
            </>
          )}

          {/* My AE tab */}
          {tab === 'ae' && (
            <>
              <div ref={aeRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50">
                {loadingThread ? (
                  <p className="text-xs text-slate-400 text-center py-6">Loading…</p>
                ) : thread.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 7l4-4h10a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-600">Message your PXP team</p>
                    <p className="text-xs text-slate-400 mt-1">Ask about an order, request a change, or get an update. Your AE will reply here.</p>
                  </div>
                ) : (
                  thread.map(m => (
                    <div key={m.id} className={`flex ${m.sender_type === 'client' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                        m.sender_type === 'client' ? 'text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}`}
                        style={m.sender_type === 'client' ? { background: '#0369A1' } : {}}>
                        {m.sender_type === 'staff' && <p className="text-[10px] font-bold text-brand mb-0.5">PXP Team</p>}
                        {m.body}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={e => { e.preventDefault(); send() }} className="p-3 flex gap-2 flex-shrink-0 bg-slate-50 border-t border-slate-100">
                <input value={aeInput} onChange={e => setAeInput(e.target.value)} placeholder="Write a message to your AE…"
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-brand" />
                <button type="submit" disabled={sending || !aeInput.trim()} className="btn-primary px-3 disabled:opacity-40" aria-label="Send message">
                  {sending
                    ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg>}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
}
