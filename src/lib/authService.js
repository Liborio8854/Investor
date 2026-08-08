import { supabase } from './supabase'

function ensureSupabase() {
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase není nakonfigurovaný. Zkontrolujte VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY.',
    )
  }
}

export async function signIn(email, password) {
  ensureSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email, password) {
  ensureSupabase()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  ensureSupabase()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
