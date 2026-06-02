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

const STORES = ['VK, Delhi', 'BH, Hyderabad', 'Pune', 'Mumbai']

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
  const [activeTab, setActiveTab] = useState('request')
  const [pastRequests, setPastRequests] = useState([])
  const [pastLoading, setPastLoading] = useState(true)
  const [searchCat, setSearchCat] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const loadPastRequests = async () => {
    setPastLoading(true)
    const { data } = await supabase.from('store_requests').select('*').order('created_at', { ascending: false }).limit(100)
    setPastRequests(data || [])
    setPastLoading(false)
  }

  useEffect(() => { loadPastRequests() }, [])

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
    loadPastRequests()
    setTimeout(() => { setSuccess(false); setForm({store:'',category:'',brand_names:'',assortment_type:'All SKUs',sku_details:'',comment:'',notify_email:''}); setActiveTab('past') }, 1500)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
          <Store size={18} className="text-accent" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Store Promo Request</h1>
          <p className="text-xs font-body text-muted mt-0.5">Request a promo for your store</p>
        </div>
      </div>
      <div className="flex gap-1 bg-white border border-border rounded-xl p-1 w-fit mb-6">
        {[{id:'request',label:'New Request'},{id:'past',label:'Past Requests'}].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-body font-medium transition-colors ${activeTab === t.id ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
          <CheckCircle size={15} className="text-success" />
          <p className="text-sm font-body text-success">Request submitted! Redirecting to past requests…</p>
        </div>
      )}
      {activeTab === 'request' && (
      <div className="max-w-xl">

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
      )}
      {activeTab === 'past' && (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl text-ink">Past Requests</h2>
          <select
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none"
            value={searchCat} onChange={e => setSearchCat(e.target.value)}>
            <option value="">All Categories</option>
            {['Beauty & Personal Care','Clothing','Electronics','Footwear','Gifting','Health & Wellness','Lifestyle','Luggage','Streetwear'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {pastLoading ? (
          <div className="flex justify-center items-center h-24 gap-2 text-muted">
            <Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading…</span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-white">
            <table className="min-w-full text-sm font-body">
              <thead className="bg-paper border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Store</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Category</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Brand</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Assortment</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Comment</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {pastRequests.filter(r => !searchCat || r.category === searchCat).map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-paper/40">
                    <td className="px-4 py-3 font-mono text-xs text-muted whitespace-nowrap">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'2-digit'}) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink">{r.store || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted">{r.category || '—'}</td>
                    <td className="px-4 py-3 font-medium text-xs text-ink">{r.brand_names || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted">{r.assortment_type || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted max-w-[200px] truncate" title={r.comment}>{r.comment || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono border ${r.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{r.status || 'Pending'}</span>
                    </td>
                  </tr>
                ))}
                {pastRequests.filter(r => !searchCat || r.category === searchCat).length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted text-sm">No requests found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
