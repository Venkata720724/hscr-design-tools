import Nav from './Nav'
import Footer from './Footer'
import { Link } from 'react-router-dom'

// ── Tab bar ───────────────────────────────────────────────────────
export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-0.5 border-b border-line mb-5 bg-white sticky top-14 z-40 px-10 -mx-10">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-3 py-2.5 text-[12px] border-b-2 font-medium transition-colors cursor-pointer bg-transparent border-x-0 border-t-0 whitespace-nowrap
            ${active === t.id ? 'border-b-ink text-ink' : 'border-b-transparent text-muted hover:text-ink'}`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────
export function MetricCard({ label, value, unit, highlight }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-blue-50 border border-blue-100' : 'bg-soft border border-line'}`}>
      <p className="text-[10.5px] text-muted mb-1 leading-tight">{label}</p>
      <p className={`text-[17px] font-semibold tracking-tight leading-tight ${highlight ? 'text-brand' : 'text-ink'}`}>{value ?? '—'}</p>
      {unit && <p className="text-[10px] text-muted mt-0.5">{unit}</p>}
    </div>
  )
}

// ── Result table ──────────────────────────────────────────────────
export function ResultTable({ rows }) {
  return (
    <table className="w-full text-[12px] border-collapse mb-4">
      <tbody>
        {rows.map(([label, value, unit], i) => (
          <tr key={i} className="border-b border-line">
            <td className="py-2 px-2 text-muted w-[55%] leading-snug">{label}</td>
            <td className="py-2 px-2 font-medium text-ink text-right">
              {value}{unit ? <span className="text-muted font-normal ml-1">{unit}</span> : ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Section heading ───────────────────────────────────────────────
export function SectionHead({ children }) {
  return (
    <p className="text-[10px] font-semibold text-muted uppercase tracking-[1.1px] mb-3 mt-5 first:mt-0 pb-1 border-b border-line">
      {children}
    </p>
  )
}

// ── PASS/FAIL check ───────────────────────────────────────────────
export function Check({ label, value, pass }) {
  return (
    <div className={`rounded-xl p-3 border flex items-start justify-between gap-2
      ${pass ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
      <div>
        <p className="text-[11.5px] font-medium text-ink leading-snug">{label}</p>
        <p className="text-[10.5px] text-muted mt-0.5">{value}</p>
      </div>
      <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5
        ${pass ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
        {pass ? 'PASS' : 'FAIL'}
      </span>
    </div>
  )
}

// ── Input field — empty by default ────────────────────────────────
export function Field({ label, unit, value, onChange, min, max, step = 'any', hint, required = true }) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-[12px] font-medium text-ink">
          {label}{required && <span className="text-red-400 ml-0.5 text-[10px]">*</span>}
        </label>
        {unit && <span className="text-[11px] text-muted font-mono bg-soft px-1.5 py-0.5 rounded">{unit}</span>}
      </div>
      <input type="number" min={min} max={max} step={step}
        value={value === '' ? '' : value}
        onChange={e => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
        className={`w-full h-9 border rounded-lg px-3 text-[13px] text-ink focus:outline-none focus:border-brand transition-colors
          ${value === '' ? 'border-line bg-white placeholder-gray-300' : 'border-line bg-soft'}`}
      />
      {hint && (
        <p className="text-[10.5px] text-muted mt-1 leading-snug bg-amber-50 border border-amber-100 rounded px-2 py-1">
          💡 {hint}
        </p>
      )}
    </div>
  )
}

// ── Select field ──────────────────────────────────────────────────
export function SelectField({ label, value, onChange, options, hint, required = false }) {
  return (
    <div className="mb-3">
      <label className="text-[12px] font-medium text-ink block mb-1">
        {label}{required && <span className="text-red-400 ml-0.5 text-[10px]">*</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-9 border border-line rounded-lg px-3 text-[13px] bg-white text-ink focus:outline-none focus:border-brand">
        <option value="">— select —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && (
        <p className="text-[10.5px] text-muted mt-1 leading-snug bg-amber-50 border border-amber-100 rounded px-2 py-1">
          💡 {hint}
        </p>
      )}
    </div>
  )
}

// ── Input section divider ─────────────────────────────────────────
export function InputSection({ children }) {
  return (
    <p className="text-[10px] font-bold text-muted uppercase tracking-[1.2px] mt-5 mb-3 pb-1.5 border-b-2 border-line first:mt-0">
      {children}
    </p>
  )
}

// ── Model guidance box ────────────────────────────────────────────
export function ModelGuide({ title, criteria }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
      <p className="text-[10px] font-bold text-amber-800 mb-2 uppercase tracking-wide">
        When to use — {title}
      </p>
      <div className="space-y-2">
        {criteria.map((c, i) => (
          <div key={i}>
            <span className="text-[11px] font-semibold text-amber-700">{c.model}: </span>
            <span className="text-[11px] text-amber-900 leading-snug">{c.when}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Loading spinner ───────────────────────────────────────────────
export function CalcSpinner() {
  return (
    <div className="flex flex-col items-center gap-3 text-[13px] text-muted py-16">
      <div className="w-8 h-8 border-2 border-line border-t-brand rounded-full animate-spin"/>
      <p>Calculating on server…</p>
      <p className="text-[11px]">Results will appear in 1–2 seconds.</p>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────
export function EmptyState({ onSample }) {
  return (
    <div className="text-center py-16 px-8">
      <div className="w-14 h-14 bg-soft rounded-full flex items-center justify-center mx-auto mb-4">
        <svg width="24" height="24" fill="none" stroke="#94a3b8" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
      </div>
      <p className="text-[14px] font-semibold text-ink mb-2">Fill in inputs to see results</p>
      <p className="text-[12.5px] text-muted mb-6 max-w-sm mx-auto">
        Enter values in the left panel and click <strong>Calculate</strong>. Fields marked <span className="text-red-400">*</span> are required.
      </p>
      <button onClick={onSample}
        className="text-[12.5px] font-medium text-brand border border-blue-200 bg-blue-50 px-5 py-2.5 rounded-lg hover:bg-blue-100 transition-colors">
        Load sample calculation →
      </button>
    </div>
  )
}

// ── Calculate button ──────────────────────────────────────────────
export function CalcButton({ onClick, loading, disabled }) {
  return (
    <button onClick={onClick} disabled={loading || disabled}
      className="w-full mt-5 h-10 bg-ink text-white text-[13px] font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
      {loading
        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Calculating…</>
        : 'Calculate'}
    </button>
  )
}

// ── Section incomplete notice ─────────────────────────────────────
export function SectionIncomplete({ section }) {
  return (
    <div className="text-center py-12 px-6 bg-soft rounded-xl border border-line">
      <p className="text-[13px] font-medium text-ink mb-1">{section} inputs not filled</p>
      <p className="text-[12px] text-muted">Fill the {section.toLowerCase()} inputs in the left panel and click Calculate to see these results.</p>
    </div>
  )
}

// ── Full simulator page ───────────────────────────────────────────
export default function SimPage({ name, tagline, children }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Nav />
      <div className="bg-[#d4d8de]">
        <div className="max-w-[1500px] mx-auto px-10 py-5">
          <Link to="/dashboard"
            className="text-[11.5px] text-muted hover:text-ink no-underline transition-colors block mb-2">
            ← All simulators
          </Link>
          <h1 className="text-[22px] font-bold text-ink tracking-tight mb-1">{name}</h1>
          <p className="text-[13px] text-muted">{tagline}</p>
        </div>
      </div>
      <div className="max-w-[1500px] mx-auto px-10 py-6 flex-1">
        {children}
      </div>
      <Footer />
    </div>
  )
}
