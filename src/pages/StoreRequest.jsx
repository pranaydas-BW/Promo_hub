import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { todayISO } from '../lib/constants.jsx'
import { CheckCircle, AlertCircle, Loader2, Store, ChevronDown } from 'lucide-react'

const CATEGORIES = [
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

const STORES = ['VK, Delhi', 'BH, Hyderabad', 'Pune']

const BLANK = {
  store: '',
  category: '',
  brand_names: '',
  assortment_type: 'All SKUs',
  sku_details: '',
  comment: '',
  notify_email: '',
}

export default function StoreRequest() {
  const [form, setForm] = useState({ ...BLANK })
  const [brands, setBrands] = useState([])
  const [brandsLoading, setBrandsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!form.category) { setBrands([]); return }
    setBrandsLoading(true)
    supabase.from('brands').select('brand_name').eq('category', form.category).order('brand_name')
      .then(({ data }) => {
        setBrands(data?.map(b => b.brand_name) || [])
        setBrandsLoading(false)
      })
  }, [form.category])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.store) { setError('Please select a store.'); return }
    if (!form.category) { setError('Please select a category.'); return }
    if (!form.brand_names) { setError('Please select a brand.'); return }
    if (!form.notify_email) { setError('Please enter a notification email.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.notify_email)) {
      setError('Please enter a valid email address.'); return
    }

    setLoading(true); setError(null)

    const payload = {
      store: form.store,
      category: form.category,
      brand_names: form.brand_names,
      assortment_type: form.assortment_type,
      sku_details: form.assortment_type === 'Selected SKUs' ? form.sku_details : null,
      comment: form.comment,
      notify_email: form.notify_email,
      requested_at: new Date().toISOString(),
      status: 'Pending',
    }

    const { error: err } = await supabase.from('store_requests').insert([payload])

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    // Send email via Supabase Edge Function (if configured) or just mark success
    // Email notification is handled server-side via Supabase triggers
    setLoading(false)
    setSuccess(true)
  }

  if (success) return (
    <div className="max-w-lg mx-auto mt-24 text-center px-4 fade-in">
      <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="text-success" size={32} />
      </div>
      <h2 className="font-display text-2xl font-bold text-ink mb-2">Request Submitted!</h2>
      <p className="text-muted font-body text-sm mb-6">
        Your promo request has been recorded. A notification has been sent to <span className="font-medium text-ink">{form.notify_email}</span>.
      </p>
      <button
        onClick={() => { setSuccess(false); setForm({ ...BLANK }) }}
        className="bg-accent text-white font-body font-medium px-6 py-2.5 rounded-lg hover:bg-orange-700 transition-colors text-sm">
        Submit Another Request
      </button>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto px-4 py-8 fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
          <Store size={18} className="text-accent" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Store Promo Request</h1>
          <p className="text-xs font-body text-muted mt-0.5">Request a promo for your store</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Store */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted">Store Details</p>

          <div>
            <label className="text-xs font-mono uppercase text-muted mb-1.5 block">Store <span className="text-accent">*</span></label>
            <div className="flex gap-2 flex-wrap">
              {STORES.map(s => (
                <button key={s} type="button"
                  onClick={() => set('store', s)}
                  className={`px-4 py-2 rounded-lg text-sm font-body border transition-colors ${
                    form.store === s
                      ? 'bg-ink text-white border-ink'
                      : 'bg-white text-muted border-border hover:text-ink hover:border-ink'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-mono uppercase text-muted mb-1.5 block">Category <span className="text-accent">*</span></label>
            <select
              className="w-full bg-paper border border-border rounded-lg px-3 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
              value={form.category}
              onChange={e => { set('category', e.target.value); set('brand_names', '') }}
              required>
              <option value="">Select category…</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Brand */}
          <div>
            <label className="text-xs font-mono uppercase text-muted mb-1.5 block">Brand <span className="text-accent">*</span></label>
            {!form.category ? (
              <div className="w-full bg-gray-50 border border-border rounded-lg px-3 py-2.5 text-sm font-body text-muted">
                Select a category first
              </div>
            ) : brandsLoading ? (
              <div className="w-full bg-gray-50 border border-border rounded-lg px-3 py-2.5 text-sm font-body text-muted flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" /> Loading brands…
              </div>
            ) : brands.length > 0 ? (
              <select
                className="w-full bg-paper border border-border rounded-lg px-3 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
                value={form.brand_names}
                onChange={e => set('brand_names', e.target.value)}
                required>
                <option value="">Select brand…</option>
                {brands.map(b => <option key={b}>{b}</option>)}
              </select>
            ) : (
              <input
                className="w-full bg-paper border border-border rounded-lg px-3 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="Type brand name…"
                value={form.brand_names}
                onChange={e => set('brand_names', e.target.value)}
              />
            )}
          </div>
        </div>

        {/* Assortment */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted">Promo Details</p>

          <div>
            <label className="text-xs font-mono uppercase text-muted mb-1.5 block">Assortment Type <span className="text-accent">*</span></label>
            <div className="flex gap-3">
              {['All SKUs', 'Selected SKUs'].map(opt => (
                <label key={opt} className={`flex-1 flex items-center justify-center gap-2 border-2 rounded-lg px-4 py-2.5 cursor-pointer transition-all text-sm font-body font-medium ${
                  form.assortment_type === opt
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-border bg-white text-muted hover:border-ink/40'
                }`}>
                  <input type="radio" className="hidden"
                    checked={form.assortment_type === opt}
                    onChange={() => set('assortment_type', opt)} />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {/* SKU details — only for Selected SKUs */}
          {form.assortment_type === 'Selected SKUs' && (
            <div>
              <label className="text-xs font-mono uppercase text-muted mb-1.5 block">SKU Details</label>
              <textarea
                className="w-full bg-paper border border-border rounded-lg px-3 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
                rows={3}
                placeholder="List SKU names, barcodes, or describe the selection…"
                value={form.sku_details}
                onChange={e => set('sku_details', e.target.value)}
              />
            </div>
          )}

          {/* Comment */}
          <div>
            <label className="text-xs font-mono uppercase text-muted mb-1.5 block">Comment / Request Details</label>
            <textarea
              className="w-full bg-paper border border-border rounded-lg px-3 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
              rows={3}
              placeholder="Describe the promo you're requesting, any specific discount %, dates, etc…"
              value={form.comment}
              onChange={e => set('comment', e.target.value)}
            />
          </div>
        </div>

        {/* Notification */}
        <div className="bg-white border border-border rounded-xl p-5">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted mb-3">Notification</p>
          <div>
            <label className="text-xs font-mono uppercase text-muted mb-1.5 block">Send notification to <span className="text-accent">*</span></label>
            <input
              type="email"
              className="w-full bg-paper border border-border rounded-lg px-3 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20"
              placeholder="team@broadwaylive.in"
              value={form.notify_email}
              onChange={e => set('notify_email', e.target.value)}
            />
            <p className="text-[11px] text-muted mt-1.5">A notification email will be sent to this address when the request is submitted.</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-danger text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <div className="pb-8">
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-accent text-white font-body font-medium px-6 py-3 rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors text-sm">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Submitting…' : 'Submit Promo Request'}
          </button>
        </div>
      </form>
    </div>
  )
}
