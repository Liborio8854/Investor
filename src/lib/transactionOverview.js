import { buyAmountCzk } from './portfolio'

export { buyAmountCzk }

const DIP_TICKERS = new Set(['BRYN.DE', 'SPYI.DE'])

const MONTH_SHORT = [
  'led',
  'úno',
  'bře',
  'dub',
  'kvě',
  'čvn',
  'čvc',
  'srp',
  'zář',
  'říj',
  'lis',
  'pro',
]

const MONTH_FULL = [
  'leden',
  'únor',
  'březen',
  'duben',
  'květen',
  'červen',
  'červenec',
  'srpen',
  'září',
  'říjen',
  'listopad',
  'prosinec',
]

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function yearMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

export function parseYearMonth(ym) {
  const [y, m] = String(ym).split('-').map(Number)
  return { year: y, month: m }
}

export function monthLabelShort(ym, { withYear = false } = {}) {
  const { year, month } = parseYearMonth(ym)
  const name = MONTH_SHORT[month - 1] || ym
  if (!withYear) return name
  return `${name} ${String(year).slice(2)}`
}

export function monthLabelFull(ym) {
  const { year, month } = parseYearMonth(ym)
  const name = MONTH_FULL[month - 1] || ym
  return `${name} ${year}`
}

/** Prefer account column; missing → BRYN.DE/SPYI.DE = DIP, else XTB. FIO counts as XTB. */
export function resolveBuyAccount(tx) {
  const acc = String(tx?.account || '')
    .trim()
    .toUpperCase()
  if (acc === 'DIP') return 'DIP'
  if (acc === 'XTB' || acc === 'FIO') return 'XTB'
  if (acc) return 'XTB'
  const ticker = String(tx?.ticker || '')
    .trim()
    .toUpperCase()
  return DIP_TICKERS.has(ticker) ? 'DIP' : 'XTB'
}

function monthKeyFromDate(dateStr) {
  const raw = String(dateStr || '').slice(0, 7)
  return /^\d{4}-\d{2}$/.test(raw) ? raw : null
}

function shiftMonth(ym, delta) {
  const { year, month } = parseYearMonth(ym)
  const d = new Date(year, month - 1 + delta, 1)
  return yearMonthKey(d)
}

function monthsBetweenInclusive(fromYm, toYm) {
  if (!fromYm || !toYm || fromYm > toYm) return []
  const out = []
  let cur = fromYm
  while (cur <= toYm) {
    out.push(cur)
    cur = shiftMonth(cur, 1)
  }
  return out
}

/** Distinct years from BUY dates, newest first (excludes current year — covered by „Letos“). */
export function pastYearsFromTransactions(transactions = [], now = new Date()) {
  const currentYear = now.getFullYear()
  const set = new Set()
  for (const tx of transactions || []) {
    const ym = monthKeyFromDate(tx.date)
    if (!ym) continue
    const y = parseYearMonth(ym).year
    if (Number.isFinite(y) && y !== currentYear) set.add(y)
  }
  return [...set].sort((a, b) => b - a)
}

/** Tabs: Letos | 2025 | 2024 | … | Vše */
export function buildHistoryPeriodTabs(transactions = [], now = new Date()) {
  return [
    { id: 'ytd', label: 'Letos' },
    ...pastYearsFromTransactions(transactions, now).map((y) => ({
      id: String(y),
      label: String(y),
    })),
    { id: 'all', label: 'Vše' },
  ]
}

/**
 * period: 'ytd' | 'all' | '2025' (year string)
 * Returns YYYY-MM keys oldest → newest.
 */
export function monthKeysForPeriod(period, transactions = [], now = new Date()) {
  const current = yearMonthKey(now)
  const currentYear = now.getFullYear()

  if (period === 'ytd') {
    return monthsBetweenInclusive(`${currentYear}-01`, current)
  }

  if (period === 'all') {
    const set = new Set()
    for (const tx of transactions) {
      const ym = monthKeyFromDate(tx.date)
      if (ym) set.add(ym)
    }
    return [...set].sort()
  }

  const year = Number(period)
  if (!Number.isFinite(year)) return []
  const start = `${year}-01`
  const end = year === currentYear ? current : `${year}-12`
  return monthsBetweenInclusive(start, end)
}

