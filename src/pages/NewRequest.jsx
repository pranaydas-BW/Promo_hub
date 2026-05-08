import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  FUNDED_BY_OPTIONS, ASSORTMENT_TYPES, OFFLINE_ONLINE_OPTIONS, todayISO,
} from '../lib/constants.jsx'
import { Section, Field, StoreToggle } from '../components/FormParts'
import {
  CheckCircle, AlertCircle, Loader2, Plus, Trash2,
  Search, X, ArrowLeft, FileText, Copy, Download, FileSpreadsheet,
  Percent, Tag,
} from 'lucide-react'

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

const BLANK_RANGE = { from: '', till: '' }

const BLANK_FORM = {
  store: [],
  category: '',
  brand_names: '',
  poc_name: '',
  funded_by: '',
  broadway_pct_split: '',
  brand_pct_split: '',
  offer_type: '',
  promo_details: '',
  promotion_name: '',
  assortment_type: '',
  offline_online: '',
  date_ranges: [{ ...BLANK_RANGE }],
  approval_email: '',
  approval_file_name: '',
  sku_file_link: '',
  rsp_file_link: '',
  sku_file_name: '',
  sku_file_data: '',
  rsp_file_name: '',
  rsp_file_data: '',
  remark: '',
  status: 'Pending',
  current_status: 'Not Live',
}

// ─── Sample downloads ─────────────────────────────────────────────────────────
function downloadSamplePromo() {
  const csv = [
    'Barcode,Brand Name,MRP,Discount %',
    '8901234567890,Brand Name,399,20',
    '8901234567891,Brand Name,199,15',
  ].join('\n')
  trigger(csv, 'sample-promotion-skus.csv')
}

function downloadSampleRSP() {
  const csv = [
    'Barcode,Brand Name,MRP,RSP',
    '8901234567890,Brand Name,399,319',
    '8901234567891,Brand Name,199,169',
  ].join('\n')
  trigger(csv, 'sample-rsp-update-skus.csv')
}

function trigger(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function isValidPOCEmail(e) { return /^[a-zA-Z0-9._%+-]+@broadwaylive\.in$/.test(e) }

// ─── Step 1: Fresh or Replicate ───────────────────────────────────────────────
function StepEntryType({ onChoose }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 fade-in">
      <div className="mb-10 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">New Promo Request</h1>
        <p className="text-muted font-body mt-2 text-sm">Step 1 of 3 — Entry type</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ChoiceCard
          icon={<FileText size={20} className="text-accent" />}
          iconBg="bg-accent/10 group-hover:bg-accent/20"
          title="Fresh Entry"
          desc="Fill in all details from scratch for a brand new promo."
          onClick={() => onChoose('new')}
        />
        <ChoiceCard
          icon={<Copy size={20} className="text-ink" />}
          iconBg="bg-ink/10 group-hover:bg-ink/20"
          title="Based on Existing Promo"
          desc="Enter a past Promo ID — details will be pre-filled."
          onClick={() => onChoose('replicate')}
        />
      </div>
    </div>
  )
}

// ─── Step 2: Offer type ───────────────────────────────────────────────────────
function StepOfferType({ onChoose, onBack }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-8 transition-colors">
        <ArrowLeft size={14} /> Back
      </button>
      <div className="mb-10 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">What type of promo?</h1>
        <p className="text-muted font-body mt-2 text-sm">Step 2 of 3 — Offer type</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ChoiceCard
          icon={<Percent size={20} className="text-info" />}
          iconBg="bg-info/10 group-hover:bg-info/20"
          title="Promotion"
          desc={<>% discount on SKUs.<br />e.g. Flat 20% off, Buy 2 Get 15% off</>}
          onClick={() => onChoose('Promotion')}
          sample={{ label: 'Sample format: Barcode, SKU Name, Brand, MRP, Discount %, RSP', fn: downloadSamplePromo }}
        />
        <ChoiceCard
          icon={<Tag size={20} className="text-success" />}
          iconBg="bg-success/10 group-hover:bg-success/20"
          title="RSP Update"
          desc={<>Fixed selling price update.<br />e.g. New RSP ₹319 instead of ₹399</>}
          onClick={() => onChoose('RSP Update')}
          sample={{ label: 'Sample format: Barcode, SKU Name, Brand, MRP, RSP', fn: downloadSampleRSP }}
        />
      </div>
    </div>
  )
}

