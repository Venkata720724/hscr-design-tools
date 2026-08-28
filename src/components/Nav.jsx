import { Link, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Nav() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const logout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <nav className="sticky top-0 z-50 bg-[#d4d8de]">
      <div className="max-w-[1500px] mx-auto px-10 h-14 flex items-center">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 no-underline flex-shrink-0">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <span className="text-[10px] font-black text-[#374151] tracking-tighter">HSCR</span>
          </div>
          <span className="text-[14px] font-semibold text-[#0f172a] tracking-tight">
            HSCR Design Tools
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1 ml-8">
          <NavLink to="/dashboard"
            className={({ isActive }) =>
              `text-[13px] px-3 py-1.5 rounded-md no-underline transition-colors font-medium
               ${isActive ? 'text-[#0f172a] bg-white/50 shadow-sm' : 'text-[#374151] hover:text-[#0f172a] hover:bg-white/40'}`}>
            Simulators
          </NavLink>
          <NavLink to="/textbooks"
            className={({ isActive }) =>
              `text-[13px] px-3 py-1.5 rounded-md no-underline transition-colors font-medium
               ${isActive ? 'text-[#0f172a] bg-white/50 shadow-sm' : 'text-[#374151] hover:text-[#0f172a] hover:bg-white/40'}`}>
            Textbooks
          </NavLink>
          <NavLink to="/about"
            className={({ isActive }) =>
              `text-[13px] px-3 py-1.5 rounded-md no-underline transition-colors font-medium
               ${isActive ? 'text-[#0f172a] bg-white/50 shadow-sm' : 'text-[#374151] hover:text-[#0f172a] hover:bg-white/40'}`}>
            About HSCR
          </NavLink>
          {user && (
            <NavLink to="/history"
              className={({ isActive }) =>
                `text-[13px] px-3 py-1.5 rounded-md no-underline transition-colors font-medium
                 ${isActive ? 'text-[#0f172a] bg-white/50 shadow-sm' : 'text-[#374151] hover:text-[#0f172a] hover:bg-white/40'}`}>
              History
            </NavLink>
          )}
        </div>

        {/* Auth */}
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="text-[12px] text-[#374151] hidden sm:block truncate max-w-[180px]">
                {user.email}
              </span>
              <button onClick={logout}
                className="text-[13px] font-medium text-[#374151] hover:text-[#0f172a] transition-colors bg-transparent border-0 cursor-pointer">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="text-[13px] font-medium text-[#374151] hover:text-[#0f172a] transition-colors bg-transparent border-0 cursor-pointer">
                  Log in
                </button>
              </Link>
              <Link to="/register">
                <button className="text-[13px] font-semibold bg-[#0f172a] text-white px-4 py-1.5 rounded-lg hover:bg-[#1e293b] transition-colors border-0 cursor-pointer">
                  Get started
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
