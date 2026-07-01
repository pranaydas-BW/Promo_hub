import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  StatusBadge, CurrentStatusDot,
  STATUS_OPTIONS, CURRENT_STATUS_OPTIONS, SHOPIFY_STATUS_OPTIONS,
  CATEGORIES, STATUS_STYLES, fmtDate, exportCSV,
} from '../lib/constants.jsx'
import { Search, RefreshCw, Plus, ChevronDown, ExternalLink, Loader2, Filter, Download, RotateCcw, Pencil, History, X, Check, Upload } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { StatusPanel } from '../components/StatusPanel'
import { SkuReUpload } from '../components/SkuReUpload'

// Get the earliest start date from date_ranges
function getStartDate(r) {
  const ranges = Array.isArray(r.date_ranges) ? r.date_ranges : []
  const dates = ranges.map(dr => dr.from).filter(Boolean).sort()
  return dates[0] || r.date_of_entry || r.created_at?.split('T')[0] || ''
}

// Get latest end date across all date_ranges
function getEndDate(r) {
  const ranges = Array.isArray(r.date_ranges) ? r.date_ranges : []
  const dates = ranges.map(dr => dr.till).filter(Boolean).sort()
  return dates[dates.length - 1] || ''
}

// Is promo considered "active" — either not yet actioned or end date is today/future
const UNACTIONED = ['Pending', 'Under Review']
function isActivePromo(r) {
  const today = new Date().toISOString().slice(0, 10)
  if (UNACTIONED.includes(r.status)) return true
  const endDate = getEndDate(r)
  return !endDate || endDate >= today
}

// Group rows by start date, sorted ascending
function groupByStartDate(rows) {
  const groups = {}
  rows.forEach(r => {
    const d = getStartDate(r)
    if (!groups[d]) groups[d] = []
    groups[d].push(r)
  })
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }))
}

