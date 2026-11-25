import { useState, useEffect, useMemo } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { fetchTab } from '../lib/dumpFetch'
import { assembleTab } from '../lib/dumpExcel'

// The two summary tables the Google Sheet export also builds (tabs "Store/Cat" and "Store/Cat/Brand"),
// saved by the Apps Script into export_dump as Data_StoreCat and Data_StoreCatBrand (first column = store).
const TAB_CAT = 'Data_StoreCat'
const TAB_BRAND = 'Data_StoreCatBrand'
const STORE_LABELS = ['Delhi', 'Hyderabad', 'Pune', 'Mumbai']
const ROWS_PER_PAGE = 100
const TEXT_COLS = new Set(['Cat', 'Brand', 'Store'])

const fmtUpdated = (iso) => iso
  ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
  : ''

function loadTable(chunks) {
  const t = assembleTab(chunks)
  const updated = (chunks || []).reduce((a, c) => (c.updated_at > a ? c.updated_at : a), '')
  return { ...t, updated }
}

function SummaryTable({ title, hint, table, store, paged }) {
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [store])
  const si = table.headers.indexOf('Store')
  const cols = table.headers.map((h, i) => ({ h, i })).filter(c => c.i !== si)
  const rows = useMemo(() => table.rows.filter(r => r[si] === store), [table, store, si])
  const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE))
  const pg = Math.min(page, pages - 1)
  const shown = paged ? rows.slice(pg * ROWS_PER_PAGE, (pg + 1) * ROWS_PER_PAGE) : rows
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-paper">
        <div className="text-sm font-body font-medium text-ink">{title} <span className="text-xs text-muted font-normal">({rows.length.toLocaleString('en-IN')})</span></div>
        {hint && <div className="text-[11px] font-body text-muted mt-0.5">{hint}</div>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="bg-paper text-[11px] uppercase tracking-wide text-muted border-t border-border">
              {cols.map(c => <th key={c.h} className={`px-4 py-2.5 whitespace-nowrap ${TEXT_COLS.has(c.h) || /^Active \(/.test(c.h) ? 'text-left' : 'text-right'}`}>{c.h}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, k) => (
              <tr key={k} className="border-t border-border">
                {cols.map(c => {
                  const v = r[c.i], num = typeof v === 'number'
                  return <td key={c.h} className={`px-4 py-2.5 whitespace-nowrap ${num ? 'text-right' : 'text-left'} ${c.h === 'Cat' || c.h === 'Brand' ? 'text-ink' : ''}`}>{v === '' || v == null ? <span className="text-muted">—</span> : num ? v.toLocaleString('en-IN') : String(v)}</td>
                })}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={cols.length || 1} className="px-4 py-8 text-center text-muted">No data for {store}.</td></tr>}
          </tbody>
        </table>
      </div>
      {paged && rows.length > ROWS_PER_PAGE && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border text-xs font-body text-muted">
          <span>Rows {(pg * ROWS_PER_PAGE + 1).toLocaleString('en-IN')}–{Math.min((pg + 1) * ROWS_PER_PAGE, rows.length).toLocaleString('en-IN')} of {rows.length.toLocaleString('en-IN')}</span>
          <span className="flex items-center gap-2">
            <button onClick={() => setPage(pg - 1)} disabled={pg === 0} className="px-3 py-1 rounded-lg border border-border bg-white hover:bg-paper disabled:opacity-40">Previous</button>
            <button onClick={() => setPage(pg + 1)} disabled={pg + 1 >= pages} className="px-3 py-1 rounded-lg border border-border bg-white hover:bg-paper disabled:opacity-40">Next</button>
          </span>
        </div>
      )}
    </div>
  )
}

export default function StoreAnalytics() {
  const [store, setStore] = useState(STORE_LABELS[0])
  const [cat, setCat] = useState(null)
  const [brand, setBrand] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true); setErr('')
    try {
      const [c, b] = await Promise.all([fetchTab(TAB_CAT), fetchTab(TAB_BRAND)])
      setCat(c.length ? loadTable(c) : null)
      setBrand(b.length ? loadTable(b) : null)
    } catch (e) { setErr('Could not load store analytics: ' + (e.message || e)) }
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updated = [cat && cat.updated, brand && brand.updated].filter(Boolean).sort().pop() || ''

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-ink">Store analytics</h2>
          <p className="text-xs font-body text-muted mt-1">
            Brands, offers and stock by category for one store. Offers live today or in the next 7 days · a brand is <span className="text-ink font-medium">active</span> when it has more than 20 units in stock in the store
            {updated && <> · updated <span className="text-ink font-medium">{fmtUpdated(updated)}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Store" value={store} onChange={e => setStore(e.target.value)}
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20">
            {STORE_LABELS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={load} disabled={loading} title="Reload"
            className="flex items-center gap-1.5 bg-white border border-border text-xs font-body font-medium px-3 py-2 rounded-lg hover:bg-paper disabled:opacity-50 transition-colors">
            {loading ? <Loader2 size={13} className="animate-spin text-muted" /> : <RefreshCw size={13} className="text-muted" />} Refresh
          </button>
        </div>
      </div>

      {err && <div className="text-xs font-body text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">{err}</div>}

      {loading && !cat ? (
        <div className="flex justify-center items-center h-32 gap-2 text-muted"><Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading…</span></div>
      ) : !cat && !brand && !err ? (
        <div className="text-sm font-body text-muted bg-white border border-border rounded-xl px-4 py-8 text-center">Nothing here yet. It appears after the next export run.</div>
      ) : (
        <>
          {cat && <SummaryTable title="By category" table={cat} store={store} />}
          {brand && <SummaryTable title="By category and brand" hint="Active = more than 20 units in stock in this store (all categories of the brand together)" table={brand} store={store} paged />}
        </>
      )}
    </div>
  )
}
