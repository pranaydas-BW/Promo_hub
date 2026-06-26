export function Section({ title, children }) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 space-y-4">
      <h3 className="font-display font-semibold text-[11px] uppercase tracking-widest text-muted">{title}</h3>
      {children}
    </div>
  )
}

export function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink mb-1.5">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  )
}

export function StoreToggle({ selected = [], onChange }) {
  const STORES = ['VK, Delhi', 'BH, Hyderabad', 'Pune', 'Mumbai', 'Online']
  const toggle = (s) => onChange(
    selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s]
  )
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {STORES.map(s => (
        <button key={s} type="button" onClick={() => toggle(s)}
          className={`px-3 py-1.5 rounded-lg text-xs font-body border transition-colors ${
            selected.includes(s)
              ? 'bg-ink text-white border-ink'
              : 'bg-white text-muted border-border hover:border-ink hover:text-ink'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
