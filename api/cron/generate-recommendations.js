import { createClient } from '@supabase/supabase-js'

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash']
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Approximate CZK FX for portfolio weight / allocation context. */
const DEFAULT_FX = { CZK: 1, EUR: 24.2, USD: 22.0 }

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

function fmtPctPlain(ratio, digits = 1) {
  if (ratio == null || !Number.isFinite(Number(ratio))) return '—'
  return `${(Number(ratio) * 100).toFixed(digits)} %`
}

function fmtCzk(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `${Math.round(Number(n)).toLocaleString('cs-CZ')} Kč`
}

function toCzk(amount, currency) {
  const cur = String(currency || 'CZK').toUpperCase()
  const rate = DEFAULT_FX[cur] ?? 1
  return Number(amount || 0) * rate
}

function getRuleValue(rules, key, fallback = null) {
  const row = (rules || []).find((r) => r.key === key)
  if (!row || row.value == null || String(row.value).trim() === '') return fallback
  return String(row.value)
}

function getRuleNumber(rules, key, fallback = 0) {
  const raw = getRuleValue(rules, key, null)
  if (raw == null) return fallback
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : fallback
}

/** Position limit as ratio (0.10). Accepts position_limit_pct or limit_single_stock. */
function getPositionLimit(rules) {
  const raw =
    getRuleValue(rules, 'position_limit_pct', null) ?? getRuleValue(rules, 'limit_single_stock', '0.10')
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(n)) return 0.1
  // stored as 0.10 or as 10
  return Math.abs(n) > 1 ? n / 100 : n
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
    const currency = String(tx.currency || 'CZK').toUpperCase()
    if (!map.has(ticker)) map.set(ticker, { qty: 0, cost: 0, currency })

    const pos = map.get(ticker)
    if (tx.currency) pos.currency = currency

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
      currency: pos.currency || 'CZK',
    })
  }
  return out
}

function enrichHoldings(holdings, prices, watchlistByTicker) {
  let totalEquity = 0
  const enriched = new Map()

  for (const [ticker, h] of holdings) {
    const price = prices.get(ticker)?.price
    const wl = watchlistByTicker.get(ticker)
    const currency = wl?.currency || h.currency || 'CZK'
    const valueCzk =
      price != null ? toCzk(Number(price) * h.qty, currency) : 0
    enriched.set(ticker, { ...h, currency, price, valueCzk })
    totalEquity += valueCzk
  }

  for (const [ticker, h] of enriched) {
    h.weight = totalEquity > 0 ? h.valueCzk / totalEquity : 0
    enriched.set(ticker, h)
  }

  return { holdings: enriched, totalEquity }
}

function sumBuysCzk(transactions, predicate) {
  let sum = 0
  for (const tx of transactions || []) {
    if (String(tx.type || '').toUpperCase() !== 'BUY') continue
    if (!predicate(tx)) continue
    sum += toCzk(Number(tx.price) * Number(tx.quantity), tx.currency)
  }
  return sum
}

function getExitCheckState(now = new Date()) {
  const month = now.getUTCMonth() + 1
  const day = now.getUTCDate()
  const year = now.getUTCFullYear()
  const isExitCheckMonth = [1, 4, 7, 10].includes(month) && day <= 7

  const names = { 1: 'leden', 4: 'duben', 7: 'červenec', 10: 'říjen' }
  const exitMonths = [1, 4, 7, 10]

  if (isExitCheckMonth) {
    return { isExitCheckMonth: true, nextLabel: null }
  }

  for (const y of [year, year + 1]) {
    for (const m of exitMonths) {
      if (y === year && m < month) continue
      if (y === year && m === month) continue // minulé okno (den > 7)
      return { isExitCheckMonth: false, nextLabel: `${names[m]} ${y}` }
    }
  }

  return { isExitCheckMonth: false, nextLabel: `leden ${year + 1}` }
}

