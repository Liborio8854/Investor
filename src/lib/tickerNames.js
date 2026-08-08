/** Fallback názvy firem, když chybí inv_watchlist.name */
export const tickerNames = {
  'KOMB.PR': 'Komerční banka',
  'CEZ.PR': 'ČEZ',
  CHKP: 'Check Point Software',
  'NOV.DE': 'Novo Nordisk',
  'BRYN.DE': 'Berkshire Hathaway',
  'SPYI.DE': 'SPDR MSCI ACWI IMI',
  'CSG.AS': 'CSG N.V.',
  'NKE.DE': 'Nike, Inc.',
  'RACE.MI': 'Ferrari N.V.',
  'TTE.PA': 'TotalEnergies SE',
  'SHELL.AS': 'Shell plc',
  'BMW.DE': 'BMW AG',
  'VUAA.DE': 'Vanguard S&P 500',
  'VWCE.DE': 'Vanguard FTSE All-World',
  SOFI: 'SoFi Technologies',
  'BRK-B': 'Berkshire Hathaway B',
  'MWEQ.DE': 'Invesco MSCI World EW',
}

/**
 * Resolve display name: watchlist map → static fallback → null (show ticker only).
 * @param {string} ticker
 * @param {Record<string, string>} [watchlistNames]
 */
export function resolveTickerName(ticker, watchlistNames = {}) {
  const key = String(ticker || '').trim().toUpperCase()
  if (!key) return null

  const fromWatchlist = watchlistNames[key]
  if (fromWatchlist) return fromWatchlist

  const fromStatic =
    tickerNames[key] ||
    Object.entries(tickerNames).find(([k]) => k.toUpperCase() === key)?.[1]
  return fromStatic || null
}

/** Build uppercase ticker → name map from inv_watchlist rows. */
export function buildWatchlistNameMap(watchlistRows = []) {
  const map = {}
  for (const row of watchlistRows) {
    const key = String(row.ticker || '').trim().toUpperCase()
    if (key && row.name) map[key] = String(row.name).trim()
  }
  return map
}
