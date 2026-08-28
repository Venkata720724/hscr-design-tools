import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Nav from './Nav'
import Footer from './Footer'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-[13px] text-muted">Loading…</div>
    </div>
  )

  if (!user) return (
    <div className="min-h-screen bg-white flex flex-col">
      <Nav />
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-14 h-14 bg-white border border-[#e5e7eb] rounded-2xl flex items-center justify-center mb-6">
          <span className="text-[13px] font-black text-[#374151] tracking-tighter">HSCR</span>
        </div>
        <h2 className="text-[24px] font-bold text-ink tracking-tight mb-3">
          Sign in to use the simulators
        </h2>
        <p className="text-[14px] text-muted leading-relaxed max-w-sm mb-8">
          Create a free account to access all 10 simulators, save your calculation history, and run unlimited designs.
        </p>
        <div className="flex items-center gap-4">
          <a href="/register">
            <button className="btn-primary px-6 py-2.5 text-[13.5px] cursor-pointer border-0">
              Create free account
            </button>
          </a>
          <a href="/login">
            <button className="text-[13.5px] text-muted hover:text-ink transition-colors font-medium bg-transparent border-none cursor-pointer">
              Already have an account? Log in →
            </button>
          </a>
        </div>
      </div>
      <Footer />
    </div>
  )

  return children
}
