import { getMockPrice } from './mockPrices'

/**
 * Vzdálenost od cíle v %: ((cena - cíl) / cíl) × 100
 *
 * Signál:
 * 🟢 cena ≤ target_price — nákupní zóna (dokup zbytku pozice)
 * 🟡 cena > target_price ALE ≤ target_t1 — Tranše 1 (první třetina pozice)
 *    T1 ≈ do 10 % nad cílem
 * ⚪ cena > target_t1, nebo target_t1 je NULL
 *
 * @param {object} row — řádek inv_watchlist
 * @param {Map<string, { price: number, date?: string }>|Record<string, number|{price:number}>|null} [priceByTicker]
 *        aktuální ceny z inv_prices (preferované); bez záznamu → mock fallback
 */
export function enrichWatchlistItem(row, priceByTicker = null) {
  const ticker = String(row.ticker || '').trim().toUpperCase()
  const fromDb = resolvePriceEntry(priceByTicker, ticker)
  const mock = fromDb == null ? getMockPrice(row.ticker) : null

  const price = fromDb?.price ?? mock?.price ?? null
  const currency = row.currency || mock?.currency || 'USD'

  const targetRaw = row.target_price
  const target =
    targetRaw != null && String(targetRaw).trim() !== '' ? Number(targetRaw) : NaN
  const hasTarget = Number.isFinite(target) && target !== 0

  const t1Raw = row.target_t1
  const t1 = t1Raw == null || t1Raw === '' ? NaN : Number(t1Raw)

  let distancePct = null
  if (price != null && hasTarget) {
    distancePct = ((price - target) / target) * 100
  }

  let signal = { emoji: '⚪', label: hasTarget ? 'Mimo zónu' : 'Bez cíle' }
  if (price != null && hasTarget) {
    if (price <= target) {
      signal = { emoji: '🟢', label: 'V nákupní zóně' }
    } else if (Number.isFinite(t1) && price <= t1) {
      signal = { emoji: '🟡', label: 'Tranše 1' }
    } else {
      signal = { emoji: '⚪', label: 'Mimo zónu' }
    }
  }

  return {
    ...row,
    price,
    displayCurrency: currency,
    distancePct,
    absDistance: distancePct == null ? Number.POSITIVE_INFINITY : Math.abs(distancePct),
    signal,
  }
}

function resolvePriceEntry(priceByTicker, ticker) {
  if (!priceByTicker || !ticker) return null

  const raw =
    typeof priceByTicker.get === 'function'
      ? priceByTicker.get(ticker)
      : priceByTicker[ticker]

  if (raw == null) return null
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { price: raw } : null
  }
  const price = raw.price != null ? Number(raw.price) : null
  if (price == null || !Number.isFinite(price)) return null
  return { price, date: raw.date }
}

export function enrichAndSort(items, priceByTicker = null) {
  return items
    .map((row) => enrichWatchlistItem(row, priceByTicker))
    .sort((a, b) => a.absDistance - b.absDistance || String(a.ticker).localeCompare(String(b.ticker)))
}

export function filterByStatus(items, status) {
  return items.filter((r) => String(r.status || '').toLowerCase() === status)
}
