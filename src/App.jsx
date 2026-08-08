import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './components/Login'
import WaitingRoom from './components/WaitingRoom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Watchlist from './pages/Watchlist'
import Positions from './pages/Positions'
import Transactions from './pages/Transactions'
import Rules from './pages/Rules'
import ResetPassword from './pages/ResetPassword'

function FlashBanner() {
  const [msg, setMsg] = useState('')
  const location = useLocation()

  useEffect(() => {
    const flash = sessionStorage.getItem('investor_flash')
    if (flash) {
      sessionStorage.removeItem('investor_flash')
      setMsg(flash)
      const t = setTimeout(() => setMsg(''), 4000)
      return () => clearTimeout(t)
    }
    setMsg('')
  }, [location.pathname])

  if (!msg) return null
  return (
    <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-[#059669]">{msg}</div>
  )
}

function DashboardWithFlash() {
  return (
    <>
      <FlashBanner />
      <Dashboard />
    </>
  )
}

function ProtectedApp() {
  const { session, loading, approved, authError } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-50 text-sm text-[#94a3b8]">
        Načítám…
      </div>
    )
  }

  if (!session) return <Login />

  if (authError) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-50 px-4">
        <p className="max-w-sm text-center text-sm text-[#dc2626]">{authError}</p>
      </div>
    )
  }

  if (!approved) return <WaitingRoom />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<DashboardWithFlash />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/positions" element={<Positions />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<ProtectedApp />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
