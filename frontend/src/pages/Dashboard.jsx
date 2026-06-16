import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrders, getFilters, logout } from '../api'
import Sidebar from '../components/Sidebar'
import OrderTable from '../components/OrderTable'

export default function Dashboard() {
  const nav = useNavigate()
  const company = localStorage.getItem('pxp_company') || ''

  const [orders, setOrders]         = useState([])
  const [orderTypes, setOrderTypes] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  const fetchOrders = useCallback(async (filters) => {
    setLoading(true)
    setError('')
    try {
      const data = await getOrders(filters)
      if (data) setOrders(data.orders)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    getFilters().then(d => setOrderTypes(d.order_types || []))
    fetchOrders({})
  }, [fetchOrders])

  function handleFilter(filters) {
    fetchOrders(filters)
  }

  function handleLogout() {
    logout()
    nav('/login')
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="bg-navy text-white flex items-center justify-between px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <img src="/pxp-logo.png" alt="PXP Solutions" className="h-8 object-contain brightness-0 invert" />
          <span className="text-sm font-medium opacity-75">{company}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm opacity-60">{orders.length} orders</span>
          <button
            onClick={handleLogout}
            className="text-sm border border-white/30 hover:bg-white/10 px-3 py-1 rounded transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          orderTypes={orderTypes}
          onFilter={handleFilter}
          loading={loading}
        />
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-navy font-bold text-lg">Orders</h1>
            <span className="text-xs text-gray-400 italic">Green rows = On Hold</span>
          </div>
          <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 shadow-sm flex flex-col">
            <OrderTable orders={orders} loading={loading} error={error} />
          </div>
        </main>
      </div>
    </div>
  )
}