export default function Board() {
  const { isAdmin, user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('All')
  const [fCategory, setFCategory] = useState('All')
  const [fCurrent, setFCurrent] = useState('All')
  const [expandedId, setExpandedId] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [fStore, setFStore] = useState('All')
  const [fCampaign, setFCampaign] = useState('All')
  const [fOnline, setFOnline] = useState('All')
  const [fDateFrom, setFDateFrom] = useState('')
  const [fDateTo, setFDateTo] = useState('')
  const [campaigns, setCampaigns] = useState([])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('promo_requests').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRows()
    supabase.from('sale_campaigns').select('*').order('start_date', { ascending: false })
      .then(({ data }) => setCampaigns(data || []))
  }, [fetchRows])

  const patch = async (id, update) => {
    setUpdatingId(id)
    await supabase.from('promo_requests').update(update).eq('id', id)
    setRows(r => r.map(x => x.id === id ? { ...x, ...update } : x))
    setUpdatingId(null)
  }

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q ||
      (r.brand_names || '').toLowerCase().includes(q) ||
      (r.poc_name || '').toLowerCase().includes(q) ||
      (r.promo_request_id || '').toLowerCase().includes(q) ||
      (r.promotion_name || '').toLowerCase().includes(q) ||
      (r.promo_details || '').toLowerCase().includes(q)
    return matchQ &&
      (fStatus === 'All' || r.status === fStatus) &&
      (fCategory === 'All' || r.category === fCategory) &&
      (fCurrent === 'All' || r.current_status === fCurrent) &&
      (fStore === 'All' || (r.store || '').includes(fStore)) &&
      (fCampaign === 'All' || r.campaign_id === fCampaign) &&
      (fOnline === 'All' || (fOnline === 'Online' ? (r.store || '').includes('Online') : !(r.store || '').includes('Online'))) &&
      (() => {
        if (!fDateFrom && !fDateTo) return true
        const ranges = Array.isArray(r.date_ranges) ? r.date_ranges : []
        return ranges.some(dr => {
          const from = dr.from || ''
          const till = dr.till || ''
          if (fDateFrom && fDateTo) return from <= fDateTo && till >= fDateFrom
          if (fDateFrom) return till >= fDateFrom
          if (fDateTo) return from <= fDateTo
          return true
        })
      })()
  })

  // #5 — split into active (top) and past (bottom)
  const activeRows = filtered.filter(r => isActivePromo(r))
  const pastRows = filtered.filter(r => !isActivePromo(r))
  const groupedRows = groupByStartDate(filtered)
  const groupedPast = groupByStartDate(pastRows)

  const pastSectionRef = useRef(null)

  const counts = STATUS_OPTIONS.reduce((a, s) => ({ ...a, [s]: rows.filter(r => r.status === s).length }), {})

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 fade-in">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Promo Board</h1>
          <p className="text-muted text-sm font-body mt-0.5">{rows.length} total · {filtered.length} shown</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchRows} className="p-2 bg-white border border-border rounded-lg hover:bg-paper transition-colors">
            <RefreshCw size={14} className="text-muted" />
          </button>
          <button
            onClick={() => {
              const toExport = filtered.map(r => ({
                promo_request_id: r.promo_request_id || '',
                date_of_entry: r.date_of_entry || '',
                brand_names: r.brand_names || '',
                category: r.category || '',
                store: r.store || '',
                poc_name: r.poc_name || '',
                funded_by: r.funded_by || '',
                offer_type: r.offer_type || '',
                promotion_name: r.promotion_name || '',
                promo_details: r.promo_details || '',
                assortment_type: r.assortment_type || '',
                broadway_discount_pct: r.broadway_discount_pct || r.broadway_discount_both || '',
                brand_discount_pct: r.brand_discount_pct || r.brand_discount_both || '',
                valid_from: Array.isArray(r.date_ranges) && r.date_ranges[0] ? r.date_ranges[0].from : '',
                valid_till: Array.isArray(r.date_ranges) && r.date_ranges[0] ? r.date_ranges[0].till : '',
                all_date_ranges: JSON.stringify(r.date_ranges),
                status: r.status || '',
                current_status: r.current_status || '',
                shopify_promo_status: r.shopify_promo_status || '',
                ginesys_promo_id: r.ginesys_promo_id || '',
                shopify_discount_id: r.shopify_discount_id || '',
                picked_by: r.picked_by || '',
                remark: r.remark || '',
                sku_file_url: r.sku_file_link || '',
                rsp_file_url: r.rsp_file_link || '',
                approval_url: r.approval_email || '',
              }))
              exportCSV(toExport, `promo-board-export-${new Date().toISOString().split('T')[0]}.csv`)
            }}
            disabled={!filtered.length}
            className="flex items-center gap-1.5 bg-white border border-border text-sm font-body px-3 py-2 rounded-lg hover:bg-paper disabled:opacity-40 transition-colors">
            <Download size={14} className="text-muted" /> Export CSV
          </button>
          <Link to="/new" className="flex items-center gap-1.5 bg-accent text-white text-sm font-body font-medium px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors">
            <Plus size={13} /> New Request
          </Link>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {['All', ...STATUS_OPTIONS].map(s => (
          <button key={s} onClick={() => setFStatus(s)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wide border transition-all ${
              fStatus === s
                ? s === 'All' ? 'bg-ink text-white border-ink' : `${STATUS_STYLES[s]} border`
                : 'bg-white border-border text-muted hover:text-ink'
            }`}>
            {s}{s !== 'All' && <span className="opacity-50 ml-0.5">({counts[s] || 0})</span>}
          </button>
        ))}
      </div>



      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="w-full bg-white border border-border rounded-lg pl-8 pr-3 py-2 text-sm font-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            placeholder="Search brand, POC, promo ID…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20 sm:w-52"
          value={fCategory} onChange={e => setFCategory(e.target.value)}>
          <option value="All">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20 sm:w-36"
          value={fCurrent} onChange={e => setFCurrent(e.target.value)}>
          <option value="All">All Live Status</option>
          <option>Active</option>
          <option>Not Live</option>
        </select>
      </div>

      {/* Date range + Store + Campaign filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex items-center gap-1.5 bg-white border border-border rounded-lg px-3 py-2 text-sm font-body">
          <span className="text-[10px] font-mono text-muted uppercase">From</span>
          <input type="date" className="text-sm font-body focus:outline-none bg-transparent"
            value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-border rounded-lg px-3 py-2 text-sm font-body">
          <span className="text-[10px] font-mono text-muted uppercase">To</span>
          <input type="date" className="text-sm font-body focus:outline-none bg-transparent"
            value={fDateTo} onChange={e => setFDateTo(e.target.value)} />
        </div>
        <select className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
          value={fStore} onChange={e => setFStore(e.target.value)}>
          <option value="All">All Stores</option>
          {['VK, Delhi', 'BH, Hyderabad', 'Pune', 'Mumbai', 'Online'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
          value={fOnline} onChange={e => setFOnline(e.target.value)}>
          <option value="All">All Channels</option>
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
        </select>
        {campaigns.length > 0 && (
          <select className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
            value={fCampaign} onChange={e => setFCampaign(e.target.value)}>
            <option value="All">All Campaigns</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {(fDateFrom || fDateTo || fStore !== 'All' || fCampaign !== 'All' || fOnline !== 'All') && (
          <button onClick={() => { setFDateFrom(''); setFDateTo(''); setFStore('All'); setFCampaign('All'); setFOnline('All') }}
            className="px-3 py-2 text-xs font-mono text-muted hover:text-danger border border-border bg-white rounded-lg transition-colors">
            ✕ Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48 gap-2 text-muted">
          <Loader2 size={18} className="animate-spin" /><span className="text-sm">Loading…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <Filter size={26} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No requests match your filters.</p>
        </div>
      ) : (
        // #5 — Date-grouped board view
        <div className="space-y-6">
          {groupedRows.map(({ date, items }) => (
            <div key={date}>
              {/* Date group header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2 bg-ink text-white px-3 py-1 rounded-full">
                  <span className="text-[11px] font-mono font-bold tracking-wider">
                    {date ? fmtDate(date) : 'No Date'}
                  </span>
                  <span className="text-[10px] opacity-60">·</span>
                  <span className="text-[10px] font-mono opacity-70">{items.length} promo{items.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Rows for this date */}
              <div className="space-y-2">
                {items.map(r => (
                  <PromoRow key={r.id} row={r}
                    expanded={expandedId === r.id}
                    onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    onPatch={patch} updating={updatingId === r.id}
                    isAdmin={isAdmin}
                    allRows={rows}
                    userEmail={user?.email} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PromoRow({ row: r, expanded, onToggle, onPatch, updating, isAdmin, allRows, userEmail }) {
  const ranges = Array.isArray(r.date_ranges) ? r.date_ranges : []
  const first = ranges[0] || {}

  // #5 — Auto-compute Expired: if status is a "created" state and all date ranges are past
  const todayStr = new Date().toISOString().split('T')[0]
  const isCreatedStatus = ['Promo Created - System', 'Selling Price Updated'].includes(r.status)
  const allExpired = ranges.length > 0 && ranges.every(dr => dr.till && dr.till < todayStr)
  const effectiveCurrentStatus = isCreatedStatus && allExpired ? 'Expired' : r.current_status

  // #3 — detect RSP reversal entries
  const isRSPReversal = r.offer_type === 'RSP Update' && r.is_reversal === true
  // #4 — detect closure entries
  const isClosure = r.offer_type === 'Promo Closure'

  // #3 — execution date is the start date of reversal
  const reversalExecutionDate = isRSPReversal
    ? (ranges[0]?.from || '')
    : null

  const today = new Date().toISOString().split('T')[0]
  const reversalIsUpcoming = reversalExecutionDate && reversalExecutionDate > today
  const reversalIsDue = reversalExecutionDate && reversalExecutionDate <= today

  return (
    <div className={`bg-white border rounded-xl transition-all ${
      isClosure
        ? 'border-red-300 bg-red-50/30 shadow-sm'
        : isRSPReversal
          ? reversalIsUpcoming
            ? 'border-purple-300 bg-purple-50/30 shadow-sm'
            : 'border-orange-300 bg-orange-50/30 shadow-sm'
          : expanded
            ? 'border-accent/40 shadow-sm'
            : 'border-border hover:shadow-sm'
    }`}>
      <button className="w-full text-left px-5 py-3.5 flex items-center gap-3 flex-wrap sm:flex-nowrap" onClick={onToggle}>
        <span className="font-mono text-[11px] text-muted shrink-0 w-12">{r.promo_request_id || '—'}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {/* #3 — RSP reversal badge */}
            {isRSPReversal && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full border shrink-0 ${
                reversalIsUpcoming
                  ? 'bg-purple-100 text-purple-700 border-purple-300'
                  : 'bg-orange-100 text-orange-700 border-orange-300'
              }`}>
                <RotateCcw size={8} />
                RSP REVERSE
              </span>
            )}
            {/* #4 — Closure badge */}
            {isClosure && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full border shrink-0 bg-red-100 text-red-700 border-red-300">
                🔴 CLOSURE
              </span>
            )}
            <p className="font-display font-semibold text-sm text-ink truncate">{r.brand_names}</p>
          </div>
          <p className="text-[11px] text-muted truncate">{r.category}</p>
        </div>

        <div className="hidden lg:block flex-1 min-w-0">
          <p className="text-xs font-body text-ink truncate">{r.promotion_name || r.promo_details}</p>
        </div>

        {/* #3 — highlight execution date for reversals */}
        <div className="hidden md:flex items-center gap-1 text-[11px] shrink-0 w-44">
          {isRSPReversal && reversalExecutionDate ? (
            <div className="flex flex-col">
              <span className={`font-mono font-bold text-xs ${reversalIsUpcoming ? 'text-purple-700' : 'text-orange-700'}`}>
                Execute: {fmtDate(reversalExecutionDate)}
              </span>
              {reversalIsUpcoming && (
                <span className="text-[10px] text-purple-500">Do not execute before this date</span>
              )}
              {reversalIsDue && (
                <span className="text-[10px] text-orange-600 font-medium">⚠ Due for execution</span>
              )}
            </div>
          ) : (
            <span className="text-muted">
              {first.from ? `${fmtDate(first.from)} → ${fmtDate(first.till)}` : '—'}
              {ranges.length > 1 && <span className="text-accent ml-1 font-mono">+{ranges.length - 1}</span>}
            </span>
          )}
        </div>

        <div className="hidden lg:block text-[11px] text-muted shrink-0 w-24 truncate">{r.poc_name}</div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <StatusBadge status={r.status} />
          <CurrentStatusDot status={effectiveCurrentStatus} />
        </div>
        <ChevronDown size={13} className={`text-muted shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-border pt-4 space-y-5 fade-in">
          {/* #3 — RSP reversal callout banner */}
          {isRSPReversal && (
            <div className={`rounded-lg px-4 py-3 border ${
              reversalIsUpcoming
                ? 'bg-purple-50 border-purple-300'
                : 'bg-orange-50 border-orange-300'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <RotateCcw size={14} className={reversalIsUpcoming ? 'text-purple-600' : 'text-orange-600'} />
                <p className={`text-sm font-display font-bold ${reversalIsUpcoming ? 'text-purple-800' : 'text-orange-800'}`}>
                  RSP Update Reversal
                </p>
              </div>
              <p className={`text-xs font-body ${reversalIsUpcoming ? 'text-purple-700' : 'text-orange-700'}`}>
                <span className="font-semibold">Execution date: </span>
                <span className={`font-mono font-bold ${reversalIsUpcoming ? 'text-purple-800' : 'text-orange-800'}`}>
                  {fmtDate(reversalExecutionDate)}
                </span>
              </p>
              {reversalIsUpcoming && (
                <p className="text-xs text-purple-600 mt-1 font-medium">
                  ⚠ Do NOT execute this reversal before {fmtDate(reversalExecutionDate)}
                </p>
              )}
              {reversalIsDue && (
                <p className="text-xs text-orange-600 mt-1 font-medium">
                  ✓ This reversal is due — proceed with execution
                </p>
              )}
              {r.linked_promo_id && (
                <p className="text-xs text-muted mt-1">
                  Linked to original promo: <span className="font-mono font-bold">{r.linked_promo_id}</span>
                </p>
              )}
            </div>
          )}

          {/* Detail grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              ['Promo Request ID', r.promo_request_id],
              ['Ginesys Promo ID', r.ginesys_promo_id],
              ['Shopify Discount ID', r.shopify_discount_id],
              ['Promotion Name', r.promotion_name],
              ['Type of Offer', r.offer_type],
              ['Live Status', effectiveCurrentStatus],
              ['Funded By', r.funded_by],
              ['Assortment Type', r.assortment_type],
              ['Store', r.store],
              ['Broadway Discount %', r.broadway_discount_pct || r.broadway_discount_both],
              ['Brand Discount %', r.brand_discount_pct || r.brand_discount_both],
              ['Discount On', r.discount_on || (r.offer_type === 'Promotion' ? 'Not set' : null)],
              ['POC', r.poc_name],
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={l}>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-0.5">{l}</p>
                <p className="text-sm font-body text-ink">{v}</p>
              </div>
            ))}
          </div>

          {r.promo_details && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-0.5">Promotion Details</p>
              <p className="text-sm font-body text-ink whitespace-pre-wrap">{r.promo_details}</p>
            </div>
          )}

          {/* Discount On — prominent for Promotions */}
          {r.offer_type === 'Promotion' && (
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted">Discount On</p>
              {r.discount_on ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-bold bg-blue-100 text-blue-700 border border-blue-200">
                  {r.discount_on}
                </span>
              ) : (
                <span className="text-xs text-muted italic">Not set</span>
              )}
            </div>
          )}

          {/* Date ranges */}
          {ranges.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">
                {isRSPReversal ? 'Execution Date' : 'Date Ranges'}
              </p>
              <div className="flex flex-wrap gap-2">
                {ranges.map((dr, i) => (
                  <div key={i} className={`border rounded-lg px-3 py-2 text-xs font-body ${
                    isRSPReversal ? 'bg-purple-50 border-purple-200' : 'bg-paper border-border'
                  }`}>
                    <span className="font-medium">{fmtDate(dr.from)} → {fmtDate(dr.till)}</span>
                    {dr.stores?.length > 0 && <span className="text-muted ml-2">({dr.stores.join(', ')})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Links & Files */}
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-wrap gap-4">
              {r.approval_email && (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1.5">Brand Approval</p>
                  {r.approval_email.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                    <a href={r.approval_email} target="_blank" rel="noreferrer">
                      <img src={r.approval_email} alt="Approval screenshot"
                        className="max-h-48 rounded-lg border border-border object-contain hover:opacity-80 transition-opacity" />
                    </a>
                  ) : (
                    <ELink href={r.approval_email} label={r.approval_file_name || 'View Approval'} />
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {/* SKU file — only for Promotions */}
                {!isRSPReversal && r.offer_type !== 'RSP Update' && r.sku_file_link && <ELink href={r.sku_file_link} label="SKU File" />}
                {!isRSPReversal && r.offer_type !== 'RSP Update' && r.sku_file_name && r.sku_file_data && (
                  <button
                    onClick={() => downloadCsvFromData(r.sku_file_name, r.sku_file_data)}
                    className="flex items-center gap-1.5 text-xs font-body text-accent hover:underline">
                    <Download size={11} /> {r.sku_file_name}
                  </button>
                )}
                {/* Re-upload SKU file if name exists but link is missing */}
                {isAdmin && !isRSPReversal && r.offer_type !== 'RSP Update' && r.sku_file_name && !r.sku_file_link && (
                  <SkuReUpload row={r} onPatch={onPatch} />
                )}
                {/* RSP file — only for RSP Updates (not reversals) */}
                {r.offer_type === 'RSP Update' && !isRSPReversal && r.rsp_file_link && <ELink href={r.rsp_file_link} label="RSP File" />}
                {r.offer_type === 'RSP Update' && !isRSPReversal && r.rsp_file_name && r.rsp_file_data && (
                  <button
                    onClick={() => downloadCsvFromData(r.rsp_file_name, r.rsp_file_data)}
                    className="flex items-center gap-1.5 text-xs font-body text-accent hover:underline">
                    <Download size={11} /> {r.rsp_file_name}
                  </button>
                )}
                {/* Reversal file — only for RSP Reversals */}
                {isRSPReversal && r.rsp_file_link && <ELink href={r.rsp_file_link} label="Reversal RSP File" />}
                {isRSPReversal && r.rsp_file_name && r.rsp_file_data && (
                  <button
                    onClick={() => downloadCsvFromData(r.rsp_file_name, r.rsp_file_data)}
                    className="flex items-center gap-1.5 text-xs font-body text-accent hover:underline">
                    <Download size={11} /> {r.rsp_file_name}
                  </button>
                )}
              </div>
            </div>
          </div>

          {r.remark && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm font-body text-amber-800">
              💬 {r.remark}
            </div>
          )}

          {isAdmin && (
            <EditPanel row={r} onPatch={onPatch} isAdmin={isAdmin} userEmail={userEmail} />
          )}
          {isAdmin && (
            <StatusPanel row={r} onPatch={onPatch} updating={updating} allRows={allRows} />
          )}
        </div>
      )}
    </div>
  )
}

function downloadCsvFromData(fileName, jsonData) {
  try {
    const rows = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData
    if (!rows?.length) return
    const headers = Object.keys(rows[0])
    const lines = [
      headers.join(','),
      ...rows.map(r => headers.map(h => {
        const v = r[h] == null ? '' : String(r[h])
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
      }).join(','))
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click()
    URL.revokeObjectURL(url)
  } catch (e) { console.error('CSV download error', e) }
}

function ELink({ href, label }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="flex items-center gap-1.5 text-xs font-body text-accent hover:underline">
      <ExternalLink size={11} /> {label}
    </a>
  )
}

function EditPanel({ row: r, onPatch, isAdmin, userEmail }) {
  const [open, setOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [editHistory, setEditHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [draft, setDraft] = useState({
    promo_details: r.promo_details || '',
    store: r.store || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const isDirty =
    draft.promo_details !== (r.promo_details || '') ||
    draft.store !== (r.store || '')

  const handleSave = async () => {
    setSaving(true)
    const changes = []
    if (draft.promo_details !== (r.promo_details || '')) {
      changes.push({ promo_request_id: r.promo_request_id, field_name: 'promo_details', old_value: r.promo_details || '', new_value: draft.promo_details, edited_by: userEmail })
    }
    if (draft.store !== (r.store || '')) {
      changes.push({ promo_request_id: r.promo_request_id, field_name: 'store', old_value: r.store || '', new_value: draft.store, edited_by: userEmail })
    }
    if (changes.length) {
      await supabase.from('promo_edits').insert(changes)
      await onPatch(r.id, { promo_details: draft.promo_details, store: draft.store })
    }
    setSaving(false)
    setSaved(true)
    setOpen(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const loadHistory = async () => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('promo_edits')
      .select('*')
      .eq('promo_request_id', r.promo_request_id)
      .order('edited_at', { ascending: false })
    setEditHistory(data || [])
    setHistoryLoading(false)
  }

  const toggleHistory = () => {
    if (!historyOpen) loadHistory()
    setHistoryOpen(h => !h)
  }

  if (!isAdmin) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 text-[11px] font-body text-muted hover:text-ink transition-colors"
        >
          <Pencil size={11} />
          {open ? 'Cancel Edit' : 'Edit Fields'}
        </button>
        <button
          onClick={toggleHistory}
          className="flex items-center gap-1.5 text-[11px] font-body text-muted hover:text-ink transition-colors"
        >
          <History size={11} />
          Edit History
        </button>
        {saved && <span className="text-[11px] text-success">✓ Saved</span>}
      </div>

      {open && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3 fade-in">
          <p className="text-[11px] font-mono uppercase tracking-widest text-blue-700">Edit Fields</p>
          <div>
            <label className="text-[10px] font-mono uppercase text-muted mb-1 block">Promotion Details</label>
            <textarea
              className="w-full bg-white border border-border rounded-lg px-2.5 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
              rows={3}
              value={draft.promo_details}
              onChange={e => setDraft(d => ({ ...d, promo_details: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase text-muted mb-1 block">Store</label>
            <input
              className="w-full bg-white border border-border rounded-lg px-2.5 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
              value={draft.store}
              onChange={e => setDraft(d => ({ ...d, store: e.target.value }))}
            />
          </div>
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 bg-accent text-white text-xs font-body px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        </div>
      )}

      {historyOpen && (
        <div className="bg-paper border border-border rounded-lg p-4 space-y-3 fade-in">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted">Edit History</p>
          {historyLoading ? (
            <div className="flex items-center gap-2 text-muted text-xs">
              <Loader2 size={12} className="animate-spin" /> Loading…
            </div>
          ) : editHistory.length === 0 ? (
            <p className="text-xs text-muted">No edits recorded.</p>
          ) : (
            <div className="space-y-2">
              {editHistory.map((e, i) => (
                <div key={i} className="text-[11px] font-body border-b border-border pb-2 last:border-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium text-ink capitalize">{e.field_name.replace('_', ' ')}</span>
                    <span className="font-mono text-muted">
                      {new Date(e.edited_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className="text-muted">by </span>
                  <span className="font-medium text-ink">{e.edited_by?.split('@')[0]}</span>
                  <div className="mt-1 flex gap-2">
                    <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded text-[10px] line-through">{e.old_value || '—'}</span>
                    <span className="text-muted">→</span>
                    <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px]">{e.new_value || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Past Promos section */}
          {groupedPast.length > 0 && (
            <div className="mt-8" ref={pastSectionRef}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 bg-gray-300 text-gray-600 px-3 py-1 rounded-full">
                  <span className="text-[11px] font-mono font-bold tracking-wider">Past Promos</span>
                  <span className="text-[10px] opacity-60">·</span>
                  <span className="text-[10px] font-mono opacity-70">{pastRows.length} promo{pastRows.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-6 opacity-60">
                {groupedPast.map(({ date, items }) => (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2 bg-gray-400 text-white px-3 py-1 rounded-full">
                        <span className="text-[11px] font-mono font-bold tracking-wider">
                          {date ? fmtDate(date) : 'No Date'}
                        </span>
                        <span className="text-[10px] opacity-60">·</span>
                        <span className="text-[10px] font-mono opacity-70">{items.length} promo{items.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="space-y-2">
                      {items.map(r => (
                        <PromoRow key={r.id} row={r}
                          expanded={expandedId === r.id}
                          onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                          onPatch={patch} updating={updatingId === r.id}
                          isAdmin={isAdmin}
                          allRows={rows}
                          userEmail={user?.email} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
