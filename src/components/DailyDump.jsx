import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Download, RefreshCw, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { DUMP_TABS, PAGE_PARTS, assembleTab, buildWorkbook, saveWorkbook, summariseMeta } from '../lib/dumpExcel'

const ROWS_PER_PAGE = 100
const LOAD_ORDER = ['Brand Level Promotion', 'Brand Level RSP', 'SKU Level RSP', 'SKU Level Promotion'] // small tabs first
const LONG_TEXT = new Set(['Promotion Name', 'Promo Details', 'SKU Name', 'Item Name'])
const MONO = new Set(['Barcode', 'Promo ID'])

const fmtUpdated = (iso) => iso
  ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
  : ''

async function fetchTab(tab) {
  const all = []
  for (let from = 0; ; from += PAGE_PARTS) {
    const { data, error } = await supabase.from('export_dump').select('part, headers, rows')
      .eq('tab', tab).order('part').range(from, from + PAGE_PARTS - 1)
    if (error) throw new Error(error.message)
    all.push(...(data || []))
    if (!data || data.length < PAGE_PARTS) break
  }
  return all
}

// rows of a tab that run in the chosen store (the "Store" column lists a promo's stores)
export function rowsForStore(tab, store) {
  if (!tab) return []
  const i = tab.headers.indexOf('Store')
  if (i < 0 || !store) return tab.rows
  return tab.rows.filter(r => String(r[i] == null ? '' : r[i]).includes(store))
}

