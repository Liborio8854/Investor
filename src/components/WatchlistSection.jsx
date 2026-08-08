import { useState } from 'react'
import WatchlistTable from './WatchlistTable'

export default function WatchlistSection({
  title,
  rows,
  defaultOpen = false,
  onRowClick,
  onRemove,
  rowAction,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const n = rows?.length || 0

  return (
    <section className="border-t border-[#e2e8f0] py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm font-semibold text-[#0f172a]"
      >
        <span className="text-[#94a3b8]">{open ? '▼' : '▶'}</span>
        {title} ({n})
      </button>
      {open && (
        <div className="mt-3">
          <WatchlistTable
            rows={rows}
            onRowClick={onRowClick}
            onRemove={onRemove}
            rowAction={rowAction}
            emptyText="Žádné tituly v této sekci"
          />
        </div>
      )}
    </section>
  )
}