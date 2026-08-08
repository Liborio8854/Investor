import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './components/Login'
import WaitingRoom from './components/WaitingRoom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Watchlist from './pages/Watchlist'
import Positions from './pages/Positions'
import Transactions from './pages/Transactions'
import Rules from './pages/Rules'

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
        <Route path="/dashboard" element={<Dashboard />} />
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
        <ProtectedApp />
      </BrowserRouter>
    </AuthProvider>
  )
}
