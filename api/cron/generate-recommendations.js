import { createClient } from '@supabase/supabase-js'

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash']
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

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

function authorize(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.authorization || ''
  return header === `Bearer ${secret}`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function dayOfMonthUTC() {
  return new Date().getUTCDate()
}

function yearMonthUTC() {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function normalizeTicker(ticker) {
  return String(ticker || '').trim().toUpperCase()
}

function fmtNum(n, digits = 2) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function fmtPct(ratio, digits = 1) {
  if (ratio == null || !Number.isFinite(Number(ratio))) return '—'
  const pct = Number(ratio) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(digits)} %`
}

/** Latest row per ticker from rows ordered by date DESC. */
function latestByTicker(rows) {
  const map = new Map()
  for (const row of rows || []) {
    const t = normalizeTicker(row.ticker)
    if (!t || map.has(t)) continue
    map.set(t, row)
  }
  return map
}

/** Qty + weighted avg cost from BUY/SELL (proportional cost on sell). */
function computeHoldings(transactions) {
  const map = new Map()

  const sorted = [...(transactions || [])].sort((a, b) => {
    const d = String(a.date || '').localeCompare(String(b.date || ''))
    if (d !== 0) return d
    return String(a.created_at || '').localeCompare(String(b.created_at || ''))
  })

  for (const tx of sorted) {
    const ticker = normalizeTicker(tx.ticker)
    if (!ticker) continue
    const type = String(tx.type || '').toUpperCase()
    if (type !== 'BUY' && type !== 'SELL') continue

    const qty = Number(tx.quantity) || 0
    const price = Number(tx.price) || 0
    if (!map.has(ticker)) map.set(ticker, { qty: 0, cost: 0 })

    const pos = map.get(ticker)
    if (type === 'BUY') {
      pos.qty += qty
      pos.cost += price * qty
    } else {
      const avg = pos.qty > 0 ? pos.cost / pos.qty : 0
      pos.qty -= qty
      pos.cost -= avg * qty
    }
  }

  const out = new Map()
  for (const [ticker, pos] of map) {
    if (pos.qty <= 1e-9) continue
    out.set(ticker, {
      qty: pos.qty,
      avgPrice: pos.qty > 0 ? pos.cost / pos.qty : 0,
    })
  }
  return out
}

function buildSystemPrompt({ rules, watchlist, prices, holdings, fundamentals, date, dayOfMonth, allocationNote }) {
  const rulesBlock =
    rules.length > 0
      ? rules.map((r) => `${r.key}: ${r.value}`).join('\n')
      : '(žádná pravidla)'

  const watchBlock =
    watchlist.length > 0
      ? watchlist
          .map((w) => {
            const ticker = normalizeTicker(w.ticker)
            const price = prices.get(ticker)?.price
            const target = w.target_price != null ? Number(w.target_price) : null
            let dist = '—'
            if (price != null && target != null && target !== 0) {
              dist = fmtPct((Number(price) - target) / target)
            }
            return [
              ticker,
              w.name || '—',
              w.bf_rating || '—',
              target != null ? fmtNum(target) : '—',
              price != null ? fmtNum(price) : '—',
              dist,
              w.currency || '—',
            ].join(' | ')
          })
          .join('\n')
      : '(prázdný watchlist)'

  const posBlock =
    holdings.size > 0
      ? [...holdings.entries()]
          .map(([ticker, h]) => {
            const price = prices.get(ticker)?.price
            const pnl =
              price != null && h.avgPrice > 0 ? (Number(price) - h.avgPrice) / h.avgPrice : null
            return [
              ticker,
              fmtNum(h.qty, 4),
              fmtNum(h.avgPrice),
              price != null ? fmtNum(price) : '—',
              fmtPct(pnl),
            ].join(' | ')
          })
          .join('\n')
      : '(žádné otevřené pozice)'

  const fundTickers = new Set([
    ...watchlist.map((w) => normalizeTicker(w.ticker)),
    ...holdings.keys(),
  ])
  const fundLines = []
  for (const ticker of [...fundTickers].sort()) {
    const f = fundamentals.get(ticker)
    if (!f) continue
    fundLines.push(
      [
        ticker,
        f.roic != null ? fmtPct(f.roic) : '—',
        f.roe != null ? fmtPct(f.roe) : '—',
        f.net_margin != null ? fmtPct(f.net_margin) : '—',
        f.revenue_growth != null ? fmtPct(f.revenue_growth) : '—',
      ].join(' | '),
    )
  }
  const fundBlock = fundLines.length > 0 ? fundLines.join('\n') : '(žádné fundamenty)'

  return `Jsi investiční poradce pro českou value investing strategii. Generuješ denní doporučení.

PRAVIDLA (aktuální):
${rulesBlock}

WATCHLIST (aktivní tituly):
ticker | název | BF rating | cíl | aktuální cena | vzdálenost od cíle | měna
${watchBlock}

AKTUÁLNÍ POZICE:
ticker | počet ks | průměrná cena | aktuální cena | P&L %
${posBlock}

FUNDAMENTY:
ticker | ROIC | ROE | net margin | revenue growth
${fundBlock}

ALOKACE TENTO MĚSÍC:
${allocationNote}

DNEŠNÍ DATUM: ${date}
DEN V MĚSÍCI: ${dayOfMonth} (deadline alokace: 25.)

Vygeneruj 2-5 doporučení. Každé doporučení má:

type: BUY | WATCH | EARNINGS | REBALANCE | ALERT
ticker: symbol
price: aktuální cena
message: krátká česká zpráva (max 100 znaků) vysvětlující proč
priority: 1-5 (1 = nejvyšší)

Odpověz POUZE validním JSON polem, bez markdown, bez vysvětlení.
Příklad: [{"type":"BUY","ticker":"RYAAY","price":59.96,"message":"V buy zóně — 1,6 % od cíle, BF-A","priority":1}]

Pravidla pro generování:

BUY: ticker je v buy zóně (vzdálenost < 5 %) nebo těsně nad ní (< 10 % a BF-A)
WATCH: ticker se blíží k zóně (10-15 %)
ALERT: pozice překračuje limit, nebo exit trigger aktivní
REBALANCE: pokud je den > 20 a alokace nesplněna, připomeň
Nikdy nedoporučuj prodej bez aktivního exit triggeru`
}

function parseGeminiJson(text) {
  const raw = String(text || '').trim()
  if (!raw) throw new Error('Empty Gemini response')

  const tryParse = (s) => {
    const parsed = JSON.parse(s)
    if (!Array.isArray(parsed)) throw new Error('Gemini JSON is not an array')
    return parsed
  }

  try {
    return tryParse(raw)
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced) return tryParse(fenced[1].trim())

    const start = raw.indexOf('[')
    const end = raw.lastIndexOf(']')
    if (start >= 0 && end > start) return tryParse(raw.slice(start, end + 1))

    throw new Error('Invalid JSON from Gemini')
  }
}

function normalizeRecommendations(items, date) {
  const allowed = new Set(['BUY', 'WATCH', 'EARNINGS', 'REBALANCE', 'ALERT'])
  const out = []

  for (const item of items || []) {
    if (!item || typeof item !== 'object') continue
    const type = String(item.type || '')
      .trim()
      .toUpperCase()
    if (!allowed.has(type)) continue

    const ticker = item.ticker != null ? normalizeTicker(item.ticker) : null
    const price = item.price != null && item.price !== '' ? Number(item.price) : null
    const message = String(item.message || '')
      .trim()
      .slice(0, 100)
    let priority = Number(item.priority)
    if (!Number.isFinite(priority)) priority = 3
    priority = Math.min(5, Math.max(1, Math.round(priority)))

    if (!message) continue

    out.push({
      date,
      type,
      ticker: ticker || null,
      price: Number.isFinite(price) ? price : null,
      message,
      priority,
    })
  }

  return out.slice(0, 5)
}

async function callGemini(apiKey, systemPrompt, userPrompt) {
  let lastError = null

  for (const model of GEMINI_MODELS) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = body?.error?.message || res.statusText || `HTTP ${res.status}`
        lastError = new Error(`${model}: ${msg}`)
        console.error('[cron/generate-recommendations] gemini fail', model, msg)
        continue
      }

      const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
      return { model, text }
    } catch (err) {
      lastError = err
      console.error('[cron/generate-recommendations] gemini error', model, err.message)
    }
  }

  throw lastError || new Error('All Gemini models failed')
}

async function loadContext(supabase) {
  const [
    rulesRes,
    watchRes,
    pricesRes,
    txRes,
    fundRes,
    usersRes,
  ] = await Promise.all([
    supabase.from('inv_rules').select('key, value').order('key'),
    supabase
      .from('inv_watchlist')
      .select('ticker, name, currency, target_price, bf_rating, status')
      .eq('status', 'active')
      .order('ticker'),
    supabase.from('inv_prices').select('ticker, date, price').order('date', { ascending: false }),
    supabase
      .from('inv_transactions')
      .select('ticker, type, quantity, price, date, created_at')
      .order('date', { ascending: true }),
    supabase
      .from('inv_fundamentals')
      .select('ticker, date, roic, roe, net_margin, revenue_growth')
      .order('date', { ascending: false }),
    supabase.from('inv_users').select('id').order('id', { ascending: true }).limit(1),
  ])

  for (const [label, res] of [
    ['inv_rules', rulesRes],
    ['inv_watchlist', watchRes],
    ['inv_prices', pricesRes],
    ['inv_transactions', txRes],
    ['inv_fundamentals', fundRes],
    ['inv_users', usersRes],
  ]) {
    if (res.error) throw new Error(`${label}: ${res.error.message}`)
  }

  const userId = usersRes.data?.[0]?.id || null
  if (!userId) throw new Error('No user found in inv_users')

  const ym = yearMonthUTC()
  const tasksRes = await supabase
    .from('inv_monthly_tasks')
    .select('id, completed, cancelled, task_type, title, amount')
    .eq('user_id', userId)
    .eq('year_month', ym)

  if (tasksRes.error) {
    console.warn('[cron/generate-recommendations] monthly_tasks', tasksRes.error.message)
  }

  const tasks = tasksRes.data || []
  const openTasks = tasks.filter((t) => !t.completed && !t.cancelled)
  const allocationNote =
    tasks.length === 0
      ? 'Žádné měsíční úkoly — alokace pravděpodobně nesplněna / neplánována.'
      : openTasks.length === 0
        ? 'Všechny měsíční úkoly dokončeny — alokace splněna.'
        : `Nesplněno: ${openTasks.length} otevřených úkolů (${openTasks.map((t) => t.title || t.task_type).join(', ')}).`

  return {
    userId,
    rules: rulesRes.data || [],
    watchlist: watchRes.data || [],
    prices: latestByTicker(pricesRes.data),
    holdings: computeHoldings(txRes.data),
    fundamentals: latestByTicker(fundRes.data),
    allocationNote,
  }
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
  const day = dayOfMonthUTC()
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: 'Missing GOOGLE_AI_STUDIO_API_KEY',
      date,
      ms: Date.now() - started,
    })
  }

  try {
    const supabase = getAdminClient()
    const ctx = await loadContext(supabase)

    const systemPrompt = buildSystemPrompt({
      rules: ctx.rules,
      watchlist: ctx.watchlist,
      prices: ctx.prices,
      holdings: ctx.holdings,
      fundamentals: ctx.fundamentals,
      date,
      dayOfMonth: day,
      allocationNote: ctx.allocationNote,
    })

    const userPrompt =
      'Vygeneruj dnešní doporučení podle system instrukcí. Odpověz pouze JSON polem.'

    console.log(
      `[cron/generate-recommendations] watchlist=${ctx.watchlist.length} holdings=${ctx.holdings.size} rules=${ctx.rules.length}`,
    )

    const { model, text } = await callGemini(apiKey, systemPrompt, userPrompt)

    let parsed
    try {
      parsed = parseGeminiJson(text)
    } catch (err) {
      console.error('[cron/generate-recommendations] invalid JSON', err.message, text?.slice?.(0, 500))
      return res.status(502).json({
        ok: false,
        error: err.message || 'Invalid JSON from Gemini',
        date,
        model,
        rawPreview: String(text || '').slice(0, 300),
        ms: Date.now() - started,
      })
    }

    const recommendations = normalizeRecommendations(parsed, date).map((r) => ({
      ...r,
      user_id: ctx.userId,
    }))

    if (!recommendations.length) {
      return res.status(502).json({
        ok: false,
        error: 'Gemini returned no valid recommendations',
        date,
        model,
        ms: Date.now() - started,
      })
    }

    const { error: delError } = await supabase.from('inv_recommendations').delete().eq('date', date)
    if (delError) throw new Error(`delete inv_recommendations: ${delError.message}`)

    const { error: insError } = await supabase.from('inv_recommendations').insert(recommendations)
    if (insError) throw new Error(`insert inv_recommendations: ${insError.message}`)

    const result = {
      ok: true,
      date,
      recommendations: recommendations.length,
      model,
      ms: Date.now() - started,
    }
    console.log('[cron/generate-recommendations] done', result)
    return res.status(200).json(result)
  } catch (err) {
    console.error('[cron/generate-recommendations] fatal', err)
    return res.status(500).json({
      ok: false,
      error: err.message || String(err),
      date,
      ms: Date.now() - started,
    })
  }
}
