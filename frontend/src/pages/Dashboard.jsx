import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { getOrders, getFilters, logout, isAdmin, isSuperAdmin, isViewAllOrders, adminGetCompanies } from '../api'
import Sidebar from '../components/Sidebar'
import OrderTable, { COLS, isOverdue, parseDesigns } from '../components/OrderTable'
import OrderDetailDrawer from '../components/OrderDetailDrawer'
import StatsBar from '../components/StatsBar'

const TABS = [
  { id: 'all',     label: 'All Orders',  count_key: 'all',     color: '#0369A1' },
  { id: 'active',  label: 'Active',      count_key: 'active',  color: '#0369A1' },
  { id: 'shipped', label: 'Shipped',     count_key: 'shipped', color: '#16A34A' },
  { id: 'onhold',  label: 'On Hold',     count_key: 'onhold',  color: '#D97706' },
  { id: 'overdue', label: 'Overdue',     count_key: 'overdue', color: '#DC2626' },
]

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))].sort()
}

function exportCSV(orders, tabLabel, company) {
  const headerRow = COLS.map(c => c.label)
  const dataRows = orders.map(o =>
    COLS.map(c => {
      const v = o[c.key]
      if (v == null) return ''
      if (typeof v === 'boolean') return v ? 'Yes' : 'No'
      if (c.key === 'design_name') return parseDesigns(v).map(d => d.name).join(', ').replace(/"/g, '""')
      return String(v).replace(/"/g, '""')
    })
  )
  const csv = [headerRow, ...dataRows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${company}-${tabLabel.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Dashboard() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const ownCompany = localStorage.getItem('pxp_company') || ''
  const admin      = isAdmin()
  const superAdmin = isSuperAdmin()
  const viewAllOrders = isViewAllOrders()

  // "View as client" deep-link: ?company=Acme scopes a super admin to that company.
  const companyParam = params.get('company') || ''

  // Super admins and viewAllOrders users default to '' = all companies; regular users always see their own
  const [viewingCompany, setViewingCompany] = useState(
    companyParam && superAdmin ? companyParam : (superAdmin || viewAllOrders ? '' : ownCompany)
  )
  const [year, setYear] = useState(CURRENT_YEAR)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [companySearch, setCompanySearch]   = useState('')
  const [companySuggestions, setCompanySuggestions] = useState([])
  const [showCompanyDrop, setShowCompanyDrop] = useState(false)
  const companyInputRef = useRef(null)

  const company = viewingCompany || ownCompany

  const [allOrders, setAllOrders]   = useState([])
  const [orderTypes, setOrderTypes] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [activeTab, setActiveTab]   = useState('all')
  const [refreshing, setRefreshing] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // For super admins: empty string = all companies; a value = filtered to that company
  const override = superAdmin ? viewingCompany : ''

  const fetchOrders = useCallback(async (filters, co) => {
    setLoading(true)
    setError('')
    try {
      const data = await getOrders(filters, co !== undefined ? co : override, year)
      if (data) setAllOrders(data.orders)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [override, year])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchOrders({})
    setRefreshing(false)
  }

  useEffect(() => {
    getFilters(override).then(d => setOrderTypes(d?.order_types || []))
    fetchOrders({})
  }, [fetchOrders, override])

  // Company autocomplete for super admins
  useEffect(() => {
    if (!superAdmin || !companySearch) { setCompanySuggestions([]); return }
    const t = setTimeout(() => {
      adminGetCompanies(companySearch).then(d => setCompanySuggestions(d?.companies || []))
    }, 200)
    return () => clearTimeout(t)
  }, [companySearch, superAdmin])

  function selectCompany(c) {
    setViewingCompany(c)       // '' = all companies
    setCompanySearch('')
    setCompanySuggestions([])
    setShowCompanyDrop(false)
    setActiveTab('all')
  }

  const displayedOrders = useMemo(() => {
    if (activeTab === 'active')  return allOrders.filter(o => !o.closed)
    if (activeTab === 'shipped') return allOrders.filter(o => o.shipped)
    if (activeTab === 'onhold')  return allOrders.filter(o => o.on_hold)
    if (activeTab === 'overdue') return allOrders.filter(isOverdue)
    return allOrders
  }, [allOrders, activeTab])

  const tabCount = useCallback((id) => {
    if (id === 'active')  return allOrders.filter(o => !o.closed).length
    if (id === 'shipped') return allOrders.filter(o => o.shipped).length
    if (id === 'onhold')  return allOrders.filter(o => o.on_hold).length
    if (id === 'overdue') return allOrders.filter(isOverdue).length
    return allOrders.length
  }, [allOrders])

  const suggestions = useMemo(() => ({
    purchase_order: unique(allOrders.map(o => o.purchase_order)),
    order_contact:  unique(allOrders.map(o => o.order_contact)),
    design_name:    unique(allOrders.flatMap(o => parseDesigns(o.design_name).map(d => d.name))),
  }), [allOrders])

  // The Overdue tab/stat/highlighting is internal-only — super admins see it, clients and company admins don't.
  const visibleTabs = superAdmin ? TABS : TABS.filter(t => t.id !== 'overdue')
  const currentTab = visibleTabs.find(t => t.id === activeTab) || visibleTabs[0]

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-white flex-shrink-0 print:hidden"
        style={{ borderBottom: '2px solid #29ABE2', boxShadow: '0 1px 8px rgba(41,171,226,0.10)' }}>
        <div className="flex items-center justify-between px-4 sm:px-5" style={{ height: 60 }}>

          {/* Logo + company */}
          <div className="flex items-center gap-3">
            <img src="/pxp-logo.png" alt="PXP Solutions" className="h-9 object-contain animate-pop-in" />
            <div className="hidden sm:block border-l border-slate-200 pl-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold leading-none mb-0.5">Order Portal</p>
              {superAdmin ? (
                <div className="relative flex items-center gap-1.5">
                  <div className="relative">
                    <input
                      ref={companyInputRef}
                      value={companySearch || (viewingCompany ? viewingCompany : '')}
                      onChange={e => { setCompanySearch(e.target.value); setShowCompanyDrop(true) }}
                      onFocus={() => { setCompanySearch(''); setShowCompanyDrop(true) }}
                      onBlur={() => setTimeout(() => { setShowCompanyDrop(false); setCompanySearch('') }, 150)}
                      className="text-sm font-bold text-navy leading-none bg-transparent border-b border-dashed border-brand/50 focus:outline-none focus:border-brand w-44 pr-4"
                      placeholder="All companies…"
                    />
                    <svg className="absolute right-0 top-0.5 w-3 h-3 text-brand pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                    {showCompanyDrop && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 w-64 max-h-56 overflow-y-auto">
                        {viewingCompany && (
                          <button type="button"
                            onMouseDown={() => selectCompany('')}
                            className="w-full text-left px-3 py-2.5 text-sm font-semibold hover:bg-purple-50 text-purple-700 transition first:rounded-t-xl">
                            All Companies
                          </button>
                        )}
                        {companySuggestions.map(c => (
                          <button key={c} type="button"
                            onMouseDown={() => selectCompany(c)}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 text-slate-700 hover:text-navy transition last:rounded-b-xl">
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {viewingCompany && (
                    <button onClick={() => selectCompany('')}
                      className="text-slate-400 hover:text-slate-600 transition flex-shrink-0" title="Clear filter">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm font-bold text-navy leading-none">{company}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Mobile: company name */}
            <p className="sm:hidden text-sm font-bold text-navy mr-1">{company}</p>

            {/* Year selector */}
            <div className="relative">
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                aria-label="Order year"
                className="text-xs font-semibold text-navy bg-white border border-slate-200 rounded-xl pl-3 pr-7 py-1.5 cursor-pointer appearance-none focus:outline-none focus:border-brand transition-colors"
              >
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              aria-label="Refresh orders"
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors disabled:opacity-40"
              style={{ color: '#0369A1' }}
              onMouseEnter={e => e.currentTarget.style.background = '#E0F5FB'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg className={`w-4.5 h-4.5 ${refreshing ? 'animate-spin' : ''}`} style={{ width: 18, height: 18 }}
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {admin && (
              <Link
                to="/admin"
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors text-white"
                style={{ background: '#0369A1' }}
                onMouseEnter={e => e.currentTarget.style.background = '#025A87'}
                onMouseLeave={e => e.currentTarget.style.background = '#0369A1'}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Admin
              </Link>
            )}

            <button
              onClick={() => { logout(); nav('/login') }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors border"
              style={{ borderColor: '#CBD5E1', color: '#64748B' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#29ABE2'; e.currentTarget.style.color = '#0369A1' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#64748B' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      {!loading && <StatsBar orders={allOrders} showOverdue={superAdmin} />}

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar — desktop only */}
        <div className="print:hidden flex-shrink-0 hidden lg:block h-full">
          <Sidebar
            orderTypes={orderTypes}
            suggestions={suggestions}
            onFilter={fetchOrders}
            loading={loading}
          />
        </div>

        <main className="flex-1 flex flex-col overflow-hidden">

          {/* ── Greeting + Tabs + toolbar ────────────────────────────── */}
          <div className="px-4 sm:px-5 pt-3 pb-0 flex-shrink-0 print:hidden bg-white"
            style={{ borderBottom: '1px solid #E2E8F0' }}>

            {/* Greeting row */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-navy">
                {greeting()},{' '}
                <span style={{ color: '#0369A1' }}>{superAdmin ? 'PXP Admin' : viewAllOrders ? 'PXP Sales' : (company || 'there')}</span>
                <span className="text-slate-400 font-normal text-xs ml-2 hidden sm:inline">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
              </p>

              {/* Mobile filter toggle */}
              <button
                onClick={() => setShowFilters(v => !v)}
                className="lg:hidden flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors"
                style={{
                  borderColor: showFilters ? '#29ABE2' : '#CBD5E1',
                  color: showFilters ? '#0369A1' : '#64748B',
                  background: showFilters ? '#E0F5FB' : 'transparent',
                }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
              </button>
            </div>

            {/* Tabs row */}
            <div className="flex items-end justify-between">
              <div className="flex items-end gap-0.5 overflow-x-auto scrollbar-hide -mb-px">
                {visibleTabs.map(tab => {
                  const count = tabCount(tab.id)
                  const active = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-semibold whitespace-nowrap rounded-t-xl transition-all flex-shrink-0"
                      style={{
                        background: active ? '#fff' : 'transparent',
                        color: active ? '#0369A1' : '#64748B',
                        borderTop: active ? '1px solid #E2E8F0' : '1px solid transparent',
                        borderLeft: active ? '1px solid #E2E8F0' : '1px solid transparent',
                        borderRight: active ? '1px solid #E2E8F0' : '1px solid transparent',
                        borderBottom: active ? '2px solid #fff' : '2px solid transparent',
                        marginBottom: active ? -1 : 0,
                        boxShadow: active ? '0 -2px 8px rgba(41,171,226,0.08)' : 'none',
                      }}
                    >
                      {tab.label}
                      {!loading && (
                        <span className="text-xs rounded-full px-1.5 py-0.5 font-bold min-w-[1.25rem] text-center tabular-nums"
                          style={{
                            background: active
                              ? tab.id === 'onhold'  ? '#FEF3C7'
                              : tab.id === 'shipped' ? '#DCFCE7'
                              : '#DBEAFE'
                              : '#F1F5F9',
                            color: active
                              ? tab.id === 'onhold'  ? '#92400E'
                              : tab.id === 'shipped' ? '#166534'
                              : '#1D4ED8'
                              : '#94A3B8',
                          }}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Export/Print — desktop */}
              <div className="hidden sm:flex items-center gap-1.5 pb-1 ml-2 flex-shrink-0">
                <button onClick={() => exportCSV(displayedOrders, currentTab.label, company)} className="btn-ghost flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  CSV
                </button>
                <button onClick={() => window.print()} className="btn-ghost flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
              </div>
            </div>
          </div>

          {/* Mobile filter drawer */}
          {showFilters && (
            <div className="lg:hidden flex-shrink-0 animate-slide-up">
              <Sidebar
                orderTypes={orderTypes}
                suggestions={suggestions}
                onFilter={(f) => { fetchOrders(f); setShowFilters(false) }}
                loading={loading}
                mobile
              />
            </div>
          )}

          {/* ── Print header ────────────────────────────────────────── */}
          <div className="hidden print:flex justify-between items-start px-4 py-4 border-b mb-2">
            <div>
              <h1 className="text-lg font-bold">{company} — {currentTab.label}</h1>
              <p className="text-sm text-gray-600">PXP Solutions Order Portal</p>
            </div>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* ── Table / Cards area ──────────────────────────────────── */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-white border-b border-slate-100 flex-shrink-0 print:hidden">
              <span className="text-xs text-slate-500 font-medium">
                {loading ? 'Loading…' : `${displayedOrders.length} order${displayedOrders.length !== 1 ? 's' : ''}`}
              </span>
              <div className="flex items-center gap-3">
                {activeTab === 'onhold' && displayedOrders.length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-dot" />
                    Requires attention
                  </span>
                )}
                {/* Mobile export */}
                <button onClick={() => exportCSV(displayedOrders, currentTab.label, company)}
                  className="sm:hidden text-xs font-medium flex items-center gap-1" style={{ color: '#0369A1' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  Export
                </button>
              </div>
            </div>

            <OrderTable orders={displayedOrders} loading={loading} error={error} tabKey={activeTab} onRowClick={setSelectedOrder} showOverdue={superAdmin} />
          </div>
        </main>
      </div>

      {/* Order detail drawer */}
      {selectedOrder && <OrderDetailDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} showOverdue={superAdmin} />}
    </div>
  )
}
