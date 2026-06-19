import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { verifyInviteToken, setPassword } from '../api'

export default function SetPassword() {
  const [params]   = useSearchParams()
  const nav        = useNavigate()
  const token      = params.get('token') || ''

  const [status, setStatus]       = useState('loading') // loading | valid | invalid | success
  const [email, setEmail]         = useState('')
  const [company, setCompany]     = useState('')
  const [password, setPassword_]  = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [invalidMsg, setInvalidMsg] = useState('')
  const [isReset, setIsReset]       = useState(false)

  useEffect(() => {
    if (!token) { setStatus('invalid'); setInvalidMsg('No invite token found in the link.'); return }
    verifyInviteToken(token)
      .then(d => { setEmail(d.email); setCompany(d.company_name); setIsReset(!!d.is_reset); setStatus('valid') })
      .catch(e => { setStatus('invalid'); setInvalidMsg(e.message) })
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setSaving(true)
    try {
      await setPassword(token, password)
      setStatus('success')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F9FC' }}>
      <div className="text-center animate-fade-in">
        <div className="w-10 h-10 border-4 border-t-brand rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: '#E0F5FB', borderTopColor: '#29ABE2' }} />
        <p className="text-slate-500 text-sm">Verifying your invite link…</p>
      </div>
    </div>
  )

  // ── Invalid / expired ──────────────────────────────────────────────────────
  if (status === 'invalid') return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: '#F4F9FC' }}>
      <div className="bg-white rounded-3xl p-10 w-full max-w-sm text-center animate-slide-up"
        style={{ boxShadow: '0 4px 24px rgba(41,171,226,0.10)' }}>
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-navy mb-2">Link Unavailable</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">{invalidMsg}</p>
        <p className="text-xs text-slate-400">
          Please contact your PXP Solutions representative to request a new invite link.
        </p>
      </div>
    </div>
  )

  // ── Success ────────────────────────────────────────────────────────────────
  if (status === 'success') return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: '#F4F9FC' }}>
      <div className="bg-white rounded-3xl p-10 w-full max-w-sm text-center animate-pop-in"
        style={{ boxShadow: '0 4px 24px rgba(41,171,226,0.10)' }}>
        <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-navy mb-2">{isReset ? 'Password Reset!' : 'Password Created!'}</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-7">
          {isReset ? 'Your password has been updated. Sign in with ' : 'Your account is ready. Sign in with '}
          <strong className="text-slate-700">{email}</strong> to access your orders.
        </p>
        <button
          onClick={() => nav('/login')}
          className="w-full btn-primary py-3 text-base"
        >
          Go to Sign In
        </button>
      </div>
    </div>
  )

  // ── Set password form ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex" style={{ background: '#F4F9FC' }}>

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[400px] flex-shrink-0 px-10 py-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0D6F94 0%, #1A9ED4 55%, #0D6F94 100%)' }}>
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="absolute -bottom-24 -left-12 w-64 h-64 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />

        <div className="relative">
          <div className="bg-white rounded-2xl px-5 py-3.5 inline-block mb-10 animate-pop-in"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <img src="/pxp-logo.png" alt="PXP Solutions" className="h-10 object-contain" />
          </div>
          <h2 className="text-white text-2xl font-bold leading-tight mb-3 animate-slide-up">
            Welcome to your<br />client portal.
          </h2>
          <p className="text-white/60 text-sm leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Just one step left — create your password to access real-time order tracking for <strong className="text-white/80">{company}</strong>.
          </p>
        </div>

        <div className="space-y-3 relative animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {['Live production status', 'Shipment tracking & carrier details', 'Secure, company-scoped access'].map(f => (
            <div key={f} className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.2)' }}>
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white/70 text-sm">{f}</p>
            </div>
          ))}
        </div>

        <p className="text-white/30 text-xs relative">© {new Date().getFullYear()} PXP Solutions.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-5 py-10"
        style={{ background: 'linear-gradient(160deg, #F4F9FC 0%, #EBF5FB 100%)' }}>
        <div className="w-full max-w-sm animate-slide-up">

          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <img src="/pxp-logo.png" alt="PXP Solutions" className="h-12 object-contain" />
          </div>

          <div className="bg-white rounded-3xl p-8"
            style={{ boxShadow: '0 4px 24px rgba(41,171,226,0.10), 0 1px 3px rgba(0,0,0,0.06)' }}>

            {/* Welcome header */}
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 bg-brand-light rounded-full px-3 py-1 mb-4">
                <span className="w-2 h-2 rounded-full bg-brand" />
                <span className="text-xs font-semibold" style={{ color: '#0369A1' }}>{company}</span>
              </div>
              <h1 className="text-2xl font-bold text-navy mb-1">{isReset ? 'Reset your password' : 'Create your password'}</h1>
              <p className="text-slate-500 text-sm">
                You'll use <strong className="text-slate-700">{email}</strong> to sign in.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">New password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={e => setPassword_(e.target.value)}
                    className="input pr-10"
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw
                      ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    }
                  </button>
                </div>
                {/* Strength hint */}
                {password.length > 0 && (
                  <p className="text-xs mt-1.5" style={{ color: password.length >= 8 ? '#16A34A' : '#94A3B8' }}>
                    {password.length >= 8 ? '✓ Good length' : `${8 - password.length} more characters needed`}
                  </p>
                )}
              </div>

              <div>
                <label className="label">Confirm password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="input"
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                />
                {confirm.length > 0 && password !== confirm && (
                  <p className="text-xs mt-1.5 text-red-500">Passwords do not match</p>
                )}
              </div>

              {error && (
                <div role="alert" className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving || password !== confirm || password.length < 8}
                className="w-full btn-primary py-3 text-base flex items-center justify-center gap-2"
              >
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {isReset ? 'Resetting…' : 'Setting up…'}</>
                  : isReset ? 'Reset My Password' : 'Activate My Account'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-400 mt-5">
            Need help? Contact your PXP Solutions representative.
          </p>
        </div>
      </div>
    </div>
  )
}