function buildExitSection({ isExitCheckMonth, nextLabel, fundamentals, rules, holdings }) {
  if (!isExitCheckMonth) {
    return `EXIT TRIGGERY:
Exit triggery se nekontrolují — příští kontrola: ${nextLabel}`
  }

  const exitRules = [
    `exit_roic_min: ${getRuleValue(rules, 'exit_roic_min', '0.12')}`,
    `exit_roe_min: ${getRuleValue(rules, 'exit_roe_min', '0.12')}`,
    `exit_signals_required: ${getRuleValue(rules, 'exit_signals_required', '2 ze 3')}`,
    `exit_roic_years: ${getRuleValue(rules, 'exit_roic_years', '2')}`,
    `exit_margin_years: ${getRuleValue(rules, 'exit_margin_years', '3')}`,
    `exit_revenue_years: ${getRuleValue(rules, 'exit_revenue_years', '3')}`,
    `csg_stop_loss: ${getRuleValue(rules, 'csg_stop_loss', '12')}`,
  ].join('\n')

  const lines = []
  for (const ticker of [...holdings.keys()].sort()) {
    const f = fundamentals.get(ticker)
    if (!f) continue
    lines.push(
      [
        ticker,
        f.roic != null ? fmtPct(f.roic) : '—',
        f.roe != null ? fmtPct(f.roe) : '—',
        f.net_margin != null ? fmtPct(f.net_margin) : '—',
        f.revenue_growth != null ? fmtPct(f.revenue_growth) : '—',
      ].join(' | '),
    )
  }

  return `EXIT CHECK (kvartální — po earnings season):
Pravidla:
${exitRules}

Fundamenty držených pozic:
ticker | ROIC | ROE | net margin | revenue growth
${lines.length ? lines.join('\n') : '(žádné fundamenty)'}

Vyhodnoť exit triggery. ALERT jen při aktivním exit signálu (2 ze 3). Nikdy nedoporučuj prodej bez aktivního exit triggeru.`
}

