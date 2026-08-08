import { formatCzk, formatNum, formatPctPlain, formatPctSigned, signedCzk } from '../lib/format'

function pnlColor(value) {
  return value >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'
}

export default function PositionsSummary({ summary }) {
  return (
    <section className="mt-4 border-t border-[#e2e8f0] pt-4">
      <h2 className="mb-3 text-sm font-semibold text-[#0f172a]">Souhrn</h2>

      <div className="space-y-2.5 text-sm">
        <SummaryRow label="Čistě investováno" value={formatCzk(summary.invested)} />
        <SummaryRow
          label="Aktuální hodnota"
          value={formatCzk(summary.portfolioValue)}
          valueClass="font-semibold text-[#0f172a]"
        />
      </div>

      <div className="mt-3 space-y-2.5 border-t border-[#e2e8f0] pt-3 text-sm">
        <SummaryRow
          label="Nerealizovaný P&L"
          value={`${signedCzk(summary.unrealizedPnl)} (${formatPctSigned(summary.unrealizedPct)})`}
          valueClass={`font-medium tabular-nums ${pnlColor(summary.unrealizedPnl)}`}
        />
        <SummaryRow
          label="Realizovaný P&L"
          value={signedCzk(summary.realizedPnl)}
          valueClass={`font-medium tabular-nums ${pnlColor(summary.realizedPnl)}`}
        />
        <SummaryRow
          label="Cenový return celkem"
          value={`${signedCzk(summary.priceReturnCzk)} (${formatPctSigned(summary.priceReturnPct)})`}
          valueClass={`font-medium tabular-nums ${pnlColor(summary.priceReturnCzk)}`}
        />
      </div>

      <div className="mt-3 space-y-2.5 border-t border-[#e2e8f0] pt-3 text-sm">
        <SummaryRow
          label="Dividendy celkem"
          value={formatCzk(summary.dividendsCzk)}
          valueClass="font-medium tabular-nums text-[#0f172a]"
        />
      </div>

      <div className="mt-3 border-t border-[#e2e8f0] pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[#0f172a]">Total return</span>
          <span className={`text-base font-semibold tabular-nums ${pnlColor(summary.totalReturnCzk)}`}>
            {signedCzk(summary.totalReturnCzk)} ({formatPctSigned(summary.totalReturnPct)})
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#e2e8f0] pt-3 text-xs text-[#94a3b8]">
        <span>Doba investování</span>
        <span className="tabular-nums">{summary.durationLabel}</span>
      </div>
    </section>
  )
}

function SummaryRow({ label, value, valueClass = 'tabular-nums text-[#0f172a]' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#475569]">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  )
}

function brkRowStyle(weight, limit = 0.2, hardCap = 0.25) {
  if (weight > hardCap) {
    return { className: 'text-[#dc2626]', warning: '🔴 nad tvrdým stropem' }
  }
  if (weight >= limit) {
    return { className: 'text-[#d97706]', warning: '⚠️ nad limitem' }
  }
  return { className: 'text-[#059669]', warning: null }
}

export function BrkInfoRow({ brk }) {
  const { className, warning } = brkRowStyle(brk.weight, brk.limit, brk.hardCap)
  return (
    <p className={`text-xs leading-relaxed ${className}`}>
      BRK celkem: {formatNum(brk.qty)} ks = {formatCzk(brk.valueCzk)} = {formatPctPlain(brk.weight)}{' '}
      portfolia (limit {formatPctPlain(brk.limit)})
      {warning ? ` ${warning}` : ''}
    </p>
  )
}

const TABS = [
  { id: 'all', label: 'Vše' },
  { id: 'xtb_fio', label: 'XTB + FIO' },
  { id: 'dip', label: 'DIP' },
]

const PORTFOLIO_TABS = [
  { id: 'libor', label: 'Libor' },
  { id: 'eda', label: 'Eda' },
]

export function PositionsTabs({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-[#93c5fd] text-[#1e40af]'
                : 'border border-[#e2e8f0] bg-transparent text-[#64748b] hover:border-[#93c5fd] hover:text-[#1e40af]'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function PortfolioTabs({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {PORTFOLIO_TABS.map((tab) => {
        const active = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-[#2563eb] text-white'
                : 'bg-transparent text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
