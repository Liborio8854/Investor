import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { signOut, invUser, updateDisplayName } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const openEdit = () => {
    setDraft(invUser?.display_name || '')
    setErr('')
    setEditing(true)
  }

  const save = async () => {
    setBusy(true)
    setErr('')
    try {
      await updateDisplayName(draft)
      setEditing(false)
    } catch (ex) {
      setErr(ex.message || 'Uložení selhalo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto min-h-svh w-full max-w-[480px] bg-white shadow-sm">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#e2e8f0] bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-[#94a3b8]">INVESTOR</p>
          <button
            type="button"
            onClick={openEdit}
            className="truncate text-left text-sm text-[#475569] hover:text-[#2563eb]"
            title="Změnit jméno"
          >
            {invUser?.display_name || 'Portfolio'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="shrink-0 text-xs font-medium text-[#475569] hover:text-[#2563eb]"
        >
          Odhlásit
        </button>
      </header>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Zavřít"
            onClick={() => !busy && setEditing(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <h2 className="text-base font-semibold text-[#0f172a]">Změnit jméno</h2>
            <label className="mt-3 block text-xs font-medium text-[#475569]">
              Zobrazované jméno
              <input
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#2563eb]"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={busy}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save()
                  if (e.key === 'Escape' && !busy) setEditing(false)
                }}
              />
            </label>
            {err && <p className="mt-2 text-sm text-[#dc2626]">{err}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(false)}
                className="flex-1 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#475569] disabled:opacity-50"
              >
                Zrušit
              </button>
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={save}
                className="flex-1 rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? '…' : 'Uložit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="px-4 pb-24 pt-4">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
