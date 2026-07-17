import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { StatusBadge, CurrentStatusDot, exportCSV, fmtDate, todayISO } from '../lib/constants.jsx'
import { Download, RefreshCw, CalendarCheck, CalendarX, Loader2, ExternalLink, Store, Tag } from 'lucide-react'

const STORES = ['All', 'VK, Delhi', 'BH, Hyderabad', 'Pune', 'Mumbai']

function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function isNew(row) {
  if (!row.created_at) return false
  const created = new Date(row.created_at)
  const now = new Date()
  return (now - created) < 2 * 60 * 60 * 1000 // 2 hours
}

export default function TodayPromos() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState('All')
  const today = todayISO()
  const tomorrow = addDays(today, 1)

  const [campaigns, setCampaigns] = useState([])
  const [calTab, setCalTab] = useState('today')
  const [liveCategory, setLiveCategory] = useState('All')
  const [liveBrand, setLiveBrand] = useState('')
  const [campFilter, setCampFilter] = useState('All')

  useEffect(() => {
    // Fetch campaigns only once on mount
    supabase.from('sale_campaigns').select('*').order('start_date', { ascending: false })
      .then(({ data }) => setCampaigns(data || []))
  }, [])

  useEffect(() => { load() }, [store, campFilter])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => { load() }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [store, campFilter])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('promo_requests')
      .select('id,promo_request_id,brand_names,category,store,poc_name,funded_by,offer_type,promotion_name,promo_details,assortment_type,date_ranges,status,current_status,ginesys_promo_id,shopify_discount_id,approval_email,campaign_id,discount_on,sku_file_link,sku_file_name,rsp_file_link,picked_by,picked_at,store_photo_url,store_photo_date,created_at')
      .order('created_at', { ascending: false })
    // Only show approved promos
    const approved = (data || []).filter(r => 
      r.status === 'Promo Created - System' || r.current_status === 'Active'
    )
    setRows(approved)
    setLoading(false)
  }

  const matchDate = (row, field, date) =>
    Array.isArray(row.date_ranges) &&
    row.date_ranges.some(dr => dr[field] === date)

  const matchStore = (row) => {
    if (store === 'All') return true
    return (row.store || '').includes(store)
  }

  const matchCampaign = (row) => {
    if (campFilter === 'All') return true
    return row.campaign_id === campFilter
  }

  const filtered = rows.filter(r => matchStore(r) && matchCampaign(r))

  const isOffline = r => (r.store || '') !== 'Online'
  const startingToday    = filtered.filter(r => matchDate(r, 'from', today) && isOffline(r))
  const endingToday      = filtered.filter(r => matchDate(r, 'till', today) && isOffline(r))
  const startingTomorrow = filtered.filter(r => matchDate(r, 'from', tomorrow) && isOffline(r))
  const endingTomorrow   = filtered.filter(r => matchDate(r, 'till', tomorrow) && isOffline(r))
  const liveToday        = filtered.filter(r => isOffline(r) && Array.isArray(r.date_ranges) && r.date_ranges.some(dr => dr.from <= today && dr.till >= today))
  const liveTodayFiltered = liveToday.filter(r => {
    const matchCat = liveCategory === 'All' || r.category === liveCategory
    const matchBrand = !liveBrand || (r.brand_names || '').toLowerCase().includes(liveBrand.toLowerCase())
    return matchCat && matchBrand
  })
  const liveCategories = ['All', ...new Set(liveToday.map(r => r.category).filter(Boolean).sort())]

  const handlePhotoUpdate = (id, url, date) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, store_photo_url: url, store_photo_date: date } : r))
  }

  const handlePick = async (row) => {
    const alreadyPicked = !!row.picked_by
    const patch = alreadyPicked
      ? { picked_by: null, picked_at: null }
      : { picked_by: user.email, picked_at: new Date().toISOString() }

    await supabase.from('promo_requests').update(patch).eq('id', row.id)
    setRows(r => r.map(x => x.id === row.id ? { ...x, ...patch } : x))
  }

  const toExport = (list) => list.map(r => ({
    promo_request_id: r.promo_request_id || '',
    brand_names: r.brand_names || '',
    category: r.category || '',
    store: r.store || '',
    poc_name: r.poc_name || '',
    promotion_name: r.promotion_name || '',
    promo_details: r.promo_details || '',
    offer_type: r.offer_type || '',
    funded_by: r.funded_by || '',
    date_ranges: JSON.stringify(r.date_ranges),
    status: r.status || '',
    current_status: r.current_status || '',
    picked_by: r.picked_by || '',
    ginesys_promo_id: r.ginesys_promo_id || '',
    shopify_discount_id: r.shopify_discount_id || '',
    sku_file_url: r.sku_file_link || '',
    approval_url: r.approval_email || '',
  }))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Store View</h1>
          <p className="text-muted text-sm font-body mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={load} className="p-2 bg-white border border-border rounded-lg hover:bg-paper transition-colors">
          <RefreshCw size={14} className="text-muted" />
        </button>
      </div>

      {/* Store filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5 text-xs font-mono text-muted uppercase tracking-widest">
          <Store size={12} /> Store
        </div>
        <div className="flex gap-1.5">
          {STORES.map(s => (
            <button key={s} onClick={() => setStore(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-body border transition-colors ${
                store === s
                  ? 'bg-ink text-white border-ink'
                  : 'bg-white text-muted border-border hover:text-ink hover:border-ink'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign filter */}
      {campaigns.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted uppercase tracking-widest">
            <Tag size={12} /> Campaign
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setCampFilter('All')}
              className={`px-3 py-1.5 rounded-lg text-xs font-body border transition-colors ${
                campFilter === 'All' ? 'bg-accent text-white border-accent' : 'bg-white text-muted border-border hover:text-ink'
              }`}>
              All
            </button>
            {campaigns.map(c => (
              <button key={c.id} onClick={() => setCampFilter(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-body border transition-colors ${
                  campFilter === c.id ? 'bg-accent text-white border-accent' : 'bg-white text-muted border-border hover:text-ink'
                }`}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setCalTab('today')}
          className={`px-4 py-1.5 rounded-lg text-xs font-body border transition-colors ${calTab === 'today' ? 'bg-ink text-white border-ink' : 'bg-white text-muted border-border hover:text-ink'}`}>
          Starting / Ending
        </button>
        <button onClick={() => setCalTab('live')}
          className={`px-4 py-1.5 rounded-lg text-xs font-body border transition-colors ${calTab === 'live' ? 'bg-ink text-white border-ink' : 'bg-white text-muted border-border hover:text-ink'}`}>
          Live Today ({liveToday.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48 gap-2 text-muted">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : calTab === 'live' ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={liveCategory}
              onChange={e => setLiveCategory(e.target.value)}
              className="text-sm font-body px-3 py-2 rounded-xl border border-border bg-white focus:outline-none">
              {liveCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="text"
              placeholder="Search brand..."
              value={liveBrand}
              onChange={e => setLiveBrand(e.target.value)}
              className="text-sm font-body px-3 py-2 rounded-xl border border-border bg-white focus:outline-none flex-1 min-w-0"
            />
            {(liveCategory !== 'All' || liveBrand) && (
              <button onClick={() => { setLiveCategory('All'); setLiveBrand('') }}
                className="text-xs text-muted hover:text-ink font-body">
                Clear
              </button>
            )}
            <span className="text-xs text-muted font-body">{liveTodayFiltered.length} promos</span>
          </div>
          <PromoGroup
            campaigns={campaigns}
            title="Live Today (Offline)"
            icon={<CalendarCheck size={15} className="text-accent" />}
            color="text-accent"
            bg="bg-violet-50"
            border="border-violet-200"
            rows={liveTodayFiltered}
            event="live"
            matchDate={today}
            onExport={() => exportCSV(toExport(liveTodayFiltered), `live-today-${today}.csv`)}
            onPick={handlePick}
            currentUserEmail={user?.email}
            onPhotoUpdate={handlePhotoUpdate}
          />
        </div>
      ) : (
        <div className="space-y-8">

          {/* TODAY — side by side */}
          <div>
            <p className="font-display font-bold text-lg text-ink mb-3">
              Today — <span className="text-muted font-normal text-base">{fmtDate(today)}</span>
            </p>
            <div className="grid grid-cols-1 gap-4">
              <PromoGroup
campaigns={campaigns}                 title="Starting Today"
                icon={<CalendarCheck size={15} className="text-success" />}
                color="text-success"
                bg="bg-emerald-50"
                border="border-emerald-200"
                rows={startingToday}
                event="starting"
                matchDate={today}
                onExport={() => exportCSV(toExport(startingToday), `starting-today-${today}.csv`)}
                onPick={handlePick}
                currentUserEmail={user?.email}
                onPhotoUpdate={handlePhotoUpdate}
              />
              <PromoGroup
campaigns={campaigns}                 title="Ending Today"
                icon={<CalendarX size={15} className="text-danger" />}
                color="text-danger"
                bg="bg-red-50"
                border="border-red-200"
                rows={endingToday}
                event="ending"
                matchDate={today}
                onExport={() => exportCSV(toExport(endingToday), `ending-today-${today}.csv`)}
                onPick={handlePick}
                currentUserEmail={user?.email}
                onPhotoUpdate={handlePhotoUpdate}
              />
            </div>
          </div>

          {/* TOMORROW — side by side */}
          <div>
            <p className="font-display font-bold text-lg text-ink mb-3">
              Tomorrow — <span className="text-muted font-normal text-base">{fmtDate(tomorrow)}</span>
            </p>
            <div className="grid grid-cols-1 gap-4">
              <PromoGroup
campaigns={campaigns}                 title="Starting Tomorrow"
                icon={<CalendarCheck size={15} className="text-info" />}
                color="text-info"
                bg="bg-blue-50"
                border="border-blue-200"
                rows={startingTomorrow}
                event="starting"
                matchDate={tomorrow}
                onExport={() => exportCSV(toExport(startingTomorrow), `starting-tomorrow-${today}.csv`)}
                onPick={handlePick}
                currentUserEmail={user?.email}
                onPhotoUpdate={handlePhotoUpdate}
              />
              <PromoGroup
campaigns={campaigns}                 title="Ending Tomorrow"
                icon={<CalendarX size={15} className="text-warning" />}
                color="text-warning"
                bg="bg-amber-50"
                border="border-amber-200"
                rows={endingTomorrow}
                event="ending"
                matchDate={tomorrow}
                onExport={() => exportCSV(toExport(endingTomorrow), `ending-tomorrow-${today}.csv`)}
                onPick={handlePick}
                currentUserEmail={user?.email}
                onPhotoUpdate={handlePhotoUpdate}
              />
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

function PromoGroup({ title, icon, color, bg, border, rows, event, matchDate, onExport, onPick, currentUserEmail, campaigns = [], onPhotoUpdate }) {
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      {/* Group header */}
      <div className={`flex items-center justify-between px-4 py-3 ${bg} border-b ${border}`}>
        <div className="flex items-center gap-1.5">
          {icon}
          <span className={`font-display font-semibold text-sm ${color}`}>{title}</span>
          <span className="font-mono text-xs text-muted">({rows.length})</span>
        </div>
        {rows.length > 0 && (
          <button onClick={onExport}
            className={`flex items-center gap-1 text-[11px] font-body font-medium px-2 py-1 rounded border ${bg} ${border} ${color} hover:opacity-70 transition-opacity`}>
            <Download size={10} /> CSV
          </button>
        )}
      </div>

      {/* Cards */}
      {rows.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-body text-muted opacity-60">Nothing here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-3">
          {rows.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-border overflow-hidden">
              <PromoCard
                row={r}
                event={event}
                matchDate={matchDate}
                color={color}
                border={border}
                onPick={onPick}
                currentUserEmail={currentUserEmail}
                campaigns={campaigns}
                onPhotoUpdate={onPhotoUpdate}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PromoCard({ row: r, event, matchDate, color, onPick, currentUserEmail, campaigns = [], onPhotoUpdate }) {
  const isPicked = !!r.picked_by
  const isNewPromo = isNew(r)
  const pickedByMe = r.picked_by === currentUserEmail
  const [photoUploading, setPhotoUploading] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const hasPhoto = !!r.store_photo_url
  const hasPhotoToday = r.store_photo_url && r.store_photo_date === today
  const photoLabel = hasPhotoToday ? 'Replace' : hasPhoto ? 'Update photo' : 'Take photo'

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const safeId = (r.promo_request_id || '').replace(/[^a-zA-Z0-9]/g, '_')
      const path = `store-photos/${today}_${safeId}.${ext}`
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session email:', session?.user?.email)
      const { error: storageErr } = await supabase.storage.from('promo-files').upload(path, file, { upsert: true })
      console.log('Storage error:', storageErr)
      if (storageErr) throw storageErr
      const { data: { publicUrl } } = supabase.storage.from('promo-files').getPublicUrl(path)
      console.log('Public URL:', publicUrl)
      const { error: rpcErr } = await supabase.rpc('update_store_photo', { p_id: r.id, p_url: publicUrl, p_date: today })
      console.log('RPC error:', rpcErr)
      if (rpcErr) throw rpcErr
      console.log('calling onPhotoUpdate', r.id, publicUrl, today)
      if (onPhotoUpdate) onPhotoUpdate(r.id, publicUrl, today)
      else console.log('onPhotoUpdate is not defined!')
    } catch (err) {
      alert('Photo upload failed: ' + err.message)
    }
    setPhotoUploading(false)
  }

  const relevantRanges = (r.date_ranges || []).filter(dr =>
    event === 'starting' ? dr.from === matchDate : dr.till === matchDate
  )

  const handlePickClick = () => {
    if (isPicked && pickedByMe) {
      if (!window.confirm("Are you sure you want to unmark this promo as picked?")) return
    } else if (isPicked && !pickedByMe) {
      const confirmed = window.confirm(
        `This was already picked by ${r.picked_by?.split('@')[0]}. Are you sure you want to change it?`
      )
      if (!confirmed) return
    }
    onPick(r)
  }

  return (
    <div className={`p-4 transition-colors ${
      isNewPromo && !isPicked
        ? 'border-l-4 border-l-accent bg-orange-50/30'
        : isPicked
        ? 'bg-gray-50'
        : ''
    }`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="font-mono text-[11px] text-muted">{r.promo_request_id}</span>
          {isNewPromo && !isPicked && (
            <span className="text-[10px] font-mono font-bold bg-accent text-white px-1.5 py-0.5 rounded-full animate-pulse">NEW</span>
          )}
          <StatusBadge status={r.status} />
          <CurrentStatusDot status={r.current_status} />
          {r.campaign_id && (() => {
            const camp = campaigns.find(c => c.id === r.campaign_id)
            return camp ? (
              <span className="text-[10px] font-mono bg-orange-100 text-accent px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Tag size={9} /> {camp.name}
              </span>
            ) : null
          })()}
        </div>

        {/* placeholder — action row moved below */}
        <div />
      </div>

      {/* Action row — pick + photo */}
      <div className="flex gap-2 mb-2">
        <button
          onClick={handlePickClick}
          className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-body px-3 py-2.5 rounded-xl border transition-colors ${
            isPicked
              ? 'bg-emerald-50 text-success border-emerald-200 font-medium'
              : 'bg-white text-muted border-border hover:border-ink hover:text-ink'
          }`}>
          {isPicked ? '✓ Picked' : '○ Mark as Picked'}
        </button>
        <label className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-body cursor-pointer px-3 py-2.5 rounded-xl border border-border bg-white hover:bg-paper transition-colors ${photoUploading ? 'opacity-50 text-muted' : 'text-muted hover:text-ink'}`}>
          {photoUploading ? <Loader2 size={12} className="animate-spin" /> : '📷'}
          {photoUploading ? 'Uploading…' : photoLabel}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} disabled={photoUploading} />
        </label>
      </div>

      {/* Status row — last picked + photo date */}
      <div className={`flex justify-between items-center px-3 py-2 rounded-lg mb-3 text-xs font-body border ${
        isPicked ? 'bg-emerald-50 border-emerald-200' : 'bg-paper border-border'
      }`}>
        <span className={isPicked ? 'text-success font-medium' : 'text-muted'}>
          {isPicked
            ? `${r.picked_at && new Date(r.picked_at).toISOString().split('T')[0] === today ? 'Picked today' : `Last picked: ${fmtDate(r.picked_at?.split('T')[0])}`} · ${r.picked_by?.split('@')[0]}`
            : 'Last picked: never'}
        </span>
        {hasPhoto && (
          <a href={r.store_photo_url} target="_blank" rel="noreferrer" className="flex items-center gap-1">
            <img src={r.store_photo_url} alt="photo" className="h-6 w-6 object-cover rounded border border-border" />
            <span className={`text-[11px] ${isPicked ? 'text-success' : 'text-muted'}`}>{r.store_photo_date ? fmtDate(r.store_photo_date) : ''}</span>
          </a>
        )}
        {!hasPhoto && <span className={isPicked ? 'text-success/60' : 'text-muted'}>No photo yet</span>}
      </div>

      {/* Brand + identity */}
      <p className="font-display font-bold text-base text-ink">{r.brand_names}</p>
      <p className="text-xs text-muted mt-0.5">
        {r.category}{r.store ? ` · ${r.store}` : ''} · POC: {r.poc_name}
      </p>

      {/* All promo details */}
      <div className="mt-2 space-y-1">
        {r.promo_details && <p className="text-xs font-body text-ink">{r.promo_details}</p>}
        {r.promotion_name && <p className="text-[11px] text-muted">📌 {r.promotion_name}</p>}
      </div>

      {/* Date ranges */}
      {relevantRanges.map((dr, i) => (
        <p key={i} className={`text-[11px] font-mono mt-2 font-medium ${color}`}>
          {event === 'starting' ? '▶ Starts' : '⏹ Ends'} {fmtDate(matchDate)}
          <span className="text-muted font-normal ml-1">(Full range: {fmtDate(dr.from)} → {fmtDate(dr.till)})</span>
        </p>
      ))}





      {/* Footer details */}
      <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-border/50 text-[11px] text-muted">
        {r.offer_type && <span className="font-medium text-ink">{r.offer_type}</span>}
        {r.funded_by && <span>Funded: <b className="text-ink">{r.funded_by}</b></span>}
        {r.assortment_type && <span>{r.assortment_type}</span>}
        {r.ginesys_promo_id && <span className="font-mono">Ginesys: {r.ginesys_promo_id}</span>}
        {r.shopify_discount_id && <span className="font-mono">Shopify: {r.shopify_discount_id}</span>}
        {r.approval_email && (
          <a href={r.approval_email} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent hover:underline">
            <ExternalLink size={9} /> Approval
          </a>
        )}
        {r.sku_file_link && (
          <a href={r.sku_file_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent hover:underline">
            <ExternalLink size={9} /> SKU File
          </a>
        )}
        {r.rsp_file_link && (
          <a href={r.rsp_file_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent hover:underline">
            <ExternalLink size={9} /> RSP File
          </a>
        )}
      </div>
    </div>
  )
}
