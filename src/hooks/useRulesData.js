import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchRules,
  fetchRulesLog,
  insertRule,
  insertRulesLog,
  renameRuleKey,
  updateRule,
} from '../lib/api'
import {
  MARKET_MOCK,
  RULE_SECTIONS,
  collectRuleDefs,
  computeLadderHint,
  computeSpyiStatus,
  getRuleValue,
  parseRuleNumeric,
} from '../lib/rules'

const CRON_RULE_DEFAULTS = [
  { key: 'cron_prices_active', defaultValue: 'true', label: 'Denní aktualizace cen' },
  {
    key: 'cron_recommendations_active',
    defaultValue: 'true',
    label: 'Denní aktualizace doporučení',
  },
]

export function useRulesData() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rules, setRules] = useState([])
  const [log, setLog] = useState([])

  const ensureMissingDefaults = useCallback(async (rulesData, userId) => {
    let next = [...rulesData]
    const byKey = {}
    for (const row of next) {
      if (row.key) byKey[row.key] = row
    }

    // Legacy: dip_year_target_2027 → dip_year_target_default
    if (byKey.dip_year_target_2027 && !byKey.dip_year_target_default) {
      try {
        const renamed = await renameRuleKey(
          byKey.dip_year_target_2027.id,
          'dip_year_target_default',
          'DIP roční cíl 2027+ (Kč)',
        )
        next = next.map((r) => (r.id === renamed.id ? renamed : r))
        delete byKey.dip_year_target_2027
        byKey.dip_year_target_default = renamed
      } catch (err) {
        console.warn('[rules] rename dip_year_target_2027', err)
      }
    }

    const missing = [
      ...collectRuleDefs().filter((def) => !byKey[def.key]),
      ...CRON_RULE_DEFAULTS.filter((def) => !byKey[def.key]),
    ]
    if (!missing.length) return next

    const created = []
    for (const def of missing) {
      try {
        const row = await insertRule({
          user_id: userId,
          key: def.key,
          value: String(def.defaultValue ?? ''),
          description: def.description || def.label || null,
        })
        created.push(row)
      } catch (err) {
        console.warn('[rules] ensure default', def.key, err)
      }
    }
    return created.length ? [...next, ...created] : next
  }, [])

  const reload = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        if (!user?.id) {
          setRules([])
          setLog([])
          return
        }
        const [rulesRaw, logData] = await Promise.all([
          fetchRules(user.id),
          fetchRulesLog(user.id, 100).catch(() => []),
        ])
        const rulesData = await ensureMissingDefaults(rulesRaw, user.id)
        setRules(rulesData)
        setLog(logData)
      } catch (err) {
        console.error('[rules]', err)
        setError(err.message || 'Nepodařilo se načíst pravidla')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [user?.id, ensureMissingDefaults],
  )

  useEffect(() => {
    reload()
  }, [reload])

  const rulesByKey = useMemo(() => {
    const map = {}
    for (const row of rules) {
      if (row.key) map[row.key] = row
    }
    return map
  }, [rules])

  const saveRule = useCallback(
    async (key, newValue, meta = {}) => {
      if (!user?.id) throw new Error('Nejste přihlášeni')

      const existing = rulesByKey[key]
      const oldValue = existing?.value != null ? String(existing.value) : String(meta.defaultValue ?? '')
      const next = String(newValue)

      if (existing?.id && existing.user_id === user.id) {
        await updateRule(existing.id, next)
      } else if (existing?.id && existing.user_id !== user.id) {
        // Shared rule — create user-owned copy
        await insertRule({
          user_id: user.id,
          key,
          value: next,
          description: existing.description || meta.label || null,
        })
      } else {
        await insertRule({
          user_id: user.id,
          key,
          value: next,
          description: meta.label || null,
        })
      }

      try {
        await insertRulesLog({
          user_id: user.id,
          rule_key: key,
          old_value: oldValue,
          new_value: next,
          reason: null,
          changed_at: new Date().toISOString(),
        })
      } catch (logErr) {
        console.warn('[rules_log]', logErr)
      }

      await reload({ silent: true })
    },
    [user?.id, rulesByKey, reload],
  )

  const market = useMemo(() => {
    const pausePe =
      parseRuleNumeric(
        getRuleValue(
          rulesByKey,
          'sp500_pe_threshold',
          getRuleValue(rulesByKey, 'spyi_pe_threshold', getRuleValue(rulesByKey, 'spyi_pause_pe', '21')),
        ),
      ) ?? 21
    const resumeCorrection =
      parseRuleNumeric(getRuleValue(rulesByKey, 'spyi_resume_correction', '-20')) ?? -20
    const pe =
      parseRuleNumeric(
        getRuleValue(rulesByKey, 'sp500_pe_current', getRuleValue(rulesByKey, 'spyi_pe_current', '')),
      ) ?? MARKET_MOCK.sp500Pe
    const ath =
      parseRuleNumeric(getRuleValue(rulesByKey, 'sp500_vs_ath', '')) ?? MARKET_MOCK.spAthDistance
    // sp500_vs_ath is already percent points (e.g. -0.5 = -0,5 %)
    const peOver = pe > pausePe
    const storedStatus = getRuleValue(rulesByKey, 'sp500_status', getRuleValue(rulesByKey, 'spyi_status', ''))
    const computed = computeSpyiStatus(pe, pausePe, resumeCorrection, ath)
    const statusLabel =
      storedStatus === 'PAUZA' || storedStatus === 'AKTIVNÍ'
        ? storedStatus === 'PAUZA'
          ? '⏸️ PAUZA'
          : '▶️ AKTIVNÍ'
        : computed.label

    return {
      sp500Pe: pe,
      pausePe,
      peOver,
      athDistance: ath,
      ladderHint: computeLadderHint(ath),
      sp500Status: statusLabel,
    }
  }, [rulesByKey])

  return {
    loading,
    error,
    reload,
    rulesByKey,
    sections: RULE_SECTIONS,
    saveRule,
    log,
    market,
  }
}
