import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SIMULATORS } from '../lib/simulators'
import Nav from '../components/Nav'
import Footer from '../components/Footer'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="max-w-5xl mx-auto px-8 pt-14 pb-8">
        <div className="flex items-baseline justify-between mb-10">
          <div>
            <h1 className="text-[26px] font-bold text-ink tracking-tight mb-1">
              {user ? `Welcome back` : 'All simulators'}
            </h1>
            <p className="text-[13.5px] text-muted">
              Select a simulator to begin. Enter your process data and get results instantly.
            </p>
          </div>
          {user && (
            <Link to="/history" className="text-[13px] text-muted hover:text-ink no-underline transition-colors">
              View history →
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {SIMULATORS.map(sim => (
            <Link key={sim.id} to={`/simulator/${sim.id}`} className="no-underline group">
              <div className="border border-line rounded-2xl p-5 bg-white hover:border-neutral-300 hover:shadow-sm transition-all duration-150 h-full flex flex-col"
                   style={{ borderTop: `2.5px solid ${sim.color}` }}>
                <h3 className="text-[13.5px] font-semibold text-ink tracking-tight mb-2 leading-snug group-hover:text-brand transition-colors duration-100">
                  {sim.name}
                </h3>
                <p className="text-[11.5px] text-muted leading-relaxed mb-4 flex-1">
                  {sim.tagline}
                </p>
                <div className="flex flex-wrap gap-1 mb-4">
                  {sim.tags.slice(0, 3).map(t => (
                    <span key={t} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-soft text-muted">{t}</span>
                  ))}
                </div>
                <span className="text-[12px] font-semibold flex items-center gap-1 transition-all duration-100" style={{ color: sim.color }}>
                  Open
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-100">→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  )
}
