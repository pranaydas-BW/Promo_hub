import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { CATEGORIES } from '../lib/constants.jsx'
import { Plus, Trash2, Upload, Download, Search, Loader2, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react'

function downloadTemplate() {
  const csv = ['Brand Name,Category', 'MamaEarth,Beauty and Personal Care', 'Adidas,Footwear'].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'brand-template.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function BrandDatabase() {
  const { isAdmin } = useAuth()
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')

  // Add form
  const [newName, setNewName] = useState('')
  const [newCat, setNewCat] = useState('')
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState(null)

  // CSV upload
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [preview, setPreview] = useState([])

  useEffect(() => { loadBrands() }, [])

  const loadBrands = async () => {
    setLoading(true)
    const { data } = await supabase.from('brands').select('*').order('brand_name')
    setBrands(data || [])
    setLoading(false)
  }

  // ── Add single brand ──────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!newName.trim() || !newCat) return
    setAdding(true); setAddMsg(null)
    const { error } = await supabase.from('brands').insert([{
      brand_name: newName.trim(),
      category: newCat,
    }])
    setAdding(false)
    if (error) {
      setAddMsg({ type: 'err', text: error.code === '23505' ? `"${newName}" already exists.` : error.message })
    } else {
      setAddMsg({ type: 'ok', text: `"${newName}" added successfully.` })
      setNewName(''); setNewCat('')
      loadBrands()
    }
  }

  // ── Parse CSV ─────────────────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadMsg(null); setPreview([])
    const reader = new FileReader()
    reader.onload = (evt) => {
      const lines = evt.target.result.split('\n').filter(l => l.trim())
      const rows = lines.slice(1).map(line => {
        const parts = line.split(',')
        return {
          brand_name: parts[0]?.trim().replace(/^"|"$/g, ''),
          category: parts[1]?.trim().replace(/^"|"$/g, ''),
        }
      }).filter(r => r.brand_name && r.category)
      setPreview(rows)
      setUploadMsg({ type: 'ok', text: `${rows.length} brands ready to upload. Review and confirm.` })
    }
    reader.readAsText(file)
  }

  const handleBulkUpload = async () => {
    if (!preview.length) return
    setUploading(true); setUploadMsg(null)
    const { error } = await supabase.from('brands').upsert(
      preview.map(r => ({ brand_name: r.brand_name, category: r.category })),
      { onConflict: 'brand_name' }
    )
    setUploading(false)
    if (error) {
      setUploadMsg({ type: 'err', text: error.message })
    } else {
      setUploadMsg({ type: 'ok', text: `${preview.length} brands uploaded successfully!` })
      setPreview([])
      loadBrands()
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return
    await supabase.from('brands').delete().eq('id', id)
    setBrands(b => b.filter(x => x.id !== id))
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = brands.filter(b => {
    const q = search.toLowerCase()
    return (!q || b.brand_name.toLowerCase().includes(q)) &&
      (!filterCat || b.category === filterCat)
  })

  const allCats = [...new Set(brands.map(b => b.category))].sort()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Brand Database</h1>
        <p className="text-muted text-sm font-body mt-0.5">
          {brands.length} brands · {isAdmin ? 'You can add and remove brands' : 'Read only'}
        </p>
      </div>

      {isAdmin && (
        <>
          {/* ── Add single brand ── */}
          <div className="bg-white border border-border rounded-xl p-5 mb-5">
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted mb-3">Add New Brand</p>
            <div className="flex gap-3 flex-wrap">
              <input
                className="flex-1 min-w-[200px] bg-paper border border-border rounded-lg px-3.5 py-2.5 text-sm font-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                placeholder="Brand name"
                value={newName}
                onChange={e => { setNewName(e.target.value); setAddMsg(null) }}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <select
                className="bg-paper border border-border rounded-lg px-3.5 py-2.5 text-sm font-body text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent min-w-[200px]"
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
              >
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <button
                onClick={handleAdd}
                disabled={adding || !newName.trim() || !newCat}
                className="flex items-center gap-1.5 bg-accent text-white text-sm font-body px-4 py-2.5 rounded-lg hover:bg-orange-700 disabled:opacity-40 transition-colors"
              >
                {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Add Brand
              </button>
            </div>
            {addMsg && (
              <p className={`text-xs mt-2 flex items-center gap-1.5 ${addMsg.type === 'ok' ? 'text-success' : 'text-danger'}`}>
                {addMsg.type === 'ok' ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                {addMsg.text}
              </p>
            )}
          </div>

          {/* ── Bulk CSV upload ── */}
          <div className="bg-white border border-border rounded-xl p-5 mb-5">
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted mb-3">Bulk Upload via CSV</p>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 bg-paper border-2 border-dashed border-border rounded-lg px-4 py-3 cursor-pointer hover:border-accent transition-colors flex-1 min-w-[200px]">
                <FileSpreadsheet size={16} className="text-muted" />
                <span className="text-sm font-body text-muted">Click to choose CSV file</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
              </label>
              <button onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-sm font-body text-ink border border-border bg-white px-4 py-3 rounded-lg hover:bg-paper transition-colors">
                <Download size={13} /> Download Template
              </button>
            </div>

            {uploadMsg && (
              <p className={`text-xs mt-2 flex items-center gap-1.5 ${uploadMsg.type === 'ok' ? 'text-success' : 'text-danger'}`}>
                {uploadMsg.type === 'ok' ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                {uploadMsg.text}
              </p>
            )}

            {preview.length > 0 && (
              <div className="mt-3">
                <div className="overflow-x-auto rounded-lg border border-border max-h-48 overflow-y-auto">
                  <table className="min-w-full text-xs font-body">
                    <thead className="bg-paper border-b border-border sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-mono text-muted uppercase text-[10px]">Brand Name</th>
                        <th className="px-3 py-2 text-left font-mono text-muted uppercase text-[10px]">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 text-ink">{r.brand_name}</td>
                          <td className="px-3 py-2 text-muted">{r.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={handleBulkUpload} disabled={uploading}
                  className="mt-3 flex items-center gap-1.5 bg-ink text-white text-sm font-body px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {uploading ? 'Uploading…' : `Upload ${preview.length} brands`}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Brand list ── */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-paper flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="w-full bg-white border border-border rounded-lg pl-8 pr-3 py-2 text-sm font-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
              placeholder="Search brands…"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none sm:w-52"
            value={filterCat} onChange={e => setFilterCat(e.target.value)}
          >
            <option value="">All Categories</option>
            {allCats.map(c => <option key={c}>{c}</option>)}
          </select>
          <span className="font-mono text-xs text-muted">{filtered.length} brands</span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-32 gap-2 text-muted">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted">
            <p className="text-sm">No brands found. {isAdmin && 'Add one above!'}</p>
          </div>
        ) : (
          <table className="min-w-full text-sm font-body">
            <thead className="bg-paper border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Brand Name</th>
                <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Category</th>
                <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Added</th>
                {isAdmin && <th className="px-4 py-3 w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-paper/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-ink">{b.brand_name}</td>
                  <td className="px-4 py-3 text-muted">{b.category}</td>
                  <td className="px-4 py-3 text-muted text-xs font-mono">
                    {new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(b.id, b.brand_name)}
                        className="text-muted hover:text-danger transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
