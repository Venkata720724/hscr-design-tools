import Nav from '../components/Nav'
import Footer from '../components/Footer'

const HSCR_BOOKS = [
  {
    id: 'hscr1',
    title: 'Chemical Engineering Design — Vol. 1',
    subtitle: 'A comprehensive summary of all core chemical engineering design principles, methods, and equipment sizing — distillation, heat exchange, reactor design, and more.',
    asin: 'B0HGRHC6MQ',
    url: 'https://www.amazon.com/dp/B0HGRHC6MQ',
    covers: [
      'Distillation — binary and multicomponent',
      'Heat exchangers — shell & tube, TEMA',
      'Reactor design — CSTR, PFR, batch, fixed bed',
      'Pressure vessels — ASME VIII Div.1',
      'Equipment sizing and selection',
      'Capital cost estimation — Turton method',
    ],
  },
  {
    id: 'hscr2',
    title: 'Chemical Engineering Design — Vol. 2',
    subtitle: 'Covers separations, fluid systems, storage, agitation, material & energy balances — the complete companion to Vol. 1.',
    asin: 'B0HF35CBJL',
    url: 'https://www.amazon.com/dp/B0HF35CBJL',
    covers: [
      'Mixer & agitator design',
      'Storage tanks — API 650',
      'Piping, control valves, PSV — API 520',
      'Separations — absorption, stripping, extraction, crystallisation, drying',
      'Material & energy balances',
      'Rankine cycle and combustion analysis',
    ],
  },
]

const BOOKS = [
  {
    id: 1,
    title: 'Chemical Engineering Design',
    subtitle: 'Principles, Practice and Economics of Plant and Process Design',
    authors: 'Towler, G. & Sinnott, R.',
    edition: '3rd Edition',
    publisher: 'Butterworth-Heinemann / Elsevier',
    year: '2022',
    isbn: '978-0-12-821179-3',
    covers: [
      'Process design and development',
      'Equipment selection and sizing',
      'Capital cost estimation (Turton method)',
      'Heat exchangers, reactors, separations',
      'Safety, hazard analysis, and HAZOP',
      'Project management and economics',
    ],
    relevance: 'Core reference for economics, equipment sizing, and cost estimation throughout all simulators.',
    color: '#1d4ed8',
    tag: 'DESIGN',
  },
  {
    id: 2,
    title: "Coulson & Richardson's Chemical Engineering",
    subtitle: 'Volume 2 — Particle Technology & Separation Processes',
    authors: 'Richardson, J.F., Backhurst, J.R. & Harker, J.H.',
    edition: '5th Edition',
    publisher: 'Butterworth-Heinemann',
    year: '2002',
    isbn: '978-0-08-049064-9',
    covers: [
      'Fluid mechanics and flow in pipes',
      'Heat transfer — conduction, convection, radiation',
      'Distillation — binary and multicomponent',
      'Absorption, stripping, extraction',
      'Drying, crystallisation, filtration',
      'Size reduction and mixing',
    ],
    relevance: 'Primary theoretical foundation for the distillation, separations, and heat exchanger simulators.',
    color: '#0f766e',
    tag: 'UNIT OPS',
  },
  {
    id: 3,
    title: 'Analysis, Synthesis and Design of Chemical Processes',
    subtitle: 'Turton, Bailie, Whiting, Shaeiwitz & Bhattacharyya',
    authors: 'Turton, R. et al.',
    edition: '5th Edition',
    publisher: 'Prentice Hall / Pearson',
    year: '2018',
    isbn: '978-0-13-408446-4',
    covers: [
      'Turton cost correlations (all simulators)',
      'Bare module and installed cost factors',
      'Process simulation basics',
      'Heat and material balances',
      'Profitability analysis',
      'Environmental considerations',
    ],
    relevance: 'Source of all Turton cost correlations (K₁, K₂, K₃, FBM factors) used in the economics sections of every simulator.',
    color: '#7c3aed',
    tag: 'ECONOMICS',
  },
  {
    id: 4,
    title: 'Introduction to Chemical Engineering Thermodynamics',
    subtitle: 'Smith, Van Ness & Abbott',
    authors: 'Smith, J.M., Van Ness, H.C. & Abbott, M.M.',
    edition: '8th Edition',
    publisher: 'McGraw-Hill',
    year: '2005',
    isbn: '978-0-07-298267-1',
    covers: [
      'VLE — vapour-liquid equilibrium',
      'Antoine and Raoult\'s law',
      'Enthalpy and entropy calculations',
      'Steam tables and Rankine cycle',
      'Phase equilibria and equations of state',
      'Chemical reaction equilibrium',
    ],
    relevance: 'Underpins VLE calculations in distillation (Antoine constants, relative volatility) and the Rankine steam cycle in the MEB simulator.',
    color: '#b45309',
    tag: 'THERMO',
  },
  {
    id: 5,
    title: 'Elements of Chemical Reaction Engineering',
    subtitle: 'Fogler, H.S.',
    authors: 'Fogler, H. Scott',
    edition: '6th Edition',
    publisher: 'Pearson / Prentice Hall',
    year: '2020',
    isbn: '978-0-13-548512-1',
    covers: [
      'Mole balances — CSTR, PFR, PBR, batch',
      'Rate law and Arrhenius kinetics',
      'Levenspiel design plots',
      'Energy balances on reactors',
      'Multiple reactions and selectivity',
      'Fixed bed and fluidised bed reactors',
    ],
    relevance: 'Direct source for all reactor design equations — CSTR, PFR, batch, Levenspiel plot, Damköhler number, and Semenov stability criterion.',
    color: '#be123c',
    tag: 'REACTORS',
  },
  {
    id: 6,
    title: 'Pressure Vessel Design Manual',
    subtitle: 'Moss, D.R. & Basic, M.',
    authors: 'Moss, D.R. & Basic, M.',
    edition: '4th Edition',
    publisher: 'Gulf Professional Publishing / Elsevier',
    year: '2012',
    isbn: '978-0-12-387000-1',
    covers: [
      'ASME VIII Division 1 shell thickness',
      'Head types — UG-32 ellipsoidal, hemispherical, tori, conical',
      'Nozzle reinforcement — UG-37',
      'Skirt and saddle support design',
      'Wind and seismic loading (ASCE 7)',
      'Flanges, relief devices, and hydrotest',
    ],
    relevance: 'Primary design code reference for the Pressure Vessel simulator — all ASME UG formula implementations follow this text.',
    color: '#0369a1',
    tag: 'VESSELS',
  },
]

