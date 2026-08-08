/** Definice UI sekcí stránky Pravidla + defaulty. */

export const RULE_SECTIONS = [
  {
    id: 'monthly',
    title: 'Měsíční toky',
    rows: [
      { key: 'monthly_total', label: 'Měsíční vklad celkem', format: 'czk', defaultValue: '25000' },
      { key: 'monthly_xtb', label: 'XTB oportunistická', format: 'czk', defaultValue: '21000' },
      { key: 'monthly_dip', label: 'DIP měsíčně', format: 'czk', defaultValue: '4000' },
      {
        key: 'dip_year_target_2026',
        label: 'DIP roční cíl 2026',
        format: 'czk',
        defaultValue: '96000',
      },
      {
        key: 'dip_year_target_2027',
        label: 'DIP roční cíl 2027',
        format: 'czk',
        defaultValue: '48000',
      },
      { key: 'dip_frequency', label: 'DIP frekvence', format: 'text', defaultValue: 'Měsíčně' },
      { key: 'allocation_deadline', label: 'Deadline alokace', format: 'day', defaultValue: '25' },
    ],
  },
  {
    id: 'limits',
    title: 'Limity pozic',
    rows: [
      { key: 'limit_single_stock', label: 'Max jedna akcie', format: 'pct', defaultValue: '0.10' },
      {
        key: 'limit_single_stock_opportunity',
        label: 'Opportunity window (BF-A)',
        format: 'pct',
        defaultValue: '0.15',
      },
      { key: 'limit_brk_total', label: 'BRK celkem', format: 'pct', defaultValue: '0.20' },
      { key: 'limit_brk_hard', label: 'BRK tvrdý strop', format: 'pct', defaultValue: '0.25' },
      { key: 'limit_sector', label: 'Jeden sektor', format: 'pct', defaultValue: '0.30' },
    ],
  },
  {
    id: 'defensive',
    title: 'Defenzivní režim',
    rows: [
      { key: 'flexi_bond', label: 'Flexi Bond', format: 'czk', defaultValue: '300000' },
      { key: 'flexi_rate', label: 'Flexi Bond sazba', format: 'pct_dec', defaultValue: '0.0375' },
      { key: 'savings_rate', label: 'Spořicí účet sazba', format: 'pct_dec', defaultValue: '0.035' },
    ],
    groups: [
      {
        title: 'SPYI pauza',
        rows: [
          { key: 'spyi_pause_pe', label: 'SPYI obnovit při P/E pod', format: 'number', defaultValue: '21' },
          {
            key: 'spyi_resume_correction',
            label: '+ korekce min',
            format: 'pct',
            defaultValue: '0.20',
          },
        ],
      },
      {
        title: 'Nasazovací žebřík',
        rows: [
          { key: 'ladder_10pct', label: '-10 % S&P 500 od ATH', format: 'czk', defaultValue: '75000' },
          { key: 'ladder_20pct', label: '-20 % S&P 500 od ATH', format: 'czk', defaultValue: '100000' },
          { key: 'ladder_30pct', label: '-30 % S&P 500 od ATH', format: 'czk', defaultValue: '125000' },
        ],
      },
    ],
  },
  {
    id: 'exit',
    title: 'Exit triggery',
    rows: [
      { key: 'exit_roic_min', label: 'ROIC min (nefinanční)', format: 'pct', defaultValue: '0.12' },
      { key: 'exit_roe_min', label: 'ROE min (banky/pojišťovny)', format: 'pct', defaultValue: '0.12' },
      {
        key: 'exit_signals_required',
        label: 'Signálů potřeba',
        format: 'signals',
        defaultValue: '2 ze 3',
      },
    ],
    groups: [
      {
        title: 'Tři signály',
        indented: true,
        rows: [
          {
            key: 'exit_roic_years',
            label: '1) ROIC/ROE pod minimem',
            format: 'years',
            defaultValue: '2',
          },
          {
            key: 'exit_margin_years',
            label: '2) Klesající marže více než',
            format: 'years',
            defaultValue: '3',
          },
          {
            key: 'exit_revenue_years',
            label: '3) Klesající tržby více než',
            format: 'years',
            defaultValue: '3',
          },
        ],
      },
    ],
    footerRows: [
      { key: 'csg_stop_loss', label: 'CSG.AS stop-loss', format: 'eur', defaultValue: '12' },
    ],
  },
]

