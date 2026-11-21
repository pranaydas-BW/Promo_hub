import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { Tag, AlertCircle, Loader2, Mail } from 'lucide-react'
import { isAllowedEmail, ALLOWED_DOMAINS_TEXT } from '../lib/domains'

const RESEND_SECONDS = 60

export default function Login() {
  const { signInWithGoogle, authError } = useAuth()

  const [step, setStep] = useState('email') // 'email' -> 'code'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const cleanEmail = email.trim().toLowerCase()

  // Only company addresses are sent a code. (The same rule is enforced again on the server —
  // this check just gives a fast, friendly message.)
  const sendCode = async () => {
    setError('')
    if (!isAllowedEmail(cleanEmail)) {
      setError(`Only ${ALLOWED_DOMAINS_TEXT} email addresses can sign in.`)
      return false
    }
    setBusy(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: true },
    })
    setBusy(false)
    if (err) {
      console.error('Send code failed', err)
      setError(
        err.status === 429 || /rate|seconds|too many/i.test(err.message || '')
          ? 'Please wait a minute before asking for another code.'
          : 'We could not send the code. Please try again, or ask an admin for help.'
      )
      return false
    }
    setCooldown(RESEND_SECONDS)
    return true
  }

  const onSubmitEmail = async (e) => {
    e.preventDefault()
    if (busy) return
    if (await sendCode()) { setStep('code'); setCode('') }
  }

  const onSubmitCode = async (e) => {
    e.preventDefault()
    if (busy) return
    setError('')
    const token = code.replace(/\s/g, '')
    if (!/^\d{6,10}$/.test(token)) { setError('Enter the numeric code from the email.'); return }
    setBusy(true)
    const { error: err } = await supabase.auth.verifyOtp({ email: cleanEmail, token, type: 'email' })
    setBusy(false)
    // On success the session is picked up by AuthContext and this screen is replaced.
    if (err) {
      console.error('Verify code failed', err)
      setError('That code is wrong or has expired. Check the latest email, or request a new code.')
    }
  }

  const onResend = async () => {
    if (busy || cooldown > 0) return
    await sendCode()
  }

  const backToEmail = () => { setStep('email'); setCode(''); setError(''); setCooldown(0) }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center">
            <Tag size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-2xl text-ink">
            Broadway <span className="text-accent">Promos</span>
          </span>
        </div>

        {/* Card */}
        <div className="bg-white border border-border rounded-2xl p-8 shadow-sm">
          <h1 className="font-display text-xl font-bold text-ink mb-1 text-center">Sign in</h1>
          <p className="text-muted text-sm font-body text-center mb-6">
            Sign in with your Broadway Live account
          </p>

          {step === 'email' && (
            <>
              <button
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-border hover:border-ink rounded-xl px-4 py-3 text-sm font-body font-medium text-ink transition-colors"
              >
                {/* Google icon */}
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                  <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                  <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
                  <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted font-body uppercase tracking-wide">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={onSubmitEmail} className="space-y-3">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-body text-muted mb-1.5">Work email</label>
                  <input
                    id="login-email" type="email" autoComplete="email" inputMode="email"
                    className="input-field" placeholder="name@broadwaylive.in"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <button type="submit" disabled={busy || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-accent text-white text-sm font-body font-medium px-4 py-3 rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-colors">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                  {busy ? 'Sending code…' : 'Email me a code'}
                </button>
              </form>
            </>
          )}

          {step === 'code' && (
            <form onSubmit={onSubmitCode} className="space-y-3">
              <p className="text-sm font-body text-ink text-center">
                We sent a code to <span className="font-medium break-all">{cleanEmail}</span>
              </p>
              <div>
                <label htmlFor="login-code" className="block text-xs font-body text-muted mb-1.5">Code from the email</label>
                <input
                  id="login-code" autoComplete="one-time-code" inputMode="numeric" maxLength={12}
                  className="input-field text-center tracking-[0.35em] font-mono text-lg" placeholder="••••••"
                  value={code} onChange={e => setCode(e.target.value)} autoFocus required />
              </div>
              <button type="submit" disabled={busy || !code.trim()}
                className="w-full flex items-center justify-center gap-2 bg-accent text-white text-sm font-body font-medium px-4 py-3 rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-colors">
                {busy && <Loader2 size={15} className="animate-spin" />}
                {busy ? 'Checking…' : 'Sign in'}
              </button>
              <div className="flex items-center justify-between text-xs font-body">
                <button type="button" onClick={backToEmail} className="text-muted hover:text-ink underline">
                  Use a different email
                </button>
                <button type="button" onClick={onResend} disabled={busy || cooldown > 0}
                  className="text-accent hover:underline disabled:text-muted disabled:no-underline">
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}

          {(error || authError) && (
            <div role="alert" className="mt-4 flex items-start gap-2 text-danger text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {error || authError}
            </div>
          )}

          <p className="text-center text-[11px] text-muted font-body mt-5">
            Only <span className="font-medium">{ALLOWED_DOMAINS_TEXT}</span> accounts are allowed
          </p>
        </div>
      </div>
    </div>
  )
}
