import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { exportCSV, todayISO, fmtDate } from '../lib/constants.jsx'
import { Download, RefreshCw, Loader2, TrendingUp, TrendingDown, AlertTriangle, Sparkles } from 'lucide-react'

const CATEGORIES = [
  'All Categories',
  'Beauty & Personal Care',
  'Clothing',
  'Electronics',
  'Footwear',
  'Gifting',
  'Health & Wellness',
  'Lifestyle',
  'Luggage',
  'Streetwear',
]

// Map old category names to new ones
const CAT_MAP = {
  'Beauty and Personal Care': 'Beauty & Personal Care',
  'Fashion (Fashion Accessories, Clothing, Jewellery)': 'Clothing',
  'Health and Wellness': 'Health & Wellness',
  'Luggage and Bags': 'Luggage',
  'Others': 'Lifestyle',
  'Kids': 'Lifestyle',
  'Home': 'Lifestyle',
}

function normalizeCategory(cat) {
  return CAT_MAP[cat] || cat
}

function getWeekLabel(dateStr) {
  const d = new Date(dateStr)
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
  return `W${week} ${d.getFullYear()}`
}

function getLastNWeeks(n) {
  const weeks = []
  const today = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i * 7)
    weeks.push(getWeekLabel(d.toISOString().split('T')[0]))
  }
  return [...new Set(weeks)]
}

