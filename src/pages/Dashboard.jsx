import { useDashboardData } from '../hooks/useDashboardData'
import PortfolioSummary from '../components/PortfolioSummary'
import PositionsSection from '../components/PositionsSection'
import DailyRecommendations from '../components/DailyRecommendations'
import MonthlyAllocation from '../components/MonthlyAllocation'
import RealizedTrades from '../components/RealizedTrades'

export default function Dashboard() {
  const {
    loading,
    error,
    reload,
    positions,
    portfolioValue,
    invested,
    unrealizedPnl,
    unrealizedPct,
    realized,
    realizedPnl,
    exposure,
    xtbTarget,
    xtbAllocated,
    dipTarget,
    dipInvested,
    dipHistory,
    transactionsCount,
  } = useDashboardData()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[#94a3b8]">
        Načítám portfolio…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-[#dc2626]">
        <p>{error}</p>
        <button type="button" onClick={reload} className="mt-2 underline">
          Zkusit znovu
        </button>
      </div>
    )
  }

  return (
    <div>
      {transactionsCount === 0 && (
        <div className="mb-4 rounded-lg border border-[#e2e8f0] bg-slate-50 px-3 py-2.5 text-xs text-[#475569]">
          Zatím žádné transakce v <code className="text-[11px]">inv_transactions</code>. Portfolio
          se naplní po přidání BUY/SELL záznamů.
        </div>
      )}

      <PortfolioSummary
        value={portfolioValue}
        invested={invested}
        unrealizedPnl={unrealizedPnl}
        unrealizedPct={unrealizedPct}
        realizedPnl={realizedPnl}
        exposure={exposure}
      />

      <PositionsSection positions={positions} />

      <DailyRecommendations />

      <MonthlyAllocation
        xtbTarget={xtbTarget}
        xtbAllocated={xtbAllocated}
        dipTarget={dipTarget}
        dipInvested={dipInvested}
        dipHistory={dipHistory}
      />

      <RealizedTrades trades={realized} totalPnl={realizedPnl} />
    </div>
  )
}
