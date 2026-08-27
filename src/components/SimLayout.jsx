import Nav from './Nav'
import Footer from './Footer'
import { Link } from 'react-router-dom'

export default function SimLayout({ chapter, name, tagline, activeModels, children }) {
  return (
    <div className="min-h-screen bg-white">
      <Nav />

      {/* Sim header */}
      <div className="border-b border-line bg-white">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link to="/dashboard"
                  className="text-[11.5px] text-muted hover:text-ink no-underline transition-colors">
                  ← All simulators
                </Link>
                <span className="text-muted text-[11.5px]">/</span>
                <span className="text-[11.5px] text-ink font-medium">{name}</span>
              </div>
              <h1 className="text-[22px] font-bold text-ink tracking-tight mb-1">{name}</h1>
              <p className="text-[13px] text-muted">{tagline}</p>
            </div>
            <span className="text-[11px] font-medium text-muted bg-soft px-2.5 py-1 rounded-md mt-1">
              Ch. {chapter}
            </span>
          </div>

          {/* Active models strip */}
          {activeModels && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-[10.5px] text-muted font-medium">Active models:</span>
              {activeModels.map(m => (
                <span key={m}
                  className="text-[10.5px] font-medium text-ink bg-soft px-2 py-0.5 rounded-md border border-line">
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Simulator content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {children}
      </div>

      <Footer />
    </div>
  )
}
