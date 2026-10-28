import { Field } from './FormParts'
import { Plus, Trash2 } from 'lucide-react'

export const PROMO_MECHANICS = [
  { id: 'flat', label: 'Flat % off' },
  { id: 'upto', label: 'Upto % off' },
  { id: 'amt', label: 'Flat ₹ off' },
  { id: 'bogo', label: 'Buy N get M free' },
  { id: 'tiered', label: 'Tiered (buy more, save more)' },
  { id: 'spend', label: 'Spend threshold' },
  { id: 'tieredSpend', label: 'Tiered spend threshold' },
  { id: 'gift', label: 'Free gift' },
  { id: 'other', label: 'Other' },
]
export const PROMO_EVENTS = ['BAU', 'EOSS', 'Festive Offer', 'Broadway Exclusive', 'Brand Exclusive']
export const PROMO_PRIORITIES = ['P0', 'P1']

export const mechanicLabel = (id) => PROMO_MECHANICS.find(m => m.id === id)?.label || ''

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const blank = (x) => x === '' || x == null
const v = (x) => (blank(x) ? '__' : String(x).trim() || '__')
const money = (x) => {
  if (blank(x)) return '__'
  const n = Number(String(x).replace(/,/g, ''))
  return isFinite(n) ? n.toLocaleString('en-IN') : String(x)
}
const num = (x) => {
  if (blank(x)) return null
  const n = Number(String(x).replace(/,/g, ''))
  return isFinite(n) ? n : null
}

// Builds the standardised promotion name. Unfilled values appear as "__".
export function buildPromoName(mechanic, p = {}) {
  p = p || {}
  const tiers = Array.isArray(p.tiers) ? p.tiers : []
  const spendTiers = Array.isArray(p.spendTiers) ? p.spendTiers : []
  const unit = p.unit || '%'
  let name = ''
  switch (mechanic) {
    case 'flat': name = `Flat ${v(p.pct)}% off`; break
    case 'upto': name = `Upto ${v(p.pct)}% off`; break
    case 'amt': name = `Flat ₹${money(p.amt)} off`; break
    case 'bogo': name = `Buy ${v(p.buyN)} Get ${v(p.getM)} Free`; break
    case 'tiered': name = tiers.map(t => `Buy ${v(t.q)} - ${v(t.p)}% off`).join('; '); break
    case 'spend': name = `Spend ₹${money(p.minSpend)} - ${v(p.pct)}% off`; break
    case 'tieredSpend':
      name = spendTiers.map(t => `Spend ₹${money(t.q)} - ${unit === '%' ? `${v(t.p)}% off` : `₹${money(t.p)} off`}`).join('; ')
      break
    case 'gift': name = `Spend ₹${money(p.minSpend)} - Free ${v(p.freeItem)}`; break
    case 'other': name = v(p.text); break
    default: name = ''
  }
  return name || '__'
}

export const isPromoNameComplete = (name) => !!name && name !== '__' && !name.includes('__')

// Clean, typed version of the params stored in promo_requests.mechanic_params
export function normalizeParams(mechanic, p = {}) {
  p = p || {}
  switch (mechanic) {
    case 'flat':
    case 'upto': return { pct: num(p.pct) }
    case 'amt': return { amt: num(p.amt) }
    case 'bogo': return { buyN: num(p.buyN), getM: num(p.getM) }
    case 'tiered': return { tiers: (p.tiers || []).map(t => ({ buy: num(t.q), pct: num(t.p) })) }
    case 'spend': return { minSpend: num(p.minSpend), pct: num(p.pct) }
    case 'tieredSpend': return { unit: p.unit || '%', tiers: (p.spendTiers || []).map(t => ({ spend: num(t.q), value: num(t.p) })) }
    case 'gift': return { minSpend: num(p.minSpend), freeItem: (p.freeItem || '').trim() }
    case 'other': return { text: (p.text || '').trim() }
    default: return {}
  }
}

