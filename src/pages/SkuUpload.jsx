import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { exportCSV, STORE_OPTIONS, fmtDate } from '../lib/constants.jsx'
import * as XLSX from 'xlsx'
import {
  Download, Upload, Loader2, CheckCircle, AlertCircle,
  Search, Trash2, ExternalLink, RefreshCw, FileSpreadsheet,
} from 'lucide-react'

// ─── Template definitions ─────────────────────────────────────────────────────
const PROMO_HEADERS    = ['Barcode', 'SKU Name', 'Brand Name', 'MRP', 'Discount %', 'Offer Price', 'Store (optional)']
const RSP_HEADERS      = ['Barcode', 'SKU Name', 'Brand Name', 'MRP', 'RSP / New Selling Price', 'Store (optional)']

function downloadTemplate(type) {
  const headers = type === 'promotion' ? PROMO_HEADERS : RSP_HEADERS
  const example = type === 'promotion'
    ? [['8901234567890', 'MamaEarth Onion Shampoo 250ml', 'MamaEarth', '399', '20', '319', 'VK, Delhi']]
    : [['8901234567890', 'Aqualogica Sunscreen SPF50 50g', 'Aqualogica', '599', '499', 'BH, Hyderabad']]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...example])

  // Column widths
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 18) }))

  XLSX.utils.book_append_sheet(wb, ws, type === 'promotion' ? 'Promotion SKUs' : 'RSP Update SKUs')
  XLSX.writeFile(wb, `template-${type === 'promotion' ? 'promotion' : 'rsp-update'}.xlsx`)
}

