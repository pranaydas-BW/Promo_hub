import { useAuth } from '../lib/AuthContext'
import { Tag, AlertCircle } from 'lucide-react'

export default function Login() {
  const { signInWithGoogle, authError } = useAuth()

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center">
            <Tag size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-2xl text-ink">
            Promo<span className="text-accent">Hub</span>
          </span>
        </div>

        {/* Card */}
        <div className="bg-white border border-border rounded-2xl p-8 shadow-sm">
          <h1 className="font-display text-xl font-bold text-ink mb-1 text-center">Sign in</h1>
          <p className="text-muted text-sm font-body text-center mb-6">
            Use your Broadway Live Google account
          </p>

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

          {authError && (
            <div className="mt-4 flex items-start gap-2 text-danger text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {authError}
            </div>
          )}

          <p className="text-center text-[11px] text-muted font-body mt-5">
            Only <span className="font-medium">@broadwaylive.in</span> accounts are allowed
          </p>
        </div>
      </div>
    </div>
  )
}
