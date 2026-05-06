import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  CATEGORIES, OFFER_TYPES, FUNDED_BY_OPTIONS,
  ASSORTMENT_TYPES, OFFLINE_ONLINE_OPTIONS,
  STATUS_OPTIONS, CURRENT_STATUS_OPTIONS, SHOPIFY_STATUS_OPTIONS,
  todayISO,
} from '../lib/constants.jsx'
import { Section, Field, StoreToggle } from '../components/FormParts'
import {
  CheckCircle, AlertCircle, Loader2, Plus, Trash2,
  Search, X, ArrowLeft, FileText, Copy,
} from 'lucide-react'

const BLANK_RANGE = { from: '', till: '', stores: [] }

const BLANK_FORM = {
  week_label: '', store: [], category: '', brand_names: '', poc_name: '',
  funded_by: '', offer_type: '', promo_details: '', promotion_name: '',
  assortment_type: '', offline_online: '',
  broadway_discount_pct: '', brand_discount_pct: '',
  broadway_discount_both: '', brand_discount_both: '',
  date_ranges: [{ ...BLANK_RANGE }],
  approval_email: '', approval_email_alt: '',
  rsp_file_link: '', sku_file_link: '',
  status: 'Pending', current_status: 'Not Live',
  shopify_promo_status: '', ginesys_promo_id: '', shopify_discount_id: '',
  remark: '',
}

function ChooseEntryType({ onChoose }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 fade-in">
      <div className="mb-10 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">New Promo Request</h1>
        <p className="text-muted font-body mt-2 text-sm">How would you like to create this promo?</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => onChoose('new')}
          className="bg-white border-2 border-border hover:border-accent rounded-xl p-6 text-left transition-all group"
        >
          <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
            <FileText size={20} className="text-accent" />
          </div>
          <p className="font-display font-bold text-base text-ink mb-1">Fresh Entry</p>
          <p className="text-xs font-body text-muted">Fill in all details from scratch for a brand new promo.</p>
        </button>

        <button
          onClick={() => onChoose('replicate')}
          className="bg-white border-2 border-border hover:border-ink rounded-xl p-6 text-left transition-all group"
        >
          <div className="w-10 h-10 bg-ink/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-ink/20 transition-colors">
            <Copy size={20} className="text-ink" />
          </div>
          <p className="font-display font-bold text-base text-ink mb-1">Based on Existing Promo</p>
          <p className="text-xs font-body text-muted">Enter a past Promo ID — all details will be pre-filled for you to update.</p>
        </button>
      </div>
    </div>
  )
}

