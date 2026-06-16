const COLS = [
  { key: 'product_quantity',     label: 'Qty' },
  { key: 'order_number',         label: 'Order #' },
  { key: 'order_type',           label: 'Order Type' },
  { key: 'pxp_location',         label: 'PXP Location' },
  { key: 'pxp_ae',               label: 'PXP AE' },
  { key: 'purchase_order',       label: 'PO #' },
  { key: 'order_contact',        label: 'Contact' },
  { key: 'design_name',          label: 'Design Name' },
  { key: 'request_to_ship_date', label: 'Ship Date' },
  { key: 'shipped',              label: 'Shipped' },
]

export default function OrderTable({ orders, loading, error }) {
  if (loading) return (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
      Loading orders…
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center text-red-500 text-sm">
      {error}
    </div>
  )

  if (!orders.length) return (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
      No orders match the current filters.
    </div>
  )

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-navy text-white">
            {COLS.map(c => (
              <th key={c.key} className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-blue-900 last:border-r-0">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((row, i) => (
            <tr
              key={`${row.order_number}-${i}`}
              className={[
                row.on_hold ? 'bg-green-100 hover:bg-green-200' : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100',
                'border-b border-gray-200 transition-colors',
              ].join(' ')}
            >
              {COLS.map(c => (
                <td key={c.key} className="px-3 py-2 whitespace-nowrap text-gray-800">
                  {c.key === 'shipped'
                    ? (row.shipped ? '✓' : '—')
                    : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
