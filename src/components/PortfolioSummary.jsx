import { formatCzk, formatPct, signedCzk } from '../lib/format'
import CurrencyExposureBar from './CurrencyExposureBar'

export default function PortfolioSummary({ value, invested, unrealizedPnl, unrealizedPct, realizedPnl, exposure }) {
  const unrealizedPositive = unrealizedPnl >= 0
  const realizedPositive = realizedPnl >= 0

  return (
    <section className="pb-5">
      <p className="text-xs font-medium uppercase tracking-wider text-[#94a3b8]">Portfolio</p>
      <p className="mt-1 text-4xl font-bold tracking-tight text-[#0f172a]">{formatCzk(value)}</p>
      <p className="mt-2 text-sm text-[#475569]">Investováno: {formatCzk(invested)}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-[#94a3b8]">Nerealizovaný P&amp;L</p>
          <p className={`text-sm font-semibold ${unrealizedPositive ? 'text-[#059669]' : 'text-[#dc2626]'}`}>
            {signedCzk(unrealizedPnl)} ({formatPct(unrealizedPct)})
          </p>
        </div>
        <div>
          <p className="text-xs text-[#94a3b8]">Realizovaný P&amp;L</p>
          <p className={`text-sm font-semibold ${realizedPositive ? 'text-[#059669]' : 'text-[#dc2626]'}`}>
            {signedCzk(realizedPnl)}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <CurrencyExposureBar exposure={exposure} />
      </div>
    </section>
  )
}
