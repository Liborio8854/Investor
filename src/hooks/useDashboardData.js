import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchDashboardData } from '../lib/api'
import { currentYearMonth } from '../lib/format'
import { DEFAULT_FX } from '../lib/mockPrices'
import {
  computeCurrencyExposure,
  computeDipYearInvested,
  computeInvested,
  computeMonthlyXtbAllocated,
  computePortfolioValue,
  computePositions,
  computeRealizedTrades,
  dipBuyHistory,
  filterTransactionsByPortfolio,
  parseRuleNumber,
  sumRealizedPnl,
} from '../lib/portfolio'
import { resolveDipYearTarget } from '../lib/rules'

export function useDashboardData() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [rules, setRules] = useState([])

  const ym = currentYearMonth()
  const fxMap = DEFAULT_FX

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (!user?.id) {
        setTransactions([])
        setRules([])
        return
      }

      const data = await fetchDashboardData(user.id, ym)
      setTransactions(data.transactions)
      setRules(data.rules)
    } catch (err) {
      console.error('[dashboard]', err)
      setError(err.message || 'Nepodařilo se načíst data ze Supabase')
    } finally {
      setLoading(false)
    }
  }, [user?.id, ym])

  useEffect(() => {
    reload()
  }, [reload])

  const positions = useMemo(() => {
    const liborTx = filterTransactionsByPortfolio(transactions, 'libor')
    return computePositions(liborTx, fxMap)
  }, [transactions, fxMap])
  const portfolioValue = useMemo(() => computePortfolioValue(positions), [positions])
  const invested = useMemo(() => computeInvested(positions), [positions])
  const unrealizedPnl = portfolioValue - invested
  const unrealizedPct = invested > 0 ? unrealizedPnl / invested : 0

  const liborTx = useMemo(
    () => filterTransactionsByPortfolio(transactions, 'libor'),
    [transactions],
  )

  const realized = useMemo(() => computeRealizedTrades(liborTx, fxMap), [liborTx, fxMap])
  const realizedPnl = useMemo(() => sumRealizedPnl(realized), [realized])
  const exposure = useMemo(() => computeCurrencyExposure(positions), [positions])

  const xtbTarget = parseRuleNumber(rules, 'monthly_xtb', 10000)
  const dipYear = new Date().getFullYear()
  const dipTarget = resolveDipYearTarget(rules, dipYear)
  const xtbAllocated = useMemo(
    () => computeMonthlyXtbAllocated(liborTx, ym, fxMap),
    [liborTx, ym, fxMap],
  )
  const dipInvested = useMemo(
    () => computeDipYearInvested(liborTx, dipYear, fxMap),
    [liborTx, fxMap, dipYear],
  )
  const dipHistory = useMemo(
    () => dipBuyHistory(liborTx, dipYear, fxMap),
    [liborTx, fxMap, dipYear],
  )

  return {
    loading,
    error,
    reload,
    yearMonth: ym,
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
    dipYear,
    transactionsCount: liborTx.length,
  }
}
