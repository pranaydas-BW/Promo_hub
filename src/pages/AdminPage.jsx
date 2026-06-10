import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Loader2, Trash2, Plus, ShieldCheck, AlertCircle, Tag, Calendar } from 'lucide-react'

export default function AdminPage() {
  const { user, isAdmin } = useAuth()

  // ── Admin management ────────────────────────────────────────────────────────
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // ── Sale campaigns ──────────────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState([])
  const [campLoading, setCampLoading] = useState(true)
  const [campForm, setCampForm] = useState({ name: '', start_date: '', end_date: '' })
  const [campAdding, setCampAdding] = useState(false)
  const [campError, setCampError] = useState(null)
  const [campSuccess, setCampSuccess] = useState(null)

  useEffect(() => { loadAdmins(); loadCampaigns() }, [])

  const loadAdmins = async () => {
    setLoading(true)
    const { data } = await supabase.from('admins').select('*').order('added_at')
    setAdmins(data || [])
    setLoading(false)
  }

  const loadCampaigns = async () => {
    setCampLoading(true)
    const { data } = await supabase.from('sale_campaigns').select('*').order('start_date', { ascending: false })
    setCampaigns(data || [])
    setCampLoading(false)
  }

  const addAdmin = async () => {
    setError(null); setSuccess(null)
    const email = newEmail.trim().toLowerCase()
    if (!email.endsWith('@broadwaylive.in')) {
      setError('Only @broadwaylive.in emails can be admins.')
      return
    }
    setAdding(true)
    const { error: err } = await supabase.from('admins').insert([{ email, added_by: user.email }])
    setAdding(false)
    if (err) {
      setError(err.code === '23505' ? 'This email is already an admin.' : err.message)
    } else {
      setSuccess(`${email} added as admin.`)
      setNewEmail('')
      loadAdmins()
    }
  }

  const removeAdmin = async (email) => {
    if (email === user.email) { setError("You can't remove yourself."); return }
    if (!confirm(`Remove ${email} as admin?`)) return
    await supabase.from('admins').delete().eq('email', email)
    loadAdmins()
  }

  const addCampaign = async () => {
    setCampError(null); setCampSuccess(null)
    const { name, start_date, end_date } = campForm
    if (!name.trim()) { setCampError('Campaign name is required.'); return }
    if (!start_date || !end_date) { setCampError('Start and end dates are required.'); return }
    if (end_date < start_date) { setCampError('End date must be after start date.'); return }
    setCampAdding(true)
    const { error: err } = await supabase.from('sale_campaigns').insert([{ name: name.trim(), start_date, end_date }])
    setCampAdding(false)
    if (err) {
      setCampError(err.message)
    } else {
      setCampSuccess(`"${name.trim()}" campaign created.`)
      setCampForm({ name: '', start_date: '', end_date: '' })
      loadCampaigns()
    }
  }

  const deleteCampaign = async (id, name) => {
    if (!confirm(`Delete campaign "${name}"? Promos tagged to it will lose the tag.`)) return
    await supabase.from('sale_campaigns').delete().eq('id', id)
    loadCampaigns()
  }

  const getCampaignStatus = (c) => {
    const today = new Date().toISOString().slice(0, 10)
    if (today < c.start_date) return { label: 'Upcoming', cls: 'bg-blue-50 text-blue-600' }
    if (today > c.end_date) return { label: 'Ended', cls: 'bg-gray-100 text-gray-500' }
    return { label: 'Active', cls: 'bg-emerald-50 text-emerald-600' }
  }

  const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  if (!isAdmin) return (
    <div className="max-w-lg mx-auto mt-24 text-center px-4">
      <ShieldCheck size={32} className="mx-auto mb-4 text-muted opacity-30" />
      <p className="font-display font-bold text-xl text-ink mb-2">Admin access only</p>
      <p className="text-muted text-sm">You don't have permission to view this page.</p>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto px-4 py-8 fade-in">

      {/* ── Sale Campaigns ─────────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-ink flex items-center gap-2">
            <Tag size={24} className="text-accent" /> Sale Campaigns
          </h1>
          <p className="text-muted text-sm font-body mt-0.5">Active campaigns appear as a tag option in New Request form.</p>
        </div>

        {/* Add campaign */}
        <div className="bg-white border border-border rounded-xl p-5 mb-6">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted mb-3">Create New Campaign</p>
          <div className="flex flex-col gap-3">
            <input
              className="w-full bg-paper border border-border rounded-lg px-3.5 py-2.5 text-sm font-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              placeholder="Campaign name (e.g. EOSS Jun 2026)"
              value={campForm.name}
              onChange={e => setCampForm(f => ({ ...f, name: e.target.value }))}
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-mono uppercase text-muted mb-1 block">Start Date</label>
                <input
                  type="date"
                  className="w-full bg-paper border border-border rounded-lg px-3 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  value={campForm.start_date}
                  onChange={e => setCampForm(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-mono uppercase text-muted mb-1 block">End Date</label>
                <input
                  type="date"
                  className="w-full bg-paper border border-border rounded-lg px-3 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  value={campForm.end_date}
                  onChange={e => setCampForm(f => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            <button onClick={addCampaign} disabled={campAdding}
              className="flex items-center justify-center gap-1.5 bg-accent text-white text-sm font-body px-4 py-2.5 rounded-lg hover:bg-orange-700 disabled:opacity-40 transition-colors">
              {campAdding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Create Campaign
            </button>
          </div>
          {campError && (
            <p className="text-danger text-xs mt-2 flex items-center gap-1.5">
              <AlertCircle size={11} /> {campError}
            </p>
          )}
          {campSuccess && <p className="text-success text-xs mt-2">✓ {campSuccess}</p>}
        </div>

        {/* Campaign list */}
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-paper">
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted">All Campaigns ({campaigns.length})</p>
          </div>
          {campLoading ? (
            <div className="flex justify-center items-center h-24 gap-2 text-muted">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="px-5 py-8 text-center text-muted text-sm font-body">No campaigns yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {campaigns.map(c => {
                const status = getCampaignStatus(c)
                return (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-body text-ink font-medium">{c.name}</p>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
                      </div>
                      <p className="text-[11px] text-muted font-body flex items-center gap-1">
                        <Calendar size={10} /> {fmtDate(c.start_date)} → {fmtDate(c.end_date)}
                      </p>
                    </div>
                    <button onClick={() => deleteCampaign(c.id, c.name)}
                      className="text-muted hover:text-danger transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Admin Management ───────────────────────────────────────────────── */}
      <div>
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-ink">Admin Management</h1>
          <p className="text-muted text-sm font-body mt-0.5">Manage who has admin access to PromoHub.</p>
        </div>

        {/* Add new admin */}
        <div className="bg-white border border-border rounded-xl p-5 mb-6">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted mb-3">Add New Admin</p>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-paper border border-border rounded-lg px-3.5 py-2.5 text-sm font-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              placeholder="name@broadwaylive.in"
              type="email"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setError(null); setSuccess(null) }}
              onKeyDown={e => e.key === 'Enter' && addAdmin()}
            />
            <button onClick={addAdmin} disabled={adding || !newEmail.trim()}
              className="flex items-center gap-1.5 bg-accent text-white text-sm font-body px-4 py-2.5 rounded-lg hover:bg-orange-700 disabled:opacity-40 transition-colors">
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add
            </button>
          </div>
          {error && (
            <p className="text-danger text-xs mt-2 flex items-center gap-1.5">
              <AlertCircle size={11} /> {error}
            </p>
          )}
          {success && <p className="text-success text-xs mt-2">✓ {success}</p>}
        </div>

        {/* Admin list */}
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-paper">
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted">Current Admins ({admins.length})</p>
          </div>
          {loading ? (
            <div className="flex justify-center items-center h-24 gap-2 text-muted">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {admins.map(a => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-body text-ink font-medium">{a.email}</p>
                    <p className="text-[11px] text-muted font-body mt-0.5">
                      Added {new Date(a.added_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {a.added_by && a.added_by !== 'system' && ` by ${a.added_by}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.email === user?.email && (
                      <span className="text-[10px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full">You</span>
                    )}
                    <button onClick={() => removeAdmin(a.email)}
                      className="text-muted hover:text-danger transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
