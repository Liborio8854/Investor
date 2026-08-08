import { formatNum } from '../lib/format'

function fmtPrice(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return formatNum(n)
}

/** České formátování: "+3,4 %" / "-2,1 %" */
function fmtDist(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  const abs = Math.abs(n).toFixed(1).replace('.', ',')
  return `${sign}${abs} %`
}

export default function WatchlistTable({
  rows,
  onRowClick,
  onRemove,
  rowAction,
  emptyText = 'Žádné tituly',
}) {
  if (!rows?.length) {
    return <p className="py-4 text-sm text-[#94a3b8]">{emptyText}</p>
  }

  const showRemove = Boolean(onRemove)
  const showRestore = Boolean(rowAction)

  return (
    <table className="w-full table-fixed text-left text-xs">
      <colgroup>
        <col style={{ width: showRestore ? '15%' : '16%' }} />
        <col style={{ width: showRestore ? '18%' : '22%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '16%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: showRestore ? '15%' : '10%' }} />
      </colgroup>
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-[#94a3b8]">
          <th className="pb-2 pr-1 font-medium">Ticker</th>
          <th className="pb-2 pr-1 font-medium">Název</th>
          <th className="pb-2 pr-1 text-right font-medium">Cena</th>
          <th className="pb-2 pr-1 text-right font-medium">Cíl</th>
          <th className="pb-2 pr-1 text-right font-medium">Vzdál.</th>
          <th className="pb-2 font-medium" />
          <th className="pb-2 font-medium" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
            onClick={() => onRowClick?.(row)}
          >
            <td className="py-2 pr-1 align-top">
              <div className="truncate font-semibold text-[#0f172a]">{row.ticker}</div>
              <div className="text-[10px] uppercase leading-tight text-[#94a3b8]">
                {row.displayCurrency}
              </div>
            </td>
            <td className="truncate py-2 pr-1 align-middle text-[#475569]" title={row.name || ''}>
              {row.name || '—'}
            </td>
            <td className="py-2 pr-1 text-right align-middle tabular-nums text-[#0f172a]">
              {fmtPrice(row.price)}
            </td>
            <td className="py-2 pr-1 text-right align-middle tabular-nums text-[#475569]">
              {fmtPrice(row.target_price)}
            </td>
            <td
              className={`py-2 pr-1 text-right align-middle tabular-nums font-medium ${
                row.distancePct != null && row.distancePct <= 0 ? 'text-[#059669]' : 'text-[#475569]'
              }`}
            >
              {fmtDist(row.distancePct)}
            </td>
            <td className="py-2 pl-1 align-middle">
              <span className="text-sm leading-none" title={row.signal?.label}>
                {row.signal?.emoji ?? '⚪'}
              </span>
            </td>
            <td className="py-2 pl-2 align-middle">
              {showRemove && (
                <button
                  type="button"
                  title="Přesunout do vyřazených"
                  aria-label={`Přesunout ${row.ticker} do vyřazených`}
                  className="text-[14px] leading-none text-[#cbd5e1] transition-colors hover:text-[#dc2626]"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(row)
                  }}
                >
                  ✕
                </button>
              )}
              {showRestore && (
                <button
                  type="button"
                  className="whitespace-nowrap text-[12px] font-medium leading-none text-[#2563eb] hover:underline"
                  onClick={(e) => {
                    e.stopPropagation()
                    rowAction.onClick(row)
                  }}
                >
                  {rowAction.label}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}