import { useState } from 'react'
import { usePositionsData } from '../hooks/usePositionsData'
import CurrencyExposureBar from '../components/CurrencyExposureBar'
import PositionsTable from '../components/PositionsTable'
import PositionsSummary, {
  BrkInfoRow,
  PortfolioTabs,
  PositionsTabs,
} from '../components/PositionsSummary'

export default function Positions() {
  const [portfolioOwner, setPortfolioOwner] = useState('libor')
  const [accountFilter, setAccountFilter] = useState('all')
  const {
    loading,
    error,
    reload,
    positions,
    portfolioValue,
    exposure,
    brk,
    summary,
    tickerNames,
    transactionsCount,
  } = usePositionsData(accountFilter, portfolioOwner)

  const isEda = portfolioOwner === 'eda'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[#94a3b8]">
        Načítám pozice…
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
      <h1 className="text-lg font-semibold text-[#0f172a]">Pozice</h1>

      <div className="mt-3">
        <PortfolioTabs value={portfolioOwner} onChange={setPortfolioOwner} />
      </div>

      {!isEda && (
        <>
          <div className="mt-3">
            <PositionsTabs value={accountFilter} onChange={setAccountFilter} />
          </div>

          <div className="mt-3">
            <BrkInfoRow brk={brk} />
          </div>

          <div className="mt-4">
            <CurrencyExposureBar exposure={exposure} />
          </div>
        </>
      )}

      {isEda && (
        <p className="mt-3 text-xs text-[#94a3b8]">
          Portfolio Eda · {positions.length} {czechPozice(positions.length)}
        </p>
      )}

      {transactionsCount === 0 && (
        <div className="mt-4 rounded-lg border border-[#e2e8f0] bg-slate-50 px-3 py-2.5 text-xs text-[#475569]">
          Zatím žádné transakce pro toto portfolio.
        </div>
      )}

      <section className="mt-5 border-t border-[#e2e8f0] pt-2">
        <PositionsTable
          positions={positions}
          portfolioValue={portfolioValue}
          watchlistNames={tickerNames}
        />
      </section>

      {positions.length > 0 && <PositionsSummary summary={summary} />}
    </div>
  )
}

function czechPozice(n) {
  if (n === 1) return 'pozice'
  if (n >= 2 && n <= 4) return 'pozice'
  return 'pozic'
}
