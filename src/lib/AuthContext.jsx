import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isAllowedEmail, ALLOWED_DOMAINS_TEXT } from './domains'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // Supabase user object
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSession = async (session) => {
    if (!session?.user) {
      setUser(null)
      setIsAdmin(false)
      setLoading(false)
      return
    }

    const email = session.user.email

    // Block emails outside the allowed company domains
    if (!isAllowedEmail(email)) {
      await supabase.auth.signOut()
      setAuthError(`Only ${ALLOWED_DOMAINS_TEXT} email addresses are allowed.`)
      setUser(null)
      setIsAdmin(false)
      setLoading(false)
      return
    }

    setUser(session.user)

    // Check if admin
    const { data } = await supabase
      .from('admins')
      .select('email')
      .eq('email', email)
      .single()

    setIsAdmin(!!data)
    setLoading(false)
  }

  const signInWithGoogle = async () => {
    setAuthError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          hd: '*', // hint Google to show work (Workspace) accounts only; the real check is isAllowedEmail()
        },
      },
    })
    if (error) setAuthError(error.message)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsAdmin(false)
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, authError, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
