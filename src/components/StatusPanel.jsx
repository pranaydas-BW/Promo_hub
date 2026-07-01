import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  STATUS_OPTIONS, CURRENT_STATUS_OPTIONS, SHOPIFY_STATUS_OPTIONS,
} from '../lib/constants.jsx'

export function StatusPanel({ row: r, onPatch, updating, allRows }) {
  const [draft, setDraft] = useState({
    status: r.status || '',
    current_status: r.current_status || '',
    shopify_promo_status: r.shopify_promo_status || '',
    ginesys_promo_id: r.ginesys_promo_id || '',
    app_promo_id: r.app_promo_id || '',
    shopify_discount_id: r.shopify_discount_id || '',
    remark: r.remark || '',
  })
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState({})

  const isDirty =
    draft.status !== (r.status || '') ||
    draft.current_status !== (r.current_status || '') ||
    draft.shopify_promo_status !== (r.shopify_promo_status || '') ||
    draft.ginesys_promo_id !== (r.ginesys_promo_id || '') ||
    draft.app_promo_id !== (r.app_promo_id || '') ||
    draft.shopify_discount_id !== (r.shopify_discount_id || '') ||
    draft.remark !== (r.remark || '')

  const myRanges = Array.isArray(r.date_ranges) ? r.date_ranges : []
  const overlapping = allRows.filter(other => {
    if (other.id === r.id) return false
    if (other.brand_names !== r.brand_names) return false
    const otherRanges = Array.isArray(other.date_ranges) ? other.date_ranges : []
    return myRanges.some(myR =>
      otherRanges.some(otR =>
        myR.from <= otR.till && myR.till >= otR.from
      )
    )
  })

  const validate = () => {
    const errs = {}
    if (draft.status === 'Promo Created - System' && !draft.ginesys_promo_id.trim()) {
      errs.ginesys = 'Ginesys Promo ID is required when status is "Promo Created - System"'
    }
    if (draft.shopify_promo_status === 'Promo Created in Shopify' && !draft.shopify_discount_id.trim()) {
      errs.shopify = 'Shopify Promo ID is required when Shopify status is "Promo Created in Shopify"'
    }
    return errs
  }

  const handleSave = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    await onPatch(r.id, draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setDraft({
      status: r.status || '',
      current_status: r.current_status || '',
      shopify_promo_status: r.shopify_promo_status || '',
      ginesys_promo_id: r.ginesys_promo_id || '',
      app_promo_id: r.app_promo_id || '',
      shopify_discount_id: r.shopify_discount_id || '',
      remark: r.remark || '',
    })
    setErrors({})
  }

  return (
    <div className="bg-paper rounded-lg p-4 border border-border space-y-4">
      <p className="text-[11px] font-mono uppercase tracking-widest text-muted">Update Status</p>

      {overlapping.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-display font-semibold text-warning mb-2">
            ⚠️ {overlapping.length} overlapping promo{overlapping.length > 1 ? 's' : ''} found for this date range
          </p>
          <div className="space-y-1">
            {overlapping.slice(0, 3).map(o => {
              const ranges = Array.isArray(o.date_ranges) ? o.date_ranges : []
              const first = ranges[0] || {}
              return (
                <p key={o.id} className="text-[11px] font-body text-amber-700">
                  <span className="font-mono font-bold">{o.promo_request_id}</span>
                  {' · '}{o.brand_names}
                  {o.promotion_name ? ` · ${o.promotion_name}` : ''}
                  {first.from ? ` · ${first.from} → ${first.till}` : ''}
                  {' · '}<span className="italic">{o.status}</span>
                </p>
              )
            })}
            {overlapping.length > 3 && <p className="text-[11px] text-muted">+{overlapping.length - 3} more</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          ['Status', 'status', STATUS_OPTIONS],
          ['Current Status', 'current_status', CURRENT_STATUS_OPTIONS],
          ['Shopify Promo Status', 'shopify_promo_status', ['', ...SHOPIFY_STATUS_OPTIONS]],
        ].map(([label, key, opts]) => (
          <div key={key}>
            <label className="text-[10px] font-mono uppercase text-muted mb-1 block">{label}</label>
            <select
              disabled={updating}
              value={draft[key]}
              onChange={e => { setDraft(d => ({ ...d, [key]: e.target.value })); setErrors(ev => ({ ...ev, [key]: undefined })) }}
              className={`w-full bg-white border rounded-lg px-2.5 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 transition-colors ${
                draft[key] !== (r[key] || '') ? 'border-accent' : 'border-border'
              }`}>
              {opts.map(s => <option key={s} value={s}>{s || '—'}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-mono uppercase text-muted mb-1 block">
            Ginesys Promo ID
            {draft.status === 'Promo Created - System' && <span className="text-accent ml-1">*</span>}
          </label>
          <input
            className={`w-full bg-white border rounded-lg px-2.5 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-accent/20 ${
              errors.ginesys ? 'border-danger' : draft.ginesys_promo_id !== (r.ginesys_promo_id || '') ? 'border-accent' : 'border-border'
            }`}
            placeholder="e.g. 001-00038"
            value={draft.ginesys_promo_id}
            onChange={e => { setDraft(d => ({ ...d, ginesys_promo_id: e.target.value })); setErrors(ev => ({ ...ev, ginesys: undefined })) }}
          />
          {errors.ginesys && <p className="text-danger text-[10px] mt-1">{errors.ginesys}</p>}
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase text-muted mb-1 block">
            Shopify Promo ID
            {draft.shopify_promo_status === 'Promo Created in Shopify' && <span className="text-accent ml-1">*</span>}
          </label>
          <input
            className={`w-full bg-white border rounded-lg px-2.5 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-accent/20 ${
              errors.shopify ? 'border-danger' : draft.shopify_discount_id !== (r.shopify_discount_id || '') ? 'border-accent' : 'border-border'
            }`}
            placeholder="e.g. #456"
            value={draft.shopify_discount_id}
            onChange={e => { setDraft(d => ({ ...d, shopify_discount_id: e.target.value })); setErrors(ev => ({ ...ev, shopify: undefined })) }}
          />
          {errors.shopify && <p className="text-danger text-[10px] mt-1">{errors.shopify}</p>}
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase text-muted mb-1 block">App Promo ID</label>
          <input
            className={`w-full bg-white border rounded-lg px-2.5 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-accent/20 ${
              draft.app_promo_id !== (r.app_promo_id || '') ? 'border-accent' : 'border-border'
            }`}
            placeholder="e.g. APP-001"
            value={draft.app_promo_id}
            onChange={e => setDraft(d => ({ ...d, app_promo_id: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-mono uppercase text-muted mb-1 block">
          Comment / Remark
          <span className="text-muted ml-2 normal-case">{(draft.remark || '').length}/200</span>
        </label>
        <textarea
          className={`w-full bg-white border rounded-lg px-2.5 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none ${
            draft.remark !== (r.remark || '') ? 'border-accent' : 'border-border'
          }`}
          rows={2} maxLength={200}
          placeholder="Add a comment or note…"
          value={draft.remark}
          onChange={e => setDraft(d => ({ ...d, remark: e.target.value }))}
        />
      </div>

      <div className="flex gap-4 text-[10px] font-mono text-muted pt-1">
        {r.created_at && (
          <span>Requested: {new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        )}
        {r.updated_at && r.updated_at !== r.created_at && (
          <span>Updated: {new Date(r.updated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        {isDirty && (
          <>
            <button onClick={handleSave} disabled={updating}
              className="flex items-center gap-1.5 bg-accent text-white text-xs font-body px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors">
              {updating ? <Loader2 size={11} className="animate-spin" /> : null}
              {updating ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={handleReset} disabled={updating}
              className="text-xs font-body text-muted hover:text-ink transition-colors">
              Reset
            </button>
          </>
        )}
        {saved && !isDirty && (
          <p className="text-[11px] text-success flex items-center gap-1">✓ Saved successfully</p>
        )}
      </div>
    </div>
  )
}
