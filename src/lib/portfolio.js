import { DEFAULT_FX } from './mockPrices'
import { fifoLotsByTicker, nativeWeightedAverage } from './nativeHoldings.js'

export { computeNativeHoldings, fifoLotsByTicker, nativeWeightedAverage } from './nativeHoldings.js'

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

/** FX map from inv_rules keys fx_eur_czk / fx_usd_czk (fallback DEFAULT_FX). */
export function buildFxMapFromRules(rules = []) {
  const map = { ...DEFAULT_FX }
  const eur = parseRuleNumber(rules, 'fx_eur_czk', NaN)
  const usd = parseRuleNumber(rules, 'fx_usd_czk', NaN)
  if (Number.isFinite(eur) && eur > 0) map.EUR = eur
  if (Number.isFinite(usd) && usd > 0) map.USD = usd
  return map
}

/** CZK per 1 unit of currency (for form prefills). */
export function resolveExchangeRate(currency, fxMap = DEFAULT_FX) {
  const cur = String(currency || 'CZK').toUpperCase()
  if (cur === 'CZK') return 1
  const rate = fxMap[cur] ?? DEFAULT_FX[cur] ?? 1
  return Number.isFinite(rate) && rate > 0 ? rate : 1
}

export function toCzk(amount, currency, fxMap) {
  const cur = String(currency || 'CZK').toUpperCase()
  const rate = fxMap?.[cur] ?? DEFAULT_FX[cur] ?? 1
  return Number(amount || 0) * rate
}

/**
 * Transaction notional in Kč.
 * Prefer per-tx exchange_rate; else currency × fxMap (rules / DEFAULT_FX).
 */
export function buyAmountCzk(tx, fxMap = DEFAULT_FX) {
  const qty = Number(tx?.quantity) || 0
  const price = Number(tx?.price) || 0
  const er = Number(tx?.exchange_rate)
  if (Number.isFinite(er) && er > 0) return qty * price * er
  return toCzk(qty * price, tx?.currency, fxMap)
}

/**
 * BUY − SELL cashflow in Kč. `allocated` is net floored at 0 (rotation does not consume allocation).
 */
export function summarizeCashflowCzk(transactions, fxMap = DEFAULT_FX) {
  let buys = 0
  let sells = 0
  for (const tx of transactions || []) {
    const type = String(tx?.type || '').toUpperCase()
    const amount = buyAmountCzk(tx, fxMap)
    if (type === 'BUY') buys += amount
    else if (type === 'SELL') sells += amount
  }
  const net = buys - sells
  return { buys, sells, net, allocated: Math.max(0, net) }
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

/** Filter tabs: all | xtb_fio | dip | xtb | fio */
export function filterTransactionsByAccount(transactions, accountFilter = 'all') {
  if (accountFilter === 'all') return transactions
  return transactions.filter((tx) => {
    const acc = String(tx.account || '').toLowerCase()
    if (accountFilter === 'xtb_fio') return acc === 'xtb' || acc === 'fio'
    if (accountFilter === 'dip') return acc === 'dip'
    if (accountFilter === 'xtb' || accountFilter === 'fio') return acc === accountFilter
    return true
  })
}

/**
 * Tickers with open position: SUM(BUY qty) − SUM(SELL qty) > 0.
 * @param {object[]} transactions
 * @param {{ excludeId?: string|number|null }} [opts] — při editaci SELL vyloučit aktuální řádek
 * @returns {string[]} sorted uppercase tickers
 */
export function openPositionTickers(transactions, { excludeId = null } = {}) {
  const qtyByTicker = new Map()
  for (const tx of transactions || []) {
    if (excludeId != null && tx.id === excludeId) continue
    const type = String(tx.type || '').toUpperCase()
    if (type !== 'BUY' && type !== 'SELL') continue
    const ticker = normalizeTicker(tx.ticker)
    if (!ticker) continue
    const qty = Number(tx.quantity) || 0
    const prev = qtyByTicker.get(ticker) || 0
    qtyByTicker.set(ticker, type === 'BUY' ? prev + qty : prev - qty)
  }
  return [...qtyByTicker.entries()]
    .filter(([, qty]) => qty > 1e-9)
    .map(([ticker]) => ticker)
    .sort((a, b) => a.localeCompare(b))
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
 * Average price = weighted average of remaining FIFO lots in native currency (no CZK FX).
 * FX is used only for valueCzk / investedCzk / P&L CZK.
 */
export function computePositions(transactions, fxMap, asOf = new Date(), priceByTicker = null) {
  const byTicker = fifoLotsByTicker(transactions)
  const dividendsByTicker = computeDividendsByTicker(transactions, fxMap)

  const positions = []
  for (const pos of byTicker.values()) {
    const openLots = enrichOpenLots(pos.lots, asOf)
    const remainingQty = openLots.reduce((s, l) => s + l.qty, 0)
    if (remainingQty <= 1e-9) continue

    const avgPrice = nativeWeightedAverage(openLots)

    const price = latestMarketPrice(priceByTicker, pos.ticker) ?? 0
    const currency = pos.currency
    const valueCzk = toCzk(price * remainingQty, currency, fxMap)
    const investedCzk = Math.max(
      openLots.reduce((s, lot) => s + toCzk(lot.price * lot.qty, lot.currency, fxMap), 0),
      0,
    )
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
      qty: remainingQty,
      price,
      avgPrice,
      avgBuyPrice: avgPrice,
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

function isBuyOrSell(type) {
  const t = String(type || '').toUpperCase()
  return t === 'BUY' || t === 'SELL'
}

/** XTB monthly: BUY − SELL Kč, allocated floored at 0. */
export function computeMonthlyXtbAllocation(transactions, yearMonth, fxMap) {
  const rows = (transactions || []).filter(
    (tx) =>
      isBuyOrSell(tx.type) &&
      String(tx.account || '').toLowerCase() === 'xtb' &&
      String(tx.date || '').startsWith(yearMonth),
  )
  return summarizeCashflowCzk(rows, fxMap)
}

/** @deprecated use computeMonthlyXtbAllocation().allocated */
export function computeMonthlyXtbAllocated(transactions, yearMonth, fxMap) {
  return computeMonthlyXtbAllocation(transactions, yearMonth, fxMap).allocated
}

/** DIP yearly: BUY − SELL Kč, allocated floored at 0. */
export function computeDipYearAllocation(transactions, year, fxMap) {
  const rows = (transactions || []).filter(
    (tx) =>
      isBuyOrSell(tx.type) &&
      String(tx.account || '').toLowerCase() === 'dip' &&
      String(tx.date || '').startsWith(String(year)),
  )
  return summarizeCashflowCzk(rows, fxMap)
}

/** @deprecated use computeDipYearAllocation().allocated */
export function computeDipYearInvested(transactions, year, fxMap) {
  return computeDipYearAllocation(transactions, year, fxMap).allocated
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
      valueCzk: buyAmountCzk(tx, fxMap),
    }))
}

export function parseRuleNumber(rules, key, fallback = 0) {
  const row = rules.find((r) => r.key === key)
  if (!row) return fallback
  const n = Number(String(row.value).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : fallback
}
