import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Board from './pages/Board'
import NewRequest from './pages/NewRequest'
import PromoCalendar from './pages/PromoCalendar'
import Analytics from './pages/Analytics'
import AdminPage from './pages/AdminPage'
import BrandDatabase from './pages/BrandDatabase'
import StoreRequest from './pages/StoreRequest'
import { Loader2, LayoutDashboard, CalendarClock, PlusCircle, BarChart2, Store, BookMarked } from 'lucide-react'
import { useState, useEffect } from 'react'

const isMobile = () => window.innerWidth < 640

function MobileLanding() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const options = [
    { to: '/today',     label: 'Store View',    icon: CalendarClock, desc: 'Live promos, pick & photo', color: 'bg-violet-50 border-violet-200 text-violet-700' },
    { to: '/',          label: 'Promo Board',   icon: LayoutDashboard, desc: 'All promos, status updates', color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { to: '/new',       label: 'New Request',   icon: PlusCircle, desc: 'Submit a promo request', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { to: '/analytics', label: 'Analytics',     icon: BarChart2, desc: 'Brand & day view insights', color: 'bg-amber-50 border-amber-200 text-amber-700' },
    { to: '/store-request', label: 'Store Request', icon: Store, desc: 'Request store changes', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { to: '/brands',    label: 'Brands',        icon: BookMarked, desc: 'Brand database', color: 'bg-gray-50 border-gray-200 text-gray-700' },
  ]

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="px-5 pt-8 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">B</span>
          </div>
          <span className="font-display font-bold text-lg text-ink">Broadway <span className="text-accent">Promos</span></span>
        </div>
        <p className="text-sm text-muted font-body">Where do you want to go?</p>
      </div>
      <div className="px-4 flex flex-col gap-3 pb-8">
        {options.map(({ to, label, icon: Icon, desc, color }) => (
          <button key={to} onClick={() => navigate(to)}
            className={`flex items-center gap-4 px-4 py-4 rounded-xl border ${color} text-left transition-opacity active:opacity-70`}>
            <Icon size={22} />
            <div>
              <p className="font-display font-semibold text-sm">{label}</p>
              <p className="text-xs opacity-70 font-body">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center gap-2 text-muted">
      <Loader2 size={20} className="animate-spin" />
      <span className="font-body text-sm">Loading…</span>
    </div>
  )

  if (!user) return <Login />

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <main>
        <Routes>
          <Route path="/landing"   element={<MobileLanding />} />
          <Route path="/"          element={isMobile() ? <MobileLanding /> : <Board />} />
          <Route path="/new"       element={<NewRequest />} />
          <Route path="/today"     element={<PromoCalendar />} />
          <Route path="/brands"    element={<BrandDatabase />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/admin"     element={<AdminPage />} />
          <Route path="/store-request" element={<StoreRequest />} />
          <Route path="*"          element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
