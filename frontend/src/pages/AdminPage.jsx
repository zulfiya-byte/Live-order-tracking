import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  logout, isSuperAdmin,
  adminGetClients, adminCreateClient, adminUpdateClient, adminDeleteClient,
  adminGetContacts, adminAddContact, adminRemoveContact,
  adminSuggestContacts, adminGetCompanies, adminResendInvite,
  adminGetLogs, adminBustCache, adminGetCacheInfo,
  adminGetAeAccess, adminAddAeAccess, adminRemoveAeAccess, adminSuggestAes,
  adminGetCompanyAccess, adminAddCompanyAccess, adminRemoveCompanyAccess,
} from '../api'

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-emerald-600',
  'bg-rose-600',  'bg-amber-600',  'bg-cyan-600',
]

function avatarColor(str = '') {
  let n = 0
  for (const c of str) n += c.charCodeAt(0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

function initials(email = '') {
  const parts = email.split('@')[0].split(/[._-]/)
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('')
}

// ── Add Client Modal ──────────────────────────────────────────────────────────

function AddClientModal({ onSave, onClose, onUpdateClient }) {
  const [form, setForm]                   = useState({ email: '', company_name: '', is_admin: false, password: '' })
  const [isSuperAdmin_, setIsSuperAdmin_] = useState(false)
  const [isViewAll_, setIsViewAll_]       = useState(false)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')
  const [inviteUrl, setInviteUrl]         = useState('')
  const [copied, setCopied]               = useState(false)
  const [companySuggestions, setCompanySuggestions] = useState([])
  const [showCompanyDrop, setShowCompanyDrop]       = useState(false)
  // Contact access
  const [contacts, setContacts]           = useState([])
  const [contactInput, setContactInput]   = useState('')
  const [contactSuggestions, setContactSuggestions] = useState([])
  const [showContactDrop, setShowContactDrop]       = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function toggleSuperAdmin(checked) {
    setIsSuperAdmin_(checked)
    if (checked) {
      setIsViewAll_(false)
      setForm(f => ({ ...f, company_name: 'PXP Solutions', is_admin: true }))
      setContacts([])
    } else {
      setForm(f => ({ ...f, company_name: '', is_admin: false }))
    }
  }

  function toggleViewAll(checked) {
    setIsViewAll_(checked)
    setForm(f => ({ ...f, company_name: '', is_admin: false }))
    if (checked) setContacts([])
  }

  // Company autocomplete
  useEffect(() => {
    if (!form.company_name) { setCompanySuggestions([]); return }
    const t = setTimeout(() => {
      adminGetCompanies(form.company_name).then(d => setCompanySuggestions(d?.companies || []))
    }, 200)
    return () => clearTimeout(t)
  }, [form.company_name])

  // Contact autocomplete — only when company is selected
  useEffect(() => {
    if (!contactInput || !form.company_name) { setContactSuggestions([]); return }
    const t = setTimeout(() => {
      adminSuggestContacts(form.company_name, contactInput)
        .then(d => setContactSuggestions(d?.contacts || []))
    }, 250)
    return () => clearTimeout(t)
  }, [contactInput, form.company_name])

  function addContact(name) {
    const trimmed = name.trim()
    if (trimmed && !contacts.includes(trimmed)) setContacts(c => [...c, trimmed])
    setContactInput('')
    setContactSuggestions([])
    setShowContactDrop(false)
  }

  function removeContact(name) {
    setContacts(c => c.filter(x => x !== name))
  }

  async function submit(e) {
    e.preventDefault()
    if (form.password && form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setSaving(true)
    setError('')
    try {
      const result = await onSave(form)
      if (result?.id) {
        if (isSuperAdmin_) {
          await onUpdateClient(result.id, { is_super_admin: true })
        } else if (isViewAll_) {
          await onUpdateClient(result.id, { view_all_orders: true })
        }
        if (contacts.length > 0) {
          await Promise.all(contacts.map(c => adminAddContact(result.id, c)))
        }
      }
      if (result?.invite_url) {
        if (result?.email_error) {
          setError('Email could not be sent — copy the invite link below and send it manually.')
        }
        setInviteUrl(result.invite_url)
        return
      }
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="font-bold text-navy text-base">Invite New Client</h2>
            <p className="text-xs text-slate-500 mt-0.5">They'll receive an email to create their own password</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">

          {/* ── Super Admin toggle ────────────────────────────────── */}
          <button
            type="button"
            onClick={() => toggleSuperAdmin(!isSuperAdmin_)}
            className="w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all"
            style={{
              background: isSuperAdmin_ ? '#F5F3FF' : '#F8FAFC',
              border: `1.5px solid ${isSuperAdmin_ ? '#C4B5FD' : '#E2E8F0'}`,
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: isSuperAdmin_ ? '#7C3AED' : '#E2E8F0' }}>
                <svg className="w-4 h-4" fill="none" stroke={isSuperAdmin_ ? '#fff' : '#94A3B8'} strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: isSuperAdmin_ ? '#5B21B6' : '#374151' }}>
                  Super Admin
                </p>
                <p className="text-xs" style={{ color: isSuperAdmin_ ? '#7C3AED' : '#9CA3AF' }}>
                  {isSuperAdmin_ ? 'Full access to all companies and orders' : 'Grant access to every order across all companies'}
                </p>
              </div>
            </div>
            <div className="w-10 h-6 rounded-full flex-shrink-0 flex items-center px-0.5 transition-all"
              style={{ background: isSuperAdmin_ ? '#7C3AED' : '#D1D5DB' }}>
              <div className="w-5 h-5 bg-white rounded-full shadow transition-all"
                style={{ transform: isSuperAdmin_ ? 'translateX(16px)' : 'translateX(0)' }} />
            </div>
          </button>

          {/* ── Internal PXP Staff toggle — only when Super Admin is off ── */}
          {!isSuperAdmin_ && (
            <button
              type="button"
              onClick={() => toggleViewAll(!isViewAll_)}
              className="w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all"
              style={{
                background: isViewAll_ ? '#F5F3FF' : '#F8FAFC',
                border: `1.5px solid ${isViewAll_ ? '#C4B5FD' : '#E2E8F0'}`,
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: isViewAll_ ? '#7C3AED' : '#E2E8F0' }}>
                  <svg className="w-4 h-4" fill="none" stroke={isViewAll_ ? '#fff' : '#94A3B8'} strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold" style={{ color: isViewAll_ ? '#5B21B6' : '#374151' }}>
                    Internal PXP Staff
                  </p>
                  <p className="text-xs" style={{ color: isViewAll_ ? '#7C3AED' : '#9CA3AF' }}>
                    {isViewAll_ ? 'Can see orders across all companies (AE-filtered)' : 'Grant sales team / AE access to all companies'}
                  </p>
                </div>
              </div>
              <div className="w-10 h-6 rounded-full flex-shrink-0 flex items-center px-0.5 transition-all"
                style={{ background: isViewAll_ ? '#7C3AED' : '#D1D5DB' }}>
                <div className="w-5 h-5 bg-white rounded-full shadow transition-all"
                  style={{ transform: isViewAll_ ? 'translateX(16px)' : 'translateX(0)' }} />
              </div>
            </button>
          )}

          {/* ── Account info ──────────────────────────────────────── */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Account</p>
            <div className="space-y-3">
              <div>
                <label className="label">Client email address</label>
                <input type="email" required className="input" value={form.email}
                  onChange={e => set('email', e.target.value)} placeholder="jane@company.com" autoFocus />
              </div>

              {!isSuperAdmin_ && (
                <div className="relative">
                  <label className="label">Company name</label>
                  <input
                    required
                    className="input"
                    value={form.company_name}
                    onChange={e => { set('company_name', e.target.value); setShowCompanyDrop(true); setContacts([]) }}
                    onFocus={() => setShowCompanyDrop(true)}
                    onBlur={() => setTimeout(() => setShowCompanyDrop(false), 150)}
                    placeholder="Type to search companies…"
                    autoComplete="off"
                  />
                  {showCompanyDrop && companySuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-md z-30 max-h-48 overflow-y-auto">
                      {companySuggestions.map(c => (
                        <button key={c} type="button"
                          onMouseDown={() => { set('company_name', c); setShowCompanyDrop(false); setContacts([]) }}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 text-slate-700 hover:text-navy transition first:rounded-t-xl last:rounded-b-xl">
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!isSuperAdmin_ && !isViewAll_ && (
                <div className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-2.5">
                  <input type="checkbox" id="is_admin" checked={form.is_admin}
                    onChange={e => set('is_admin', e.target.checked)} className="w-4 h-4 accent-brand rounded" />
                  <label htmlFor="is_admin" className="text-sm text-slate-700 cursor-pointer select-none">
                    Grant admin panel access
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* ── Order access — hidden for super admins and view_all users ── */}
          {!isSuperAdmin_ && !isViewAll_ && (
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-start justify-between mb-1">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Order Access</p>
              {contacts.length === 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: '#DCFCE7', color: '#166534' }}>All orders</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              {contacts.length === 0
                ? 'By default this client sees all orders for their company. Add specific contacts below to restrict access.'
                : `This client will only see orders where the contact name matches:`}
            </p>

            {contacts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {contacts.map(name => (
                  <div key={name} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-full pl-3 pr-1.5 py-1">
                    <span className="text-xs font-medium">{name}</span>
                    <button type="button" onClick={() => removeContact(name)}
                      className="w-4 h-4 rounded-full bg-blue-200 hover:bg-blue-400 text-blue-800 hover:text-white transition flex items-center justify-center">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative flex gap-2">
              <div className="flex-1 relative">
                <input
                  value={contactInput}
                  onChange={e => { setContactInput(e.target.value); setShowContactDrop(true) }}
                  onFocus={() => setShowContactDrop(true)}
                  onBlur={() => setTimeout(() => setShowContactDrop(false), 150)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), contactInput.trim() && addContact(contactInput))}
                  placeholder={form.company_name ? 'Search contacts…' : 'Select a company first'}
                  disabled={!form.company_name}
                  className="input disabled:opacity-50"
                />
                {showContactDrop && contactSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-md z-20 max-h-40 overflow-y-auto">
                    {contactSuggestions.filter(s => !contacts.includes(s)).map(s => (
                      <button key={s} type="button"
                        onMouseDown={() => addContact(s)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 text-slate-700 hover:text-navy transition first:rounded-t-xl last:rounded-b-xl">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button"
                disabled={!contactInput.trim()}
                onClick={() => addContact(contactInput)}
                className="btn-ghost px-3 disabled:opacity-40">
                Add
              </button>
            </div>
          </div>
          )}

          {/* Invite link — shown after account is created */}
          {inviteUrl ? (
            <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid #BBF7D0' }}>
              <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: '#F0FDF4' }}>
                <svg className="w-4 h-4 flex-shrink-0 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs font-semibold text-green-800">Account created — copy and send this link to the client</p>
              </div>
              <div className="px-3 py-2.5 bg-white flex items-center gap-2">
                <p className="text-xs text-slate-500 font-mono truncate flex-1">{inviteUrl}</p>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                  className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  style={{ background: copied ? '#F0FDF4' : '#EFF6FF', color: copied ? '#16A34A' : '#2563EB' }}
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <p className="px-3 pb-2.5 text-xs text-slate-400">Link expires in 72 hours.</p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: '#E0F5FB', border: '1px solid #BAE6FD' }}>
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="#0369A1" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-xs leading-relaxed" style={{ color: '#0369A1' }}>
                An invite link will be generated. Copy and send it to the client — expires after <strong>72 hours</strong>.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-ghost py-2.5">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-1.5">
              {saving
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Sending…</>
                : <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Send Invite
                  </>
              }
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

// ── Contact Tag ───────────────────────────────────────────────────────────────

function ContactTag({ contact, onRemove }) {
  return (
    <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-full pl-3 pr-1.5 py-1">
      <span className="text-xs font-medium">{contact.contact_name}</span>
      <button
        onClick={() => onRemove(contact.id)}
        className="w-4 h-4 rounded-full bg-blue-200 hover:bg-blue-400 text-blue-800 hover:text-white transition flex items-center justify-center flex-shrink-0"
      >
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const nav = useNavigate()
  const superAdmin = isSuperAdmin()
  const [clients, setClients]           = useState([])
  const [selectedId, setSelectedId]     = useState(null)
  const [contacts, setContacts]         = useState([])
  const [companies, setCompanies]       = useState([])
  const [companyInput, setCompanyInput] = useState('')
  const [suggestions, setSuggestions]   = useState([])
  const [contactInput, setContactInput] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editPassword, setEditPassword] = useState('')
  const [showPwForm, setShowPwForm]     = useState(false)
  const [resendLink, setResendLink]     = useState('')
  const [resendCopied, setResendCopied] = useState(false)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [saving, setSaving]             = useState(false)
  const [resending, setResending]       = useState(false)
  const [editingCompany, setEditingCompany] = useState(false)
  const [companyDraft, setCompanyDraft]     = useState('')
  const [editingEmail, setEditingEmail]     = useState(false)
  const [emailDraft, setEmailDraft]         = useState('')
  const [companySuggestionsEdit, setCompanySuggestionsEdit] = useState([])
  const [showCompanyEditDrop, setShowCompanyEditDrop]       = useState(false)
  const inputRef = useRef(null)
  const [showLogs, setShowLogs]       = useState(false)
  const [logLines, setLogLines]       = useState([])
  const [logLoading, setLogLoading]   = useState(false)
  const [cacheInfo, setCacheInfo]     = useState(null)
  const [bustingCache, setBustingCache] = useState(false)
  const [mobileShowDetail, setMobileShowDetail] = useState(false)
  const [aeAccess, setAeAccess]           = useState([])
  const [aeInput, setAeInput]             = useState('')
  const [aeSuggestions, setAeSuggestions] = useState([])
  const [showAeDropdown, setShowAeDropdown] = useState(false)
  const [companyAccess, setCompanyAccess] = useState([])
  const [companyAccessInput, setCompanyAccessInput] = useState('')
  const [companyAccessSuggestions, setCompanyAccessSuggestions] = useState([])
  const [showCompanyAccessDrop, setShowCompanyAccessDrop] = useState(false)

  const selected = clients.find(c => c.id === selectedId) || null

  async function fetchClients() {
    const data = await adminGetClients()
    if (data) setClients(data.clients)
  }

  useEffect(() => {
    fetchClients()
    adminGetCompanies('').then(d => setCompanies(d?.companies || []))
  }, [])

  useEffect(() => {
    setEditingCompany(false)
    setCompanyDraft('')
    setEditingEmail(false)
    setEmailDraft('')
    setResendLink('')
    setResendCopied(false)
    if (!selectedId) { setContacts([]); setAeAccess([]); setCompanyAccess([]); setMobileShowDetail(false); return }
    adminGetContacts(selectedId).then(d => setContacts(d?.contacts || []))
    adminGetAeAccess(selectedId).then(d => setAeAccess(d?.ae_access || []))
    adminGetCompanyAccess(selectedId).then(d => setCompanyAccess(d?.company_access || []))
  }, [selectedId])

  useEffect(() => {
    if (!contactInput || !selected) { setSuggestions([]); return }
    const timer = setTimeout(() => {
      adminSuggestContacts(selected.company_name, contactInput)
        .then(d => setSuggestions(d?.contacts || []))
    }, 250)
    return () => clearTimeout(timer)
  }, [contactInput, selected])

  async function handleAddContact() {
    if (!contactInput.trim() || !selectedId) return
    try {
      await adminAddContact(selectedId, contactInput.trim())
      setContactInput('')
      setSuggestions([])
      const data = await adminGetContacts(selectedId)
      setContacts(data?.contacts || [])
      await fetchClients()
    } catch (e) {
      alert(e.message)
    }
  }

  async function handleRemoveContact(mappingId) {
    await adminRemoveContact(mappingId)
    setContacts(c => c.filter(x => x.id !== mappingId))
    await fetchClients()
  }

  async function handleToggleAdmin(client) {
    await adminUpdateClient(client.id, { is_admin: !client.is_admin })
    await fetchClients()
  }

  useEffect(() => {
    if (!editingCompany || !companyDraft) { setCompanySuggestionsEdit([]); return }
    const t = setTimeout(() => {
      adminGetCompanies(companyDraft).then(d => setCompanySuggestionsEdit(d?.companies || []))
    }, 200)
    return () => clearTimeout(t)
  }, [companyDraft, editingCompany])

  async function handleSaveCompany() {
    if (!companyDraft.trim() || companyDraft === selected?.company_name) { setEditingCompany(false); return }
    try {
      await adminUpdateClient(selectedId, { company_name: companyDraft.trim() })
      setEditingCompany(false)
      setCompanyDraft('')
      await fetchClients()
    } catch (e) {
      alert(e.message)
    }
  }

  async function handleSaveEmail() {
    const next = emailDraft.trim()
    if (!next || next === selected?.email) { setEditingEmail(false); return }
    try {
      await adminUpdateClient(selectedId, { email: next })
      setEditingEmail(false)
      setEmailDraft('')
      await fetchClients()
    } catch (e) {
      alert(e.message)
    }
  }

  async function handleToggleSuperAdmin(client) {
    if (!client.is_super_admin &&
        !confirm(`Grant Super Admin to ${client.email}?\n\nThey will be able to see and manage ALL companies, orders, and clients.`)) {
      return
    }
    await adminUpdateClient(client.id, { is_super_admin: !client.is_super_admin })
    await fetchClients()
  }

  function handleViewAsClient(client) {
    nav(`/dashboard?company=${encodeURIComponent(client.company_name)}`)
  }

  useEffect(() => {
    if (!aeInput) { setAeSuggestions([]); return }
    const t = setTimeout(() => {
      adminSuggestAes(aeInput).then(d => setAeSuggestions(d?.aes || []))
    }, 250)
    return () => clearTimeout(t)
  }, [aeInput])

  useEffect(() => {
    if (!companyAccessInput) { setCompanyAccessSuggestions([]); return }
    const t = setTimeout(() => {
      adminGetCompanies(companyAccessInput).then(d => setCompanyAccessSuggestions(d?.companies || []))
    }, 250)
    return () => clearTimeout(t)
  }, [companyAccessInput])

  async function handleAddAeAccess() {
    if (!aeInput.trim() || !selectedId) return
    try {
      await adminAddAeAccess(selectedId, aeInput.trim())
      setAeInput('')
      setAeSuggestions([])
      const data = await adminGetAeAccess(selectedId)
      setAeAccess(data?.ae_access || [])
      await fetchClients()
    } catch (e) { alert(e.message) }
  }

  async function handleRemoveAeAccess(mappingId) {
    await adminRemoveAeAccess(mappingId)
    setAeAccess(a => a.filter(x => x.id !== mappingId))
    await fetchClients()
  }

  async function handleAddCompanyAccess() {
    if (!companyAccessInput.trim() || !selectedId) return
    try {
      await adminAddCompanyAccess(selectedId, companyAccessInput.trim())
      setCompanyAccessInput('')
      setCompanyAccessSuggestions([])
      const data = await adminGetCompanyAccess(selectedId)
      setCompanyAccess(data?.company_access || [])
    } catch (e) { alert(e.message) }
  }

  async function handleRemoveCompanyAccess(mappingId) {
    await adminRemoveCompanyAccess(mappingId)
    setCompanyAccess(a => a.filter(x => x.id !== mappingId))
    await fetchClients()
  }

  async function handleToggleViewAllOrders(client) {
    await adminUpdateClient(client.id, { view_all_orders: !client.view_all_orders })
    await fetchClients()
  }

  async function handleDeleteClient(id) {
    if (!confirm('Delete this client? This cannot be undone.')) return
    await adminDeleteClient(id)
    if (selectedId === id) { setSelectedId(null); setMobileShowDetail(false) }
    await fetchClients()
  }

  async function handleResendInvite() {
    setResending(true)
    setResendLink('')
    try {
      const result = await adminResendInvite(selectedId)
      setResendLink(result?.invite_url || '')
      await fetchClients()
    } catch (e) {
      alert(e.message)
    } finally {
      setResending(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await adminUpdateClient(selectedId, { password: editPassword })
      setEditPassword('')
      setShowPwForm(false)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const filteredClients = clients.filter(c => {
    const matchesSearch = !search ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.company_name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || c.invite_status === statusFilter
    return matchesSearch && matchesStatus
  })

  const STATUS_FILTERS = [
    { id: 'all',     label: 'All' },
    { id: 'active',  label: 'Active' },
    { id: 'pending', label: 'Pending' },
    { id: 'expired', label: 'Expired' },
  ]

  function handleLogout() { logout(); nav('/login') }

  async function loadLogs() {
    setLogLoading(true)
    try {
      const [logsData, cacheData] = await Promise.all([adminGetLogs(300), adminGetCacheInfo()])
      setLogLines(logsData?.lines || [])
      setCacheInfo(cacheData?.cache || {})
    } catch (e) {
      setLogLines([`Error loading logs: ${e.message}`])
    } finally {
      setLogLoading(false)
    }
  }

  async function handleBustCache() {
    setBustingCache(true)
    try {
      await adminBustCache()
      setCacheInfo({})
    } catch (e) {
      alert(e.message)
    } finally {
      setBustingCache(false)
    }
  }

  function openLogs() { setShowLogs(true); loadLogs() }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#F8FAFC' }}>
      {/* Header */}
      <header className="bg-white flex-shrink-0"
        style={{ borderBottom: '2px solid #29ABE2', boxShadow: '0 1px 8px rgba(41,171,226,0.10)', height: 60 }}>
        <div className="flex items-center justify-between px-4 sm:px-5 h-full">
          <div className="flex items-center gap-3">
            <img src="/pxp-logo.png" alt="PXP Solutions" className="h-9 object-contain" />
            <div className="border-l border-slate-200 pl-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold leading-none mb-0.5">Admin Panel</p>
              <p className="text-sm font-bold text-navy leading-none">{superAdmin ? 'Client Management' : 'My Company Users'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              aria-label="Dashboard"
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl transition-colors border"
              style={{ borderColor: '#CBD5E1', color: '#64748B' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#29ABE2'; e.currentTarget.style.color = '#0369A1' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#64748B' }}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            {superAdmin && (
              <button
                onClick={openLogs}
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors border"
                style={{ borderColor: '#CBD5E1', color: '#64748B' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#29ABE2'; e.currentTarget.style.color = '#0369A1' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#64748B' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" />
                </svg>
                System
              </button>
            )}
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl transition-colors border"
              style={{ borderColor: '#CBD5E1', color: '#64748B' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#29ABE2'; e.currentTarget.style.color = '#0369A1' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#64748B' }}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden p-3 sm:p-4 gap-3 sm:gap-4">
        {/* Left: Client list */}
        <div className={[
          'bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden',
          'flex-1 lg:flex-none lg:w-80 lg:flex-shrink-0',
          mobileShowDetail ? 'hidden lg:flex' : 'flex',
        ].join(' ')}>
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-navy text-sm">
                Clients <span className="text-slate-400 font-normal text-xs">({clients.length})</span>
              </h2>
              {superAdmin && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add client
                </button>
              )}
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients…"
              className="input py-1.5"
            />
            <div className="flex items-center gap-1 mt-2.5">
              {STATUS_FILTERS.map(f => {
                const active = statusFilter === f.id
                return (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={[
                      'text-xs font-semibold px-2.5 py-1 rounded-lg transition',
                      active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                    ].join(' ')}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filteredClients.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedId(c.id); setMobileShowDetail(true) }}
                className={[
                  'w-full text-left px-4 py-3 flex items-center gap-3 transition hover:bg-gray-50',
                  selectedId === c.id ? 'bg-blue-50 border-l-2 border-brand' : 'border-l-2 border-transparent',
                ].join(' ')}
              >
                <div className={`w-9 h-9 rounded-full ${avatarColor(c.company_name)} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white text-xs font-bold">{initials(c.email)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.email}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-500 truncate">{c.company_name}</span>
                    {c.invite_status === 'pending' && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 rounded font-medium flex-shrink-0">Invite sent</span>
                    )}
                    {c.invite_status === 'expired' && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 rounded font-medium flex-shrink-0">Invite expired</span>
                    )}
                    {c.is_super_admin && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-1.5 rounded font-medium flex-shrink-0">Super Admin</span>
                    )}
                    {c.is_admin && !c.is_super_admin && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 rounded font-medium flex-shrink-0">Admin</span>
                    )}
                    {c.contact_count > 0 && (
                      <span className="text-xs bg-brand/10 text-brand px-1.5 rounded font-medium flex-shrink-0">{c.contact_count} contacts</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {filteredClients.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No clients found</p>
            )}
          </div>
        </div>

        {/* Right: Detail panel */}
        {!selected ? (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm hidden lg:flex items-center justify-center">
            <div className="text-center text-slate-400">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600">Select a client to manage</p>
              <p className="text-xs text-slate-400 mt-1">View contacts, reset passwords, toggle admin</p>
            </div>
          </div>
        ) : (
          <div className={[
            'flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex-col overflow-hidden animate-fade-in',
            mobileShowDetail ? 'flex' : 'hidden lg:flex',
          ].join(' ')}>
            {/* Mobile back button */}
            <div className="lg:hidden flex items-center gap-2 px-4 pt-3 pb-0">
              <button
                onClick={() => setMobileShowDetail(false)}
                className="flex items-center gap-1 text-sm font-semibold text-brand"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                All clients
              </button>
            </div>
            {/* Client header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${avatarColor(selected.company_name)} flex items-center justify-center`}>
                  <span className="text-white text-sm font-bold">{initials(selected.email)}</span>
                </div>
                <div>
                  {editingEmail ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        type="email"
                        value={emailDraft}
                        onChange={e => setEmailDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEmail(); if (e.key === 'Escape') { setEditingEmail(false); setEmailDraft('') } }}
                        className="text-sm font-bold text-navy border border-brand rounded px-2 py-0.5 focus:outline-none w-52"
                        placeholder="email@company.com"
                      />
                      <button onClick={handleSaveEmail} className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand text-white">Save</button>
                      <button onClick={() => { setEditingEmail(false); setEmailDraft('') }} className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <p className="font-bold text-navy text-sm">{selected.email}</p>
                      {superAdmin && (
                        <button
                          onClick={() => { setEditingEmail(true); setEmailDraft(selected.email) }}
                          className="w-3.5 h-3.5 text-slate-400 hover:text-brand transition flex-shrink-0"
                          title="Change email"
                        >
                          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                  {editingCompany ? (
                    <div className="relative flex items-center gap-1 mt-0.5">
                      <div className="relative">
                        <input
                          autoFocus
                          value={companyDraft}
                          onChange={e => { setCompanyDraft(e.target.value); setShowCompanyEditDrop(true) }}
                          onFocus={() => setShowCompanyEditDrop(true)}
                          onBlur={() => setTimeout(() => setShowCompanyEditDrop(false), 150)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveCompany(); if (e.key === 'Escape') { setEditingCompany(false); setCompanyDraft('') } }}
                          className="text-xs border border-brand rounded px-2 py-0.5 focus:outline-none w-44"
                          placeholder="Type to search…"
                        />
                        {showCompanyEditDrop && companySuggestionsEdit.length > 0 && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 w-64 max-h-48 overflow-y-auto">
                            {companySuggestionsEdit.map(c => (
                              <button key={c} type="button"
                                onMouseDown={() => { setCompanyDraft(c); setShowCompanyEditDrop(false) }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-slate-700 hover:text-navy transition first:rounded-t-xl last:rounded-b-xl">
                                {c}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={handleSaveCompany} className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand text-white">Save</button>
                      <button onClick={() => { setEditingCompany(false); setCompanyDraft('') }} className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className="text-xs text-gray-500">{selected.company_name}</p>
                      {superAdmin && (
                        <button
                          onClick={() => { setEditingCompany(true); setCompanyDraft(selected.company_name) }}
                          className="w-3.5 h-3.5 text-slate-400 hover:text-brand transition flex-shrink-0"
                          title="Change company"
                        >
                          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {superAdmin && (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    onClick={() => handleViewAsClient(selected)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition bg-sky-100 text-sky-700 hover:bg-sky-200 flex items-center gap-1.5"
                    title="Open the dashboard scoped to this client's company"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View as
                  </button>
                  <button
                    onClick={() => handleToggleSuperAdmin(selected)}
                    className={[
                      'text-xs px-3 py-1.5 rounded-lg font-semibold transition',
                      selected.is_super_admin
                        ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                    ].join(' ')}
                  >
                    {selected.is_super_admin ? 'Super Admin: On' : 'Super Admin: Off'}
                  </button>
                  <button
                    onClick={() => handleToggleViewAllOrders(selected)}
                    className={[
                      'text-xs px-3 py-1.5 rounded-lg font-semibold transition',
                      selected.view_all_orders
                        ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                    ].join(' ')}
                  >
                    {selected.view_all_orders ? 'View All Orders: On' : 'View All Orders: Off'}
                  </button>
                  <button
                    onClick={() => handleToggleAdmin(selected)}
                    className={[
                      'text-xs px-3 py-1.5 rounded-lg font-semibold transition',
                      selected.is_admin && !selected.is_super_admin
                        ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                    ].join(' ')}
                  >
                    {selected.is_admin && !selected.is_super_admin ? 'Admin: On' : 'Admin: Off'}
                  </button>
                  <button
                    onClick={() => handleDeleteClient(selected.id)}
                    className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-semibold transition"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Contact access */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-navy text-sm">Contact Access</h3>
                  {contacts.length === 0 && (
                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">All orders visible</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  {contacts.length === 0
                    ? `This client sees all orders for ${selected.company_name}. Add contact emails below to restrict access.`
                    : `This client sees orders where the contact name matches one of the following:`}
                </p>

                {contacts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {contacts.map(c => (
                      <ContactTag key={c.id} contact={c} onRemove={handleRemoveContact} />
                    ))}
                  </div>
                )}

                {/* Add contact input with autocomplete */}
                <div className="relative flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      value={contactInput}
                      onChange={e => { setContactInput(e.target.value); setShowDropdown(true) }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddContact())}
                      placeholder="Type a contact name to search…"
                      className="input"
                    />
                    {showDropdown && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-md z-20 max-h-48 overflow-y-auto">
                        {suggestions.map(s => (
                          <button
                            key={s}
                            onMouseDown={() => { setContactInput(s); setSuggestions([]); setShowDropdown(false) }}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 text-slate-700 hover:text-navy transition first:rounded-t-xl last:rounded-b-xl"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleAddContact}
                    disabled={!contactInput.trim()}
                    className="btn-primary px-4 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Company Access and AE Access — only shown when view_all_orders is enabled */}
              {selected.view_all_orders && (
                <div className="border-t border-slate-200 pt-5">
                  {/* Company Access section */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-navy text-sm">Company Access</h3>
                      {companyAccess.length === 0 && (
                        <span className="text-xs bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full font-medium">All companies</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      {companyAccess.length === 0
                        ? 'No company filter — this user sees orders from all companies.'
                        : 'This user sees only orders from these companies:'}
                    </p>
                    {companyAccess.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {companyAccess.map(a => (
                          <div key={a.id} className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 text-sky-800 rounded-full pl-3 pr-1.5 py-1">
                            <span className="text-xs font-medium">{a.company_name}</span>
                            <button onClick={() => handleRemoveCompanyAccess(a.id)}
                              className="w-4 h-4 rounded-full bg-sky-200 hover:bg-sky-400 text-sky-800 hover:text-white transition flex items-center justify-center flex-shrink-0">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="relative flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          value={companyAccessInput}
                          onChange={e => { setCompanyAccessInput(e.target.value); setShowCompanyAccessDrop(true) }}
                          onFocus={() => setShowCompanyAccessDrop(true)}
                          onBlur={() => setTimeout(() => setShowCompanyAccessDrop(false), 150)}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCompanyAccess())}
                          placeholder="Search companies…"
                          className="input"
                        />
                        {showCompanyAccessDrop && companyAccessSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-md z-20 max-h-48 overflow-y-auto">
                            {companyAccessSuggestions.filter(s => !companyAccess.some(a => a.company_name === s)).map(s => (
                              <button key={s} onMouseDown={() => { setCompanyAccessInput(s); setCompanyAccessSuggestions([]); setShowCompanyAccessDrop(false) }}
                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-sky-50 text-slate-700 hover:text-navy transition first:rounded-t-xl last:rounded-b-xl">
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={handleAddCompanyAccess} disabled={!companyAccessInput.trim()} className="btn-primary px-4 disabled:opacity-40">Add</button>
                    </div>
                  </div>

                  {/* AE Access section */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-navy text-sm">AE Access</h3>
                    {aeAccess.length === 0 && (
                      <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">All orders visible</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {aeAccess.length === 0
                      ? 'No AE filter — this user sees all orders across all companies.'
                      : 'This user sees only orders assigned to these PXP AEs:'}
                  </p>
                  {aeAccess.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {aeAccess.map(a => (
                        <div key={a.id} className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 text-purple-800 rounded-full pl-3 pr-1.5 py-1">
                          <span className="text-xs font-medium">{a.ae_name}</span>
                          <button onClick={() => handleRemoveAeAccess(a.id)}
                            className="w-4 h-4 rounded-full bg-purple-200 hover:bg-purple-400 text-purple-800 hover:text-white transition flex items-center justify-center flex-shrink-0">
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="relative flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        value={aeInput}
                        onChange={e => { setAeInput(e.target.value); setShowAeDropdown(true) }}
                        onFocus={() => setShowAeDropdown(true)}
                        onBlur={() => setTimeout(() => setShowAeDropdown(false), 150)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddAeAccess())}
                        placeholder="Search AE names…"
                        className="input"
                      />
                      {showAeDropdown && aeSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-md z-20 max-h-48 overflow-y-auto">
                          {aeSuggestions.filter(s => !aeAccess.some(a => a.ae_name === s)).map(s => (
                            <button key={s} onMouseDown={() => { setAeInput(s); setAeSuggestions([]); setShowAeDropdown(false) }}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-purple-50 text-slate-700 hover:text-navy transition first:rounded-t-xl last:rounded-b-xl">
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={handleAddAeAccess} disabled={!aeInput.trim()} className="btn-primary px-4 disabled:opacity-40">Add</button>
                  </div>
                </div>
              )}

              {/* Resend invite — only shown if account not yet activated */}
              {selected.invite_status !== 'active' && (
                <>
                  <div className="rounded-xl px-4 py-3.5 flex items-center justify-between gap-3"
                    style={{ background: selected.invite_status === 'expired' ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${selected.invite_status === 'expired' ? '#FECACA' : '#FDE68A'}` }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: selected.invite_status === 'expired' ? '#991B1B' : '#92400E' }}>
                        {selected.invite_status === 'expired' ? 'Invite link expired' : 'Awaiting activation'}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: selected.invite_status === 'expired' ? '#B91C1C' : '#B45309' }}>
                        {selected.invite_status === 'expired'
                          ? 'The client never used their invite. Send a new one.'
                          : 'Client has been sent an invite but hasn\'t set their password yet.'}
                      </p>
                    </div>
                    <button
                      onClick={handleResendInvite}
                      disabled={resending}
                      className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                    >
                      {resending
                        ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                      }
                      {resending ? 'Sending…' : 'Resend Invite'}
                    </button>
                  </div>
                  {resendLink && (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid #BBF7D0' }}>
                      <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: '#F0FDF4' }}>
                        <p className="text-xs font-semibold text-green-800">Invite link — copy and send to client</p>
                      </div>
                      <div className="px-3 py-2 bg-white flex items-center gap-2">
                        <p className="text-xs text-slate-500 font-mono truncate flex-1">{resendLink}</p>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(resendLink); setResendCopied(true); setTimeout(() => setResendCopied(false), 2000) }}
                          className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                          style={{ background: resendCopied ? '#F0FDF4' : '#EFF6FF', color: resendCopied ? '#16A34A' : '#2563EB' }}
                        >
                          {resendCopied ? '✓ Copied!' : 'Copy link'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Change password */}
              <div className="border-t border-slate-200 pt-5">
                <button
                  onClick={() => setShowPwForm(v => !v)}
                  className="text-sm text-slate-500 hover:text-navy font-medium flex items-center gap-1.5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  {showPwForm ? 'Cancel password change' : 'Change password'}
                </button>
                {showPwForm && (
                  <form onSubmit={handleChangePassword} className="flex gap-2 mt-3">
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={editPassword}
                      onChange={e => setEditPassword(e.target.value)}
                      placeholder="New password (min. 8 chars)"
                      className="input flex-1"
                    />
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-primary px-4 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddClientModal
          onSave={adminCreateClient}
          onUpdateClient={adminUpdateClient}
          onClose={async () => { setShowAddModal(false); await fetchClients() }}
        />
      )}

      {showLogs && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col animate-fade-in" style={{ height: '80vh' }}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-bold text-navy text-base">System Logs</h2>
                <p className="text-xs text-slate-400 mt-0.5">Last 300 lines from app.log</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBustCache}
                  disabled={bustingCache}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 transition disabled:opacity-50"
                >
                  {bustingCache ? 'Clearing…' : 'Clear Cache'}
                </button>
                <button onClick={loadLogs} disabled={logLoading}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
                  {logLoading ? 'Loading…' : 'Refresh'}
                </button>
                <button onClick={() => setShowLogs(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Cache info strip */}
            {cacheInfo && Object.keys(cacheInfo).length > 0 && (
              <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 flex-shrink-0">
                <p className="text-xs font-semibold text-amber-800">
                  Cached: {Object.entries(cacheInfo).map(([k, v]) => `${k} (${Math.round(v.ttl_remaining_s / 60)}min left)`).join(' · ')}
                </p>
              </div>
            )}
            {cacheInfo && Object.keys(cacheInfo).length === 0 && (
              <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex-shrink-0">
                <p className="text-xs text-slate-500">Cache is empty</p>
              </div>
            )}

            {/* Log lines */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950 rounded-b-2xl font-mono text-xs leading-relaxed">
              {logLoading ? (
                <p className="text-slate-400 text-center py-8">Loading…</p>
              ) : logLines.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No log entries yet.</p>
              ) : (
                logLines.map((line, i) => {
                  const isError   = line.includes('[ERROR]')
                  const isWarning = line.includes('[WARNING]')
                  return (
                    <p key={i} className={[
                      'py-0.5 break-all',
                      isError   ? 'text-red-400'    :
                      isWarning ? 'text-amber-400'  :
                      'text-slate-300'
                    ].join(' ')}>
                      {line}
                    </p>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
