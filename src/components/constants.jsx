export const CATEGORIES = [
  'Beauty and Personal Care',
  'Fashion (Fashion Accessories, Clothing, Jewellery)',
  'Footwear',
  'Health and Wellness',
  'Home & Living',
  'Electronics',
  'Food & Beverage',
  'Other',
]

export const OFFER_TYPES = [
  'Promotion (e.g. Flat 15% off / Buy 2 get 15% off)',
  'RSP Update (SKU level discount)',
]

export const FUNDED_BY_OPTIONS = ['Brand', 'Broadway', 'Both']

export const STATUS_OPTIONS = ['Pending', 'In Progress', 'Live', 'Expired', 'Rejected']

export const STATUS_STYLES = {
  Pending:     'bg-amber-50 text-amber-700 border border-amber-200',
  'In Progress': 'bg-blue-50 text-blue-700 border border-blue-200',
  Live:        'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Expired:     'bg-gray-100 text-gray-500 border border-gray-200',
  Rejected:    'bg-red-50 text-red-700 border border-red-200',
}

export function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES['Pending']
  return (
    <span className={`status-badge ${style}`}>
      {status}
    </span>
  )
}
