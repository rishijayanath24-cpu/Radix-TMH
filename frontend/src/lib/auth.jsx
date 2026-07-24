import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, hasSupabase } from './supabase'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [ready, setReady] = useState(!hasSupabase)

  useEffect(() => {
    if (!hasSupabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!hasSupabase) return
    if (!session) { setProfile(null); setReady(true); return }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => { setProfile(data); setReady(true) })
  }, [session])

  const signUp = async ({ email, password, full_name, role }) => {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name, role } },
    })
    if (error) throw error
    return data
  }

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => { await supabase.auth.signOut(); setProfile(null) }

  const value = {
    hasSupabase,
    ready,
    session,
    user: session?.user || null,
    profile,
    role: profile?.role || null,
    signUp, signIn, signOut,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