const CODES = [
  { code: 'ASME VIII Div.1', topic: 'Pressure vessel design', sim: 'Pressure Vessel' },
  { code: 'ASME B16.5', topic: 'Flanges and fittings', sim: 'Pressure Vessel, Piping' },
  { code: 'API 650', topic: 'Welded tanks for oil storage', sim: 'Storage Tank' },
  { code: 'API 520 Parts I & II', topic: 'PSV sizing and installation', sim: 'Pressure Vessel, Piping' },
  { code: 'API 521', topic: 'Pressure-relieving systems', sim: 'Pressure Vessel' },
  { code: 'API 2000', topic: 'Tank venting (atmospheric)', sim: 'Storage Tank' },
  { code: 'ISA S75.01', topic: 'Control valve sizing (Cv/Kv)', sim: 'Piping & Valves' },
  { code: 'TEMA Standards', topic: 'Shell & tube heat exchangers', sim: 'Heat Exchanger' },
  { code: 'ASCE 7-22', topic: 'Wind and seismic loads', sim: 'Pressure Vessel, Storage Tank' },
  { code: 'IS 875 Part 3', topic: 'Wind loads (India)', sim: 'Pressure Vessel, Storage Tank' },
]

export default function Textbooks() {
  return (
    <div className="bg-white min-h-screen">
      <Nav />

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-8 pt-16 pb-12">
        <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.3px] mb-4">Reference library</p>
        <h1 className="text-[36px] font-bold text-ink tracking-tight leading-tight mb-4">
          Textbooks & standards
        </h1>
        <p className="text-[15px] text-muted leading-relaxed max-w-2xl">
          Every formula, correlation, and design method in these simulators is traceable to a published textbook or industry standard. This page lists the exact references used — starting with the HSCR books that summarise all of it in one place.
        </p>
      </div>

      {/* ── HSCR BOOKS — featured at top ──────────────────────────── */}
      <div className="bg-[#0f172a] py-14">
        <div className="max-w-5xl mx-auto px-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-6 h-6 bg-white rounded flex items-center justify-center flex-shrink-0">
              <span className="text-[7px] font-black text-[#374151] tracking-tighter">HSCR</span>
            </div>
            <p className="text-[11px] font-bold text-white uppercase tracking-[1.4px]">
              Published by HSCR
            </p>
          </div>
          <h2 className="text-[24px] font-bold text-white tracking-tight mb-2">
            The HSCR Chemical Engineering Design Series
          </h2>
          <p className="text-[14px] text-[#94a3b8] leading-relaxed max-w-2xl mb-10">
            These two books are a distilled summary of every major chemical engineering design textbook — written to give engineers the essential methods, equations, and worked examples without having to search through hundreds of pages. The simulators on this website are built directly from the content in these books.
          </p>

          <div className="grid grid-cols-2 gap-6">
            {HSCR_BOOKS.map((book, i) => (
              <div key={book.id} className="bg-white rounded-xl overflow-hidden">
                {/* Top accent */}
                <div className="h-1 bg-[#374151]" />
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <span className="text-[9.5px] font-bold bg-[#0f172a] text-white px-2 py-0.5 rounded uppercase tracking-wider">
                        Vol. {i + 1}
                      </span>
                      <h3 className="text-[15px] font-bold text-ink tracking-tight mt-2 mb-1 leading-tight">
                        {book.title}
                      </h3>
                      <p className="text-[12px] text-muted leading-snug">{book.subtitle}</p>
                    </div>
                  </div>

                  <ul className="space-y-1.5 mb-5">
                    {book.covers.map(c => (
                      <li key={c} className="flex items-start gap-2 text-[12px] text-ink">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#374151] flex-shrink-0"/>
                        {c}
                      </li>
                    ))}
                  </ul>

                  <a href={book.url} target="_blank" rel="noopener noreferrer" className="no-underline">
                    <button className="w-full bg-[#0f172a] text-white text-[13px] font-semibold py-2.5 rounded-lg hover:bg-[#1e293b] transition-colors cursor-pointer border-0 flex items-center justify-center gap-2">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                      </svg>
                      Buy on Amazon
                    </button>
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11.5px] text-[#64748b] mt-6 text-center">
            Available on Amazon Kindle and paperback · Published by HSCR Group, Hyderabad
          </p>
        </div>
      </div>

      {/* ── REFERENCE TEXTBOOKS ───────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-8 py-16">
        <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.2px] mb-6 pb-2 border-b border-line">
          Core reference textbooks
        </p>
        <div className="flex flex-col gap-5">
          {BOOKS.map(book => (
            <div key={book.id} className="border border-line rounded-xl overflow-hidden flex">
              <div className="w-1.5 flex-shrink-0" style={{ background: book.color }} />
              <div className="flex-1 px-6 py-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider text-white"
                        style={{ background: book.color }}>
                        {book.tag}
                      </span>
                      <span className="text-[11px] text-muted">{book.edition} · {book.year}</span>
                    </div>
                    <h3 className="text-[15px] font-bold text-ink tracking-tight leading-tight mb-0.5">
                      {book.title}
                    </h3>
                    <p className="text-[12.5px] text-muted leading-snug">{book.subtitle}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[12px] text-ink font-semibold">{book.authors}</p>
                    <p className="text-[11px] text-muted">{book.publisher}</p>
                    <p className="text-[10.5px] text-muted font-mono mt-1">ISBN {book.isbn}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-2">Topics covered</p>
                    <ul className="space-y-1">
                      {book.covers.map(c => (
                        <li key={c} className="flex items-start gap-1.5 text-[12px] text-ink">
                          <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: book.color }} />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-2">Used in these simulators</p>
                    <p className="text-[12.5px] text-muted leading-relaxed border-l-2 pl-3"
                      style={{ borderColor: book.color }}>
                      {book.relevance}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Codes & Standards */}
      <div className="bg-[#f8fafc] py-16">
        <div className="max-w-5xl mx-auto px-8">
          <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.2px] mb-6">
            Design codes & standards implemented
          </p>
          <div className="bg-white border border-line rounded-xl overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-soft">
                  <th className="text-left py-3 px-5 text-[10.5px] font-bold text-muted uppercase tracking-wide">Code / Standard</th>
                  <th className="text-left py-3 px-5 text-[10.5px] font-bold text-muted uppercase tracking-wide">Scope</th>
                  <th className="text-left py-3 px-5 text-[10.5px] font-bold text-muted uppercase tracking-wide">Simulator</th>
                </tr>
              </thead>
              <tbody>
                {CODES.map((c, i) => (
                  <tr key={c.code} className={`border-b border-line ${i % 2 === 1 ? 'bg-[#fafafa]' : ''}`}>
                    <td className="py-3 px-5 font-semibold text-ink font-mono text-[12.5px]">{c.code}</td>
                    <td className="py-3 px-5 text-muted">{c.topic}</td>
                    <td className="py-3 px-5 text-muted">{c.sim}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-6">
          <p className="text-[12.5px] font-semibold text-amber-800 mb-2">A note on references</p>
          <p className="text-[12.5px] text-amber-700 leading-relaxed">
            The equations implemented in each simulator are derived from the references above. For design submissions, regulatory filings, or critical engineering decisions, always verify against the primary source document. These simulators are intended as a calculation aid and educational reference — not a substitute for professional engineering judgement.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  )
}
