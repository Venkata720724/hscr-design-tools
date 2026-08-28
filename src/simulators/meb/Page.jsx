import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import SimPage, { TabBar, MetricCard, ResultTable, SectionHead, Check, Field, SelectField, InputSection, ModelGuide, CalcSpinner, EmptyState, CalcButton, SectionIncomplete } from '../../components/SimPage'
import { calculate } from '../../lib/calculate'
import { saveRun } from '../../lib/history'

const TABS = [
  {id:'sample',   label:'Sample Calculation'},
  {id:'material', label:'Material Balance'},
  {id:'energy',   label:'Energy Balance'},
  {id:'combust',  label:'Combustion (Dulong)'},
  {id:'steam',    label:'Rankine Cycle'},
  {id:'checks',   label:'Design Checks'},
]

const SAMPLE = {
  m_in:1000, m_p1:600, m_p2:350, m_waste:50, m_inert:100,
  w_A:0.2, X_A:0.85, MW_A:180, MW_B:92, nu_ratio:1, dHrxn:-500,
  T_in:25, T_ref:25, T_op:120, Cp_mix:3.5, lambda_vap:2200, f_vap:0, Q_ext:0,
  wC:0.85, wH:0.14, wS:0.01, wO:0, EA:20, m_fuel:1000,
  P_boil:40, T_SH:400, P_cond:0.1, eta_turb:0.85, m_steam:10000, eta_pump:0.8,
}
const EMPTY = Object.fromEntries(Object.keys(SAMPLE).map(k=>[k,'']))

