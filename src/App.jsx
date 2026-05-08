import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Board from './pages/Board'
import NewRequest from './pages/NewRequest'
import PromoCalendar from './pages/PromoCalendar'
import Analytics from './pages/Analytics'
import AdminPage from './pages/AdminPage'
import BrandDatabase from './pages/BrandDatabase'
import { Loader2 } from 'lucide-react'

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
          <Route path="/"          element={<Board />} />
          <Route path="/new"       element={<NewRequest />} />
          <Route path="/today"     element={<PromoCalendar />} />
          <Route path="/brands"    element={<BrandDatabase />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/admin"     element={<AdminPage />} />
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
