import { isOverdue } from './OrderTable'

const STATS = [
  { key: 'total',   label: 'Total',       accent: '#002856' },
  { key: 'active',  label: 'In Progress', accent: '#0369A1', pulse: true },
  { key: 'shipped', label: 'Shipped',     accent: '#16A34A' },
  { key: 'onHold',  label: 'On Hold',     accent: '#D97706' },
  { key: 'overdue', label: 'Overdue',     accent: '#DC2626', pulse: true },
]

export default function StatsBar({ orders, showOverdue }) {
  const total   = orders.length
  const active  = orders.filter(o => !o.closed).length
  const shipped = orders.filter(o => o.shipped).length
  const onHold  = orders.filter(o => o.on_hold).length
  const overdue = orders.filter(isOverdue).length
  const values  = { total, active, shipped, onHold, overdue }

  // Overdue is internal-only; clients and company admins don't see it.
  const stats = showOverdue ? STATS : STATS.filter(s => s.key !== 'overdue')

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-2 flex-shrink-0 print:hidden bg-white border-b border-slate-100">
      {stats.map((s, i) => {
        const val = values[s.key]
        return (
          <div
            key={s.key}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 animate-slide-up lift"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.pulse && val > 0 ? 'animate-pulse-dot' : ''}`}
              style={{ background: s.accent }}
            />
            <span className="text-sm font-bold tabular-nums leading-none" style={{ color: s.accent }}>{val}</span>
            <span className="text-xs text-slate-500 font-medium leading-none">{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}
