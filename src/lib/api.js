import { supabase } from './supabase'
import { currentYearMonth } from './format'

function assertOk(result, label) {
  if (result.error) {
    const err = new Error(result.error.message || `Chyba při načítání: ${label}`)
    err.code = result.error.code
    err.details = result.error.details
    throw err
  }
  return result.data || []
}

export async function fetchTransactions(userId) {
  const result = await supabase
    .from('inv_transactions')
    .select(
      'id, created_at, user_id, ticker, date, currency, type, notes, price, quantity, fees, account, isin, portfolio',
    )
    .eq('user_id', userId)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })

  return assertOk(result, 'inv_transactions')
}

const TX_SELECT =
  'id, created_at, user_id, ticker, date, currency, type, notes, price, quantity, fees, account, isin, portfolio'

export async function insertTransaction(row) {
  const result = await supabase.from('inv_transactions').insert(row).select(TX_SELECT).single()
  if (result.error) throw result.error
  return result.data
}

export async function updateTransaction(id, patch) {
  const result = await supabase
    .from('inv_transactions')
    .update(patch)
    .eq('id', id)
    .select(TX_SELECT)
    .single()
  if (result.error) throw result.error
  return result.data
}

export async function deleteTransaction(id) {
  const result = await supabase.from('inv_transactions').delete().eq('id', id)
  if (result.error) throw result.error
  return true
}

/** Pravidla uživatele; shared fallback + own override podle key. */
export async function fetchRules(userId) {
  const [own, all] = await Promise.all([
    supabase
      .from('inv_rules')
      .select('id, user_id, key, value, description, updated_at')
      .eq('user_id', userId),
    supabase.from('inv_rules').select('id, user_id, key, value, description, updated_at'),
  ])

  if (own.error) throw own.error
  if (all.error) throw all.error

  const byKey = {}
  for (const row of all.data || []) {
    if (row.key) byKey[row.key] = row
  }
  for (const row of own.data || []) {
    if (row.key) byKey[row.key] = row
  }
  return Object.values(byKey)
}

export async function updateRule(id, value) {
  const result = await supabase
    .from('inv_rules')
    .update({ value: String(value), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, user_id, key, value, description, updated_at')
    .single()

  if (result.error) throw result.error
  return result.data
}

/** Insert rule for user when missing (e.g. editing shared fallback). */
export async function insertRule(row) {
  const result = await supabase
    .from('inv_rules')
    .insert(row)
    .select('id, user_id, key, value, description, updated_at')
    .single()

  if (result.error) throw result.error
  return result.data
}

/**
 * Upsert pravidla podle key (pro cron přepínače apod.).
 * Nejdřív UPDATE všech řádků s key; pokud nic neprojde, INSERT.
 */
export async function upsertRuleByKey({ userId, key, value, description = null }) {
  if (!userId) throw new Error('Chybí user_id')
  if (!key) throw new Error('Chybí key')
  const next = String(value)
  const now = new Date().toISOString()

  const { data: existing, error: selErr } = await supabase
    .from('inv_rules')
    .select('id, user_id, key, value')
    .eq('key', key)

  if (selErr) throw selErr

  if (existing?.length) {
    const { data: updated, error: updErr } = await supabase
      .from('inv_rules')
      .update({ value: next, updated_at: now })
      .eq('key', key)
      .select('id, user_id, key, value, description, updated_at')

    if (updErr) throw updErr
    if (updated?.length) return updated[0]

    // RLS mohlo zablokovat UPDATE — zkus update vlastního řádku podle id
    const own = existing.find((r) => r.user_id === userId) || existing[0]
    const { data: byId, error: byIdErr } = await supabase
      .from('inv_rules')
      .update({ value: next, updated_at: now })
      .eq('id', own.id)
      .select('id, user_id, key, value, description, updated_at')
      .maybeSingle()

    if (byIdErr) throw byIdErr
    if (byId) return byId
  }

  const { data: inserted, error: insErr } = await supabase
    .from('inv_rules')
    .insert({
      user_id: userId,
      key,
      value: next,
      description,
      updated_at: now,
    })
    .select('id, user_id, key, value, description, updated_at')
    .single()

  if (insErr) throw insErr
  return inserted
}

export async function fetchRulesLog(userId, limit = 100) {
  let query = supabase
    .from('inv_rules_log')
    .select('id, rule_key, old_value, new_value, reason, changed_at, user_id')
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (userId) query = query.eq('user_id', userId)

  const result = await query
  return assertOk(result, 'inv_rules_log')
}

export async function insertRulesLog(row) {
  const result = await supabase.from('inv_rules_log').insert(row).select().single()
  if (result.error) throw result.error
  return result.data
}

/** Úkoly pro aktuální měsíc (všechny task_type). */
export async function fetchMonthlyTasks(userId, yearMonth = currentYearMonth()) {
  const result = await supabase
    .from('inv_monthly_tasks')
    .select(
      'id, created_at, user_id, year_month, title, description, amount, notes, completed, task_type, recommendation_text, completed_date, carried_from, cancelled, cancel_reason',
    )
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .order('created_at', { ascending: true })

  return assertOk(result, 'inv_monthly_tasks')
}

export async function updateMonthlyTask(taskId, patch) {
  const result = await supabase
    .from('inv_monthly_tasks')
    .update(patch)
    .eq('id', taskId)
    .select()
    .single()

  if (result.error) throw result.error
  return result.data
}

export async function fetchDashboardData(userId, yearMonth = currentYearMonth()) {
  const [transactions, rules, tasks] = await Promise.all([
    fetchTransactions(userId),
    fetchRules(userId),
    fetchMonthlyTasks(userId, yearMonth),
  ])

  return { transactions, rules, tasks }
}

/** Denní Gemini doporučení pro dnešek (priority ASC). */
export async function fetchTodayRecommendations() {
  const today = new Date().toISOString().slice(0, 10)
  const result = await supabase
    .from('inv_recommendations')
    .select('id, user_id, date, type, ticker, price, message, priority, created_at')
    .eq('date', today)
    .order('priority', { ascending: true })

  return assertOk(result, 'inv_recommendations')
}

/** Poslední aktualizace cen (MAX date + updated_at). */
export async function fetchLastPriceUpdateAt() {
  const result = await supabase
    .from('inv_prices')
    .select('date, updated_at')
    .order('date', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (result.error) throw result.error
  const row = result.data
  if (!row) return null
  return row.updated_at || row.date || null
}

/** Poslední aktualizace doporučení (MAX date + created_at). */
export async function fetchLastRecommendationsUpdateAt() {
  const result = await supabase
    .from('inv_recommendations')
    .select('date, created_at')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (result.error) throw result.error
  const row = result.data
  if (!row) return null
  return row.created_at || row.date || null
}

/** Manuální spuštění cronu přes server proxy (JWT → CRON_SECRET). */
export async function triggerCronJob(job) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Nejste přihlášeni')

  const res = await fetch('/api/trigger-cron', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ job }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || body.message || `Trigger failed (${res.status})`)
  }
  return body
}

