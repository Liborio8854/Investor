import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchRules,
  fetchRulesLog,
  insertRule,
  insertRulesLog,
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

export function useRulesData() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rules, setRules] = useState([])
  const [log, setLog] = useState([])

  const ensureMissingDefaults = useCallback(async (rulesData, userId) => {
    const byKey = {}
    for (const row of rulesData) {
      if (row.key) byKey[row.key] = row
    }

    const missing = collectRuleDefs().filter((def) => !byKey[def.key])
    if (!missing.length) return rulesData

    const created = []
    for (const def of missing) {
      try {
        const row = await insertRule({
          user_id: userId,
          key: def.key,
          value: String(def.defaultValue ?? ''),
          description: def.label || null,
        })
        created.push(row)
      } catch (err) {
        console.warn('[rules] ensure default', def.key, err)
      }
    }
    return created.length ? [...rulesData, ...created] : rulesData
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
    const pausePe = parseRuleNumeric(getRuleValue(rulesByKey, 'spyi_pause_pe', '21')) ?? 21
    const resumeCorrection =
      parseRuleNumeric(getRuleValue(rulesByKey, 'spyi_resume_correction', '-20')) ?? -20
    const pe = MARKET_MOCK.spyiPe
    const ath = MARKET_MOCK.spAthDistance
    const peOver = pe > pausePe
    const spyi = computeSpyiStatus(pe, pausePe, resumeCorrection, ath)

    return {
      spyiPe: pe,
      pausePe,
      peOver,
      athDistance: ath,
      ladderHint: computeLadderHint(ath),
      spyiStatus: spyi.label,
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
