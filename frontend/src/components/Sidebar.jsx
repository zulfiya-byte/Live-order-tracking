import { useState } from 'react'

export default function Sidebar({ orderTypes, suggestions = {}, onFilter, loading }) {
  const [filters, setFilters] = useState({
    purchase_order: '',
    order_number: '',
    order_contact: '',
    design_name: '',
    order_type: '',
    ship_date_from: '',
    ship_date_to: '',
    shipped: '',
  })

  function set(key, val) {
    setFilters(f => ({ ...f, [key]: val }))
  }

  function apply() { onFilter(filters) }

  function reset() {
    const empty = Object.fromEntries(Object.keys(filters).map(k => [k, '']))
    setFilters(empty)
    onFilter(empty)
  }

  const activeCount = Object.values(filters).filter(Boolean).length

  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-navy" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="font-semibold text-navy text-sm">Filters</span>
          {activeCount > 0 && (
            <span className="bg-brand text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={reset}
            className="text-xs text-slate-400 hover:text-brand transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-5 overflow-y-auto">

        {/* ── Search & Filter ─────────────────────────────── */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Search &amp; Filter</p>
          <div className="flex flex-col gap-3.5">

            <FilterField label="Purchase Order #" active={Boolean(filters.purchase_order)}>
              <input
                list="sugg-po"
                className="input"
                value={filters.purchase_order}
                onChange={e => set('purchase_order', e.target.value)}
                placeholder="Search PO…"
              />
              <datalist id="sugg-po">
                {(suggestions.purchase_order || []).map(v => <option key={v} value={v} />)}
              </datalist>
            </FilterField>

            <FilterField label="Order Number" active={Boolean(filters.order_number)}>
              <input
                className="input"
                type="number"
                value={filters.order_number}
                onChange={e => set('order_number', e.target.value)}
                placeholder="e.g. 204512"
              />
            </FilterField>

            <FilterField label="Order Contact" active={Boolean(filters.order_contact)}>
              <input
                list="sugg-contact"
                className="input"
                value={filters.order_contact}
                onChange={e => set('order_contact', e.target.value)}
                placeholder="Contact name…"
              />
              <datalist id="sugg-contact">
                {(suggestions.order_contact || []).map(v => <option key={v} value={v} />)}
              </datalist>
            </FilterField>

            <FilterField label="Design Name" active={Boolean(filters.design_name)}>
              <input
                list="sugg-design"
                className="input"
                value={filters.design_name}
                onChange={e => set('design_name', e.target.value)}
                placeholder="Design name…"
              />
              <datalist id="sugg-design">
                {(suggestions.design_name || []).map(v => <option key={v} value={v} />)}
              </datalist>
            </FilterField>

            <FilterField label="Order Type" active={Boolean(filters.order_type)}>
              <select className="input" value={filters.order_type} onChange={e => set('order_type', e.target.value)}>
                <option value="">All types</option>
                {orderTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FilterField>

          </div>
        </div>

        {/* ── Date Range ──────────────────────────────────── */}
        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Date Range</p>
          <div className="flex flex-col gap-3.5">

            <FilterField label="Ship Date From" active={Boolean(filters.ship_date_from)}>
              <input className="input" type="date" value={filters.ship_date_from} onChange={e => set('ship_date_from', e.target.value)} />
            </FilterField>

            <FilterField label="Ship Date To" active={Boolean(filters.ship_date_to)}>
              <input className="input" type="date" value={filters.ship_date_to} onChange={e => set('ship_date_to', e.target.value)} />
            </FilterField>

          </div>
        </div>

        {/* ── Status ──────────────────────────────────────── */}
        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Status</p>

          <FilterField label="Shipped Status" active={Boolean(filters.shipped)}>
            <select className="input" value={filters.shipped} onChange={e => set('shipped', e.target.value)}>
              <option value="">All orders</option>
              <option value="yes">Shipped only</option>
              <option value="no">Not shipped</option>
            </select>
          </FilterField>
        </div>

      </div>

      {/* Apply button */}
      <div className="px-4 py-4 border-t border-slate-200 flex-shrink-0">
        <button
          onClick={apply}
          disabled={loading}
          className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          {loading ? 'Searching…' : 'Apply Filters'}
        </button>
      </div>
    </aside>
  )
}

function FilterField({ label, children, active }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: active ? '#d35e13' : '#64748B' }}>
        {label}
        {active && (
          <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block flex-shrink-0" />
        )}
      </label>
      {children}
    </div>
  )
}
