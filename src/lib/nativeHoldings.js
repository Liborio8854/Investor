/**
 * Native-currency average purchase price (no CZK / FX).
 * avg = SUM(price × remaining_qty) / SUM(remaining_qty)
 * `price` is inv_transactions.price in the row's original currency.
 */

function normalizeTicker(ticker) {
  return String(ticker || '').trim().toUpperCase()
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

/**
 * Weighted average in the lot's native currency.
 * Prefer `remaining` (FIFO leftover) over original buy `qty`.
 */
export function nativeWeightedAverage(lots) {
  let notional = 0
  let qty = 0
  for (const lot of lots || []) {
    const q = Number(lot.remaining ?? lot.qty ?? lot.quantity) || 0
    const p = Number(lot.price) || 0
    if (q <= 0) continue
    notional += p * q
    qty += q
  }
  return qty > 0 ? notional / qty : 0
}

function sortTransactionsFifo(transactions) {
  return [...(transactions || [])].sort((a, b) => {
    const d = String(a.date || '').localeCompare(String(b.date || ''))
    if (d !== 0) return d
    return String(a.created_at || '').localeCompare(String(b.created_at || ''))
  })
}

/**
 * Open FIFO lots per ticker. Lot.price stays in the transaction's native currency.
 */
export function fifoLotsByTicker(transactions) {
  const byTicker = new Map()

  for (const tx of sortTransactionsFifo(transactions)) {
    const ticker = normalizeTicker(tx.ticker)
    if (!ticker) continue
    if (isDividend(tx.type)) continue

    if (!byTicker.has(ticker)) {
      byTicker.set(ticker, {
        ticker,
        currency: String(tx.currency || 'CZK').toUpperCase(),
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
      pos.lots.push({
        qty,
        remaining: qty,
        price,
        currency: txCurrency,
        account: tx.account,
        date: tx.date,
      })
    } else if (isSell(tx.type)) {
      let left = qty
      for (const lot of pos.lots) {
        if (left <= 0) break
        const take = Math.min(lot.remaining, left)
        lot.remaining -= take
        left -= take
      }
    }
  }

  return byTicker
}

/**
 * Open qty + native avg price per ticker (FIFO remaining lots, no FX).
 * @returns {Map<string, { qty: number, avgPrice: number, currency: string }>}
 */
export function computeNativeHoldings(transactions) {
  const out = new Map()
  for (const pos of fifoLotsByTicker(transactions).values()) {
    const remaining = pos.lots.filter((lot) => lot.remaining > 1e-9)
    const qty = remaining.reduce((s, lot) => s + lot.remaining, 0)
    if (qty <= 1e-9) continue
    out.set(pos.ticker, {
      qty,
      avgPrice: nativeWeightedAverage(remaining),
      currency: pos.currency || 'CZK',
    })
  }
  return out
}
