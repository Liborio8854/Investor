import { useState } from 'react'
import { formatDate } from '../lib/format'
import {
  GLOSSARY,
  editValueToStorage,
  formatRuleDisplay,
  getRuleValue,
  ruleToEditValue,
} from '../lib/rules'

function RuleRow({ label, ruleKey, format, defaultValue, hint, rulesByKey, onSave }) {
  const raw = getRuleValue(rulesByKey, ruleKey, defaultValue)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => ruleToEditValue(raw, format))
  const [busy, setBusy] = useState(false)

  const startEdit = () => {
    setDraft(ruleToEditValue(raw, format))
    setEditing(true)
  }

  const cancel = () => {
    setDraft(ruleToEditValue(raw, format))
    setEditing(false)
  }

  const save = async () => {
    setBusy(true)
    try {
      const toStore = editValueToStorage(draft, format)
      await onSave(ruleKey, toStore, { defaultValue, label })
      setEditing(false)
    } catch (err) {
      alert(err.message || 'Uložení selhalo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-[#f1f5f9] py-2.5 first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 text-sm text-[#475569]">{label}</span>

        {editing ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <input
              className="w-28 rounded-md border border-[#2563eb] px-2 py-1 text-right text-sm text-[#0f172a] outline-none"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={busy}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') cancel()
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="px-1 text-sm text-[#059669] disabled:opacity-50"
              aria-label="Uložit"
            >
              ✅
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancel}
              className="px-1 text-sm text-[#94a3b8] disabled:opacity-50"
              aria-label="Zrušit"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-sm font-medium tabular-nums text-[#0f172a]">
              {formatRuleDisplay(raw, format)}
            </span>
            <button
              type="button"
              onClick={startEdit}
              className="px-1 text-sm text-[#94a3b8] hover:text-[#2563eb]"
              aria-label={`Upravit ${label}`}
            >
              ✏️
            </button>
          </div>
        )}
      </div>
      {hint ? <p className="mt-1 pr-8 text-[11px] leading-snug text-[#94a3b8]">{hint}</p> : null}
    </div>
  )
}

export function RulesSection({ title, rows, groups, footerRows, rulesByKey, onSave }) {
  const renderRows = (list, { indented = false } = {}) =>
    (list || []).map((row) => (
      <div key={row.key} className={indented ? 'pl-3' : undefined}>
        <RuleRow
          label={row.label}
          ruleKey={row.key}
          format={row.format}
          defaultValue={row.defaultValue}
          hint={row.hint}
          rulesByKey={rulesByKey}
          onSave={onSave}
        />
      </div>
    ))

  return (
    <section className="border-t border-[#e2e8f0] pt-4 first:border-t-0 first:pt-0">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">{title}</h2>
      <div className="border-t border-[#e2e8f0]">{renderRows(rows)}</div>

      {(groups || []).map((group) => (
        <div key={group.title} className={`mt-3 ${group.indented ? 'pl-1' : ''}`}>
          <h3 className="mb-1 text-xs font-medium text-[#64748b]">{group.title}:</h3>
          <div className="border-t border-[#e2e8f0]">
            {renderRows(group.rows, { indented: Boolean(group.indented) })}
          </div>
        </div>
      ))}

      {(footerRows || []).length > 0 && (
        <div className="border-t border-[#e2e8f0]">{renderRows(footerRows)}</div>
      )}
    </section>
  )
}

export function MarketIndicators({ market }) {
  const athPct = (Number(market.athDistance) || 0) * 100

  return (
    <section className="border-t border-[#e2e8f0] pt-4">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
        Tržní indikátory
      </h2>
      <div className="space-y-2 border-t border-[#e2e8f0] pt-3 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[#475569]">SPYI P/E aktuálně</span>
          <span className="tabular-nums text-[#0f172a]">
            {market.spyiPe.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })}
            <span className={`ml-2 text-xs font-medium ${market.peOver ? 'text-[#dc2626]' : 'text-[#059669]'}`}>
              {market.peOver ? `🔴 nad prahem (${market.pausePe})` : `🟢 pod prahem (${market.pausePe})`}
            </span>
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[#475569]">S&amp;P 500 vs ATH</span>
          <span className="tabular-nums text-[#0f172a]">
            {athPct.toLocaleString('cs-CZ', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
              signDisplay: 'exceptZero',
            })}{' '}
            %
          </span>
        </div>
        <p className="pl-3 text-xs text-[#94a3b8]">└ Žebřík: {market.ladderHint}</p>

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[#475569]">SPYI status</span>
          <span className="font-medium text-[#0f172a]">{market.spyiStatus}</span>
        </div>
      </div>
    </section>
  )
}

export function GlossarySection() {
  const [open, setOpen] = useState(false)

  return (
    <section className="border-t border-[#e2e8f0] pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm font-semibold text-[#0f172a]"
      >
        <span className="text-[#94a3b8]">{open ? '▼' : '▶'}</span>
        Slovník pojmů
      </button>

      {open && (
        <div className="mt-3 space-y-4 pl-1 text-[13px] leading-relaxed text-[#64748b]">
          {GLOSSARY.map((item) => (
            <div key={item.term}>
              <p className="font-medium text-[#475569]">{item.term}</p>
              <p className="mt-0.5 whitespace-pre-line">{item.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function RulesHistory({ log }) {
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? log : log.slice(0, 20)
  const hasMore = log.length > 20

  return (
    <section className="border-t border-[#e2e8f0] pt-4 pb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm font-semibold text-[#0f172a]"
      >
        <span className="text-[#94a3b8]">{open ? '▼' : '▶'}</span>
        Historie změn pravidel
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {visible.length === 0 ? (
            <p className="text-sm text-[#94a3b8]">Zatím žádné změny</p>
          ) : (
            visible.map((row) => (
              <p key={row.id} className="text-xs text-[#475569]">
                <span className="text-[#94a3b8]">{formatDate(row.changed_at)}</span>
                {'  '}
                <span className="font-medium text-[#0f172a]">{row.rule_key}</span>
                {': '}
                {formatLogValue(row.old_value)} → {formatLogValue(row.new_value)}
              </p>
            ))
          )}

          {!showAll && hasMore && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="pt-1 text-sm font-medium text-[#2563eb]"
            >
              Zobrazit vše →
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function formatLogValue(v) {
  if (v == null || v === '') return '—'
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'))
  if (Number.isFinite(n) && Math.abs(n) >= 100) {
    return Math.round(n).toLocaleString('cs-CZ')
  }
  return String(v)
}
