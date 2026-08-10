import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchLatestPrices, fetchWatchlist, insertWatchlistItem, updateWatchlistItem } from '../lib/api'
import { enrichAndSort, filterByStatus } from '../lib/watchlist'

export function useWatchlistData() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  const [priceByTicker, setPriceByTicker] = useState(() => new Map())

  const reload = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        if (!user?.id) {
          setItems([])
          setPriceByTicker(new Map())
          return
        }
        const rows = await fetchWatchlist(user.id)
        const tickers = rows.map((r) => r.ticker)
        let prices = new Map()
        try {
          prices = await fetchLatestPrices(tickers)
        } catch (priceErr) {
          console.warn('[watchlist] prices', priceErr)
        }
        setItems(rows)
        setPriceByTicker(prices)
      } catch (err) {
        console.error('[watchlist]', err)
        setError(err.message || 'Nepodařilo se načíst watchlist')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [user?.id],
  )

  useEffect(() => {
    reload()
  }, [reload])

  const enriched = useMemo(() => enrichAndSort(items, priceByTicker), [items, priceByTicker])

  const active = useMemo(() => filterByStatus(enriched, 'active'), [enriched])
  const brk = useMemo(() => filterByStatus(enriched, 'brk_section'), [enriched])
  const watched = useMemo(() => filterByStatus(enriched, 'watched'), [enriched])
  const removed = useMemo(() => filterByStatus(enriched, 'removed'), [enriched])

  const addItem = useCallback(
    async (payload) => {
      if (!user?.id) throw new Error('Nejste přihlášeni')
      await insertWatchlistItem({ ...payload, user_id: user.id })
      await reload({ silent: true })
    },
    [user?.id, reload],
  )

  const updateItem = useCallback(
    async (id, patch) => {
      await updateWatchlistItem(id, patch)
      await reload({ silent: true })
    },
    [reload],
  )

  const softRemove = useCallback(
    async (id) => {
      await updateWatchlistItem(id, { status: 'removed' })
      await reload({ silent: true })
    },
    [reload],
  )

  return {
    loading,
    error,
    reload,
    active,
    brk,
    watched,
    removed,
    addItem,
    updateItem,
    softRemove,
  }
}
