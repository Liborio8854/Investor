import { useEffect, useId, useMemo, useState } from 'react'
import { todayISO } from '../lib/format'
import { DEFAULT_FX } from '../lib/mockPrices'
import {
  filterTransactionsByAccount,
  filterTransactionsByPortfolio,
  openPositionTickers,
  resolveExchangeRate,
} from '../lib/portfolio'

const inputClass =
  'mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#2563eb]'
const labelClass = 'block text-xs font-medium text-[#475569]'

const TYPE_OPTIONS = [
  { value: 'BUY', label: 'Nákup' },
  { value: 'SELL', label: 'Prodej' },
  { value: 'DIVIDEND', label: 'Dividenda' },
]

const ACCOUNT_OPTIONS = [
  { value: 'xtb', label: 'XTB' },
  { value: 'fio', label: 'FIO' },
  { value: 'dip', label: 'DIP' },
]

const PORTFOLIO_OPTIONS = [
  { value: 'libor', label: 'Libor' },
  { value: 'eda', label: 'Eda' },
]

const CURRENCY_OPTIONS = ['CZK', 'EUR', 'USD']

/** XTB přípony, které Yahoo nepoužívá — oříznout. */
const STRIP_SUFFIXES = ['.US', '.UK', '.NL', '.FR']

function rateToForm(rate) {
  if (rate == null || !Number.isFinite(Number(rate))) return ''
  const n = Number(rate)
  return String(Number(n.toFixed(4)))
}

function emptyForm(fxMap = DEFAULT_FX) {
  const currency = 'EUR'
  return {
    portfolio: 'libor',
    type: 'BUY',
    account: 'xtb',
    ticker: '',
    date: todayISO(),
    quantity: '',
    price: '',
    currency,
    exchange_rate: rateToForm(resolveExchangeRate(currency, fxMap)),
    fees: '0',
    notes: '',
  }
}

function fromTx(tx, fxMap = DEFAULT_FX) {
  const p = String(tx.portfolio || 'libor').trim().toLowerCase()
  const currency = String(tx.currency || 'CZK').toUpperCase()
  const er = Number(tx.exchange_rate)
  const rate =
    Number.isFinite(er) && er > 0 ? er : resolveExchangeRate(currency, fxMap)
  return {
    portfolio: p === 'eda' ? 'eda' : 'libor',
    type: String(tx.type || 'BUY').toUpperCase(),
    account: String(tx.account || 'xtb').toLowerCase(),
    ticker: tx.ticker || '',
    date: String(tx.date || todayISO()).slice(0, 10),
    quantity: tx.quantity != null ? String(tx.quantity) : '',
    price: tx.price != null ? String(tx.price) : '',
    currency,
    exchange_rate: rateToForm(rate),
    fees: tx.fees != null ? String(tx.fees) : '0',
    notes: tx.notes || '',
  }
}

/** Uppercase + oříznutí XTB přípon (.US/.UK/.NL/.FR). .DE/.AS/.PR/.PA/.MI ponechá. */
export function normalizeTickerInput(raw) {
  const ticker = String(raw || '').trim().toUpperCase()
  if (!ticker) return { ticker: '', stripped: null }
  for (const suffix of STRIP_SUFFIXES) {
    if (ticker.endsWith(suffix) && ticker.length > suffix.length) {
      return { ticker: ticker.slice(0, -suffix.length), stripped: suffix }
    }
  }
  return { ticker, stripped: null }
}

function toPayload(form, fxMap = DEFAULT_FX) {
  const { ticker } = normalizeTickerInput(form.ticker)
  const currency = String(form.currency || 'CZK').toUpperCase()
  let er = Number(form.exchange_rate)
  if (!Number.isFinite(er) || er <= 0) {
    er = resolveExchangeRate(currency, fxMap)
  }
  return {
    portfolio: form.portfolio,
    type: form.type,
    account: form.account,
    ticker,
    date: form.date,
    quantity: Number(form.quantity),
    price: Number(form.price),
    currency,
    exchange_rate: er,
    fees: form.fees === '' ? 0 : Number(form.fees),
    notes: form.notes.trim() || null,
  }
}

