import { useAuth } from '../context/AuthContext'
import { useRulesData } from '../hooks/useRulesData'
import {
  AutoUpdatesSection,
  GlossarySection,
  MarketIndicators,
  RulesHistory,
  RulesSection,
} from '../components/RulesSections'

export default function Rules() {
  const { user } = useAuth()
  const { loading, error, reload, rulesByKey, sections, saveRule, log, market } = useRulesData()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[#94a3b8]">
        Načítám pravidla…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-[#dc2626]">
        <p>{error}</p>
        <button type="button" onClick={reload} className="mt-2 underline">
          Zkusit znovu
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-[#0f172a]">Pravidla</h1>

      {sections.map((section) => (
        <RulesSection
          key={section.id}
          title={section.title}
          rows={section.rows}
          groups={section.groups}
          footerRows={section.footerRows}
          rulesByKey={rulesByKey}
          onSave={saveRule}
        />
      ))}

      <MarketIndicators market={market} />
      <AutoUpdatesSection
        rulesByKey={rulesByKey}
        userId={user?.id}
        onRulesChanged={() => reload({ silent: true })}
      />
      <GlossarySection />
      <RulesHistory log={log} />
    </div>
  )
}
