import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { fetchBuyTransactions, fetchRules } from '../lib/api'
import { formatCzk } from '../lib/format'
import { DEFAULT_FX } from '../lib/mockPrices'
import { buildFxMapFromRules, normalizePortfolio } from '../lib/portfolio'
import { buildBuyOverview, buildHistoryPeriodTabs } from '../lib/transactionOverview'

const XTB_COLOR = '#2563eb'
const DIP_COLOR = '#7c3aed'

function PeriodTabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-[#2563eb] text-white'
                : 'bg-slate-100 text-[#475569] hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}
  const xtb = row.xtb ?? 0
  const dip = row.dip ?? 0
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-[#0f172a]">{label}</p>
      <p style={{ color: XTB_COLOR }}>XTB: {formatCzk(xtb)}</p>
      <p style={{ color: DIP_COLOR }}>DIP: {formatCzk(dip)}</p>
      <p className="mt-1 text-[#475569]">Celkem: {formatCzk(xtb + dip)}</p>
      <p className="mt-1 text-[11px] text-[#94a3b8]">
        Nákupy: {formatCzk((row.xtbBuys || 0) + (row.dipBuys || 0))} | Prodeje:{' '}
        {formatCzk((row.xtbSells || 0) + (row.dipSells || 0))}
      </p>
    </div>
  )
}

function yAxisTick(v) {
  if (Math.abs(v) >= 1_000_000) {
    return `${(v / 1_000_000).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })}M`
  }
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`
  return String(Math.round(v))
}

function OverviewChart({ data }) {
  const scrollable = data.length > 6
  const chartWidth = Math.max(data.length * 56, 320)
  const common = {
    data,
    margin: { top: 8, right: 8, left: 0, bottom: 0 },
    barCategoryGap: '18%',
    barGap: 2,
  }

  const children = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 10, fill: '#94a3b8' }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        tick={{ fontSize: 10, fill: '#94a3b8' }}
        tickFormatter={yAxisTick}
        width={40}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />
      <Legend
        wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
        formatter={(value) => <span className="text-[#475569]">{value}</span>}
      />
      <Bar dataKey="xtb" name="XTB" fill={XTB_COLOR} radius={[3, 3, 0, 0]} maxBarSize={22} />
      <Bar dataKey="dip" name="DIP" fill={DIP_COLOR} radius={[3, 3, 0, 0]} maxBarSize={22} />
    </>
  )

  if (scrollable) {
    return (
      <div className="-mx-1 overflow-x-auto pb-1">
        <BarChart width={chartWidth} height={220} {...common}>
          {children}
        </BarChart>
      </div>
    )
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart {...common}>{children}</BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function OverviewTable({ rows }) {
  if (!rows.length) {
    return <p className="text-sm text-[#94a3b8]">Žádné nákupy v zvoleném období.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-[#e2e8f0] text-[#94a3b8]">
            <th className="py-2 pr-2 font-medium">Měsíc</th>
            <th className="py-2 px-1 text-right font-medium">XTB (Kč)</th>
            <th className="py-2 px-1 text-right font-medium">DIP (Kč)</th>
            <th className="py-2 pl-1 text-right font-medium">Celkem (Kč)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const bold = row.type === 'yearTotal' || row.type === 'grandTotal'
            return (
              <tr
                key={row.key}
                className={`border-b border-slate-50 ${bold ? 'bg-slate-50/80' : ''}`}
              >
                <td className={`py-2 pr-2 text-[#0f172a] ${bold ? 'font-semibold' : ''}`}>
                  {row.label}
                </td>
                <td
                  className={`py-2 px-1 text-right tabular-nums ${
                    bold ? 'font-semibold text-[#0f172a]' : 'text-[#2563eb]'
                  }`}
                >
                  {formatCzk(row.xtb)}
                </td>
                <td
                  className={`py-2 px-1 text-right tabular-nums ${
                    bold ? 'font-semibold text-[#0f172a]' : 'text-[#7c3aed]'
                  }`}
                >
                  {formatCzk(row.dip)}
                </td>
                <td
                  className={`py-2 pl-1 text-right tabular-nums text-[#0f172a] ${
                    bold ? 'font-semibold' : ''
                  }`}
                >
                  {formatCzk(row.total)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function TransactionsOverview({ portfolioFilter = 'libor' }) {
  const { user } = useAuth()
  const [period, setPeriod] = useState('ytd')
  const [rows, setRows] = useState([])
  const [fxMap, setFxMap] = useState(DEFAULT_FX)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user?.id) return
      setLoading(true)
      setError(null)
      try {
        const [data, rules] = await Promise.all([
          fetchBuyTransactions(user.id),
          fetchRules(user.id),
        ])
        if (!cancelled) {
          setRows(data)
          setFxMap(buildFxMapFromRules(rules))
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Nepodařilo se načíst nákupy')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const filtered = useMemo(() => {
    const want = normalizePortfolio(portfolioFilter)
    return rows.filter((tx) => normalizePortfolio(tx.portfolio) === want)
  }, [rows, portfolioFilter])

  const periodTabs = useMemo(() => buildHistoryPeriodTabs(filtered), [filtered])

  useEffect(() => {
    if (!periodTabs.some((t) => t.id === period)) setPeriod('ytd')
  }, [periodTabs, period])

  const overview = useMemo(
    () => buildBuyOverview(filtered, period, new Date(), fxMap),
    [filtered, period, fxMap],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[#94a3b8]">
        Načítám historii…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-[#dc2626]">
        {error}
      </div>
    )
  }

  return (
    <div className="mt-1 space-y-4">
      <PeriodTabs tabs={periodTabs} value={period} onChange={setPeriod} />

      <div>
        <p className="text-xs text-[#94a3b8]">Celkem investováno</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums text-[#0f172a]">
          {formatCzk(overview.total)}
        </p>
        <p className="mt-0.5 text-xs text-[#475569]">
          <span style={{ color: XTB_COLOR }}>XTB {formatCzk(overview.totalXtb)}</span>
          {' · '}
          <span style={{ color: DIP_COLOR }}>DIP {formatCzk(overview.totalDip)}</span>
        </p>
      </div>

      {overview.chart.length === 0 ? (
        <p className="text-sm text-[#94a3b8]">Žádné nákupy v zvoleném období.</p>
      ) : (
        <>
          <OverviewChart data={overview.chart} />
          <OverviewTable rows={overview.tableRows} />
        </>
      )}
    </div>
  )
}
