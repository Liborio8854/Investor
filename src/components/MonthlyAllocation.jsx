import { useState } from 'react'
import { updateMonthlyTask } from '../lib/api'
import { currentYearMonth, formatCzk, formatDate, nextYearMonth, todayISO } from '../lib/format'

function progressColor(pct, variant) {
  if (variant === 'dip') return '#7c3aed'
  if (pct >= 1) return '#059669'
  if (pct >= 0.6) return '#2563eb'
  return '#eab308'
}

function ProgressBar({ value, target, variant = 'xtb' }) {
  const pct = target > 0 ? Math.min(value / target, 1.15) : 0
  const fill = Math.min(pct, 1) * 100
  const color = progressColor(target > 0 ? value / target : 0, variant)

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-[#475569]">
        <span>{formatCzk(value)}</span>
        <span>cíl {formatCzk(target)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${fill}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-1 text-right text-xs text-[#94a3b8]">
        {target > 0 ? `${Math.round((value / target) * 100)} %` : '—'}
      </p>
    </div>
  )
}

function TaskRow({ task, onChanged }) {
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const update = async (patch) => {
    setBusy(true)
    try {
      await updateMonthlyTask(task.id, patch)
      onChanged?.()
    } catch (err) {
      console.error(err)
      alert(err.message || 'Úkol se nepodařilo upravit')
    } finally {
      setBusy(false)
    }
  }

  const done = Boolean(task.completed)
  const cancelled = Boolean(task.cancelled)

  return (
    <div className={`rounded-lg border border-[#e2e8f0] p-3 ${cancelled ? 'opacity-50' : ''}`}>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={done}
          disabled={busy || cancelled}
          onChange={() => {
            if (done) {
              update({ completed: false, completed_date: null })
            } else {
              update({ completed: true, completed_date: todayISO() })
            }
          }}
          className="mt-0.5 accent-[#2563eb]"
        />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium text-[#0f172a] ${done ? 'line-through' : ''}`}>
            {task.title}
          </p>
          {!done && !cancelled && task.recommendation_text && (
            <p className="mt-1 text-xs italic text-[#2563eb]">{task.recommendation_text}</p>
          )}
          {cancelled && task.cancel_reason && (
            <p className="mt-1 text-xs text-[#94a3b8]">Zrušeno: {task.cancel_reason}</p>
          )}
        </div>
      </label>

      {!done && !cancelled && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => update({ completed: true, completed_date: todayISO() })}
            className="rounded-lg border border-[#e2e8f0] px-2 py-1 text-xs text-[#0f172a]"
          >
            ✅ Splnit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const ym = task.year_month || currentYearMonth()
              update({ carried_from: ym, year_month: nextYearMonth(ym) })
            }}
            className="rounded-lg border border-[#e2e8f0] px-2 py-1 text-xs text-[#0f172a]"
          >
            ➡️ Přesunout
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setCancelOpen((v) => !v)}
            className="rounded-lg border border-[#e2e8f0] px-2 py-1 text-xs text-[#0f172a]"
          >
            🗑 Zrušit
          </button>
        </div>
      )}

      {cancelOpen && (
        <div className="mt-2 flex gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Důvod zrušení…"
            className="flex-1 rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs outline-none focus:border-[#2563eb]"
          />
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={async () => {
              await update({ cancelled: true, cancel_reason: reason.trim() })
              setCancelOpen(false)
            }}
            className="rounded-lg bg-[#dc2626] px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}

export default function MonthlyAllocation({
  xtbTarget,
  xtbAllocated,
  dipTarget,
  dipInvested,
  xtbTasks,
  dipHistory,
  onTasksChanged,
}) {
  const [dipOpen, setDipOpen] = useState(false)

  return (
    <section className="border-t border-[#e2e8f0] py-5">
      <h2 className="mb-3 text-sm font-semibold text-[#0f172a]">Měsíční alokace</h2>

      <div className="space-y-3">
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#0f172a]">XTB (měsíčně)</h3>
          <div className="mt-3">
            <ProgressBar value={xtbAllocated} target={xtbTarget} variant="xtb" />
          </div>
          <div className="mt-3 space-y-2">
            {xtbTasks.length === 0 ? (
              <p className="text-xs text-[#94a3b8]">Žádné úkoly pro tento měsíc</p>
            ) : (
              xtbTasks.map((t) => (
                <TaskRow key={t.id} task={t} onChanged={onTasksChanged} />
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-[#e2e8f0] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#0f172a]">DIP (roční)</h3>
          <div className="mt-3">
            <ProgressBar value={dipInvested} target={dipTarget} variant="dip" />
          </div>

          <button
            type="button"
            onClick={() => setDipOpen((v) => !v)}
            className="mt-3 flex w-full items-center gap-2 text-left text-xs font-medium text-[#475569]"
          >
            <span>{dipOpen ? '▼' : '▶'}</span>
            Historie nákupů ({dipHistory.length})
          </button>

          {dipOpen && (
            <ul className="mt-2 space-y-1.5">
              {dipHistory.length === 0 ? (
                <li className="text-xs text-[#94a3b8]">Zatím žádné nákupy DIP v roce 2026</li>
              ) : (
                dipHistory.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between text-xs text-[#475569]"
                  >
                    <span>
                      {formatDate(row.date)} · {row.ticker}
                    </span>
                    <span className="font-medium text-[#0f172a]">{formatCzk(row.valueCzk)}</span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
