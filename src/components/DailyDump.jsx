import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Download, RefreshCw, Loader2 } from 'lucide-react'
import { DUMP_TABS, PAGE_PARTS, assembleTab, buildWorkbook, saveWorkbook, summariseMeta } from '../lib/dumpExcel'

const fmtUpdated = (iso) => iso
  ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
  : '—'

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

export default function DailyDump() {
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const loadMeta = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('export_dump').select('tab, part, total_rows, updated_at')
    if (error) setMsg('Could not read the export: ' + error.message)
    setMeta(summariseMeta(data || []))
    setLoading(false)
  }
  useEffect(() => { loadMeta() }, [])

  const download = async () => {
    setBusy(true); setMsg('')
    try {
      const byTab = {}
      for (const tab of DUMP_TABS) {
        setMsg(`Fetching ${tab}…`)
        byTab[tab] = assembleTab(await fetchTab(tab))
      }
      setMsg('Building the Excel file… (large files can take 20–30 seconds)')
      await new Promise(r => setTimeout(r, 60)) // let the message show before the heavy work
      saveWorkbook(buildWorkbook(byTab), `promo-export-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.xlsx`)
      setMsg('')
    } catch (e) {
      setMsg('Download failed: ' + (e.message || e))
    }
    setBusy(false)
  }

  const hasData = meta && Object.keys(meta).length > 0

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-xl px-4 py-3 text-xs font-body text-muted">
        The same data as the <span className="font-medium text-ink">Broadway Promo Export</span> Google Sheet: the four Brand Level and SKU Level tabs,
        with the same columns (stock for all four stores, creation date and hour). It is refreshed automatically about every 2 hours.
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-display font-bold text-ink">Latest export</span>
          <button onClick={loadMeta} disabled={loading || busy} title="Check for a newer export"
            className="p-1.5 rounded-lg border border-border text-muted hover:text-ink disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <table className="w-full text-xs font-body">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-4 py-2 font-medium">Tab</th>
              <th className="px-4 py-2 font-medium">Rows</th>
              <th className="px-4 py-2 font-medium">Updated (IST)</th>
            </tr>
          </thead>
          <tbody>
            {DUMP_TABS.map(tab => (
              <tr key={tab} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-ink">{tab}</td>
                <td className="px-4 py-2">{meta && meta[tab] ? meta[tab].total.toLocaleString('en-IN') : '—'}</td>
                <td className="px-4 py-2">{meta && meta[tab] ? fmtUpdated(meta[tab].updated) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && !hasData && (
        <div className="text-xs font-body text-muted bg-white border border-border rounded-xl px-4 py-3">
          No export has been saved here yet. It appears after the Google Sheet export runs.
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={download} disabled={busy || loading || !hasData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-body font-medium bg-ink text-white hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          Download Excel (4 tabs)
        </button>
        {msg && <span className="text-xs font-body text-muted">{msg}</span>}
      </div>
    </div>
  )
}