export default function MEBPage() {
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
      if (state.results) { setR(state.results); setTab('material') }
    }
  }, [])

  const hasMatBal = () => ['m_in','m_p1','m_p2','m_waste'].every(k=>inp[k]!=='')
  const hasEnergy = () => ['T_in','T_op','Cp_mix'].every(k=>inp[k]!=='')
  const hasCombust= () => ['wC','wH','wS','m_fuel','EA'].every(k=>inp[k]!=='')
  const hasSteam  = () => ['P_boil','T_SH','P_cond','eta_turb','m_steam'].every(k=>inp[k]!=='')

  const runCalc = async () => {
    setLoading(true); setErr('')
    try {
      const nums = Object.fromEntries(Object.entries(inp).map(([k,v])=>[k,v===''?0:+v]))
      const res = await calculate('meb', nums)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('material'); await saveRun('meb','Material & Energy Balance', nums, res) }
    } catch(e) { setErr('Calculation error: '+e.message) }
    finally { setLoading(false) }
  }

  const loadSample = async () => {
    setInp(SAMPLE); setLoading(true); setErr('')
    try {
      const res = await calculate('meb', SAMPLE)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('material') }
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <SimPage name="Material & Energy Balance"
      tagline="Stoichiometric material balance, sensible and reaction heat, Dulong combustion (GHV/NHV), theoretical air, Rankine steam cycle with turbine/pump work and thermal efficiency.">
      <div className="flex gap-8">
        <div className="w-[300px] flex-shrink-0 overflow-y-auto" style={{maxHeight:'85vh'}}>

          <InputSection>Material balance — streams</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug amber-note">Enter all stream mass flow rates. Total IN should equal total OUT (closure check). Reaction streams handled by stoichiometry section below.</p>
          <Field label="Feed stream ṁ_in" unit="kg/h" value={inp.m_in} onChange={v=>set('m_in',v)} min={0.01}
            hint="Total mass flow entering the system boundary. Include all feed streams."/>
          <Field label="Product stream 1 ṁ_p1" unit="kg/h" value={inp.m_p1} onChange={v=>set('m_p1',v)} min={0}
            hint="Primary product stream. Main product from reactor or separator."/>
          <Field label="Product stream 2 ṁ_p2" unit="kg/h" value={inp.m_p2} onChange={v=>set('m_p2',v)} min={0}
            hint="By-product, second product, or overhead stream."/>
          <Field label="Waste / recycle ṁ_waste" unit="kg/h" value={inp.m_waste} onChange={v=>set('m_waste',v)} min={0}
            hint="Effluent, purge, or recycle bleed stream. Enter 0 if not applicable."/>
          <Field label="Inert flow in feed ṁ_inert" unit="kg/h" value={inp.m_inert} onChange={v=>set('m_inert',v)} min={0}
            hint="Non-reactive carrier (solvent, diluent) in feed. Does not react — passes through to products. Enter 0 for pure reactant feed."/>

          <InputSection>Reaction stoichiometry</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug amber-note">A → B stoichiometry. Used to calculate moles reacted, product formed, and reaction heat duty.</p>
          <Field label="w_A (mass fraction A in feed)" value={inp.w_A} onChange={v=>set('w_A',v)} min={0} max={1} step={0.01}
            hint="Weight fraction of limiting reactant A in the feed stream. Glucose (C₆H₁₂O₆) in ethanol fermentation feed: typically 0.10–0.25."/>
          <Field label="Conversion X_A" value={inp.X_A} onChange={v=>set('X_A',v)} min={0} max={1} step={0.01}
            hint="Fractional conversion of A per pass. 0.85 = 85% of A reacted. For equilibrium reactions, check K_eq. High X may require recycle."/>
          <Field label="MW_A" unit="g/mol" value={inp.MW_A} onChange={v=>set('MW_A',v)} min={1}
            hint="Molar mass of limiting reactant A. Glucose: 180. Ethanol: 46. NaOH: 40. Acetic acid: 60. Toluene: 92 g/mol."/>
          <Field label="MW_B product" unit="g/mol" value={inp.MW_B} onChange={v=>set('MW_B',v)} min={1}
            hint="Molar mass of product B. Ethanol: 46. Na₂SO₄: 142. Toluene: 92 g/mol."/>
          <Field label="Stoichiometric ratio ν_B/ν_A" value={inp.nu_ratio} onChange={v=>set('nu_ratio',v)} min={0.01} step={0.1}
            hint="Moles of B produced per mole of A consumed. A → B: ν=1. A → 2B: ν=2. 2A → B: ν=0.5."/>
          <Field label="ΔH_rxn" unit="kJ/kg_A" value={inp.dHrxn} onChange={v=>set('dHrxn',v)} step={1}
            hint="Heat of reaction per kg of A reacted. Negative = exothermic. Ethanol fermentation: −180 kJ/kg glucose. Combustion of methane: −50,000 kJ/kg methane."/>

          <InputSection>Energy balance</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug amber-note">Q_net = Q_sensible + Q_reaction + Q_vaporisation + Q_external. Negative Q_net means heat must be removed from the system.</p>
          <Field label="Feed temperature T_in" unit="°C" value={inp.T_in} onChange={v=>set('T_in',v)}
            hint="Temperature of feed stream entering the process."/>
          <Field label="Reference temperature T_ref" unit="°C" value={inp.T_ref} onChange={v=>set('T_ref',v)}
            hint="Datum for enthalpy calculation. Typically 25°C (298.15 K) or 0°C. Must match source of ΔH_rxn."/>
          <Field label="Operating temperature T_op" unit="°C" value={inp.T_op} onChange={v=>set('T_op',v)}
            hint="Reactor / process operating temperature. Used to calculate sensible heat duty to bring feed from T_in to T_op."/>
          <Field label="Average Cp_mix" unit="kJ/(kg·K)" value={inp.Cp_mix} onChange={v=>set('Cp_mix',v)} min={0.5}
            hint="Average heat capacity of the process mixture. Water: 4.186. Organic liquids: 2.0–3.5. Process mixture: interpolate from components."/>
          <Field label="Latent heat λ_vap" unit="kJ/kg" value={inp.lambda_vap} onChange={v=>set('lambda_vap',v)} min={0}
            hint="Latent heat of vaporisation if phase change occurs. Water@120°C: 2200 kJ/kg. Ethanol@78°C: 840 kJ/kg. Enter 0 if no phase change."/>
          <Field label="Vaporised fraction f_vap" value={inp.f_vap} onChange={v=>set('f_vap',v)} min={0} max={1} step={0.05}
            hint="Fraction of feed that vaporises. 0 = liquid phase only. 1 = complete evaporation. Used for Q_vap = f_vap × m_in × λ."/>
          <Field label="External heat Q_ext" unit="kW" value={inp.Q_ext} onChange={v=>set('Q_ext',v)}
            hint="External heat input (+) or removal (−). Positive = steam/electric heater input. Negative = cooling water/refrigeration removal. 0 = adiabatic operation."/>

          <InputSection>Combustion (Dulong)</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug amber-note">Dulong formula estimates gross heating value from ultimate analysis. Applies to any solid or liquid fuel: coal, oil, biomass, waste.</p>
          <Field label="Carbon content w_C (mass fraction)" value={inp.wC} onChange={v=>set('wC',v)} min={0} max={1} step={0.01}
            hint="Weight fraction of carbon. Natural gas (methane): 0.75. Diesel: 0.87. Coal: 0.65–0.85. Biomass: 0.45–0.55."/>
          <Field label="Hydrogen content w_H" value={inp.wH} onChange={v=>set('wH',v)} min={0} max={0.25} step={0.001}
            hint="Weight fraction of hydrogen. Methane: 0.25. Diesel: 0.13. Coal: 0.04–0.06. Hydrogen: 1.0."/>
          <Field label="Sulphur content w_S" value={inp.wS} onChange={v=>set('wS',v)} min={0} max={0.05} step={0.001}
            hint="Weight fraction of sulphur. Low-S fuel: < 0.01. High-S coal: 0.02–0.04. SO₂ emissions = 2×m_fuel×w_S."/>
          <Field label="Oxygen content w_O" value={inp.wO} onChange={v=>set('wO',v)} min={0} max={0.5} step={0.01}
            hint="Weight fraction of bound oxygen in fuel (important for biomass/coal, not for pure hydrocarbons). Reduces O₂ needed from air."/>
          <Field label="Excess air EA" unit="%" value={inp.EA} onChange={v=>set('EA',v)} min={0} max={200}
            hint="Excess air above stoichiometric. Industrial burners: 10–30%. Boilers: 15–25%. Gas engines: 10–15%. More excess air → lower flame temperature but ensures complete combustion."/>
          <Field label="Fuel feed rate ṁ_fuel" unit="kg/h" value={inp.m_fuel} onChange={v=>set('m_fuel',v)} min={0.01}
            hint="Fuel mass flow rate to the burner or boiler furnace."/>

          <InputSection>Rankine steam cycle</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug amber-note">Ideal Rankine cycle with isentropic turbine and pump efficiency. Steam tables used for enthalpy values at each state point.</p>
          <Field label="Boiler pressure P_boil" unit="bar abs" value={inp.P_boil} onChange={v=>set('P_boil',v)} min={1} max={220}
            hint="High-pressure steam at turbine inlet (after boiler + superheater). Industrial ranges: 20–40 bar (utility steam), 60–100 bar (high efficiency), 100–220 bar (supercritical)."/>
          <Field label="Superheat temperature T_SH" unit="°C" value={inp.T_SH} onChange={v=>set('T_SH',v)} min={100} max={650}
            hint="Superheated steam temperature at turbine inlet. Must be > T_sat at P_boil. Higher T_SH = higher cycle efficiency. Typical: 300–450°C (industrial), up to 620°C (advanced)."/>
          <Field label="Condenser pressure P_cond" unit="bar abs" value={inp.P_cond} onChange={v=>set('P_cond',v)} min={0.01} max={1} step={0.01}
            hint="Condenser operating pressure. Sets cold reservoir temperature. Typical: 0.04–0.15 bar abs. 0.07 bar = 40°C condensing. Lower P_cond = higher efficiency but requires better vacuum."/>
          <Field label="Turbine isentropic efficiency η_turb" value={inp.eta_turb} onChange={v=>set('eta_turb',v)} min={0.5} max={0.95} step={0.01}
            hint="Turbine actual work / isentropic work. Modern steam turbines: 0.80–0.92. Small turbines: 0.70–0.80. Multi-stage: higher efficiency."/>
          <Field label="Steam mass flow ṁ_steam" unit="kg/h" value={inp.m_steam} onChange={v=>set('m_steam',v)} min={100}
            hint="Design steam rate through cycle. Size from boiler heat duty or power output requirement."/>
          <Field label="Pump isentropic efficiency η_pump" value={inp.eta_pump} onChange={v=>set('eta_pump',v)} min={0.5} max={0.95} step={0.01}
            hint="Feedwater pump efficiency. Usually 0.70–0.85. Pump work is small compared to turbine work (< 2% of cycle), so this has minor effect on cycle efficiency."/>

          {err && <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg"><p className="text-[11.5px] text-red-600 leading-snug">{err}</p></div>}
          <CalcButton onClick={runCalc} loading={loading}/>
        </div>

        <div className="flex-1 min-w-0">
          <TabBar tabs={TABS} active={tab} onChange={setTab}/>
          {tab==='sample' && (
            <div className="w-full max-w-4xl">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
                <p className="text-[14px] font-semibold text-blue-900 mb-1">Sample — Process plant MEB with natural gas combustion and steam turbine</p>
                <p className="text-[12.5px] text-blue-700 mb-4">Feed 1000 kg/h, X=0.85, T_op=120°C. Natural gas fuel (w_C=0.85, w_H=0.14). Rankine cycle at 40 bar/400°C/0.1 bar condenser.</p>
                <button onClick={loadSample} className="text-[13px] font-semibold bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">Load and run sample →</button>
              </div>
              <SectionHead>Expected results</SectionHead>
              <ResultTable rows={[
                ['Mass balance closure','< 1%','— (m_in = m_p1 + m_p2 + m_waste)'],
                ['GHV (Dulong, natural gas-like)','≈ 48,000–52,000','kJ/kg'],
                ['Theoretical air requirement','≈ 12–14','kg air/kg fuel'],
                ['Rankine η_thermal (40bar/400°C/0.1bar)','≈ 32–38','%'],
                ['Net power W_net','≈ 1,000–1,200','kW at 10,000 kg/h steam'],
                ['Steam rate (kg/kWh)','≈ 8–12','— (good cycle: < 12)'],
              ]}/>
            </div>
          )}
          {tab !== 'sample' && loading && <CalcSpinner/>}
          {tab !== 'sample' && !r && !loading && <EmptyState onSample={loadSample}/>}

          {r && tab==='material' && (!hasMatBal() ? <SectionIncomplete section="Material balance"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Total IN" value={f(r.m_total_in,1)} unit="kg/h" highlight/>
                <MetricCard label="Total OUT" value={f(r.m_total_out,1)} unit="kg/h" highlight/>
                <MetricCard label="Balance closure" value={f(r.closure,3)} unit="%" />
                <MetricCard label="A reacted" value={f(r.A_reacted,1)} unit="kg/h"/>
                <MetricCard label="B generated" value={f(r.B_generated,1)} unit="kg/h"/>
                <MetricCard label="Product B in stream 1" value={f(r.B_in_P1,1)} unit="kg/h"/>
              </div>
              <SectionHead>Mass balance table</SectionHead>
              <table className="w-full text-[12px] border-collapse mb-4">
                <thead>
                  <tr className="bg-soft border-b border-line">
                    {['Stream','Flow (kg/h)','Notes'].map(h=>(
                      <th key={h} className="text-left py-2 px-2 text-[10.5px] font-bold text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.streamTable?.map((row,i)=>(
                    <tr key={i} className={`border-b border-line ${row.type==='total'?'bg-soft font-semibold':''}`}>
                      <td className="py-2 px-2 font-medium text-ink">{row.name}</td>
                      <td className="py-2 px-2">{f(row.flow,1)}</td>
                      <td className="py-2 px-2 text-muted">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ResultTable rows={[
                ['A in feed = w_A × m_in',f(r.A_in_feed,1),'kg/h'],
                ['A reacted = X_A × A_in_feed',f(r.A_reacted,1),'kg/h'],
                ['B generated = A_reacted × (MW_B/MW_A) × ν',f(r.B_generated,1),'kg/h'],
                ['Balance closure |m_in − m_out|/m_in',f(r.closure,3),'% (must be < 1%)'],
              ]}/>
            </div>
          ))}

          {r && tab==='energy' && (!hasEnergy() ? <SectionIncomplete section="Energy balance"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Q_sensible" value={f(r.Q_sens,1)} unit="kW"/>
                <MetricCard label="Q_reaction" value={f(r.Q_rxn,1)} unit="kW"/>
                <MetricCard label="Q_vaporisation" value={f(r.Q_vap,1)} unit="kW"/>
                <MetricCard label="Q_net" value={f(r.Q_net,1)} unit="kW" highlight/>
              </div>
              <ResultTable rows={[
                ['Q_sensible = ṁ_in × Cp × (T_op − T_in)',f(r.Q_sens,1),'kW'],
                ['Q_reaction = (A_reacted/3600) × |ΔH_rxn| × 1000',f(r.Q_rxn,1),'kW (negative = exothermic, heat released)'],
                ['Q_vaporisation = f_vap × ṁ_in × λ / 3600',f(r.Q_vap,1),'kW'],
                ['Q_external = user input',f(r.Q_ext,1),'kW (+= add heat, −= remove heat)'],
                ['Q_net = Q_sens + Q_rxn + Q_vap + Q_ext',f(r.Q_net,1),'kW (+ = heat needed; − = heat to remove)'],
                ['Q_net interpretation',r.Q_net_interp,''],
              ]}/>
            </div>
          ))}

          {r && tab==='combust' && (!hasCombust() ? <SectionIncomplete section="Combustion"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="GHV (Dulong)" value={f(r.GHV,0)} unit="kJ/kg" highlight/>
                <MetricCard label="NHV (net)" value={f(r.NHV,0)} unit="kJ/kg"/>
                <MetricCard label="Theor. O₂ req." value={f(r.O2_stoic,3)} unit="kg/kg fuel"/>
                <MetricCard label="Theor. air req." value={f(r.air_stoic,2)} unit="kg/kg fuel"/>
                <MetricCard label="Actual air (w/ EA)" value={f(r.air_actual,2)} unit="kg/kg fuel"/>
                <MetricCard label="Q_combustion" value={f(r.Q_comb,0)} unit="kW" highlight/>
                <MetricCard label="Flue gas mass" value={f(r.m_flue,1)} unit="kg/h"/>
                <MetricCard label="Flame efficiency" value={f(r.comb_eff,1)} unit="%"/>
              </div>
              <ResultTable rows={[
                ['Dulong GHV = 33,835×w_C + 144,330×(w_H−w_O/8) + 9,418×w_S',f(r.GHV,0),'kJ/kg'],
                ['NHV = GHV − 2442×9×w_H',f(r.NHV,0),'kJ/kg (used when water in flue gas not condensed)'],
                ['Stoichiometric O₂ = 2.667×w_C + 8×(w_H−w_O/8) + w_S',f(r.O2_stoic,3),'kg/kg fuel'],
                ['Theoretical air = O₂_stoic / 0.232',f(r.air_stoic,2),'kg/kg fuel'],
                ['Actual air = air_stoic × (1 + EA/100)',f(r.air_actual,2),'kg/kg fuel'],
                ['Total air flow = m_fuel × air_actual',f(r.m_air,0),'kg/h'],
                ['Flue gas mass = m_fuel + air',f(r.m_flue,1),'kg/h'],
                ['Q_combustion = m_fuel × NHV / 3600',f(r.Q_comb,0),'kW'],
                ['CO₂ from combustion = 3.667×w_C×m_fuel',f(r.m_CO2,0),'kg/h'],
                ['SO₂ from combustion = 2×w_S×m_fuel',f(r.m_SO2,0),'kg/h'],
              ]}/>
            </div>
          ))}

          {r && tab==='steam' && (!hasSteam() ? <SectionIncomplete section="Rankine cycle"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="h1 turbine inlet" value={f(r.h1,0)} unit="kJ/kg"/>
                <MetricCard label="h2 turbine exit" value={f(r.h2,0)} unit="kJ/kg"/>
                <MetricCard label="W_turbine" value={f(r.W_turb,0)} unit="kW" highlight/>
                <MetricCard label="W_pump" value={f(r.W_pump,0)} unit="kW"/>
                <MetricCard label="W_net" value={f(r.W_net,0)} unit="kW" highlight/>
                <MetricCard label="Q_boiler" value={f(r.Q_boiler,0)} unit="kW"/>
                <MetricCard label="η_thermal" value={f(r.eta_th*100,2)} unit="%"/>
                <MetricCard label="Steam rate" value={f(r.steam_rate,2)} unit="kg/kWh"/>
              </div>
              <SectionHead>Rankine cycle state points</SectionHead>
              <table className="w-full text-[12px] border-collapse mb-4">
                <thead>
                  <tr className="bg-soft border-b border-line">
                    {['State','Description','T (°C)','P (bar)','h (kJ/kg)','s (kJ/kg·K)'].map(h=>(
                      <th key={h} className="text-left py-2 px-2 text-[10.5px] font-bold text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.statePoints?.map((pt,i)=>(
                    <tr key={i} className="border-b border-line">
                      <td className="py-2 px-2 font-medium text-ink">{pt.state}</td>
                      <td className="py-2 px-2 text-muted">{pt.desc}</td>
                      <td className="py-2 px-2">{f(pt.T,1)}</td>
                      <td className="py-2 px-2">{f(pt.P,2)}</td>
                      <td className="py-2 px-2 font-semibold">{f(pt.h,1)}</td>
                      <td className="py-2 px-2">{f(pt.s,4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ResultTable rows={[
                ['W_turbine = ṁ×(h1−h2)/3600',f(r.W_turb,0),'kW'],
                ['W_pump = ṁ×(h4−h3)/3600',f(r.W_pump,0),'kW'],
                ['W_net = W_turbine − W_pump',f(r.W_net,0),'kW'],
                ['Q_boiler = ṁ×(h1−h4)/3600',f(r.Q_boiler,0),'kW'],
                ['Q_condenser = ṁ×(h2−h3)/3600',f(r.Q_cond,0),'kW'],
                ['η_thermal = W_net/Q_boiler',f(r.eta_th*100,2),'%'],
                ['Steam rate = ṁ_steam/W_net (kg/kWh)',f(r.steam_rate,2),'kg/kWh (good < 12 kg/kWh)'],
                ['Back-pressure ratio (condenser/boiler)',f(r.P_ratio,4),'—'],
              ]}/>
            </div>
          ))}

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
