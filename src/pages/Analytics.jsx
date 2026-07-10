import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { exportCSV, todayISO, fmtDate } from '../lib/constants.jsx'
import { Download, Loader2, TrendingUp, AlertTriangle, Star, ExternalLink } from 'lucide-react'

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
  const [monthFilter, setMonthFilter] = useState(6)
  const [storeFilter, setStoreFilter] = useState('All')
  const [campaigns, setCampaigns] = useState([])
  const [campFilter, setCampFilter] = useState('All')
  const [onlineFilter, setOnlineFilter] = useState('All')
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0])
  // #2 — top brands list from Supabase
  const [topBrands, setTopBrands] = useState([])
  const [topBrandsFilter, setTopBrandsFilter] = useState(false)
  const today = todayISO()

  useEffect(() => {
    async function fetchAll() {
      let hist = []
      let from = 0
      while (true) {
        const { data } = await supabase
          .from('historical_promos')
          .select('promo_request_id,brand_names,category,valid_from,valid_till,promotion_details,promotion_name,status,store,assortment_type,sku_file_link')
          .range(from, from + 999)
        if (!data || data.length === 0) break
        hist = [...hist, ...data]
        if (data.length < 1000) break
        from += 1000
      }
      const { data: cur } = await supabase
        .from('promo_requests')
        .select('promo_request_id,brand_names,category,date_ranges,promo_details,promotion_name,status,assortment_type,sku_file_link,store,campaign_id,offer_type')
        .limit(5000)
      // #2 — fetch top brands from Supabase
      const { data: tb } = await supabase
        .from('top_brands')
        .select('brand_name')
        .order('brand_name')
      setHistorical(hist)
      setCurrent(cur || [])
      setTopBrands((tb || []).map(r => r.brand_name.toLowerCase().trim()))
      setLoading(false)
    }
    fetchAll()
    // Fetch campaigns for filter
    supabase.from('sale_campaigns').select('*').order('start_date', { ascending: false })
      .then(({ data }) => setCampaigns(data || []))
  }, [])

  const allPromos = [
    ...historical.map(r => ({
      promoId: r.promo_request_id || '',
      brand: r.brand_names || '',
      category: normalizeCategory(r.category || ''),
      from: r.valid_from,
      till: r.valid_till,
      details: r.promotion_details || r.promotion_name || '',
      promoName: r.promotion_name || '',
      offerType: r.offer_type || '',
      store: r.store || '',
      status: r.status || '',
      assortment: r.assortment_type || '',
      skuLink: r.sku_file_link || '',
      source: 'historical',
    })),
    ...current.flatMap(r => {
      const ranges = Array.isArray(r.date_ranges) ? r.date_ranges : []
      return ranges.map(dr => ({
        promoId: r.promo_request_id || '',
        brand: r.brand_names || '',
        category: normalizeCategory(r.category || ''),
        from: dr.from,
        till: dr.till,
        details: r.promo_details || r.promotion_name || '',
        promoName: r.promotion_name || '',
        offerType: r.offer_type || '',
        store: r.store || '',
        status: r.status || '',
        assortment: r.assortment_type || '',
        skuLink: r.sku_file_link || '',
        campaign_id: r.campaign_id || '',
        source: 'current',
      }))
    }),
  ].filter(r => r.brand && r.from && r.till && !['Rejected','Deactivated'].includes(r.status))

  const STORES = ['All', 'VK, Delhi', 'BH, Hyderabad', 'Pune', 'Mumbai']

  const storeFiltered = storeFilter === 'All'
    ? allPromos
    : allPromos.filter(r => r.store && r.store.includes(storeFilter))

  const campFiltered = campFilter === 'All'
    ? storeFiltered
    : storeFiltered.filter(r => r.campaign_id === campFilter)

  const onlineFiltered = onlineFilter === 'All'
    ? campFiltered
    : onlineFilter === 'Online'
      ? campFiltered.filter(r => (r.store || '').includes('Online'))
      : campFiltered.filter(r => !(r.store || '').includes('Online'))

  const catFiltered = catFilter === 'All Categories'
    ? onlineFiltered
    : onlineFiltered.filter(r => r.category === catFilter)

  // #2 — helper: is this brand a top brand?
  const isTopBrand = (brand) =>
    topBrands.includes((brand || '').toLowerCase().trim())

  const filtered = topBrandsFilter
    ? catFiltered.filter(r => isTopBrand(r.brand))
    : catFiltered

  // ── Table 1: Last 8 weeks × Category ─────────────────────────────────────
  const last8Weeks = getLastNWeeks(8)

  function isActiveInWeek(promo, weekLabel) {
    const [wPart, year] = weekLabel.split(' ')
    const weekNum = parseInt(wPart.replace('W', ''))
    const jan1 = new Date(parseInt(year), 0, 1)
    const weekStart = new Date(jan1.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)
    const from = new Date(promo.from)
    const till = new Date(promo.till)
    return from <= weekEnd && till >= weekStart
  }

  const uniqueCategories = [...new Set(filtered.map(r => r.category).filter(Boolean))].sort()

  const weeklyTable = uniqueCategories.map(cat => {
    const catPromos = filtered.filter(r => r.category === cat)
    const weeks = last8Weeks.map(w => ({
      week: w,
      count: catPromos.filter(p => isActiveInWeek(p, w)).length,
    }))
    return { category: cat, weeks, total: weeks.reduce((a, w) => a + w.count, 0) }
  }).filter(r => r.total > 0).sort((a, b) => b.total - a.total)

  // ── #1: Unique brands per week × Category ───────────────────────────────
  const uniqueBrandsPerWeek = last8Weeks.map(w => {
    const brands = new Set(
      filtered.filter(p => isActiveInWeek(p, w)).map(p => p.brand.trim().toLowerCase())
    )
    return { week: w, count: brands.size }
  })

  // Per category unique brands per week (uses filtered for cat/store filter)
  const uniqueBrandsByCatWeek = uniqueCategories.map(cat => {
    const catPromos = filtered.filter(r => r.category === cat)
    const weeks = last8Weeks.map(w => {
      const brands = new Set(
        catPromos.filter(p => isActiveInWeek(p, w)).map(p => p.brand.trim().toLowerCase())
      )
      return { week: w, count: brands.size }
    })
    const total = weeks.reduce((a, w) => a + w.count, 0)
    return { category: cat, weeks, total }
  }).filter(r => r.total > 0).sort((a, b) => b.total - a.total)

  // ── Table 2: Brand × Month ────────────────────────────────────────────────
  const last6Months = []
  for (let i = monthFilter - 1; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    last6Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const brandMonthMap = {}
  filtered.forEach(r => {
    const month = getMonthKey(r.from)
    if (!month) return
    const brand = r.brand.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    if (!brandMonthMap[brand]) brandMonthMap[brand] = {}
    if (!brandMonthMap[brand][month]) brandMonthMap[brand][month] = new Set()
    if (r.details) brandMonthMap[brand][month].add(r.details.trim())
  })

  Object.keys(brandMonthMap).forEach(brand => {
    Object.keys(brandMonthMap[brand]).forEach(month => {
      brandMonthMap[brand][month] = [...brandMonthMap[brand][month]]
    })
  })

  const brandMonthTable = Object.entries(brandMonthMap)
    .filter(([, months]) => Object.keys(months).some(m => last6Months.includes(m)))
    .map(([brand, months]) => ({ brand, months }))
    .sort((a, b) => a.brand.localeCompare(b.brand))

  // ── Table 3: Critical brands ──────────────────────────────────────────────
  // Critical brands: promo ended within last 30 days, no active or future promo
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  const recentlyEndedBrands = new Set(
    filtered.filter(r => r.till && r.till >= thirtyDaysAgoStr && r.till < today)
      .map(r => r.brand)
  )
  const activeOrFutureBrands = new Set(
    filtered.filter(r => r.till && r.till >= today)
      .map(r => r.brand)
  )
  const droppedBrandsAll = [...recentlyEndedBrands].filter(b => !activeOrFutureBrands.has(b))
    .map(b => {
      const promos = filtered.filter(r => r.brand === b)
      const last = promos.sort((a, b) => new Date(b.till) - new Date(a.till))[0]
      return { brand: b, category: last?.category || '', lastTill: last?.till || '', lastDetails: last?.details || '' }
    })
    .sort((a, b) => a.category.localeCompare(b.category))

  // #2 — apply top brands filter to critical brands
  const droppedBrands = topBrandsFilter
    ? droppedBrandsAll.filter(b => isTopBrand(b.brand))
    : droppedBrandsAll

  // ── Ending in next 7 days ─────────────────────────────────────────────────
  const in7Days = new Date()
  in7Days.setDate(in7Days.getDate() + 7)
  const in7DaysStr = in7Days.toISOString().split('T')[0]

  const endingSoonMapAll = {}
  filtered.forEach(r => {
    if (!r.till || r.till < today || r.till > in7DaysStr) return
    const key = r.brand + '|' + r.till
    if (!endingSoonMapAll[key]) endingSoonMapAll[key] = { brand: r.brand, category: r.category, till: r.till, details: [] }
    if (r.details && !endingSoonMapAll[key].details.includes(r.details.trim()))
      endingSoonMapAll[key].details.push(r.details.trim())
  })
  const endingSoonAll = Object.values(endingSoonMapAll).sort((a, b) => a.till.localeCompare(b.till))

  // #2 — apply top brands filter to ending soon
  const endingSoonList = topBrandsFilter
    ? endingSoonAll.filter(r => isTopBrand(r.brand))
    : endingSoonAll

  // ── Day view ──────────────────────────────────────────────────────────────
  const dayPromosList = filtered
    .filter(r => r.from && r.till && r.from <= selectedDay && r.till >= selectedDay)
    .map(r => ({
      promoId: r.promoId || '',
      brand: r.brand,
      category: r.category,
      from: r.from,
      till: r.till,
      assortment: r.assortment || '',
      skuLink: r.skuLink || '',
      offers: r.details ? [r.details.trim()] : [],
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.brand.localeCompare(b.brand))

  // ── Brand leaderboard ─────────────────────────────────────────────────────
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

  const tabs = [
    { id: 'weekly', label: 'Weekly Activity' },
    { id: 'monthly', label: 'Brand × Month' },
    { id: 'dropped', label: 'Critical Brands' },
    { id: 'dayview', label: '📅 Day View' },
    { id: 'ending', label: '⏰ Ending Soon' },
    { id: 'onlineoffline', label: '🌐 Online vs Offline' },
  ]

  // #2 — show top brands toggle on all tabs
  const showTopBrandsToggle = true

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

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-xs font-mono text-muted uppercase tracking-widest">Filter</span>
        <select
          className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
          value={catFilter} onChange={e => setCatFilter(e.target.value)}
        >
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select
          className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
          value={storeFilter} onChange={e => setStoreFilter(e.target.value)}
        >
          {STORES.map(s => <option key={s}>{s}</option>)}
        </select>

        <select
          className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
          value={onlineFilter} onChange={e => setOnlineFilter(e.target.value)}
        >
          <option value="All">All Channels</option>
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
        </select>

        {campaigns.length > 0 && (
          <select
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
            value={campFilter} onChange={e => setCampFilter(e.target.value)}
          >
            <option value="All">All Campaigns</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        {/* #2 — Top Brands toggle (only on Critical / Ending Soon) */}
        {showTopBrandsToggle && (
          <button
            onClick={() => setTopBrandsFilter(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-body border transition-colors ${
              topBrandsFilter
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-muted border-border hover:text-ink'
            }`}
          >
            <Star size={13} className={topBrandsFilter ? 'fill-white' : ''} />
            Top Brands {topBrandsFilter ? 'ON' : 'OFF'}
          </button>
        )}
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
            <div className="space-y-6">
              {/* #1 — Unique brands per week × Category */}
              <div>
                <h2 className="font-display font-bold text-xl text-ink mb-3">
                  Unique Brands Active Per Week — By Category
                </h2>
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
                      {uniqueBrandsByCatWeek.map(row => (
                        <tr key={row.category} className="border-b border-border last:border-0 hover:bg-paper/40">
                          <td className="px-4 py-3 font-medium text-ink sticky left-0 bg-white">{row.category}</td>
                          {row.weeks.map(w => (
                            <td key={w.week} className="px-3 py-3 text-center">
                              {w.count > 0 ? (
                                <span className={`inline-block min-w-[24px] rounded px-1.5 py-0.5 text-xs font-mono font-bold ${
                                  w.count >= 15 ? 'bg-emerald-100 text-emerald-700' :
                                  w.count >= 8 ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>{w.count}</span>
                              ) : <span className="text-border">—</span>}
                            </td>
                          ))}
                          <td className="px-3 py-3 text-center font-mono font-bold text-ink">{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

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


            </div>
          )}

          {/* Table 2: Brand × Month */}
          {tab === 'monthly' && (
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <h2 className="font-display font-bold text-xl text-ink">
                  Brand Promo Details
                  <span className="text-sm font-normal text-muted ml-2">({brandMonthTable.length} brands)</span>
                </h2>
                <div className="flex gap-1.5">
                  {[
                    { label: 'Current Month', val: 1 },
                    { label: 'Last 2 Months', val: 2 },
                    { label: 'Last 3 Months', val: 3 },
                    { label: 'Last 6 Months', val: 6 },
                  ].map(({ label, val }) => (
                    <button key={val} onClick={() => setMonthFilter(val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-body border transition-colors ${
                        monthFilter === val ? 'bg-ink text-white border-ink' : 'bg-white text-muted border-border hover:text-ink hover:border-ink'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                <button onClick={() => exportCSV(
                  brandMonthTable.map(r => ({
                    brand: r.brand,
                    ...last6Months.reduce((acc2, m) => ({ ...acc2, [fmtMonth(m)]: (r.months[m] || []).join(' | ') }), {})
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
                        <td className="px-4 py-3 font-medium text-ink sticky left-0 bg-white">
                          <span className="flex items-center gap-1.5">
                            {isTopBrand(row.brand) && <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />}
                            {row.brand}
                          </span>
                        </td>
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
                  <p className="text-sm text-muted mt-1">
                    {droppedBrands.length} brands need follow-up
                    {topBrandsFilter && <span className="ml-2 text-amber-600 font-medium">· Top Brands only</span>}
                  </p>
                </div>
                <button onClick={() => exportCSV(droppedBrands, 'critical-brands.csv')}
                  className="flex items-center gap-1.5 text-xs font-body text-ink border border-border bg-white px-3 py-1.5 rounded-lg hover:bg-paper">
                  <Download size={12} /> Export
                </button>
              </div>
              {droppedBrands.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-12 text-center">
                  <p className="text-success font-body">
                    {topBrandsFilter
                      ? '🎉 All top brands from last month are still running promos this month!'
                      : '🎉 All active brands from last month are still running promos this month!'}
                  </p>
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
                        <tr key={i} className={`border-b border-border last:border-0 hover:bg-amber-50/30 ${isTopBrand(b.brand) ? 'bg-amber-50/20' : ''}`}>
                          <td className="px-4 py-3 font-medium text-ink">
                            <span className="flex items-center gap-1.5">
                              {isTopBrand(b.brand) && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
                              {b.brand}
                            </span>
                          </td>
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

          {/* Day View */}
          {tab === 'dayview' && (
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="font-display font-bold text-xl text-ink flex items-center gap-2">
                  📅 Live Promos on a Day
                </h2>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
                    value={selectedDay}
                    onChange={e => setSelectedDay(e.target.value)}
                  />
                  <span className="text-sm text-muted font-body">{dayPromosList.length} promos live</span>
                  <button onClick={() => exportCSV(dayPromosList.map(r => ({...r, offers: r.offers.join(' | ')})), `live-promos-${selectedDay}.csv`)}
                    className="flex items-center gap-1.5 text-xs font-body text-ink border border-border bg-white px-3 py-1.5 rounded-lg hover:bg-paper">
                    <Download size={12} /> Export
                  </button>
                </div>
              </div>
              {dayPromosList.length === 0 ? (
                <div className="bg-paper border border-border rounded-xl py-12 text-center">
                  <p className="text-muted font-body">No promos live on {fmtDate(selectedDay)}.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-white">
                  <table className="min-w-full text-sm font-body">
                    <thead className="bg-paper border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">#</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Promo ID</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Promo Name</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Brand</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Category</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Start Date</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">End Date</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Assortment</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">SKU File</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Live Offers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayPromosList.map((r, i) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-paper/40">
                          <td className="px-4 py-3 text-muted font-mono text-xs">{i + 1}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted">{r.promoId || '—'}</td>
                          <td className="px-4 py-3 text-xs text-ink">{r.promoName || '—'}</td>
                          <td className="px-4 py-3 font-medium text-ink">{r.brand}</td>
                          <td className="px-4 py-3 text-muted text-xs">{r.category}</td>
                          <td className="px-4 py-3 font-mono text-xs text-ink">{fmtDate(r.from)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-ink">{fmtDate(r.till)}</td>
                          <td className="px-4 py-3 text-xs text-muted">{r.assortment || '—'}</td>
                          <td className="px-4 py-3 text-xs">
                            {r.skuLink
                              ? <a href={r.skuLink} target="_blank" rel="noreferrer" className="text-accent hover:underline flex items-center gap-1"><ExternalLink size={10} /> View</a>
                              : <span className="text-border">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted max-w-[250px]">
                            {r.offers.map((o, j) => (
                              <div key={j} className="bg-blue-50 text-blue-700 rounded px-2 py-0.5 text-[11px] mb-1 inline-block mr-1">{o}</div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Ending Soon */}
          {tab === 'ending' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-display font-bold text-xl text-ink flex items-center gap-2">
                    ⏰ Promos Ending in Next 7 Days
                  </h2>
                  <p className="text-sm text-muted mt-1">
                    {endingSoonList.length} promos ending between today and {fmtDate(in7DaysStr)}
                    {topBrandsFilter && <span className="ml-2 text-amber-600 font-medium">· Top Brands only</span>}
                  </p>
                </div>
                <button onClick={() => exportCSV(endingSoonList.map(r => ({...r, details: r.details.join(' | ')})), 'ending-soon.csv')}
                  className="flex items-center gap-1.5 text-xs font-body text-ink border border-border bg-white px-3 py-1.5 rounded-lg hover:bg-paper">
                  <Download size={12} /> Export
                </button>
              </div>
              {endingSoonList.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-12 text-center">
                  <p className="text-success font-body">No promos ending in the next 7 days.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-white">
                  <table className="min-w-full text-sm font-body">
                    <thead className="bg-paper border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Brand</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Category</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Ends On</th>
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Offer Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {endingSoonList.map((r, i) => {
                        const daysLeft = Math.ceil((new Date(r.till) - new Date(today)) / 86400000)
                        return (
                          <tr key={i} className={`border-b border-border last:border-0 hover:bg-paper/40 ${daysLeft <= 2 ? 'bg-red-50/30' : daysLeft <= 4 ? 'bg-amber-50/30' : ''}`}>
                            <td className="px-4 py-3 font-medium text-ink">
                              <span className="flex items-center gap-1.5">
                                {isTopBrand(r.brand) && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
                                {r.brand}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted">{r.category}</td>
                            <td className="px-4 py-3">
                              <span className={`font-mono text-xs font-bold ${daysLeft <= 2 ? 'text-danger' : daysLeft <= 4 ? 'text-warning' : 'text-ink'}`}>
                                {fmtDate(r.till)}
                              </span>
                              <span className="text-[11px] text-muted ml-1.5">
                                {daysLeft === 0 ? '(today)' : daysLeft === 1 ? '(tomorrow)' : `(${daysLeft}d)`}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted max-w-[250px]">
                              {r.details.slice(0, 2).join(' · ')}{r.details.length > 2 ? ` +${r.details.length - 2} more` : ''}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'onlineoffline' && (
            <OnlineOfflineTab allPromos={allPromos} />
          )}

        </>
      )}
    </div>
  )
}

function OnlineOfflineTab({ allPromos }) {
  const today = todayISO()
  const [ooFilter, setOoFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)

  // Filter to promos active within the selected date range
  const dateFiltered = allPromos.filter(r => {
    return (r.from || '') <= dateTo && (r.till || '') >= dateFrom
  })

  // Build one row per brand — latest promo details, online=Yes if any promo is online
  const brandMap = {}
  dateFiltered.forEach(r => {
    if (!r.brand) return
    if (!brandMap[r.brand]) {
      brandMap[r.brand] = {
        brand: r.brand, category: r.category,
        offerType: r.offerType || '',
        offerName: r.details || '',
        offerDesc: '',
        skuLevel: r.skuLink ? 'Selected SKUs' : 'All SKUs',
        online: false,
        latestFrom: r.from || '',
      }
    }
    // Update to latest promo
    if ((r.from || '') >= brandMap[r.brand].latestFrom) {
      brandMap[r.brand].latestFrom = r.from || ''
      brandMap[r.brand].offerType = r.offerType || ''
      brandMap[r.brand].offerName = r.details || ''
      brandMap[r.brand].skuLevel = r.skuLink ? 'Selected SKUs' : 'All SKUs'
    }
    // Online = Yes if any promo in range is online
    if ((r.store || '').includes('Online')) brandMap[r.brand].online = true
  })

  const brandList = Object.values(brandMap)
    .filter(b => ooFilter === 'Offline' ? !b.online : true)
    .sort((a, b) => a.brand.localeCompare(b.brand))

  const onlineCount = Object.values(brandMap).filter(b => b.online).length
  const offlineCount = Object.values(brandMap).filter(b => !b.online).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-ink flex items-center gap-2">
            🌐 Online vs Offline
          </h2>
          <p className="text-sm text-muted mt-1">
            {onlineCount} brands online · {offlineCount} brands offline · {brandList.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => exportCSV(brandList.map(b => ({
            brand: b.brand,
            category: b.category,
            offer_type: b.offerType || '',
            offer_name: b.offerName || '',
            sku_level: b.skuLevel,
            online: b.online ? 'Yes' : 'No',
          })), `online-offline-${dateFrom}-to-${dateTo}.csv`)}
            className="flex items-center gap-1.5 text-xs font-body text-ink border border-border bg-white px-3 py-1.5 rounded-lg hover:bg-paper">
            <Download size={12} /> Export
          </button>
          <div className="flex items-center gap-1.5 bg-white border border-border rounded-lg px-3 py-2 text-sm font-body">
            <span className="text-[10px] font-mono text-muted uppercase">From</span>
            <input type="date" className="text-sm font-body focus:outline-none bg-transparent"
              value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-border rounded-lg px-3 py-2 text-sm font-body">
            <span className="text-[10px] font-mono text-muted uppercase">To</span>
            <input type="date" className="text-sm font-body focus:outline-none bg-transparent"
              value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <select
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
            value={ooFilter} onChange={e => setOoFilter(e.target.value)}>
            <option value="All">All Brands</option>
            <option value="Offline">Offline Only</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="min-w-full text-sm font-body">
          <thead className="bg-paper border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">#</th>
              <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Brand</th>
              <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Category</th>
              <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Offer Type</th>
              <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Offer Name</th>
              <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">SKU Level</th>
              <th className="px-4 py-3 text-center text-[10px] font-mono uppercase tracking-widest text-muted">Online</th>
            </tr>
          </thead>
          <tbody>
            {brandList.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-muted">No data for selected filters.</td></tr>
            ) : brandList.map((b, i) => (
              <tr key={b.brand} className="border-b border-border last:border-0 hover:bg-paper/40">
                <td className="px-4 py-3 text-muted font-mono text-xs">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-ink">{b.brand}</td>
                <td className="px-4 py-3 text-muted text-xs">{b.category}</td>
                <td className="px-4 py-3 text-xs text-muted">{b.offerType || '—'}</td>
                <td className="px-4 py-3 text-xs text-ink">{b.offerName || '—'}</td>
                <td className="px-4 py-3 text-xs text-muted">{b.skuLevel}</td>
                <td className="px-4 py-3 text-center">
                  {b.online
                    ? <span className="bg-accent text-white text-xs font-mono px-2 py-0.5 rounded-full">Yes</span>
                    : <span className="text-border text-xs">No</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
