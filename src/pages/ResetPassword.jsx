import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import * as authService from '../lib/authService'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true

    // Recovery link sets session via URL hash / PKCE
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      if (data.session) {
        setReady(true)
        return
      }
      setError('Odkaz pro reset hesla je neplatný nebo vypršel. Požádejte o nový.')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
        setError('')
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Heslo musí mít alespoň 6 znaků.')
      return
    }
    if (password !== confirm) {
      setError('Hesla se neshodují.')
      return
    }

    setBusy(true)
    try {
      await authService.updatePassword(password)
      sessionStorage.setItem('investor_flash', 'Heslo bylo změněno.')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Heslo se nepodařilo změnit.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-[480px]">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#0f172a]">INVESTOR</h1>
          <p className="mt-2 text-sm text-[#475569]">Nové heslo</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-sm"
        >
          <p className="mb-4 text-sm text-[#475569]">Zadejte nové heslo (min. 6 znaků).</p>

          <label className="mb-3 block text-sm text-[#475569]">
            Nové heslo
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!ready || busy}
              className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2.5 text-[#0f172a] outline-none focus:border-[#2563eb] disabled:opacity-60"
            />
          </label>

          <label className="mb-4 block text-sm text-[#475569]">
            Potvrzení hesla
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={!ready || busy}
              className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2.5 text-[#0f172a] outline-none focus:border-[#2563eb] disabled:opacity-60"
            />
          </label>

          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#dc2626]">{error}</p>
          )}

          <button
            type="submit"
            disabled={!ready || busy}
            className="w-full rounded-lg bg-[#2563eb] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Ukládám…' : 'Uložit nové heslo'}
          </button>
        </form>
      </div>
    </div>
  )
}
