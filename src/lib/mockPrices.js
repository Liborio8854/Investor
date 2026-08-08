/** Mock ceny — později nahradíme FMP API / inv_prices */
export const MOCK_PRICES = {
  'KOMB.PR': { price: 1049, currency: 'CZK' },
  'CEZ.PR': { price: 1357, currency: 'CZK' },
  CHKP: { price: 128.23, currency: 'USD' },
  'NOV.DE': { price: 44.22, currency: 'EUR' },
  'BRYN.DE': { price: 447.75, currency: 'EUR' },
  'SPYI.DE': { price: 11.31, currency: 'EUR' },
  'CSG.AS': { price: 16.54, currency: 'EUR' },
  RYAAY: { price: 59.96, currency: 'USD' },
  'MUV2.DE': { price: 522.48, currency: 'EUR' },
  CME: { price: 265.44, currency: 'USD' },
  'MC.PA': { price: 471.6, currency: 'EUR' },
  PG: { price: 148.98, currency: 'USD' },
  MCD: { price: 271.52, currency: 'USD' },
  'SAP.DE': { price: 162.76, currency: 'EUR' },
  SPGI: { price: 444.43, currency: 'USD' },
  'MSF.DE': { price: 386.1, currency: 'EUR' },
  'FB2A.DE': { price: 519.9, currency: 'EUR' },
  UNP: { price: 292.42, currency: 'USD' },
  V: { price: 369.11, currency: 'USD' },
  GD: { price: 381.4, currency: 'USD' },
  'LIN.DE': { price: 444.2, currency: 'EUR' },
  'HO.PA': { price: 244.4, currency: 'EUR' },
  'ASML.AS': { price: 1576.4, currency: 'EUR' },
  'WKL.AS': { price: 69.7, currency: 'EUR' },
  'ABEA.DE': { price: 324.75, currency: 'EUR' },
  KO: { price: 82.46, currency: 'USD' },
  MCO: { price: 483.17, currency: 'USD' },
  'APC.DE': { price: 286.85, currency: 'EUR' },
  'FFX.MU': { price: 1451, currency: 'EUR' },
  'HNR1.DE': { price: 244.8, currency: 'EUR' },
  NOC: { price: 525, currency: 'USD' },
  'NKE.DE': { price: 37.45, currency: 'EUR' },
  'RACE.MI': { price: 342.55, currency: 'EUR' },
}

/** Hardcoded FX (CZK za 1 jednotku cizí měny) */
export const DEFAULT_FX = {
  CZK: 1,
  EUR: 24.2,
  USD: 22.0,
}

const ALIASES = {
  KOMB: 'KOMB.PR',
  CEZ: 'CEZ.PR',
}

export function getMockPrice(ticker) {
  const raw = String(ticker || '').trim().toUpperCase()
  if (!raw) return null

  const aliased = ALIASES[raw] || raw
  const key = Object.keys(MOCK_PRICES).find((k) => k.toUpperCase() === aliased.toUpperCase())
  return key ? MOCK_PRICES[key] : null
}