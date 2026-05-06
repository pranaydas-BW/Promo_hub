import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { exportCSV, fmtDate, todayISO } from '../lib/constants.jsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import { Loader2, TrendingUp, CheckCircle2, Clock, XCircle, Download, Barcode } from 'lucide-react'

const PAL = ['#E8490F', '#1A7A4A', '#C97D10', '#2563EB', '#7C3AED', '#0891B2', '#BE123C', '#0D9488']

export default function Analytics() {
  const [promos, setPromos] = useState([])
  const [skus, setSkus] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('brand') // 'brand' | 'sku'

  const today = todayISO()

  useEffect(() => {
    Promise.all([
      supabase.from('promo_requests').select('*'),
      supabase.from('sku_items').select('*'),
    ]).then(([{ data: p }, { data: s }]) => {
      setPromos(p || [])
      setSkus(s || [])
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div className="flex justify-center items-center h-64 gap-2 text-muted">
      <Loader2 size={18} className="animate-spin" /><span className="text-sm">Loading analytics…</span>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Analytics</h1>
        <p className="text-muted text-sm font-body mt-0.5">Retrospective view across all promos and SKUs</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-white border border-border rounded-xl p-1 w-fit mb-8">
        {[['brand', 'Brand Level'], ['sku', 'SKU / Barcode Level']].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)}
            className={`px-5 py-2 rounded-lg text-sm font-body font-medium transition-colors ${
              tab === val ? 'bg-ink text-white' : 'text-muted hover:text-ink'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'brand'
        ? <BrandAnalytics promos={promos} today={today} />
        : <SkuAnalytics skus={skus} promos={promos} today={today} />
      }
    </div>
  )
}

// ─── Brand-level analytics ────────────────────────────────────────────────────

function BrandAnalytics({ promos, today }) {
  const total = promos.length
  const active = promos.filter(r => r.current_status === 'Active').length
  const pending = promos.filter(r => r.status === 'Pending').length
  const rejected = promos.filter(r => r.status === 'Rejected').length

  // Starting / ending today
  const startingToday = promos.filter(r =>
    Array.isArray(r.date_ranges) && r.date_ranges.some(dr => dr.from === today)
  )
  const endingToday = promos.filter(r =>
    Array.isArray(r.date_ranges) && r.date_ranges.some(dr => dr.till === today)
  )

  const countBy = (arr, key) => {
    const m = {}
    arr.forEach(r => { const v = r[key] || 'Unknown'; m[v] = (m[v] || 0) + 1 })
    return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  }

  const byCategory = countBy(promos, 'category').map(x => ({ ...x, name: x.name.split('(')[0].trim() }))
  const byStatus = countBy(promos, 'status')
  const byFunder = countBy(promos, 'funded_by')
  const byPOC = countBy(promos, 'poc_name').slice(0, 8)

  // Top brands
  const brandMap = {}
  promos.forEach(r => {
    (r.brand_names || '').split(',').map(b => b.trim()).filter(Boolean).forEach(b => {
      brandMap[b] = (brandMap[b] || 0) + 1
    })
  })
  const topBrands = Object.entries(brandMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }))

  // Over time
  const monthMap = {}
  promos.forEach(r => {
    if (r.created_at) {
      const d = new Date(r.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap[key] = (monthMap[key] || 0) + 1
    }
  })
  const overTime = Object.entries(monthMap).sort().map(([month, count]) => ({ month, count }))

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total Promos" value={total} icon={TrendingUp} />
        <KPI label="Currently Active" value={active} icon={CheckCircle2} color="text-success" />
        <KPI label="Pending" value={pending} icon={Clock} color="text-warning" />
        <KPI label="Rejected" value={rejected} icon={XCircle} color="text-danger" />
      </div>

      {/* Today alert */}
      {(startingToday.length > 0 || endingToday.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TodayAlert title="Starting Today" items={startingToday} color="text-success" bg="bg-emerald-50" border="border-emerald-200" />
          <TodayAlert title="Ending Today" items={endingToday} color="text-danger" bg="bg-red-50" border="border-red-200" />
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Submissions Over Time">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={overTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2DDD6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <Tooltip contentStyle={ttStyle} />
              <Line type="monotone" dataKey="count" stroke="#E8490F" strokeWidth={2} dot={{ r: 3, fill: '#E8490F' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By Category">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCategory} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2DDD6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fontFamily: 'DM Sans' }} />
              <Tooltip contentStyle={ttStyle} />
              <Bar dataKey="count" fill="#E8490F" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartCard title="By Status">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byStatus} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                {byStatus.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}
              </Pie>
              <Tooltip contentStyle={ttStyle} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Funded By">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byFunder} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                {byFunder.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}
              </Pie>
              <Tooltip contentStyle={ttStyle} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By POC">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byPOC}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2DDD6" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'DM Sans' }} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <Tooltip contentStyle={ttStyle} />
              <Bar dataKey="count" fill="#1A7A4A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top brands */}
      <ChartCard title="Top Brands by Promo Volume">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={topBrands}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2DDD6" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'DM Sans' }} />
            <YAxis tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
            <Tooltip contentStyle={ttStyle} />
            <Bar dataKey="count" fill="#C97D10" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ─── SKU-level analytics ──────────────────────────────────────────────────────

function SkuAnalytics({ skus, promos, today }) {
  const [search, setSearch] = useState('')
  const [fBrand, setFBrand] = useState('')
  const [fType, setFType] = useState('')
  const [fActive, setFActive] = useState(false)

  const promoById = promos.reduce((a, p) => ({ ...a, [p.id]: p }), {})

  // Active = promo's date_ranges include today
  const activeBarcodes = skus.filter(s => {
    const promo = promoById[s.promo_id]
    return promo && Array.isArray(promo.date_ranges) &&
      promo.date_ranges.some(dr => dr.from <= today && dr.till >= today)
  })

  const filtered = skus.filter(s => {
    const q = search.toLowerCase()
    const isActive = promoById[s.promo_id]?.date_ranges?.some(dr => dr.from <= today && dr.till >= today)
    return (
      (!q || (s.barcode || '').includes(q) || (s.sku_name || '').toLowerCase().includes(q) || (s.brand_name || '').toLowerCase().includes(q)) &&
      (!fBrand || (s.brand_name || '').toLowerCase().includes(fBrand.toLowerCase())) &&
      (!fType || s.offer_type === fType) &&
      (!fActive || isActive)
    )
  })

  const allBrands = [...new Set(skus.map(s => s.brand_name).filter(Boolean))].sort()

  // Charts
  const skusByBrand = Object.entries(
    skus.reduce((a, s) => { a[s.brand_name || 'Unknown'] = (a[s.brand_name || 'Unknown'] || 0) + 1; return a }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))

  const byType = [
    { name: 'Promotion', count: skus.filter(s => s.offer_type === 'promotion').length },
    { name: 'RSP Update', count: skus.filter(s => s.offer_type === 'rsp').length },
  ]

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total SKUs" value={skus.length} icon={Barcode} />
        <KPI label="Active Today" value={activeBarcodes.length} icon={CheckCircle2} color="text-success" />
        <KPI label="Promotion SKUs" value={skus.filter(s => s.offer_type === 'promotion').length} icon={TrendingUp} color="text-info" />
        <KPI label="RSP Update SKUs" value={skus.filter(s => s.offer_type === 'rsp').length} icon={TrendingUp} color="text-warning" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="SKUs by Brand (top 10)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={skusByBrand} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2DDD6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fontFamily: 'DM Sans' }} />
              <Tooltip contentStyle={ttStyle} />
              <Bar dataKey="count" fill="#2563EB" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="SKUs by Offer Type">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byType} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {byType.map((_, i) => <Cell key={i} fill={PAL[i]} />)}
              </Pie>
              <Tooltip contentStyle={ttStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Filterable master table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-lg text-ink">
            All SKUs
            <span className="font-mono text-sm text-muted font-normal ml-2">({filtered.length})</span>
          </h3>
          <button onClick={() => exportCSV(filtered, 'sku-filtered-export.csv')}
            disabled={!filtered.length}
            className="flex items-center gap-1.5 bg-ink text-white text-xs font-body px-3 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-40">
            <Download size={12} /> Export
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <input className="w-full bg-white border border-border rounded-lg pl-3 pr-3 py-2 text-sm font-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
              placeholder="Search barcode, SKU name, brand…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body sm:w-40"
            value={fBrand} onChange={e => setFBrand(e.target.value)}>
            <option value="">All Brands</option>
            {allBrands.map(b => <option key={b}>{b}</option>)}
          </select>
          <select className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body sm:w-40"
            value={fType} onChange={e => setFType(e.target.value)}>
            <option value="">All Types</option>
            <option value="promotion">Promotion</option>
            <option value="rsp">RSP Update</option>
          </select>
          <button onClick={() => setFActive(!fActive)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-body border transition-colors ${
              fActive ? 'bg-emerald-50 text-success border-emerald-200' : 'bg-white text-muted border-border hover:text-ink'
            }`}>
            <CheckCircle2 size={13} /> Active today only
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="min-w-full text-sm font-body">
            <thead className="bg-paper border-b border-border">
              <tr>
                {['Promo ID', 'Barcode', 'SKU Name', 'Brand', 'MRP', 'Discount %', 'Offer Price', 'RSP', 'Store', 'Type', 'Active?'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-mono uppercase tracking-widest text-muted whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((s, i) => {
                const promo = promoById[s.promo_id]
                const isActive = promo?.date_ranges?.some(dr => dr.from <= today && dr.till >= today)
                return (
                  <tr key={s.id || i} className="border-b border-border last:border-0 hover:bg-paper/40">
                    <td className="px-3 py-2 font-mono text-xs text-muted">{s.promo_request_id}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.barcode}</td>
                    <td className="px-3 py-2 max-w-[180px] truncate">{s.sku_name}</td>
                    <td className="px-3 py-2">{s.brand_name}</td>
                    <td className="px-3 py-2 font-mono">₹{s.mrp}</td>
                    <td className="px-3 py-2 font-mono">{s.discount_pct != null ? `${s.discount_pct}%` : '—'}</td>
                    <td className="px-3 py-2 font-mono">{s.offer_price != null ? `₹${s.offer_price}` : '—'}</td>
                    <td className="px-3 py-2 font-mono">{s.rsp != null ? `₹${s.rsp}` : '—'}</td>
                    <td className="px-3 py-2 text-xs text-muted">{s.store || 'All'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        s.offer_type === 'promotion' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-teal-50 text-teal-700 border-teal-200'
                      }`}>{s.offer_type === 'promotion' ? 'Promo' : 'RSP'}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {isActive ? 'Active' : 'Not Live'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <p className="text-center text-xs text-muted py-3 border-t border-border">
              Showing 200 of {filtered.length} rows. Use filters or Export CSV to see all.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Shared components ────────────────────────────────────────────────────────

function KPI({ label, value, icon: Icon, color = 'text-ink' }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4 flex items-center gap-4">
      <Icon size={22} className={`${color} opacity-80`} />
      <div>
        <p className="font-display text-2xl font-bold text-ink">{value}</p>
        <p className="text-xs font-body text-muted">{label}</p>
      </div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white border border-border rounded-xl p-5">
      <h3 className="font-display font-semibold text-sm text-ink mb-4">{title}</h3>
      {children}
    </div>
  )
}

function TodayAlert({ title, items, color, bg, border }) {
  return (
    <div className={`${bg} border ${border} rounded-xl p-4`}>
      <p className={`font-display font-bold text-sm ${color} mb-2`}>{title} ({items.length})</p>
      <div className="space-y-1">
        {items.slice(0, 4).map(r => (
          <p key={r.id} className="text-xs font-body text-ink">
            <span className="font-mono text-muted mr-2">{r.promo_request_id}</span>
            {r.brand_names}
          </p>
        ))}
        {items.length > 4 && <p className={`text-xs ${color} font-mono`}>+{items.length - 4} more</p>}
      </div>
    </div>
  )
}

const ttStyle = {
  fontFamily: 'DM Sans', fontSize: 12,
  borderRadius: 8, border: '1px solid #E2DDD6',
  backgroundColor: 'white',
}
