import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import SimPage, { TabBar, MetricCard, ResultTable, SectionHead, Check, Field, SelectField, InputSection, ModelGuide, CalcSpinner, EmptyState, CalcButton, SectionIncomplete } from '../../components/SimPage'
import { calculate } from '../../lib/calculate'
import { saveRun } from '../../lib/history'

const TABS = [
  {id:'sample', label:'Sample Calculation'},
  {id:'select', label:'Impeller Selection'},
  {id:'power',  label:'Power (Np curve)'},
  {id:'blend',  label:'Blending'},
  {id:'heat',   label:'Heat Transfer'},
  {id:'static', label:'Static Mixer'},
  {id:'scaleup',label:'Scale-Up'},
  {id:'econ',   label:'Economics'},
  {id:'checks', label:'Design Checks'},
]

const SAMPLE = {
  T_tank:2, H_L:2, D_imp:0.667, n_imp:1, C_imp:0.667,
  n_baffles:4, W_b:0.2, impType:'rushton',
  rho:1000, mu:0.001, mu_w:0.0008, k_f:0.6, Cp_f:4186,
  N_rpm:120, T_op:60, T_j:20, Q_req:50000,
  h_o:3000, k_wall:45, t_wall:0.008,
  d_sm:0.1, Q_sm:0.01, n_el:12, el_LD:1.5,
  scaleup_ratio:5,
  CEPCI:820, elec_cost:0.1, opHours:8000,
}
const EMPTY = Object.fromEntries(Object.keys(SAMPLE).map(k=>[k,'']))

const IMP_TYPES = [
  {value:'rushton',   label:'Rushton disc turbine (RT) — gas dispersion, liquid-liquid'},
  {value:'pbt_down',  label:'Pitched blade turbine down-pumping (PBT-D) — solids, blending'},
  {value:'pbt_up',    label:'Pitched blade turbine up-pumping (PBT-U) — mild blending'},
  {value:'anchor',    label:'Anchor / gate — viscous fluids (Re < 100)'},
  {value:'helical',   label:'Helical ribbon — highly viscous, polymers'},
  {value:'hydrofoil', label:'Hydrofoil (A310/HE3) — low shear, blending, fermentation'},
]