export default function DailyDump({ store = '' }) {
  const [data, setData] = useState({})       // tab -> { headers, rows }
  const [meta, setMeta] = useState({})       // tab -> { total, updated }
  const [loading, setLoading] = useState({}) // tab -> true while its rows are being fetched
  const [metaLoaded, setMetaLoaded] = useState(false)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(() => Object.fromEntries(DUMP_TABS.map(t => [t, true])))
  const [page, setPage] = useState({})
  const [busy, setBusy] = useState(false)

  const loadAll = async () => {
    setErr('')
    const { data: m, error } = await supabase.from('export_dump').select('tab, part, total_rows, updated_at')
    if (error) { setErr('Could not read the export: ' + error.message); setMetaLoaded(true); return }
    const sum = summariseMeta(m || [])
    setMeta(sum)
    setMetaLoaded(true)
    for (const tab of LOAD_ORDER) {
      if (!sum[tab]) continue // nothing saved for this tab
      setLoading(l => ({ ...l, [tab]: true }))
      try {
        const t = assembleTab(await fetchTab(tab))
        setData(d => ({ ...d, [tab]: t }))
      } catch (e) { setErr(`Could not load ${tab}: ${e.message || e}`) }
      setLoading(l => ({ ...l, [tab]: false }))
    }
  }
  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage({}) }, [store])

  const filtered = useMemo(() => Object.fromEntries(DUMP_TABS.map(t => [t, rowsForStore(data[t], store)])), [data, store])
  const hasData = Object.keys(meta).length > 0
  const allLoaded = hasData && DUMP_TABS.every(t => !meta[t] || data[t])
  const latest = Object.values(meta).reduce((a, m) => (m.updated > a ? m.updated : a), '')
  const anyLoading = DUMP_TABS.some(t => loading[t])
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')

  const exportExcel = async (onlyStore) => {
    setBusy(true)
    await new Promise(r => setTimeout(r, 60)) // let the button state show before the heavy work
    try {
      const by = {}
      DUMP_TABS.forEach(t => { by[t] = data[t] ? { headers: data[t].headers, rows: onlyStore ? filtered[t] : data[t].rows } : { headers: [], rows: [] } })
      const slug = onlyStore ? '-' + store.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '-all-stores'
      saveWorkbook(buildWorkbook(by), `promo-export${slug}-${stamp}.xlsx`)
    } catch (e) { setErr('Download failed: ' + (e.message || e)) }
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-border rounded-xl px-4 py-3">
        <div className="text-xs font-body text-muted">
          {!metaLoaded ? 'Checking the latest export…' : hasData
            ? <>Same data as the <span className="text-ink font-medium">Broadway Promo Export</span> sheet · last updated <span className="text-ink font-medium">{fmtUpdated(latest)}</span> · refreshed about every 2 hours</>
            : 'No export has been saved here yet. It appears after the Google Sheet export runs.'}
        </div>
        <button onClick={loadAll} disabled={anyLoading}
          className="flex items-center gap-1.5 bg-white border border-border text-xs font-body font-medium px-3 py-1.5 rounded-lg hover:bg-paper disabled:opacity-50 transition-colors">
          {anyLoading ? <Loader2 size={13} className="animate-spin text-muted" /> : <RefreshCw size={13} className="text-muted" />}
          Refresh
        </button>
      </div>

      {err && <div className="text-xs font-body text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">{err}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-body text-muted">
          Showing promos running in <span className="text-ink font-medium">{store || 'all stores'}</span> — change store using the Store filter above
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportExcel(true)} disabled={!allLoaded || busy}
            className="flex items-center gap-1.5 bg-white border border-border text-sm font-body px-3 py-2 rounded-lg hover:bg-paper disabled:opacity-40 transition-colors">
            {busy ? <Loader2 size={14} className="animate-spin text-muted" /> : <Download size={14} className="text-muted" />} Download Excel
          </button>
          <button onClick={() => exportExcel(false)} disabled={!allLoaded || busy}
            className="flex items-center gap-1.5 bg-white border border-border text-xs font-body text-muted px-3 py-2 rounded-lg hover:bg-paper disabled:opacity-40 transition-colors">
            All stores
          </button>
        </div>
      </div>

      {/* One collapsible section per tab, with the Excel's columns */}
      {DUMP_TABS.map(tab => {
        const t = data[tab], rows = filtered[tab] || [], isOpen = open[tab]
        const pg = Math.min(page[tab] || 0, Math.max(0, Math.ceil(rows.length / ROWS_PER_PAGE) - 1))
        const slice = rows.slice(pg * ROWS_PER_PAGE, (pg + 1) * ROWS_PER_PAGE)
        return (
          <div key={tab} className="bg-white border border-border rounded-xl overflow-hidden">
            <button onClick={() => setOpen(o => ({ ...o, [tab]: !o[tab] }))}
              className="w-full flex items-center justify-between px-4 py-3 bg-paper hover:bg-paper/70 transition-colors">
              <span className="flex items-center gap-2 text-sm font-body font-medium text-ink">
                {isOpen ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
                {tab}
                <span className="text-xs text-muted font-normal">({t ? rows.length.toLocaleString('en-IN') : '…'})</span>
              </span>
              {meta[tab] && <span className="text-[11px] font-body text-muted font-normal">updated {fmtUpdated(meta[tab].updated)}</span>}
            </button>
            {isOpen && (
              loading[tab] || (!t && meta[tab] && !err) ? (
                <div className="flex justify-center items-center h-24 gap-2 text-muted">
                  <Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading…</span>
                </div>
              ) : !t ? (
                <div className="px-4 py-8 text-center text-sm text-muted">{meta[tab] ? 'Could not load this tab — see the message above.' : 'Nothing saved for this tab yet.'}</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-body">
                      <thead>
                        <tr className="bg-paper text-[11px] uppercase tracking-wide text-muted">
                          {t.headers.map(h => <th key={h} className="text-left px-4 py-2.5 whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {slice.map((r, i) => (
                          <tr key={i} className="border-t border-border">
                            {t.headers.map((h, c) => {
                              const v = r[c]
                              const empty = v === '' || v == null
                              return (
                                <td key={c} className={`px-4 py-2.5 ${LONG_TEXT.has(h) ? 'max-w-xs truncate' : 'whitespace-nowrap'} ${c === 2 && h === 'Brand' ? 'font-medium text-ink' : ''}`}
                                  title={LONG_TEXT.has(h) && !empty ? String(v) : undefined}>
                                  {empty ? <span className="text-muted">—</span> : MONO.has(h) ? <span className="font-mono text-xs text-ink">{String(v)}</span> : String(v)}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                        {!rows.length && (
                          <tr><td colSpan={t.headers.length || 1} className="px-4 py-8 text-center text-muted">No promos for {store || 'these filters'} in this tab.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > ROWS_PER_PAGE && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border text-xs font-body text-muted">
                      <span>Rows {(pg * ROWS_PER_PAGE + 1).toLocaleString('en-IN')}–{Math.min((pg + 1) * ROWS_PER_PAGE, rows.length).toLocaleString('en-IN')} of {rows.length.toLocaleString('en-IN')}</span>
                      <span className="flex items-center gap-2">
                        <button onClick={() => setPage(p => ({ ...p, [tab]: pg - 1 }))} disabled={pg === 0}
                          className="px-3 py-1 rounded-lg border border-border bg-white hover:bg-paper disabled:opacity-40">Previous</button>
                        <button onClick={() => setPage(p => ({ ...p, [tab]: pg + 1 }))} disabled={(pg + 1) * ROWS_PER_PAGE >= rows.length}
                          className="px-3 py-1 rounded-lg border border-border bg-white hover:bg-paper disabled:opacity-40">Next</button>
                      </span>
                    </div>
                  )}
                </>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}
