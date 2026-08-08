import { getMockPrice } from './mockPrices'

/**
 * Vzdálenost od cíle v %: ((cena - cíl) / cíl) × 100
 *
 * Signál:
 * 🟢 cena ≤ target_price — nákupní zóna (dokup zbytku pozice)
 * 🟡 cena > target_price ALE ≤ target_t1 — Tranše 1 (první třetina pozice)
 *    T1 ≈ do 10 % nad cílem
 * ⚪ cena > target_t1, nebo target_t1 je NULL
 */
export function enrichWatchlistItem(row) {
  const mock = getMockPrice(row.ticker)
  const price = mock?.price ?? null
  const currency = mock?.currency || row.currency || 'USD'
  const target = Number(row.target_price)
  const t1Raw = row.target_t1
  const t1 = t1Raw == null || t1Raw === '' ? NaN : Number(t1Raw)

  let distancePct = null
  if (price != null && Number.isFinite(target) && target !== 0) {
    distancePct = ((price - target) / target) * 100
  }

  let signal = { emoji: '⚪', label: 'Mimo zónu' }
  if (price != null && Number.isFinite(target)) {
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

export function enrichAndSort(items) {
  return items
    .map(enrichWatchlistItem)
    .sort((a, b) => a.absDistance - b.absDistance || String(a.ticker).localeCompare(String(b.ticker)))
}

export function filterByStatus(items, status) {
  return items.filter((r) => String(r.status || '').toLowerCase() === status)
}