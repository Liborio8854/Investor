import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate, formatPct, signedCzk } from '../lib/format'

export default function RealizedTrades({ trades, totalPnl }) {
  const [open, setOpen] = useState(false)
  const preview = trades.slice(0, 3)
  const positive = totalPnl >= 0

  return (
    <section className="border-t border-[#e2e8f0] py-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-2 text-left text-sm font-semibold text-[#0f172a]"
      >
        <span className="text-[#94a3b8]">{open ? '▼' : '▶'}</span>
        <span>Realizované obchody ({trades.length})</span>
        <span className={`font-medium ${positive ? 'text-[#059669]' : 'text-[#dc2626]'}`}>
          | celkem {signedCzk(totalPnl)}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {preview.length === 0 ? (
            <p className="text-sm text-[#94a3b8]">Zatím žádné SELL transakce</p>
          ) : (
            preview.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[#e2e8f0] px-3 py-2.5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#94a3b8]">{formatDate(t.date)}</span>
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-[#dc2626]">
                      SELL
                    </span>
                    <span className="text-sm font-semibold text-[#0f172a]">{t.ticker}</span>
                  </div>
                </div>
                <div
                  className={`text-right text-sm font-medium ${
                    t.pnlCzk >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'
                  }`}
                >
                  <div>{signedCzk(t.pnlCzk)}</div>
                  <div className="text-xs">{formatPct(t.pnlPct)}</div>
                </div>
              </div>
            ))
          )}

          <Link
            to="/transactions"
            className="inline-block pt-1 text-sm font-medium text-[#2563eb]"
          >
            Zobrazit vše →
          </Link>
        </div>
      )}
    </section>
  )
}
