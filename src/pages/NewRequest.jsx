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
  Percent, Tag, XCircle,
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
  discount_on: '',
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
  reversal_rsp_file_name: '',
  reversal_rsp_file_data: '',
  reversal_rsp_file_link: '',
  remark: '',
  status: 'Pending',
  current_status: 'Not Live',
}

// ─── Sample downloads ─────────────────────────────────────────────────────────
function downloadSamplePromo() {
  const csv = [
    'Barcode,SKU Name,Brand Name,Discount %',
    '8901234567890,Brand Name,399,20',
    '8901234567891,Brand Name,199,15',
  ].join('\n')
  trigger(csv, 'sample-promotion-skus.csv')
}

function downloadSampleRSP() {
  const csv = [
    'Barcode,Item Name,Batch_ID,Brand Name,RSP,MRP',
    '8901234567890,Product Name 250ml,BATCH001,Brand Name,319,399',
    '8901234567891,Another Product 100g,BATCH002,Brand Name,169,199',
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

// ─── Step 1: Entry type (now includes Promo Closure) ─────────────────────────
function StepEntryType({ onChoose }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 fade-in">
      <div className="mb-10 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">New Promo Request</h1>
        <p className="text-muted font-body mt-2 text-sm">Step 1 of 3 — Entry type</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          title="Based on Existing"
          desc="Enter a past Promo ID — details will be pre-filled."
          onClick={() => onChoose('replicate')}
        />
        {/* #4 — Promo Closure */}
        <ChoiceCard
          icon={<XCircle size={20} className="text-danger" />}
          iconBg="bg-red-50 group-hover:bg-red-100"
          title="Promo Closure"
          desc="Close an existing promo — enter Promo Code and closure date."
          onClick={() => onChoose('closure')}
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
          sample={{ label: 'Sample format: Barcode, SKU Name, Brand Name, Discount %', fn: downloadSamplePromo }}
        />
        <ChoiceCard
          icon={<Tag size={20} className="text-success" />}
          iconBg="bg-success/10 group-hover:bg-success/20"
          title="RSP Update"
          desc={<>Fixed selling price update.<br />e.g. New RSP ₹319 instead of ₹399</>}
          onClick={() => onChoose('RSP Update')}
          sample={{ label: 'Sample format: Barcode, SKU Name, Brand Name, MRP, RSP', fn: downloadSampleRSP }}
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
      date_ranges: [{ ...BLANK_RANGE }],
      status: 'Pending', current_status: 'Not Live',
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

// ─── #4: Promo Closure form ───────────────────────────────────────────────────
function StepPromoClosure({ onBack }) {
  const navigate = useNavigate()
  const [promoCode, setPromoCode] = useState('')
  const [closureDate, setClosureDate] = useState('')
  const [remark, setRemark] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [linked, setLinked] = useState(null) // the found promo
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleSearch = useCallback(async () => {
    if (!promoCode.trim()) return
    setSearching(true); setSearchError(null); setLinked(null)
    const query = promoCode.trim().startsWith('#') ? promoCode.trim() : `#${promoCode.trim()}`
    const { data, error: err } = await supabase
      .from('promo_requests').select('*').eq('promo_request_id', query).single()
    setSearching(false)
    if (err || !data) { setSearchError(`No promo found with ID "${query}".`); return }
    setLinked(data)
  }, [promoCode])

  const handleSubmit = async () => {
    if (!promoCode.trim()) { setError('Enter a promo code.'); return }
    if (!closureDate) { setError('Select a closure date.'); return }
    setLoading(true); setError(null)

    const payload = {
      offer_type: 'Promo Closure',
      promotion_name: `Closure: ${promoCode.trim()}`,
      promo_details: `Promo closure for ${promoCode.trim()}. Closure date: ${closureDate}.`,
      brand_names: linked?.brand_names || '',
      category: linked?.category || '',
      poc_name: linked?.poc_name || '',
      store: linked?.store || '',
      funded_by: linked?.funded_by || '',
      date_ranges: [{ from: closureDate, till: closureDate }],
      linked_promo_id: promoCode.trim().startsWith('#') ? promoCode.trim() : `#${promoCode.trim()}`,
      remark: remark || '',
      status: 'Pending',
      current_status: 'Not Live',
      date_of_entry: todayISO(),
    }

    const { error: err } = await supabase.from('promo_requests').insert([payload])
    setLoading(false)
    if (err) { setError(err.message) } else {
      setSuccess(true)
      setTimeout(() => navigate('/'), 2000)
    }
  }

  if (success) return (
    <div className="max-w-lg mx-auto mt-24 text-center px-4 fade-in">
      <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="text-success" size={32} />
      </div>
      <h2 className="font-display text-2xl font-bold text-ink mb-2">Closure Submitted!</h2>
      <p className="text-muted font-body text-sm">Taking you back to the board…</p>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto px-4 py-16 fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-8 transition-colors">
        <ArrowLeft size={14} /> Back
      </button>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <XCircle size={22} className="text-danger" />
          <h1 className="font-display text-2xl font-bold text-ink">Promo Closure</h1>
        </div>
        <p className="text-muted font-body text-sm">Enter a promo code and closure date. This will appear on the Promo Board as a pending closure request.</p>
      </div>

      <div className="bg-white border border-border rounded-xl p-6 space-y-5">
        {/* Promo Code lookup */}
        <div>
          <label className="text-[10px] font-mono uppercase text-muted mb-1.5 block">Promo Code <span className="text-accent">*</span></label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className="w-full bg-paper border border-border rounded-lg pl-8 pr-3 py-2.5 text-sm font-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                placeholder="e.g. #BWP0042"
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value); setLinked(null); setSearchError(null) }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button onClick={handleSearch} disabled={searching || !promoCode.trim()}
              className="px-4 py-2.5 bg-ink text-white text-sm font-body rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors">
              {searching ? <Loader2 size={13} className="animate-spin" /> : 'Link'}
            </button>
          </div>
          {searchError && <p className="text-danger text-[11px] mt-1">{searchError}</p>}
          {linked && (
            <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-body text-emerald-800 flex items-center gap-2">
              <CheckCircle size={12} className="text-success shrink-0" />
              Linked: <span className="font-semibold">{linked.brand_names}</span>
              {linked.promotion_name && <span className="text-emerald-600">· {linked.promotion_name}</span>}
            </div>
          )}
        </div>

        {/* Closure Date */}
        <div>
          <label className="text-[10px] font-mono uppercase text-muted mb-1.5 block">Date of Closure <span className="text-accent">*</span></label>
          <input
            type="date"
            className="w-full bg-paper border border-border rounded-lg px-3 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            value={closureDate}
            onChange={e => setClosureDate(e.target.value)}
          />
        </div>

        {/* Remark */}
        <div>
          <label className="text-[10px] font-mono uppercase text-muted mb-1.5 block">Remark</label>
          <textarea
            className="w-full bg-paper border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
            rows={2}
            placeholder="Reason for closure, notes…"
            value={remark}
            onChange={e => setRemark(e.target.value)}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-danger text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-danger text-white font-body font-medium px-6 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-60 transition-colors text-sm">
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Submitting…' : 'Submit Closure Request'}
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NewRequest() {
  const navigate = useNavigate()
  const [step, setStep] = useState('entry-type')
  const [entryType, setEntryType] = useState(null)
  const [offerType, setOfferType] = useState(null)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [sourceId, setSourceId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [pocError, setPocError] = useState('')
  const [wantReversal, setWantReversal] = useState(false)
  const [brandGroups, setBrandGroups] = useState([]) // [{brand, rows, included}]
  const [isMultiBrand, setIsMultiBrand] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

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
    if (!form.store || (Array.isArray(form.store) && form.store.length === 0)) {
      setError('Please select at least one store.'); setLoading(false); return
    }
    if (!form.approval_email) {
      setError('Please upload the brand approval screenshot.'); setLoading(false); return
    }
    if (isPromo && form.assortment_type === 'Selected SKUs' && !form.sku_file_name) {
      setError('Please upload the SKU file — required for Selected SKUs.'); setLoading(false); return
    }
    if (isRSP && !form.rsp_file_name) {
      setError('Please upload the RSP file — required for RSP Update.'); setLoading(false); return
    }
    if (isRSP && wantReversal && !form.reversal_rsp_file_name) {
      setError('Please upload the Reversal RSP file — required when reversal is selected.'); setLoading(false); return
    }

    const basePayload = {
      ...form,
      offer_type: offerType,
      store: Array.isArray(form.store) ? form.store.join(', ') : form.store,
      date_ranges: validRanges,
      date_of_entry: todayISO(),
    }

    // Multi-brand: create one entry per brand
    if (isMultiBrand && brandGroups.filter(g => g.included).length > 1) {
      const included = brandGroups.filter(g => g.included)
      const errors = []
      for (const bg of included) {
        const brandPayload = {
          ...basePayload,
          brand_names: bg.brand,
          sku_file_name: `${bg.brand}_${form.sku_file_name}`,
          sku_file_data: JSON.stringify(bg.rows),
          sku_file_link: form.sku_file_link, // same uploaded file, filtered on read
        }
        const { error: berr } = await supabase.from('promo_requests').insert([brandPayload])
        if (berr) errors.push(bg.brand)
      }
      setLoading(false)
      if (errors.length) { setError(`Failed for: ${errors.join(', ')}`); return }
      setSuccess(true)
      setTimeout(() => navigate('/'), 2000)
      return
    }

    const payload = basePayload

    const { error: err, data: inserted } = await supabase
      .from('promo_requests').insert([payload]).select().single()

    if (err) { setError(err.message); setLoading(false); return }

    // #3 — If RSP Update and user opted in, automatically create a reversal entry
    if (offerType === 'RSP Update' && wantReversal && validRanges.length > 0) {
      const lastRange = validRanges[validRanges.length - 1]
      if (lastRange.till) {
        const reversalPayload = {
          offer_type: 'RSP Update',
          is_reversal: true,
          linked_promo_id: inserted?.promo_request_id || '',
          promotion_name: `RSP Reversal: ${form.promotion_name || form.brand_names}`,
          promo_details: `Automatic reversal of RSP update. Execute on ${lastRange.till} to revert RSP for ${form.brand_names}.`,
          brand_names: form.brand_names,
          category: form.category,
          poc_name: form.poc_name,
          store: Array.isArray(form.store) ? form.store.join(', ') : form.store,
          funded_by: form.funded_by,
          // Reversal execution date = end date of original promo
          date_ranges: [{ from: lastRange.till, till: lastRange.till }],
          rsp_file_link: form.reversal_rsp_file_link || form.rsp_file_link || '',
          rsp_file_name: form.reversal_rsp_file_name || form.rsp_file_name || '',
          rsp_file_data: form.reversal_rsp_file_data || form.rsp_file_data || '',
          approval_email: form.approval_email || '',
          approval_file_name: form.approval_file_name || '',
          remark: `Auto-created reversal for ${inserted?.promo_request_id || 'RSP update'}. Do not execute before ${lastRange.till}.`,
          status: 'Pending',
          current_status: 'Not Live',
          date_of_entry: todayISO(),
        }
        await supabase.from('promo_requests').insert([reversalPayload])
      }
    }

    setLoading(false)
    setSuccess(true)
    setTimeout(() => navigate('/'), 2000)
  }

  if (success) return (
    <div className="max-w-lg mx-auto mt-24 text-center px-4 fade-in">
      <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="text-success" size={32} />
      </div>
      <h2 className="font-display text-2xl font-bold text-ink mb-2">Request Submitted!</h2>
      {offerType === 'RSP Update' && wantReversal && (
        <p className="text-muted font-body text-sm mb-1">A reversal entry has been automatically created on the Promo Board.</p>
      )}
      {isMultiBrand && brandGroups.filter(g => g.included).length > 1 && (
        <p className="text-muted font-body text-sm mb-1">{brandGroups.filter(g => g.included).length} separate entries created — one per brand.</p>
      )}
      <p className="text-muted font-body text-sm">Taking you back to the board…</p>
    </div>
  )

  // ── Step routing ─────────────────────────────────────────────────────────
  if (step === 'entry-type') return (
    <StepEntryType onChoose={(type) => {
      setEntryType(type)
      if (type === 'new') setStep('offer-type')
      else if (type === 'replicate') setStep('replicate')
      else if (type === 'closure') setStep('closure')
    }} />
  )

  // #4 — Promo Closure step
  if (step === 'closure') return (
    <StepPromoClosure onBack={() => setStep('entry-type')} />
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
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
              isPromo ? 'bg-blue-50 text-info border-blue-200' : 'bg-emerald-50 text-success border-emerald-200'
            }`}>
              {offerType}
            </span>
          </div>
          <p className="text-xs font-body text-muted">
            {sourceId ? `Pre-filled from ${sourceId} — new Promo ID assigned on submit.` : 'Step 3 of 3 — Fill in the details below.'}
          </p>
          {/* #3 — RSP reversal notice */}
          {isRSP && (
            <p className="text-xs font-body text-purple-600 mt-0.5">
              ℹ You'll be asked if you want to reverse this RSP update after its end date.
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
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
            availableBrands.length === 0 ? 'No brands found — add them in the Brands tab' :
            'Select a brand'
          }>
            {availableBrands.length > 0 ? (
              <select className="input-field" required value={form.brand_names}
                onChange={e => set('brand_names', e.target.value)}>
                <option value="">Select brand…</option>
                {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            ) : (
              <input className={`input-field ${!form.category ? 'opacity-50' : ''}`}
                disabled={!form.category || brandsLoading}
                placeholder={!form.category ? 'Select a category first' : 'No brands available'}
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

          <Field label="Store(s)" required hint="Select at least one store">
            <StoreToggle selected={form.store} onChange={v => set('store', v)} />
          </Field>
        </Section>

        <Section title="Date Ranges">
          <p className="text-xs text-muted -mt-2">Add multiple rows if the promo runs in separate periods.</p>
          {isRSP && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 space-y-3">
              <p className="text-xs font-display font-semibold text-purple-800">RSP Reversal</p>
              <p className="text-xs text-purple-700">Do you want to reverse the RSP update after the end date?</p>
              <div className="flex gap-3">
                {['Yes', 'No'].map(opt => (
                  <label key={opt} className={`flex items-center gap-2 border-2 rounded-lg px-4 py-2 cursor-pointer transition-all text-sm font-body font-medium ${
                    (opt === 'Yes' ? wantReversal : !wantReversal)
                      ? 'border-purple-500 bg-purple-100 text-purple-800'
                      : 'border-border bg-white text-muted hover:border-ink/40'
                  }`}>
                    <input type="radio" name="want_reversal" className="hidden"
                      checked={opt === 'Yes' ? wantReversal : !wantReversal}
                      onChange={() => {
                        setWantReversal(opt === 'Yes')
                        // Clear till dates if reversal turned off
                        if (opt === 'No') {
                          setForm(f => ({ ...f, date_ranges: f.date_ranges.map(r => ({ ...r, till: '' })) }))
                        }
                      }} />
                    {opt}
                  </label>
                ))}
              </div>
              {wantReversal && (
                <p className="text-[11px] text-purple-600">
                  ↩ Enter the end date below — a reversal entry will be auto-created on the board for that date.
                </p>
              )}
            </div>
          )}
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
                  <Field label={isRSP && i === form.date_ranges.length - 1 ? 'Valid Till (Reversal Date)' : 'Valid Till'} required={!isRSP || wantReversal}>
                    <input type="date"
                      className={`input-field ${
                        isRSP && i === form.date_ranges.length - 1 && wantReversal
                          ? 'border-purple-300 focus:ring-purple-200'
                          : ''
                      } ${isRSP && !wantReversal ? 'opacity-40 cursor-not-allowed bg-gray-50' : ''}`}
                      required={!isRSP || wantReversal}
                      disabled={isRSP && !wantReversal}
                      value={range.till}
                      onChange={e => setRange(i, 'till', e.target.value)} />
                  </Field>
                </div>
                {isRSP && wantReversal && i === form.date_ranges.length - 1 && range.till && (
                  <p className="text-[11px] text-purple-600 mt-1.5">
                    ↩ RSP reversal will be auto-scheduled for: <strong>{range.till}</strong>
                  </p>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addRange}
            className="mt-1 flex items-center gap-1.5 text-sm text-accent font-body hover:underline">
            <Plus size={13} /> Add another date range
          </button>
        </Section>

        <Section title={`Offer Details — ${offerType}`}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Offline / Online" required>
              <select className="input-field" required value={form.offline_online} onChange={e => set('offline_online', e.target.value)}>
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
            <select className="input-field" required value={form.assortment_type} onChange={e => set('assortment_type', e.target.value)}>
              <option value="">Select…</option>
              {ASSORTMENT_TYPES.map(a => <option key={a}>{a}</option>)}
            </select>
          </Field>

          {isPromo && <Field label="Discount on MRP or RSP" required>
            <div className="flex gap-3">
              {['MRP', 'RSP'].map(opt => (
                <label key={opt} className={`flex-1 flex items-center justify-center gap-2 border-2 rounded-lg px-4 py-2.5 cursor-pointer transition-all text-sm font-body font-medium ${
                  form.discount_on === opt
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-border bg-white text-muted hover:border-ink/40'
                }`}>
                  <input type="radio" name="discount_on" value={opt}
                    checked={form.discount_on === opt} onChange={() => set('discount_on', opt)}
                    className="hidden" required />
                  {opt}
                </label>
              ))}
            </div>
          </Field>}

          {/* #1/#2 — SKU file: hidden for All SKUs, mandatory for Selected SKUs */}
          {isPromo && form.assortment_type === 'Selected SKUs' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-display font-semibold text-info">Upload SKU file <span className="text-accent ml-1">*</span></p>
                <span className="text-[10px] font-mono text-info bg-blue-100 px-2 py-0.5 rounded-full">Required for Selected SKUs</span>
              </div>
              <CsvUploadField
                offerType={offerType}
                value={form.sku_file_name}
                onParsed={(fileName, rows, url) => {
                  set('sku_file_name', fileName)
                  set('sku_file_data', JSON.stringify(rows))
                  set('sku_file_link', url || '')
                  // Detect multi-brand
                  const brandCol = 'Brand Name'
                  const brands = [...new Set(rows.map(r => (r[brandCol] || '').trim()).filter(Boolean))]
                  if (brands.length > 1) {
                    setIsMultiBrand(true)
                    setBrandGroups(brands.map(brand => ({
                      brand,
                      rows: rows.filter(r => (r[brandCol] || '').trim() === brand),
                      included: true,
                    })))
                  } else {
                    setIsMultiBrand(false)
                    setBrandGroups([])
                  }
                }}
                onClear={() => {
                  set('sku_file_name', ''); set('sku_file_data', '')
                  setIsMultiBrand(false); setBrandGroups([])
                }}
              />

              {/* Multi-brand preview */}
              {isMultiBrand && brandGroups.length > 0 && (
                <div className="bg-white border border-blue-300 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-display font-semibold text-ink">
                      {brandGroups.length} brands detected — one entry will be created per brand
                    </p>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Multi-brand file</span>
                  </div>
                  <div className="space-y-2">
                    {brandGroups.map((bg, i) => (
                      <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${bg.included ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-border opacity-50'}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={bg.included}
                            onChange={() => setBrandGroups(gs => gs.map((g, j) => j === i ? {...g, included: !g.included} : g))}
                            className="rounded" />
                          <span className="text-sm font-medium text-ink">{bg.brand}</span>
                          <span className="text-[10px] font-mono text-muted">{bg.rows.length} SKUs</span>
                        </div>
                        {bg.included && (
                          <span className="text-[10px] text-success font-mono">✓ Will create entry</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted">Uncheck brands you want to exclude. On submit, a separate promo request will be created for each checked brand.</p>
                </div>
              )}
            </div>
          )}
          {isPromo && form.assortment_type === 'All SKUs - Flat on All' && (
            <div className="bg-gray-50 border border-border rounded-lg px-4 py-3">
              <p className="text-xs text-muted font-body">ℹ No SKU file needed for <span className="font-semibold">All SKUs - Flat on All</span> — applies to entire assortment.</p>
            </div>
          )}
        </Section>

        <Section title="Files & Approvals">
          <Field label="Brand Approval Screenshot" required hint="Upload a screenshot of the brand approval email (JPG, PNG, PDF)">
            <ApprovalUpload
              value={form.approval_file_name}
              url={form.approval_email}
              onUploaded={(fileName, url) => {
                set('approval_file_name', fileName)
                set('approval_email', url)
              }}
              onClear={() => { set('approval_file_name', ''); set('approval_email', '') }}
            />
          </Field>

          {isRSP && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-display font-semibold text-teal-700">RSP Update — upload RSP file</p>
              <CsvUploadField
                offerType="RSP Update"
                value={form.rsp_file_name}
                onParsed={(fileName, rows, url) => {
                  set('rsp_file_name', fileName)
                  set('rsp_file_data', JSON.stringify(rows))
                  set('rsp_file_link', url || '')
                }}
                onClear={() => { set('rsp_file_name', ''); set('rsp_file_data', '') }}
              />
            </div>
          )}

          {isRSP && wantReversal && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-display font-semibold text-purple-800">Reversal SKU File</p>
              <p className="text-[11px] text-purple-700">Upload the RSP file to be used when reversing the update on the end date. Usually the original RSP values before this update.</p>
              <CsvUploadField
                offerType="RSP Update"
                value={form.reversal_rsp_file_name}
                onParsed={(fileName, rows, url) => {
                  set('reversal_rsp_file_name', fileName)
                  set('reversal_rsp_file_data', JSON.stringify(rows))
                  set('reversal_rsp_file_link', url || '')
                }}
                onClear={() => { set('reversal_rsp_file_name', ''); set('reversal_rsp_file_data', '') }}
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

function CsvUploadField({ offerType, value, onParsed, onClear }) {
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState([])
  const isRSP = offerType === 'RSP Update'

  const REQUIRED_PROMO = ['Barcode', 'SKU Name', 'Brand Name', 'Discount %']
  const REQUIRED_RSP   = ['Barcode', 'Item Name', 'Brand Name', 'RSP', 'MRP']
  const REQUIRED = isRSP ? REQUIRED_RSP : REQUIRED_PROMO

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setPreview([])

    if (!file.name.endsWith('.csv')) {
      setError('Only CSV files are accepted. Please download the sample format and use that.')
      return
    }

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const lines = evt.target.result.split('\n').filter(l => l.trim())
        if (lines.length < 2) { setError('File is empty or has no data rows.'); return }
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
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

        const fileName = `promos/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        let publicUrl = ''
        const { error: uploadError } = await supabase.storage
          .from('promo-files').upload(fileName, file, { upsert: false })
        if (!uploadError) {
          const { data: { publicUrl: url } } = supabase.storage
            .from('promo-files').getPublicUrl(fileName)
          publicUrl = url
        }
        onParsed(file.name, rows, publicUrl)
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
      .from('promo-files').upload(fileName, file, { upsert: false })
    setUploading(false)
    if (uploadError) { setError(`Upload failed: ${uploadError.message}`); return }
    const { data: { publicUrl } } = supabase.storage.from('promo-files').getPublicUrl(fileName)
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
