// Multicomponent Distillation — Input Panel
// Full guidance on every input, model selection dropdowns, sample values

import { useState } from 'react'
import ComponentSelect from '../../components/ComponentSelect'
import { Field, InputSection, ModelGuide, SelectField } from '../../components/SimPage'

const ROLES = [
  { value: 'LK',  label: 'LK — Light Key' },
  { value: 'HK',  label: 'HK — Heavy Key' },
  { value: 'LNK', label: 'LNK — Light Non-Key' },
  { value: 'HNK', label: 'HNK — Heavy Non-Key' },
]

const EFFICIENCY_MODELS = [
  { value: "oconnell",  label: "O'Connell correlation (default)" },
  { value: "chanfair",  label: "Chan-Fair (1984) — high viscosity" },
  { value: "fixed",     label: "User-specified fixed value" },
]

const FEED_CONDITIONS = [
  { value: "1",    label: "q = 1 — Bubble-point liquid (most common)" },
  { value: "0",    label: "q = 0 — Saturated vapour (dew point)" },
  { value: "1.2",  label: "q = 1.2 — Subcooled liquid" },
  { value: "-0.1", label: "q = −0.1 — Superheated vapour" },
  { value: "custom", label: "Custom q value" },
]

const COL_TYPES = [
  { value: "tray",   label: "Sieve tray column" },
  { value: "packed", label: "Packed column" },
]

