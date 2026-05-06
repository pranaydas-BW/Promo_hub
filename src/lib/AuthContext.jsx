import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

    // Block non-broadwaylive.in emails
    if (!email?.endsWith('@broadwaylive.in')) {
      await supabase.auth.signOut()
      setAuthError('Only @broadwaylive.in email addresses are allowed.')
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
          hd: 'broadwaylive.in', // hint Google to show only broadwaylive.in accounts
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
