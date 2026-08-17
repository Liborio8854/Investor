import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchLatestPrices, fetchTransactions, fetchWatchlist } from '../lib/api'
import { DEFAULT_FX } from '../lib/mockPrices'
import {
  computeBrkInfo,
  computeCurrencyExposure,
  computeDividendsTotal,
  computeInvested,
  computeInvestingDuration,
  computeNetCapital,
  computePortfolioValue,
  computePositionsForFilter,
  computeRealizedTrades,
  filterTransactionsByAccount,
  filterTransactionsByPortfolio,
  sumRealizedPnl,
} from '../lib/portfolio'
import { buildWatchlistNameMap } from '../lib/tickerNames'

export function usePositionsData(accountFilter = 'all', portfolioOwner = 'libor') {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [priceByTicker, setPriceByTicker] = useState(() => new Map())

  const fxMap = DEFAULT_FX

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (!user?.id) {
        setTransactions([])
        setWatchlist([])
        setPriceByTicker(new Map())
        return
      }
      const [txs, wl] = await Promise.all([
        fetchTransactions(user.id),
        fetchWatchlist(user.id),
      ])
      const tickers = [
        ...new Set(
          [...txs, ...wl]
            .map((r) => String(r.ticker || '').trim().toUpperCase())
            .filter(Boolean),
        ),
      ]
      let prices = new Map()
      try {
        prices = await fetchLatestPrices(tickers)
      } catch (priceErr) {
        console.warn('[positions] prices', priceErr)
      }
      setTransactions(txs)
      setWatchlist(wl)
      setPriceByTicker(prices)
    } catch (err) {
      console.error('[positions]', err)
      setError(err.message || 'Nepodařilo se načíst data ze Supabase')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    reload()
  }, [reload])

  const tickerNames = useMemo(() => buildWatchlistNameMap(watchlist), [watchlist])

  const portfolioTx = useMemo(
    () => filterTransactionsByPortfolio(transactions, portfolioOwner),
    [transactions, portfolioOwner],
  )

  const filteredTx = useMemo(() => {
    if (portfolioOwner === 'eda') return portfolioTx
    return filterTransactionsByAccount(portfolioTx, accountFilter)
  }, [portfolioTx, accountFilter, portfolioOwner])

  const positions = useMemo(() => {
    if (portfolioOwner === 'eda') {
      return computePositionsForFilter(portfolioTx, fxMap, 'all', priceByTicker)
    }
    return computePositionsForFilter(portfolioTx, fxMap, accountFilter, priceByTicker)
  }, [portfolioTx, fxMap, accountFilter, portfolioOwner, priceByTicker])

  const portfolioValue = useMemo(() => computePortfolioValue(positions), [positions])
  const costBasis = useMemo(() => computeInvested(positions), [positions])
  const exposure = useMemo(() => computeCurrencyExposure(positions), [positions])
  const brk = useMemo(() => computeBrkInfo(positions, portfolioValue), [positions, portfolioValue])

  const realizedPnl = useMemo(
    () => sumRealizedPnl(computeRealizedTrades(filteredTx, fxMap)),
    [filteredTx, fxMap],
  )

  const summary = useMemo(() => {
    const invested = computeNetCapital(filteredTx, fxMap)
    const dividendsCzk = computeDividendsTotal(filteredTx, fxMap)
    const unrealizedPnl = portfolioValue - costBasis
    const priceReturnCzk = unrealizedPnl + realizedPnl
    const totalReturnCzk = priceReturnCzk + dividendsCzk
    const denom = invested > 0 ? invested : 0
    const pct = (n) => (denom > 0 ? n / denom : 0)
    const duration = computeInvestingDuration(filteredTx)

    return {
      invested,
      portfolioValue,
      unrealizedPnl,
      unrealizedPct: pct(unrealizedPnl),
      realizedPnl,
      priceReturnCzk,
      priceReturnPct: pct(priceReturnCzk),
      dividendsCzk,
      totalReturnCzk,
      totalReturnPct: pct(totalReturnCzk),
      durationLabel: duration.label,
    }
  }, [filteredTx, fxMap, portfolioValue, costBasis, realizedPnl])

  return {
    loading,
    error,
    reload,
    positions,
    portfolioValue,
    invested: summary.invested,
    exposure,
    brk,
    summary,
    tickerNames,
    transactionsCount: portfolioTx.length,
  }
}
