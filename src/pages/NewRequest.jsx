import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  OFFER_TYPES, FUNDED_BY_OPTIONS,
  ASSORTMENT_TYPES, OFFLINE_ONLINE_OPTIONS,
  todayISO,
} from '../lib/constants.jsx'
import { Section, Field, StoreToggle } from '../components/FormParts'
import {
  CheckCircle, AlertCircle, Loader2, Plus, Trash2,
  Search, X, ArrowLeft, FileText, Copy, Download,
} from 'lucide-react'

// ─── Categories (exact order requested) ──────────────────────────────────────
const CATEGORIES = [
  'Footwear',
  'Fashion (Fashion Accessories, Clothing, Jewellery)',
  'Beauty and Personal Care',
  'Luggage and Bags',
  'Others',
  'Gifting',
  'Electronics',
  'Kids',
  'Home',
]

const BLANK_RANGE = { from: '', till: '' }

const BLANK_FORM = {
  week_label: '',
  store: [],
  category: '',
  brand_names: '',
  poc_name: '',         // will store email e.g. name@broadwaylive.in
  funded_by: '',
  offer_type: '',       // 'Promotion' | 'RSP Update'
  promo_details: '',
  promotion_name: '',
  assortment_type: '',  // 'All SKUs - Flat on All' | 'Selected SKUs'
  offline_online: '',
  broadway_discount_pct: '',
  brand_discount_pct: '',
  broadway_discount_both: '',
  brand_discount_both: '',
  date_ranges: [{ ...BLANK_RANGE }],
  approval_email: '',   // single drive link
  sku_file_link: '',    // only for Selected SKUs
  rsp_file_link: '',    // only for RSP Update
  remark: '',
  status: 'Pending',
  current_status: 'Not Live',
}

