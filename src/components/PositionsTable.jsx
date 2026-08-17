import { useState } from 'react'
import {
  formatCzk,
  formatDate,
  formatNum,
  formatPctPlain,
  formatPctSigned,
  formatPrice,
} from '../lib/format'

import { resolveTickerName } from '../lib/tickerNames'

function pnlColor(value) {
  return value >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'
}

function PositionLots({ lots }) {
  if (!lots?.length) {
    return <p className="text-xs text-[#94a3b8]">Žádné otevřené loty</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[#94a3b8]">
        FIFO loty — daňový test
      </p>
      {lots.map((lot, idx) => (
        <div
          key={`${lot.date}-${lot.account}-${idx}`}
          className="rounded-lg border border-[#e2e8f0] bg-slate-50/80 px-3 py-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-[#0f172a]">{formatDate(lot.date)}</p>
              <p className="mt-0.5 text-xs text-[#475569]">
                {formatNum(lot.qty)} ks · {formatPrice(lot.price, lot.currency)}
              </p>
              <p className="mt-0.5 text-[11px] text-[#94a3b8]">{lot.accountLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-[#475569]">{lot.ageLabel}</p>
              {lot.taxExempt ? (
                <p className="mt-1 text-xs font-medium text-[#059669]">✅ Osvobozeno</p>
              ) : (
                <p className="mt-1 text-xs text-[#475569]">⏳ {lot.exemptDateLabel}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function DividendSummary({ position }) {
  return (
    <div className="mt-3 rounded-lg border border-[#e2e8f0] px-3 py-2.5">
      <p className="text-sm text-[#0f172a]">
        Dividendy celkem:{' '}
        <span className="font-medium">{formatCzk(position.dividendsCzk)}</span>
        <span className="text-xs text-[#94a3b8]"> (čisté po dani)</span>
      </p>
      <p className="mt-1 text-xs text-[#475569]">
        Počet výplat: {position.dividendCount}
        {' · '}
        Dividendový výnos: {formatPctPlain(position.dividendYield)}
      </p>
    </div>
  )
}

function PositionCard({ position, weight, open, onToggle, companyName }) {
  const showDiv = position.dividendsCzk > 0

  return (
    <div className="border-t border-slate-100">
      <button type="button" onClick={onToggle} className="flex w-full gap-2 py-3 text-left">
        <span className="mt-1 shrink-0 text-xs text-[#94a3b8]">{open ? '▼' : '▶'}</span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <span className="min-w-0 text-[15px] leading-snug">
              <span className="font-semibold text-[#0f172a]">{position.ticker}</span>
              {companyName ? (
                <span className="font-normal text-[#64748b]"> ({companyName})</span>
              ) : null}
            </span>
            <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[#0f172a]">
              {formatCzk(position.valueCzk)}
            </span>
          </div>

          <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[13px]">
            <span className="min-w-0 text-[#475569]">
              <span className="uppercase">{position.currency}</span>
              {' · '}
              {formatNum(position.qty)} ks
              {position.avgBuyPrice > 0 ? (
                <>
                  {' · '}
                  Ø {formatPrice(position.avgBuyPrice, position.currency)}
                </>
              ) : null}
            </span>
            <span className={`shrink-0 font-semibold tabular-nums ${pnlColor(position.pricePnlPct)}`}>
              P&amp;L: {formatPctSigned(position.pricePnlPct)}
            </span>
          </div>

          <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs">
            <span className="tabular-nums text-[#94a3b8]">Váha: {formatPctPlain(weight)}</span>
            {showDiv ? (
              <span className="shrink-0 tabular-nums text-[#475569]">
                Div: {formatCzk(position.dividendsCzk)}
              </span>
            ) : (
              <span />
            )}
          </div>

          {showDiv && (
            <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs">
              <span />
              <span className="shrink-0 italic tabular-nums text-[#2563eb]">
                Total return: {formatPctSigned(position.totalReturnPct)}
              </span>
            </div>
          )}
        </div>
      </button>

      {open && (
        <div className="pb-3 pl-5">
          <PositionLots lots={position.lots} />
          <DividendSummary position={position} />
        </div>
      )}
    </div>
  )
}

export default function PositionsTable({ positions, portfolioValue, watchlistNames = {} }) {
  const [openTicker, setOpenTicker] = useState(null)

  if (!positions.length) {
    return <p className="py-6 text-center text-sm text-[#94a3b8]">Žádné otevřené pozice</p>
  }

  return (
    <div>
      {positions.map((p) => {
        const weight = portfolioValue > 0 ? p.valueCzk / portfolioValue : 0
        const open = openTicker === p.ticker
        const companyName = resolveTickerName(p.ticker, watchlistNames)
        return (
          <PositionCard
            key={p.ticker}
            position={p}
            weight={weight}
            open={open}
            companyName={companyName}
            onToggle={() => setOpenTicker(open ? null : p.ticker)}
          />
        )
      })}
    </div>
  )
}
