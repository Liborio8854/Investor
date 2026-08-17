import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  deleteTransaction,
  fetchMonthlyTasks,
  fetchTransactions,
  fetchWatchlist,
  insertTransaction,
  updateMonthlyTask,
  updateTransaction,
} from '../lib/api'
import { currentYearMonth, todayISO } from '../lib/format'
import { DEFAULT_FX } from '../lib/mockPrices'
import {
  computeRealizedTrades,
  filterTransactionsByPortfolio,
  normalizePortfolio,
  toCzk,
} from '../lib/portfolio'
import { buildWatchlistNameMap, resolveTickerName } from '../lib/tickerNames'

function normalizeType(type) {
  return String(type || '').toUpperCase()
}

function normalizeAccount(account) {
  return String(account || '').toLowerCase()
}

function normalizeTicker(ticker) {
  return String(ticker || '').trim().toUpperCase()
}

export function filterTransactions(
  transactions,
  { typeFilter = 'all', accountFilter = 'all', portfolioFilter = 'libor' } = {},
) {
  const wantPortfolio = normalizePortfolio(portfolioFilter)
  return transactions.filter((tx) => {
    if (normalizePortfolio(tx.portfolio) !== wantPortfolio) return false
    if (typeFilter !== 'all' && normalizeType(tx.type) !== typeFilter) return false
    if (accountFilter !== 'all' && normalizeAccount(tx.account) !== accountFilter) return false
    return true
  })
}

export function sortTransactionsNewest(transactions) {
  return [...transactions].sort((a, b) => {
    const d = String(b.date || '').localeCompare(String(a.date || ''))
    if (d !== 0) return d
    return String(b.created_at || '').localeCompare(String(a.created_at || ''))
  })
}

export function countByType(transactions) {
  const counts = { total: transactions.length, BUY: 0, SELL: 0, DIVIDEND: 0 }
  for (const tx of transactions) {
    const t = normalizeType(tx.type)
    if (t in counts) counts[t] += 1
  }
  return counts
}

/** Find open monthly task mentioning ticker (title / description / recommendation). */
export function findOpenTaskForTicker(tasks, ticker) {
  const needle = normalizeTicker(ticker)
  if (!needle) return null
  return (
    tasks.find((task) => {
      if (task.completed || task.cancelled) return false
      const hay = `${task.title || ''} ${task.description || ''} ${task.recommendation_text || ''}`.toUpperCase()
      return hay.includes(needle)
    }) || null
  )
}

export function enrichTransaction(tx, fxMap, realizedById, watchlistNames = {}) {
  const currency = String(tx.currency || 'CZK').toUpperCase()
  const qty = Number(tx.quantity) || 0
  const price = Number(tx.price) || 0
  const fees = Number(tx.fees) || 0
  const valueCzk = toCzk(qty * price, currency, fxMap)
  const feesCzk = toCzk(fees, currency, fxMap)
  const type = normalizeType(tx.type)
  const realized = type === 'SELL' ? realizedById.get(tx.id) : null

  return {
    ...tx,
    type,
    currency,
    qty,
    price,
    fees,
    valueCzk,
    feesCzk,
    companyName: resolveTickerName(tx.ticker, watchlistNames),
    accountLabel: normalizeAccount(tx.account).toUpperCase() || '—',
    pnlCzk: realized?.pnlCzk ?? null,
    pnlPct: realized?.pnlPct ?? null,
  }
}

export function useTransactionsData() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [tasks, setTasks] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [typeFilter, setTypeFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [portfolioFilter, setPortfolioFilter] = useState('libor')
  const [visibleCount, setVisibleCount] = useState(20)

  const fxMap = DEFAULT_FX
  const ym = currentYearMonth()

  const reload = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        if (!user?.id) {
          setTransactions([])
          setTasks([])
          setWatchlist([])
          return
        }
        const [txs, monthTasks, wl] = await Promise.all([
          fetchTransactions(user.id),
          fetchMonthlyTasks(user.id, ym),
          fetchWatchlist(user.id),
        ])
        setTransactions(txs)
        setTasks(monthTasks)
        setWatchlist(wl)
      } catch (err) {
        console.error('[transactions]', err)
        setError(err.message || 'Nepodařilo se načíst transakce')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [user?.id, ym],
  )

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    setVisibleCount(20)
  }, [typeFilter, accountFilter, portfolioFilter])

  const filtered = useMemo(
    () => filterTransactions(transactions, { typeFilter, accountFilter, portfolioFilter }),
    [transactions, typeFilter, accountFilter, portfolioFilter],
  )

  const sorted = useMemo(() => sortTransactionsNewest(filtered), [filtered])

  const realizedById = useMemo(() => {
    const map = new Map()
    const portfolioTx = filterTransactionsByPortfolio(transactions, portfolioFilter)
    for (const r of computeRealizedTrades(portfolioTx, fxMap)) {
      map.set(r.id, r)
    }
    return map
  }, [transactions, portfolioFilter, fxMap])

  const watchlistNames = useMemo(() => buildWatchlistNameMap(watchlist), [watchlist])

  const enriched = useMemo(
    () => sorted.map((tx) => enrichTransaction(tx, fxMap, realizedById, watchlistNames)),
    [sorted, fxMap, realizedById, watchlistNames],
  )

  const visible = useMemo(() => enriched.slice(0, visibleCount), [enriched, visibleCount])
  const hasMore = visibleCount < enriched.length
  const counts = useMemo(() => countByType(filtered), [filtered])

  const loadMore = useCallback(() => {
    setVisibleCount((n) => n + 20)
  }, [])

  const addTransaction = useCallback(
    async (payload) => {
      if (!user?.id) throw new Error('Nejste přihlášeni')
      const row = await insertTransaction({ ...payload, user_id: user.id })
      await reload({ silent: true })

      let matchedTask = null
      // Eda se neřídí měsíčními úkoly
      if (
        normalizeType(payload.type) === 'BUY' &&
        normalizePortfolio(payload.portfolio) === 'libor'
      ) {
        matchedTask = findOpenTaskForTicker(tasks, payload.ticker)
      }
      return { row, matchedTask }
    },
    [user?.id, reload, tasks],
  )

  const editTransaction = useCallback(
    async (id, patch) => {
      await updateTransaction(id, patch)
      await reload({ silent: true })
    },
    [reload],
  )

  const removeTransaction = useCallback(
    async (id) => {
      await deleteTransaction(id)
      await reload({ silent: true })
    },
    [reload],
  )

  const completeTask = useCallback(
    async (taskId) => {
      await updateMonthlyTask(taskId, { completed: true, completed_date: todayISO() })
      await reload({ silent: true })
    },
    [reload],
  )

  return {
    loading,
    error,
    reload,
    transactions: visible,
    allFilteredCount: enriched.length,
    hasMore,
    loadMore,
    counts,
    typeFilter,
    setTypeFilter,
    accountFilter,
    setAccountFilter,
    portfolioFilter,
    setPortfolioFilter,
    addTransaction,
    editTransaction,
    removeTransaction,
    completeTask,
    watchlist,
  }
}
