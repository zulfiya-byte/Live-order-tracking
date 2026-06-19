import { useEffect } from 'react'
import { TrackingLinks, isOverdue } from './OrderTable'

function Row({ label, value, mono }) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <dt className="text-xs font-semibold text-slate-400 flex-shrink-0">{label}</dt>
      <dd className={`text-xs text-slate-800 text-right ${mono ? 'font-mono tabular-nums' : 'font-medium'}`}>{value}</dd>
    </div>
  )
}

function Step({ done, label }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <div className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: done ? '#DCFCE7' : '#F1F5F9', border: `2px solid ${done ? '#16A34A' : '#CBD5E1'}` }}>
        {done
          ? <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          : <span className="w-2 h-2 rounded-full bg-slate-300" />}
      </div>
      <span className="text-[10px] font-semibold text-center leading-tight"
        style={{ color: done ? '#166534' : '#94A3B8' }}>{label}</span>
    </div>
  )
}

export default function OrderDetailDrawer({ order, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!order) return null

  const overdue = isOverdue(order)
  const accent = order.shipped ? '#16A34A' : overdue ? '#DC2626' : order.on_hold ? '#D97706' : '#0369A1'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="px-5 py-4 flex items-start justify-between flex-shrink-0"
          style={{ borderBottom: `2px solid ${accent}`, background: `${accent}0a` }}>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Order</p>
            <p className="text-2xl font-bold text-navy font-mono tabular-nums leading-none">#{order.order_number}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {order.shipped && <Badge bg="#DCFCE7" color="#166534">Shipped</Badge>}
              {!order.shipped && overdue && <Badge bg="#FEE2E2" color="#B91C1C">Overdue</Badge>}
              {!order.shipped && order.on_hold && <Badge bg="#FEF3C7" color="#92400E">On Hold</Badge>}
              {!order.shipped && !overdue && !order.on_hold && <Badge bg="#DBEAFE" color="#1E40AF">In Production</Badge>}
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Design name — prominent */}
          {order.design_name && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Design</p>
              <p className="text-base font-bold text-slate-800 leading-snug">{order.design_name}</p>
            </div>
          )}

          {/* Production progress */}
          {!order.shipped && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">Production Progress</p>
              <div className="flex items-start">
                <Step done={order.art_complete} label="Art" />
                <div className="flex-1 h-px mt-4 mx-1" style={{ background: order.art_complete && order.purchased ? '#16A34A' : '#E2E8F0' }} />
                <Step done={order.purchased} label="Purchased" />
                <div className="flex-1 h-px mt-4 mx-1" style={{ background: order.purchased && order.received_garments ? '#16A34A' : '#E2E8F0' }} />
                <Step done={order.received_garments} label="Garments" />
                <div className="flex-1 h-px mt-4 mx-1" style={{ background: order.received_garments && order.shipped ? '#16A34A' : '#E2E8F0' }} />
                <Step done={order.shipped} label="Shipped" />
              </div>
            </div>
          )}

          {/* Details */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Details</p>
            <dl>
              <Row label="Customer" value={order.customer} />
              <Row label="Order Type" value={order.order_type} />
              <Row label="Quantity" value={order.product_quantity} mono />
              <Row label="PXP Location" value={order.pxp_location} />
              <Row label="PXP AE" value={order.pxp_ae} />
              <Row label="PO #" value={order.purchase_order} mono />
              <Row label="Contact" value={order.order_contact} />
              <Row label="Approx PO Date" value={order.approx_po_date} mono />
              <Row label="Requested Ship" value={overdue ? `${order.request_to_ship_date} ⚠` : order.request_to_ship_date} mono />
            </dl>
          </div>

          {/* Shipping */}
          {(order.shipped || order.ship_date || order.carrier || order.tracking_number) && (
            <div className="rounded-xl px-4 py-3" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <p className="text-[10px] uppercase tracking-widest text-green-700 font-semibold mb-2">Shipping</p>
              <dl>
                <Row label="Ship Date" value={order.ship_date} mono />
                <Row label="Carrier" value={order.carrier} />
              </dl>
              {order.tracking_number && (
                <div className="pt-2">
                  <p className="text-[10px] uppercase tracking-widest text-green-700 font-semibold mb-1">Tracking</p>
                  <TrackingLinks value={order.tracking_number} />
                </div>
              )}
            </div>
          )}

          {/* Notes — full, untruncated */}
          {order.notes_to_customer && (
            <div className="rounded-xl px-4 py-3" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <p className="text-[10px] uppercase tracking-widest text-orange-600 font-semibold mb-1">Notes</p>
              <p className="text-xs text-orange-800 leading-relaxed whitespace-pre-wrap">{order.notes_to_customer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Badge({ bg, color, children }) {
  return (
    <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ background: bg, color }}>{children}</span>
  )
}