/** Aktivní snooze alertů (snoozed_until >= today). */
export async function fetchActiveAlertSnoozes(userId) {
  const today = new Date().toISOString().slice(0, 10)
  let query = supabase
    .from('inv_alert_snooze')
    .select('id, user_id, ticker, snoozed_until, reason, created_at')
    .gte('snoozed_until', today)

  if (userId) query = query.eq('user_id', userId)

  const result = await query
  return assertOk(result, 'inv_alert_snooze')
}

/** Ztlumit ALERT pro ticker na N dní (upsert). */
export async function upsertAlertSnooze({ userId, ticker, days, reason = 'manual' }) {
  const t = String(ticker || '').trim().toUpperCase()
  if (!userId) throw new Error('Chybí user_id')
  if (!t) throw new Error('Chybí ticker')
  const n = Number(days)
  if (![30, 60, 90].includes(n)) throw new Error('Neplatná délka snooze')

  const until = new Date()
  until.setUTCDate(until.getUTCDate() + n)
  const snoozed_until = until.toISOString().slice(0, 10)

  const result = await supabase
    .from('inv_alert_snooze')
    .upsert(
      {
        user_id: userId,
        ticker: t,
        snoozed_until,
        reason,
      },
      { onConflict: 'user_id,ticker' },
    )
    .select('id, user_id, ticker, snoozed_until, reason, created_at')
    .single()

  if (result.error) throw result.error
  return result.data
}

const WATCHLIST_SELECT =
  'id, created_at, updated_at, user_id, ticker, name, currency, status, notes, isin, target_price, target_t1, target_t2, bf_rating, mos, valuation_method'

export async function fetchWatchlist(userId) {
  const result = await supabase
    .from('inv_watchlist')
    .select(WATCHLIST_SELECT)
    .eq('user_id', userId)
    .order('ticker', { ascending: true })

  return assertOk(result, 'inv_watchlist')
}

export async function insertWatchlistItem(row) {
  const result = await supabase.from('inv_watchlist').insert(row).select(WATCHLIST_SELECT).single()

  if (result.error) throw result.error
  return result.data
}

export async function updateWatchlistItem(id, patch) {
  const result = await supabase
    .from('inv_watchlist')
    .update(patch)
    .eq('id', id)
    .select(WATCHLIST_SELECT)
    .single()

  if (result.error) throw result.error
  return result.data
}