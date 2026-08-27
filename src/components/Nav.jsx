import { Link, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Nav() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const logout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <nav className="border-b border-line bg-white sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-8 h-14 flex items-center gap-0">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-7 h-7 bg-ink rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-ink tracking-tight">HSCR Design Tools</span>
        </Link>

        <div className="flex items-center gap-0.5 ml-8">
          <NavLink to="/dashboard"
            className={({ isActive }) =>
              `text-[13.5px] px-3 py-1.5 rounded-md no-underline transition-colors duration-100 font-normal
               ${isActive ? 'text-ink bg-soft' : 'text-muted hover:text-ink hover:bg-neutral-50'}`}>
            Simulators
          </NavLink>
          <NavLink to="/about"
            className={({ isActive }) =>
              `text-[13.5px] px-3 py-1.5 rounded-md no-underline transition-colors duration-100 font-normal
               ${isActive ? 'text-ink bg-soft' : 'text-muted hover:text-ink hover:bg-neutral-50'}`}>
            About HSCR
          </NavLink>
          {user && (
            <NavLink to="/history"
              className={({ isActive }) =>
                `text-[13.5px] px-3 py-1.5 rounded-md no-underline transition-colors duration-100 font-normal
                 ${isActive ? 'text-ink bg-soft' : 'text-muted hover:text-ink hover:bg-neutral-50'}`}>
              History
            </NavLink>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="text-[12px] text-muted hidden sm:block truncate max-w-[160px]">
                {user.email}
              </span>
              <button onClick={logout} className="btn-ghost text-[13px]">Log out</button>
            </>
          ) : (
            <>
              <Link to="/login"><button className="btn-ghost text-[13px]">Log in</button></Link>
              <Link to="/register"><button className="btn-primary text-[13px]">Get started</button></Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
