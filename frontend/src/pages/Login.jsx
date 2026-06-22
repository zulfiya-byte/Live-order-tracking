import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../api'

const FEATURES = [
  {
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z',
    text: 'Live production status across all PXP locations',
  },
  {
    icon: 'M5 13l4 4L19 7',
    text: 'Real-time shipment tracking with carrier details',
  },
  {
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    text: 'Secure, company-scoped order visibility',
  },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      nav('/dashboard')
    } catch (e) {
      setError(e.message || 'Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — PXP blue brand ──────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[440px] flex-shrink-0 px-10 py-12 relative overflow-hidden"
        style={{ background: '#0D6F94' }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="absolute -bottom-24 -left-12 w-64 h-64 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <div className="absolute top-1/3 right-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />

        {/* Logo */}
        <div className="relative">
          <div className="bg-white rounded-2xl px-5 py-3.5 inline-block mb-10 animate-pop-in"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <img src="/pxp-logo.png" alt="PXP Solutions" className="h-10 object-contain" />
          </div>
          <h2 className="text-white text-3xl font-bold leading-tight mb-3 animate-slide-up"
            style={{ animationDelay: '0.1s' }}>
            Track your orders<br />in real time.
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs animate-slide-up"
            style={{ animationDelay: '0.18s' }}>
            Your dedicated portal for production updates, shipment status, and order details.
          </p>
        </div>

        {/* Feature list */}
        <div className="space-y-4 relative">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-start gap-3 animate-slide-up"
              style={{ animationDelay: `${0.28 + i * 0.08}s` }}>
              <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                </svg>
              </div>
              <p className="text-white/75 text-sm leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>

        <p className="text-white/30 text-xs relative animate-fade-in" style={{ animationDelay: '0.6s' }}>
          © {new Date().getFullYear()} PXP Solutions. All rights reserved.
        </p>
      </div>

      {/* ── Right panel — sign in form ────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-5 py-10"
        style={{ background: '#F5F8FB' }}>
        <div className="w-full max-w-sm animate-slide-up">

          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden animate-pop-in">
            <img src="/pxp-logo.png" alt="PXP Solutions" className="h-12 object-contain" />
          </div>

          <div className="bg-white rounded-3xl p-8"
            style={{ boxShadow: '0 4px 24px rgba(41,171,226,0.10), 0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-navy mb-1">Welcome back</h1>
              <p className="text-slate-500 text-sm">Sign in to your client portal</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="label">Email address</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input pr-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
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
                disabled={loading}
                className="w-full btn-primary py-3 text-base flex items-center justify-center gap-2"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Signing in…</>
                  : 'Sign In'}
              </button>
            </form>
            <p className="text-center text-xs text-slate-400 mt-4">
              <Link to="/forgot-password" className="text-brand hover:underline font-medium">Forgot your password?</Link>
            </p>
          </div>

          <p className="text-center text-xs text-slate-400 mt-5">
            Need access? Contact your PXP Solutions representative.
          </p>
        </div>
      </div>

    </div>
  )
}
