import { useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function SkuReUpload({ row: r, onPatch }) {
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fileName = `promos/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
    const { error: uploadError } = await supabase.storage
      .from('promo-files').upload(fileName, file, { upsert: false })
    if (uploadError) { setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('promo-files').getPublicUrl(fileName)
    await onPatch(r.id, { sku_file_link: publicUrl, sku_file_name: file.name })
    setUploading(false)
    setDone(true)
  }

  if (done) return <span className="text-[11px] text-success">✓ SKU file uploaded</span>

  return (
    <label className={`flex items-center gap-1.5 text-xs font-body cursor-pointer px-2 py-1 rounded border transition-colors ${uploading ? 'text-muted border-border' : 'text-warning border-amber-200 bg-amber-50 hover:bg-amber-100'}`}>
      {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
      {uploading ? 'Uploading…' : `Re-upload SKU (${r.sku_file_name})`}
      <input type="file" accept=".csv" className="hidden" disabled={uploading} onChange={handleFile} />
    </label>
  )
}
