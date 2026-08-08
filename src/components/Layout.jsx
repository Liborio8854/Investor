import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { signOut, invUser } = useAuth()

  return (
    <div className="mx-auto min-h-svh w-full max-w-[480px] bg-white shadow-sm">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#e2e8f0] bg-white px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#94a3b8]">INVESTOR</p>
          <p className="text-sm text-[#475569]">{invUser?.display_name || 'Portfolio'}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-xs font-medium text-[#475569] hover:text-[#2563eb]"
        >
          Odhlásit
        </button>
      </header>

      <main className="px-4 pb-24 pt-4">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
