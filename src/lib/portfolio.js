import { DEFAULT_FX } from './mockPrices'

/**
 * Build FX map: currency -> CZK rate from inv_fx_rates rows ({ pair, rate, date })
 * pair format e.g. "EUR/CZK"
 */
export function buildFxMap(fxRows = []) {
  const map = { ...DEFAULT_FX }
  const sorted = [...fxRows].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  for (const row of sorted) {
    const pair = String(row.pair || '')
    const [base, quote] = pair.split('/')
    if (quote === 'CZK' && base && row.rate != null && map[base] === DEFAULT_FX[base]) {
      map[base] = Number(row.rate)
    }
  }
  return map
}

export function toCzk(amount, currency, fxMap) {
  const cur = String(currency || 'CZK').toUpperCase()
  const rate = fxMap[cur] ?? DEFAULT_FX[cur] ?? 1
  return Number(amount || 0) * rate
}

function normalizeTicker(ticker) {
  return String(ticker || '').trim().toUpperCase()
}

/** Cena z inv_prices mapy (fetchLatestPrices). Bez záznamu → null. */
function latestMarketPrice(priceByTicker, ticker) {
  if (!priceByTicker || !ticker) return null
  const raw =
    typeof priceByTicker.get === 'function'
      ? priceByTicker.get(ticker) ?? priceByTicker.get(normalizeTicker(ticker))
      : priceByTicker[ticker] ?? priceByTicker[normalizeTicker(ticker)]
  if (raw == null) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const n = raw.price != null ? Number(raw.price) : null
  return n != null && Number.isFinite(n) ? n : null
}

function isBuy(type) {
  return String(type || '').toUpperCase() === 'BUY'
}

function isSell(type) {
  return String(type || '').toUpperCase() === 'SELL'
}

function isDividend(type) {
  return String(type || '').toUpperCase() === 'DIVIDEND'
}

export const BRK_TICKER = 'BRYN.DE'
export const TAX_EXEMPT_DAYS = 1095

/** Normalize portfolio owner; missing/null → libor (zpětná kompatibilita). */
export function normalizePortfolio(portfolio) {
  const p = String(portfolio || '').trim().toLowerCase()
  if (p === 'eda') return 'eda'
  return 'libor'
}

/** Filter by portfolio owner: 'libor' | 'eda' */
export function filterTransactionsByPortfolio(transactions, portfolio = 'libor') {
  const want = normalizePortfolio(portfolio)
  return transactions.filter((tx) => normalizePortfolio(tx.portfolio) === want)
}

/** Filter tabs: all | xtb_fio | dip */
export function filterTransactionsByAccount(transactions, accountFilter = 'all') {
  if (accountFilter === 'all') return transactions
  return transactions.filter((tx) => {
    const acc = String(tx.account || '').toLowerCase()
    if (accountFilter === 'xtb_fio') return acc === 'xtb' || acc === 'fio'
    if (accountFilter === 'dip') return acc === 'dip'
    return true
  })
}

