import { createClient } from '@supabase/supabase-js'
import YahooFinance from 'yahoo-finance2'

// yahoo-finance2 v3+ requires instantiation (default export is the class)
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

/** Mapování lokálních tickerů → Yahoo symbol (+ volitelný FX přepočet ceny). */
const TICKER_MAP = {
  'FFX.DE': { yahoo: 'FFH.TO', convertCurrency: { from: 'CAD', to: 'EUR' } },
}

function resolveYahooSymbol(ticker) {
  return TICKER_MAP[ticker]?.yahoo || ticker
}

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

function mapQuoteRow(ticker, quote, date) {
  if (!quote || quote.regularMarketPrice == null) return null
  return {
    ticker,
    date,
    price: quote.regularMarketPrice ?? null,
    change_percent: quote.regularMarketChangePercent ?? null,
    market_cap: quote.marketCap ?? null,
    pe_ratio: quote.trailingPE ?? null,
    volume: quote.regularMarketVolume ?? null,
    updated_at: new Date().toISOString(),
  }
}

function calcFcfPerShare(financialData, keyStats) {
  const fcf = financialData?.freeCashflow
  const shares = keyStats?.sharesOutstanding
  if (fcf == null || shares == null || shares === 0) return null
  return fcf / shares
}

function mapFundamentalsRow(ticker, stats, date) {
  const fd = stats?.financialData
  const ks = stats?.defaultKeyStatistics
  return {
    ticker,
    date,
    // Yahoo nemá ROIC přímo — returnOnAssets jako proxy
    roic: fd?.returnOnAssets ?? null,
    roe: fd?.returnOnEquity ?? null,
    net_margin: fd?.profitMargins ?? null,
    gross_margin: fd?.grossMargins ?? null,
    revenue_growth: fd?.revenueGrowth ?? null,
    fcf_per_share: calcFcfPerShare(fd, ks),
    updated_at: new Date().toISOString(),
  }
}

/** FX kurz pro pár FROM→TO (např. CAD+EUR → CADEUR=X), cache per cron run. */
async function getFxRate(from, to, fxCache, yahooStats) {
  const pair = `${from}${to}=X`
  if (fxCache.has(pair)) return fxCache.get(pair)

  const fx = await yahooFinance.quote(pair)
  yahooStats.ok += 1
  const rate = fx?.regularMarketPrice
  if (rate == null) {
    throw new Error(`FX rate empty for ${pair}`)
  }
  fxCache.set(pair, rate)
  return rate
}

async function applyCurrencyConversion(row, mapping, fxCache, yahooStats) {
  const cc = mapping?.convertCurrency
  if (!row || !cc?.from || !cc?.to) return row
  const rate = await getFxRate(cc.from, cc.to, fxCache, yahooStats)
  return { ...row, price: row.price * rate }
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

  const started = Date.now()
  const date = todayISO()
  const fetchFundamentals = isMondayUTC() || req.query?.forceFundamentals === 'true'
  const errors = []
  let pricesUpserted = 0
  let fundamentalsUpserted = 0
  const yahooStats = { ok: 0, failed: 0 }
  const fxCache = new Map()

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
        yahooCallsOk: 0,
        yahooCallsFailed: 0,
        ms: Date.now() - started,
      })
    }

    for (const ticker of tickers) {
      const mapping = TICKER_MAP[ticker]
      const yahooSymbol = resolveYahooSymbol(ticker)
      try {
        const quote = await yahooFinance.quote(yahooSymbol)
        yahooStats.ok += 1
        let row = mapQuoteRow(ticker, quote, date)
        if (!row) {
          errors.push({ type: 'quote_empty', ticker, yahooSymbol })
          console.error('[cron/fetch-prices] quote empty', ticker, yahooSymbol)
        } else {
          try {
            row = await applyCurrencyConversion(row, mapping, fxCache, yahooStats)
          } catch (fxErr) {
            yahooStats.failed += 1
            errors.push({ type: 'fx', ticker, error: fxErr.message })
            console.error('[cron/fetch-prices] fx failed', ticker, fxErr.message)
            await sleep(200)
            continue
          }
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
        yahooStats.failed += 1
        errors.push({ type: 'quote', ticker, yahooSymbol, error: err.message })
        console.error('[cron/fetch-prices] quote failed', ticker, yahooSymbol, err.message)
      }
      await sleep(200)
    }

    if (fetchFundamentals) {
      for (const ticker of tickers) {
        const yahooSymbol = resolveYahooSymbol(ticker)
        try {
          const stats = await yahooFinance.quoteSummary(yahooSymbol, {
            modules: ['financialData', 'defaultKeyStatistics'],
          })
          yahooStats.ok += 1
          if (!stats?.financialData && !stats?.defaultKeyStatistics) {
            errors.push({ type: 'fundamentals_empty', ticker, yahooSymbol })
            continue
          }
          const row = mapFundamentalsRow(ticker, stats, date)
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
          yahooStats.failed += 1
          errors.push({ type: 'fundamentals', ticker, yahooSymbol, error: err.message })
          console.error('[cron/fetch-prices] fundamentals failed', ticker, yahooSymbol, err.message)
        }
        await sleep(200)
      }
    }

    const result = {
      ok: true,
      date,
      tickers: tickers.length,
      pricesUpserted,
      fundamentalsUpserted,
      fundamentalsRun: fetchFundamentals,
      yahooCallsOk: yahooStats.ok,
      yahooCallsFailed: yahooStats.failed,
      fxCached: [...fxCache.keys()],
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
      yahooCallsOk: yahooStats.ok,
      yahooCallsFailed: yahooStats.failed,
      ms: Date.now() - started,
    })
  }
}
