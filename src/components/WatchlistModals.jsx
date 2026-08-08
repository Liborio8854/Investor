import { useEffect, useState } from 'react'

const inputClass =
  'mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#2563eb]'
const labelClass = 'block text-xs font-medium text-[#475569]'

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

function numOrNull(v) {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function WatchlistAddModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    ticker: '',
    name: '',
    target_price: '',
    currency: 'USD',
    bf_rating: '',
    valuation_method: '',
    mos: '',
    status: 'active',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    if (!form.ticker.trim()) {
      setErr('Ticker je povinný')
      return
    }
    setBusy(true)
    try {
      await onSave({
        ticker: form.ticker.trim().toUpperCase(),
        name: form.name.trim() || null,
        target_price: numOrNull(form.target_price),
        currency: form.currency,
        bf_rating: form.bf_rating.trim() || null,
        valuation_method: form.valuation_method.trim() || null,
        mos: numOrNull(form.mos),
        status: form.status,
      })
      onClose()
    } catch (ex) {
      setErr(ex.message || 'Uložení selhalo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Přidat titul"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#475569]"
          >
            Zrušit
          </button>
          <button
            type="submit"
            form="watchlist-add-form"
            disabled={busy}
            className="flex-1 rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? 'Ukládám…' : 'Přidat'}
          </button>
        </div>
      }
    >
      <form id="watchlist-add-form" onSubmit={submit} className="space-y-3">
        {err && <p className="text-sm text-[#dc2626]">{err}</p>}
        <label className={labelClass}>
          Ticker *
          <input className={inputClass} value={form.ticker} onChange={set('ticker')} required />
        </label>
        <label className={labelClass}>
          Název
          <input className={inputClass} value={form.name} onChange={set('name')} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Cíl
            <input
              className={inputClass}
              type="number"
              step="any"
              value={form.target_price}
              onChange={set('target_price')}
            />
          </label>
          <label className={labelClass}>
            Měna
            <select className={inputClass} value={form.currency} onChange={set('currency')}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="CZK">CZK</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            BF rating
            <input className={inputClass} value={form.bf_rating} onChange={set('bf_rating')} />
          </label>
          <label className={labelClass}>
            MoS
            <input className={inputClass} type="number" step="any" value={form.mos} onChange={set('mos')} />
          </label>
        </div>
        <label className={labelClass}>
          Metoda
          <input className={inputClass} value={form.valuation_method} onChange={set('valuation_method')} />
        </label>
        <label className={labelClass}>
          Status
          <select className={inputClass} value={form.status} onChange={set('status')}>
            <option value="active">Aktivní</option>
            <option value="brk_section">BRK sekce</option>
            <option value="watched">Sledované</option>
            <option value="removed">Vyřazené</option>
          </select>
        </label>
      </form>
    </ModalShell>
  )
}

export function WatchlistEditModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    target_price: '',
    target_t1: '',
    target_t2: '',
    bf_rating: '',
    mos: '',
    notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!item) return
    setForm({
      target_price: item.target_price ?? '',
      target_t1: item.target_t1 ?? '',
      target_t2: item.target_t2 ?? '',
      bf_rating: item.bf_rating ?? '',
      mos: item.mos ?? '',
      notes: item.notes ?? '',
    })
  }, [item])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await onSave(item.id, {
        target_price: numOrNull(form.target_price),
        target_t1: numOrNull(form.target_t1),
        target_t2: numOrNull(form.target_t2),
        bf_rating: form.bf_rating === '' ? null : form.bf_rating,
        mos: numOrNull(form.mos),
        notes: form.notes.trim() || null,
      })
      onClose()
    } catch (ex) {
      setErr(ex.message || 'Uložení selhalo')
    } finally {
      setBusy(false)
    }
  }

  if (!item) return null

  return (
    <ModalShell
      title={`${item.ticker}${item.name ? ` — ${item.name}` : ''}`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#475569]"
          >
            Zrušit
          </button>
          <button
            type="submit"
            form="watchlist-edit-form"
            disabled={busy}
            className="flex-1 rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      }
    >
      <form id="watchlist-edit-form" onSubmit={submit} className="space-y-3">
        {err && <p className="text-sm text-[#dc2626]">{err}</p>}
        <div className="grid grid-cols-3 gap-3">
          <label className={labelClass}>
            Cíl
            <input
              className={inputClass}
              type="number"
              step="any"
              value={form.target_price}
              onChange={set('target_price')}
            />
          </label>
          <label className={labelClass}>
            T1
            <input
              className={inputClass}
              type="number"
              step="any"
              value={form.target_t1}
              onChange={set('target_t1')}
            />
          </label>
          <label className={labelClass}>
            T2
            <input
              className={inputClass}
              type="number"
              step="any"
              value={form.target_t2}
              onChange={set('target_t2')}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            BF rating
            <input className={inputClass} value={form.bf_rating} onChange={set('bf_rating')} />
          </label>
          <label className={labelClass}>
            MoS
            <input className={inputClass} type="number" step="any" value={form.mos} onChange={set('mos')} />
          </label>
        </div>
        <label className={labelClass}>
          Poznámky
          <textarea className={`${inputClass} min-h-[80px]`} value={form.notes} onChange={set('notes')} rows={3} />
        </label>
      </form>
    </ModalShell>
  )
}