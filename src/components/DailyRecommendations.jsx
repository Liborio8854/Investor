import { useEffect, useState } from 'react'
import { fetchTodayRecommendations } from '../lib/api'
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

export default function DailyRecommendations() {
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchTodayRecommendations()
        if (!cancelled) setRecs(data)
      } catch (err) {
        console.error('[DailyRecommendations]', err)
        if (!cancelled) setError(err.message || 'Nepodařilo se načíst doporučení')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="border-t border-[#e2e8f0] py-5">
      <h2 className="text-sm font-semibold text-[#0f172a]">Denní doporučení</h2>

      {loading && (
        <p className="mt-3 text-sm text-[#94a3b8]">Načítám doporučení…</p>
      )}

      {!loading && error && (
        <p className="mt-3 text-sm text-[#dc2626]">{error}</p>
      )}

      {!loading && !error && recs.length === 0 && (
        <p className="mt-3 text-sm text-[#64748b]">Doporučení se generují v 9:30</p>
      )}

      {!loading && !error && recs.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {recs.map((rec) => {
            const key = String(rec.type || '').toLowerCase()
            const style = STYLES[key] || {
              ...FALLBACK_STYLE,
              label: String(rec.type || 'INFO').toUpperCase(),
            }
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
                  {rec.price != null && (
                    <span className="text-xs text-[#475569]">{formatPrice(rec.price)}</span>
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-snug text-[#475569]">{rec.message}</p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
