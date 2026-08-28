import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import SimPage, {
  TabBar, MetricCard, ResultTable, SectionHead, Check,
  Field, SelectField, InputSection, ModelGuide,
  CalcSpinner, EmptyState, CalcButton, SectionIncomplete
} from '../../components/SimPage'
import { calculate } from '../../lib/calculate'
import { saveRun } from '../../lib/history'

const TABS = [
  { id:'sample',   label:'Sample Calculation' },
  { id:'select',   label:'Selection & Levenspiel' },
  { id:'kinetics', label:'Kinetics' },
  { id:'batch',    label:'Batch' },
  { id:'cstr',     label:'CSTR' },
  { id:'pfr',      label:'PFR' },
  { id:'fixedbed', label:'Fixed Bed (Ergun)' },
  { id:'heat',     label:'Heat Transfer' },
  { id:'econ',     label:'Economics' },
  { id:'checks',   label:'Design Checks' },
]

const SAMPLE = {
  A_freq:200000000, Ea:75000, dHrx:-125000, n_order:1,
  FA0:2, CA0:500, v0:0.004, T0:80, X:0.8,
  T_op:80, P_op:200, T_c:20, U_HT:500, A_HT:5,
  rho:900, Cp:3500, mu:0.001, D_AB:1.5e-9,
  L_rx:3, D_rx:1,
  dp:0.001, eps_b:0.4, rho_cat:1200,
  CEPCI:820, steamCost:0.02, opHours:8000, cA_cost:0.5, FBM:3.5,
}
const EMPTY = Object.fromEntries(Object.keys(SAMPLE).map(k=>[k,'']))

const REACTOR_TYPES = [
  { value:'cstr', label:'CSTR — Continuous stirred tank (well-mixed)' },
  { value:'pfr',  label:'PFR — Plug flow tubular reactor' },
  { value:'batch', label:'Batch — Time-based semicontinuous' },
  { value:'fixed', label:'Fixed Bed — Heterogeneous catalyst' },
]
const RATE_ORDERS = [
  { value:'1', label:'1st order — r_A = k·C_A' },
  { value:'2', label:'2nd order — r_A = k·C_A²' },
  { value:'0.5', label:'Half order — r_A = k·C_A^0.5' },
  { value:'0', label:'Zero order — r_A = k' },
]

