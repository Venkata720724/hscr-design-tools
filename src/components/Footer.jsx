import { Link } from 'react-router-dom'
import { SIMULATORS } from '../lib/simulators'

export default function Footer() {
  const left  = SIMULATORS.slice(0, 5)
  const right = SIMULATORS.slice(5)

  return (
    <footer className="border-t border-line bg-white mt-24">
      <div className="max-w-5xl mx-auto px-8 pt-14 pb-8">

        {/* Top grid */}
        <div className="grid grid-cols-4 gap-12 mb-12">

          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 bg-ink rounded-md flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <span className="text-sm font-semibold text-ink">HSCR Design Tools</span>
            </div>
            <p className="text-[11px] text-muted mb-4 tracking-wide">by HSCR Group</p>
            <p className="text-[12.5px] text-muted leading-relaxed">
              Helping chemical engineers worldwide with easily accessible and fully free professional design models.
            </p>
          </div>

          {/* Simulators 1–5 */}
          <div>
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-widest mb-4">
              Simulators
            </p>
            <ul className="space-y-2.5">
              {left.map(s => (
                <li key={s.id}>
                  <Link to={`/simulator/${s.id}`}
                    className="text-[12.5px] text-muted hover:text-ink no-underline transition-colors duration-100">
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Simulators 6–10 */}
          <div>
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-widest mb-4">
              More tools
            </p>
            <ul className="space-y-2.5">
              {right.map(s => (
                <li key={s.id}>
                  <Link to={`/simulator/${s.id}`}
                    className="text-[12.5px] text-muted hover:text-ink no-underline transition-colors duration-100">
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-widest mb-4">
              Contact
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <svg className="mt-0.5 flex-shrink-0" width="13" height="13"
                  viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <span className="text-[12.5px] text-muted">hscr_groups@gmail.com</span>
              </div>
              <div className="flex items-start gap-2.5">
                <svg className="mt-0.5 flex-shrink-0" width="13" height="13"
                  viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span className="text-[12.5px] text-muted leading-snug">
                  Hyderabad, Telangana<br />India
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-line pt-6 flex items-center justify-between">
          <span className="text-[11.5px] text-muted">
            © 2025 HSCR Group. All rights reserved.
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            <span className="text-[11.5px] text-muted">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
