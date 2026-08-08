import { useEffect, useState } from 'react'
import { todayISO } from '../lib/format'

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

function emptyForm() {
  return {
    portfolio: 'libor',
    type: 'BUY',
    account: 'xtb',
    ticker: '',
    date: todayISO(),
    quantity: '',
    price: '',
    currency: 'EUR',
    fees: '0',
    notes: '',
  }
}

function fromTx(tx) {
  const p = String(tx.portfolio || 'libor').trim().toLowerCase()
  return {
    portfolio: p === 'eda' ? 'eda' : 'libor',
    type: String(tx.type || 'BUY').toUpperCase(),
    account: String(tx.account || 'xtb').toLowerCase(),
    ticker: tx.ticker || '',
    date: String(tx.date || todayISO()).slice(0, 10),
    quantity: tx.quantity != null ? String(tx.quantity) : '',
    price: tx.price != null ? String(tx.price) : '',
    currency: String(tx.currency || 'CZK').toUpperCase(),
    fees: tx.fees != null ? String(tx.fees) : '0',
    notes: tx.notes || '',
  }
}

function toPayload(form) {
  return {
    portfolio: form.portfolio,
    type: form.type,
    account: form.account,
    ticker: form.ticker.trim().toUpperCase(),
    date: form.date,
    quantity: Number(form.quantity),
    price: Number(form.price),
    currency: form.currency,
    fees: form.fees === '' ? 0 : Number(form.fees),
    notes: form.notes.trim() || null,
  }
}

function ModalShell({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Zavřít" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-[480px] flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <h2 className="text-base font-semibold text-[#0f172a]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-lg leading-none text-[#94a3b8] hover:bg-slate-50 hover:text-[#0f172a]"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3">{children}</div>
        {footer && <div className="border-t border-[#e2e8f0] px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export default function TransactionModal({ tx, onClose, onSave, onDelete }) {
  const isEdit = Boolean(tx)
  const [form, setForm] = useState(() => (tx ? fromTx(tx) : emptyForm()))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    setForm(tx ? fromTx(tx) : emptyForm())
    setErr(null)
  }, [tx])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    if (!form.ticker.trim()) {
      setErr('Ticker je povinný')
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
      await onSave(toPayload(form))
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#475569] disabled:opacity-50"
            >
              Zrušit
            </button>
            <button
              type="submit"
              form="tx-form"
              disabled={busy}
              className="flex-1 rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
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

        <label className={labelClass}>
          Ticker
          <input
            className={inputClass}
            value={form.ticker}
            onChange={set('ticker')}
            required
            autoComplete="off"
          />
        </label>

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
            <select className={inputClass} value={form.currency} onChange={set('currency')}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
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
        </div>

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
