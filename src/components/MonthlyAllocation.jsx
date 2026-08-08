import { useState } from 'react'
import { formatCzk, formatDate } from '../lib/format'

function progressColor(pct, variant) {
  if (variant === 'dip') return '#7c3aed'
  if (pct >= 1) return '#059669'
  if (pct >= 0.6) return '#2563eb'
  return '#eab308'
}

function ProgressBar({ value, target, variant = 'xtb' }) {
  const pct = target > 0 ? Math.min(value / target, 1.15) : 0
  const fill = Math.min(pct, 1) * 100
  const color = progressColor(target > 0 ? value / target : 0, variant)

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-[#475569]">
        <span>{formatCzk(value)}</span>
        <span>cíl {formatCzk(target)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${fill}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-1 text-right text-xs text-[#94a3b8]">
        {target > 0 ? `${Math.round((value / target) * 100)} %` : '—'}
      </p>
    </div>
  )
}

export default function MonthlyAllocation({
  xtbTarget,
  xtbAllocated,
  dipTarget,
  dipInvested,
  dipHistory,
  dipYear = new Date().getFullYear(),
}) {
  const [dipOpen, setDipOpen] = useState(false)

  return (
    <section className="border-t border-[#e2e8f0] py-5">
      <h2 className="mb-3 text-sm font-semibold text-[#0f172a]">Měsíční alokace</h2>

      <div className="space-y-3">
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#0f172a]">XTB (měsíčně)</h3>
          <div className="mt-3">
            <ProgressBar value={xtbAllocated} target={xtbTarget} variant="xtb" />
          </div>
        </div>

        <div className="rounded-lg border border-[#e2e8f0] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#0f172a]">DIP (roční)</h3>
          <div className="mt-3">
            <ProgressBar value={dipInvested} target={dipTarget} variant="dip" />
          </div>

          <button
            type="button"
            onClick={() => setDipOpen((v) => !v)}
            className="mt-3 flex w-full items-center gap-2 text-left text-xs font-medium text-[#475569]"
          >
            <span>{dipOpen ? '▼' : '▶'}</span>
            Historie nákupů ({dipHistory.length})
          </button>

          {dipOpen && (
            <ul className="mt-2 space-y-1.5">
              {dipHistory.length === 0 ? (
                <li className="text-xs text-[#94a3b8]">
                  Zatím žádné nákupy DIP v roce {dipYear}
                </li>
              ) : (
                dipHistory.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between text-xs text-[#475569]"
                  >
                    <span>
                      {formatDate(row.date)} · {row.ticker}
                    </span>
                    <span className="font-medium text-[#0f172a]">{formatCzk(row.valueCzk)}</span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
