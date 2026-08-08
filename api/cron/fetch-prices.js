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

async function fetchQuotes(tickers, apiKey) {
  // FMP supports comma-separated batch quotes
  const url = `https://financialmodelingprep.com/api/v3/quote/${tickers.join(',')}?apikey=${apiKey}`
  const res = await fetch(url)
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`FMP quote invalid JSON (${res.status}): ${text.slice(0, 200)}`)
  }

  if (!res.ok) {
    throw new Error(`FMP quote HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  if (data?.['Error Message'] || data?.error) {
    throw new Error(data['Error Message'] || data.error || 'FMP quote error')
  }
  if (!Array.isArray(data)) {
    throw new Error(`FMP quote unexpected payload: ${text.slice(0, 200)}`)
  }
  return data
}

async function fetchKeyMetricsTtm(ticker, apiKey) {
  const url = `https://financialmodelingprep.com/api/v3/key-metrics-ttm/${encodeURIComponent(ticker)}?apikey=${apiKey}`
  const res = await fetch(url)
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`FMP metrics invalid JSON (${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok) {
    throw new Error(`FMP metrics HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  if (data?.['Error Message'] || data?.error) {
    throw new Error(data['Error Message'] || data.error || 'FMP metrics error')
  }
  if (!Array.isArray(data) || !data[0]) return null
  return data[0]
}

function mapQuoteRow(q, date) {
  const ticker = String(q.symbol || '').trim().toUpperCase()
  if (!ticker) return null
  return {
    ticker,
    date,
    price: q.price ?? null,
    change_percent: q.changesPercentage ?? null,
    market_cap: q.marketCap ?? null,
    pe_ratio: q.pe ?? null,
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

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
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
        ms: Date.now() - started,
      })
    }

    // Quotes in batches
    for (const batch of chunk(tickers, 10)) {
      try {
        const quotes = await fetchQuotes(batch, fmpKey)
        const rows = quotes.map((q) => mapQuoteRow(q, date)).filter(Boolean)
        if (rows.length) {
          const { error } = await supabase.from('inv_prices').upsert(rows, {
            onConflict: 'ticker,date',
          })
          if (error) {
            errors.push({ type: 'upsert_prices', batch, error: error.message })
            console.error('[cron/fetch-prices] upsert prices', error.message)
          } else {
            pricesUpserted += rows.length
          }
        }
      } catch (err) {
        errors.push({ type: 'quote', batch, error: err.message })
        console.error('[cron/fetch-prices] quote batch failed', batch.join(','), err.message)
      }
      await sleep(250)
    }

    // Fundamentals once a week (Monday UTC)
    if (fetchFundamentals) {
      for (const ticker of tickers) {
        try {
          const metrics = await fetchKeyMetricsTtm(ticker, fmpKey)
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
          errors.push({ type: 'fundamentals', ticker, error: err.message })
          console.error('[cron/fetch-prices] fundamentals failed', ticker, err.message)
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
      ms: Date.now() - started,
    })
  }
}
