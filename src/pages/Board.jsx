import { useState, useEffect, useCallback } from 'react'

import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  StatusBadge, CurrentStatusDot,
  STATUS_OPTIONS, CURRENT_STATUS_OPTIONS, SHOPIFY_STATUS_OPTIONS,
  CATEGORIES, STATUS_STYLES, fmtDate,
} from '../lib/constants'
import { Search, RefreshCw, Plus, ChevronDown, ExternalLink, Loader2, Filter } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

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
        <div className="space-y-2">
          {filtered.map(r => (
            <PromoRow key={r.id} row={r}
              expanded={expandedId === r.id}
              onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
              onPatch={patch} updating={updatingId === r.id}
              isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  )
}

function PromoRow({ row: r, expanded, onToggle, onPatch, updating, isAdmin }) {
  const ranges = Array.isArray(r.date_ranges) ? r.date_ranges : []
  const first = ranges[0] || {}

  return (
    <div className={`bg-white border rounded-xl transition-all ${expanded ? 'border-accent/40 shadow-sm' : 'border-border hover:shadow-sm'}`}>
      <button className="w-full text-left px-5 py-3.5 flex items-center gap-3 flex-wrap sm:flex-nowrap" onClick={onToggle}>
        <span className="font-mono text-[11px] text-muted shrink-0 w-12">{r.promo_request_id || '—'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-ink truncate">{r.brand_names}</p>
          <p className="text-[11px] text-muted truncate">{r.category}</p>
        </div>
        <div className="hidden lg:block flex-1 min-w-0">
          <p className="text-xs font-body text-ink truncate">{r.promotion_name || r.promo_details}</p>
        </div>
        <div className="hidden md:flex items-center gap-1 text-[11px] text-muted shrink-0 w-36">
          {first.from ? `${fmtDate(first.from)} → ${fmtDate(first.till)}` : '—'}
          {ranges.length > 1 && <span className="text-accent ml-1 font-mono">+{ranges.length - 1}</span>}
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
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">Date Ranges</p>
              <div className="flex flex-wrap gap-2">
                {ranges.map((dr, i) => (
                  <div key={i} className="bg-paper border border-border rounded-lg px-3 py-2 text-xs font-body">
                    <span className="font-medium">{fmtDate(dr.from)} → {fmtDate(dr.till)}</span>
                    {dr.stores?.length > 0 && <span className="text-muted ml-2">({dr.stores.join(', ')})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          <div className="flex flex-wrap gap-4">
            {r.approval_email && <ELink href={r.approval_email} label="Approval Email" />}
            {r.approval_email_alt && <ELink href={r.approval_email_alt} label="Approval (alt)" />}
            {r.rsp_file_link && <ELink href={r.rsp_file_link} label="RSP File" />}
            {r.sku_file_link && <ELink href={r.sku_file_link} label="SKU / Barcode File" />}
          </div>

          {r.remark && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm font-body text-amber-800">
              💬 {r.remark}
            </div>
          )}

          {/* Status update — admin only */}
          {isAdmin && (
            <StatusPanel row={r} onPatch={onPatch} updating={updating} />
          )}
        </div>
      )}
    </div>
  )
}

function ELink({ href, label }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="flex items-center gap-1.5 text-xs font-body text-accent hover:underline">
      <ExternalLink size={11} /> {label}
    </a>
  )
}

function StatusPanel({ row: r, onPatch, updating }) {
  const [draft, setDraft] = useState({
    status: r.status || '',
    current_status: r.current_status || '',
    shopify_promo_status: r.shopify_promo_status || '',
  })
  const [saved, setSaved] = useState(false)

  // Check if anything changed from the original
  const isDirty =
    draft.status !== (r.status || '') ||
    draft.current_status !== (r.current_status || '') ||
    draft.shopify_promo_status !== (r.shopify_promo_status || '')

  const handleSave = async () => {
    await onPatch(r.id, draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setDraft({
      status: r.status || '',
      current_status: r.current_status || '',
      shopify_promo_status: r.shopify_promo_status || '',
    })
  }

  return (
    <div className="bg-paper rounded-lg p-3 border border-border space-y-3">
      <p className="text-[11px] font-mono uppercase tracking-widest text-muted">Update Status</p>
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
              onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
              className={`w-full bg-white border rounded-lg px-2.5 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 transition-colors ${
                draft[key] !== (r[key] || '') ? 'border-accent' : 'border-border'
              }`}>
              {opts.map(s => <option key={s} value={s}>{s || '—'}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Action buttons — only show if something changed */}
      <div className="flex items-center gap-2 pt-1">
        {isDirty && (
          <>
            <button
              onClick={handleSave}
              disabled={updating}
              className="flex items-center gap-1.5 bg-accent text-white text-xs font-body px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors">
              {updating ? <Loader2 size={11} className="animate-spin" /> : null}
              {updating ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={handleReset}
              disabled={updating}
              className="text-xs font-body text-muted hover:text-ink transition-colors">
              Reset
            </button>
          </>
        )}
        {saved && !isDirty && (
          <p className="text-[11px] text-success flex items-center gap-1">
            ✓ Saved successfully
          </p>
        )}
      </div>
    </div>
  )
}
