export default function CurrencyExposureBar({ exposure, label = 'Měnová expozice' }) {
  return (
    <div>
      <p className="mb-2 text-xs text-[#94a3b8]">{label}</p>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        {exposure.map((e) =>
          e.pct > 0 ? (
            <div
              key={e.currency}
              style={{ width: `${e.pct * 100}%`, backgroundColor: e.color }}
              title={`${e.currency}: ${Math.round(e.pct * 100)}%`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {exposure.map((e) => (
          <div key={e.currency} className="flex items-center gap-1.5 text-xs text-[#475569]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
            {e.currency} {Math.round(e.pct * 100)} %
          </div>
        ))}
      </div>
    </div>
  )
}
