import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Board from './pages/Board'
import NewRequest from './pages/NewRequest'
import TodayPromos from './pages/TodayPromos'
import Analytics from './pages/Analytics'
import SkuUpload from './pages/SkuUpload'

export default function App() {
  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <main>
        <Routes>
          <Route path="/"          element={<Board />} />
          <Route path="/new"       element={<NewRequest />} />
          <Route path="/today"     element={<TodayPromos />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/skus"      element={<SkuUpload />} />
        </Routes>
      </main>
    </div>
  )
}
