import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as authService from '../lib/authService'

const AuthContext = createContext(null)

async function ensureInvUser(sessionUser) {
  const userId = sessionUser.id
  const { data: existing, error: fetchError } = await supabase
    .from('inv_users')
    .select('id, role, approved, display_name')
    .eq('id', userId)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (existing) return existing

  const displayName =
    sessionUser.user_metadata?.display_name ||
    sessionUser.user_metadata?.full_name ||
    sessionUser.user_metadata?.name ||
    sessionUser.email?.split('@')[0] ||
    'Investor'

  const { data: created, error: insertError } = await supabase
    .from('inv_users')
    .insert({
      id: userId,
      role: 'viewer',
      approved: false,
      display_name: displayName,
    })
    .select('id, role, approved, display_name')
    .single()

  if (insertError) {
    const { data: retry } = await supabase
      .from('inv_users')
      .select('id, role, approved, display_name')
      .eq('id', userId)
      .maybeSingle()
    if (retry) return retry
    throw insertError
  }

  return created
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [invUser, setInvUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  const refreshInvUser = useCallback(async (sess) => {
    if (!sess?.user) {
      setInvUser(null)
      return null
    }
    const profile = await ensureInvUser(sess.user)
    setInvUser(profile)
    return profile
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      try {
        await refreshInvUser(data.session)
        setAuthError(null)
      } catch (err) {
        console.error(err)
        setAuthError(err.message)
      } finally {
        if (mounted) setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      setLoading(true)
      try {
        await refreshInvUser(nextSession)
        setAuthError(null)
      } catch (err) {
        console.error(err)
        setAuthError(err.message)
      } finally {
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [refreshInvUser])

  const signIn = useCallback(async (email, password) => {
    await authService.signIn(email, password)
  }, [])

  const signUp = useCallback(async (email, password) => {
    await authService.signUp(email, password)
  }, [])

  const signOut = useCallback(async () => {
    setInvUser(null)
    await authService.signOut()
  }, [])

  const updateDisplayName = useCallback(
    async (newName) => {
      if (!session?.user?.id) throw new Error('Nejste přihlášeni')
      await authService.updateDisplayName(session.user.id, newName)
      setInvUser((prev) => (prev ? { ...prev, display_name: String(newName).trim() } : prev))
    },
    [session?.user?.id],
  )

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      invUser,
      approved: Boolean(invUser?.approved),
      loading,
      authError,
      signIn,
      signUp,
      signOut,
      updateDisplayName,
      refreshInvUser: () => refreshInvUser(session),
    }),
    [session, invUser, loading, authError, signIn, signUp, signOut, updateDisplayName, refreshInvUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
