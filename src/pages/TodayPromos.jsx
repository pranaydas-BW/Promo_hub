import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { StatusBadge, CurrentStatusDot, exportCSV, fmtDate, todayISO } from '../lib/constants.jsx'
import { Download, RefreshCw, CalendarCheck, CalendarX, CalendarClock, Loader2, ExternalLink } from 'lucide-react'

function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export default function TodayPromos() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const today = todayISO()
  const tomorrow = addDays(today, 1)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('promo_requests')
      .select('*')
      .order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  const matchDate = (row, field, date) =>
    Array.isArray(row.date_ranges) &&
    row.date_ranges.some(dr => dr[field] === date)

  const startingToday    = rows.filter(r => matchDate(r, 'from', today))
  const startingTomorrow = rows.filter(r => matchDate(r, 'from', tomorrow))
  const endingToday      = rows.filter(r => matchDate(r, 'till', today))
  const endingTomorrow   = rows.filter(r => matchDate(r, 'till', tomorrow))

  const toExport = (list) => list.map(r => ({
    promo_request_id: r.promo_request_id || '',
    brand_names: r.brand_names || '',
    category: r.category || '',
    store: r.store || '',
    poc_name: r.poc_name || '',
    promotion_name: r.promotion_name || '',
    promo_details: r.promo_details || '',
    offer_type: r.offer_type || '',
    funded_by: r.funded_by || '',
    date_ranges: JSON.stringify(r.date_ranges),
    status: r.status || '',
    current_status: r.current_status || '',
    ginesys_promo_id: r.ginesys_promo_id || '',
    shopify_discount_id: r.shopify_discount_id || '',
  }))

  const totalCount = startingToday.length + startingTomorrow.length + endingToday.length + endingTomorrow.length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Promo Calendar</h1>
          <p className="text-muted text-sm font-body mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 bg-white border border-border rounded-lg hover:bg-paper transition-colors">
            <RefreshCw size={14} className="text-muted" />
          </button>
          <button
            onClick={() => exportCSV(toExport([...startingToday, ...startingTomorrow, ...endingToday, ...endingTomorrow]), `promos-upcoming-${today}.csv`)}
            disabled={!totalCount}
            className="flex items-center gap-1.5 bg-ink text-white text-sm font-body px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors">
            <Download size={13} /> Export All
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48 gap-2 text-muted">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <div className="space-y-8">
          <PromoGroup
            title="Starting Today"
            date={today}
            icon={<CalendarCheck size={18} className="text-success" />}
            color="text-success"
            bg="bg-emerald-50"
            border="border-emerald-200"
            rows={startingToday}
            event="starting"
            matchDate={today}
            onExport={() => exportCSV(toExport(startingToday), `starting-today-${today}.csv`)}
          />
          <PromoGroup
            title="Starting Tomorrow"
            date={tomorrow}
            icon={<CalendarClock size={18} className="text-info" />}
            color="text-info"
            bg="bg-blue-50"
            border="border-blue-200"
            rows={startingTomorrow}
            event="starting"
            matchDate={tomorrow}
            onExport={() => exportCSV(toExport(startingTomorrow), `starting-tomorrow-${today}.csv`)}
          />
          <PromoGroup
            title="Ending Today"
            date={today}
            icon={<CalendarX size={18} className="text-danger" />}
            color="text-danger"
            bg="bg-red-50"
            border="border-red-200"
            rows={endingToday}
            event="ending"
            matchDate={today}
            onExport={() => exportCSV(toExport(endingToday), `ending-today-${today}.csv`)}
          />
          <PromoGroup
            title="Ending Tomorrow"
            date={tomorrow}
            icon={<CalendarX size={18} className="text-warning" />}
            color="text-warning"
            bg="bg-amber-50"
            border="border-amber-200"
            rows={endingTomorrow}
            event="ending"
            matchDate={tomorrow}
            onExport={() => exportCSV(toExport(endingTomorrow), `ending-tomorrow-${today}.csv`)}
          />
        </div>
      )}
    </div>
  )
}

function PromoGroup({ title, date, icon, color, bg, border, rows, event, matchDate, onExport }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className={`font-display font-bold text-xl ${color}`}>{title}</h2>
          <span className="font-mono text-xs text-muted bg-white border border-border px-2 py-0.5 rounded-full">
            {fmtDate(date)}
          </span>
          <span className="font-mono text-sm text-muted">({rows.length})</span>
        </div>
        {rows.length > 0 && (
          <button onClick={onExport}
            className={`flex items-center gap-1.5 text-xs font-body font-medium px-3 py-1.5 rounded-lg border ${bg} ${border} ${color} hover:opacity-80 transition-opacity`}>
            <Download size={11} /> Export CSV
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className={`${bg} border ${border} rounded-xl py-8 text-center`}>
          <p className={`text-sm font-body ${color} opacity-60`}>
            No promos {event} on {fmtDate(date)}.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <PromoCard
              key={r.id}
              row={r}
              event={event}
              matchDate={matchDate}
              bg={bg}
              border={border}
              color={color}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PromoCard({ row: r, event, matchDate, bg, border, color }) {
  const relevantRanges = (r.date_ranges || []).filter(dr =>
    event === 'starting' ? dr.from === matchDate : dr.till === matchDate
  )

  return (
    <div className={`bg-white border ${border} rounded-xl p-4`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-[11px] text-muted">{r.promo_request_id}</span>
            <StatusBadge status={r.status} />
            <CurrentStatusDot status={r.current_status} />
          </div>
          <p className="font-display font-bold text-base text-ink">{r.brand_names}</p>
          <p className="text-xs text-muted mt-0.5">
            {r.category}
            {r.store ? ` · ${r.store}` : ''}
            {` · ${r.poc_name}`}
          </p>
          {r.promotion_name && (
            <p className="text-xs text-ink mt-1 font-medium">📌 {r.promotion_name}</p>
          )}
          <p className="text-sm font-body text-ink mt-1.5">{r.promo_details}</p>
        </div>

        {/* Date range highlight */}
        <div className="shrink-0 space-y-1">
          {relevantRanges.map((dr, i) => (
            <div key={i} className={`${bg} border ${border} rounded-lg px-3 py-2 text-xs font-body`}>
              <p className={`font-semibold ${color}`}>
                {event === 'starting' ? '▶ Starts' : '⏹ Ends'} {fmtDate(matchDate)}
              </p>
              <p className="text-muted mt-0.5">
                Full range: {fmtDate(dr.from)} → {fmtDate(dr.till)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-4 text-xs font-body text-muted">
        <span className="font-medium text-ink">{r.offer_type}</span>
        {r.funded_by && <span>Funded: <b className="text-ink">{r.funded_by}</b></span>}
        {r.assortment_type && <span>{r.assortment_type}</span>}
        {r.ginesys_promo_id && <span>Ginesys: <span className="font-mono text-ink">{r.ginesys_promo_id}</span></span>}
        {r.shopify_promo_status && <span className="text-purple-600 font-medium">{r.shopify_promo_status}</span>}
        {r.sku_file_link && (
          <a href={r.sku_file_link} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-accent hover:underline">
            <ExternalLink size={10} /> SKU File
          </a>
        )}
      </div>
    </div>
  )
}
