import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Loader2, Trash2, Plus, ShieldCheck, AlertCircle } from 'lucide-react'

export default function AdminPage() {
  const { user, isAdmin } = useAuth()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => { loadAdmins() }, [])

  const loadAdmins = async () => {
    setLoading(true)
    const { data } = await supabase.from('admins').select('*').order('added_at')
    setAdmins(data || [])
    setLoading(false)
  }

  const addAdmin = async () => {
    setError(null); setSuccess(null)
    const email = newEmail.trim().toLowerCase()
    if (!email.endsWith('@broadwaylive.in')) {
      setError('Only @broadwaylive.in emails can be admins.')
      return
    }
    setAdding(true)
    const { error: err } = await supabase.from('admins').insert([{
      email,
      added_by: user.email,
    }])
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

  if (!isAdmin) return (
    <div className="max-w-lg mx-auto mt-24 text-center px-4">
      <ShieldCheck size={32} className="mx-auto mb-4 text-muted opacity-30" />
      <p className="font-display font-bold text-xl text-ink mb-2">Admin access only</p>
      <p className="text-muted text-sm">You don't have permission to view this page.</p>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto px-4 py-8 fade-in">
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
        {success && (
          <p className="text-success text-xs mt-2">✓ {success}</p>
        )}
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
  )
}