function getMonthKey(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtMonth(key) {
  if (!key) return ''
  const [y, m] = key.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m)-1]} ${y}`
}

export default function Analytics() {
  const [historical, setHistorical] = useState([])
  const [current, setCurrent] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('weekly')
  const [catFilter, setCatFilter] = useState('All Categories')
  const [aiInsight, setAiInsight] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const today = todayISO()

  useEffect(() => {
    Promise.all([
      supabase.from('historical_promos').select('*'),
      supabase.from('promo_requests').select('*'),
    ]).then(([{ data: h }, { data: c }]) => {
      setHistorical(h || [])
      setCurrent(c || [])
      setLoading(false)
    })
  }, [])

  // Combine all promos
  const allPromos = [
    ...historical.map(r => ({
      brand: r.brand_names || '',
      category: normalizeCategory(r.category || ''),
      from: r.valid_from,
      till: r.valid_till,
      details: r.promotion_details || r.promotion_name || '',
      source: 'historical',
    })),
    ...current.flatMap(r => {
      const ranges = Array.isArray(r.date_ranges) ? r.date_ranges : []
      return ranges.map(dr => ({
        brand: r.brand_names || '',
        category: normalizeCategory(r.category || ''),
        from: dr.from,
        till: dr.till,
        details: r.promo_details || r.promotion_name || '',
        source: 'current',
      }))
    }),
  ].filter(r => r.brand && r.from && r.till)

  const filtered = catFilter === 'All Categories'
    ? allPromos
    : allPromos.filter(r => r.category === catFilter)

  // ── Table 1: Last 8 weeks × Category ─────────────────────────────────────
  const last8Weeks = getLastNWeeks(8)

  function isActiveInWeek(promo, weekLabel) {
    // find monday of that week
    const [wPart, year] = weekLabel.split(' ')
    const weekNum = parseInt(wPart.replace('W', ''))
    const jan1 = new Date(parseInt(year), 0, 1)
    const weekStart = new Date(jan1.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)
    const from = new Date(promo.from)
    const till = new Date(promo.till)
    return from <= weekEnd && till >= weekStart
  }

  const uniqueCategories = [...new Set(allPromos.map(r => r.category).filter(Boolean))].sort()

  const weeklyTable = uniqueCategories.map(cat => {
    const catPromos = allPromos.filter(r => r.category === cat)
    const weeks = last8Weeks.map(w => ({
      week: w,
      count: catPromos.filter(p => isActiveInWeek(p, w)).length,
    }))
    return { category: cat, weeks, total: weeks.reduce((a, w) => a + w.count, 0) }
  }).filter(r => r.total > 0).sort((a, b) => b.total - a.total)

  // ── Table 2: Brand × Month offer details ─────────────────────────────────
  const last6Months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    last6Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const brandMonthMap = {}
  filtered.forEach(r => {
    const month = getMonthKey(r.from)
    if (!month) return
    if (!brandMonthMap[r.brand]) brandMonthMap[r.brand] = {}
    if (!brandMonthMap[r.brand][month]) brandMonthMap[r.brand][month] = []
    if (r.details) brandMonthMap[r.brand][month].push(r.details)
  })

  const brandMonthTable = Object.entries(brandMonthMap)
    .filter(([, months]) => Object.keys(months).some(m => last6Months.includes(m)))
    .map(([brand, months]) => ({ brand, months }))
    .sort((a, b) => a.brand.localeCompare(b.brand))

  // ── Table 3: Critical brands — active last month, not this month ──────────
  const thisMonth = getMonthKey(today)
  const lastMonth = getMonthKey(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString())

  const lastMonthBrands = new Set(
    filtered.filter(r => getMonthKey(r.from) === lastMonth || getMonthKey(r.till) === lastMonth)
      .map(r => r.brand)
  )
  const thisMonthBrands = new Set(
    filtered.filter(r => getMonthKey(r.from) === thisMonth || getMonthKey(r.till) === thisMonth)
      .map(r => r.brand)
  )
  const droppedBrands = [...lastMonthBrands].filter(b => !thisMonthBrands.has(b))
    .map(b => {
      const promos = filtered.filter(r => r.brand === b)
      const last = promos.sort((a, b) => new Date(b.till) - new Date(a.till))[0]
      return { brand: b, category: last?.category || '', lastTill: last?.till || '', lastDetails: last?.details || '' }
    })
    .sort((a, b) => a.category.localeCompare(b.category))

  // ── Table 4: Brand leaderboard ────────────────────────────────────────────
  const brandStats = {}
  filtered.forEach(r => {
    if (!brandStats[r.brand]) brandStats[r.brand] = { brand: r.brand, category: r.category, count: 0, lastDate: '' }
    brandStats[r.brand].count++
    if (!brandStats[r.brand].lastDate || r.from > brandStats[r.brand].lastDate)
      brandStats[r.brand].lastDate = r.from
  })
  const leaderboard = Object.values(brandStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)

  // ── AI Insights ───────────────────────────────────────────────────────────
  const getAIInsights = async () => {
    setAiLoading(true)
    setAiInsight('')

    const summary = {
      totalPromos: allPromos.length,
      droppedBrands: droppedBrands.slice(0, 10).map(b => `${b.brand} (${b.category}, last: ${fmtDate(b.lastTill)})`),
      topBrands: leaderboard.slice(0, 10).map(b => `${b.brand}: ${b.count} promos`),
      categoryTotals: weeklyTable.map(r => `${r.category}: ${r.total} active weeks`),
    }

    const prompt = `You are a retail promotions analyst for Broadway, a multi-brand retail store in India.

Here is the promo data summary:
- Total promos analyzed: ${summary.totalPromos}
- Top brands by promo volume: ${summary.topBrands.join(', ')}
- Brands that were active last month but have NO promo this month (critical - need follow up): ${summary.droppedBrands.join(', ')}
- Category activity (total active promo-weeks in last 8 weeks): ${summary.categoryTotals.join(', ')}

Please provide:
1. 3 key insights about promo activity patterns
2. Top 5 brands to prioritize for new promos (based on gap since last promo or high historical volume)
3. Any category that seems underserved or overserved
4. One actionable recommendation