export function aggregateBuysByMonth(transactions, fxMap) {
  const map = new Map()
  for (const tx of transactions || []) {
    const ym = monthKeyFromDate(tx.date)
    if (!ym) continue
    if (!map.has(ym)) map.set(ym, { month: ym, xtb: 0, dip: 0 })
    const row = map.get(ym)
    const amount = buyAmountCzk(tx, fxMap)
    if (resolveBuyAccount(tx) === 'DIP') row.dip += amount
    else row.xtb += amount
  }
  return map
}

/**
 * Build chart series + table rows for the selected period ('ytd' | year | 'all').
 * Chart: oldest → newest. Table: newest → oldest; year subtotals only for „Vše“.
 */
export function buildBuyOverview(transactions, period = 'ytd', now = new Date(), fxMap) {
  const keys = monthKeysForPeriod(period, transactions, now)
  const keySet = new Set(keys)
  const inRange = (transactions || []).filter((tx) => {
    const ym = monthKeyFromDate(tx.date)
    return ym && keySet.has(ym)
  })

  const byMonth = aggregateBuysByMonth(inRange, fxMap)
  const multiYear = new Set(keys.map((k) => parseYearMonth(k).year)).size > 1

  const totalXtb = keys.reduce((s, ym) => s + (byMonth.get(ym)?.xtb || 0), 0)
  const totalDip = keys.reduce((s, ym) => s + (byMonth.get(ym)?.dip || 0), 0)
  const total = totalXtb + totalDip

  if (inRange.length === 0) {
    return {
      chart: [],
      tableRows: [],
      totalXtb: 0,
      totalDip: 0,
      total: 0,
      multiYear: false,
    }
  }

  const chart = keys.map((ym) => {
    const row = byMonth.get(ym) || { xtb: 0, dip: 0 }
    return {
      month: ym,
      label: monthLabelShort(ym, { withYear: multiYear }),
      xtb: row.xtb,
      dip: row.dip,
      total: row.xtb + row.dip,
    }
  })

  // Table: newest first, only months with activity
  const monthRowsDesc = [...keys]
    .reverse()
    .filter((ym) => {
      const row = byMonth.get(ym)
      return row && (row.xtb > 0 || row.dip > 0)
    })
    .map((ym) => {
      const row = byMonth.get(ym)
      return {
        type: 'month',
        key: ym,
        label: monthLabelFull(ym),
        xtb: row.xtb,
        dip: row.dip,
        total: row.xtb + row.dip,
      }
    })

  const tableRows = []
  if (monthRowsDesc.length === 0) {
    return {
      chart,
      tableRows,
      totalXtb,
      totalDip,
      total,
      multiYear,
    }
  }

  if (!multiYear) {
    const year = parseYearMonth(monthRowsDesc[0].key).year
    tableRows.push(...monthRowsDesc)
    tableRows.push({
      type: 'yearTotal',
      key: `year-${year}`,
      label: `Součet ${year}`,
      xtb: totalXtb,
      dip: totalDip,
      total,
    })
  } else {
    const byYear = new Map()
    for (const row of monthRowsDesc) {
      const y = parseYearMonth(row.key).year
      if (!byYear.has(y)) byYear.set(y, [])
      byYear.get(y).push(row)
    }
    for (const [year, rows] of byYear) {
      tableRows.push(...rows)
      const yXtb = rows.reduce((s, r) => s + r.xtb, 0)
      const yDip = rows.reduce((s, r) => s + r.dip, 0)
      tableRows.push({
        type: 'yearTotal',
        key: `year-${year}`,
        label: `Součet ${year}`,
        xtb: yXtb,
        dip: yDip,
        total: yXtb + yDip,
      })
    }
    tableRows.push({
      type: 'grandTotal',
      key: 'grand',
      label: 'Celkem',
      xtb: totalXtb,
      dip: totalDip,
      total,
    })
  }

  return {
    chart,
    tableRows,
    totalXtb,
    totalDip,
    total,
    multiYear,
  }
}
