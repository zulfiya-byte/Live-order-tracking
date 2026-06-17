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
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Invalid credentials' }))
    throw new Error(err.detail || 'Invalid credentials')
  }
  const data = await res.json()
  localStorage.setItem('pxp_token', data.token)
  localStorage.setItem('pxp_company', data.company_name)
  localStorage.setItem('pxp_is_admin', data.is_admin ? '1' : '')
  localStorage.setItem('pxp_is_super_admin', data.is_super_admin ? '1' : '')
  return data
}

export function logout() {
  localStorage.removeItem('pxp_token')
  localStorage.removeItem('pxp_company')
  localStorage.removeItem('pxp_is_admin')
  localStorage.removeItem('pxp_is_super_admin')
}

export function isLoggedIn() {
  return !!localStorage.getItem('pxp_token')
}

export function isAdmin() {
  return localStorage.getItem('pxp_is_admin') === '1'
}

export function isSuperAdmin() {
  return localStorage.getItem('pxp_is_super_admin') === '1'
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), ...opts })
  if (res.status === 401) { logout(); window.location.href = '/login'; return }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export async function getOrders(filters = {}, companyOverride = '') {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
  if (companyOverride) params.set('company_override', companyOverride)
  return apiFetch(`/api/orders?${params}`)
}

export async function getFilters(companyOverride = '') {
  const params = companyOverride ? `?company_override=${encodeURIComponent(companyOverride)}` : ''
  return apiFetch(`/api/filters${params}`)
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function adminGetClients() {
  return apiFetch('/api/admin/clients')
}

export async function adminCreateClient(data) {
  return apiFetch('/api/admin/clients', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function adminUpdateClient(id, data) {
  return apiFetch(`/api/admin/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function adminDeleteClient(id) {
  return apiFetch(`/api/admin/clients/${id}`, { method: 'DELETE' })
}

export async function adminGetContacts(clientId) {
  return apiFetch(`/api/admin/clients/${clientId}/contacts`)
}

export async function adminAddContact(clientId, contact_email) {
  return apiFetch(`/api/admin/clients/${clientId}/contacts`, {
    method: 'POST',
    body: JSON.stringify({ contact_email }),
  })
}

export async function adminRemoveContact(mappingId) {
  return apiFetch(`/api/admin/contacts/${mappingId}`, { method: 'DELETE' })
}

export async function adminSuggestContacts(company, q) {
  const params = new URLSearchParams({ company, q: q || '' })
  return apiFetch(`/api/admin/suggest-contacts?${params}`)
}

export async function adminGetCompanies(q = '') {
  return apiFetch(`/api/admin/companies?q=${encodeURIComponent(q)}`)
}

export async function adminResendInvite(clientId) {
  return apiFetch(`/api/admin/clients/${clientId}/resend-invite`, { method: 'POST' })
}

export async function verifyInviteToken(token) {
  return apiFetch(`/api/auth/invite/${token}`)
}

export async function setPassword(token, password) {
  return apiFetch('/api/auth/set-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}

export async function forgotPassword(email) {
  return apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function adminGetLogs(lines = 300) {
  return apiFetch(`/api/admin/logs?lines=${lines}`)
}

export async function adminBustCache() {
  return apiFetch('/api/admin/cache/bust', { method: 'POST' })
}

export async function adminGetCacheInfo() {
  return apiFetch('/api/admin/cache')
}