Keep it concise and actionable. Use bullet points.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    setAiInsight(data.content?.[0]?.text || 'Could not generate insights.')
    setAiLoading(false)
  }

  const tabs = [
    { id: 'weekly', label: 'Weekly Activity' },
    { id: 'monthly', label: 'Brand × Month' },
    { id: 'dropped', label: 'Critical Brands' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'ai', label: '✨ AI Insights' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 fade-in">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Analytics</h1>
          <p className="text-muted text-sm font-body mt-0.5">
            {allPromos.length.toLocaleString()} promos · Historical + Current data
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-xs font-mono text-muted uppercase tracking-widest">Filter</span>
        <select
          className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
          value={catFilter} onChange={e => setCatFilter(e.target.value)}
        >
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-white border border-border rounded-xl p-1 w-fit mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-body font-medium transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-ink text-white' : 'text-muted hover:text-ink'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48 gap-2 text-muted">
          <Loader2 size={18} className="animate-spin" /><span className="text-sm">Loading analytics…</span>
        </div>
      ) : (
        <>
          {/* Table 1: Weekly Activity */}
          {tab === 'weekly' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-xl text-ink">
                  Category Activity — Last 8 Weeks
                </h2>
                <button onClick={() => exportCSV(
                  weeklyTable.map(r => ({ category: r.category, ...r.weeks.reduce((a,w) => ({...a,[w.week]:w.count}),{}), total: r.total })),
                  'weekly-activity.csv'
                )} className="flex items-center gap-1.5 text-xs font-body text-ink border border-border bg-white px-3 py-1.5 rounded-lg hover:bg-paper">
                  <Download size={12} /> Export
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border bg-white">
                <table className="min-w-full text-sm font-body">
                  <thead className="bg-paper border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted sticky left-0 bg-paper">Category</th>
                      {last8Weeks.map(w => (
                        <th key={w} className="px-3 py-3 text-center text-[10px] font-mono uppercase tracking-widest text-muted whitespace-nowrap">{w}</th>
                      ))}
                      <th className="px-3 py-3 text-center text-[10px] font-mono uppercase tracking-widest text-muted">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyTable.map(row => (
                      <tr key={row.category} className="border-b border-border last:border-0 hover:bg-paper/40">
                        <td className="px-4 py-3 font-medium text-ink sticky left-0 bg-white">{row.category}</td>
                        {row.weeks.map(w => (
                          <td key={w.week} className="px-3 py-3 text-center">
                            {w.count > 0 ? (
                              <span className={`inline-block min-w-[24px] rounded px-1.5 py-0.5 text-xs font-mono font-bold ${
                                w.count >= 10 ? 'bg-emerald-100 text-emerald-700' :
                                w.count >= 5 ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>{w.count}</span>
                            ) : (
                              <span className="text-border">—</span>
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-3 text-center font-mono font-bold text-ink">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table 2: Brand × Month */}
          {tab === 'monthly' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-xl text-ink">
                  Brand Promo Details — Last 6 Months
                  <span className="text-sm font-normal text-muted ml-2">({brandMonthTable.length} brands)</span>
                </h2>
                <button onClick={() => exportCSV(
                  brandMonthTable.map(r => ({
                    brand: r.brand,
                    ...last6Months.reduce((a, m) => ({ ...a, [fmtMonth(m)]: (r.months[m] || []).join(' | ') }), {})
                  })),
                  'brand-monthly.csv'
                )} className="flex items-center gap-1.5 text-xs font-body text-ink border border-border bg-white px-3 py-1.5 rounded-lg hover:bg-paper">
                  <Download size={12} /> Export
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border bg-white">
                <table className="min-w-full text-sm font-body">
                  <thead className="bg-paper border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted sticky left-0 bg-paper">Brand</th>
                      {last6Months.map(m => (
                        <th key={m} className="px-3 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted whitespace-nowrap">{fmtMonth(m)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {brandMonthTable.map(row => (
                      <tr key={row.brand} className="border-b border-border last:border-0 hover:bg-paper/40">
                        <td className="px-4 py-3 font-medium text-ink sticky left-0 bg-white">{row.brand}</td>
                        {last6Months.map(m => (
                          <td key={m} className="px-3 py-3 text-xs text-muted max-w-[180px]">
                            {row.months[m] ? (
                              <div className="space-y-1">
                                {row.months[m].slice(0, 2).map((d, i) => (
                                  <div key={i} className="bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 text-[10px] truncate" title={d}>{d}</div>
                                ))}
                                {row.months[m].length > 2 && (
                                  <div className="text-[10px] text-muted">+{row.months[m].length - 2} more</div>
                                )}
                              </div>
                            ) : <span className="text-border">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table 3: Critical Brands */}
          {tab === 'dropped' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-display font-bold text-xl text-ink flex items-center gap-2">
                    <AlertTriangle size={20} className="text-warning" />
                    Critical Brands — Active Last Month, Not This Month
                  </h2>
                  <p className="text-sm text-muted mt-1">{droppedBrands.length} brands need follow-up</p>
                </div>
                <button onClick={() => exportCSV(droppedBrands, 'critical-brands.csv')}
                  className="flex items-center gap-1.5 text-xs font-body text-ink border border-border bg-white px-3 py-1.5 rounded-lg hover:bg-paper">
                  <Download size={12} /> Export
                </button>
              </div>
              {droppedBrands.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-12 text-center">
                  <p className="text-success font-body">🎉 All active brands from last month are still running promos this month!</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-white">
                  <table className="min-w-full text-sm font-body">
                    <thead className="bg-paper border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Brand</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Category</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Last Promo Ended</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Last Offer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {droppedBrands.map((b, i) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-amber-50/30">
                          <td className="px-4 py-3 font-medium text-ink">{b.brand}</td>
                          <td className="px-4 py-3 text-muted">{b.category}</td>
                          <td className="px-4 py-3 font-mono text-xs text-danger">{fmtDate(b.lastTill)}</td>
                          <td className="px-4 py-3 text-xs text-muted max-w-[200px] truncate">{b.lastDetails || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Table 4: Leaderboard */}
          {tab === 'leaderboard' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-xl text-ink flex items-center gap-2">
                  <TrendingUp size={20} className="text-success" />
                  Brand Leaderboard — Top 50 by Promo Volume
                </h2>
                <button onClick={() => exportCSV(leaderboard, 'brand-leaderboard.csv')}
                  className="flex items-center gap-1.5 text-xs font-body text-ink border border-border bg-white px-3 py-1.5 rounded-lg hover:bg-paper">
                  <Download size={12} /> Export
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border bg-white">
                <table className="min-w-full text-sm font-body">
                  <thead className="bg-paper border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted w-10">#</th>
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Brand</th>
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Category</th>
                      <th className="px-4 py-3 text-center text-[10px] font-mono uppercase tracking-widest text-muted">Total Promos</th>
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Last Promo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((b, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-paper/40">
                        <td className="px-4 py-3 font-mono text-muted text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-ink">{b.brand}</td>
                        <td className="px-4 py-3 text-muted">{b.category}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded font-mono text-xs font-bold ${
                            b.count >= 20 ? 'bg-emerald-100 text-emerald-700' :
                            b.count >= 10 ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{b.count}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">{fmtDate(b.lastDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Insights */}
          {tab === 'ai' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-xl text-ink flex items-center gap-2">
                  <Sparkles size={20} className="text-accent" />
                  AI Insights
                </h2>
                <button onClick={getAIInsights} disabled={aiLoading}
                  className="flex items-center gap-1.5 bg-accent text-white text-sm font-body px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors">
                  {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {aiLoading ? 'Analyzing…' : 'Generate Insights'}
                </button>
              </div>

              {!aiInsight && !aiLoading && (
                <div className="bg-white border border-border rounded-xl py-16 text-center">
                  <Sparkles size={28} className="mx-auto mb-3 text-accent opacity-50" />
                  <p className="font-body text-muted text-sm">Click "Generate Insights" to get AI-powered analysis of your promo data.</p>
                  <p className="font-body text-muted text-xs mt-1">Analyzes {allPromos.length.toLocaleString()} promos across all brands and categories.</p>
                </div>
              )}

              {aiLoading && (
                <div className="bg-white border border-border rounded-xl py-16 text-center">
                  <Loader2 size={28} className="mx-auto mb-3 text-accent animate-spin" />
                  <p className="font-body text-muted text-sm">Analyzing your promo data…</p>
                </div>
              )}

              {aiInsight && !aiLoading && (
                <div className="bg-white border border-border rounded-xl p-6">
                  <div className="prose prose-sm max-w-none font-body text-ink whitespace-pre-wrap leading-relaxed">
                    {aiInsight}
                  </div>
                  <p className="text-[11px] text-muted mt-4 pt-3 border-t border-border">
                    Based on {allPromos.length.toLocaleString()} promos · Generated {new Date().toLocaleString('en-IN')}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
