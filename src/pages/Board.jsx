import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  StatusBadge, CurrentStatusDot,
  STATUS_OPTIONS, CURRENT_STATUS_OPTIONS, SHOPIFY_STATUS_OPTIONS,
  CATEGORIES, STATUS_STYLES, fmtDate, exportCSV,
} from '../lib/constants.jsx'
import { Search, RefreshCw, Plus, ChevronDown, ExternalLink, Loader2, Filter, Download, RotateCcw } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

// Get the earliest start date from date_ranges
function getStartDate(r) {
  const ranges = Array.isArray(r.date_ranges) ? r.date_ranges : []
  const dates = ranges.map(dr => dr.from).filter(Boolean).sort()
  return dates[0] || r.date_of_entry || r.created_at?.split('T')[0] || ''
}

// Group rows by start date, sorted ascending
function groupByStartDate(rows) {
  const groups = {}
  rows.forEach(r => {
    const d = getStartDate(r)
    if (!groups[d]) groups[d] = []
    groups[d].push(r)
  })
  // Sort groups by date ascending, within each group keep submission order (already ordered by created_at desc from query)
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }))
}

export default function Board() {
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('All')
  const [fCategory, setFCategory] = useState('All')
  const [fCurrent, setFCurrent] = useState('All')
  const [expandedId, setExpandedId] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('promo_requests').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows])

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
      (fCurrent === 'All' || r.current_status === fCurrent)
  })

  // #5 — group filtered rows by start date
  const groupedRows = groupByStartDate(filtered)

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
                offline_online: r.offline_online || '',
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
                    allRows={rows} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PromoRow({ row: r, expanded, onToggle, onPatch, updating, isAdmin, allRows }) {
  const ranges = Array.isArray(r.date_ranges) ? r.date_ranges : []
  const first = ranges[0] || {}

  // #3 — detect RSP reversal entries
  const isRSPReversal = r.offer_type === 'RSP Update' && r.is_reversal === true

  // #3 — execution date is the start date of reversal
  const reversalExecutionDate = isRSPReversal
    ? (ranges[0]?.from || '')
    : null

  const today = new Date().toISOString().split('T')[0]
  const reversalIsUpcoming = reversalExecutionDate && reversalExecutionDate > today
  const reversalIsDue = reversalExecutionDate && reversalExecutionDate <= today

  return (
    <div className={`bg-white border rounded-xl transition-all ${
      isRSPReversal
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
          <CurrentStatusDot status={r.current_status} />
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
              ['Funded By', r.funded_by],
              ['Assortment Type', r.assortment_type],
              ['Offline / Online', r.offline_online],
              ['Store', r.store],
              ['Broadway Discount %', r.broadway_discount_pct || r.broadway_discount_both],
              ['Brand Discount %', r.brand_discount_pct || r.brand_discount_both],
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
                {r.sku_file_link && <ELink href={r.sku_file_link} label="SKU File" />}
                {r.sku_file_name && r.sku_file_data && (
                  <button
                    onClick={() => downloadCsvFromData(r.sku_file_name, r.sku_file_data)}
                    className="flex items-center gap-1.5 text-xs font-body text-accent hover:underline">
                    <Download size={11} /> {r.sku_file_name}
                  </button>
                )}
                {r.rsp_file_link && <ELink href={r.rsp_file_link} label="RSP File" />}
                {r.rsp_file_name && r.rsp_file_data && (
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

function StatusPanel({ row: r, onPatch, updating, allRows }) {
  const [draft, setDraft] = useState({
    status: r.status || '',
    current_status: r.current_status || '',
    shopify_promo_status: r.shopify_promo_status || '',
    ginesys_promo_id: r.ginesys_promo_id || '',
    shopify_discount_id: r.shopify_discount_id || '',
    remark: r.remark || '',
  })
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState({})

  const isDirty =
    draft.status !== (r.status || '') ||
    draft.current_status !== (r.current_status || '') ||
    draft.shopify_promo_status !== (r.shopify_promo_status || '') ||
    draft.ginesys_promo_id !== (r.ginesys_promo_id || '') ||
    draft.shopify_discount_id !== (r.shopify_discount_id || '') ||
    draft.remark !== (r.remark || '')

  const myRanges = Array.isArray(r.date_ranges) ? r.date_ranges : []
  const overlapping = allRows.filter(other => {
    if (other.id === r.id) return false
    if (other.brand_names !== r.brand_names) return false
    const otherRanges = Array.isArray(other.date_ranges) ? other.date_ranges : []
    return myRanges.some(myR =>
      otherRanges.some(otR =>
        myR.from <= otR.till && myR.till >= otR.from
      )
    )
  })

  const validate = () => {
    const errs = {}
    if (draft.status === 'Promo Created - System' && !draft.ginesys_promo_id.trim()) {
      errs.ginesys = 'Ginesys Promo ID is required when status is "Promo Created - System"'
    }
    if (draft.shopify_promo_status === 'Promo Created in Shopify' && !draft.shopify_discount_id.trim()) {
      errs.shopify = 'Shopify Promo ID is required when Shopify status is "Promo Created in Shopify"'
    }
    return errs
  }

  const handleSave = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    await onPatch(r.id, draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setDraft({
      status: r.status || '',
      current_status: r.current_status || '',
      shopify_promo_status: r.shopify_promo_status || '',
      ginesys_promo_id: r.ginesys_promo_id || '',
      shopify_discount_id: r.shopify_discount_id || '',
      remark: r.remark || '',
    })
    setErrors({})
  }

  return (
    <div className="bg-paper rounded-lg p-4 border border-border space-y-4">
      <p className="text-[11px] font-mono uppercase tracking-widest text-muted">Update Status</p>

      {overlapping.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-display font-semibold text-warning mb-2">
            ⚠️ {overlapping.length} overlapping promo{overlapping.length > 1 ? 's' : ''} found for this date range
          </p>
          <div className="space-y-1">
            {overlapping.slice(0, 3).map(o => {
              const ranges = Array.isArray(o.date_ranges) ? o.date_ranges : []
              const first = ranges[0] || {}
              return (
                <p key={o.id} className="text-[11px] font-body text-amber-700">
                  <span className="font-mono font-bold">{o.promo_request_id}</span>
                  {' · '}{o.brand_names}
                  {o.promotion_name ? ` · ${o.promotion_name}` : ''}
                  {first.from ? ` · ${first.from} → ${first.till}` : ''}
                  {' · '}<span className="italic">{o.status}</span>
                </p>
              )
            })}
            {overlapping.length > 3 && <p className="text-[11px] text-muted">+{overlapping.length - 3} more</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          ['Status', 'status', STATUS_OPTIONS],
          ['Current Status', 'current_status', CURRENT_STATUS_OPTIONS],
          ['Shopify Promo Status', 'shopify_promo_status', ['', ...SHOPIFY_STATUS_OPTIONS]],
        ].map(([label, key, opts]) => (
          <div key={key}>
            <label className="text-[10px] font-mono uppercase text-muted mb-1 block">{label}</label>
            <select
              disabled={updating}
              value={draft[key]}
              onChange={e => { setDraft(d => ({ ...d, [key]: e.target.value })); setErrors(ev => ({ ...ev, [key]: undefined })) }}
              className={`w-full bg-white border rounded-lg px-2.5 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 transition-colors ${
                draft[key] !== (r[key] || '') ? 'border-accent' : 'border-border'
              }`}>
              {opts.map(s => <option key={s} value={s}>{s || '—'}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-mono uppercase text-muted mb-1 block">
            Ginesys Promo ID
            {draft.status === 'Promo Created - System' && <span className="text-accent ml-1">*</span>}
          </label>
          <input
            className={`w-full bg-white border rounded-lg px-2.5 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-accent/20 ${
              errors.ginesys ? 'border-danger' : draft.ginesys_promo_id !== (r.ginesys_promo_id || '') ? 'border-accent' : 'border-border'
            }`}
            placeholder="e.g. 001-00038"
            value={draft.ginesys_promo_id}
            onChange={e => { setDraft(d => ({ ...d, ginesys_promo_id: e.target.value })); setErrors(ev => ({ ...ev, ginesys: undefined })) }}
          />
          {errors.ginesys && <p className="text-danger text-[10px] mt-1">{errors.ginesys}</p>}
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase text-muted mb-1 block">
            Shopify Promo ID
            {draft.shopify_promo_status === 'Promo Created in Shopify' && <span className="text-accent ml-1">*</span>}
          </label>
          <input
            className={`w-full bg-white border rounded-lg px-2.5 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-accent/20 ${
              errors.shopify ? 'border-danger' : draft.shopify_discount_id !== (r.shopify_discount_id || '') ? 'border-accent' : 'border-border'
            }`}
            placeholder="e.g. #456"
            value={draft.shopify_discount_id}
            onChange={e => { setDraft(d => ({ ...d, shopify_discount_id: e.target.value })); setErrors(ev => ({ ...ev, shopify: undefined })) }}
          />
          {errors.shopify && <p className="text-danger text-[10px] mt-1">{errors.shopify}</p>}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-mono uppercase text-muted mb-1 block">
          Comment / Remark
          <span className="text-muted ml-2 normal-case">{(draft.remark || '').length}/200</span>
        </label>
        <textarea
          className={`w-full bg-white border rounded-lg px-2.5 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none ${
            draft.remark !== (r.remark || '') ? 'border-accent' : 'border-border'
          }`}
          rows={2} maxLength={200}
          placeholder="Add a comment or note…"
          value={draft.remark}
          onChange={e => setDraft(d => ({ ...d, remark: e.target.value }))}
        />
      </div>

      <div className="flex gap-4 text-[10px] font-mono text-muted pt-1">
        {r.created_at && (
          <span>Requested: {new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        )}
        {r.updated_at && r.updated_at !== r.created_at && (
          <span>Updated: {new Date(r.updated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        {isDirty && (
          <>
            <button onClick={handleSave} disabled={updating}
              className="flex items-center gap-1.5 bg-accent text-white text-xs font-body px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors">
              {updating ? <Loader2 size={11} className="animate-spin" /> : null}
              {updating ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={handleReset} disabled={updating}
              className="text-xs font-body text-muted hover:text-ink transition-colors">
              Reset
            </button>
          </>
        )}
        {saved && !isDirty && (
          <p className="text-[11px] text-success flex items-center gap-1">✓ Saved successfully</p>
        )}
      </div>
    </div>
  )
}