export default function ReactorPage() {
  const location = useLocation()
  const [inp, setInp] = useState(EMPTY)
  const [tab, setTab] = useState('sample')
  const [r, setR] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setInp(p => ({...p, [k]: v}))
  const f = (v, d=2) => v == null ? '—' : typeof v === 'number' && Math.abs(v) < 0.001 && v !== 0 ? v.toExponential(3) : (+v).toFixed(d)

  useEffect(() => {
    const state = location.state
    if (state?.restore && state?.inputs) {
      setInp(state.inputs)
      if (state.results) { setR(state.results); setTab('select') }
    }
  }, [])

  const hasCore  = () => ['A_freq','Ea','dHrx','n_order','FA0','CA0','v0','X','T_op'].every(k=>inp[k]!=='')
  const hasHeat  = () => ['U_HT','A_HT','T_c'].every(k=>inp[k]!=='')
  const hasEcon  = () => ['CEPCI','FBM','opHours'].every(k=>inp[k]!=='')

  const runCalc = async () => {
    if (!hasCore()) { setErr('Fill required kinetics and feed fields (*)'); return }
    setLoading(true); setErr('')
    try {
      const nums = Object.fromEntries(Object.entries(inp).map(([k,v])=>[k,v===''?0:+v]))
      const res = await calculate('reactor', nums)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('select'); await saveRun('reactor','Reactor Design', nums, res) }
    } catch(e) { setErr('Calculation error: '+e.message) }
    finally { setLoading(false) }
  }

  const loadSample = async () => {
    setInp(SAMPLE); setLoading(true); setErr('')
    try {
      const res = await calculate('reactor', SAMPLE)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('select') }
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <SimPage name="Reactor Design"
      tagline="Batch, CSTR, PFR and fixed bed — Arrhenius kinetics, Levenspiel sizing, Ergun pressure drop, Thiele/Aris effectiveness, Semenov stability, Turton economics.">
      <div className="flex gap-8">
        {/* INPUT PANEL */}
        <div className="w-[300px] flex-shrink-0 overflow-y-auto" style={{maxHeight:'85vh'}}>

          <InputSection>Reactor type & kinetics</InputSection>
          <ModelGuide title="Reactor type selection" criteria={[
            { model:'CSTR', when:'Highly exothermic reactions (excellent temperature control). Product inhibition (lower C_A reduces rate, CSTR maintains low C_A throughout). Requires continuous operation. V_CSTR > V_PFR for most reactions.' },
            { model:'PFR', when:'High conversion needed with good selectivity (concentration profile improves yield). Isothermal gas-phase reactions. Tubular reactors with cooling jackets. V_PFR < V_CSTR — more efficient for most reactions.' },
            { model:'Batch', when:'Low volume, high value products. Multiple products in same vessel. Reaction time < 8 hours. Pharmaceutical, specialty chemical, fermentation.' },
            { model:'Fixed Bed', when:'Heterogeneous catalysis required (solid catalyst + liquid or gas reactant). Petroleum refining, ammonia synthesis, oxidation reactions. Check Ergun ΔP and Thiele modulus.' },
          ]}/>
          <SelectField label="Primary reactor type" value={inp.reactor_type||'cstr'} onChange={v=>set('reactor_type',v)} options={REACTOR_TYPES}/>

          <ModelGuide title="Reaction rate order" criteria={[
            { model:'1st order', when:'Most common for elementary reactions. Radioactive decay, first-order hydrolysis, isomerisation. r_A = k·C_A. Units of k: s⁻¹.' },
            { model:'2nd order', when:'Bimolecular reactions, saponification, dimerisation. r_A = k·C_A². Units of k: m³/(mol·s).' },
            { model:'Zero order', when:'Enzyme-saturated reactions (Michaelis-Menten at high substrate), surface reactions where catalyst is saturated. r_A = k (independent of concentration).' },
          ]}/>
          <SelectField label="Reaction order n" value={String(inp.n_order||'1')} onChange={v=>set('n_order',+v)} options={RATE_ORDERS}/>

          <InputSection>Arrhenius kinetics</InputSection>
          <Field label="Pre-exponential A_freq" unit="s⁻¹" value={inp.A_freq} onChange={v=>set('A_freq',v)} min={1}
            hint="Arrhenius frequency factor. Units depend on order: 1st order = s⁻¹, 2nd order = m³/(mol·s). Find from literature or from two k measurements at different temperatures using Arrhenius plot."/>
          <Field label="Activation energy Ea" unit="J/mol" value={inp.Ea} onChange={v=>set('Ea',v)} min={1000}
            hint="From Arrhenius plot slope: Ea = −R·d(ln k)/d(1/T). Typical ranges: low (enzyme, acid-base): 20–50 kJ/mol. Moderate: 50–100 kJ/mol. High (cracking, pyrolysis): 100–250 kJ/mol."/>
          <Field label="Heat of reaction ΔH_rx" unit="J/mol" value={inp.dHrx} onChange={v=>set('dHrx',v)}
            hint="Per mole of limiting reactant A reacted. Negative = exothermic (heat released). Positive = endothermic (heat absorbed). Find from Hess's law or calorimetry. Combustion: −800 to −2000 kJ/mol."/>

          <InputSection>Feed conditions</InputSection>
          <Field label="FA0 molar feed rate" unit="mol/s" value={inp.FA0} onChange={v=>set('FA0',v)} min={0.001}
            hint="Molar flow rate of limiting reactant A entering the reactor. FA0 = CA0 × v0."/>
          <Field label="CA0 feed concentration" unit="mol/m³" value={inp.CA0} onChange={v=>set('CA0',v)} min={0.01}
            hint="Concentration of A in the feed stream. Liquid phase: typically 100–2000 mol/m³. Higher CA0 = smaller reactor volume but higher exothermic temperature rise."/>
          <Field label="v0 volumetric flow rate" unit="m³/s" value={inp.v0} onChange={v=>set('v0',v)} min={1e-6} step={0.0001}
            hint="Volumetric feed flow rate. v0 = FA0/CA0 for liquid phase. For gas phase, correct for T and P."/>
          <Field label="Feed temperature T0" unit="°C" value={inp.T0} onChange={v=>set('T0',v)}
            hint="Temperature of the feed stream entering the reactor."/>
          <Field label="Target conversion X" value={inp.X} onChange={v=>set('X',v)} min={0.01} max={0.99} step={0.01}
            hint="Fractional conversion of A: X = (FA0−FA)/FA0. Higher X = larger volume required. Check Levenspiel plot — for autocatalytic reactions, optimal X may not be 0.99."/>

          <InputSection>Operating conditions</InputSection>
          <Field label="Operating temperature T_op" unit="°C" value={inp.T_op} onChange={v=>set('T_op',v)}
            hint="Isothermal reactor temperature. Higher T = larger k = smaller volume, but more severe heat removal needed and potential selectivity loss."/>
          <Field label="Operating pressure P_op" unit="kPa abs" value={inp.P_op} onChange={v=>set('P_op',v)} min={1}
            hint="Reactor operating pressure. Important for gas-phase reactions (affects concentration). For liquid phase, pressure mainly affects equipment design."/>
          <Field label="Coolant temperature T_c" unit="°C" value={inp.T_c} onChange={v=>set('T_c',v)}
            hint="Jacket or coil coolant inlet temperature. For cooling (exothermic): use cooling water (20–35°C). For heating: steam condensate (100–180°C)."/>

          <InputSection>Fluid & thermal properties</InputSection>
          <Field label="Mixture density ρ" unit="kg/m³" value={inp.rho} onChange={v=>set('rho',v)} min={1}
            hint="Process mixture density at operating conditions. Water: 1000 kg/m³. Organic liquids: 700–900 kg/m³. Gases: use ideal gas law."/>
          <Field label="Heat capacity Cp" unit="J/(kg·K)" value={inp.Cp} onChange={v=>set('Cp',v)} min={100}
            hint="Mixture heat capacity. Water: 4186 J/(kg·K). Organic liquids: 1800–3500 J/(kg·K). Used in energy balance and adiabatic temperature rise calculation."/>
          <Field label="Dynamic viscosity μ" unit="Pa·s" value={inp.mu} onChange={v=>set('mu',v)} min={1e-6} step={0.0001}
            hint="At operating temperature. Water@80°C = 0.000355 Pa·s. Organic liquids: 0.001–0.01 Pa·s. Used in Reynolds number and mass transfer calculations."/>
          <Field label="Diffusivity D_AB" unit="m²/s" value={inp.D_AB} onChange={v=>set('D_AB',v)} step={1e-10}
            hint="Molecular diffusivity of A in mixture. Liquids: 1–5 × 10⁻⁹ m²/s. Gases: 1–5 × 10⁻⁵ m²/s. Used in Thiele modulus and Mears criterion."/>

          <InputSection>Reactor geometry</InputSection>
          <Field label="Reactor length/height L_rx" unit="m" value={inp.L_rx} onChange={v=>set('L_rx',v)} min={0.1}
            hint="PFR tube length or CSTR height. Used for L/D ratio check and geometry. For CSTR: H/D typically 1.0–1.5."/>
          <Field label="Reactor diameter D_rx" unit="m" value={inp.D_rx} onChange={v=>set('D_rx',v)} min={0.01}
            hint="Vessel internal diameter. For PFR: D = 0.05–0.3m for tubular. For CSTR: D = 0.5–3m. L/D for PFR should be < 50."/>

          <InputSection>Heat transfer</InputSection>
          <Field label="U overall" unit="W/(m²·K)" value={inp.U_HT} onChange={v=>set('U_HT',v)} min={10} required={false}
            hint="Overall heat transfer coefficient jacket/coil to reactor contents. CSTR with good agitation: 200–800 W/(m²·K). PFR tubular: 100–400 W/(m²·K)."/>
          <Field label="Heat transfer area A_HT" unit="m²" value={inp.A_HT} onChange={v=>set('A_HT',v)} min={0} required={false}
            hint="Jacket + coil available area. Jacket area = π×D×H. Coil area = π×d_coil×L_coil. The required area A_HT_req is calculated automatically."/>

          <InputSection>Fixed bed catalyst (optional)</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug">Fill only for fixed bed / catalytic reactor calculations.</p>
          <Field label="Particle diameter d_p" unit="m" value={inp.dp} onChange={v=>set('dp',v)} min={0.0001} step={0.0005} required={false}
            hint="Catalyst particle size. Spherical pellets: 3–10mm. Extrudates: 1.5×4mm. Smaller particles = better effectiveness but higher ΔP (Ergun equation)."/>
          <Field label="Bed void fraction ε_b" value={inp.eps_b} onChange={v=>set('eps_b',v)} min={0.3} max={0.7} step={0.01} required={false}
            hint="Fraction of bed volume that is void space (not occupied by catalyst). Spheres: ε ≈ 0.40. Rings: ε ≈ 0.55–0.65. Larger void = lower ΔP but less catalyst."/>
          <Field label="Catalyst density ρ_cat" unit="kg/m³" value={inp.rho_cat} onChange={v=>set('rho_cat',v)} min={100} required={false}
            hint="Bulk density with voids. Pellets: 800–1400 kg/m³. Rings: 500–800 kg/m³. Used to calculate catalyst weight W_cat = ρ_cat × V_bed × (1−ε_b)."/>

          <InputSection>Economics (optional)</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug">Leave blank to skip cost estimation.</p>
          <Field label="CEPCI current" value={inp.CEPCI} onChange={v=>set('CEPCI',v)} required={false} hint="2024 ≈ 820."/>
          <Field label="FBM factor" value={inp.FBM} onChange={v=>set('FBM',v)} min={1} step={0.01} required={false}
            hint="CS CSTR: 3.5. SS CSTR: 4.5. Glass-lined: 6.0. (Turton Table A.1)"/>
          <Field label="Steam cost" unit="$/kg" value={inp.steamCost} onChange={v=>set('steamCost',v)} step={0.005} required={false}/>
          <Field label="Raw material cost c_A" unit="$/mol" value={inp.cA_cost} onChange={v=>set('cA_cost',v)} step={0.01} required={false}/>
          <Field label="Operating hours" unit="h/yr" value={inp.opHours} onChange={v=>set('opHours',v)} required={false}/>

          {err && <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg"><p className="text-[11.5px] text-red-600 leading-snug">{err}</p></div>}
          <CalcButton onClick={runCalc} loading={loading}/>
        </div>

        {/* RESULTS PANEL */}
        <div className="flex-1 min-w-0">
          <TabBar tabs={TABS} active={tab} onChange={setTab}/>

          {/* Sample tab */}
          {tab==='sample' && (
            <div className="w-full max-w-4xl">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
                <p className="text-[14px] font-semibold text-blue-900 mb-1">Sample calculation — Liquid phase first-order exothermic reaction</p>
                <p className="text-[12.5px] text-blue-700 mb-4">A → Products. Ea = 75 kJ/mol, ΔH_rx = −125 kJ/mol, T_op = 80°C, X = 0.80. Compare CSTR, PFR and Batch volumes.</p>
                <button onClick={loadSample} className="text-[13px] font-semibold bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                  Load and run sample →
                </button>
              </div>
              <SectionHead>Sample inputs</SectionHead>
              <ResultTable rows={[
                ['Pre-exponential A_freq','2×10⁸','s⁻¹'],
                ['Activation energy Ea','75,000','J/mol'],
                ['Heat of reaction ΔH_rx','−125,000','J/mol (exothermic)'],
                ['FA0 / CA0 / v0','2 mol/s / 500 mol/m³ / 0.004 m³/s','—'],
                ['Target conversion X','0.80','—'],
                ['Operating temperature','80','°C'],
                ['Coolant temperature T_c','20','°C'],
              ]}/>
              <SectionHead>Expected results</SectionHead>
              <ResultTable rows={[
                ['k at 80°C','≈ 8.8×10⁻³','s⁻¹'],
                ['V_CSTR','≈ 0.065','m³'],['V_PFR','≈ 0.022','m³'],
                ['V_CSTR/V_PFR','≈ 3','— (CSTR less efficient)'],
                ['ΔT_adiabatic','≈ −55','°C (exothermic)'],
              ]}/>
            </div>
          )}

          {tab !== 'sample' && loading && <CalcSpinner/>}
          {tab !== 'sample' && !r && !loading && <EmptyState onSample={loadSample}/>}

          {/* Selection & Levenspiel */}
          {r && tab==='select' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="V_CSTR" value={f(r.V_cstr,4)} unit="m³"/>
                <MetricCard label="V_PFR" value={f(r.V_pfr,4)} unit="m³"/>
                <MetricCard label="V_CSTR/V_PFR" value={f(r.V_ratio,2)} unit="—"/>
                <MetricCard label="k at T_op" value={r.k?.toExponential(3)} unit="s⁻¹" highlight/>
              </div>
              <SectionHead>Levenspiel plot — 1/(−r_A) vs X</SectionHead>
              <div className="border border-line rounded-xl p-4 mb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={r.levenspiel}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="X" label={{value:'Conversion X',position:'insideBottom',offset:-5}} tick={{fontSize:11}}/>
                    <YAxis label={{value:'1/(−r_A)',angle:-90,position:'insideLeft'}} tick={{fontSize:11}}/>
                    <Tooltip/>
                    <Line type="monotone" dataKey="1/(-rA)" stroke="#2563eb" name="1/(−r_A)" dot={true} strokeWidth={2}/>
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-[10.5px] text-muted mt-2">Area under curve = V_PFR. Rectangle (X × 1/(−r_A)|_exit) = V_CSTR/FA0.</p>
              </div>
              <SectionHead>Reactor comparison</SectionHead>
              <table className="w-full text-[12px] border-collapse mb-4">
                <thead>
                  <tr className="bg-soft border-b border-line">
                    {['Type','Mode','Conversion','Exothermic','Volume'].map(h=>(
                      <th key={h} className="text-left py-2 px-2 text-[10.5px] font-bold text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.selTable?.map((row,i)=>(
                    <tr key={i} className="border-b border-line">
                      <td className="py-2 px-2 font-medium text-ink">{row.type}</td>
                      <td className="py-2 px-2 text-muted">{row.mode}</td>
                      <td className="py-2 px-2">{row.X}</td>
                      <td className="py-2 px-2">{row.exo}</td>
                      <td className="py-2 px-2 font-medium text-brand">{row.V}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Kinetics tab */}
          {r && tab==='kinetics' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="k at T_op" value={r.k?.toExponential(3)} unit="s⁻¹" highlight/>
                <MetricCard label="k at T_op+10°C" value={r.k_plus10?.toExponential(3)} unit="s⁻¹"/>
                <MetricCard label="ΔT to double k" value={f(r.dT_double,1)} unit="°C"/>
                <MetricCard label="Damköhler Da" value={f(r.Da,3)} unit="—"/>
                <MetricCard label="CA_exit" value={f(r.CA_exit,2)} unit="mol/m³"/>
                <MetricCard label="r_A at exit" value={r.rA_exit?.toExponential(3)} unit="mol/(m³·s)"/>
                <MetricCard label="r_A at feed" value={r.rA_feed?.toExponential(3)} unit="mol/(m³·s)"/>
                <MetricCard label="ΔT_adiabatic" value={f(r.dT_ad,1)} unit="°C"/>
              </div>
              <ResultTable rows={[
                ['Arrhenius: k = A·exp(−Ea/RT)',r.k?.toExponential(4),'s⁻¹'],
                ['T_op',inp.T_op,'°C → '+(+inp.T_op+273.15).toFixed(1)+' K'],
                ['k at T_op+10°C',r.k_plus10?.toExponential(4),'s⁻¹'],
                ['ΔT to double rate',f(r.dT_double,1),'°C (rule of thumb: ~10°C for Ea≈50kJ)'],
                ['Damköhler Da = k × τ_geom',f(r.Da,3),'— (Da>>1: reaction limited, Da<<1: limited by residence time)'],
                ['C_A,exit = CA0×(1−X)',f(r.CA_exit,2),'mol/m³'],
                ['(−r_A) at exit',r.rA_exit?.toExponential(3),'mol/(m³·s)'],
                ['ΔT_adiabatic = −ΔH_rx×CA0×X/(ρ×Cp)',f(r.dT_ad,1),'°C'],
                ['T_peak (adiabatic)',f(r.T_peak,1),'°C'],
              ]}/>
            </div>
          )}

          {/* Batch tab */}
          {r && tab==='batch' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="t_reaction" value={f(r.t_rx_s,1)} unit="s" highlight/>
                <MetricCard label="t_reaction" value={f(r.t_rx_h,3)} unit="h"/>
                <MetricCard label="V_batch" value={f(r.V_batch,4)} unit="m³"/>
                <MetricCard label="Batches/day" value={f(r.batches_day,1)} unit="—"/>
                <MetricCard label="Q_cool (batch)" value={f(r.Q_cool_batch,0)} unit="W"/>
              </div>
              <ResultTable rows={[
                ['Model','Design equation: dX/dt = −r_A/CA0',''],
                ['1st order: t_rx = −ln(1−X)/k',f(r.t_rx_s,1),'s'],
                ['t_rx in hours',f(r.t_rx_h,3),'h'],
                ['V_batch = FA0×t_rx×2/(X×CA0) (incl. turnaround)',f(r.V_batch,4),'m³'],
                ['Batches per day (2× cycle time)',f(r.batches_day,1),'batches/day'],
                ['Q_cool per batch = FA0×|ΔH_rx|×X',f(r.Q_cool_batch,0),'W average'],
              ]}/>
            </div>
          )}

          {/* CSTR tab */}
          {r && tab==='cstr' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="V_CSTR" value={f(r.V_cstr,4)} unit="m³" highlight/>
                <MetricCard label="τ_CSTR" value={f(r.tau_cstr,1)} unit="s"/>
                <MetricCard label="D_CSTR" value={f(r.D_cstr,3)} unit="m"/>
                <MetricCard label="H_CSTR (H/D=1.5)" value={f(r.H_cstr,3)} unit="m"/>
                <MetricCard label="Q_gen (heat generation)" value={f(r.Q_gen,0)} unit="W"/>
                <MetricCard label="Q_remove (jacket)" value={f(r.Q_remove,0)} unit="W"/>
                <MetricCard label="A_HT required" value={f(r.A_HT_req,2)} unit="m²"/>
                <MetricCard label="κ (heat removal param)" value={f(r.kappa,3)} unit="—"/>
              </div>
              <ResultTable rows={[
                ['Design equation V = FA0×X/(−r_A)|_exit',f(r.V_cstr,4),'m³'],
                ['τ = V/v0',f(r.tau_cstr,1),'s'],
                ['D_CSTR (H/D=1.5)',f(r.D_cstr,3),'m'],['H_CSTR',f(r.H_cstr,3),'m'],
                ['Q_gen = FA0×|ΔH_rx|×X',f(r.Q_gen,0),'W'],
                ['Q_remove = U×A_HT×(T_op−T_c)',f(r.Q_remove,0),'W'],
                ['A_HT required = Q_gen/(U×ΔT)',f(r.A_HT_req,2),'m²'],
                ['A_HT provided',inp.A_HT,'m²'],
                ['Heat removal parameter κ = UA_HT×τ/(ρ×Cp×V)',f(r.kappa,3),'—'],
              ]}/>
            </div>
          )}

          {/* PFR tab */}
          {r && tab==='pfr' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="V_PFR" value={f(r.V_pfr,4)} unit="m³" highlight/>
                <MetricCard label="τ_PFR" value={f(r.tau_pfr,1)} unit="s"/>
                <MetricCard label="L_PFR" value={f(r.L_pfr,2)} unit="m"/>
                <MetricCard label="L/D ratio" value={f(r.LD_pfr,1)} unit="—"/>
                <MetricCard label="V_CSTR/V_PFR" value={f(r.V_ratio,2)} unit="—"/>
              </div>
              <ResultTable rows={[
                ['Design equation V = FA0×∫dX/(−r_A)',f(r.V_pfr,4),'m³'],
                ['τ_PFR = V/v0',f(r.tau_pfr,1),'s'],
                ['L_PFR = V/(π/4×D²)',f(r.L_pfr,2),'m'],
                ['L/D ratio (must be < 50)',f(r.LD_pfr,1),'—'],
                ['V_CSTR/V_PFR ratio',f(r.V_ratio,2),'— (how much larger CSTR is)'],
              ]}/>
            </div>
          )}

          {/* Fixed bed tab */}
          {r && tab==='fixedbed' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="ΔP_bed (Ergun)" value={f(r.dP_bed,3)} unit="kPa" highlight/>
                <MetricCard label="Re_p" value={f(r.Re_p,2)} unit="—"/>
                <MetricCard label="Thiele modulus φ" value={f(r.phi_thiele,3)} unit="—"/>
                <MetricCard label="η_Aris (effectiveness)" value={f(r.eta_aris,3)} unit="—"/>
                <MetricCard label="Mears criterion" value={f(r.mears,4)} unit="(< 0.15)"/>
                <MetricCard label="W_catalyst" value={f(r.W_cat,1)} unit="kg"/>
              </div>
              <ResultTable rows={[
                ['Ergun equation (mixed flow)','',''],
                ['u_s (superficial velocity)',f(r.us_bed,5),'m/s'],
                ['Re_p = ρ×u_s×d_p/(μ×(1−ε))',f(r.Re_p,2),'—'],
                ['ΔP/L = 150μu_s(1−ε)²/(d_p²ε³) + 1.75ρu_s²(1−ε)/(d_pε³)',f(r.dP_L,1),'Pa/m'],
                ['ΔP_bed total',f(r.dP_bed,3),'kPa'],
                ['ΔP/P_op (must be < 10%)',f(r.dP_check,1),'%'],
                ['Thiele modulus φ = d_p/6×√(k/D_eff)',f(r.phi_thiele,3),'—'],
                ['D_eff = D_AB×0.35/3',r.D_eff,'m²/s'],
                ['η_Aris = 1/(1+φ²/3) (sphere approximation)',f(r.eta_aris,3),'—'],
                ['Mears criterion (< 0.15 = no ext. mass transfer limit)',f(r.mears,4),'—'],
                ['W_catalyst = ρ_cat×V_PFR×(1−ε)',f(r.W_cat,1),'kg'],
              ]}/>
            </div>
          )}

          {/* Heat transfer tab */}
          {r && tab==='heat' && (!hasHeat() ? <SectionIncomplete section="Heat transfer"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Q_sensible" value={f(r.Q_sens2,0)} unit="W"/>
                <MetricCard label="Q_reaction" value={f(r.Q_gen,0)} unit="W"/>
                <MetricCard label="Q_total" value={f(r.Q_tot,0)} unit="W" highlight/>
                <MetricCard label="A_jacket available" value={f(r.A_jkt_avail,2)} unit="m²"/>
                <MetricCard label="A_jacket required" value={f(r.A_jkt_req,2)} unit="m²"/>
                <MetricCard label="Extra coil needed" value={f(r.A_coil_extra,2)} unit="m²"/>
                <MetricCard label="Semenov number Se" value={f(r.Se,4)} unit="(< 0.25)"/>
                <MetricCard label="Stability slope ok?" value={r.slope_ok?'YES':'NO'} unit="dQ_remove/dT > dQ_gen/dT"/>
              </div>
              <ResultTable rows={[
                ['Q_sensible = ṁ×Cp×(T_op−T0)',f(r.Q_sens2,0),'W'],
                ['Q_reaction = FA0×|ΔH_rx|×X',f(r.Q_gen,0),'W'],
                ['Q_total to remove',f(r.Q_tot,0),'W'],
                ['LMTD jacket = T_op − T_c − 5',f(r.LMTD_jkt,1),'°C'],
                ['A_jacket required = Q_tot/(U×LMTD)',f(r.A_jkt_req,2),'m²'],
                ['A_jacket available (π×D×H)',f(r.A_jkt_avail,2),'m²'],
                ['Extra coil area required',f(r.A_coil_extra,2),'m²'],
                ['Semenov number Se = Q_gen/(U×A×T_K)',f(r.Se,4),'— (must be < 0.25 for stability)'],
                ['Stability: slope U×A vs dQ_gen/dT',r.slope_ok?'STABLE — U×A > dQ_gen/dT':'UNSTABLE — add more HT area',''],
              ]}/>
            </div>
          ))}

          {/* Economics tab */}
          {r && tab==='econ' && (!hasEcon() ? <SectionIncomplete section="Economics"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="V_design (+15%)" value={f(r.V_design,4)} unit="m³"/>
                <MetricCard label="C_p0 (bare)" value={`$${f(r.Cp0,0)}`} unit="USD"/>
                <MetricCard label="CBM (installed)" value={`$${f(r.CBM,0)}`} unit="USD" highlight/>
                <MetricCard label="Raw material OPEX" value={`$${f(r.OPEX_RM,0)}`} unit="/yr"/>
              </div>
              <ResultTable rows={[
                ['V_design = V_CSTR × 1.15',f(r.V_design,4),'m³'],
                ['C_p0 (Turton, CEPCI-escalated)','$'+f(r.Cp0,0),'USD'],
                ['CBM = FBM × C_p0','$'+f(r.CBM,0),'USD'],
                ['Raw material OPEX (c_A × FA0 × hours)','$'+f(r.OPEX_RM,0),'/yr'],
              ]}/>
            </div>
          ))}

          {/* Design checks */}
          {r && tab==='checks' && (
            <div>
              <p className="text-[12px] text-muted mb-4">10 design checks — all must be PASS before finalising.</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {r.checks.map(c=><Check key={c.l} label={c.l} value={c.v} pass={c.pass}/>)}
              </div>
              <ResultTable rows={[
                ['Checks passed',`${r.checks.filter(c=>c.pass).length} / ${r.checks.length}`,''],
                ['V_CSTR',f(r.V_cstr,4),'m³'],['V_PFR',f(r.V_pfr,4),'m³'],
                ['k at T_op',r.k?.toExponential(3),'s⁻¹'],
              ]}/>
            </div>
          )}
        </div>
      </div>
    </SimPage>
  )
}
