import {
  formatCzk,
  formatDate,
  formatMoney,
  formatNum,
  formatPctSigned,
  signedCzk,
} from '../lib/format'

const BADGE = {
  BUY: { label: 'BUY', emoji: '🟢', className: 'bg-emerald-50 text-[#059669]' },
  SELL: { label: 'SELL', emoji: '🔴', className: 'bg-red-50 text-[#dc2626]' },
  DIVIDEND: { label: 'DIV', emoji: '🟣', className: 'bg-violet-50 text-[#7c3aed]' },
}

function pnlColor(value) {
  return value >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'
}

export default function TransactionList({ transactions, onSelect }) {
  if (!transactions.length) {
    return <p className="py-8 text-center text-sm text-[#94a3b8]">Žádné transakce</p>
  }

  return (
    <div>
      {transactions.map((tx) => (
        <TransactionCard key={tx.id} tx={tx} onClick={() => onSelect?.(tx)} />
      ))}
    </div>
  )
}

function TransactionCard({ tx, onClick }) {
  const badge = BADGE[tx.type] || BADGE.BUY
  const feeLabel = tx.type === 'DIVIDEND' ? 'Daň' : 'Popl'

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full border-t border-[#f1f5f9] py-3 text-left hover:bg-slate-50/80"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.className}`}
          >
            <span aria-hidden>{badge.emoji}</span>
            {badge.label}
          </span>
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[#0f172a]">{tx.ticker}</span>
            {tx.companyName ? (
              <span className="block truncate text-xs text-[#64748b]">{tx.companyName}</span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-xs text-[#94a3b8]">{formatDate(tx.date)}</span>
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-[#475569]">
          {formatNum(tx.qty)} ks × {formatMoney(tx.price, tx.currency)}
        </span>
        <span className="shrink-0 tabular-nums text-[#94a3b8]">
          {feeLabel}: {formatCzk(tx.feesCzk)}
        </span>
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-[#94a3b8]">{tx.accountLabel}</span>
        <span className="font-semibold tabular-nums text-[#0f172a]">
          CZK {(Math.round(Number(tx.valueCzk) || 0)).toLocaleString('cs-CZ')}
        </span>
      </div>

      {tx.type === 'SELL' && tx.pnlCzk != null && (
        <p className={`mt-1 text-xs font-medium tabular-nums ${pnlColor(tx.pnlCzk)}`}>
          P&amp;L: {signedCzk(tx.pnlCzk)} ({formatPctSigned(tx.pnlPct)})
        </p>
      )}
    </button>
  )
}
