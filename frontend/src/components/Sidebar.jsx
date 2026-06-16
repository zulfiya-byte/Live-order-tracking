import { useState } from 'react'

export default function Sidebar({ orderTypes, onFilter, loading }) {
  const [filters, setFilters] = useState({
    purchase_order: '',
    order_number: '',
    order_contact: '',
    order_type: '',
    ship_date_from: '',
    ship_date_to: '',
    shipped: '',
  })

  function set(key, val) {
    setFilters(f => ({ ...f, [key]: val }))
  }

  function apply() {
    onFilter(filters)
  }

  function reset() {
    const empty = Object.fromEntries(Object.keys(filters).map(k => [k, '']))
    setFilters(empty)
    onFilter(empty)
  }

  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"
  const inputCls = "w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"

  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 p-5 flex flex-col gap-4 overflow-y-auto">
      <h2 className="font-bold text-navy text-sm uppercase tracking-widest">Filters</h2>

      <div>
        <label className={labelCls}>Purchase Order #</label>
        <input className={inputCls} value={filters.purchase_order} onChange={e => set('purchase_order', e.target.value)} placeholder="PO number…" />
      </div>

      <div>
        <label className={labelCls}>Order Number</label>
        <input className={inputCls} type="number" value={filters.order_number} onChange={e => set('order_number', e.target.value)} placeholder="e.g. 204512" />
      </div>

      <div>
        <label className={labelCls}>Order Contact</label>
        <input className={inputCls} value={filters.order_contact} onChange={e => set('order_contact', e.target.value)} placeholder="Contact name…" />
      </div>

      <div>
        <label className={labelCls}>Order Type</label>
        <select className={inputCls} value={filters.order_type} onChange={e => set('order_type', e.target.value)}>
          <option value="">All types</option>
          {orderTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className={labelCls}>Ship Date From</label>
        <input className={inputCls} type="date" value={filters.ship_date_from} onChange={e => set('ship_date_from', e.target.value)} />
      </div>

      <div>
        <label className={labelCls}>Ship Date To</label>
        <input className={inputCls} type="date" value={filters.ship_date_to} onChange={e => set('ship_date_to', e.target.value)} />
      </div>

      <div>
        <label className={labelCls}>Shipped</label>
        <select className={inputCls} value={filters.shipped} onChange={e => set('shipped', e.target.value)}>
          <option value="">All</option>
          <option value="yes">Shipped</option>
          <option value="no">Not shipped</option>
        </select>
      </div>

      <div className="flex gap-2 mt-2">
        <button onClick={apply} disabled={loading}
          className="flex-1 bg-brand hover:bg-orange-700 text-white text-sm font-semibold py-1.5 rounded transition disabled:opacity-50">
          Apply
        </button>
        <button onClick={reset}
          className="flex-1 border border-gray-300 text-gray-600 text-sm py-1.5 rounded hover:bg-gray-50 transition">
          Reset
        </button>
      </div>
    </aside>
  )
}