// ─── Sample SKU sheet download ────────────────────────────────────────────────
function downloadSampleSKU() {
  const csv = [
    'Barcode,SKU Name,Brand Name,MRP,Discount %,Offer Price',
    '8901234567890,Product Name 250ml,Brand Name,399,20,319',
    '8901234567891,Another Product 100g,Brand Name,199,15,169',
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'sample-sku-format.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ─── Email validator ──────────────────────────────────────────────────────────
function isValidPOCEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@broadwaylive\.in$/.test(email)
}

// ─── Choose entry type ────────────────────────────────────────────────────────
function ChooseEntryType({ onChoose }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 fade-in">
      <div className="mb-10 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">New Promo Request</h1>
        <p className="text-muted font-body mt-2 text-sm">How would you like to create this promo?</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={() => onChoose('new')}
          className="bg-white border-2 border-border hover:border-accent rounded-xl p-6 text-left transition-all group">
          <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
            <FileText size={20} className="text-accent" />
          </div>
          <p className="font-display font-bold text-base text-ink mb-1">Fresh Entry</p>
          <p className="text-xs font-body text-muted">Fill in all details from scratch for a brand new promo.</p>
        </button>
        <button onClick={() => onChoose('replicate')}
          className="bg-white border-2 border-border hover:border-ink rounded-xl p-6 text-left transition-all group">
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

// ─── Replicate lookup ─────────────────────────────────────────────────────────
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
    if (err || !data) { setError(`No promo found with ID "${query}". Please check and try again.`); return }
    const { id, created_at, promo_request_id, date_of_entry,
      ginesys_promo_id, shopify_discount_id, status, current_status,
      shopify_promo_status, ...rest } = data
    onFound({
      ...BLANK_FORM, ...rest,
      store: Array.isArray(rest.store) ? rest.store : (rest.store || '').split(',').map(s => s.trim()).filter(Boolean),
      date_ranges: [{ ...BLANK_RANGE }],
      status: 'Pending', current_status: 'Not Live', shopify_promo_status: '',
      ginesys_promo_id: '', shopify_discount_id: '',
    }, promo_request_id)
  }, [dupeId, onFound])

  return (
    <div className="max-w-xl mx-auto px-4 py-16 fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-8 transition-colors">
        <ArrowLeft size={14} /> Back
      </button>
      <h1 className="font-display text-3xl font-bold text-ink mb-2">Enter Existing Promo ID</h1>
      <p className="text-muted font-body text-sm mb-8">We'll pre-fill all details. You'll just need to enter new date ranges.</p>
      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="w-full bg-paper border border-border rounded-lg pl-8 pr-3 py-3 text-sm font-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              placeholder="e.g. BWP0001 or #BWP0001"
              value={dupeId} onChange={e => setDupeId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} autoFocus />
          </div>
          <button onClick={handleSearch} disabled={loading || !dupeId.trim()}
            className="flex items-center gap-1.5 px-5 py-3 bg-ink text-white text-sm font-body rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Find
          </button>
        </div>
        {error && <p className="text-danger text-xs flex items-center gap-1.5"><X size={11} /> {error}</p>}
      </div>
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────
export default function NewRequest() {
  const navigate = useNavigate()
  const [step, setStep] = useState('choose')
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [sourceId, setSourceId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [pocError, setPocError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addRange = () => setForm(f => ({ ...f, date_ranges: [...f.date_ranges, { ...BLANK_RANGE }] }))
  const removeRange = (i) => setForm(f => ({ ...f, date_ranges: f.date_ranges.filter((_, idx) => idx !== i) }))
  const setRange = (i, key, val) => setForm(f => ({
    ...f, date_ranges: f.date_ranges.map((r, idx) => idx === i ? { ...r, [key]: val } : r),
  }))

  const handlePOCBlur = () => {
    if (form.poc_name && !isValidPOCEmail(form.poc_name)) {
      setPocError('Must be a valid @broadwaylive.in email address')
    } else {
      setPocError('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValidPOCEmail(form.poc_name)) { setPocError('Must be a valid @broadwaylive.in email address'); return }
    setLoading(true)
    setError(null)
    const validRanges = form.date_ranges.filter(r => r.from && r.till)
    if (!validRanges.length) { setError('Please fill in at least one complete date range.'); setLoading(false); return }
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
  const isSelectedSKUs = form.assortment_type === 'Selected SKUs'
  const isRSP = form.offer_type === 'RSP Update'
  const isPromo = form.offer_type === 'Promotion'

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

        {/* ── Brand & Identity ── */}
        <Section title="Brand & Identity">

          <Field label="Category" required>
            <select className="input-field" required value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">Select…</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Brand Name(s)" required hint="Comma separated if multiple — e.g. MamaEarth, Aqualogica">
            <input className="input-field" required placeholder="MamaEarth, Aqualogica"
              value={form.brand_names} onChange={e => set('brand_names', e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="POC Mail ID" required hint="Must be @broadwaylive.in">
              <input
                className={`input-field ${pocError ? 'border-danger focus:border-danger focus:ring-danger/30' : ''}`}
                required
                type="email"
                placeholder="name@broadwaylive.in"
                value={form.poc_name}
                onChange={e => { set('poc_name', e.target.value); setPocError('') }}
                onBlur={handlePOCBlur}
              />
              {pocError && <p className="text-danger text-[11px] mt-1">{pocError}</p>}
            </Field>
            <Field label="Funded By" required>
              <select className="input-field" required value={form.funded_by} onChange={e => set('funded_by', e.target.value)}>
                <option value="">Select…</option>
                {FUNDED_BY_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Store(s)" hint="Select all that apply">
              <StoreToggle selected={form.store} onChange={v => set('store', v)} />
            </Field>
            <Field label="Week Label" hint="e.g. Week 8">
              <input className="input-field" placeholder="Week 8"
                value={form.week_label} onChange={e => set('week_label', e.target.value)} />
            </Field>
          </div>

        </Section>

        {/* ── Date Ranges ── */}
        <Section title="Date Ranges">
          <p className="text-xs text-muted -mt-2">Add multiple rows if the promo runs in separate periods.</p>
          <div className="space-y-3">
            {form.date_ranges.map((range, i) => (
              <div key={i} className="border border-border rounded-lg p-3 bg-paper/40">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono text-muted uppercase">Range {i + 1}</span>
                  {form.date_ranges.length > 1 && (
                    <button type="button" onClick={() => removeRange(i)} className="text-danger hover:opacity-70">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Valid From" required>
                    <input type="date" className="input-field" required
                      value={range.from} onChange={e => setRange(i, 'from', e.target.value)} />
                  </Field>
                  <Field label="Valid Till" required>
                    <input type="date" className="input-field" required
                      value={range.till} onChange={e => setRange(i, 'till', e.target.value)} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addRange}
            className="mt-1 flex items-center gap-1.5 text-sm text-accent font-body hover:underline">
            <Plus size={13} /> Add another date range
          </button>
        </Section>

        {/* ── Offer Details ── */}
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
            <textarea className="input-field min-h-[80px] resize-y" required
              placeholder="Flat 20% off on all SKUs"
              value={form.promo_details} onChange={e => set('promo_details', e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Promotion Name">
              <input className="input-field" placeholder="e.g. November Offer"
                value={form.promotion_name} onChange={e => set('promotion_name', e.target.value)} />
            </Field>
            <Field label="Assortment Type">
              <select className="input-field" value={form.assortment_type} onChange={e => set('assortment_type', e.target.value)}>
                <option value="">Select…</option>
                {ASSORTMENT_TYPES.map(a => <option key={a}>{a}</option>)}
              </select>
            </Field>
          </div>

          {/* SKU file upload — only for Selected SKUs */}
          {isSelectedSKUs && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-display font-semibold text-info">Selected SKUs — provide the SKU list</p>
              <Field label="Google Sheets / Drive Link to SKU List" hint="Share the link with view access">
                <input type="url" className="input-field" placeholder="https://docs.google.com/spreadsheets/…"
                  value={form.sku_file_link} onChange={e => set('sku_file_link', e.target.value)} />
              </Field>
              <button type="button" onClick={downloadSampleSKU}
                className="flex items-center gap-1.5 text-xs font-body text-info hover:underline">
                <Download size={12} /> Download sample format
              </button>
            </div>
          )}

          {form.funded_by && (
            <div className="grid grid-cols-2 gap-4">
              {!isBoth ? (
                <>
                  <Field label="Broadway Discount %">
                    <input className="input-field" placeholder="e.g. 0%"
                      value={form.broadway_discount_pct} onChange={e => set('broadway_discount_pct', e.target.value)} />
                  </Field>
                  <Field label="Brand Discount %">
                    <input className="input-field" placeholder="e.g. 100%"
                      value={form.brand_discount_pct} onChange={e => set('brand_discount_pct', e.target.value)} />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Broadway Discount % (Both)">
                    <input className="input-field" placeholder="e.g. 50%"
                      value={form.broadway_discount_both} onChange={e => set('broadway_discount_both', e.target.value)} />
                  </Field>
                  <Field label="Brand Discount % (Both)">
                    <input className="input-field" placeholder="e.g. 50%"
                      value={form.brand_discount_both} onChange={e => set('brand_discount_both', e.target.value)} />
                  </Field>
                </>
              )}
            </div>
          )}
        </Section>

        {/* ── Files & Approvals ── */}
        <Section title="Files & Approvals">

          <Field label="Brand Approval Email (Drive Link)" hint="Paste Google Drive link to the approval email screenshot">
            <input type="url" className="input-field" placeholder="https://drive.google.com/…"
              value={form.approval_email} onChange={e => set('approval_email', e.target.value)} />
          </Field>

          {/* Show RSP file only for RSP Update */}
          {isRSP && (
            <Field label="RSP File (Drive Link)" required hint="Upload the RSP update sheet to Drive and paste the link">
              <input type="url" className="input-field" placeholder="https://drive.google.com/…"
                value={form.rsp_file_link} onChange={e => set('rsp_file_link', e.target.value)} />
            </Field>
          )}

          {/* Show SKU/barcode file for Promotion + All SKUs */}
          {isPromo && !isSelectedSKUs && (
            <Field label="SKU / Barcode File (Drive Link)" hint="Upload barcode list to Drive and paste the link">
              <input type="url" className="input-field" placeholder="https://drive.google.com/…"
                value={form.sku_file_link} onChange={e => set('sku_file_link', e.target.value)} />
            </Field>
          )}

          <Field label="Remark">
            <textarea className="input-field min-h-[60px] resize-y" placeholder="Any notes or flags…"
              value={form.remark} onChange={e => set('remark', e.target.value)} />
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
