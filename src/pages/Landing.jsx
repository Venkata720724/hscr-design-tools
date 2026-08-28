import { Link } from 'react-router-dom'
import { SIMULATORS } from '../lib/simulators'
import Footer from '../components/Footer'
import Nav from '../components/Nav'

const STATS = [
  { value: '10', label: 'Simulators' },
  { value: '100+', label: 'Design checks' },
  { value: '0', label: 'Cost ever' },
  { value: '∞', label: 'Calculations' },
]

const METHODS = [
  'Bell-Delaware shell & tube', 'ASME VIII Div.1', 'API 650 one-foot method',
  'Kremser absorption / stripping', 'Ergun pressure drop', 'API 520 PSV sizing',
  'McCabe-Thiele / FUG shortcut', 'Fenske-Underwood-Gilliland', 'Dulong combustion',
  'Rankine steam cycle', 'Zick saddle analysis', 'Grenville blend time',
  'Mostinski nucleate boiling', 'ISA control valve Cv', 'Thiele / Aris effectiveness',
]

export default function Landing() {
  return (
    <div className="bg-white min-h-screen">
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-8 pt-20 pb-16">
        <p className="text-[12px] font-medium text-muted uppercase tracking-[1.4px] mb-5">
          Chemical engineering ·
        </p>
        <h1 className="text-[52px] font-bold text-ink leading-[1.06] tracking-[-2px] max-w-2xl mb-5">
          Design tools built<br />for engineers.
        </h1>
        <p className="text-[16px] text-muted font-normal leading-relaxed max-w-md mb-9">
          Ten fully interactive simulators covering every core unit operation.
        </p>
        <div className="flex items-center gap-4">
          <Link to="/register">
            <button className="btn-primary px-6 py-2.5 text-[13.5px]">
              Start for free
            </button>
          </Link>
          <Link to="/dashboard">
            <button className="text-[13.5px] text-muted hover:text-ink transition-colors font-normal bg-transparent border-none cursor-pointer">
              View all simulators →
            </button>
          </Link>
        </div>
      </div>

      {/* ── STATS STRIP ──────────────────────────────────────────── */}
      <div className="bg-[#0f172a]">
        <div className="max-w-5xl mx-auto px-8 py-10 grid grid-cols-4 gap-8">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-[36px] font-bold text-white tracking-tight leading-none mb-1">{s.value}</p>
              <p className="text-[12px] text-[#94a3b8] font-medium uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── SIMULATOR LIST ───────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-8 py-16">
        <div className="flex items-baseline justify-between mb-8">
          <span className="text-[18px] font-bold text-ink tracking-tight">All simulators</span>
          <span className="text-[13px] text-muted">10 tools — sign in to use</span>
        </div>

        <div className="flex flex-col">
          {SIMULATORS.map((sim, i) => (
            <Link key={sim.id} to={`/simulator/${sim.id}`} className="no-underline">
              <div
                className="grid items-center py-4 border-b border-line
                           hover:bg-neutral-50 transition-colors duration-100
                           px-3 -mx-3 rounded group cursor-pointer"
                style={{ gridTemplateColumns: '36px 1fr 1fr 80px' }}
              >
                <span className="text-[11.5px] text-muted font-normal tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[13.5px] font-semibold text-ink tracking-tight
                                 group-hover:text-brand transition-colors duration-100">
                  {sim.name}
                </span>
                <div className="flex items-center flex-wrap gap-0">
                  {sim.models.slice(0, 3).map((m, mi) => (
                    <span key={m} className="text-[12px] text-muted font-normal">
                      {mi > 0 && <span className="mx-1.5 text-[#ddd]">·</span>}
                      {m}
                    </span>
                  ))}
                </div>
                <span className="text-[13px] text-brand opacity-0 group-hover:opacity-100
                                 transition-opacity duration-100 text-right">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── METHODS GRID ─────────────────────────────────────────── */}
      <div className="bg-[#f8fafc] py-16">
        <div className="max-w-5xl mx-auto px-8">
          <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.2px] mb-4">Built on</p>
          <h2 className="text-[22px] font-bold text-ink tracking-tight mb-8">
            Industry-standard methods
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {METHODS.map(m => (
              <div key={m} className="flex items-center gap-2.5 py-2.5 px-3 bg-white rounded-lg border border-line">
                <div className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0"/>
                <span className="text-[12.5px] text-ink font-medium">{m}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── THREE PILLARS ────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-8 py-16">
        <div className="grid grid-cols-3 gap-12">
          <div className="border border-line rounded-xl p-6">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.2px] mb-3">Free</p>
            <h3 className="text-[16px] font-bold text-ink mb-3 tracking-tight">No cost. No catch.</h3>
            <p className="text-[13px] text-muted leading-relaxed">
              Every simulator is free to use. Create an account, save your runs, come back anytime. Built to be accessible to every engineer, everywhere.
            </p>
          </div>
          <div className="border border-line rounded-xl p-6">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.2px] mb-3">Rigorous</p>
            <h3 className="text-[16px] font-bold text-ink mb-3 tracking-tight">Industry-standard models.</h3>
            <p className="text-[13px] text-muted leading-relaxed">
              Bell-Delaware, ASME VIII, API 520, Kremser, Ergun — the exact same methods used in professional engineering practice worldwide.
            </p>
          </div>
          <div className="border border-line rounded-xl p-6">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.2px] mb-3">Instant</p>
            <h3 className="text-[16px] font-bold text-ink mb-3 tracking-tight">Results in seconds.</h3>
            <p className="text-[13px] text-muted leading-relaxed">
              Every output, chart, and PASS / FAIL check calculated instantly. No submit button, no waiting, no spreadsheet — just engineering.
            </p>
          </div>
        </div>
      </div>

      {/* ── CTA BANNER ───────────────────────────────────────────── */}
      <div className="bg-[#0f172a] py-16">
        <div className="max-w-5xl mx-auto px-8 text-center">
          <h2 className="text-[28px] font-bold text-white tracking-tight mb-4">
            Ready to start designing?
          </h2>
          <p className="text-[14px] text-[#94a3b8] mb-8 max-w-md mx-auto leading-relaxed">
            Create a free account and access all 10 simulators instantly. No credit card, no download required.
          </p>
          <Link to="/register">
            <button className="bg-white text-[#0f172a] font-semibold px-8 py-3 rounded-xl text-[14px] hover:bg-[#f1f5f9] transition-colors border-0 cursor-pointer">
              Create free account →
            </button>
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  )
}
