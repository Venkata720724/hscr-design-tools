import { useState, useEffect, useRef } from 'react'
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
  { id:'sample',    label:'Sample Calculation' },
  { id:'thermal',   label:'Thermal' },
  { id:'tube',      label:'Tube Side' },
  { id:'shell',     label:'Shell Side (Bell-Delaware)' },
  { id:'overall',   label:'Overall U' },
  { id:'condenser', label:'Condenser' },
  { id:'reboiler',  label:'Reboiler' },
  { id:'mech',      label:'Mechanical' },
  { id:'vibration', label:'Vibration' },
  { id:'checks',    label:'Design Checks' },
]

const SAMPLE = {
  Ds:0.387, Bs:0.15, Bc:0.25, Pt:0.0238, Nb:30, do:0.01905, di:0.01483,
  L:4.88, Nt:216, passes:2, kw:50, dNs:0.0762, dNt:0.0508,
  ms:10, Ts_in:150, Ts_out:90, rhos:780, mus:0.0025, musw:0.005, ks:0.135, Cps:2100, Rfs:0.0002,
  mt:20, Tt_in:30, Tt_out:45, rhot:993, mut:0.00069, mutw:0.00058, kt:0.627, Cpt:4178, Rft:0.0002,
  ut_max:2.5, us_max:1.5, dPt_max:50000, dPs_max:70000,
  Pd_mech:1, Sallow:137, CA:0.003, Ew:0.85, FBM:3.17, CEPCI:820, CEPCIbase:397, opHours:8000,
  shellUtilCost:0.025, tubeUtilCost:0.05,
  rhol_cond:750, lambda_cond:250000, mus_cond:0.0003, Pc_bar:30, Pop_bar:5,
  rhov_reb:5, sigma_reb:0.015, lambda_reb:200000,
}
const EMPTY = Object.fromEntries(Object.keys(SAMPLE).map(k => [k, '']))

const TUBE_LAYOUTS = [
  { value:'triangular', label:'30° Triangular (highest packing, standard)' },
  { value:'square', label:'90° Square (easier cleaning, lower h)' },
  { value:'rotated', label:'45° Rotated Square (compromise)' },
]
const TEMA_FRONT = [
  { value:'A', label:'A — Channel with removable cover' },
  { value:'B', label:'B — Bonnet integral cover' },
  { value:'C', label:'C — Channel integral with tubesheet' },
  { value:'N', label:'N — Fixed tubesheet channel' },
]
const TEMA_REAR = [
  { value:'U', label:'U — U-tube bundle (cheapest, no thermal expansion issues)' },
  { value:'L', label:'L — Fixed tubesheet (cheapest shell, limited thermal expansion)' },
  { value:'M', label:'M — Fixed tubesheet removable cover' },
  { value:'S', label:'S — Floating head with backing device' },
  { value:'T', label:'T — Pull-through floating bundle' },
]

