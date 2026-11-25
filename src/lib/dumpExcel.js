// Download daily files = the same four tabs the Google Sheet export produces (no Store/Cat summary tabs).
// The Apps Script saves each tab into the `export_dump` table in chunks; this turns the chunks back into an Excel file.
import * as XLSX from 'xlsx'

export const DUMP_TABS = ['Brand Level Promotion', 'Brand Level RSP', 'SKU Level Promotion', 'SKU Level RSP']
export const PAGE_PARTS = 8 // chunks fetched per request (each chunk is up to 2,000 rows)

// Chunks of one tab (any order) -> { headers, rows }
export function assembleTab(chunks) {
  const sorted = [...(chunks || [])].sort((a, b) => a.part - b.part)
  const headers = (sorted[0] && sorted[0].headers) || []
  const rows = []
  for (const c of sorted) for (const r of (c.rows || [])) rows.push(r)
  return { headers, rows }
}

// { tabName: { headers, rows } } -> workbook with the four tabs, in the sheet's order
export function buildWorkbook(byTab) {
  const wb = XLSX.utils.book_new()
  for (const name of DUMP_TABS) {
    const t = byTab[name] || { headers: [], rows: [] }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([t.headers, ...t.rows]), name)
  }
  return wb
}

export function saveWorkbook(wb, filename) { XLSX.writeFile(wb, filename) }

// chunk metadata -> { tabName: { total, updated, parts } } (newest save of each tab)
export function summariseMeta(metaRows) {
  const out = {}
  for (const m of metaRows || []) {
    const o = out[m.tab] || (out[m.tab] = { total: 0, updated: '', parts: 0 })
    o.parts += 1
    if (!o.updated || m.updated_at > o.updated) { o.updated = m.updated_at; o.total = m.total_rows }
  }
  return out
}
