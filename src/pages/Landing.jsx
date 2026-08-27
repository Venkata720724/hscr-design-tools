import { Link } from 'react-router-dom'
import { SIMULATORS } from '../lib/simulators'
import Footer from '../components/Footer'

export default function Landing() {
  return (
    <div className="bg-white min-h-screen">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-8 pt-24 pb-20">
        <p className="text-[11px] font-medium text-muted uppercase tracking-[1.4px] mb-6">
          Chemical engineering · Free · Browser-based
        </p>
        <h1 className="text-[52px] font-bold text-ink leading-[1.06] tracking-[-2px] max-w-2xl mb-5">
          Design tools built<br />for engineers.
        </h1>
        <p className="text-[16px] text-muted font-normal leading-relaxed max-w-md mb-9">
          Ten fully interactive simulators covering every core unit operation.
          Run in your browser, no install, no cost ever.
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

      {/* ── DIVIDER ──────────────────────────────────────────────── */}
      <div className="border-t border-line" />

      {/* ── SIMULATOR LIST ───────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-8 py-16">
        <div className="flex items-baseline justify-between mb-8">
          <span className="text-[13px] font-medium text-ink">All simulators</span>
          <span className="text-[13px] text-muted">10 tools</span>
        </div>

        <div className="flex flex-col">
          {SIMULATORS.map((sim, i) => (
            <Link
              key={sim.id}
              to={`/simulator/${sim.id}`}
              className="no-underline"
            >
              <div
                className="grid items-center py-4 border-b border-line
                           hover:bg-neutral-50 transition-colors duration-100
                           px-3 -mx-3 rounded group cursor-pointer"
                style={{ gridTemplateColumns: '36px 1fr 1fr 80px' }}
              >
                {/* Number */}
                <span className="text-[11.5px] text-muted font-normal tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>

                {/* Name */}
                <span className="text-[13.5px] font-medium text-ink tracking-tight
                                 group-hover:text-brand transition-colors duration-100">
                  {sim.name}
                </span>

                {/* Models */}
                <div className="flex items-center gap-0 flex-wrap">
                  {sim.models.slice(0, 3).map((m, mi) => (
                    <span key={m} className="text-[12px] text-muted font-normal">
                      {mi > 0 && <span className="mx-1.5 text-[#ddd]">·</span>}
                      {m}
                    </span>
                  ))}
                </div>

                {/* Arrow */}
                <span className="text-[13px] text-brand opacity-0 group-hover:opacity-100
                                 transition-opacity duration-100 text-right">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── DIVIDER ──────────────────────────────────────────────── */}
      <div className="border-t border-line" />

      {/* ── THREE PILLARS ────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-8 py-16">
        <div className="grid grid-cols-3 gap-16">
          <div>
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.2px] mb-3">
              Free
            </p>
            <h3 className="text-[15px] font-semibold text-ink mb-2 tracking-tight">
              No cost. No catch.
            </h3>
            <p className="text-[13px] text-muted leading-relaxed">
              Every simulator is free to use. Create an account, save your runs, come back anytime. Built to be accessible to every engineer, everywhere.
            </p>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.2px] mb-3">
              Rigorous
            </p>
            <h3 className="text-[15px] font-semibold text-ink mb-2 tracking-tight">
              Industry-standard models.
            </h3>
            <p className="text-[13px] text-muted leading-relaxed">
              Bell-Delaware, ASME VIII, API 520, Kremser, Ergun — the exact same methods used in professional engineering practice worldwide.
            </p>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.2px] mb-3">
              Instant
            </p>
            <h3 className="text-[15px] font-semibold text-ink mb-2 tracking-tight">
              Results as you type.
            </h3>
            <p className="text-[13px] text-muted leading-relaxed">
              Every output, chart, and PASS / FAIL check updates live. No submit button, no waiting, no spreadsheet — just engineering.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