function ReplicateLookup({ onFound, onBack }) {
  const [dupeId, setDupeId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSearch = useCallback(async () => {
    if (!dupeId.trim()) return
    setLoading(true)
    setError(null)

    const query = dupeId.trim().startsWith('#') ? dupeId.trim() : `#${dupeId.trim()}`
    const { data, error: err } = await supabase
      .from('promo_requests').select('*').eq('promo_request_id', query).single()

    setLoading(false)

    if (err || !data) {
      setError(`No promo found with ID "${query}". Please check and try again.`)
      return
    }

    const {
      id, created_at, promo_request_id, date_of_entry,
      ginesys_promo_id, shopify_discount_id, status,
      current_status, shopify_promo_status, ...rest
    } = data

    onFound({
      ...BLANK_FORM,
      ...rest,
      store: Array.isArray(rest.store)
        ? rest.store
        : (rest.store || '').split(',').map(s => s.trim()).filter(Boolean),
      date_ranges: [{ ...BLANK_RANGE }],
      status: 'Pending',
      current_status: 'Not Live',
      shopify_promo_status: '',
      ginesys_promo_id: '',
      shopify_discount_id: '',
    }, promo_request_id)
  }, [dupeId, onFound])

  return (
    <div className="max-w-xl mx-auto px-4 py-16 fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-8 transition-colors">
        <ArrowLeft size={14} /> Back
      </button>
      <h1 className="font-display text-3xl font-bold text-ink mb-2">Enter Existing Promo ID</h1>
      <p className="text-muted font-body text-sm mb-8">
        We'll pre-fill all the brand and offer details. You'll just need to enter new date ranges.
      </p>
      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="w-full bg-paper border border-border rounded-lg pl-8 pr-3 py-3 text-sm font-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              placeholder="e.g. BWP0001 or #BWP0001"
              value={dupeId}
              onChange={e => setDupeId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              autoFocus
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !dupeId.trim()}
            className="flex items-center gap-1.5 px-5 py-3 bg-ink text-white text-sm font-body rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Find
          </button>
        </div>
        {error && (
          <p className="text-danger text-xs flex items-center gap-1.5">
            <X size={11} /> {error}
          </p>
        )}
      </div>
    </div>
  )
}

export default function NewRequest() {
  const navigate = useNavigate()
  const [step, setStep] = useState('choose')
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [sourceId, setSourceId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addRange = () => setForm(f => ({ ...f, date_ranges: [...f.date_ranges, { ...BLANK_RANGE }] }))
  const removeRange = (i) => setForm(f => ({ ...f, date_ranges: f.date_ranges.filter((_, idx) => idx !== i) }))
  const setRange = (i, key, val) => setForm(f => ({
    ...f,
    date_ranges: f.date_ranges.map((r, idx) => idx === i ? { ...r, [key]: val } : r),
  }))
  const toggleRangeStore = (i, s) => setForm(f => ({
    ...f,
    date_ranges: f.date_ranges.map((r, idx) => {
      if (idx !== i) return r
      const arr = r.stores || []
      return { ...r, stores: arr.includes(s) ? arr.filter(x => x !== s) : [...arr, s] }
    }),
  }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const validRanges = form.date_ranges.filter(r => r.from && r.till)
    if (!validRanges.length) {
      setError('Please fill in at least one complete date range (from + till).')
      setLoading(false)
      return
    }

    const payload = {
      ...form,
      store: Array.isArray(form.store) ? form.store.join(', ') : form.store,
      date_ranges: validRanges,
      date_of_entry: todayISO(),
    }

    const { error: err } = await supabase.from('promo_requests').insert([payload])
    setLoading(false)
    if (err) { setError(err.message) } else { setSuccess(true); setTimeout(() => navigate('/'), 2000) }
  }

  if (success) return (
    <div className="max-w-lg mx-auto mt-24 text-center px-4 fade-in">
      <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="text-success" size={32} />
      </div>
      <h2 className="font-display text-2xl font-bold text-ink mb-2">Request Submitted!</h2>
      <p className="text-muted font-body text-sm">Taking you back to the board…</p>
    </div>
  )

  if (step === 'choose') return (
    <ChooseEntryType onChoose={(type) => {
      if (type === 'new') { setForm({ ...BLANK_FORM }); setSourceId(null); setStep('form') }
      else { setStep('replicate-lookup') }
    }} />
  )

  if (step === 'replicate-lookup') return (
    <ReplicateLookup
      onBack={() => setStep('choose')}
      onFound={(prefilled, fromId) => { setForm(prefilled); setSourceId(fromId); setStep('form') }}
    />
  )

  const isBoth = form.funded_by === 'Both'

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setStep('choose')} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors">
          <ArrowLeft size={14} />
        </button>
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">
            {sourceId ? `New Promo (based on ${sourceId})` : 'New Promo Request'}
          </h1>
          {sourceId
            ? <p className="text-xs font-body text-muted mt-0.5">Pre-filled from {sourceId} — a new Promo ID will be assigned on submit.</p>
            : <p className="text-muted font-body mt-0.5 text-sm">Fields marked <span className="text-accent">*</span> are required.</p>
          }
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Section title="Brand & Identity">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category" required>
              <select className="input-field" required value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Select…</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Week Label" hint="e.g. Week 8">
              <input className="input-field" placeholder="Week 8" value={form.week_label} onChange={e => set('week_label', e.target.value)} />
            </Field>
          </div>
          <Field label="Brand Name(s)" required hint="Comma separated if multiple">
            <input className="input-field" required placeholder="MamaEarth, Aqualogica" value={form.brand_names} onChange={e => set('brand_names', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Broadway POC Name" required>
              <input className="input-field" required placeholder="Your name" value={form.poc_name} onChange={e => set('poc_name', e.target.value)} />
            </Field>
            <Field label="Funded By" required>
              <select className="input-field" required value={form.funded_by} onChange={e => set('funded_by', e.target.value)}>
                <option value="">Select…</option>
                {FUNDED_BY_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Store(s)" hint="Select all that apply">
            <StoreToggle selected={form.store} onChange={v => set('store', v)} />
          </Field>
        </Section>

        <Section title="Date Ranges">
          <p className="text-xs text-muted -mt-2">Add multiple rows if the promo runs in separate periods or different stores have different dates.</p>
          <div className="space-y-3">
            {form.date_ranges.map((range, i) => (
              <div key={i} className="border border-border rounded-lg p-3 bg-paper/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-muted uppercase">Range {i + 1}</span>
                  {form.date_ranges.length > 1 && (
                    <button type="button" onClick={() => removeRange(i)} className="text-danger hover:opacity-70"><Trash2 size={13} /></button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Valid From" required>
                    <input type="date" className="input-field" required value={range.from} onChange={e => setRange(i, 'from', e.target.value)} />
                  </Field>
                  <Field label="Valid Till" required>
                    <input type="date" className="input-field" required value={range.till} onChange={e => setRange(i, 'till', e.target.value)} />
                  </Field>
                </div>
                <Field label="Stores for this range" hint="Leave blank to apply to all selected stores">
                  <div className="flex flex-wrap gap-2 mt-1">
                    {['VK, Delhi', 'BH, Hyderabad', 'Pune'].map(s => (
                      <button key={s} type="button" onClick={() => toggleRangeStore(i, s)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-body border transition-colors ${
                          (range.stores || []).includes(s) ? 'bg-info text-white border-info' : 'bg-white text-muted border-border hover:border-info hover:text-info'
                        }`}>{s}</button>
                    ))}
                  </div>
                </Field>
              </div>
            ))}
          </div>
          <button type="button" onClick={addRange} className="mt-1 flex items-center gap-1.5 text-sm text-accent font-body hover:underline">
            <Plus size={13} /> Add another date range
          </button>
        </Section>

        <Section title="Offer Details">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type of Offer" required>
              <select className="input-field" required value={form.offer_type} onChange={e => set('offer_type', e.target.value)}>
                <option value="">Select…</option>
                {OFFER_TYPES.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Offline / Online">
              <select className="input-field" value={form.offline_online} onChange={e => set('offline_online', e.target.value)}>
                <option value="">Select…</option>
                {OFFLINE_ONLINE_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Promotion Details" required hint="e.g. Flat 20% off on all SKUs">
            <textarea className="input-field min-h-[80px] resize-y" required placeholder="Flat 20% off on all SKUs" value={form.promo_details} onChange={e => set('promo_details', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Promotion Name">
              <input className="input-field" placeholder="e.g. November Offer" value={form.promotion_name} onChange={e => set('promotion_name', e.target.value)} />
            </Field>
            <Field label="Assortment Type">
              <select className="input-field" value={form.assortment_type} onChange={e => set('assortment_type', e.target.value)}>
                <option value="">Select…</option>
                {ASSORTMENT_TYPES.map(a => <option key={a}>{a}</option>)}
              </select>
            </Field>
          </div>
          {form.funded_by && (
            <div className="grid grid-cols-2 gap-4">
              {!isBoth ? (
                <>
                  <Field label="Broadway Discount %"><input className="input-field" placeholder="e.g. 0%" value={form.broadway_discount_pct} onChange={e => set('broadway_discount_pct', e.target.value)} /></Field>
                  <Field label="Brand Discount %"><input className="input-field" placeholder="e.g. 100%" value={form.brand_discount_pct} onChange={e => set('brand_discount_pct', e.target.value)} /></Field>
                </>
              ) : (
                <>
                  <Field label="Broadway Discount % (Both)"><input className="input-field" placeholder="e.g. 50%" value={form.broadway_discount_both} onChange={e => set('broadway_discount_both', e.target.value)} /></Field>
                  <Field label="Brand Discount % (Both)"><input className="input-field" placeholder="e.g. 50%" value={form.brand_discount_both} onChange={e => set('brand_discount_both', e.target.value)} /></Field>
                </>
              )}
            </div>
          )}
        </Section>

        <Section title="Files & Approvals">
          <Field label="Brand Approval Email Link">
            <input type="url" className="input-field" placeholder="https://drive.google.com/…" value={form.approval_email} onChange={e => set('approval_email', e.target.value)} />
          </Field>
          <Field label="Brand Approval Email (alternate)">
            <input type="url" className="input-field" placeholder="https://drive.google.com/…" value={form.approval_email_alt} onChange={e => set('approval_email_alt', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="RSP File (Drive link)">
              <input type="url" className="input-field" placeholder="https://drive.google.com/…" value={form.rsp_file_link} onChange={e => set('rsp_file_link', e.target.value)} />
            </Field>
            <Field label="SKU / Barcode File (Drive link)">
              <input type="url" className="input-field" placeholder="Sheet with barcodes" value={form.sku_file_link} onChange={e => set('sku_file_link', e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Status">
          <p className="text-xs text-muted -mt-2">Set initial status. Team can update from the Board later.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Status">
              <select className="input-field" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Current Status">
              <select className="input-field" value={form.current_status} onChange={e => set('current_status', e.target.value)}>
                {CURRENT_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Shopify Promo Status">
              <select className="input-field" value={form.shopify_promo_status} onChange={e => set('shopify_promo_status', e.target.value)}>
                <option value="">—</option>
                {SHOPIFY_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ginesys Promo ID">
              <input className="input-field" placeholder="e.g. 001-00038" value={form.ginesys_promo_id} onChange={e => set('ginesys_promo_id', e.target.value)} />
            </Field>
            <Field label="Shopify Discount ID">
              <input className="input-field" placeholder="e.g. #456" value={form.shopify_discount_id} onChange={e => set('shopify_discount_id', e.target.value)} />
            </Field>
          </div>
          <Field label="Remark">
            <textarea className="input-field min-h-[60px] resize-y" placeholder="Any notes…" value={form.remark} onChange={e => set('remark', e.target.value)} />
          </Field>
        </Section>

        {error && (
          <div className="flex items-center gap-2 text-danger text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <div className="flex gap-3 pb-8">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 bg-accent text-white font-body font-medium px-6 py-2.5 rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors text-sm">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
          <button type="button" onClick={() => setStep('choose')}
            className="bg-white border border-border text-ink font-body font-medium px-5 py-2.5 rounded-lg hover:bg-paper transition-colors text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
