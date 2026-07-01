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
  const OFFLINE_STORES = ['VK, Delhi', 'BH, Hyderabad', 'Pune', 'Mumbai']

  // Determine current channel from selected value
  const isOnline = selected === 'Online' || (Array.isArray(selected) && selected.includes('Online') && selected.length === 1)
  const isOffline = !isOnline
  const channel = isOnline ? 'Online' : (Array.isArray(selected) && selected.length > 0 ? 'Offline' : '')

  const offlineSelected = Array.isArray(selected) ? selected.filter(s => s !== 'Online') : []

  const handleChannel = (ch) => {
    if (ch === 'Online') onChange(['Online'])
    else onChange([])
  }

  const toggle = (s) => {
    const next = offlineSelected.includes(s)
      ? offlineSelected.filter(x => x !== s)
      : [...offlineSelected, s]
    onChange(next)
  }

  return (
    <div className="space-y-3 mt-1">
      <div className="flex gap-2">
        {['Offline', 'Online'].map(ch => (
          <button key={ch} type="button" onClick={() => handleChannel(ch)}
            className={`px-4 py-1.5 rounded-lg text-xs font-body border transition-colors ${
              channel === ch
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-muted border-border hover:border-ink hover:text-ink'
            }`}>
            {ch}
          </button>
        ))}
      </div>
      {channel === 'Offline' && (
        <div className="flex flex-wrap gap-2">
          {OFFLINE_STORES.map(s => (
            <button key={s} type="button" onClick={() => toggle(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-body border transition-colors ${
                offlineSelected.includes(s)
                  ? 'bg-ink text-white border-ink'
                  : 'bg-white text-muted border-border hover:border-ink hover:text-ink'
              }`}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
