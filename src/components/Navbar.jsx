import { Link, useLocation } from 'react-router-dom'
import { Tag, LayoutDashboard, PlusCircle, BarChart2, CalendarClock, ShieldCheck, LogOut, BookMarked } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

const links = [
  { to: '/',          label: 'Board',       icon: LayoutDashboard },
  { to: '/new',       label: 'New Request', icon: PlusCircle },
  { to: '/today',     label: 'Store View',  icon: CalendarClock },
  { to: '/store-request', label: 'Store Request', icon: Store },
  { to: '/brands',    label: 'Brands',      icon: BookMarked },
  { to: '/analytics', label: 'Analytics',   icon: BarChart2 },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const { user, isAdmin, signOut } = useAuth()

  const visibleLinks = links.filter(l => !l.adminOnly || isAdmin)

  return (
    <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center">
            <Tag size={13} className="text-white" />
          </div>
          <span className="font-display font-bold text-base text-ink">
            Broadway <span className="text-accent">Promos</span>
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 overflow-x-auto">
          {visibleLinks.map(({ to, label, icon: Icon }) => {
            const active = pathname === to
            return (
              <Link key={to} to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-body font-medium whitespace-nowrap transition-colors ${
                  active ? 'bg-ink text-white' : 'text-muted hover:text-ink hover:bg-border/60'
                }`}>
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            )
          })}

          {isAdmin && (
            <Link to="/admin"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-body font-medium whitespace-nowrap transition-colors ${
                pathname === '/admin' ? 'bg-ink text-white' : 'text-muted hover:text-ink hover:bg-border/60'
              }`}>
              <ShieldCheck size={13} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2 ml-2 shrink-0">
          <div className="hidden md:flex items-center gap-2">
            {user?.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url} alt="" className="w-6 h-6 rounded-full" />
            )}
            <span className="text-xs font-body text-muted truncate max-w-[120px]">
              {user?.email?.split('@')[0]}
            </span>
            {isAdmin && (
              <span className="text-[10px] font-mono bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">admin</span>
            )}
          </div>
          <button onClick={signOut}
            className="flex items-center gap-1 p-1.5 text-muted hover:text-danger transition-colors rounded-lg hover:bg-red-50"
            title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  )
}