export default function MixerPage() {
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
      if (state.results) { setR(state.results); setTab('power') }
    }
  }, [])

  const hasCore = () => ['T_tank','H_L','D_imp','rho','mu','N_rpm'].every(k=>inp[k]!=='')

  const runCalc = async () => {
    if (!hasCore()) { setErr('Fill required geometry and fluid fields (*)'); return }
    setLoading(true); setErr('')
    try {
      const nums = Object.fromEntries(Object.entries(inp).map(([k,v])=>[k,typeof v==='string'&&v!==''&&!isNaN(+v)?+v:v]))
      const res = await calculate('mixer', nums)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('power'); await saveRun('mixer','Mixer & Agitator', nums, res) }
    } catch(e) { setErr('Calculation error: '+e.message) }
    finally { setLoading(false) }
  }

  const loadSample = async () => {
    setInp(SAMPLE); setLoading(true); setErr('')
    try {
      const res = await calculate('mixer', SAMPLE)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('power') }
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <SimPage name="Mixer & Agitator"
      tagline="Power number curve, Grenville blend time, Bondy-Lippa jacket heat transfer, Kenics static mixer, Zwietering suspension, scale-up rules, Turton economics.">
      <div className="flex gap-8">
        <div className="w-[300px] flex-shrink-0 overflow-y-auto" style={{maxHeight:'85vh'}}>
          <InputSection>Vessel geometry</InputSection>
          <Field label="Tank diameter T" unit="m" value={inp.T_tank} onChange={v=>set('T_tank',v)} min={0.1}
            hint="Internal diameter of the mixing vessel. Standard tanks: 0.5–5m. For scale-up, T is the primary size parameter."/>
          <Field label="Liquid height H_L" unit="m" value={inp.H_L} onChange={v=>set('H_L',v)} min={0.1}
            hint="Operating liquid level. For standard vessels: H_L/T = 1.0. For tall vessels (H/T > 1.2), use multiple impellers."/>
          <Field label="Impeller diameter D_imp" unit="m" value={inp.D_imp} onChange={v=>set('D_imp',v)} min={0.05}
            hint="D_imp/T ratio determines flow pattern. Turbines (RT, PBT): D/T = 0.25–0.45. Anchors: D/T = 0.90–0.98. Larger D/T = more flow, less shear."/>
          <Field label="Number of impellers" value={inp.n_imp} onChange={v=>set('n_imp',v)} min={1} max={5}
            hint="1 = standard. Use 2 for H_L/T > 1.2. Use 3 for H_L/T > 2.0. Additional impellers improve blending in tall vessels."/>
          <Field label="Impeller clearance C" unit="m" value={inp.C_imp} onChange={v=>set('C_imp',v)} min={0.05}
            hint="Distance from bottom of tank to bottom impeller. Standard: C = D_imp. For solids suspension: C = D_imp/3."/>
          <Field label="Number of baffles" value={inp.n_baffles} onChange={v=>set('n_baffles',v)} min={0} max={8}
            hint="Standard: 4 baffles for turbulent flow. 0 baffles for laminar/viscous service (Re < 10). Baffles prevent vortex formation and improve mixing."/>
          <Field label="Baffle width W_b" unit="m" value={inp.W_b} onChange={v=>set('W_b',v)} min={0.01}
            hint="Standard: W_b/T = 0.08–0.10. For T=2m: W_b = 0.20m. Wider baffles = better mixing but more power consumption."/>

          <InputSection>Impeller type</InputSection>
          <ModelGuide title="Impeller selection" criteria={[
            {model:'Rushton (RT)',when:'Gas dispersion (highest P/V and bubble breakup). Liquid-liquid emulsification. High-shear cell culture. Re > 1000 required.'},
            {model:'PBT down-pumping',when:'Solids suspension (N_js by Zwietering). Blending with moderate shear. Most common general-purpose impeller.'},
            {model:'Hydrofoil (A310)',when:'Low-shear blending. Fermentation (cell damage sensitive). Low P/V with good flow. Re > 500.'},
            {model:'Anchor / gate',when:'Highly viscous fluids (Re = 1–100, μ > 1 Pa·s). Pastes, polymers, crystallisers. Scrapes vessel wall for heat transfer.'},
            {model:'Helical ribbon',when:'Extremely viscous (Re < 10, μ > 10 Pa·s). Polymers, resins, pastes. Very high torque.'},
          ]}/>
          <SelectField label="Impeller type" value={inp.impType||'rushton'} onChange={v=>set('impType',v)} options={IMP_TYPES}/>

          <InputSection>Fluid properties</InputSection>
          <Field label="Density ρ" unit="kg/m³" value={inp.rho} onChange={v=>set('rho',v)} min={1}
            hint="Process fluid density. Water: 1000 kg/m³. Organic solvents: 700–900 kg/m³. Aqueous solutions: 1000–1300 kg/m³."/>
          <Field label="Viscosity μ" unit="Pa·s" value={inp.mu} onChange={v=>set('mu',v)} min={1e-6} step={0.0001}
            hint="Dynamic viscosity at operating temperature. Water@20°C: 0.001. Water@60°C: 0.00047. Glycerol@20°C: 1.0. Used to calculate Re and select impeller type."/>
          <Field label="Wall viscosity μ_w" unit="Pa·s" value={inp.mu_w} onChange={v=>set('mu_w',v)} min={1e-6} step={0.0001}
            hint="Viscosity at vessel wall temperature — for (μ/μ_w)^0.14 heat transfer correction. Usually slightly different from bulk μ."/>
          <Field label="Thermal conductivity k_f" unit="W/(m·K)" value={inp.k_f} onChange={v=>set('k_f',v)} min={0.01}
            hint="Fluid thermal conductivity. Water: 0.60. Organic solvents: 0.12–0.18. Oils: 0.13–0.17 W/(m·K)."/>
          <Field label="Heat capacity Cp_f" unit="J/(kg·K)" value={inp.Cp_f} onChange={v=>set('Cp_f',v)} min={100}
            hint="Fluid heat capacity. Water: 4186. Organic liquids: 1800–2500. Oils: 1800–2200 J/(kg·K)."/>

          <InputSection>Operating conditions</InputSection>
          <Field label="Agitator speed N" unit="rpm" value={inp.N_rpm} onChange={v=>set('N_rpm',v)} min={1}
            hint="Impeller rotational speed. Slow (anchors): 10–60 rpm. Moderate (PBT): 60–200 rpm. Fast (RT, small): 200–600 rpm. Tip speed = π×D_imp×N/60."/>
          <Field label="Operating temperature T_op" unit="°C" value={inp.T_op} onChange={v=>set('T_op',v)}
            hint="Process fluid temperature during operation."/>
          <Field label="Jacket temperature T_j" unit="°C" value={inp.T_j} onChange={v=>set('T_j',v)}
            hint="Jacket inlet coolant temperature. Cooling water: 20–30°C. Chilled water: 5–15°C. Steam: 100–160°C."/>
          <Field label="Required heat duty Q_req" unit="W" value={inp.Q_req} onChange={v=>set('Q_req',v)} min={0}
            hint="Heating or cooling load that the jacket must handle. Include heat of reaction if applicable."/>
          <Field label="Jacket side h_o" unit="W/(m²·K)" value={inp.h_o} onChange={v=>set('h_o',v)} min={100}
            hint="Jacket-side heat transfer coefficient. Condensing steam: 8000–15000. Cooling water in dimple jacket: 1000–3000. Hot oil: 500–1500 W/(m²·K)."/>
          <Field label="k_wall vessel wall" unit="W/(m·K)" value={inp.k_wall} onChange={v=>set('k_wall',v)} min={1}
            hint="Carbon steel: 45. SS 304/316: 16. Enamel-lined: 1.0. Glass-lined: 1.0–1.5."/>
          <Field label="Wall thickness t_wall" unit="m" value={inp.t_wall} onChange={v=>set('t_wall',v)} min={0.002} step={0.001}
            hint="Vessel wall thickness. From pressure vessel design or standard shell: 8–25mm."/>

          <InputSection>Static mixer (optional)</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug">Fill only if a static mixer (Kenics-type) is in the system.</p>
          <Field label="Pipe diameter d_sm" unit="m" value={inp.d_sm} onChange={v=>set('d_sm',v)} min={0.01} required={false}
            hint="Internal pipe diameter for static mixer. Standard sizes: 25mm, 50mm, 100mm, 150mm."/>
          <Field label="Volumetric flow Q_sm" unit="m³/s" value={inp.Q_sm} onChange={v=>set('Q_sm',v)} min={0} required={false}
            hint="Flow rate through static mixer. Used to calculate velocity and ΔP per element."/>
          <Field label="Number of elements n_el" value={inp.n_el} onChange={v=>set('n_el',v)} min={1} required={false}
            hint="Kenics HEV: 6–12 elements typical. Sulzer SMX: 3–8 per diameter. More elements = better mixing but higher ΔP."/>
          <Field label="Element L/D ratio" value={inp.el_LD} onChange={v=>set('el_LD',v)} min={0.5} step={0.1} required={false}
            hint="Kenics = 1.5. Sulzer SMX = 0.9. Koch = 1.0. Used to calculate total mixer length = n_el × (L/D) × d."/>

          <InputSection>Scale-up</InputSection>
          <Field label="Scale-up volume ratio" value={inp.scaleup_ratio} onChange={v=>set('scaleup_ratio',v)} min={1} step={0.5}
            hint="V_new/V_original. Target scale-up factor. The scale-up rule determines new impeller speed: N_new = N_old × (D_old/D_new)^(scale_rule exponent)."/>

          <InputSection>Economics (optional)</InputSection>
          <Field label="CEPCI current" value={inp.CEPCI} onChange={v=>set('CEPCI',v)} required={false} hint="2024 ≈ 820."/>
          <Field label="Electricity cost" unit="$/kWh" value={inp.elec_cost} onChange={v=>set('elec_cost',v)} required={false}
            hint="Industrial electricity rate. India: ₹6–10/kWh ≈ $0.07–0.12/kWh."/>
          <Field label="Operating hours" unit="h/yr" value={inp.opHours} onChange={v=>set('opHours',v)} required={false}/>

          {err && <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg"><p className="text-[11.5px] text-red-600 leading-snug">{err}</p></div>}
          <CalcButton onClick={runCalc} loading={loading}/>
        </div>

        <div className="flex-1 min-w-0">
          <TabBar tabs={TABS} active={tab} onChange={setTab}/>
          {tab==='sample' && (
            <div className="w-full max-w-4xl">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
                <p className="text-[14px] font-semibold text-blue-900 mb-1">Sample — Rushton turbine, 1000L water vessel, 120 rpm</p>
                <p className="text-[12.5px] text-blue-700 mb-4">T = 2m, H = 2m, D_imp = 0.667m, ρ = 1000 kg/m³, μ = 0.001 Pa·s. Jacket cooling duty 50 kW.</p>
                <button onClick={loadSample} className="text-[13px] font-semibold bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">Load and run sample →</button>
              </div>
              <SectionHead>Expected results</SectionHead>
              <ResultTable rows={[
                ['Reynolds Re','≈ 890,000','— (turbulent)'],
                ['Power P (Rushton turbulent Np=5)','≈ 5,000–6,000','W'],
                ['P/V','≈ 800–1200','W/m³'],
                ['Blend time θ_blend (Grenville)','≈ 35–50','s'],
                ['h_i jacket (Bondy-Lippa)','≈ 3,000–5,000','W/(m²·K)'],
              ]}/>
            </div>
          )}
          {tab !== 'sample' && loading && <CalcSpinner/>}
          {tab !== 'sample' && !r && !loading && <EmptyState onSample={loadSample}/>}

          {r && tab==='select' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Re_impeller" value={f(r.Re,0)} unit="—" highlight/>
                <MetricCard label="Flow regime" value={r.regime} unit=""/>
                <MetricCard label="D_imp/T" value={f(r.DT_ratio,3)} unit="—"/>
                <MetricCard label="Tip speed u_tip" value={f(r.u_tip,2)} unit="m/s"/>
              </div>
              <ResultTable rows={[
                ['Re = ρ×N×D²/μ',f(r.Re,0),'—'],
                ['Flow regime',r.regime,'(turbulent >10000, transition 10-10000, laminar <10)'],
                ['D_imp/T ratio',f(r.DT_ratio,3),'— (standard range 0.25–0.45 for turbines)'],
                ['N in rps',f(r.N_rps,3),'s⁻¹'],
                ['Tip speed u_tip = π×D_imp×N',f(r.u_tip,2),'m/s (< 10 m/s for standard; > 10 = high shear)'],
                ['Liquid volume V_L',f(r.V_L,3),'m³'],
              ]}/>
            </div>
          )}

          {r && tab==='power' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Power number Np" value={f(r.Np,3)} unit="—"/>
                <MetricCard label="Shaft power P" value={f(r.P_shaft,0)} unit="W" highlight/>
                <MetricCard label="P/V" value={f(r.PV,1)} unit="W/m³"/>
                <MetricCard label="Motor size (IEC)" value={f(r.P_motor,0)} unit="W"/>
              </div>
              <ResultTable rows={[
                ['Power number Np (from Re and impeller type)',f(r.Np,3),'—'],
                ['P = Np × ρ × N³ × D_imp⁵',f(r.P_shaft,0),'W'],
                ['P/V = P/V_L',f(r.PV,1),'W/m³ (turbulent mixing: 0.5–5 kW/m³; blending: 0.1–0.5)'],
                ['Motor size (next IEC standard)',f(r.P_motor,0),'W'],
                ['Torque M = P/(2π×N_rps)',f(r.torque,1),'N·m'],
                ['Shaft diameter (torsion check)',f(r.d_shaft,3),'m'],
              ]}/>
            </div>
          )}

          {r && tab==='blend' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="θ_blend (95%)" value={f(r.theta_blend,1)} unit="s" highlight/>
                <MetricCard label="θ_circulation" value={f(r.theta_circ,1)} unit="s"/>
                <MetricCard label="Q_pumping" value={f(r.Q_pump,4)} unit="m³/s"/>
                <MetricCard label="N_js (Zwietering)" value={f(r.N_js,2)} unit="rps"/>
              </div>
              <ResultTable rows={[
                ['Grenville blend time model (turbulent)','',''],
                ['θ_blend (95% homogeneity) = f(Re, D/T, H/T)',f(r.theta_blend,1),'s'],
                ['Circulation time θ_circ = V_L/Q_pump',f(r.theta_circ,1),'s'],
                ['Pumping flow Q_pump = Nq×N×D³',f(r.Q_pump,4),'m³/s'],
                ['Pumping number Nq',f(r.Nq,3),'—'],
                ['Zwietering N_js (solids just suspended)',f(r.N_js,2),'rps'],
                ['Froude number Fr',f(r.Fr,4),'—'],
              ]}/>
            </div>
          )}

          {r && tab==='heat' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Nu_agitated" value={f(r.Nu,1)} unit="—"/>
                <MetricCard label="h_i (process side)" value={f(r.h_i,0)} unit="W/(m²·K)" highlight/>
                <MetricCard label="U_overall" value={f(r.U_jkt,0)} unit="W/(m²·K)"/>
                <MetricCard label="Q_jacket max" value={f(r.Q_jkt_max,0)} unit="W"/>
                <MetricCard label="Extra coil area" value={f(r.A_coil_extra,2)} unit="m²"/>
              </div>
              <ResultTable rows={[
                ['Bondy-Lippa: Nu = 0.74×Re^0.67×Pr^0.33×(D/T)^0.14×(μ/μw)^0.14','',''],
                ['Nu_agitated',f(r.Nu,1),'—'],
                ['h_i = Nu×k_f/T_tank',f(r.h_i,0),'W/(m²·K)'],
                ['1/U = 1/h_i + t/k_wall + 1/h_o',f(r.U_jkt,0),'W/(m²·K)'],
                ['Jacket area A_jkt = π×T×H_L',f(r.A_jkt,2),'m²'],
                ['Q_jacket_max = U×A×(T_op−T_j)',f(r.Q_jkt_max,0),'W'],
                ['Q_required',inp.Q_req,'W'],
                ['Extra coil area needed',f(r.A_coil_extra,2),'m² (0 = jacket sufficient)'],
              ]}/>
            </div>
          )}

          {r && tab==='static' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Velocity in SM" value={f(r.u_sm,3)} unit="m/s"/>
                <MetricCard label="Re_SM" value={f(r.Re_sm,0)} unit="—"/>
                <MetricCard label="ΔP per element" value={f(r.dP_el,1)} unit="Pa"/>
                <MetricCard label="ΔP total" value={f(r.dP_sm_total,1)} unit="kPa" highlight/>
              </div>
              <ResultTable rows={[
                ['Kenics static mixer — ΔP model','',''],
                ['Velocity u_sm = Q/(π/4×d²)',f(r.u_sm,3),'m/s'],
                ['Re_SM = ρ×u×d/μ',f(r.Re_sm,0),'—'],
                ['ΔP per Kenics element = K_SM × f × (L_el/d) × ρ×u²/2',f(r.dP_el,1),'Pa'],
                ['Total mixer length = n_el × (L/D) × d',f(r.L_sm,3),'m'],
                ['Total ΔP',f(r.dP_sm_total,1),'kPa'],
                ['CoV improvement per element (approx)',f(r.CoV_factor,3),'— (CoV/element)'],
              ]}/>
            </div>
          )}

          {r && tab==='scaleup' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Scale-up ratio (V)" value={f(r.scaleup_V,1)} unit="×"/>
                <MetricCard label="New T_tank" value={f(r.T_new,3)} unit="m"/>
                <MetricCard label="New D_imp" value={f(r.D_new,3)} unit="m"/>
                <MetricCard label="New N (const P/V)" value={f(r.N_new_PV,2)} unit="rps"/>
              </div>
              <ResultTable rows={[
                ['Scale-up rules for agitated vessels','',''],
                ['New tank diameter T_new = T×(V_ratio)^(1/3)',f(r.T_new,3),'m'],
                ['New impeller D_new = D_imp×(V_ratio)^(1/3)',f(r.D_new,3),'m'],
                ['Geometric similarity: same D/T, H/T, C/T','—',''],
                ['Constant P/V: N_new = N×(T/T_new)^(2/3)',f(r.N_new_PV,3),'rps'],
                ['Constant tip speed: N_new = N×(D/D_new)',f(r.N_new_tip,3),'rps'],
                ['Constant blend time: N_new = N×(T/T_new)^0.5',f(r.N_new_blend,3),'rps'],
                ['New power at constant P/V',f(r.P_new_PV,0),'W'],
              ]}/>
            </div>
          )}

          {r && tab==='econ' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="CBM installed" value={`$${f(r.CBM,0)}`} unit="USD" highlight/>
                <MetricCard label="Annual energy" value={`$${f(r.annual_energy,0)}`} unit="/yr"/>
              </div>
              <ResultTable rows={[
                ['Power consumption P_shaft',f(r.P_shaft,0),'W'],
                ['Motor efficiency (assumed 92%)','0.92','—'],
                ['Annual energy cost',`$${f(r.annual_energy,0)}`,'/yr'],
                ['CBM (Turton)','$'+f(r.CBM,0),'USD'],
              ]}/>
            </div>
          )}

          {r && tab==='checks' && (
            <div>
              <p className="text-[12px] text-muted mb-4">10 design checks — all must be PASS.</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {r.checks?.map(c=><Check key={c.l} label={c.l} value={c.v} pass={c.pass}/>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </SimPage>
  )
}
