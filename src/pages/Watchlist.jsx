import { useState } from 'react'
import { useWatchlistData } from '../hooks/useWatchlistData'
import WatchlistTable from '../components/WatchlistTable'
import WatchlistSection from '../components/WatchlistSection'
import { WatchlistAddModal, WatchlistEditModal } from '../components/WatchlistModals'

function ConfirmDialog({ message, onConfirm, onCancel, busy }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Zavřít" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
        <p className="text-sm text-[#0f172a]">{message}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#475569] disabled:opacity-50"
          >
            Zrušit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-[#dc2626] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? '…' : 'Ano'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Watchlist() {
  const { loading, error, reload, active, brk, watched, removed, addItem, updateItem, softRemove } =
    useWatchlistData()
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removeBusy, setRemoveBusy] = useState(false)

  const handleRemoveRequest = (row) => {
    setRemoveTarget(row)
  }

  const handleRemoveConfirm = async () => {
    if (!removeTarget) return
    setRemoveBusy(true)
    try {
      await softRemove(removeTarget.id)
      setRemoveTarget(null)
    } catch (err) {
      alert(err.message || 'Nepodařilo se vyřadit')
    } finally {
      setRemoveBusy(false)
    }
  }

  const handleActivate = async (row) => {
    if (!window.confirm(`Přesunout ${row.ticker} do aktivních?`)) return
    try {
      await updateItem(row.id, { status: 'active' })
    } catch (err) {
      alert(err.message || 'Nepodařilo se aktivovat')
    }
  }

  const restoreAction = { label: 'Obnovit ↩', onClick: handleActivate }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[#94a3b8]">
        Načítám watchlist…
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
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#0f172a]">Watchlist</h1>
          <p className="text-xs text-[#94a3b8]">Aktivní tituly seřazené podle vzdálenosti od cíle</p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="shrink-0 rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-medium text-white"
        >
          + Přidat titul
        </button>
      </div>

      <section className="pb-2">
        <h2 className="mb-2 text-sm font-semibold text-[#0f172a]">Aktivní ({active.length})</h2>
        <WatchlistTable rows={active} onRowClick={setEditItem} onRemove={handleRemoveRequest} />
      </section>

      <WatchlistSection
        title="BRK sekce"
        rows={brk}
        onRowClick={setEditItem}
        rowAction={restoreAction}
      />
      <WatchlistSection
        title="Sledované"
        rows={watched}
        onRowClick={setEditItem}
        rowAction={restoreAction}
      />
      <WatchlistSection
        title="Vyřazené"
        rows={removed}
        onRowClick={setEditItem}
        rowAction={restoreAction}
      />

      {addOpen && <WatchlistAddModal onClose={() => setAddOpen(false)} onSave={addItem} />}
      {editItem && (
        <WatchlistEditModal item={editItem} onClose={() => setEditItem(null)} onSave={updateItem} />
      )}
      {removeTarget && (
        <ConfirmDialog
          message={`Přesunout ${removeTarget.ticker} do vyřazených?`}
          onCancel={() => !removeBusy && setRemoveTarget(null)}
          onConfirm={handleRemoveConfirm}
          busy={removeBusy}
        />
      )}
    </div>
  )
}