export default function SkuUpload() {
  const [promos, setPromos] = useState([])      // for the promo selector
  const [skus, setSkus] = useState([])          // master SKU table
  const [loadingSkus, setLoadingSkus] = useState(true)

  // Upload state
  const [selectedPromo, setSelectedPromo] = useState('')
  const [offerType, setOfferType] = useState('promotion') // 'promotion' | 'rsp'
  const [parsedRows, setParsedRows] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null) // { type, text }
  const fileRef = useRef()

  // Filter state
  const [search, setSearch] = useState('')
  const [fBrand, setFBrand] = useState('')
  const [fPromo, setFPromo] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoadingSkus(true)
    const [{ data: promoData }, { data: skuData }] = await Promise.all([
      supabase.from('promo_requests').select('id, promo_request_id, brand_names, offer_type').order('created_at', { ascending: false }),
      supabase.from('sku_items').select('*').order('created_at', { ascending: false }),
    ])
    setPromos(promoData || [])
    setSkus(skuData || [])
    setLoadingSkus(false)
  }

  // ── Parse uploaded file ───────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadMsg(null)
    setParsedRows([])

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (!data.length) { setUploadMsg({ type: 'err', text: 'File is empty.' }); return }
        setParsedRows(data)
        setUploadMsg({ type: 'ok', text: `${data.length} rows parsed. Review below and click Upload.` })
      } catch (err) {
        setUploadMsg({ type: 'err', text: 'Could not read file. Make sure it is .xlsx or .csv.' })
      }
    }
    reader.readAsBinaryString(file)
  }

  // ── Upload to Supabase ────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedPromo || !parsedRows.length) return
    setUploading(true)
    setUploadMsg(null)

    const promo = promos.find(p => p.id === selectedPromo)

    const rows = parsedRows.map(r => ({
      promo_id: selectedPromo,
      promo_request_id: promo?.promo_request_id || '',
      brand_name: r['Brand Name'] || r['brand_name'] || '',
      barcode: String(r['Barcode'] || r['barcode'] || '').trim(),
      sku_name: r['SKU Name'] || r['sku_name'] || '',
      mrp: parseFloat(r['MRP'] || r['mrp']) || null,
      discount_pct: offerType === 'promotion' ? (parseFloat(r['Discount %'] || r['discount_pct']) || null) : null,
      offer_price: offerType === 'promotion' ? (parseFloat(r['Offer Price'] || r['offer_price']) || null) : null,
      rsp: offerType === 'rsp' ? (parseFloat(r['RSP / New Selling Price'] || r['rsp']) || null) : null,
      store: r['Store (optional)'] || r['store'] || '',
      offer_type: offerType,
    }))

    const { error } = await supabase.from('sku_items').insert(rows)
    setUploading(false)

    if (error) {
      setUploadMsg({ type: 'err', text: error.message })
    } else {
      setUploadMsg({ type: 'ok', text: `${rows.length} SKUs uploaded successfully!` })
      setParsedRows([])
      if (fileRef.current) fileRef.current.value = ''
      loadData()
    }
  }

  // ── Delete all SKUs for a promo ───────────────────────────────────────────
  const deletePromoSkus = async (promoId) => {
    if (!confirm('Delete all SKUs for this promo?')) return
    await supabase.from('sku_items').delete().eq('promo_id', promoId)
    loadData()
  }

  // ── Filtered master table ─────────────────────────────────────────────────
  const filteredSkus = skus.filter(s => {
    const q = search.toLowerCase()
    const matchQ = !q ||
      (s.barcode || '').includes(q) ||
      (s.sku_name || '').toLowerCase().includes(q) ||
      (s.brand_name || '').toLowerCase().includes(q)
    return matchQ &&
      (!fBrand || (s.brand_name || '').toLowerCase().includes(fBrand.toLowerCase())) &&
      (!fPromo || s.promo_request_id === fPromo)
  })

  const allBrands = [...new Set(skus.map(s => s.brand_name).filter(Boolean))].sort()
  const allPromoIds = [...new Set(skus.map(s => s.promo_request_id).filter(Boolean))].sort()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 fade-in">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">SKU / Barcode Manager</h1>
          <p className="text-muted text-sm font-body mt-0.5">Upload SKU sheets per promo · View master barcode table</p>
        </div>
        <button onClick={loadData} className="p-2 bg-white border border-border rounded-lg hover:bg-paper">
          <RefreshCw size={14} className="text-muted" />
        </button>
      </div>

      {/* ── Template downloads ── */}
      <div className="bg-white border border-border rounded-xl p-5 mb-6">
        <p className="text-[11px] font-mono uppercase tracking-widest text-muted mb-3">Step 1 — Download the right template</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TemplateCard
            title="Promotion Template"
            desc="For % off promos (e.g. Flat 20% off)"
            cols="Barcode, SKU Name, Brand Name, MRP, Discount %, Offer Price, Store"
            onDownload={() => downloadTemplate('promotion')}
          />
          <TemplateCard
            title="RSP Update Template"
            desc="For fixed selling price updates"
            cols="Barcode, SKU Name, Brand Name, MRP, RSP / New Selling Price, Store"
            onDownload={() => downloadTemplate('rsp')}
          />
        </div>
      </div>

      {/* ── Upload form ── */}
      <div className="bg-white border border-border rounded-xl p-5 mb-8">
        <p className="text-[11px] font-mono uppercase tracking-widest text-muted mb-4">Step 2 — Upload filled template</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-ink mb-1.5">Link to Promo <span className="text-accent">*</span></label>
            <select className="input-field" value={selectedPromo} onChange={e => setSelectedPromo(e.target.value)}>
              <option value="">Select promo…</option>
              {promos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.promo_request_id} — {p.brand_names}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1.5">Offer Type <span className="text-accent">*</span></label>
            <div className="flex gap-2">
              {[['promotion', 'Promotion (% off)'], ['rsp', 'RSP Update']].map(([val, label]) => (
                <button key={val} type="button"
                  onClick={() => setOfferType(val)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-body border transition-colors ${
                    offerType === val ? 'bg-ink text-white border-ink' : 'bg-white text-muted border-border hover:border-ink hover:text-ink'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink mb-1.5">Upload File (.xlsx or .csv)</label>
          <label className="flex items-center gap-3 bg-paper border-2 border-dashed border-border rounded-lg px-4 py-5 cursor-pointer hover:border-accent transition-colors">
            <FileSpreadsheet size={20} className="text-muted" />
            <div>
              <p className="text-sm font-body text-ink">Click to choose file</p>
              <p className="text-[11px] text-muted mt-0.5">Excel (.xlsx) or CSV — use the template above</p>
            </div>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" ref={fileRef} onChange={handleFile} />
          </label>
        </div>

        {uploadMsg && (
          <div className={`mt-3 flex items-center gap-2 text-sm px-4 py-3 rounded-lg border ${
            uploadMsg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-success'
              : 'bg-red-50 border-red-200 text-danger'
          }`}>
            {uploadMsg.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {uploadMsg.text}
          </div>
        )}

        {/* Preview table */}
        {parsedRows.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-ink mb-2">Preview (first 5 rows)</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-xs font-body">
                <thead className="bg-paper border-b border-border">
                  <tr>{Object.keys(parsedRows[0]).map(h => <th key={h} className="px-3 py-2 text-left font-mono text-muted uppercase tracking-wide text-[10px]">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-paper/50">
                      {Object.values(row).map((v, j) => <td key={j} className="px-3 py-2 text-ink">{String(v)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={handleUpload}
                disabled={uploading || !selectedPromo}
                className="flex items-center gap-2 bg-accent text-white text-sm font-body px-5 py-2.5 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors">
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {uploading ? 'Uploading…' : `Upload ${parsedRows.length} rows`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Master SKU table ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-xl text-ink">
            Master Barcode Table
            <span className="font-mono text-sm text-muted font-normal ml-2">({filteredSkus.length} SKUs)</span>
          </h2>
          <button onClick={() => exportCSV(filteredSkus, `sku-master-export.csv`)}
            disabled={!filteredSkus.length}
            className="flex items-center gap-1.5 bg-ink text-white text-xs font-body px-3 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors">
            <Download size={12} /> Export CSV
          </button>
        </div>

        {/* Table filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="w-full bg-white border border-border rounded-lg pl-8 pr-3 py-2 text-sm font-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              placeholder="Search barcode, SKU name, brand…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none sm:w-44"
            value={fBrand} onChange={e => setFBrand(e.target.value)}>
            <option value="">All Brands</option>
            {allBrands.map(b => <option key={b}>{b}</option>)}
          </select>
          <select className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none sm:w-36"
            value={fPromo} onChange={e => setFPromo(e.target.value)}>
            <option value="">All Promos</option>
            {allPromoIds.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>

        {loadingSkus ? (
          <div className="flex justify-center items-center h-32 gap-2 text-muted">
            <Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading…</span>
          </div>
        ) : filteredSkus.length === 0 ? (
          <div className="text-center py-16 text-muted border border-dashed border-border rounded-xl">
            <FileSpreadsheet size={26} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No SKUs uploaded yet. Use the form above to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-white">
            <table className="min-w-full text-sm font-body">
              <thead className="bg-paper border-b border-border">
                <tr>
                  {['Promo ID', 'Barcode', 'SKU Name', 'Brand', 'MRP', 'Discount %', 'Offer Price', 'RSP', 'Store', 'Type', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-mono uppercase tracking-widest text-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSkus.map((s, i) => (
                  <tr key={s.id || i} className="border-b border-border last:border-0 hover:bg-paper/40 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-xs text-muted">{s.promo_request_id}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{s.barcode}</td>
                    <td className="px-3 py-2.5 max-w-[200px] truncate">{s.sku_name}</td>
                    <td className="px-3 py-2.5">{s.brand_name}</td>
                    <td className="px-3 py-2.5 font-mono">₹{s.mrp}</td>
                    <td className="px-3 py-2.5 font-mono">{s.discount_pct != null ? `${s.discount_pct}%` : '—'}</td>
                    <td className="px-3 py-2.5 font-mono">{s.offer_price != null ? `₹${s.offer_price}` : '—'}</td>
                    <td className="px-3 py-2.5 font-mono">{s.rsp != null ? `₹${s.rsp}` : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-muted">{s.store || 'All'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        s.offer_type === 'promotion'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-teal-50 text-teal-700 border-teal-200'
                      }`}>
                        {s.offer_type === 'promotion' ? 'Promo' : 'RSP'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => deletePromoSkus(s.promo_id)} className="text-muted hover:text-danger transition-colors" title="Delete all SKUs for this promo">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function TemplateCard({ title, desc, cols, onDownload }) {
  return (
    <div className="border border-border rounded-lg p-4 flex items-start justify-between gap-3">
      <div>
        <p className="font-display font-semibold text-sm text-ink">{title}</p>
        <p className="text-xs text-muted mt-0.5">{desc}</p>
        <p className="text-[11px] font-mono text-muted mt-2 bg-paper rounded px-2 py-1">{cols}</p>
      </div>
      <button onClick={onDownload}
        className="flex items-center gap-1.5 bg-ink text-white text-xs font-body px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap shrink-0">
        <Download size={12} /> Download
      </button>
    </div>
  )
}