function ModalShell({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Zavřít" onClick={onClose} />
      <div className="relative z-10 flex max-h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <h2 className="text-base font-semibold text-[#0f172a]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-lg leading-none text-[#94a3b8] hover:bg-slate-50 hover:text-[#0f172a]"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
        {footer && (
          <div
            className="sticky bottom-0 shrink-0 border-t border-[#e2e8f0] bg-white px-4 pt-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TransactionModal({
  tx,
  watchlist = [],
  transactions = [],
  fxMap = DEFAULT_FX,
  onClose,
  onSave,
  onDelete,
}) {
  const isEdit = Boolean(tx)
  const sellDatalistId = useId()
  const [form, setForm] = useState(() => (tx ? fromTx(tx, fxMap) : emptyForm(fxMap)))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [strippedSuffix, setStrippedSuffix] = useState(null)

  const isSell = String(form.type || '').toUpperCase() === 'SELL'
  const isBuy = String(form.type || '').toUpperCase() === 'BUY'

  const watchlistTickers = useMemo(() => {
    const set = new Set()
    for (const row of watchlist || []) {
      const t = String(row.ticker || '').trim().toUpperCase()
      if (t) set.add(t)
    }
    return set
  }, [watchlist])

  /** Otevřené pozice pro zvolené portfolio + účet (SELL autocomplete / validace). */
  const positionTickers = useMemo(() => {
    const scoped = filterTransactionsByAccount(
      filterTransactionsByPortfolio(transactions, form.portfolio),
      form.account,
    )
    return openPositionTickers(scoped, { excludeId: isEdit && isSell ? tx?.id : null })
  }, [transactions, form.portfolio, form.account, isEdit, isSell, tx?.id])

  const positionTickerSet = useMemo(() => new Set(positionTickers), [positionTickers])

  const tickerKey = String(form.ticker || '').trim().toUpperCase()
  const unknownTicker = Boolean(
    tickerKey &&
      (isSell
        ? !positionTickerSet.has(tickerKey)
        : isBuy && watchlistTickers.size > 0 && !watchlistTickers.has(tickerKey)),
  )

  useEffect(() => {
    setForm(tx ? fromTx(tx, fxMap) : emptyForm(fxMap))
    setErr(null)
    setStrippedSuffix(null)
  }, [tx, fxMap])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleCurrencyChange = (e) => {
    const currency = e.target.value
    setForm((f) => ({
      ...f,
      currency,
      exchange_rate: rateToForm(resolveExchangeRate(currency, fxMap)),
    }))
  }

  const handleTickerChange = (e) => {
    const { ticker, stripped } = normalizeTickerInput(e.target.value)
    setForm((f) => ({ ...f, ticker }))
    setStrippedSuffix(stripped)
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    if (!form.ticker.trim()) {
      setErr('Ticker je povinný')
      return
    }
    if (isSell && !positionTickerSet.has(tickerKey)) {
      setErr('Ticker nemá otevřenou pozici v tomto portfoliu a účtu')
      return
    }
    if (!form.date) {
      setErr('Datum je povinné')
      return
    }
    if (!Number.isFinite(Number(form.quantity)) || Number(form.quantity) <= 0) {
      setErr('Počet ks musí být kladné číslo')
      return
    }
    if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
      setErr('Cena musí být číslo ≥ 0')
      return
    }

    setBusy(true)
    try {
      await onSave(toPayload(form, fxMap))
    } catch (ex) {
      setErr(ex.message || 'Uložení selhalo')
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete || !tx) return
    const ok = window.confirm(
      `Opravdu smazat transakci ${form.type} ${form.ticker} ${form.date}?`,
    )
    if (!ok) return
    setBusy(true)
    setErr(null)
    try {
      await onDelete()
    } catch (ex) {
      setErr(ex.message || 'Smazání selhalo')
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title={isEdit ? 'Upravit transakci' : 'Nová transakce'}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <div className="flex flex-col-reverse gap-2 min-[480px]:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-3 text-sm text-[#475569] disabled:opacity-50 min-[480px]:flex-1 min-[480px]:py-2"
            >
              Zrušit
            </button>
            <button
              type="submit"
              form="tx-form"
              disabled={busy}
              className="w-full rounded-lg bg-[#2563eb] px-3 py-3 text-sm font-medium text-white disabled:opacity-60 min-[480px]:flex-1 min-[480px]:py-2"
            >
              {busy ? 'Ukládám…' : 'Uložit'}
            </button>
          </div>
          {isEdit && onDelete && (
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              className="w-full rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-[#dc2626] disabled:opacity-50"
            >
              Smazat transakci
            </button>
          )}
        </div>
      }
    >
      <form id="tx-form" onSubmit={submit} className="space-y-3">
        {err && <p className="text-sm text-[#dc2626]">{err}</p>}

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Typ
            <select className={inputClass} value={form.type} onChange={set('type')}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Účet
            <select className={inputClass} value={form.account} onChange={set('account')}>
              {ACCOUNT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Portfolio
            <select className={inputClass} value={form.portfolio} onChange={set('portfolio')}>
              {PORTFOLIO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label className={labelClass}>
            Ticker
            <input
              className={inputClass}
              value={form.ticker}
              onChange={handleTickerChange}
              required
              autoComplete="off"
              spellCheck={false}
              list={isSell ? sellDatalistId : undefined}
              placeholder={isSell ? 'Vyber z otevřených pozic…' : undefined}
            />
          </label>
          {isSell && (
            <datalist id={sellDatalistId}>
              {positionTickers.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          )}
          {strippedSuffix && (
            <p className="mt-1 text-xs text-[#2563eb]">
              Přípona {strippedSuffix} odstraněna — používáme Yahoo formát.
            </p>
          )}
          {unknownTicker && isBuy && (
            <p className="mt-1 text-xs text-amber-700">
              Ticker není ve watchlistu. Zkontroluj formát (např. RYAAY, ne RYAAY.US).
            </p>
          )}
          {unknownTicker && isSell && (
            <p className="mt-1 text-xs text-amber-700">
              {positionTickers.length === 0
                ? 'Žádná otevřená pozice pro zvolené portfolio a účet.'
                : 'Ticker nemá otevřenou pozici. Vyber z nabídky nebo zkontroluj portfolio/účet.'}
            </p>
          )}
        </div>

        <label className={labelClass}>
          Datum
          <input className={inputClass} type="date" value={form.date} onChange={set('date')} required />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Počet ks
            <input
              className={inputClass}
              type="number"
              step="any"
              min="0"
              value={form.quantity}
              onChange={set('quantity')}
              required
            />
          </label>
          <label className={labelClass}>
            Cena
            <input
              className={inputClass}
              type="number"
              step="any"
              min="0"
              value={form.price}
              onChange={set('price')}
              required
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Měna
            <select className={inputClass} value={form.currency} onChange={handleCurrencyChange}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Kurz
            <input
              className={inputClass}
              type="number"
              step="any"
              min="0"
              value={form.exchange_rate}
              onChange={set('exchange_rate')}
              title="Kč za 1 jednotku měny transakce"
            />
          </label>
        </div>

        <label className={labelClass}>
          {form.type === 'DIVIDEND' ? 'Daň' : 'Poplatek'}
          <input
            className={inputClass}
            type="number"
            step="any"
            min="0"
            value={form.fees}
            onChange={set('fees')}
          />
        </label>

        <label className={labelClass}>
          Poznámka
          <input className={inputClass} value={form.notes} onChange={set('notes')} />
        </label>
      </form>
    </ModalShell>
  )
}

export function TaskCompleteDialog({ task, onConfirm, onCancel, busy }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Zavřít" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
        <p className="text-sm text-[#0f172a]">
          Splnit úkol &lsquo;{task.title}&rsquo;?
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#475569] disabled:opacity-50"
          >
            Ne
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? '…' : 'Ano'}
          </button>
        </div>
      </div>
    </div>
  )
}
