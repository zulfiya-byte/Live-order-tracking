const BASE = ''

function headers() {
  const token = localStorage.getItem('pxp_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error('Invalid credentials')
  const data = await res.json()
  localStorage.setItem('pxp_token', data.token)
  localStorage.setItem('pxp_company', data.company_name)
  return data
}

export function logout() {
  localStorage.removeItem('pxp_token')
  localStorage.removeItem('pxp_company')
}

export async function getOrders(filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
  const res = await fetch(`${BASE}/api/orders?${params}`, { headers: headers() })
  if (res.status === 401) { logout(); window.location.href = '/login'; return }
  if (!res.ok) throw new Error(`Orders fetch failed: ${res.status}`)
  return res.json()
}

export async function getFilters() {
  const res = await fetch(`${BASE}/api/filters`, { headers: headers() })
  if (!res.ok) throw new Error('Filters fetch failed')
  return res.json()
}

export function isLoggedIn() {
  return !!localStorage.getItem('pxp_token')
}