/** Mock tržní indikátory (později inv_prices). */
export const MARKET_MOCK = {
  spyiPe: 22.4,
  spAthDistance: -0.032,
}

export const GLOSSARY = [
  {
    term: 'BF rating',
    body: 'Buffett Framework, hodnocení kvality firmy.\nA = wide moat, ROE >15 %, konzistentní EPS, nízký dluh.\nB = narrow moat nebo nižší prediktabilita.\nC = nekupovat.',
  },
  {
    term: 'MoS',
    body: 'Margin of Safety, bezpečnostní polštář.\n0,85 = kupuji 15 % pod férovou cenou.\nČím rizikovější firma, tím nižší číslo (větší polštář).',
  },
  {
    term: 'Metoda',
    body: 'Způsob výpočtu cílové ceny:\nA = P/E × EPS (standardní firmy)\nB = P/FCF × FCF/akcii (asset-light, software)\nC1 = P/TBV × TBV/akcii (banky)\nC2 = P/B × BPS (pojišťovny/zajišťovny)',
  },
  {
    term: 'T1 / T2',
    body: 'Tranše 1 = první nákup (třetina pozice) do 10 %\nnad cílem. T2 = zbytek na cíli nebo pod.',
  },
  {
    term: 'Wide / Narrow moat',
    body: 'Šířka konkurenční výhody.\nWide = téměř neprůstřelná (monopol, regulace).\nNarrow = existuje, ale ohrožená (např. AI disrupce).',
  },
  {
    term: 'FIFO',
    body: 'First In, First Out. Při prodeji se prodávají\nnejstarší kusy první. Důležité pro daňový test (3 roky).',
  },
  {
    term: 'Nasazovací žebřík',
    body: 'Předem definovaný plán kolik munice\nnasadit při poklesu trhu od maxima (-10/-20/-30 %).',
  },
  {
    term: 'DCA',
    body: 'Dollar Cost Averaging. Pravidelné investování\nfixní částky bez ohledu na cenu.',
  },
]

export function getRuleValue(rulesByKey, key, defaultValue = '') {
  const row = rulesByKey[key]
  if (row?.value != null && String(row.value).trim() !== '') return String(row.value)
  return String(defaultValue ?? '')
}