export default function MCInputs({ comps, setComps, mcGlobal, setMcGlobal }) {
  const [customQ, setCustomQ] = useState(false)

  const setG = (k, v) => setMcGlobal(p => ({ ...p, [k]: v }))
  const setComp = (i, field, val) => setComps(prev => prev.map((c, ci) => ci === i ? { ...c, [field]: val } : c))
  const selectComp = (i, comp) => setComps(prev => prev.map((c, ci) => ci === i ? {
    ...c,
    name: comp.name, MW: comp.MW, Tb: comp.Tb,
    A: comp.antoine.A, B: comp.antoine.B, C: comp.antoine.C,
  } : c))

  const sumZ = comps.reduce((s, c) => s + (+c.z || 0), 0)
  const zOk = Math.abs(sumZ - 1) < 0.005
  const hasLK = comps.some(c => c.role === 'LK')
  const hasHK = comps.some(c => c.role === 'HK')

  return (
    <div>
      {/* ── FEED & COLUMN ──────────────────────────────── */}
      <InputSection>Feed conditions</InputSection>

      <Field label="Feed flow F" unit="mol/h" value={mcGlobal.F}
        onChange={v => setG('F', v)} min={1}
        hint="Total molar feed rate entering the column. Sum of all component flows." />

      <Field label="Feed temperature T_f" unit="°C" value={mcGlobal.Tf}
        onChange={v => setG('Tf', v)}
        hint="Actual temperature of the feed stream. Used to estimate bubble/dew point and average relative volatilities at column conditions." />

      <Field label="Column pressure" unit="kPa" value={mcGlobal.Pcol}
        onChange={v => setG('Pcol', v)} min={1}
        hint="Operating pressure at the top of the column. Use 101.325 kPa for atmospheric. Vacuum columns: 5–20 kPa. Pressure columns: 200–1000 kPa." />

      {/* Feed thermal condition — model selection */}
      <div className="mb-3">
        <ModelGuide title="Feed thermal condition q" criteria={[
          { model: 'q = 1 (bubble-point liquid)', when: 'Feed is at its bubble point — no vapour present. Most common for liquid feeds from upstream vessels or pumps.' },
          { model: 'q = 0 (dew-point vapour)', when: 'Feed is saturated vapour. Use when feed comes directly from a vapour source or partial condenser.' },
          { model: 'q > 1 (subcooled liquid)', when: 'Feed is cold liquid below bubble point. q = 1 + Cp_L·(T_bubble−T_feed)/λ. Causes extra liquid load in stripping section.' },
          { model: 'q < 0 (superheated vapour)', when: 'Feed is vapour above dew point. q = −Cp_V·(T_feed−T_dew)/λ. Causes extra vapour load in rectifying section.' },
        ]} />
        <SelectField label="Feed condition model" value={mcGlobal.feedCondModel}
          onChange={v => { setG('feedCondModel', v); setCustomQ(v === 'custom') }}
          options={FEED_CONDITIONS} />
        {(customQ || mcGlobal.feedCondModel === 'custom') && (
          <Field label="Custom q value" value={mcGlobal.q}
            onChange={v => setG('q', v)} step={0.05} min={-2} max={3}
            hint="q = 1: bubble-point liquid. q = 0: saturated vapour. 0 < q < 1: partial vapour. q > 1: subcooled liquid. q < 0: superheated vapour." />
        )}
      </div>

      {/* ── REFLUX ─────────────────────────────────────── */}
      <InputSection>Reflux specification</InputSection>

      <Field label="R multiplier (R = mult × R_min)" value={mcGlobal.R_mult}
        onChange={v => setG('R_mult', v)} min={1.05} max={4} step={0.05}
        hint="R_min is calculated automatically by the Underwood method. Your actual reflux R = this multiplier × R_min. Typical range: 1.1–1.5. Economic optimum is usually 1.2–1.3 × R_min. Lower multiplier = fewer trays but more energy. Higher multiplier = more trays but less energy." />

      {/* ── LK/HK RECOVERY SPECS ───────────────────────── */}
      <InputSection>Separation specifications</InputSection>

      <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-[11.5px] text-blue-800 leading-snug">
        <p className="font-semibold mb-1">How to specify the separation:</p>
        <p>Specify RecD_LK = fraction of LK in feed that must appear in distillate (e.g. 0.99 = 99% recovery).</p>
        <p className="mt-1">Specify RecB_HK = fraction of HK in feed that must appear in bottoms.</p>
        <p className="mt-1">Non-key components are distributed automatically by the Hengstebeck-Geddes method — no input needed for them.</p>
      </div>

      <Field label="RecD_LK — LK recovery in distillate" value={mcGlobal.RecD_LK}
        onChange={v => setG('RecD_LK', v)} min={0.50} max={0.9999} step={0.01}
        hint="Fraction of LK moles in feed that appear in distillate. Example: 0.99 means 99% of LK goes overhead. Higher value = tighter separation = more stages. Typical: 0.95–0.999." />

      <Field label="RecB_HK — HK recovery in bottoms" value={mcGlobal.RecB_HK}
        onChange={v => setG('RecB_HK', v)} min={0.50} max={0.9999} step={0.01}
        hint="Fraction of HK moles in feed that appear in bottoms. Example: 0.99 means 99% of HK goes to bottoms. Typical: 0.95–0.999." />

      {/* ── COLUMN TYPE ────────────────────────────────── */}
      <InputSection>Column internals</InputSection>

      <ModelGuide title="Column type" criteria={[
        { model: 'Sieve tray', when: 'Throughput > 5 m³/h; fouling or solids present; turndown ratio > 3:1 needed; lower capital cost preferred; systems with foam or emulsification risk.' },
        { model: 'Packed column', when: 'Pressure drop must be minimised (vacuum systems, pressure-sensitive separations); column diameter < 0.6 m; highly corrosive service where trays are impractical; low liquid flow rates; HETP < 0.5 m needed.' },
      ]} />
      <SelectField label="Column type" value={mcGlobal.colType}
        onChange={v => setG('colType', v)} options={COL_TYPES} />

      <Field label="Tray spacing" unit="m" value={mcGlobal.traySpacing}
        onChange={v => setG('traySpacing', v)} min={0.3} max={0.9} step={0.05}
        hint="Vertical distance between trays. Standard: 0.6 m. Use 0.45 m for small columns (D < 1 m) to save height. Use 0.75–0.9 m for high liquid loads, foaming systems, or when maintenance access between trays is required." />

      <Field label="Weir height" unit="mm" value={mcGlobal.weirH}
        onChange={v => setG('weirH', v)} min={20} max={100}
        hint="Height of the outlet weir on each tray. Standard: 50 mm. Range 40–80 mm. Higher weir = more liquid holdup on tray = better efficiency but more pressure drop and more risk of flooding." />

      <Field label="Flood fraction" value={mcGlobal.floodFrac}
        onChange={v => setG('floodFrac', v)} min={0.60} max={0.85} step={0.05}
        hint="Design vapour velocity as fraction of the flooding velocity. 0.75 = conservative design for first estimate. 0.80 = standard commercial design. 0.85 = maximum, use only for existing columns. Never exceed 0.85 — flooding causes total loss of separation." />

      {/* ── TRAY EFFICIENCY MODEL ───────────────────────── */}
      <InputSection>Tray efficiency model</InputSection>

      <ModelGuide title="Tray efficiency method" criteria={[
        { model: "O'Connell correlation", when: "Best for preliminary design of most systems. Uses viscosity × relative volatility product. Accuracy ±10–15%. Valid for: μ_L = 0.1–10 mPa·s, α = 1.1–10. Use as default." },
        { model: "Chan-Fair (1984)", when: "More accurate for high-viscosity systems (μ_L > 2 mPa·s) or systems with unusual surface tension. Accounts for tray geometry. Use when O'Connell gives E_OC < 40% or > 80%." },
        { model: "User-specified fixed value", when: "Use when you have experimental tray efficiency data from a pilot plant or similar column. Overrides correlation — enter your measured value directly." },
      ]} />
      <SelectField label="Efficiency model" value={mcGlobal.efficiencyModel}
        onChange={v => setG('efficiencyModel', v)} options={EFFICIENCY_MODELS} />
      {mcGlobal.efficiencyModel === 'fixed' && (
        <Field label="Fixed tray efficiency E_O" value={mcGlobal.fixedEfficiency}
          onChange={v => setG('fixedEfficiency', v)} min={0.10} max={0.95} step={0.01}
          hint="Enter your experimentally measured or vendor-supplied overall tray efficiency as a fraction. Example: 0.70 = 70% efficiency. Typical range: 0.40–0.85." />
      )}

      {/* ── PHYSICAL PROPERTIES ────────────────────────── */}
      <InputSection>Physical properties (mixture)</InputSection>
      <p className="text-[10.5px] text-muted mb-3 leading-snug">
        Enter mixture-average values at average column temperature and pressure. If component properties are known individually, calculate mixture average as: P_mix = Σ(z_i × P_i) for the feed composition.
      </p>

      <Field label="ρ_L liquid density" unit="kg/m³" value={mcGlobal.rhoL}
        onChange={v => setG('rhoL', v)} min={300}
        hint="Average liquid density in column. Typical light organics (benzene/toluene): 850–900 kg/m³. Alcohols: 750–820 kg/m³. Water-organics: 900–1000 kg/m³." />

      <Field label="ρ_V vapour density" unit="kg/m³" value={mcGlobal.rhoV}
        onChange={v => setG('rhoV', v)} min={0.1} step={0.01}
        hint="Vapour density at column conditions. Estimate: ρ_V = P·MW_avg/(8314·T_K). Typical near-atmospheric organics: 1–5 kg/m³. Higher pressure columns: 5–30 kg/m³." />

      <Field label="μ_L liquid viscosity" unit="mPa·s" value={mcGlobal.muL}
        onChange={v => setG('muL', v)} min={0.05} step={0.01}
        hint="Dynamic viscosity of liquid mixture at average column temperature. Light organics at 80°C: 0.3–0.6 mPa·s. Heavier organics: 0.5–2.0 mPa·s. Used in O'Connell efficiency and flooding correlations." />

      <Field label="σ surface tension" unit="mN/m" value={mcGlobal.sigma}
        onChange={v => setG('sigma', v)} min={1}
        hint="Liquid surface tension. Used in Fair flooding correlation correction factor. Typical organics: 15–35 mN/m. Water: 72 mN/m. Alcohols: 20–25 mN/m." />

      {/* ── MECHANICAL (OPTIONAL) ──────────────────────── */}
      <InputSection>Mechanical — ASME (optional)</InputSection>
      <p className="text-[10.5px] text-muted mb-2 leading-snug">Leave blank to skip mechanical calculations.</p>

      <Field label="S_allow allowable stress" unit="MPa" value={mcGlobal.Sallow}
        onChange={v => setG('Sallow', v)} min={50} required={false}
        hint="From ASME Section II Part D, Table UCS-23. Carbon steel SA-516 Gr.70: 137 MPa at 20–250°C. SS 304L: 115 MPa. SS 316L: 120 MPa. Use material-specific value from ASME tables." />

      <Field label="Corrosion allowance" unit="mm" value={mcGlobal.CA}
        onChange={v => setG('CA', v)} min={0} max={15} required={false}
        hint="Extra thickness added to calculated shell thickness for corrosion over design life. Standard: 3 mm for carbon steel (20-year life, 0.15 mm/yr corrosion rate). Stainless steel: 1.5 mm. Lined vessels: 0 mm." />

      <Field label="Joint efficiency E" value={mcGlobal.Ejt}
        onChange={v => setG('Ejt', v)} min={0.70} max={1.0} step={0.05} required={false}
        hint="Weld joint efficiency from ASME Table UW-12. Type 1 (full radiography): E = 1.0. Type 2 (spot radiography): E = 0.85. Type 3 (no radiography): E = 0.70. Use 1.0 for critical pressure vessels." />

      <Field label="Wind speed" unit="m/s" value={mcGlobal.windSpeed}
        onChange={v => setG('windSpeed', v)} min={10} required={false}
        hint="Design wind speed at plant site. From IS 875 Part 3 wind zone map. Hyderabad (Zone II): 44 m/s. Mumbai (Zone III): 44 m/s. Chennai (Zone IV): 50 m/s. Delhi (Zone IV): 47 m/s." />

      {/* ── ECONOMICS (OPTIONAL) ───────────────────────── */}
      <InputSection>Economics (optional)</InputSection>
      <p className="text-[10.5px] text-muted mb-2 leading-snug">Leave blank to skip cost estimation.</p>

      <Field label="CEPCI current year" value={mcGlobal.CEPCI}
        onChange={v => setG('CEPCI', v)} required={false}
        hint="Chemical Engineering Plant Cost Index — current year value. 2024 ≈ 820. 2023 ≈ 800. Used to escalate Turton (2001 base year = 397) equipment costs to present day. Find at che.com/pci." />

      <Field label="CEPCI base (2001)" value={mcGlobal.CEPCIbase}
        onChange={v => setG('CEPCIbase', v)} required={false}
        hint="Turton textbook base year CEPCI = 397. Do not change unless using a different reference year." />

      <Field label="FBM bare module factor" value={mcGlobal.FBM}
        onChange={v => setG('FBM', v)} min={1} step={0.01} required={false}
        hint="Bare module factor for installed cost = equipment cost × FBM. Includes piping, instrumentation, civil, structural, electrical, insulation, painting. Carbon steel column: 4.16. SS 304: 5.2. SS 316: 5.8 (Turton Table A.1)." />

      <Field label="Steam cost" unit="$/kg" value={mcGlobal.steamCost}
        onChange={v => setG('steamCost', v)} step={0.005} required={false}
        hint="Reboiler steam utility cost. Typical plant values: LP steam (5 bar): $0.018–0.025/kg. MP steam (10 bar): $0.022–0.030/kg. HP steam (15 bar): $0.025–0.035/kg." />

      <Field label="CW cost" unit="$/m³" value={mcGlobal.CWcost}
        onChange={v => setG('CWcost', v)} step={0.0001} required={false}
        hint="Cooling water cost for condenser. Typical: $0.0003–0.001/m³ depending on site. Includes pumping, treatment, and make-up water." />

      <Field label="Operating hours" unit="h/yr" value={mcGlobal.opHours}
        onChange={v => setG('opHours', v)} min={1000} required={false}
        hint="Annual plant operating hours. Continuous refinery/petrochemical: 8000–8760 h/yr. Batch or seasonal: 4000–6000 h/yr." />

      <Field label="Payback period" unit="yr" value={mcGlobal.payback}
        onChange={v => setG('payback', v)} min={1} required={false}
        hint="Capital payback period used in TAC = CAPEX/payback + OPEX. Standard for TAC calculation: 3 years. Longer for slow-return projects: 5–10 years." />

      {/* ── COMPONENT TABLE ────────────────────────────── */}
      <InputSection>Component data (rank A→F by decreasing volatility)</InputSection>

      <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11.5px] text-amber-900 leading-snug">
        <p className="font-semibold mb-1">How to fill the component table:</p>
        <p>• Rank components from most volatile (A) to least volatile (F) — i.e. by increasing boiling point.</p>
        <p className="mt-1">• Designate exactly ONE component as LK and ONE as HK. All others are non-keys (LNK if lighter than LK, HNK if heavier than HK).</p>
        <p className="mt-1">• All z_i values must sum to exactly 1.000. The sum is shown below.</p>
        <p className="mt-1">• Use the search box to auto-fill Antoine constants. You can edit any value after auto-fill.</p>
      </div>

      <ModelGuide title="Component role designation" criteria={[
        { model: 'LK — Light Key', when: 'The most volatile component you want to recover in the distillate (top product). Exactly one LK is required. Example: in benzene/toluene/xylene separation, benzene is LK.' },
        { model: 'HK — Heavy Key', when: 'The least volatile component you want to control in the distillate (remainder goes to bottoms). Exactly one HK is required. Example: toluene is HK if separating benzene from xylene mixture.' },
        { model: 'LNK — Light Non-Key', when: 'Component lighter (more volatile) than LK. Will mostly appear in distillate. Distribution calculated by Hengstebeck-Geddes. Example: a light impurity or dissolved gas.' },
        { model: 'HNK — Heavy Non-Key', when: 'Component heavier (less volatile) than HK. Will mostly appear in bottoms. Distribution calculated by Hengstebeck-Geddes. Example: heavy aromatic or high-boiling impurity.' },
      ]} />

      {/* Validation status */}
      <div className="flex gap-2 mb-3">
        <div className={`flex-1 p-2 rounded-lg border text-[11px] font-medium text-center ${zOk ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          Σ z_i = {sumZ.toFixed(3)} {zOk ? '✓' : '✗ must = 1.000'}
        </div>
        <div className={`flex-1 p-2 rounded-lg border text-[11px] font-medium text-center ${hasLK ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          LK: {hasLK ? '✓ assigned' : '✗ required'}
        </div>
        <div className={`flex-1 p-2 rounded-lg border text-[11px] font-medium text-center ${hasHK ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          HK: {hasHK ? '✓ assigned' : '✗ required'}
        </div>
      </div>

      {/* Component cards */}
      {comps.map((comp, i) => (
        <div key={i} className="border border-line rounded-xl p-3 mb-3 bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-muted uppercase tracking-wide">
              Component {String.fromCharCode(65 + i)}
              {i === 0 && <span className="ml-1 text-[10px] normal-case font-normal">(most volatile)</span>}
              {i === comps.length - 1 && comps.length > 1 && <span className="ml-1 text-[10px] normal-case font-normal">(least volatile)</span>}
            </p>
            {comp.name && <span className="text-[11px] font-medium text-brand">{comp.name}</span>}
          </div>

          <ComponentSelect
            label={`Search component ${String.fromCharCode(65 + i)}`}
            onSelect={c => selectComp(i, c)} />

          <SelectField label="Role in separation" value={comp.role}
            onChange={v => setComp(i, 'role', v)} options={ROLES}
            hint="LK = Light Key (specify RecD_LK above). HK = Heavy Key (specify RecB_HK above). LNK/HNK = non-keys, their distribution between distillate and bottoms is calculated automatically by Hengstebeck-Geddes — no recovery spec needed." />

          <Field label="z_i feed mole fraction" value={comp.z}
            onChange={v => setComp(i, 'z', v)} min={0} max={1} step={0.01}
            hint="Mole fraction of this component in the total feed. All components must sum to 1.000. Enter 0 to exclude a component row." />

          <Field label="MW molecular weight" unit="g/mol" value={comp.MW}
            onChange={v => setComp(i, 'MW', v)} min={1} required={false}
            hint="Auto-filled from component search. Used to calculate stream mass flows and average MW of distillate/bottoms." />

          <Field label="T_b normal boiling point" unit="°C" value={comp.Tb}
            onChange={v => setComp(i, 'Tb', v)} required={false}
            hint="Normal boiling point at 1 atm (101.325 kPa). Auto-filled from component search. Used only for reference — volatility is calculated from Antoine equation." />

          <div className="mt-1">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-wide mb-1">Antoine constants</p>
            <p className="text-[10px] text-muted mb-2 p-2 bg-amber-50 border border-amber-100 rounded leading-snug">
              💡 Auto-filled from component search above. Formula: log₁₀(P*/mmHg) = A − B/(C + T°C). Source: NIST WebBook (webbook.nist.gov) if not in database. Verify P unit is mmHg and T unit is °C before entering manually.
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="text-[11px] text-muted block mb-1">A</label>
                <input type="number" step="0.001" value={comp.A}
                  onChange={e => setComp(i, 'A', e.target.value === '' ? '' : +e.target.value)}
                  className="w-full h-8 border border-line rounded-lg px-2 text-[12px] bg-white text-ink focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1">B</label>
                <input type="number" step="0.001" value={comp.B}
                  onChange={e => setComp(i, 'B', e.target.value === '' ? '' : +e.target.value)}
                  className="w-full h-8 border border-line rounded-lg px-2 text-[12px] bg-white text-ink focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1">C</label>
                <input type="number" step="0.001" value={comp.C}
                  onChange={e => setComp(i, 'C', e.target.value === '' ? '' : +e.target.value)}
                  className="w-full h-8 border border-line rounded-lg px-2 text-[12px] bg-white text-ink focus:outline-none focus:border-brand" />
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Add/remove component buttons */}
      <div className="flex gap-2 mt-1 mb-2">
        {comps.length < 6 && (
          <button onClick={() => setComps(p => [...p, { name:'', role:'HNK', z:'', MW:'', Tb:'', A:'', B:'', C:'' }])}
            className="flex-1 h-9 border border-line rounded-lg text-[12px] text-muted hover:text-ink hover:border-brand transition-colors bg-transparent cursor-pointer">
            + Add component
          </button>
        )}
        {comps.length > 2 && (
          <button onClick={() => setComps(p => p.slice(0, -1))}
            className="h-9 px-4 border border-red-100 rounded-lg text-[12px] text-red-500 hover:text-red-700 hover:border-red-300 transition-colors bg-transparent cursor-pointer">
            Remove last
          </button>
        )}
      </div>
    </div>
  )
}
