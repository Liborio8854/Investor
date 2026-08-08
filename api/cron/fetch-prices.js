import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function isMondayUTC() {
  return new Date().getUTCDay() === 1
}

function authorize(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.authorization || ''
  return header === `Bearer ${secret}`
}

async function collectTickers(supabase) {
  const [wl, tx] = await Promise.all([
    supabase.from('inv_watchlist').select('ticker'),
    supabase.from('inv_transactions').select('ticker'),
  ])

  if (wl.error) throw wl.error
  if (tx.error) throw tx.error

  const set = new Set()
  for (const row of [...(wl.data || []), ...(tx.data || [])]) {
    const t = String(row.ticker || '').trim().toUpperCase()
    if (t) set.add(t)
  }
  return [...set].sort()
}

async function fmpFetch(path, params, apiKey) {
  const url = new URL(`https://financialmodelingprep.com/stable/${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v))
  }
  url.searchParams.set('apikey', apiKey)

  const res = await fetch(url.toString(), {
    headers: { apikey: apiKey },
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`FMP ${path} invalid JSON (${res.status}): ${text.slice(0, 200)}`)
  }

  if (!res.ok) {
    throw new Error(`FMP ${path} HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  if (data?.['Error Message'] || data?.['ErrorMessage'] || data?.error) {
    throw new Error(
      data['Error Message'] || data['ErrorMessage'] || data.error || `FMP ${path} error`,
    )
  }
  return data
}

function firstItem(data, path) {
  if (!Array.isArray(data) || !data[0]) {
    throw new Error(`FMP ${path} empty or unexpected payload`)
  }
  return data[0]
}

/** Single-ticker quote; falls back to quote-short on free-plan / endpoint failure. */
async function fetchQuote(ticker, apiKey, stats) {
  try {
    const data = await fmpFetch('quote', { symbol: ticker }, apiKey)
    stats.ok += 1
    return firstItem(data, 'quote')
  } catch (quoteErr) {
    stats.failed += 1
    try {
      const data = await fmpFetch('quote-short', { symbol: ticker }, apiKey)
      stats.ok += 1
      return firstItem(data, 'quote-short')
    } catch (shortErr) {
      stats.failed += 1
      throw new Error(
        `quote: ${quoteErr.message}; quote-short: ${shortErr.message}`,
      )
    }
  }
}

async function fetchKeyMetricsTtm(ticker, apiKey, stats) {
  try {
    const data = await fmpFetch('key-metrics-ttm', { symbol: ticker }, apiKey)
    stats.ok += 1
    if (!Array.isArray(data) || !data[0]) return null
    return data[0]
  } catch (err) {
    stats.failed += 1
    throw err
  }
}

function mapQuoteRow(q, date, fallbackTicker) {
  const ticker = String(q.symbol || fallbackTicker || '')
    .trim()
    .toUpperCase()
  if (!ticker) return null
  return {
    ticker,
    date,
    price: q.price ?? null,
    change_percent: q.changePercentage ?? q.changesPercentage ?? q.change ?? null,
    market_cap: q.marketCap ?? null,
    pe_ratio: q.pe ?? q.peRatioTTM ?? null,
    volume: q.volume ?? null,
    updated_at: new Date().toISOString(),
  }
}

function mapFundamentalsRow(ticker, m, date) {
  return {
    ticker,
    date,
    roic: m.returnOnCapitalEmployedTTM ?? m.roicTTM ?? null,
    roe: m.returnOnEquityTTM ?? null,
    net_margin: m.netProfitMarginTTM ?? null,
    gross_margin: m.grossProfitMarginTTM ?? null,
    revenue_growth: m.revenueGrowthTTM ?? null,
    fcf_per_share: m.freeCashFlowPerShareTTM ?? null,
    updated_at: new Date().toISOString(),
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!authorize(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const fmpKey = process.env.FMP_API_KEY
  if (!fmpKey) {
    return res.status(500).json({ error: 'Missing FMP_API_KEY' })
  }

  const started = Date.now()
  const date = todayISO()
  const fetchFundamentals = isMondayUTC()
  const errors = []
  let pricesUpserted = 0
  let fundamentalsUpserted = 0
  const fmpStats = { ok: 0, failed: 0 }

  try {
    const supabase = getAdminClient()
    const tickers = await collectTickers(supabase)
    console.log(`[cron/fetch-prices] tickers=${tickers.length} fundamentals=${fetchFundamentals}`)

    if (!tickers.length) {
      return res.status(200).json({
        ok: true,
        date,
        tickers: 0,
        pricesUpserted: 0,
        fundamentalsUpserted: 0,
        fmpCallsOk: 0,
        fmpCallsFailed: 0,
        ms: Date.now() - started,
      })
    }

    // One quote (or quote-short fallback) per ticker — free plan has no batch-quote
    for (const ticker of tickers) {
      try {
        const quote = await fetchQuote(ticker, fmpKey, fmpStats)
        const row = mapQuoteRow(quote, date, ticker)
        if (row) {
          const { error } = await supabase.from('inv_prices').upsert(row, {
            onConflict: 'ticker,date',
          })
          if (error) {
            errors.push({ type: 'upsert_prices', ticker, error: error.message })
            console.error('[cron/fetch-prices] upsert prices', ticker, error.message)
          } else {
            pricesUpserted += 1
          }
        }
      } catch (err) {
        errors.push({ type: 'quote', ticker, error: err.message })
        console.error('[cron/fetch-prices] quote failed', ticker, err.message)
      }
      await sleep(100)
    }

    // Fundamentals once a week (Monday UTC) — key-metrics-ttm only
    if (fetchFundamentals) {
      for (const ticker of tickers) {
        try {
          const metrics = await fetchKeyMetricsTtm(ticker, fmpKey, fmpStats)
          if (!metrics) {
            errors.push({ type: 'fundamentals_empty', ticker })
            continue
          }
          const row = mapFundamentalsRow(ticker, metrics, date)
          const { error } = await supabase.from('inv_fundamentals').upsert(row, {
            onConflict: 'ticker,date',
          })
          if (error) {
            errors.push({ type: 'upsert_fundamentals', ticker, error: error.message })
            console.error('[cron/fetch-prices] upsert fundamentals', ticker, error.message)
          } else {
            fundamentalsUpserted += 1
          }
        } catch (err) {
          errors.push({ type: 'key-metrics-ttm', ticker, error: err.message })
          console.error('[cron/fetch-prices] key-metrics-ttm failed', ticker, err.message)
        }
        await sleep(100)
      }
    }

    const result = {
      ok: true,
      date,
      tickers: tickers.length,
      pricesUpserted,
      fundamentalsUpserted,
      fundamentalsRun: fetchFundamentals,
      fmpCallsOk: fmpStats.ok,
      fmpCallsFailed: fmpStats.failed,
      errors: errors.length,
      errorSamples: errors.slice(0, 10),
      ms: Date.now() - started,
    }
    console.log('[cron/fetch-prices] done', result)
    return res.status(200).json(result)
  } catch (err) {
    console.error('[cron/fetch-prices] fatal', err)
    return res.status(500).json({
      ok: false,
      error: err.message || String(err),
      fmpCallsOk: fmpStats.ok,
      fmpCallsFailed: fmpStats.failed,
      ms: Date.now() - started,
    })
  }
}
