import Nav from '../components/Nav'
import Footer from '../components/Footer'

export default function About() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />

      <div className="max-w-5xl mx-auto px-8 pt-16 pb-8">

        {/* Header */}
        <div className="max-w-xl mb-16">
          <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.3px] mb-5">
            About HSCR
          </p>
          <h1 className="text-[36px] font-bold text-ink tracking-tight leading-[1.1] mb-5">
            Engineering tools that belong to everyone.
          </h1>
          <p className="text-[15px] text-muted leading-relaxed">
            HSCR Design Tools is a free, browser-based platform covering the ten
            core unit operations of chemical engineering. No software to install,
            no subscription, no barriers.
          </p>
        </div>

        <div className="border-t border-line" />

        {/* Mission */}
        <div className="py-14 grid grid-cols-3 gap-16">
          <div className="col-span-1">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.3px]">
              Our mission
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[15px] text-ink leading-relaxed mb-4">
              Helping chemical engineers worldwide with easily accessible and fully free professional design models.
            </p>
            <p className="text-[13.5px] text-muted leading-relaxed">
              Professional engineering software is expensive and inaccessible to many engineers,
              students, and small firms. We built HSCR Design Tools to change that — rigorous,
              validated models running entirely in the browser, free to use, forever.
            </p>
          </div>
        </div>

        <div className="border-t border-line" />

        {/* What we built */}
        <div className="py-14 grid grid-cols-3 gap-16">
          <div className="col-span-1">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.3px]">
              What we built
            </p>
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-8">
            {[
              { n: '10', label: 'Fully interactive simulators' },
              { n: '100+', label: 'Industry-standard engineering models' },
              { n: '0', label: 'Cost to the user, ever' },
              { n: '∞', label: 'Runs saved per user' },
            ].map(({ n, label }) => (
              <div key={label}>
                <div className="text-[32px] font-bold text-ink tracking-[-2px] mb-1">{n}</div>
                <div className="text-[13px] text-muted">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-line" />

        {/* Models used */}
        <div className="py-14 grid grid-cols-3 gap-16">
          <div className="col-span-1">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.3px]">
              Standards & models
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[13.5px] text-muted leading-relaxed mb-5">
              Every simulator uses the same industry-standard methods engineers rely on in practice.
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {[
                'ASME VIII Div. 1', 'API 650 / 620',
                'API 520 / 521 / 526', 'API 2000 / API 610',
                'Bell-Delaware method', 'ASCE 7 Wind & Seismic',
                'Fenske-Underwood-Gilliland', 'Kremser equation',
                'Ergun equation', 'Arrhenius kinetics',
                'Semenov stability', 'Dulong / Rankine',
              ].map(m => (
                <div key={m} className="flex items-center gap-2 py-1.5 border-b border-line">
                  <div className="w-1 h-1 bg-muted rounded-full flex-shrink-0" />
                  <span className="text-[12.5px] text-ink">{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-line" />

        {/* Contact */}
        <div className="py-14 grid grid-cols-3 gap-16">
          <div className="col-span-1">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.3px]">
              Get in touch
            </p>
          </div>
          <div className="col-span-2 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-soft rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#888" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div>
                <p className="text-[12px] font-medium text-muted mb-0.5">Email</p>
                <a href="mailto:hscr_groups@gmail.com"
                  className="text-[14px] text-ink no-underline hover:text-brand transition-colors">
                  hscr_groups@gmail.com
                </a>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-soft rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#888" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div>
                <p className="text-[12px] font-medium text-muted mb-0.5">Location</p>
                <p className="text-[14px] text-ink">Hyderabad, Telangana, India</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
