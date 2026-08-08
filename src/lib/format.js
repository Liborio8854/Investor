const CZK = new Intl.NumberFormat('cs-CZ', {
  style: 'currency',
  currency: 'CZK',
  maximumFractionDigits: 0,
})

const CZK_DEC = new Intl.NumberFormat('cs-CZ', {
  style: 'currency',
  currency: 'CZK',
  maximumFractionDigits: 2,
})

const PCT = new Intl.NumberFormat('cs-CZ', {
  style: 'percent',
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

const NUM = new Intl.NumberFormat('cs-CZ', {
  maximumFractionDigits: 2,
})

export function formatCzk(value, withDecimals = false) {
  const n = Number(value) || 0
  return (withDecimals ? CZK_DEC : CZK).format(n)
}

export function formatPct(ratio) {
  return PCT.format(Number(ratio) || 0)
}

export function formatNum(value) {
  return NUM.format(Number(value) || 0)
}

/** Percent as "X,X %" without sign (cs-CZ). */
export function formatPctPlain(ratio, digits = 1) {
  const n = (Number(ratio) || 0) * 100
  return `${n.toLocaleString('cs-CZ', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} %`
}

/** Signed percent for P&L columns. */
export function formatPctSigned(ratio, digits = 1) {
  const n = (Number(ratio) || 0) * 100
  const body = n.toLocaleString('cs-CZ', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  if (n > 0) return `+${body} %`
  return `${body} %`
}

export function formatPrice(value, currency = '') {
  const n = Number(value) || 0
  const formatted = n.toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency ? `${formatted} ${currency}` : formatted
}

/** Cena v originální měně: $123,00 / €68,72 / 81,60 Kč */
export function formatMoney(value, currency = 'CZK') {
  const n = Number(value) || 0
  const body = n.toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const cur = String(currency || 'CZK').toUpperCase()
  if (cur === 'USD') return `$${body}`
  if (cur === 'EUR') return `€${body}`
  return `${body} Kč`
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('cs-CZ')
}

export function signedCzk(value) {
  const n = Number(value) || 0
  const prefix = n > 0 ? '+' : ''
  return `${prefix}${formatCzk(n)}`
}

export function currentYearMonth(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function nextYearMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  // Date months are 0-indexed; passing m (1–12) advances to the next calendar month
  const d = new Date(y, m, 1)
  const ny = d.getFullYear()
  const nm = String(d.getMonth() + 1).padStart(2, '0')
  return `${ny}-${nm}`
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