// ─── Step 2b: Replicate lookup ────────────────────────────────────────────────
function StepReplicate({ onFound, onBack }) {
  const [dupeId, setDupeId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSearch = useCallback(async () => {
    if (!dupeId.trim()) return
    setLoading(true); setError(null)
    const query = dupeId.trim().startsWith('#') ? dupeId.trim() : `#${dupeId.trim()}`
    const { data, error: err } = await supabase
      .from('promo_requests').select('*').eq('promo_request_id', query).single()
    setLoading(false)
    if (err || !data) { setError(`No promo found with ID "${query}".`); return }
    const { id, created_at, promo_request_id, date_of_entry,
      ginesys_promo_id, shopify_discount_id, status, current_status,
      shopify_promo_status, ...rest } = data
    onFound({
      ...BLANK_FORM, ...rest,
      store: Array.isArray(rest.store) ? rest.store : (rest.store || '').split(',').map(s => s.trim()).filter(Boolean),
      date_ranges: [{ ...BLANK_RANGE }],  // always fresh dates
      status: 'Pending', current_status: 'Not Live',
      // Keep files from original — team can re-upload if needed
    }, promo_request_id, rest.offer_type)
  }, [dupeId, onFound])

  return (
    <div className="max-w-xl mx-auto px-4 py-16 fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-8 transition-colors">
        <ArrowLeft size={14} /> Back
      </button>
      <h1 className="font-display text-3xl font-bold text-ink mb-2">Enter Existing Promo ID</h1>
      <p className="text-muted font-body text-sm mb-8">Step 2 of 3 — We'll pre-fill all details. Just enter new date ranges.</p>
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function NewRequest() {
  const navigate = useNavigate()
  // 'entry-type' | 'offer-type' | 'replicate' | 'form'
  const [step, setStep] = useState('entry-type')
  const [entryType, setEntryType] = useState(null)   // 'new' | 'replicate'
  const [offerType, setOfferType] = useState(null)   // 'Promotion' | 'RSP Update'
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [sourceId, setSourceId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [pocError, setPocError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── Load brands by category ───────────────────────────────────────────────
  const [availableBrands, setAvailableBrands] = useState([])
  const [brandsLoading, setBrandsLoading] = useState(false)

  useEffect(() => {
    if (!form.category) { setAvailableBrands([]); return }
    setBrandsLoading(true)
    supabase.from('brands').select('brand_name').eq('category', form.category).order('brand_name')
      .then(({ data }) => {
        setAvailableBrands(data?.map(b => b.brand_name) || [])
        setBrandsLoading(false)
      })
  }, [form.category])
  const addRange = () => setForm(f => ({ ...f, date_ranges: [...f.date_ranges, { ...BLANK_RANGE }] }))
  const removeRange = (i) => setForm(f => ({ ...f, date_ranges: f.date_ranges.filter((_, idx) => idx !== i) }))
  const setRange = (i, key, val) => setForm(f => ({
    ...f, date_ranges: f.date_ranges.map((r, idx) => idx === i ? { ...r, [key]: val } : r),
  }))

  const handlePOCBlur = () => {
    if (form.poc_name && !isValidPOCEmail(form.poc_name))
      setPocError('Must be a valid @broadwaylive.in email')
    else setPocError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValidPOCEmail(form.poc_name)) { setPocError('Must be a valid @broadwaylive.in email'); return }
    if (splitError) return
    setLoading(true); setError(null)
    const validRanges = form.date_ranges.filter(r => r.from && r.till)
    if (!validRanges.length) { setError('Please fill in at least one complete date range.'); setLoading(false); return }
    const payload = {
      ...form,
      offer_type: offerType,
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

  // ── Step routing ─────────────────────────────────────────────────────────
  if (step === 'entry-type') return (
    <StepEntryType onChoose={(type) => {
      setEntryType(type)
      if (type === 'new') setStep('offer-type')
      else setStep('replicate')
    }} />
  )

  if (step === 'replicate') return (
    <StepReplicate
      onBack={() => setStep('entry-type')}
      onFound={(prefilled, fromId, foundOfferType) => {
        setForm(prefilled)
        setSourceId(fromId)
        setOfferType(foundOfferType)
        setStep('form')
      }}
    />
  )

  if (step === 'offer-type') return (
    <StepOfferType
      onBack={() => setStep('entry-type')}
      onChoose={(type) => {
        setOfferType(type)
        setForm({ ...BLANK_FORM, offer_type: type })
        setStep('form')
      }}
    />
  )

  // ── Form ─────────────────────────────────────────────────────────────────
  const isBoth = form.funded_by === 'Both'
  const isSelectedSKUs = form.assortment_type === 'Selected SKUs'
  const isRSP = offerType === 'RSP Update'
  const isPromo = offerType === 'Promotion'

  const splitTotal = (parseFloat(form.broadway_pct_split) || 0) + (parseFloat(form.brand_pct_split) || 0)
  const splitError = isBoth && form.broadway_pct_split && form.brand_pct_split && splitTotal !== 100
    ? `Total must equal 100% (currently ${splitTotal}%)`
    : ''

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => entryType === 'replicate' ? setStep('replicate') : setStep('offer-type')}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors">
          <ArrowLeft size={14} />
        </button>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="font-display text-2xl font-bold text-ink">
              {sourceId ? `New Promo (based on ${sourceId})` : 'New Promo Request'}
            </h1>
            {/* Offer type badge */}
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
              isPromo ? 'bg-blue-50 text-info border-blue-200' : 'bg-emerald-50 text-success border-emerald-200'
            }`}>
              {offerType}
            </span>
          </div>
          <p className="text-xs font-body text-muted">
            {sourceId ? `Pre-filled from ${sourceId} — new Promo ID assigned on submit.` : 'Step 3 of 3 — Fill in the details below.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Brand & Identity */}
        <Section title="Brand & Identity">
          <Field label="Category" required>
            <select className="input-field" required value={form.category}
              onChange={e => { set('category', e.target.value); set('brand_names', '') }}>
              <option value="">Select…</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Brand Name(s)" required hint={
            !form.category ? 'Select a category first' :
            brandsLoading ? 'Loading brands…' :
            availableBrands.length === 0 ? 'No brands found for this category — add them in the Brands tab' :
            'Select a brand'
          }>
            {availableBrands.length > 0 ? (
              <select
                className="input-field"
                required
                value={form.brand_names}
                onChange={e => set('brand_names', e.target.value)}
              >
                <option value="">Select brand…</option>
                {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            ) : (
              <input className={`input-field ${!form.category ? 'opacity-50' : ''}`}
                disabled={!form.category || brandsLoading}
                placeholder={!form.category ? 'Select a category first' : 'No brands available — add in Brands tab'}
                value={form.brand_names} onChange={e => set('brand_names', e.target.value)} />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="POC Mail ID" required hint="Must be @broadwaylive.in">
              <input
                className={`input-field ${pocError ? 'border-danger' : ''}`}
                required type="email" placeholder="name@broadwaylive.in"
                value={form.poc_name}
                onChange={e => { set('poc_name', e.target.value); setPocError('') }}
                onBlur={handlePOCBlur}
              />
              {pocError && <p className="text-danger text-[11px] mt-1">{pocError}</p>}
            </Field>
            <Field label="Funded By" required>
              <select className="input-field" required value={form.funded_by}
                onChange={e => { set('funded_by', e.target.value); set('broadway_pct_split', ''); set('brand_pct_split', '') }}>
                <option value="">Select…</option>
                {FUNDED_BY_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </div>

          {/* % split — only when Both */}
          {isBoth && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-display font-semibold text-warning">Funding Split — must total 100%</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Broadway %" required>
                  <input className="input-field" required type="number" min="0" max="100" placeholder="e.g. 50"
                    value={form.broadway_pct_split} onChange={e => set('broadway_pct_split', e.target.value)} />
                </Field>
                <Field label="Brand %" required>
                  <input className="input-field" required type="number" min="0" max="100" placeholder="e.g. 50"
                    value={form.brand_pct_split} onChange={e => set('brand_pct_split', e.target.value)} />
                </Field>
              </div>
              {splitError && <p className="text-danger text-[11px]">{splitError}</p>}
              {!splitError && form.broadway_pct_split && form.brand_pct_split && (
                <p className="text-success text-[11px]">✓ Split adds up to 100%</p>
              )}
            </div>
          )}

          <Field label="Store(s)" hint="Select all that apply">
            <StoreToggle selected={form.store} onChange={v => set('store', v)} />
          </Field>
        </Section>

        {/* Date Ranges */}
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

        {/* Offer Details */}
        <Section title={`Offer Details — ${offerType}`}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Offline / Online" required>
              <select className="input-field" value={form.offline_online} onChange={e => set('offline_online', e.target.value)}>
                <option value="">Select…</option>
                {OFFLINE_ONLINE_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Promotion Name" required>
              <input className="input-field" placeholder="e.g. November Offer"
                value={form.promotion_name} onChange={e => set('promotion_name', e.target.value)} />
            </Field>
          </div>

          <Field label="Promotion Details" required hint={isPromo ? 'e.g. Flat 20% off on all SKUs' : 'e.g. New RSP ₹319 for Product X'}>
            <textarea className="input-field min-h-[80px] resize-y" required
              placeholder={isPromo ? 'Flat 20% off on all SKUs' : 'New RSP ₹319 for Product X'}
              value={form.promo_details} onChange={e => set('promo_details', e.target.value)} />
          </Field>

          <Field label="Assortment Type" required>
            <select className="input-field" value={form.assortment_type} onChange={e => set('assortment_type', e.target.value)}>
              <option value="">Select…</option>
              {ASSORTMENT_TYPES.map(a => <option key={a}>{a}</option>)}
            </select>
          </Field>

          {/* Selected SKUs — CSV upload */}
          {isSelectedSKUs && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-display font-semibold text-info">Selected SKUs — upload SKU file</p>
              <CsvUploadField
                offerType={offerType}
                value={form.sku_file_name}
                onParsed={(fileName, rows) => {
                  set('sku_file_name', fileName)
                  set('sku_file_data', JSON.stringify(rows))
                }}
                onClear={() => { set('sku_file_name', ''); set('sku_file_data', '') }}
              />
            </div>
          )}
        </Section>

        {/* Files & Approvals */}
        <Section title="Files & Approvals">
          <Field label="Brand Approval Screenshot" hint="Upload a screenshot of the brand approval email (JPG, PNG, PDF)">
            <ApprovalUpload
              value={form.approval_file_name}
              url={form.approval_email}
              onUploaded={(fileName, url) => {
                set('approval_file_name', fileName)
                set('approval_email', url)
              }}
              onClear={() => {
                set('approval_file_name', '')
                set('approval_email', '')
              }}
            />
          </Field>

          {isRSP && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-display font-semibold text-teal-700">RSP Update — upload RSP file</p>
              <CsvUploadField
                offerType="RSP Update"
                value={form.rsp_file_name}
                onParsed={(fileName, rows) => {
                  set('rsp_file_name', fileName)
                  set('rsp_file_data', JSON.stringify(rows))
                }}
                onClear={() => { set('rsp_file_name', ''); set('rsp_file_data', '') }}
              />
            </div>
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
          <button type="submit" disabled={loading || !!splitError}
            className="flex items-center gap-2 bg-accent text-white font-body font-medium px-6 py-2.5 rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors text-sm">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
          <button type="button" onClick={() => setStep('offer-type')}
            className="bg-white border border-border text-ink font-body font-medium px-5 py-2.5 rounded-lg hover:bg-paper transition-colors text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Reusable choice card ─────────────────────────────────────────────────────
function ChoiceCard({ icon, iconBg, title, desc, onClick, sample }) {
  return (
    <div className="bg-white border-2 border-border hover:border-accent rounded-xl p-6 transition-all group flex flex-col">
      <button onClick={onClick} className="text-left flex-1">
        <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center mb-4 transition-colors`}>
          {icon}
        </div>
        <p className="font-display font-bold text-base text-ink mb-1">{title}</p>
        <p className="text-xs font-body text-muted">{desc}</p>
      </button>
      {sample && (
        <button type="button" onClick={e => { e.stopPropagation(); sample.fn() }}
          className="mt-4 flex items-center gap-1.5 text-[11px] font-body text-muted hover:text-ink transition-colors pt-3 border-t border-border">
          <Download size={11} /> {sample.label}
        </button>
      )}
    </div>
  )
}

// ─── CSV Upload Field with validation ────────────────────────────────────────
function CsvUploadField({ offerType, value, onParsed, onClear }) {
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState([])
  const isRSP = offerType === 'RSP Update'

  const REQUIRED_PROMO = ['Barcode', 'SKU Name', 'Brand Name', 'MRP', 'Discount %', 'RSP']
  const REQUIRED_RSP   = ['Barcode', 'SKU Name', 'Brand Name', 'MRP', 'RSP']
  const REQUIRED = isRSP ? REQUIRED_RSP : REQUIRED_PROMO

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setPreview([])

    // Must be CSV
    if (!file.name.endsWith('.csv')) {
      setError('Only CSV files are accepted. Please download the sample format and use that.')
      return
    }

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const lines = evt.target.result.split('\n').filter(l => l.trim())
        if (lines.length < 2) { setError('File is empty or has no data rows.'); return }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))

        // Check required columns
        const missing = REQUIRED.filter(r => !headers.includes(r))
        if (missing.length > 0) {
          setError(`Missing required columns: ${missing.join(', ')}. Please use the sample format.`)
          return
        }

        const rows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
          return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] || '' }), {})
        }).filter(r => r['Barcode'])

        if (rows.length === 0) { setError('No valid data rows found in the file.'); return }

        setPreview(rows.slice(0, 3))
        onParsed(file.name, rows)
      } catch {
        setError('Could not read the file. Make sure it is a valid CSV.')
      }
    }
    reader.readAsText(file)
  }

  const handleClear = () => { setError(null); setPreview([]); onClear() }

  return (
    <div className="space-y-2">
      {!value ? (
        <>
          <label className="flex items-center gap-2 bg-white border-2 border-dashed border-blue-200 rounded-lg px-4 py-3 cursor-pointer hover:border-info transition-colors">
            <FileSpreadsheet size={15} className="text-info shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-body text-ink">Click to upload CSV</p>
              <p className="text-[11px] text-muted mt-0.5">Required columns: {REQUIRED.join(', ')}</p>
            </div>
            <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </label>
          <button type="button"
            onClick={isRSP ? downloadSampleRSP : downloadSamplePromo}
            className="flex items-center gap-1.5 text-[11px] font-body text-info hover:underline">
            <Download size={11} /> Download sample format
          </button>
        </>
      ) : (
        <div className="flex items-center justify-between bg-white border border-emerald-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-success" />
            <span className="text-xs font-body text-ink">{value}</span>
            {preview.length > 0 && <span className="text-[11px] text-muted">({preview.length}+ rows)</span>}
          </div>
          <button type="button" onClick={handleClear} className="text-muted hover:text-danger transition-colors">
            <X size={13} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <AlertCircle size={13} className="text-danger shrink-0 mt-0.5" />
          <p className="text-xs font-body text-danger">{error}</p>
        </div>
      )}

      {preview.length > 0 && (
        <div className="overflow-x-auto rounded border border-blue-200">
          <table className="min-w-full text-[10px] font-mono">
            <thead className="bg-blue-50">
              <tr>{Object.keys(preview[0]).map(h => <th key={h} className="px-2 py-1.5 text-left text-muted">{h}</th>)}</tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i} className="border-t border-blue-100">
                  {Object.values(r).map((v, j) => <td key={j} className="px-2 py-1.5 text-ink">{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-muted px-2 py-1.5 border-t border-blue-100">Showing first 3 rows preview</p>
        </div>
      )}
    </div>
  )
}

// ─── Approval screenshot upload ───────────────────────────────────────────────
function ApprovalUpload({ value, url, onUploaded, onClear }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  const MAX_MB = 5

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    if (!ACCEPTED.includes(file.type)) {
      setError('Only JPG, PNG, WEBP or PDF files are accepted.')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${MAX_MB}MB.`)
      return
    }

    setUploading(true)
    const fileName = `promos/${Date.now()}_${file.name.replace(/\s+/g, '_')}`

    const { data, error: uploadError } = await supabase.storage
      .from('promo-files')
      .upload(fileName, file, { upsert: false })

    setUploading(false)

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('promo-files')
      .getPublicUrl(fileName)

    onUploaded(file.name, publicUrl)
  }

  return (
    <div className="space-y-2">
      {!value ? (
        <label className={`flex items-center gap-3 bg-white border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors ${
          uploading ? 'border-border opacity-60' : 'border-border hover:border-accent'
        }`}>
          {uploading ? (
            <Loader2 size={16} className="text-muted animate-spin shrink-0" />
          ) : (
            <FileSpreadsheet size={16} className="text-muted shrink-0" />
          )}
          <div>
            <p className="text-sm font-body text-ink">
              {uploading ? 'Uploading…' : 'Click to upload approval screenshot'}
            </p>
            <p className="text-[11px] text-muted mt-0.5">JPG, PNG, PDF — max 5MB</p>
          </div>
          <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden"
            disabled={uploading} onChange={handleFile} />
        </label>
      ) : (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle size={14} className="text-success shrink-0" />
            <a href={url} target="_blank" rel="noreferrer"
              className="text-xs font-body text-ink hover:text-accent truncate hover:underline">
              {value}
            </a>
          </div>
          <button type="button" onClick={onClear} className="text-muted hover:text-danger transition-colors ml-2 shrink-0">
            <X size={13} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <AlertCircle size={13} className="text-danger shrink-0 mt-0.5" />
          <p className="text-xs font-body text-danger">{error}</p>
        </div>
      )}
    </div>
  )
}
