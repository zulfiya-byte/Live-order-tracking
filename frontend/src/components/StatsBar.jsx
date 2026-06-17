import { useState } from 'react'

const STATS = [
  {
    key: 'total',
    label: 'Total Orders',
    accent: '#002856',
    iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
  {
    key: 'active',
    label: 'In Progress',
    accent: '#0369A1',
    pulse: true,
    iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    key: 'shipped',
    label: 'Shipped',
    accent: '#16A34A',
    iconPath: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  },
  {
    key: 'onHold',
    label: 'On Hold',
    accent: '#D97706',
    iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
]

export default function StatsBar({ orders }) {
  const [hovered, setHovered] = useState(null)

  const total   = orders.length
  const active  = orders.filter(o => !o.shipped).length
  const shipped = orders.filter(o => o.shipped).length
  const onHold  = orders.filter(o => o.on_hold).length
  const values  = { total, active, shipped, onHold }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 sm:px-5 py-3 flex-shrink-0 print:hidden">
      {STATS.map((s, i) => {
        const isHovered = hovered === s.key
        const val = values[s.key]
        return (
          <div
            key={s.key}
            className="relative overflow-hidden rounded-xl border border-slate-200 px-5 py-4 bg-white flex items-center gap-4 animate-slide-up"
            style={{
              animationDelay: `${i * 0.07}s`,
              boxShadow: isHovered
                ? `0 8px 24px ${s.accent}2e, 0 2px 8px rgba(0,0,0,0.05)`
                : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
              transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
              transition: 'box-shadow 0.2s ease, transform 0.2s ease',
              cursor: 'default',
            }}
            onMouseEnter={() => setHovered(s.key)}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Colored left accent bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
              style={{ background: s.accent }}
            />

            {/* Icon with gradient background */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${s.accent}18, ${s.accent}2c)` }}
            >
              <svg className="w-5 h-5" fill="none" stroke={s.accent} strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={s.iconPath} />
              </svg>
            </div>

            {/* Number + label */}
            <div className="flex-1 min-w-0">
              <p
                key={val}
                className="text-2xl font-bold leading-none mb-0.5 stat-number tabular-nums"
                style={{ color: s.accent }}
              >
                {val}
              </p>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                {s.pulse && val > 0 && (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full animate-pulse-dot"
                    style={{ background: s.accent }}
                  />
                )}
                {s.label}
              </p>
            </div>

            {/* Decorative background circle */}
            <div
              className="absolute -right-4 -top-4 w-16 h-16 rounded-full"
              style={{ background: `${s.accent}0a` }}
            />
          </div>
        )
      })}
    </div>
  )
}