function parseDateOnly(dateStr) {
  if (!dateStr) return null
  const d = new Date(String(dateStr).slice(0, 10) + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

/** Age as { years, months, days } from buy date to asOf. */
export function computeLotAge(buyDate, asOf = new Date()) {
  const start = parseDateOnly(buyDate)
  if (!start) return { years: 0, months: 0, days: 0 }

  const end = new Date(asOf)
  end.setHours(12, 0, 0, 0)

  let days = Math.floor((end - start) / (1000 * 60 * 60 * 24))
  if (days < 0) days = 0

  let years = end.getFullYear() - start.getFullYear()
  let months = end.getMonth() - start.getMonth()
  if (end.getDate() < start.getDate()) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }
  if (years < 0) {
    years = 0
    months = 0
  }

  return { years, months, days }
}

export function formatLotAge({ years, months }) {
  return `${years}r ${months}m`
}

/** Buy date + 3 calendar years → exemption date. */
export function taxExemptDate(buyDate) {
  const d = parseDateOnly(buyDate)
  if (!d) return null
  const out = new Date(d)
  out.setFullYear(out.getFullYear() + 3)
  return out
}

export function formatTaxExemptDate(buyDate) {
  const d = taxExemptDate(buyDate)
  if (!d) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

export function formatAccountLabel(account) {
  const a = String(account || '').toLowerCase()
  if (a === 'xtb') return 'XTB'
  if (a === 'fio') return 'FIO'
  if (a === 'dip') return 'DIP'
  return account ? String(account).toUpperCase() : '—'
}

function enrichOpenLots(lots, asOf = new Date()) {
  return lots
    .filter((lot) => lot.remaining > 1e-9)
    .map((lot) => {
      const age = computeLotAge(lot.date, asOf)
      const taxExempt = age.days > TAX_EXEMPT_DAYS
      return {
        date: lot.date,
        qty: lot.remaining,
        price: lot.price,
        currency: lot.currency,
        account: lot.account,
        accountLabel: formatAccountLabel(lot.account),
        age,
        ageLabel: formatLotAge(age),
        taxExempt,
        exemptDateLabel: taxExempt ? null : formatTaxExemptDate(lot.date),
      }
    })
}

function computeDividendsByTicker(transactions, fxMap) {
  const map = new Map()
  for (const tx of transactions) {
    if (!isDividend(tx.type)) continue
    const ticker = normalizeTicker(tx.ticker)
    if (!ticker) continue
    const cur = String(tx.currency || 'CZK').toUpperCase()
    const amount = toCzk(Number(tx.price) * Number(tx.quantity), cur, fxMap)
    const prev = map.get(ticker) || { dividendsCzk: 0, dividendCount: 0 }
    prev.dividendsCzk += amount
    prev.dividendCount += 1
    map.set(ticker, prev)
  }
  return map
}

/**
 * Open positions from transactions: qty = SUM(BUY) - SUM(SELL), keep qty > 0.
 * BRYN.DE merges XTB + DIP into one row when both accounts are included.
 * Average price = weighted average of remaining FIFO lots (original currency).
 */
export function computePositions(transactions, fxMap, asOf = new Date(), priceByTicker = null) {
  const byTicker = new Map()
  const dividendsByTicker = computeDividendsByTicker(transactions, fxMap)

  const sorted = [...transactions].sort((a, b) => {
    const d = String(a.date).localeCompare(String(b.date))
    if (d !== 0) return d
    return String(a.created_at || '').localeCompare(String(b.created_at || ''))
  })

  for (const tx of sorted) {
    const ticker = normalizeTicker(tx.ticker)
    if (!ticker) continue
    if (isDividend(tx.type)) continue

    if (!byTicker.has(ticker)) {
      byTicker.set(ticker, {
        ticker,
        currency: String(tx.currency || 'CZK').toUpperCase(),
        qty: 0,
        costCzk: 0,
        lots: [],
        accounts: new Set(),
      })
    }

    const pos = byTicker.get(ticker)
    if (tx.currency) pos.currency = String(tx.currency).toUpperCase()
    if (tx.account) pos.accounts.add(String(tx.account).toLowerCase())

    const qty = Number(tx.quantity) || 0
    const price = Number(tx.price) || 0
    const txCurrency = String(tx.currency || pos.currency || 'CZK').toUpperCase()

    if (isBuy(tx.type)) {
      pos.qty += qty
      pos.costCzk += toCzk(price * qty, txCurrency, fxMap)
      pos.lots.push({
        qty,
        remaining: qty,
        price,
        currency: txCurrency,
        account: tx.account,
        date: tx.date,
      })
    } else if (isSell(tx.type)) {
      pos.qty -= qty
      let left = qty
      for (const lot of pos.lots) {
        if (left <= 0) break
        const take = Math.min(lot.remaining, left)
        pos.costCzk -= toCzk(lot.price * take, lot.currency, fxMap)
        lot.remaining -= take
        left -= take
      }
    }
  }

  const positions = []
  for (const pos of byTicker.values()) {
    if (pos.qty <= 1e-9) continue

    const openLots = enrichOpenLots(pos.lots, asOf)
    const remainingQty = openLots.reduce((s, l) => s + l.qty, 0)
    const weightedSum = openLots.reduce((s, l) => s + l.price * l.qty, 0)
    const avgPrice = remainingQty > 0 ? weightedSum / remainingQty : 0

    const price = latestMarketPrice(priceByTicker, pos.ticker) ?? 0
    const currency = pos.currency
    const valueCzk = toCzk(price * pos.qty, currency, fxMap)
    const investedCzk = Math.max(pos.costCzk, 0)
    const pnlCzk = valueCzk - investedCzk
    const pnlPct = investedCzk > 0 ? pnlCzk / investedCzk : 0
    const pricePnlPct = avgPrice > 0 ? (price - avgPrice) / avgPrice : 0

    const div = dividendsByTicker.get(pos.ticker) || { dividendsCzk: 0, dividendCount: 0 }
    const totalReturnCzk = pnlCzk + div.dividendsCzk
    const totalReturnPct = investedCzk > 0 ? totalReturnCzk / investedCzk : 0
    const dividendYield = investedCzk > 0 ? div.dividendsCzk / investedCzk : 0

    positions.push({
      ticker: pos.ticker,
      currency,
      qty: pos.qty,
      price,
      avgPrice,
      valueCzk,
      investedCzk,
      pnlCzk,
      pnlPct,
      pricePnlPct,
      dividendsCzk: div.dividendsCzk,
      dividendCount: div.dividendCount,
      dividendYield,
      totalReturnCzk,
      totalReturnPct,
      lots: openLots,
      accounts: [...pos.accounts],
    })
  }

  positions.sort((a, b) => b.valueCzk - a.valueCzk)
  return positions
}

export function computePositionsForFilter(
  transactions,
  fxMap,
  accountFilter = 'all',
  priceByTicker = null,
) {
  const filtered = filterTransactionsByAccount(transactions, accountFilter)
  return computePositions(filtered, fxMap, new Date(), priceByTicker)
}

export function computeBrkInfo(positions, portfolioValue) {
  const brk = positions.find((p) => p.ticker === BRK_TICKER)
  const qty = brk?.qty || 0
  const valueCzk = brk?.valueCzk || 0
  const weight = portfolioValue > 0 ? valueCzk / portfolioValue : 0
  return { qty, valueCzk, weight, limit: 0.2, hardCap: 0.25 }
}

/**
 * Od nejstarší BUY transakce do asOf: { years, months, days, label }.
 */
export function computeInvestingDuration(transactions, asOf = new Date()) {
  let oldest = null
  for (const tx of transactions) {
    if (!isBuy(tx.type) || !tx.date) continue
    const d = String(tx.date).slice(0, 10)
    if (!oldest || d < oldest) oldest = d
  }
  if (!oldest) {
    return { years: 0, months: 0, days: 0, label: '—' }
  }
  const age = computeLotAge(oldest, asOf)
  return {
    ...age,
    label: `${age.years} r ${age.months} m`,
    startDate: oldest,
  }
}

/**
 * Cost basis otevřených lotů (FIFO).
 */
export function computeInvested(positions) {
  return positions.reduce((s, p) => s + p.investedCzk, 0)
}

/**
 * Čistý vložený kapitál = SUM(BUY price×qty) − SUM(SELL price×qty) v CZK.
 */
export function computeNetCapital(transactions, fxMap) {
  let capital = 0
  for (const tx of transactions) {
    const amount = toCzk(
      Number(tx.price) * Number(tx.quantity),
      tx.currency,
      fxMap,
    )
    if (isBuy(tx.type)) capital += amount
    else if (isSell(tx.type)) capital -= amount
  }
  return capital
}

/** SUM(price×quantity) všech DIVIDEND transakcí v CZK. */
export function computeDividendsTotal(transactions, fxMap) {
  return transactions.reduce((s, tx) => {
    if (!isDividend(tx.type)) return s
    return s + toCzk(Number(tx.price) * Number(tx.quantity), tx.currency, fxMap)
  }, 0)
}

export function computePortfolioValue(positions) {
  return positions.reduce((s, p) => s + p.valueCzk, 0)
}

export function computeCurrencyExposure(positions) {
  const totals = { CZK: 0, EUR: 0, USD: 0 }
  let sum = 0
  for (const p of positions) {
    const cur = p.currency in totals ? p.currency : 'CZK'
    totals[cur] += p.valueCzk
    sum += p.valueCzk
  }
  if (sum <= 0) {
    return [
      { currency: 'CZK', pct: 0, value: 0, color: '#2563eb' },
      { currency: 'EUR', pct: 0, value: 0, color: '#ea580c' },
      { currency: 'USD', pct: 0, value: 0, color: '#059669' },
    ]
  }
  return [
    { currency: 'CZK', pct: totals.CZK / sum, value: totals.CZK, color: '#2563eb' },
    { currency: 'EUR', pct: totals.EUR / sum, value: totals.EUR, color: '#ea580c' },
    { currency: 'USD', pct: totals.USD / sum, value: totals.USD, color: '#059669' },
  ]
}

/**
 * Realized P&L from SELL using FIFO against prior BUYs (in CZK).
 */
export function computeRealizedTrades(transactions, fxMap) {
  const lotsByTicker = new Map()
  const realized = []

  const sorted = [...transactions].sort((a, b) => {
    const d = String(a.date).localeCompare(String(b.date))
    if (d !== 0) return d
    return String(a.created_at || '').localeCompare(String(b.created_at || ''))
  })

  for (const tx of sorted) {
    const ticker = normalizeTicker(tx.ticker)
    if (!ticker) continue
    if (!lotsByTicker.has(ticker)) lotsByTicker.set(ticker, [])

    const qty = Number(tx.quantity) || 0
    const price = Number(tx.price) || 0
    const currency = String(tx.currency || 'CZK').toUpperCase()

    if (isBuy(tx.type)) {
      lotsByTicker.get(ticker).push({ remaining: qty, price, currency })
      continue
    }

    if (!isSell(tx.type)) continue

    let left = qty
    let costCzk = 0
    const lots = lotsByTicker.get(ticker)

    for (const lot of lots) {
      if (left <= 0) break
      const take = Math.min(lot.remaining, left)
      costCzk += toCzk(lot.price * take, lot.currency, fxMap)
      lot.remaining -= take
      left -= take
    }

    const proceedsCzk = toCzk(price * qty, currency, fxMap)
    const pnlCzk = proceedsCzk - costCzk
    const pnlPct = costCzk > 0 ? pnlCzk / costCzk : 0

    realized.push({
      id: tx.id,
      date: tx.date,
      ticker,
      quantity: qty,
      price,
      currency,
      pnlCzk,
      pnlPct,
      account: tx.account,
    })
  }

  realized.sort((a, b) => String(b.date).localeCompare(String(a.date)))
  return realized
}

export function sumRealizedPnl(realized) {
  return realized.reduce((s, t) => s + t.pnlCzk, 0)
}

/** XTB monthly allocated: SUM(price×qty) BUY in current month, account=xtb (native currency sum — typically CZK/EUR as stored) */
export function computeMonthlyXtbAllocated(transactions, yearMonth, fxMap) {
  return transactions
    .filter(
      (tx) =>
        isBuy(tx.type) &&
        String(tx.account || '').toLowerCase() === 'xtb' &&
        String(tx.date || '').startsWith(yearMonth),
    )
    .reduce((s, tx) => {
      const cur = String(tx.currency || 'CZK').toUpperCase()
      return s + toCzk(Number(tx.price) * Number(tx.quantity), cur, fxMap)
    }, 0)
}

/** DIP yearly invested 2026 */
export function computeDipYearInvested(transactions, year, fxMap) {
  return transactions
    .filter(
      (tx) =>
        isBuy(tx.type) &&
        String(tx.account || '').toLowerCase() === 'dip' &&
        String(tx.date || '').startsWith(String(year)),
    )
    .reduce((s, tx) => {
      const cur = String(tx.currency || 'CZK').toUpperCase()
      return s + toCzk(Number(tx.price) * Number(tx.quantity), cur, fxMap)
    }, 0)
}

export function dipBuyHistory(transactions, year, fxMap) {
  return transactions
    .filter(
      (tx) =>
        isBuy(tx.type) &&
        String(tx.account || '').toLowerCase() === 'dip' &&
        String(tx.date || '').startsWith(String(year)),
    )
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((tx) => ({
      id: tx.id,
      date: tx.date,
      ticker: normalizeTicker(tx.ticker),
      quantity: Number(tx.quantity) || 0,
      price: Number(tx.price) || 0,
      currency: String(tx.currency || 'CZK').toUpperCase(),
      valueCzk: toCzk(
        Number(tx.price) * Number(tx.quantity),
        tx.currency,
        fxMap,
      ),
    }))
}

export function parseRuleNumber(rules, key, fallback = 0) {
  const row = rules.find((r) => r.key === key)
  if (!row) return fallback
  const n = Number(String(row.value).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : fallback
}
