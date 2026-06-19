import { useState, useMemo } from 'react'

// Local date (YYYY-MM-DD) — used to flag orders past their requested ship date.
export const TODAY = new Date().toISOString().slice(0, 10)

export function isOverdue(o) {
  // Closed orders (shipped / N/A / not required) can't be overdue.
  return !o.closed && o.request_to_ship_date && o.request_to_ship_date.slice(0, 10) < TODAY
}

export function trackingUrl(num) {
  const n = num.trim()
  if (/^1Z/i.test(n))          return `https://www.ups.com/track?tracknum=${n}`
  if (/^\d{12,22}$/.test(n))   return `https://www.fedex.com/apps/fedextrack/?tracknums=${n}`
  if (/^9\d{21}$/.test(n))     return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`
  return null
}

export function TrackingLinks({ value, className = '' }) {
  if (!value) return <span className="text-slate-300">—</span>
  const nums = value.split(',').map(s => s.trim()).filter(Boolean)
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      {nums.map((n, i) => {
        const url = trackingUrl(n)
        const display = n.length > 20 ? n.slice(0, 18) + '…' : n
        return url ? (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 font-mono text-xs tabular-nums transition-colors"
            style={{ color: '#1D4ED8' }}
            onMouseEnter={e => e.currentTarget.style.color = '#1E40AF'}
            onMouseLeave={e => e.currentTarget.style.color = '#1D4ED8'}
            title={n}>
            {display}
            <svg className="w-2.5 h-2.5 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ) : (
          <span key={i} className="font-mono text-xs text-slate-600 tabular-nums" title={n}>{display}</span>
        )
      })}
    </div>
  )
}

// Full field list — used for CSV export and the detail drawer.
export const COLS = [
  { key: 'product_quantity',     label: 'Qty',            type: 'num'  },
  { key: 'order_number',         label: 'Order #',        type: 'num'  },
  { key: 'order_type',           label: 'Order Type',     type: 'text' },
  { key: 'pxp_location',         label: 'PXP Location',   type: 'text' },
  { key: 'pxp_ae',               label: 'PXP AE',         type: 'text' },
  { key: 'purchase_order',       label: 'PO #',           type: 'text' },
  { key: 'order_contact',        label: 'Contact',        type: 'text' },
  { key: 'design_name',          label: 'Design Name',    type: 'design' },
  { key: 'approx_po_date',       label: 'Approx PO Date', type: 'date' },
  { key: 'request_to_ship_date', label: 'Req Ship Date',  type: 'date' },
  { key: 'on_hold',              label: 'On Hold?',       type: 'hold' },
  { key: 'art_complete',         label: 'Art Done?',      type: 'bool' },
  { key: 'purchased',            label: 'Purchased',      type: 'bool' },
  { key: 'received_garments',    label: 'Rcvd Garments',  type: 'bool' },
  { key: 'shipped',              label: 'Shipped?',       type: 'ship' },
  { key: 'ship_date',            label: 'Ship Date',      type: 'date' },
  { key: 'carrier',              label: 'Carrier',        type: 'text' },
  { key: 'tracking_number',      label: 'Tracking #',     type: 'track'},
  { key: 'notes_to_customer',    label: 'Notes',          type: 'note' },
  { key: 'customer',             label: 'Customer',       type: 'text' },
]

// Curated columns shown in the grid — the rest open in the detail drawer on click.
export const TABLE_COLS = [
  { key: 'order_number',         label: 'Order #',       type: 'num'    },
  { key: 'design_name',          label: 'Design',        type: 'design' },
  { key: 'order_type',           label: 'Order Type',    type: 'text'   },
  { key: 'request_to_ship_date', label: 'Req Ship Date', type: 'date'   },
  { key: 'status',               label: 'Status',        type: 'status', noSort: true },
  { key: 'tracking_number',      label: 'Tracking #',    type: 'track'  },
  { key: 'customer',             label: 'Customer',      type: 'text'   },
]

// Split the GROUP_CONCAT'd design string into a list.
export function parseDesigns(value) {
  return (value || '').split('||').map(s => s.trim()).filter(Boolean)
}

function compareValues(a, b, type) {
  const aNull = a == null || a === ''
  const bNull = b == null || b === ''
  if (aNull && bNull) return 0
  if (aNull) return 1
  if (bNull) return -1
  if (type === 'num') return Number(a) - Number(b)
  if (type === 'bool' || type === 'hold' || type === 'ship') return (a === b) ? 0 : a ? -1 : 1
  if (type === 'date') return String(a).localeCompare(String(b))
  return String(a).toLowerCase().localeCompare(String(b).toLowerCase())
}

function SortIcon({ active, dir }) {
  if (!active) return (
    <svg className="w-3 h-3 opacity-30 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  )
  return dir === 'asc'
    ? <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    : <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
}

function Cell({ col, row, showOverdue }) {
  const val = row[col.key]

  // Synthesized summary column — derives from the row, not a single field.
  if (col.type === 'status') {
    return <StatusBadge row={row} showOverdue={showOverdue} />
  }

  if (col.type === 'hold') {
    return val
      ? <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-dot inline-block" />
          On Hold
        </span>
      : <span className="text-slate-300 text-xs">—</span>
  }

  if (col.type === 'ship') {
    return val
      ? <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Shipped
        </span>
      : <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-xs font-medium px-2 py-0.5 rounded-full">Pending</span>
  }

  if (col.type === 'bool') {
    return val
      ? <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      : <span className="text-slate-300">—</span>
  }

  if (val == null || val === '') return <span className="text-slate-300">—</span>

  if (col.type === 'track') {
    return <TrackingLinks value={val} />
  }

  if (col.type === 'design') {
    const list = parseDesigns(val)
    if (!list.length) return <span className="text-slate-300">—</span>
    const first = list[0].length > 22 ? list[0].slice(0, 20) + '…' : list[0]
    return (
      <span title={list.join(', ')}>
        {first}
        {list.length > 1 && <span className="text-slate-400 font-medium"> +{list.length - 1}</span>}
      </span>
    )
  }

  if (col.type === 'num') {
    return <span className="font-mono tabular-nums text-slate-800 font-medium">{val}</span>
  }

  if (col.type === 'date') {
    const overdue = showOverdue && col.key === 'request_to_ship_date' && isOverdue(row)
    return (
      <span className={`font-mono tabular-nums text-[11px] ${overdue ? 'text-red-600 font-bold' : 'text-slate-600'}`}
        title={overdue ? 'Past requested ship date' : undefined}>
        {val}{overdue && ' ⚠'}
      </span>
    )
  }

  if ((col.type === 'note' || col.type === 'text') && typeof val === 'string' && val.length > 26) {
    return <span title={val} className="cursor-default">{val.slice(0, 24)}…</span>
  }

  return <span>{val}</span>
}

// ── Mobile card components ───────────────────────────────────────────────────

function StatusBadge({ row, showOverdue }) {
  if (row.shipped) return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ background: '#DCFCE7', color: '#166534' }}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Shipped
    </span>
  )
  if (row.closed) return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ background: '#F1F5F9', color: '#475569' }}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Complete
    </span>
  )
  if (showOverdue && isOverdue(row)) return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ background: '#FEE2E2', color: '#B91C1C' }}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      Overdue
    </span>
  )
  if (row.on_hold) return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ background: '#FEF3C7', color: '#92400E' }}>
      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse-dot flex-shrink-0" />
      On Hold
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ background: '#DBEAFE', color: '#1E40AF' }}>
      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse-dot flex-shrink-0" />
      In Production
    </span>
  )
}

function ProgressStep({ done, label }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <div className="w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: done ? '#DCFCE7' : '#F1F5F9', border: `2px solid ${done ? '#16A34A' : '#CBD5E1'}` }}>
        {done
          ? <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          : <span className="w-2 h-2 rounded-full bg-slate-300" />
        }
      </div>
      <span className="text-[10px] font-semibold text-center leading-tight"
        style={{ color: done ? '#166534' : '#94A3B8' }}>{label}</span>
    </div>
  )
}

function InfoPair({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-0.5">{label}</dt>
      <dd className="text-xs font-semibold text-slate-700 truncate">{value}</dd>
    </div>
  )
}

function MobileCard({ row, i, onClick, showOverdue }) {
  const overdue     = showOverdue && isOverdue(row)
  const accentColor = row.shipped ? '#16A34A' : row.closed ? '#64748B' : overdue ? '#DC2626' : row.on_hold ? '#D97706' : '#0369A1'
  const borderColor = row.shipped ? '#BBF7D0' : row.closed ? '#E2E8F0' : overdue ? '#FECACA' : row.on_hold ? '#FDE68A' : '#BFDBFE'
  const bgColor     = row.shipped ? '#F0FDF4' : row.closed ? '#F8FAFC' : overdue ? '#FEF2F2' : row.on_hold ? '#FFFBEB' : '#FFFFFF'

  return (
    <div
      onClick={onClick}
      className="rounded-2xl overflow-hidden animate-slide-up cursor-pointer active:scale-[0.99] transition-transform"
      style={{
        animationDelay: `${Math.min(i, 9) * 0.04}s`,
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5"
        style={{ borderBottom: `1px solid ${borderColor}` }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accentColor}18` }}>
            <svg className="w-4 h-4" fill="none" stroke={accentColor} strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 font-medium leading-none mb-0.5">Order</p>
            <p className="font-bold text-slate-800 tabular-nums font-mono leading-none">
              #{row.order_number}
            </p>
          </div>
        </div>
        <StatusBadge row={row} showOverdue={showOverdue} />
      </div>

      <div className="px-4 pt-3 pb-4 space-y-3">
        {/* Design name(s) — prominent */}
        {row.design_name && (
          <p className="text-sm font-bold text-slate-800 leading-snug">{parseDesigns(row.design_name).join(', ')}</p>
        )}

        {/* Info grid */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          <InfoPair label="Order Type" value={row.order_type} />
          <InfoPair label="PO #" value={row.purchase_order} />
          <InfoPair label="Qty" value={row.product_quantity} />
          <InfoPair label="Req. Ship" value={row.request_to_ship_date} />
          <InfoPair label="PXP Location" value={row.pxp_location} />
          <InfoPair label="AE" value={row.pxp_ae} />
          {row.order_contact && <InfoPair label="Contact" value={row.order_contact} />}
        </dl>

        {/* Production progress */}
        {!row.shipped && (
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-2">Production Progress</p>
            <div className="flex items-start">
              <ProgressStep done={row.art_complete} label="Art" />
              {/* Connecting line */}
              <div className="flex-1 h-px mt-3.5 mx-1"
                style={{ background: row.art_complete && row.purchased ? '#16A34A' : '#E2E8F0' }} />
              <ProgressStep done={row.purchased} label="Purchased" />
              <div className="flex-1 h-px mt-3.5 mx-1"
                style={{ background: row.purchased && row.received_garments ? '#16A34A' : '#E2E8F0' }} />
              <ProgressStep done={row.received_garments} label="Garments" />
            </div>
          </div>
        )}

        {/* Shipping info */}
        {row.shipped && (row.ship_date || row.carrier || row.tracking_number) && (
          <div className="rounded-xl px-3 py-2.5 space-y-1.5"
            style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-green-700 mb-1.5">Shipping Details</p>
            {row.ship_date && (
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-semibold text-green-800 font-mono tabular-nums">{row.ship_date}</span>
              </div>
            )}
            {row.carrier && (
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span className="text-xs font-semibold text-green-800">{row.carrier}</span>
              </div>
            )}
            {row.tracking_number && (
              <div className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
                <TrackingLinks value={row.tracking_number} className="flex-1" />
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {row.notes_to_customer && (
          <div className="rounded-xl px-3 py-2.5"
            style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-orange-600 mb-1">Note</p>
            <p className="text-xs text-orange-800 leading-relaxed">{row.notes_to_customer}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function MobileSkeletonCards() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white border border-slate-200 overflow-hidden animate-fade-in"
          style={{ animationDelay: `${i * 0.06}s` }}>
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="skeleton w-8 h-8 rounded-xl" />
              <div className="space-y-1.5">
                <div className="skeleton h-2 w-10 rounded" />
                <div className="skeleton h-3 w-16 rounded" />
              </div>
            </div>
            <div className="skeleton h-6 w-24 rounded-full" />
          </div>
          <div className="px-4 pt-3 pb-4 space-y-3">
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j}>
                  <div className="skeleton h-2 w-16 rounded mb-1" />
                  <div className="skeleton h-3 w-20 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} style={{ animationDelay: `${i * 0.04}s` }} className="animate-fade-in border-b border-slate-100">
          {TABLE_COLS.map((c, j) => (
            <td key={c.key} className="px-3 py-2.5" style={{ borderRight: '1px solid #F1F5F9' }}>
              <div className="skeleton h-3 rounded"
                style={{ width: j === 0 ? 50 : j % 3 === 0 ? 80 : j % 3 === 1 ? 120 : 70 }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export default function OrderTable({ orders, loading, error, tabKey, onRowClick, showOverdue }) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' })

  function handleSort(colKey) {
    setSort(prev =>
      prev.key === colKey
        ? prev.dir === 'asc'
          ? { key: colKey, dir: 'desc' }
          : { key: null, dir: 'asc' }
        : { key: colKey, dir: 'asc' }
    )
  }

  const sorted = useMemo(() => {
    if (!orders || !sort.key) return orders || []
    const col = COLS.find(c => c.key === sort.key)
    return [...orders].sort((a, b) => {
      const cmp = compareValues(a[sort.key], b[sort.key], col?.type)
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [orders, sort])

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) return (
    <>
      {/* Mobile skeleton */}
      <div className="md:hidden flex-1 overflow-y-auto">
        <div className="p-3 flex flex-col gap-3"><MobileSkeletonCards /></div>
      </div>
      {/* Desktop skeleton */}
      <div className="hidden md:block flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse min-w-max">
          <thead className="sticky top-0 z-10">
            <tr>
              {TABLE_COLS.map((c, i) => (
                <th key={c.key} className="px-3 py-3 text-left font-semibold whitespace-nowrap tracking-wide text-white"
                  style={{ background: '#002856', borderRight: i < TABLE_COLS.length - 1 ? '1px solid #003a7a' : 'none' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody><SkeletonRows /></tbody>
        </table>
      </div>
    </>
  )

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) return (
    <div className="flex-1 flex items-center justify-center py-20">
      <div className="text-center">
        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-red-600 text-sm font-medium">{error}</p>
      </div>
    </div>
  )

  // ── Empty ──────────────────────────────────────────────────────────────────

  if (!orders || !orders.length) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-500">No orders match the current filters</p>
      <p className="text-xs text-slate-400">Try adjusting your filter criteria</p>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Mobile card view (< md) ─────────────────────────────────────────── */}
      <div className="md:hidden flex-1 overflow-y-auto">
        <div className="p-3 flex flex-col gap-3">
          {sorted.map((row, i) => (
            <MobileCard key={`${row.order_number}-${i}`} row={row} i={i} onClick={() => onRowClick?.(row)} showOverdue={showOverdue} />
          ))}
        </div>
      </div>

      {/* ── Desktop table view (>= md) ──────────────────────────────────────── */}
      <div className="hidden md:block flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse min-w-max">
          <thead className="sticky top-0 z-10">
            <tr>
              {TABLE_COLS.map((c, i) => {
                const active = sort.key === c.key
                const sortable = !c.noSort
                return (
                  <th
                    key={c.key}
                    onClick={() => sortable && handleSort(c.key)}
                    className={`px-3 py-3 text-left font-semibold whitespace-nowrap tracking-wide text-white select-none ${sortable ? 'cursor-pointer' : ''}`}
                    style={{
                      background: active ? '#003a7a' : '#002856',
                      borderRight: i < TABLE_COLS.length - 1 ? '1px solid #003a7a' : 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (sortable && !active) e.currentTarget.style.background = '#003070' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = '#002856' }}
                    title={sortable ? `Sort by ${c.label}` : c.label}
                  >
                    <span className="flex items-center gap-1.5">
                      {c.label}
                      {sortable && <SortIcon active={active} dir={sort.dir} />}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody key={`${tabKey}-${sort.key}-${sort.dir}`}>
            {sorted.map((row, i) => (
              <tr
                key={`${row.order_number}-${i}`}
                onClick={() => onRowClick?.(row)}
                className={[row.on_hold ? 'on-hold-row' : '', 'border-b border-slate-100 transition-colors duration-100 cursor-pointer'].join(' ')}
                style={row.on_hold ? { background: '#FFFBEB' } : { background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = row.on_hold ? '#FEF3C7' : '#EFF6FF'
                  e.currentTarget.style.boxShadow = 'inset 3px 0 0 #002856'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = row.on_hold ? '#FFFBEB' : i % 2 === 0 ? '#fff' : '#F8FAFC'
                  e.currentTarget.style.boxShadow = ''
                }}
              >
                {TABLE_COLS.map(c => (
                  <td key={c.key} className="px-3 py-2.5 whitespace-nowrap text-slate-700"
                    style={{ borderRight: '1px solid #F1F5F9' }}>
                    <Cell col={c} row={row} showOverdue={showOverdue} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
