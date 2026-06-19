import { useState } from 'react'

const FIELD_LABELS = {
  purchase_order: 'PO #',
  order_number:   'Order #',
  order_contact:  'Contact',
  design_name:    'Design',
  order_type:     'Type',
  ship_date_from: 'Ship From',
  ship_date_to:   'Ship To',
  shipped:        'Shipped',
}

export default function Sidebar({ orderTypes, suggestions = {}, onFilter, loading, mobile }) {
  const [filters, setFilters] = useState({
    purchase_order: '',
    order_number:   '',
    order_contact:  '',
    design_name:    '',
    order_type:     '',
    ship_date_from: '',
    ship_date_to:   '',
    shipped:        '',
  })

  function set(key, val) { setFilters(f => ({ ...f, [key]: val })) }

  function clearOne(key) {
    const updated = { ...filters, [key]: '' }
    setFilters(updated)
    onFilter(updated)  // re-run search immediately so results match the visible chips
  }

  function apply() { onFilter(filters) }

  function reset() {
    const empty = Object.fromEntries(Object.keys(filters).map(k => [k, '']))
    setFilters(empty)
    onFilter(empty)
  }

  function handleKey(e) {
    if (e.key === 'Enter') apply()
  }

  const activeEntries = Object.entries(filters).filter(([, v]) => v)
  const activeCount   = activeEntries.length

  return (
    <aside className={[
      'bg-white flex flex-col overflow-hidden',
      mobile
        ? 'w-full border-b border-slate-200 max-h-[58vh]'
        : 'w-64 border-r border-slate-200 h-full',
    ].join(' ')}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="px-4 py-3.5 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1.5px solid #E2E8F0', background: '#F8FAFC' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: activeCount ? '#E0F5FB' : '#F1F5F9' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke={activeCount ? '#0369A1' : '#94A3B8'} strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <span className="font-bold text-navy text-sm">Filters</span>
          {activeCount > 0 && (
            <span className="text-xs font-bold rounded-full px-2 py-0.5 leading-none"
              style={{ background: '#0369A1', color: '#fff' }}>
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button onClick={reset}
            className="text-xs font-semibold transition-colors"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}>
            Clear all
          </button>
        )}
      </div>

      {/* ── Active filter chips ───────────────────────────────────────── */}
      {activeCount > 0 && (
        <div className="px-3 py-2 flex flex-wrap gap-1.5 flex-shrink-0"
          style={{ borderBottom: '1px solid #E2E8F0', background: '#EFF6FF' }}>
          {activeEntries.map(([k, v]) => (
            <span key={k}
              className="inline-flex items-center gap-1 text-xs font-semibold rounded-full pl-2.5 pr-1 py-1"
              style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
              <span className="opacity-60 font-normal">{FIELD_LABELS[k]}:</span>
              <span className="max-w-[80px] truncate">{k === 'shipped' ? (v === 'yes' ? 'Yes' : 'No') : v}</span>
              <button
                onClick={() => clearOne(k)}
                className="w-4 h-4 rounded-full flex items-center justify-center ml-0.5 transition"
                style={{ background: '#BFDBFE' }}
                onMouseEnter={e => e.currentTarget.style.background = '#93C5FD'}
                onMouseLeave={e => e.currentTarget.style.background = '#BFDBFE'}>
                <svg className="w-2 h-2" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Scrollable body ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3 space-y-1">

          {/* ── Search & Filter ────────────────────────────────────────── */}
          <SectionHeader icon="search" label="Search & Filter" />

          <Field label="Purchase Order #" active={!!filters.purchase_order} onClear={() => clearOne('purchase_order')}>
            <input
              list="sugg-po"
              className="filter-input"
              value={filters.purchase_order}
              onChange={e => set('purchase_order', e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search PO…"
            />
            <datalist id="sugg-po">
              {(suggestions.purchase_order || []).map(v => <option key={v} value={v} />)}
            </datalist>
          </Field>

          <Field label="Order Number" active={!!filters.order_number} onClear={() => clearOne('order_number')}>
            <input
              className="filter-input"
              type="number"
              value={filters.order_number}
              onChange={e => set('order_number', e.target.value)}
              onKeyDown={handleKey}
              placeholder="e.g. 204512"
            />
          </Field>

          <Field label="Order Contact" active={!!filters.order_contact} onClear={() => clearOne('order_contact')}>
            <input
              list="sugg-contact"
              className="filter-input"
              value={filters.order_contact}
              onChange={e => set('order_contact', e.target.value)}
              onKeyDown={handleKey}
              placeholder="Contact name…"
            />
            <datalist id="sugg-contact">
              {(suggestions.order_contact || []).map(v => <option key={v} value={v} />)}
            </datalist>
          </Field>

          <Field label="Design Name" active={!!filters.design_name} onClear={() => clearOne('design_name')}>
            <input
              list="sugg-design"
              className="filter-input"
              value={filters.design_name}
              onChange={e => set('design_name', e.target.value)}
              onKeyDown={handleKey}
              placeholder="Design name…"
            />
            <datalist id="sugg-design">
              {(suggestions.design_name || []).map(v => <option key={v} value={v} />)}
            </datalist>
          </Field>

          <Field label="Order Type" active={!!filters.order_type} onClear={() => clearOne('order_type')}>
            <select className="filter-input" value={filters.order_type} onChange={e => set('order_type', e.target.value)}>
              <option value="">All types</option>
              {orderTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          {/* ── Date Range ─────────────────────────────────────────────── */}
          <div className="pt-2">
            <SectionHeader icon="calendar" label="Date Range" />
          </div>

          <Field label="Ship Date From" active={!!filters.ship_date_from} onClear={() => clearOne('ship_date_from')}>
            <input className="filter-input" type="date" value={filters.ship_date_from}
              onChange={e => set('ship_date_from', e.target.value)} />
          </Field>

          <Field label="Ship Date To" active={!!filters.ship_date_to} onClear={() => clearOne('ship_date_to')}>
            <input className="filter-input" type="date" value={filters.ship_date_to}
              onChange={e => set('ship_date_to', e.target.value)} />
          </Field>

          {/* ── Status ─────────────────────────────────────────────────── */}
          <div className="pt-2">
            <SectionHeader icon="status" label="Status" />
          </div>

          <Field label="Shipped Status" active={!!filters.shipped} onClear={() => clearOne('shipped')}>
            <select className="filter-input" value={filters.shipped} onChange={e => set('shipped', e.target.value)}>
              <option value="">All orders</option>
              <option value="yes">Shipped only</option>
              <option value="no">Not shipped</option>
            </select>
          </Field>

        </div>
      </div>

      {/* ── Apply button ──────────────────────────────────────────────── */}
      <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1.5px solid #E2E8F0', background: '#F8FAFC' }}>
        <button
          onClick={apply}
          disabled={loading}
          className="w-full font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0284C7 100%)', color: '#fff',
            boxShadow: '0 2px 8px rgba(3,105,161,0.30)' }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 4px 16px rgba(3,105,161,0.40)' }}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(3,105,161,0.30)'}
        >
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Searching…</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {activeCount > 0 ? `Apply ${activeCount} Filter${activeCount > 1 ? 's' : ''}` : 'Apply Filters'}</>
          )}
        </button>
      </div>
    </aside>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const SECTION_ICONS = {
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  status: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
}

function SectionHeader({ icon, label }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1.5 mb-1">
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="#94A3B8" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={SECTION_ICONS[icon]} />
      </svg>
      <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{label}</span>
      <div className="flex-1 h-px" style={{ background: '#F1F5F9' }} />
    </div>
  )
}

function Field({ label, children, active, onClear }) {
  return (
    <div className="rounded-xl px-3 py-2.5 transition-all duration-150"
      style={{
        background: active ? '#EFF6FF' : '#F8FAFC',
        border: `1.5px solid ${active ? '#BFDBFE' : 'transparent'}`,
      }}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[10px] uppercase tracking-widest font-bold leading-none transition-colors"
          style={{ color: active ? '#1D4ED8' : '#94A3B8' }}>
          {label}
        </label>
        {active && onClear && (
          <button
            onClick={onClear}
            className="text-[10px] font-semibold transition-colors leading-none"
            style={{ color: '#93C5FD' }}
            onMouseEnter={e => e.currentTarget.style.color = '#3B82F6'}
            onMouseLeave={e => e.currentTarget.style.color = '#93C5FD'}>
            clear
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
