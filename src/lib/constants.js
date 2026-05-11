// ─── Dropdown options (matching your real sheet values) ───────────────────────

export const CATEGORIES = [
  'Beauty & Personal Care',
  'Clothing',
  'Electronics',
  'Footwear',
  'Gifting',
  'Health & Wellness',
  'Lifestyle',
  'Luggage',
  'Streetwear',
]

export const STORE_OPTIONS = ['VK, Delhi', 'BH, Hyderabad', 'Pune']

export const OFFER_TYPES = ['Promotion', 'RSP Update']

export const FUNDED_BY_OPTIONS = ['Brand', 'Broadway', 'Both']

export const ASSORTMENT_TYPES = ['All SKUs - Flat on All', 'Selected SKUs']

export const OFFLINE_ONLINE_OPTIONS = ['Both', 'Offline_Store', 'Online']

export const STATUS_OPTIONS = [
  'Pending',
  'Promo Creation in Progress',
  'Promo Created - System',
  'Selling Price Updated',
  'Deactivated',
  'Rejected',
]

export const CURRENT_STATUS_OPTIONS = ['Not Live', 'Active']

export const SHOPIFY_STATUS_OPTIONS = [
  'Promo Created in Shopify',
  'RSP Updated in Shopify',
  'Brand Not Live',
  'Item Not Live',
  'Expired',
  'Promo Deactivated',
]

// ─── Status colour maps ───────────────────────────────────────────────────────

export const STATUS_STYLES = {
  'Pending':                    'bg-amber-50 text-amber-700 border-amber-200',
  'Promo Creation in Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  'Promo Created - System':     'bg-purple-50 text-purple-700 border-purple-200',
  'Selling Price Updated':      'bg-teal-50 text-teal-700 border-teal-200',
  'Deactivated':                'bg-gray-100 text-gray-500 border-gray-200',
  'Rejected':                   'bg-red-50 text-red-700 border-red-200',
}

export const CURRENT_STATUS_STYLES = {
  'Active':   'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Not Live': 'bg-gray-100 text-gray-500 border-gray-200',
}

// ─── Reusable badge components ────────────────────────────────────────────────

export function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || 'bg-gray-100 text-gray-500 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wide border ${s}`}>
      {status || '—'}
    </span>
  )
}

export function CurrentStatusDot({ status }) {
  const s = CURRENT_STATUS_STYLES[status] || CURRENT_STATUS_STYLES['Not Live']
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border ${s}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'Active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      {status || 'Not Live'}
    </span>
  )
}

// ─── CSV export ───────────────────────────────────────────────────────────────

export function exportCSV(rows, filename) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = r[h] == null ? '' : String(r[h])
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function fmtDate(d) {
  if (!d) return '—'
  try {
    const [y, m, day] = d.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y.slice(2)}`
  } catch { return d }
}
