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

export async function resetPasswordForEmail(email) {
  ensureSupabase()
  const redirectTo = `${window.location.origin}/reset-password`
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
  return data
}

export async function updatePassword(newPassword) {
  ensureSupabase()
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
  return data
}

export async function updateDisplayName(userId, displayName) {
  ensureSupabase()
  const name = String(displayName || '').trim()
  if (!name) throw new Error('Jméno nesmí být prázdné.')

  const { data, error } = await supabase.auth.updateUser({
    data: { display_name: name },
  })
  if (error) throw error

  const { error: invErr } = await supabase
    .from('inv_users')
    .update({ display_name: name })
    .eq('id', userId)
  if (invErr) throw invErr

  // Shared Faltíci profiles table (optional — ignore if missing)
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ display_name: name })
    .eq('id', userId)
  if (profileErr) {
    console.warn('[profiles]', profileErr.message)
  }

  return data
}
