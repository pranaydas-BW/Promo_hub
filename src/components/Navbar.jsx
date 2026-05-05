import { Link, useLocation } from 'react-router-dom'
import { Tag, LayoutDashboard, PlusCircle, BarChart2, CalendarClock, Barcode } from 'lucide-react'

const links = [
  { to: '/',          label: 'Board',       icon: LayoutDashboard },
  { to: '/new',       label: 'New Request', icon: PlusCircle },
  { to: '/today',     label: "Today's",     icon: CalendarClock },
  { to: '/skus',      label: 'SKUs',        icon: Barcode },
  { to: '/analytics', label: 'Analytics',   icon: BarChart2 },
]

export default function Navbar() {
  const { pathname } = useLocation()
  return (
    <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center">
            <Tag size={13} className="text-white" />
          </div>
          <span className="font-display font-bold text-base text-ink">
            Promo<span className="text-accent">Hub</span>
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 overflow-x-auto">
          {links.map(({ to, label, icon: Icon }) => {
            const active = pathname === to
            return (
              <Link key={to} to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-body font-medium whitespace-nowrap transition-colors ${
                  active ? 'bg-ink text-white' : 'text-muted hover:text-ink hover:bg-border/60'
                }`}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
