import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchActiveAlertSnoozes,
  fetchTodayRecommendations,
  upsertAlertSnooze,
} from '../lib/api'
import { formatPrice } from '../lib/format'

const STYLES = {
  buy: { bg: 'bg-emerald-50', border: 'border-emerald-100', badge: 'bg-emerald-600', label: 'BUY' },
  watch: { bg: 'bg-amber-50', border: 'border-amber-100', badge: 'bg-amber-500', label: 'WATCH' },
  earnings: { bg: 'bg-blue-50', border: 'border-blue-100', badge: 'bg-blue-600', label: 'EARNINGS' },
  alert: { bg: 'bg-red-50', border: 'border-red-100', badge: 'bg-red-600', label: 'ALERT' },
  rebalance: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    badge: 'bg-slate-600',
    label: 'REBALANCE',
  },
}

const FALLBACK_STYLE = {
  bg: 'bg-slate-50',
  border: 'border-slate-200',
  badge: 'bg-slate-500',
  label: 'INFO',
}

const SNOOZE_DAYS = [30, 60, 90]

export default function DailyRecommendations() {
  const { user } = useAuth()
  const [recs, setRecs] = useState([])
  const [snoozedTickers, setSnoozedTickers] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [snoozeMenuId, setSnoozeMenuId] = useState(null)
  const [snoozeBusy, setSnoozeBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const snoozeMenuRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, snoozes] = await Promise.all([
        fetchTodayRecommendations(),
        user?.id ? fetchActiveAlertSnoozes(user.id) : Promise.resolve([]),
      ])
      setRecs(data)
      setSnoozedTickers(
        new Set(
          (snoozes || [])
            .map((s) => String(s.ticker || '').trim().toUpperCase())
            .filter(Boolean),
        ),
      )
    } catch (err) {
      console.error('[DailyRecommendations]', err)
      setError(err.message || 'Nepodařilo se načíst doporučení')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (snoozeMenuId == null) return undefined

    const handlePointerDown = (e) => {
      if (snoozeMenuRef.current && !snoozeMenuRef.current.contains(e.target)) {
        setSnoozeMenuId(null)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSnoozeMenuId(null)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [snoozeMenuId])

  const visibleRecs = recs.filter((rec) => {
    const type = String(rec.type || '').toUpperCase()
    if (type === 'SUMMARY') return true
    if (type !== 'ALERT') return true
    const ticker = String(rec.ticker || '').trim().toUpperCase()
    if (!ticker) return true
    return !snoozedTickers.has(ticker)
  })

  const summaryRec = visibleRecs.find((r) => String(r.type || '').toUpperCase() === 'SUMMARY')
  const otherRecs = visibleRecs.filter((r) => String(r.type || '').toUpperCase() !== 'SUMMARY')

  const handleSnooze = async (rec, days) => {
    if (!user?.id || !rec?.ticker) return
    setSnoozeBusy(true)
    try {
      await upsertAlertSnooze({ userId: user.id, ticker: rec.ticker, days })
      const ticker = String(rec.ticker).trim().toUpperCase()
      setSnoozedTickers((prev) => new Set([...prev, ticker]))
      setSnoozeMenuId(null)
      setToast(`${ticker} ztlumen na ${days} dní`)
    } catch (err) {
      console.error('[DailyRecommendations] snooze', err)
      setToast(err.message || 'Ztlumení se nepovedlo')
    } finally {
      setSnoozeBusy(false)
    }
  }

  return (
    <section className="relative border-t border-[#e2e8f0] py-5">
      <h2 className="text-sm font-semibold text-[#0f172a]">Denní doporučení</h2>

      {loading && <p className="mt-3 text-sm text-[#94a3b8]">Načítám doporučení…</p>}

      {!loading && error && <p className="mt-3 text-sm text-[#dc2626]">{error}</p>}

      {!loading && !error && visibleRecs.length === 0 && (
        <p className="mt-3 text-sm text-[#64748b]">Doporučení se generují v 9:30</p>
      )}

      {!loading && !error && visibleRecs.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {summaryRec && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3">
              <p className="text-sm font-bold leading-snug text-[#0f172a]">{summaryRec.message}</p>
            </div>
          )}

          {otherRecs.map((rec) => {
            const key = String(rec.type || '').toLowerCase()
            const style = STYLES[key] || {
              ...FALLBACK_STYLE,
              label: String(rec.type || 'INFO').toUpperCase(),
            }
            const isAlert = String(rec.type || '').toUpperCase() === 'ALERT'
            const menuOpen = snoozeMenuId === rec.id

            return (
              <div
                key={rec.id}
                className={`rounded-lg border ${style.border} ${style.bg} p-3`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${style.badge}`}
                    >
                      {style.label}
                    </span>
                    {rec.ticker && (
                      <span className="text-sm font-semibold text-[#0f172a]">{rec.ticker}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {rec.price != null && (
                      <span className="text-xs text-[#475569]">{formatPrice(rec.price)}</span>
                    )}
                    {isAlert && rec.ticker && user?.id && (
                      <div className="relative" ref={menuOpen ? snoozeMenuRef : null}>
                        <button
                          type="button"
                          disabled={snoozeBusy}
                          className="rounded border border-red-200 bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-[#b91c1c] hover:bg-white disabled:opacity-50"
                          onClick={() =>
                            setSnoozeMenuId((id) => (id === rec.id ? null : rec.id))
                          }
                        >
                          🔕 Ztlumit
                        </button>
                        {menuOpen && (
                          <div className="absolute right-0 z-20 mt-1 min-w-[7.5rem] rounded-md border border-[#e2e8f0] bg-white py-1 shadow-md">
                            {SNOOZE_DAYS.map((days) => (
                              <button
                                key={days}
                                type="button"
                                disabled={snoozeBusy}
                                className="block w-full px-3 py-1.5 text-left text-xs text-[#0f172a] hover:bg-slate-50 disabled:opacity-50"
                                onClick={() => handleSnooze(rec, days)}
                              >
                                {days} dní
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-sm leading-snug text-[#475569]">{rec.message}</p>
              </div>
            )
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0f172a] px-3 py-2 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}
    </section>
  )
}