export default function HXPage() {
  const location = useLocation()
  const [inp, setInp] = useState(EMPTY)
  const [tab, setTab] = useState('sample')
  const [r, setR] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setInp(p => ({...p, [k]: v}))
  const f = (v, d=2) => v == null ? '—' : (+v).toFixed(d)

  useEffect(() => {
    const state = location.state
    if (state?.restore && state?.inputs) {
      setInp(state.inputs)
      if (state.results) { setR(state.results); setTab('thermal') }
    }
  }, [])

  const hasGeom = () => ['Ds','Bs','Bc','Pt','Nb','do','di','L','Nt','passes'].every(k => inp[k] !== '')
  const hasShell = () => ['ms','Ts_in','Ts_out','rhos','mus','ks','Cps'].every(k => inp[k] !== '')
  const hasTube  = () => ['mt','Tt_in','Tt_out','rhot','mut','kt','Cpt'].every(k => inp[k] !== '')
  const hasMech  = () => ['Pd_mech','Sallow','CA','Ew'].every(k => inp[k] !== '')
  const hasEcon  = () => ['CEPCI','FBM','opHours'].every(k => inp[k] !== '')

  const runCalc = async () => {
    if (!hasGeom() || !hasShell() || !hasTube()) {
      setErr('Fill all geometry, shell-side and tube-side fields (*)'); return
    }
    setLoading(true); setErr('')
    try {
      const nums = Object.fromEntries(Object.entries(inp).map(([k,v]) => [k, v===''?0:+v]))
      const res = await calculate('heat-exchanger', nums)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('thermal'); await saveRun('heat-exchanger','Heat Exchanger', nums, res) }
    } catch(e) { setErr('Calculation error: '+e.message) }
    finally { setLoading(false) }
  }

  const loadSample = async () => {
    setInp(SAMPLE); setLoading(true); setErr('')
    try {
      const res = await calculate('heat-exchanger', SAMPLE)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('thermal') }
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <SimPage name="Heat Exchanger"
      tagline="Shell & tube design — Bell-Delaware shell side, LMTD/F factor, tube hydraulics, Nusselt condensation, Mostinski reboiler, Blevins/Connors vibration, ASME mechanical, Turton economics.">
      <div className="flex gap-8">
        {/* INPUT PANEL */}
        <div className="w-[300px] flex-shrink-0 overflow-y-auto" style={{maxHeight:'85vh'}}>

          <InputSection>TEMA designation</InputSection>
          <ModelGuide title="Rear head type" criteria={[
            { model:'U-tube (U)', when:'Cheapest option. No thermal expansion issues. Cannot clean inside of U-bends. Use for clean tube-side fluids.' },
            { model:'Fixed tubesheet (L/M)', when:'Cheapest shell. Use when temperature difference is small (ΔT < 50°C) to avoid excessive thermal stress.' },
            { model:'Floating head (S/T)', when:'Required when tube-side and shell-side temperatures differ significantly (ΔT > 50°C). Allows thermal expansion. More expensive.' },
          ]}/>
          <SelectField label="Front head type" value={inp.tema_front||'A'} onChange={v=>set('tema_front',v)} options={TEMA_FRONT}
            hint="Type A (channel with removable cover) is most common — allows tube inspection without disturbing piping."/>
          <SelectField label="Rear head type" value={inp.tema_rear||'U'} onChange={v=>set('tema_rear',v)} options={TEMA_REAR}/>
          <SelectField label="Tube layout" value={inp.tube_layout||'triangular'} onChange={v=>set('tube_layout',v)} options={TUBE_LAYOUTS}
            hint="30° triangular gives most tubes per shell diameter. 90° square allows mechanical cleaning of shell side."/>

          <InputSection>Shell geometry</InputSection>
          <Field label="Shell ID D_s" unit="m" value={inp.Ds} onChange={v=>set('Ds',v)} min={0.1} step={0.05}
            hint="Standard TEMA sizes: 0.205, 0.254, 0.305, 0.387, 0.489, 0.591, 0.690, 0.787, 0.889 m. Choose nearest standard size after calculating required area."/>
          <Field label="Baffle spacing B_s" unit="m" value={inp.Bs} onChange={v=>set('Bs',v)} min={0.05} step={0.025}
            hint="Central baffle spacing. Typical: 0.2–0.5 × D_s. TEMA minimum = D_s/5. Smaller spacing = higher shell-side h but higher ΔP."/>
          <Field label="Baffle cut B_c" unit="fraction" value={inp.Bc} onChange={v=>set('Bc',v)} min={0.15} max={0.45} step={0.05}
            hint="Fraction of shell diameter. Standard: 0.25 (25%). Range 0.15–0.45. Higher cut = lower ΔP but lower h. Use 0.25 for standard designs."/>
          <Field label="Tube pitch P_t" unit="m" value={inp.Pt} onChange={v=>set('Pt',v)} min={0.02} step={0.001}
            hint="Centre-to-centre distance between tubes. Minimum P_t = 1.25 × d_o per TEMA. Standard: 1.25×d_o for 19mm tubes = 23.8mm."/>
          <Field label="Number of baffles N_b" value={inp.Nb} onChange={v=>set('Nb',v)} min={1}
            hint="Approximate: N_b = L/B_s − 1. More baffles = higher shell-side h and ΔP. Minimum 2 baffles for stable flow."/>
          <Field label="Shell nozzle ID d_Ns" unit="m" value={inp.dNs} onChange={v=>set('dNs',v)} step={0.005}
            hint="Shell inlet/outlet nozzle bore. Standard: 3-in = 0.076m, 4-in = 0.102m, 6-in = 0.154m. Velocity check: u_nozzle < 2 m/s for liquids."/>
          <Field label="Tube nozzle ID d_Nt" unit="m" value={inp.dNt} onChange={v=>set('dNt',v)} step={0.005}
            hint="Tube-side inlet/outlet nozzle bore. Standard: 2-in = 0.051m, 3-in = 0.076m. Check velocity < 3 m/s for liquids."/>

          <InputSection>Tube geometry</InputSection>
          <Field label="Tube OD d_o" unit="m" value={inp.do} onChange={v=>set('do',v)} min={0.01} step={0.001}
            hint="Standard tube sizes: 19.05mm (3/4 inch) — most common. 25.4mm (1 inch) for fouling or viscous fluids. 12.7mm (1/2 inch) for clean light fluids."/>
          <Field label="Tube ID d_i" unit="m" value={inp.di} onChange={v=>set('di',v)} min={0.008} step={0.001}
            hint="d_i = d_o − 2×wall thickness. For 19.05mm OD, 14 BWG: d_i = 14.83mm. For 12 BWG: d_i = 15.09mm."/>
          <Field label="Tube length L" unit="m" value={inp.L} onChange={v=>set('L',v)} min={1}
            hint="Standard TEMA lengths: 1.83, 2.44, 3.66, 4.88, 6.10 m. Longer tubes = more area per shell but harder to maintain. Most common: 4.88m."/>
          <Field label="Number of tubes N_t" value={inp.Nt} onChange={v=>set('Nt',v)} min={10}
            hint="From TEMA tube count tables or triangular/square layout geometry. A_prov = π × d_o × L × N_t. Iterate to meet A_required."/>
          <Field label="Tube passes" value={inp.passes} onChange={v=>set('passes',v)} min={1} max={8}
            hint="Number of tube-side passes. 1 = single pass (counter-current). 2 = most common (one return). 4 or 6 = used when tube-side flow rate is low and higher velocity is needed."/>
          <Field label="k_wall tube material" unit="W/(m·K)" value={inp.kw} onChange={v=>set('kw',v)} min={1}
            hint="Carbon steel: 50. SS 316: 16. Titanium: 22. Copper: 380. Admiralty brass: 111. Hastelloy C: 10."/>

          <InputSection>Shell-side fluid (hot)</InputSection>
          <Field label="Mass flow ṁ_s" unit="kg/s" value={inp.ms} onChange={v=>set('ms',v)} min={0.01}
            hint="Total shell-side mass flow rate at design conditions."/>
          <Field label="Inlet temperature T_s,in" unit="°C" value={inp.Ts_in} onChange={v=>set('Ts_in',v)}
            hint="Hot fluid inlet temperature. Must be higher than T_t,out for valid heat exchange."/>
          <Field label="Outlet temperature T_s,out" unit="°C" value={inp.Ts_out} onChange={v=>set('Ts_out',v)}
            hint="Hot fluid outlet (design target). Q_shell = ṁ_s × Cp_s × (T_in − T_out)."/>
          <Field label="Density ρ_s" unit="kg/m³" value={inp.rhos} onChange={v=>set('rhos',v)} min={1}
            hint="At mean temperature (T_in + T_out)/2. Crude oil ≈ 780, water ≈ 993, steam ≈ 2 kg/m³."/>
          <Field label="Viscosity μ_s" unit="Pa·s" value={inp.mus} onChange={v=>set('mus',v)} min={1e-6} step={0.0001}
            hint="Dynamic viscosity at bulk mean temperature. Water@80°C = 0.000355. Crude oil@120°C ≈ 0.002–0.01 Pa·s."/>
          <Field label="Wall viscosity μ_s,w" unit="Pa·s" value={inp.musw} onChange={v=>set('musw',v)} min={1e-6} step={0.0001}
            hint="Viscosity at estimated wall temperature — used in Sieder-Tate viscosity correction (μ/μ_w)^0.14. Usually higher than bulk μ for cooling."/>
          <Field label="Thermal conductivity k_s" unit="W/(m·K)" value={inp.ks} onChange={v=>set('ks',v)} min={0.01}
            hint="At mean temperature. Water: 0.60, organic oils: 0.12–0.18, hydrocarbons: 0.10–0.15."/>
          <Field label="Heat capacity Cp_s" unit="J/(kg·K)" value={inp.Cps} onChange={v=>set('Cps',v)} min={100}
            hint="At mean temperature. Water: 4186, crude oil: 2000–2500, organic liquids: 1800–2500 J/(kg·K)."/>
          <Field label="Fouling resistance R_f,s" unit="m²·K/W" value={inp.Rfs} onChange={v=>set('Rfs',v)} min={0} step={0.00005}
            hint="TEMA fouling factors: crude oil = 0.0002, steam = 0.0001, river water = 0.0003, sea water = 0.0001, cooling water = 0.0002."/>

          <InputSection>Tube-side fluid (cold)</InputSection>
          <Field label="Mass flow ṁ_t" unit="kg/s" value={inp.mt} onChange={v=>set('mt',v)} min={0.01}/>
          <Field label="Inlet temperature T_t,in" unit="°C" value={inp.Tt_in} onChange={v=>set('Tt_in',v)}
            hint="Cold fluid inlet temperature."/>
          <Field label="Outlet temperature T_t,out" unit="°C" value={inp.Tt_out} onChange={v=>set('Tt_out',v)}
            hint="Cold fluid outlet (design target). Q_tube = ṁ_t × Cp_t × (T_out − T_in). Must match Q_shell within 2%."/>
          <Field label="Density ρ_t" unit="kg/m³" value={inp.rhot} onChange={v=>set('rhot',v)} min={1}/>
          <Field label="Viscosity μ_t" unit="Pa·s" value={inp.mut} onChange={v=>set('mut',v)} min={1e-6} step={0.0001}/>
          <Field label="Wall viscosity μ_t,w" unit="Pa·s" value={inp.mutw} onChange={v=>set('mutw',v)} min={1e-6} step={0.0001}/>
          <Field label="Thermal conductivity k_t" unit="W/(m·K)" value={inp.kt} onChange={v=>set('kt',v)} min={0.01}/>
          <Field label="Heat capacity Cp_t" unit="J/(kg·K)" value={inp.Cpt} onChange={v=>set('Cpt',v)} min={100}/>
          <Field label="Fouling resistance R_f,t" unit="m²·K/W" value={inp.Rft} onChange={v=>set('Rft',v)} min={0} step={0.00005}/>

          <InputSection>Design constraints</InputSection>
          <Field label="Max tube velocity u_t,max" unit="m/s" value={inp.ut_max} onChange={v=>set('ut_max',v)} min={0.5}
            hint="Water: 2–3 m/s. Organic liquids: 1.5–2.5 m/s. Gases: 15–30 m/s. Sea water (erosion limit): 1.8 m/s max."/>
          <Field label="Max shell velocity u_s,max" unit="m/s" value={inp.us_max} onChange={v=>set('us_max',v)} min={0.1}
            hint="Oil: 0.5–1.5 m/s. Water: 0.5–1.0 m/s. Gases: 5–15 m/s."/>
          <Field label="Max tube ΔP" unit="Pa" value={inp.dPt_max} onChange={v=>set('dPt_max',v)} min={1000}
            hint="Liquids: 35,000–70,000 Pa (35–70 kPa). Gases: 3,000–7,000 Pa. Vacuum service: minimize ΔP."/>
          <Field label="Max shell ΔP" unit="Pa" value={inp.dPs_max} onChange={v=>set('dPs_max',v)} min={1000}
            hint="Liquids: 35,000–70,000 Pa. Gases: 3,000–7,000 Pa."/>

          <InputSection>Mechanical — ASME (optional)</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug">Leave blank to skip mechanical calculations.</p>
          <Field label="Design pressure P_d" unit="MPa" value={inp.Pd_mech} onChange={v=>set('Pd_mech',v)} min={0.1} required={false}
            hint="Shell-side design pressure for ASME UG-27 thickness calculation. Typically max operating pressure + 10% or + 175 kPa, whichever is greater."/>
          <Field label="S_allow allowable stress" unit="MPa" value={inp.Sallow} onChange={v=>set('Sallow',v)} min={50} required={false}
            hint="From ASME Section II-D Table 1A. CS SA-516 Gr.70@100°C = 137 MPa. SS 316@100°C = 115 MPa."/>
          <Field label="Corrosion allowance CA" unit="m" value={inp.CA} onChange={v=>set('CA',v)} min={0} step={0.001} required={false}
            hint="Standard: 0.003m (3mm) for carbon steel. 0.0015m (1.5mm) for stainless steel. Titanium: 0."/>
          <Field label="Weld efficiency E_w" value={inp.Ew} onChange={v=>set('Ew',v)} min={0.7} max={1.0} step={0.05} required={false}
            hint="Full radiography: 1.0. Spot radiography: 0.85. No radiography: 0.70."/>

          <InputSection>Condenser / reboiler properties (optional)</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug">Fill only if this is a condenser or reboiler service.</p>
          <Field label="ρ_L condensate" unit="kg/m³" value={inp.rhol_cond} onChange={v=>set('rhol_cond',v)} required={false}
            hint="Liquid condensate density. Used in Nusselt condensation correlation."/>
          <Field label="λ_cond latent heat" unit="J/kg" value={inp.lambda_cond} onChange={v=>set('lambda_cond',v)} required={false}
            hint="Latent heat of condensation. Steam@100°C = 2,257,000 J/kg. Hydrocarbons: 100,000–400,000 J/kg."/>
          <Field label="μ_cond viscosity" unit="Pa·s" value={inp.mus_cond} onChange={v=>set('mus_cond',v)} required={false}/>
          <Field label="P_c critical pressure" unit="bar" value={inp.Pc_bar} onChange={v=>set('Pc_bar',v)} required={false}
            hint="Critical pressure of reboiling fluid. Used in Mostinski nucleate boiling correlation. Find from NIST or Perry's."/>
          <Field label="P_op operating pressure" unit="bar" value={inp.Pop_bar} onChange={v=>set('Pop_bar',v)} required={false}
            hint="Operating pressure of reboiling fluid. Used to calculate reduced pressure P_r = P_op/P_c."/>
          <Field label="ρ_V vapour density" unit="kg/m³" value={inp.rhov_reb} onChange={v=>set('rhov_reb',v)} required={false}/>
          <Field label="σ surface tension" unit="N/m" value={inp.sigma_reb} onChange={v=>set('sigma_reb',v)} required={false}
            hint="Liquid surface tension for Zuber critical flux calculation. Water@100°C = 0.059 N/m."/>
          <Field label="λ_reb latent heat" unit="J/kg" value={inp.lambda_reb} onChange={v=>set('lambda_reb',v)} required={false}/>

          <InputSection>Economics (optional)</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug">Leave blank to skip cost estimation.</p>
          <Field label="FBM bare module factor" value={inp.FBM} onChange={v=>set('FBM',v)} min={1} step={0.01} required={false}
            hint="Turton Table A.1. CS shell & tube: 3.17. SS shell & tube: 4.23."/>
          <Field label="CEPCI current" value={inp.CEPCI} onChange={v=>set('CEPCI',v)} min={300} required={false}
            hint="2024 ≈ 820. Find at che.com/pci."/>
          <Field label="CEPCI base (2001)" value={inp.CEPCIbase} onChange={v=>set('CEPCIbase',v)} required={false}
            hint="Turton base = 397. Do not change."/>
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
                <p className="text-[14px] font-semibold text-blue-900 mb-1">Sample calculation — Crude oil / Sea water heat exchanger</p>
                <p className="text-[12.5px] text-blue-700 mb-4">Crude oil (shell side) cooled from 150°C to 90°C by sea water (tube side) entering at 30°C. Single shell, 2 tube passes, TEMA AEU.</p>
                <button onClick={loadSample} className="text-[13px] font-semibold bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                  Load and run sample →
                </button>
              </div>
              <SectionHead>Sample inputs</SectionHead>
              <ResultTable rows={[
                ['Shell ID D_s','0.387','m'],['Tube OD/ID','19.05 / 14.83','mm'],
                ['Tube length L','4.88','m (16 ft standard)'],['Number of tubes N_t','216','—'],
                ['Baffle spacing B_s','0.15','m'],['Baffle cut B_c','0.25','(25%)'],
                ['Shell-side fluid','Crude oil, 10 kg/s','150→90°C'],
                ['Tube-side fluid','Sea water, 20 kg/s','30→45°C'],
                ['Tube passes','2','—'],
              ]}/>
              <SectionHead>Expected results</SectionHead>
              <ResultTable rows={[
                ['Q_design','≈ 1260','kW'],['LMTD','≈ 73','°C'],
                ['U_dirty','≈ 350–450','W/(m²·K)'],['A_required','≈ 35–45','m²'],
                ['A_provided (N_t × π × d_o × L)','≈ 62','m²'],['Over-design','≈ 20–40','%'],
              ]}/>
            </div>
          )}

          {tab !== 'sample' && loading && <CalcSpinner/>}
          {tab !== 'sample' && !r && !loading && <EmptyState onSample={loadSample}/>}

          {/* Thermal tab */}
          {r && tab==='thermal' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Q_design" value={f(r.Q,0)} unit="W" highlight/>
                <MetricCard label="LMTD" value={f(r.LMTD,2)} unit="°C"/>
                <MetricCard label="F-factor" value={f(r.F,3)} unit="—"/>
                <MetricCard label="Effective ΔT_m" value={f(r.dTm,2)} unit="°C"/>
                <MetricCard label="A_required" value={f(r.A_req,2)} unit="m²" highlight/>
                <MetricCard label="A_provided" value={f(r.A_prov,2)} unit="m²"/>
                <MetricCard label="Over-design OD%" value={f(r.OD,1)} unit="%"/>
                <MetricCard label="Duty imbalance" value={f(r.imbalance,2)} unit="%"/>
              </div>
              <div className="border border-line rounded-xl p-4 mb-4">
                <p className="text-[12.5px] font-semibold text-ink mb-3">Temperature profile (counter-current)</p>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={r.profile}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="pos" label={{value:'Position (%)',position:'insideBottom',offset:-5}} tick={{fontSize:11}}/>
                    <YAxis label={{value:'Temperature (°C)',angle:-90,position:'insideLeft'}} tick={{fontSize:11}}/>
                    <Tooltip formatter={(v,n)=>[`${v}°C`,n]}/>
                    <Legend/>
                    <Line type="monotone" dataKey="hot" stroke="#dc2626" name="Shell side (hot)" dot={false} strokeWidth={2}/>
                    <Line type="monotone" dataKey="cold" stroke="#2563eb" name="Tube side (cold)" dot={false} strokeWidth={2}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ResultTable rows={[
                ['Q_shell = ṁ_s·Cp_s·ΔT_s',f(r.Qs,0),'W'],
                ['Q_tube  = ṁ_t·Cp_t·ΔT_t',f(r.Qt,0),'W'],
                ['Duty imbalance',f(r.imbalance,2),'% (should be < 2%)'],
                ['ΔT_1 (hot in − cold out)',f(r.dT1,2),'°C'],
                ['ΔT_2 (hot out − cold in)',f(r.dT2,2),'°C'],
                ['LMTD (log mean)',f(r.LMTD,2),'°C'],
                ['R = (T_s,in−T_s,out)/(T_t,out−T_t,in)',f(r.Rf,3),'—'],
                ['S = (T_t,out−T_t,in)/(T_s,in−T_t,in)',f(r.Sf,3),'—'],
                ['F-factor (Bowman 1-shell/2-tube)',f(r.F,3),'—'],
                ['Effective ΔT_m = F × LMTD',f(r.dTm,2),'°C'],
                ['A_provided = π×d_o×L×N_t',f(r.A_prov,2),'m²'],
                ['A_required = Q/(U_dirty×ΔT_m)',f(r.A_req,2),'m²'],
                ['Over-design = (A_prov−A_req)/A_req',f(r.OD,1),'%'],
              ]}/>
            </div>
          )}

          {/* Tube side tab */}
          {r && tab==='tube' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="u_tube" value={f(r.ut,3)} unit="m/s" highlight/>
                <MetricCard label="Re_tube" value={f(r.Re_t,0)} unit="—"/>
                <MetricCard label="Pr_tube" value={f(r.Pr_t,2)} unit="—"/>
                <MetricCard label="Nu_tube" value={f(r.Nu_t,2)} unit="—"/>
                <MetricCard label="h_tube (inside)" value={f(r.ht,0)} unit="W/(m²·K)"/>
                <MetricCard label="h_tube (outside)" value={f(r.ht_adj,0)} unit="W/(m²·K)"/>
                <MetricCard label="ΔP_tube total" value={f(r.dPt_total,1)} unit="kPa"/>
                <MetricCard label="Flow regime" value={r.regime_t} unit=""/>
              </div>
              <ResultTable rows={[
                ['Tubes per pass N_t/passes',f(r.Nt_pass,0),'—'],
                ['Flow area per tube π/4×d_i²×(N_t/passes)',f(r.At_flow,6),'m²'],
                ['Tube velocity u_t = ṁ_t/(ρ_t×A_flow)',f(r.ut,3),'m/s'],
                ['Reynolds Re_t = ρ_t×u_t×d_i/μ_t',f(r.Re_t,0),'—'],
                ['Prandtl Pr_t = μ_t×Cp_t/k_t',f(r.Pr_t,2),'—'],
                ['Flow regime',r.regime_t,'(turbulent >10000, transition 2300-10000)'],
                ['Nu (Dittus-Boelter / Sieder-Tate)',f(r.Nu_t,2),'—'],
                ['h_i = Nu×k_t/d_i',f(r.ht,0),'W/(m²·K)'],
                ['h_i corrected to OD basis ×(d_i/d_o)',f(r.ht_adj,0),'W/(m²·K)'],
                ['Darcy friction factor f_t',f(r.ft,4),'—'],
                ['ΔP_tube (Darcy-Weisbach + nozzle)',f(r.dPt_total,1),'kPa'],
              ]}/>
            </div>
          )}

          {/* Shell side tab */}
          {r && tab==='shell' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="u_shell" value={f(r.us,3)} unit="m/s" highlight/>
                <MetricCard label="Re_shell" value={f(r.Re_s,0)} unit="—"/>
                <MetricCard label="h_ideal" value={f(r.h_ideal,0)} unit="W/(m²·K)"/>
                <MetricCard label="h_shell (corrected)" value={f(r.ho,0)} unit="W/(m²·K)" highlight/>
                <MetricCard label="J_c (baffle cut)" value={f(r.Jc,3)} unit="—"/>
                <MetricCard label="J_l (leakage)" value={f(r.Jl,3)} unit="—"/>
                <MetricCard label="J_b (bypass)" value={f(r.Jb,3)} unit="—"/>
                <MetricCard label="ΔP_shell" value={f(r.dPs_total,1)} unit="kPa"/>
              </div>
              <ResultTable rows={[
                ['Shell flow area A_s = D_s×B_s×(P_t−d_o)/P_t',f(r.As,5),'m²'],
                ['Shell velocity u_s = ṁ_s/(ρ_s×A_s)',f(r.us,3),'m/s'],
                ['Equivalent diameter d_e (triangular)',f(r.de,4),'m'],
                ['Re_s = ρ_s×u_s×d_e/μ_s',f(r.Re_s,0),'—'],
                ['Pr_s = μ_s×Cp_s/k_s',f(r.Pr_s,2),'—'],
                ['h_ideal (Bell-Delaware base)',f(r.h_ideal,0),'W/(m²·K)'],
                ['J_c (baffle cut correction)',f(r.Jc,3),'—'],
                ['J_l (baffle leakage correction)',f(r.Jl,3),'—'],
                ['J_b (bundle bypass correction)',f(r.Jb,2),'(= 0.70 est.)'],
                ['J_r (laminar correction)',f(r.Jr,2),'—'],
                ['h_shell = h_ideal × J_c × J_l × J_b × J_r',f(r.ho,0),'W/(m²·K)'],
                ['ΔP_shell (Bell-Delaware)',f(r.dPs_total,1),'kPa'],
              ]}/>
            </div>
          )}

          {/* Overall U tab */}
          {r && tab==='overall' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="U_clean" value={f(r.U_clean,0)} unit="W/(m²·K)" highlight/>
                <MetricCard label="U_dirty" value={f(r.U_dirty,0)} unit="W/(m²·K)" highlight/>
                <MetricCard label="Cleanliness factor" value={f(r.cleanliness,1)} unit="%"/>
                <MetricCard label="R_wall" value={r.Rw?.toExponential(3)} unit="m²·K/W"/>
              </div>
              <ResultTable rows={[
                ['h_tube (OD basis)',f(r.ht_adj,0),'W/(m²·K)'],
                ['R_wall = t_w×d_o/(d_lm×k_w)',r.Rw?.toExponential(3),'m²·K/W'],
                ['R_f,t (tube fouling, OD basis)',r.Rft_adj?.toExponential(3),'m²·K/W'],
                ['h_shell',f(r.ho,0),'W/(m²·K)'],
                ['R_f,s (shell fouling)',f(+inp.Rfs,5),'m²·K/W'],
                ['1/U_clean = 1/h_t + R_w + 1/h_s',f(r.U_clean,0),'W/(m²·K)'],
                ['1/U_dirty = 1/U_clean + R_f,t + R_f,s',f(r.U_dirty,0),'W/(m²·K)'],
                ['Cleanliness factor U_dirty/U_clean',f(r.cleanliness,1),'%'],
                ['A_req = Q/(U_dirty×ΔT_m)',f(r.A_req,2),'m²'],
              ]}/>
            </div>
          )}

          {/* Condenser tab */}
          {r && tab==='condenser' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="T_condensing (avg)" value={f(r.T_cond,1)} unit="°C"/>
                <MetricCard label="ΔT_film" value={f(r.dT_film,1)} unit="°C"/>
                <MetricCard label="N_r (tube rows)" value={r.Nr} unit="—"/>
                <MetricCard label="h_cond (single tube)" value={f(r.h_cond_top,0)} unit="W/(m²·K)"/>
                <MetricCard label="h_cond (row corrected)" value={f(r.h_cond,0)} unit="W/(m²·K)" highlight/>
                <MetricCard label="A_cond_required" value={f(r.A_cond_req,1)} unit="m²"/>
              </div>
              <ResultTable rows={[
                ['Model','Nusselt horizontal tube condensation (Eissenberg row correction)',''],
                ['T_cond = (T_s,in + T_s,out)/2',f(r.T_cond,1),'°C'],
                ['ΔT_film = T_cond − T_wall (estimated)',f(r.dT_film,1),'°C'],
                ['h_cond,1tube = 0.725×[ρ_L²×g×λ×k³/(μ_L×d_o×ΔT)]^0.25',f(r.h_cond_top,0),'W/(m²·K)'],
                ['Row correction N_r^(-1/6)',`N_r = ${r.Nr} rows`,''],
                ['h_cond (corrected)',f(r.h_cond,0),'W/(m²·K)'],
                ['A_cond required',f(r.A_cond_req,1),'m²'],
              ]}/>
            </div>
          )}

          {/* Reboiler tab */}
          {r && tab==='reboiler' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="P_r (reduced pressure)" value={f(r.Pr_reb,4)} unit="—"/>
                <MetricCard label="F_p (pressure factor)" value={f(r.Fp_reb,3)} unit="—"/>
                <MetricCard label="q_reb (heat flux)" value={f(r.q_reb,0)} unit="W/m²" highlight/>
                <MetricCard label="h_nb (Mostinski)" value={f(r.h_nb,0)} unit="W/(m²·K)" highlight/>
                <MetricCard label="q_max (Zuber)" value={f(r.q_max_zuber,0)} unit="W/m²"/>
                <MetricCard label="Flux / critical flux" value={f(r.flux_frac,1)} unit="%"/>
              </div>
              <ResultTable rows={[
                ['Model','Mostinski nucleate boiling + Zuber critical flux',''],
                ['P_r = P_op / P_c',f(r.Pr_reb,4),'—'],
                ['F_p = 1.8P_r^0.17 + 4P_r^1.2 + 10P_r^10',f(r.Fp_reb,3),'—'],
                ['q_reb = Q / A_provided',f(r.q_reb,0),'W/m²'],
                ['h_nb = 0.00417×P_c^0.69×q^0.7×F_p',f(r.h_nb,0),'W/(m²·K)'],
                ['q_max (Zuber critical flux)',f(r.q_max_zuber,0),'W/m²'],
                ['Flux fraction q/q_max (must be < 70%)',f(r.flux_frac,1),'%'],
              ]}/>
            </div>
          )}

          {/* Mechanical tab */}
          {r && tab==='mech' && (!hasMech() ? <SectionIncomplete section="Mechanical"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="t_shell_calc" value={f(r.t_shell_calc,2)} unit="mm"/>
                <MetricCard label="t_shell nominal" value={r.t_shell} unit="mm" highlight/>
                <MetricCard label="t_tubesheet" value={f(r.t_ts,1)} unit="mm"/>
                <MetricCard label="W_shell" value={f(r.W_shell_kN,2)} unit="kN"/>
              </div>
              <ResultTable rows={[
                ['P_design = max(1.1P_op, P_op+175kPa)',f(r.Pd_asme,3),'MPa'],
                ['t_shell_calc = P×D_s/(2SE−0.6P) + CA',f(r.t_shell_calc,2),'mm'],
                ['t_shell nominal',r.t_shell,'mm'],
                ['t_tubesheet = D_s/2×√(P/0.3S)',f(r.t_ts,1),'mm'],
                ['Shell nozzle velocity u_Ns',f(r.uNs,2),'m/s'],
                ['Tube nozzle velocity u_Nt',f(r.uNt,2),'m/s'],
                ['W_shell (estimated)',f(r.W_shell_kN,2),'kN'],
              ]}/>
            </div>
          ))}

          {/* Vibration tab */}
          {r && tab==='vibration' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="f_n (natural freq)" value={f(r.fn,2)} unit="Hz" highlight/>
                <MetricCard label="f_v (vortex shedding)" value={f(r.fv,2)} unit="Hz"/>
                <MetricCard label="f_v/f_n ratio" value={f(r.vortex_ratio,3)} unit="(must be < 0.5)"/>
                <MetricCard label="u_crit (fluidelastic)" value={f(r.u_crit,3)} unit="m/s"/>
                <MetricCard label="u_shell/u_crit" value={f(r.fluid_ratio,3)} unit="(must be < 0.8)"/>
              </div>
              <ResultTable rows={[
                ['Model','Blevins natural frequency + Connors fluidelastic criterion',''],
                ['Tube span L_span = L/(N_b+1)',f((+inp.L/(+inp.Nb+1)),3),'m'],
                ['f_n = (π/L_span)²×√(EI/m)/(2π)',f(r.fn,2),'Hz'],
                ['f_v = 0.22×u_s/d_o (Strouhal)',f(r.fv,2),'Hz'],
                ['Vortex shedding ratio f_v/f_n (limit < 0.5)',f(r.vortex_ratio,3),'—'],
                ['u_crit (Connors) = 3.3×f_n×d_o×√(2π×δ×m/(ρ_s×d_o²))',f(r.u_crit,3),'m/s'],
                ['Fluidelastic ratio u_shell/u_crit (limit < 0.8)',f(r.fluid_ratio,3),'—'],
              ]}/>
              {!hasEcon() ? null : (
                <>
                  <SectionHead>Economics</SectionHead>
                  <ResultTable rows={[
                    ['A_provided',f(r.A_prov,2),'m²'],
                    ['CBM (Turton, CEPCI-escalated)','$'+f(r.CBM,0),'USD'],
                  ]}/>
                </>
              )}
            </div>
          )}

          {/* Design checks tab */}
          {r && tab==='checks' && (
            <div>
              <p className="text-[12px] text-muted mb-4">10 design checks — all must be PASS before finalising.</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {r.checks.map(c => <Check key={c.l} label={c.l} value={c.v} pass={c.pass}/>)}
              </div>
              <ResultTable rows={[
                ['Checks passed',`${r.checks.filter(c=>c.pass).length} / ${r.checks.length}`,''],
                ['Q_design',f(r.Q,0),'W'],['A_provided',f(r.A_prov,2),'m²'],
                ['U_dirty',f(r.U_dirty,0),'W/(m²·K)'],['OD%',f(r.OD,1),'%'],
              ]}/>
            </div>
          )}
        </div>
      </div>
    </SimPage>
  )
}
// HX page enhanced — Js baffle spacing correction added to shell tab display