function buildSystemPrompt({
  rules,
  watchlist,
  prices,
  holdings,
  fundamentals,
  date,
  dayOfMonth,
  allocationNote,
  snoozedTickers,
  positionLimit,
  remainingMonthlyCzk,
  remainingDipCzk,
  totalEquity,
  exitSection,
}) {
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
            const price = h.price ?? prices.get(ticker)?.price
            const pnl =
              price != null && h.avgPrice > 0 ? (Number(price) - h.avgPrice) / h.avgPrice : null
            const nearLimit = h.weight >= positionLimit * 0.9
            return [
              ticker,
              fmtNum(h.qty, 4),
              fmtNum(h.avgPrice),
              price != null ? fmtNum(price) : '—',
              fmtPct(pnl),
              fmtPctPlain(h.weight),
              nearLimit ? 'BLÍZKO/NA LIMITU' : 'ok',
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

  const snoozeList =
    snoozedTickers.length > 0 ? snoozedTickers.join(', ') : '(žádné)'

  return `Jsi investiční poradce pro českou value investing strategii. Generuješ denní doporučení.

PRAVIDLA (aktuální):
${rulesBlock}

WATCHLIST (aktivní tituly):
ticker | název | BF rating | cíl | aktuální cena | vzdálenost od cíle | měna
${watchBlock}

AKTUÁLNÍ POZICE:
ticker | počet ks | průměrná cena | aktuální cena | P&L % | váha portfolia | limit status
${posBlock}

Celkové equity portfolio: ${fmtCzk(totalEquity)}
Max limit na jednu pozici: ${fmtPctPlain(positionLimit)} (position_limit_pct / limit_single_stock)
Pozice na limitu = váha ≥ 90 % limitu → NEKUPUJ, napiš "pozice na limitu"

FUNDAMENTY:
ticker | ROIC | ROE | net margin | revenue growth
${fundBlock}

ALOKACE:
${allocationNote}
Zbývající měsíční alokace (XTB): ${fmtCzk(remainingMonthlyCzk)}
Zbývající DIP alokace (rok): ${fmtCzk(remainingDipCzk)}

ZTLUMENÉ TICKERY (nealertovat): ${snoozeList}
Tyto tickery přeskoč v ALERT doporučeních (BUY/WATCH stále může).

${exitSection}

DNEŠNÍ DATUM: ${date}
DEN V MĚSÍCI: ${dayOfMonth} (deadline alokace: 25.)

Vygeneruj 2-5 doporučení. Každé doporučení má:

type: BUY | WATCH | EARNINGS | REBALANCE | ALERT
ticker: symbol
price: aktuální cena
message: krátká česká zpráva (max 180 znaků) vysvětlující proč
priority: 1-5 (1 = nejvyšší)

Odpověz POUZE validním JSON polem, bez markdown, bez vysvětlení.
Příklad: [{"type":"BUY","ticker":"RYAAY","price":59.96,"message":"Kup 2x RYAAY (~120 USD / ~3 000 Kč). Pozice 4,2 %, limit 10 %. V buy zóně 1,6 % od cíle.","priority":1}]

Pravidla pro generování:

BUY: ticker je v buy zóně (vzdálenost od cíle < 5 %) nebo těsně nad ní (< 10 % a BF-A).
BUY message MUSÍ obsahovat:
1) konkrétní počet kusů k nákupu
2) přibližnou částku v původní měně i v Kč
3) zdůvodnění: proč tento ticker a ne jiný v buy zóně
Logika výběru BUY:
- Pokud je více tickerů v buy zóně, preferuj ten s menší pozicí (%)
- Pokud je pozice na limitu nebo blízko (>90 % limitu), NEKUPUJ — řekni "pozice na limitu"
- Rozděl zbývající měsíční alokaci mezi doporučené nákupy (součet Kč ≤ zbývající alokace)
WATCH: ticker se blíží k zóně (10-15 %)
ALERT: pozice překračuje limit, nebo exit trigger aktivní (jen v EXIT CHECK okně). Nealertuj ztlumené tickery.
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
      .slice(0, 180)
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
  const date = todayISO()
  const [
    rulesRes,
    watchRes,
    pricesRes,
    txRes,
    fundRes,
    usersRes,
    snoozeRes,
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
      .select('ticker, type, quantity, price, date, created_at, currency, account')
      .order('date', { ascending: true }),
    supabase
      .from('inv_fundamentals')
      .select('ticker, date, roic, roe, net_margin, revenue_growth')
      .order('date', { ascending: false }),
    supabase.from('inv_users').select('id').order('id', { ascending: true }).limit(1),
    supabase
      .from('inv_alert_snooze')
      .select('ticker, snoozed_until, user_id')
      .gte('snoozed_until', date),
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

  if (snoozeRes.error) {
    console.warn('[cron/generate-recommendations] snooze', snoozeRes.error.message)
  }

  const userId = usersRes.data?.[0]?.id || null
  if (!userId) throw new Error('No user found in inv_users')

  const ym = yearMonthUTC()
  const year = new Date().getUTCFullYear()
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

  const rules = rulesRes.data || []
  const transactions = txRes.data || []
  const watchlist = watchRes.data || []
  const prices = latestByTicker(pricesRes.data)
  const rawHoldings = computeHoldings(transactions)

  const watchlistByTicker = new Map(
    watchlist.map((w) => [normalizeTicker(w.ticker), w]),
  )
  const { holdings, totalEquity } = enrichHoldings(rawHoldings, prices, watchlistByTicker)

  const monthlyTarget = getRuleNumber(rules, 'monthly_xtb', 21000)
  const monthlyInvested = sumBuysCzk(
    transactions,
    (tx) =>
      String(tx.account || '').toLowerCase() === 'xtb' &&
      String(tx.date || '').startsWith(ym),
  )
  const remainingMonthlyCzk = Math.max(0, monthlyTarget - monthlyInvested)

  const dipTarget = getRuleNumber(
    rules,
    `dip_year_target_${year}`,
    getRuleNumber(rules, 'dip_year_target_2026', 96000),
  )
  const dipInvested = sumBuysCzk(
    transactions,
    (tx) =>
      String(tx.account || '').toLowerCase() === 'dip' &&
      String(tx.date || '').startsWith(String(year)),
  )
  const remainingDipCzk = Math.max(0, dipTarget - dipInvested)

  const snoozedTickers = [
    ...new Set(
      (snoozeRes.data || [])
        .filter((s) => !s.user_id || s.user_id === userId)
        .map((s) => normalizeTicker(s.ticker))
        .filter(Boolean),
    ),
  ].sort()

  const exitState = getExitCheckState()
  const fundamentals = latestByTicker(fundRes.data)
  const exitSection = buildExitSection({
    ...exitState,
    fundamentals,
    rules,
    holdings,
  })

  return {
    userId,
    rules,
    watchlist,
    prices,
    holdings,
    fundamentals,
    allocationNote,
    snoozedTickers,
    positionLimit: getPositionLimit(rules),
    remainingMonthlyCzk,
    remainingDipCzk,
    totalEquity,
    exitSection,
    isExitCheckMonth: exitState.isExitCheckMonth,
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
      snoozedTickers: ctx.snoozedTickers,
      positionLimit: ctx.positionLimit,
      remainingMonthlyCzk: ctx.remainingMonthlyCzk,
      remainingDipCzk: ctx.remainingDipCzk,
      totalEquity: ctx.totalEquity,
      exitSection: ctx.exitSection,
    })

    const userPrompt =
      'Vygeneruj dnešní doporučení podle system instrukcí. Odpověz pouze JSON polem.'

    console.log(
      `[cron/generate-recommendations] watchlist=${ctx.watchlist.length} holdings=${ctx.holdings.size} rules=${ctx.rules.length} snoozed=${ctx.snoozedTickers.length} exitCheck=${ctx.isExitCheckMonth}`,
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

    const snoozedSet = new Set(ctx.snoozedTickers)
    let recommendations = normalizeRecommendations(parsed, date)
      .filter((r) => !(r.type === 'ALERT' && r.ticker && snoozedSet.has(r.ticker)))
      .map((r) => ({
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
      exitCheck: ctx.isExitCheckMonth,
      snoozed: ctx.snoozedTickers.length,
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