// Converts stored mechanic_params back into the string-based shape the form inputs use
export function formParamsFromStored(mechanic, s) {
  s = s || {}
  const str = (x) => (x == null ? '' : String(x))
  switch (mechanic) {
    case 'flat':
    case 'upto': return { pct: str(s.pct) }
    case 'amt': return { amt: str(s.amt) }
    case 'bogo': return { buyN: str(s.buyN), getM: str(s.getM) }
    case 'tiered': return { tiers: (s.tiers || []).map(t => ({ q: str(t.buy), p: str(t.pct) })) }
    case 'spend': return { minSpend: str(s.minSpend), pct: str(s.pct) }
    case 'tieredSpend': return { unit: s.unit || '%', spendTiers: (s.tiers || []).map(t => ({ q: str(t.spend), p: str(t.value) })) }
    case 'gift': return { minSpend: str(s.minSpend), freeItem: str(s.freeItem) }
    case 'other': return { text: str(s.text) }
    default: return {}
  }
}

// Returns an error message, or '' when the promo mechanic section is valid
export function promoMechanicError(form) {
  if (!form.promo_mechanic) return 'Please choose a promo mechanic.'
  const name = buildPromoName(form.promo_mechanic, form.mechanic_params)
  if (!isPromoNameComplete(name)) return 'Please fill in every blank (__) in the promo mechanic.'
  if (!form.promo_event) return 'Please choose an event / tier.'
  return ''
}

