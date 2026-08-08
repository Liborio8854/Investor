import { useAuth } from '../context/AuthContext'

export default function WaitingRoom() {
  const { signOut, refreshInvUser } = useAuth()

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-[480px] rounded-lg border border-[#e2e8f0] bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-[#0f172a]">Čekáte na schválení</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#475569]">
          Čekáte na schválení administrátorem. Po schválení se vám otevře dashboard.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => refreshInvUser()}
            className="rounded-lg border border-[#e2e8f0] py-2.5 text-sm font-medium text-[#0f172a]"
          >
            Obnovit stav
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-lg py-2.5 text-sm text-[#475569]"
          >
            Odhlásit se
          </button>
        </div>
      </div>
    </div>
  )
}
