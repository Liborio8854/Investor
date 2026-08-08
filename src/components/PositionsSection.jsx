import { useState } from 'react'
import { formatCzk, formatPct } from '../lib/format'

export default function PositionsSection({ positions }) {
  const [open, setOpen] = useState(false)
  const n = positions.length

  return (
    <section className="border-t border-[#e2e8f0] py-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm font-semibold text-[#0f172a]"
      >
        <span className="text-[#94a3b8]">{open ? '▼' : '▶'}</span>
        Pozice ({n})
      </button>

      {open && (
        <div className="mt-3 overflow-x-auto">
          {n === 0 ? (
            <p className="text-sm text-[#94a3b8]">Žádné otevřené pozice</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-[#94a3b8]">
                  <th className="pb-2 font-medium">Ticker</th>
                  <th className="pb-2 font-medium text-right">Hodnota</th>
                  <th className="pb-2 font-medium text-right">Váha</th>
                  <th className="pb-2 font-medium text-right">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const total = positions.reduce((s, x) => s + x.valueCzk, 0)
                  const weight = total > 0 ? p.valueCzk / total : 0
                  const positive = p.pnlPct >= 0
                  return (
                    <tr key={p.ticker} className="border-t border-slate-100">
                      <td className="py-2.5">
                        <span className="font-medium text-[#0f172a]">{p.ticker}</span>
                        <span className="ml-1 text-[10px] uppercase text-[#94a3b8]">{p.currency}</span>
                      </td>
                      <td className="py-2.5 text-right text-[#475569]">{formatCzk(p.valueCzk)}</td>
                      <td className="py-2.5 text-right text-[#475569]">
                        {(weight * 100).toFixed(1)} %
                      </td>
                      <td
                        className={`py-2.5 text-right font-medium ${
                          positive ? 'text-[#059669]' : 'text-[#dc2626]'
                        }`}
                      >
                        {formatPct(p.pnlPct)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  )
}
