import { supabase } from './supabase'
import { PAGE_PARTS } from './dumpExcel'

// All saved chunks of one tab of the export (part, headers, rows, updated_at), a few chunks per request
export async function fetchTab(tab) {
  const all = []
  for (let from = 0; ; from += PAGE_PARTS) {
    const { data, error } = await supabase.from('export_dump').select('part, headers, rows, updated_at')
      .eq('tab', tab).order('part').range(from, from + PAGE_PARTS - 1)
    if (error) throw new Error(error.message)
    all.push(...(data || []))
    if (!data || data.length < PAGE_PARTS) break
  }
  return all
}
