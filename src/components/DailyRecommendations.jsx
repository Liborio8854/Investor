const MOCK_RECS = [
  {
    id: 1,
    type: 'buy',
    ticker: 'VWCE',
    price: '128,50 EUR',
    text: 'DCA dle měsíčního plánu XTB — držet se cílové alokace.',
  },
  {
    id: 2,
    type: 'watch',
    ticker: 'BRYN.DE',
    price: '48,20 EUR',
    text: 'Sledovat support kolem 46 EUR před dalším nákupem DIP.',
  },
  {
    id: 3,
    type: 'earnings',
    ticker: 'AAPL',
    price: '225,00 USD',
    text: 'Earnings příští týden — nepřidávat pozici před výsledovkou.',
  },
]

const STYLES = {
  buy: { bg: 'bg-emerald-50', border: 'border-emerald-100', badge: 'bg-emerald-600', label: 'BUY' },
  watch: { bg: 'bg-amber-50', border: 'border-amber-100', badge: 'bg-amber-500', label: 'WATCH' },
  earnings: { bg: 'bg-blue-50', border: 'border-blue-100', badge: 'bg-blue-600', label: 'EARNINGS' },
}

export default function DailyRecommendations() {
  return (
    <section className="border-t border-[#e2e8f0] py-5">
      <h2 className="text-sm font-semibold text-[#0f172a]">Denní doporučení</h2>
      <div className="mt-3 space-y-2.5">
        {MOCK_RECS.map((rec) => {
          const style = STYLES[rec.type]
          return (
            <div
              key={rec.id}
              className={`rounded-lg border ${style.border} ${style.bg} p-3`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${style.badge}`}>
                    {style.label}
                  </span>
                  <span className="text-sm font-semibold text-[#0f172a]">{rec.ticker}</span>
                </div>
                <span className="text-xs text-[#475569]">{rec.price}</span>
              </div>
              <p className="mt-1.5 text-sm leading-snug text-[#475569]">{rec.text}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
