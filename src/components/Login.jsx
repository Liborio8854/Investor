import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import * as authService from '../lib/authService'

function mapError(error) {
  const msg = String(error?.message || '').toLowerCase()
  if (msg.includes('invalid login credentials')) return 'Neplatné heslo nebo e-mail.'
  if (msg.includes('user not found')) return 'Uživatel nenalezen.'
  if (msg.includes('email not confirmed')) return 'Nejprve potvrďte e-mail.'
  if (msg.includes('already registered')) return 'Účet s tímto e-mailem už existuje.'
  if (msg.includes('password should be at least') || msg.includes('password')) {
    return 'Heslo je příliš krátké.'
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Příliš mnoho pokusů. Zkuste to za chvíli.'
  }
  if (msg.includes('unable to validate email') || msg.includes('email')) {
    return error?.message || 'E-mail se nepodařilo ověřit.'
  }
  return error?.message || 'Akci se nepodařilo dokončit.'
}

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [isRegistering, setIsRegistering] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfoMessage('')
    setIsSubmitting(true)
    try {
      if (forgotMode) {
        await authService.resetPasswordForEmail(email.trim())
        setInfoMessage('Odkaz pro reset hesla byl odeslán na váš e-mail.')
        return
      }
      if (isRegistering) {
        await signUp(email.trim(), password)
        setInfoMessage('Registrace proběhla. Nyní vyčkejte na schválení přístupu.')
        setIsRegistering(false)
      } else {
        await signIn(email.trim(), password)
      }
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(mapError(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-[480px]">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#0f172a]">INVESTOR</h1>
          <p className="mt-2 text-sm text-[#475569]">Investiční dashboard</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-sm"
        >
          <div className="mb-4 text-center">
            <p className="text-lg font-semibold text-[#0f172a]">
              {forgotMode ? 'Obnovení hesla' : isRegistering ? 'Registrace' : 'Přihlášení'}
            </p>
            <p className="mt-1 text-sm text-[#94a3b8]">
              {forgotMode
                ? 'Zadejte e-mail a pošleme vám odkaz pro nastavení nového hesla.'
                : isRegistering
                  ? 'Vytvořte účet — přístup schválí administrátor.'
                  : 'Přihlaste se e-mailem a heslem.'}
            </p>
          </div>

          <label className="mb-3 block text-sm text-[#475569]">
            E-mail
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2.5 text-[#0f172a] outline-none focus:border-[#2563eb]"
            />
          </label>

          {!forgotMode && (
            <label className="mb-4 block text-sm text-[#475569]">
              Heslo
              <input
                type="password"
                required
                minLength={6}
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2.5 text-[#0f172a] outline-none focus:border-[#2563eb]"
              />
            </label>
          )}

          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#dc2626]">{error}</p>
          )}
          {infoMessage && (
            <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-[#059669]">
              {infoMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#2563eb] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting
              ? 'Počkejte…'
              : forgotMode
                ? 'Odeslat odkaz pro reset'
                : isRegistering
                  ? 'Vytvořit účet'
                  : 'Přihlásit se'}
          </button>

          {!forgotMode && !isRegistering && (
            <button
              type="button"
              className="mt-3 w-full text-sm text-[#2563eb]"
              onClick={() => {
                setForgotMode(true)
                setError('')
                setInfoMessage('')
                setPassword('')
              }}
            >
              Zapomněli jste heslo?
            </button>
          )}

          <button
            type="button"
            className="mt-4 w-full text-sm text-[#2563eb]"
            onClick={() => {
              if (forgotMode) {
                setForgotMode(false)
              } else {
                setIsRegistering((v) => !v)
              }
              setError('')
              setInfoMessage('')
            }}
          >
            {forgotMode
              ? 'Zpět na přihlášení'
              : isRegistering
                ? 'Už máte účet? Přihlášení'
                : 'Nemáte účet? Registrace'}
          </button>
        </form>
      </div>
    </div>
  )
}