function Pill({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-body border transition-colors ${
        active ? 'bg-ink text-white border-ink' : 'bg-white text-muted border-border hover:border-ink hover:text-ink'
      }`}>
      {children}
    </button>
  )
}

const SIMPLE_FIELDS = {
  flat: [{ key: 'pct', label: 'Discount', suffix: '%' }],
  upto: [{ key: 'pct', label: 'Maximum discount', suffix: '%' }],
  amt: [{ key: 'amt', label: 'Amount off', prefix: '₹' }],
  bogo: [{ key: 'buyN', label: 'Buy quantity' }, { key: 'getM', label: 'Get free quantity' }],
  spend: [{ key: 'minSpend', label: 'Minimum spend', prefix: '₹' }, { key: 'pct', label: 'Discount', suffix: '%' }],
  gift: [{ key: 'minSpend', label: 'Minimum spend', prefix: '₹' }, { key: 'freeItem', label: 'Free item (SKU or name)' }],
  other: [{ key: 'text', label: 'Describe the offer' }],
}

export default function PromoMechanicFields({ form, set, validFrom }) {
  const mechanic = form.promo_mechanic || ''
  const params = form.mechanic_params || {}
  const setParams = (patch) => set('mechanic_params', { ...params, ...patch })

  const pickMechanic = (id) => {
    set('promo_mechanic', id)
    // make sure a table mechanic always starts with one row
    const next = { ...params }
    if (id === 'tiered' && !(next.tiers || []).length) next.tiers = [{ q: '1', p: '' }]
    if (id === 'tieredSpend') {
      if (!(next.spendTiers || []).length) next.spendTiers = [{ q: '', p: '' }]
      if (!next.unit) next.unit = '%'
    }
    set('mechanic_params', next)
  }

  const isSpendTiers = mechanic === 'tieredSpend'
  const isTierTable = mechanic === 'tiered' || isSpendTiers
  const tierKey = isSpendTiers ? 'spendTiers' : 'tiers'
  const tierList = params[tierKey] || []
  const unit = params.unit || '%'
  const setTiers = (next) => setParams({ [tierKey]: next })

  const name = mechanic ? buildPromoName(mechanic, params) : ''
  const complete = isPromoNameComplete(name)
  const month = validFrom ? MONTHS[Number(String(validFrom).slice(5, 7)) - 1] : ''

  return (
    <div className="space-y-4">
      <Field label="Promo Mechanic" required>
        <div className="flex flex-wrap gap-2">
          {PROMO_MECHANICS.map(m => (
            <Pill key={m.id} active={mechanic === m.id} onClick={() => pickMechanic(m.id)}>{m.label}</Pill>
          ))}
        </div>
      </Field>

      {isTierTable && (
        <div className="space-y-3">
          {isSpendTiers && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Discount given as</span>
              {['%', '₹'].map(u => (
                <Pill key={u} active={unit === u} onClick={() => setParams({ unit: u })}>{u}</Pill>
              ))}
            </div>
          )}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_36px] gap-3 bg-paper px-3 py-2 text-[11px] uppercase tracking-wide text-muted">
              <div>{isSpendTiers ? 'Spend (₹)' : 'Buy (quantity)'}</div>
              <div>{isSpendTiers ? (unit === '%' ? 'Discount (%)' : 'Discount (₹ off)') : 'Discount (% off)'}</div>
              <div />
            </div>
            {tierList.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_36px] gap-3 items-center px-3 py-2 border-t border-border">
                <div className="flex items-center gap-1.5">
                  {isSpendTiers && <span className="text-sm text-muted">₹</span>}
                  <input className="input-field" inputMode="decimal" aria-label={isSpendTiers ? 'Spend amount' : 'Buy quantity'}
                    value={t.q} onChange={e => setTiers(tierList.map((x, j) => j === i ? { ...x, q: e.target.value } : x))} />
                </div>
                <div className="flex items-center gap-1.5">
                  {isSpendTiers && unit === '₹' && <span className="text-sm text-muted">₹</span>}
                  <input className="input-field" inputMode="decimal" aria-label="Discount"
                    value={t.p} onChange={e => setTiers(tierList.map((x, j) => j === i ? { ...x, p: e.target.value } : x))} />
                  {(!isSpendTiers || unit === '%') && <span className="text-sm text-muted">%</span>}
                </div>
                <button type="button" aria-label="Remove row" disabled={tierList.length <= 1}
                  onClick={() => setTiers(tierList.filter((_, j) => j !== i))}
                  className="text-muted hover:text-danger disabled:opacity-30 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button type="button"
            onClick={() => setTiers([...tierList, { q: isSpendTiers ? '' : String(tierList.length + 1), p: '' }])}
            className="flex items-center gap-1.5 text-sm text-accent font-body hover:underline">
            <Plus size={13} /> Add row
          </button>
        </div>
      )}

      {mechanic && !isTierTable && (
        <div className="grid grid-cols-2 gap-3">
          {(SIMPLE_FIELDS[mechanic] || []).map(f => (
            <Field key={f.key} label={f.label} required>
              <div className="flex items-center gap-1.5">
                {f.prefix && <span className="text-sm text-muted">{f.prefix}</span>}
                <input className="input-field" value={params[f.key] ?? ''}
                  onChange={e => setParams({ [f.key]: e.target.value })} />
                {f.suffix && <span className="text-sm text-muted">{f.suffix}</span>}
              </div>
            </Field>
          ))}
        </div>
      )}

      <Field label="Event / Tier" required>
        <div className="flex flex-wrap gap-2">
          {PROMO_EVENTS.map(ev => (
            <Pill key={ev} active={form.promo_event === ev} onClick={() => set('promo_event', ev)}>{ev}</Pill>
          ))}
        </div>
      </Field>

      <div className="flex flex-wrap gap-8">
        <Field label="Priority">
          <div className="flex gap-2">
            <Pill active={!form.promo_priority} onClick={() => set('promo_priority', '')}>None</Pill>
            {PROMO_PRIORITIES.map(p => (
              <Pill key={p} active={form.promo_priority === p} onClick={() => set('promo_priority', p)}>{p}</Pill>
            ))}
          </div>
        </Field>
        <Field label="Month" hint="Taken from the Valid From date">
          <div className="text-sm font-body text-ink py-1.5">{month || '—'}</div>
        </Field>
      </div>

      <div className="rounded-xl bg-ink text-white p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-[11px] uppercase tracking-widest text-white/60">Promotion name preview</span>
          {mechanic && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
              complete ? 'bg-emerald-900 text-emerald-200' : 'bg-amber-900 text-amber-200'
            }`}>{complete ? 'Complete' : 'Incomplete'}</span>
          )}
        </div>
        <p className="font-display text-lg font-semibold leading-snug">
          {mechanic ? name : 'Choose a promo mechanic to see the promotion name'}
        </p>
        {mechanic && (
          <p className="text-[11px] text-white/60 mt-1.5">
            {complete ? 'This is the name shown on the Board and in exports.' : 'Fill the blanks (__) to complete the name.'}
          </p>
        )}
      </div>
    </div>
  )
}