export function parseRuleNumeric(value) {
  if (value == null || value === '') return null
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

export function formatYearsCs(n) {
  const y = Math.round(Number(n) || 0)
  if (y === 1) return '1 rok'
  if (y >= 2 && y <= 4) return `${y} roky`
  return `${y} let`
}

/** Flatten all editable rule defs from RULE_SECTIONS. */
export function collectRuleDefs(sections = RULE_SECTIONS) {
  const defs = []
  for (const section of sections) {
    for (const row of section.rows || []) defs.push(row)
    for (const row of section.footerRows || []) defs.push(row)
    for (const group of section.groups || []) {
      for (const row of group.rows || []) defs.push(row)
    }
  }
  return defs
}

export function isPercentFormat(format) {
  return format === 'pct' || format === 'pct_dec'
}

/** DB ratio (0.10) → edit field ("10" / "3.75") */
export function ruleToEditValue(stored, format) {
  if (format === 'signals') {
    const s = String(stored || '').trim()
    if (!s) return '2'
    const m = s.match(/^(\d+)/)
    return m ? m[1] : s
  }

  if (format === 'years') {
    const n = parseRuleNumeric(stored)
    return n == null ? '' : String(Math.round(n))
  }

  if (!isPercentFormat(format)) return String(stored ?? '')

  const n = parseRuleNumeric(stored)
  if (n == null) return ''
  const pct = Math.abs(n) <= 1 ? n * 100 : n
  if (format === 'pct_dec') return Number(pct.toFixed(2)).toString()
  return Number(pct.toFixed(4)).toString()
}

/** Edit field → DB storage (10 → "0.1") */
export function editValueToStorage(draft, format) {
  if (format === 'signals') {
    const n = parseRuleNumeric(draft)
    if (n == null) return String(draft || '').trim() || '2 ze 3'
    return `${Math.round(n)} ze 3`
  }

  if (format === 'years') {
    const n = parseRuleNumeric(draft)
    if (n == null) return String(draft || '').trim()
    return String(Math.round(n))
  }

  if (!isPercentFormat(format)) return String(draft ?? '').trim()

  const n = parseRuleNumeric(draft)
  if (n == null) return String(draft ?? '').trim()
  // User always enters percent points (10, 3.75)
  return String(Number((n / 100).toFixed(6)))
}

export function formatRuleDisplay(value, format) {
  if (value == null || value === '') return '—'

  if (format === 'signals') {
    const s = String(value).trim()
    if (/ze\s*3/i.test(s)) return s
    const n = parseRuleNumeric(s)
    if (n != null) return `${Math.round(n)} ze 3`
    return s
  }

  if (format === 'years') {
    const n = parseRuleNumeric(value)
    if (n == null) return String(value)
    return formatYearsCs(n)
  }

  if (format === 'text' || format === 'day') {
    if (format === 'day') {
      const d = String(value).replace(/\D/g, '')
      return d ? `${d}.` : String(value)
    }
    return String(value)
  }

  const n = parseRuleNumeric(value)
  if (n == null) return String(value)

  if (format === 'czk') {
    return `${Math.round(n).toLocaleString('cs-CZ')} Kč`
  }

  if (format === 'pct' || format === 'pct_dec') {
    // DB stores ratio 0.10 → display 10 %
    const pct = Math.abs(n) <= 1 ? n * 100 : n
    if (format === 'pct_dec') {
      return `${pct.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`
    }
    return `${pct.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %`
  }

  if (format === 'eur') {
    return `${n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} EUR`
  }
  if (format === 'number') {
    return n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })
  }
  return String(value)
}

/**
 * SPYI status from PE vs rules.
 * resumeCorrection stored as ratio 0.20 (= 20 % drop from ATH required).
 */
export function computeSpyiStatus(spyiPe, pausePe, resumeCorrection, athDistance) {
  const pe = Number(spyiPe)
  const pause = Number(pausePe)
  const resume = Number(resumeCorrection)
  const ath = Number(athDistance)

  if (!Number.isFinite(pe) || !Number.isFinite(pause)) {
    return { status: 'pause', label: '⏸️ PAUZA' }
  }

  if (pe > pause) {
    return { status: 'pause', label: '⏸️ PAUZA' }
  }

  const athPct = Math.abs(ath) <= 1 ? ath * 100 : ath
  // 0.20 → need -20 %; also accept legacy -20 or 20
  let resumePct
  if (!Number.isFinite(resume)) {
    resumePct = -20
  } else if (Math.abs(resume) <= 1) {
    resumePct = -Math.abs(resume) * 100
  } else {
    resumePct = -Math.abs(resume)
  }

  if (athPct <= resumePct) {
    return { status: 'active', label: '▶️ AKTIVNÍ' }
  }

  return { status: 'pause', label: '⏸️ PAUZA' }
}

export function computeLadderHint(athDistance) {
  const athPct = Math.abs(athDistance) <= 1 ? athDistance * 100 : athDistance
  if (athPct <= -30) return 'akce -30 %'
  if (athPct <= -20) return 'akce -20 %'
  if (athPct <= -10) return 'akce -10 %'
  return 'žádná akce (práh -10 %)'
}
