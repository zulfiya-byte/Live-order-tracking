import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api'

export default function ForgotPassword() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await forgotPassword(email)
      setSent(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5"
      style={{ background: '#F5F8FB' }}>
      <div className="w-full max-w-sm animate-slide-up">

        <div className="flex justify-center mb-8">
          <img src="/pxp-logo.png" alt="PXP Solutions" className="h-12 object-contain" />
        </div>

        <div className="bg-white rounded-3xl p-8"
          style={{ boxShadow: '0 4px 24px rgba(41,171,226,0.10), 0 1px 3px rgba(0,0,0,0.06)' }}>

          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-navy mb-2">Check your inbox</h1>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                If an account exists for <strong className="text-slate-700">{email}</strong>, a reset link has been sent. Check your spam folder if you don't see it.
              </p>
              <Link to="/login" className="text-brand text-sm font-semibold hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-navy mb-1">Reset password</h1>
                <p className="text-slate-500 text-sm">Enter your email and we'll send a reset link.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input"
                    placeholder="you@company.com"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full btn-primary py-3 text-base flex items-center justify-center gap-2">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Sending…</>
                    : 'Send Reset Link'}
                </button>
              </form>

              <p className="text-center text-xs text-slate-400 mt-5">
                Remember it? <Link to="/login" className="text-brand font-semibold hover:underline">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
