import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import SimPage, { TabBar, MetricCard, ResultTable, SectionHead, Check, Field, SelectField, InputSection } from '../../components/SimPage'
import { calculate, DEFAULTS } from './engine'

const TABS = [
  {id:'selection', label:'Selection & Levenspiel'},
  {id:'kinetics',  label:'Kinetics'},
  {id:'batch',     label:'Batch'},
  {id:'cstr',      label:'CSTR'},
  {id:'pfr',       label:'PFR'},
  {id:'fixedbed',  label:'Fixed Bed (Ergun)'},
  {id:'heat',      label:'Heat Transfer'},
  {id:'econ',      label:'Economics'},
  {id:'checks',    label:'Design Checks'},
]

export default function ReactorPage() {
  const [inp, setInp] = useState(DEFAULTS)
  const [tab, setTab] = useState('selection')
  const set = (k,v) => setInp(p=>({...p,[k]:v}))
  const r = useMemo(()=>calculate(inp),[inp])
  const f = (v,d=3) => v==null?'—':typeof v==='number'?v.toFixed(d):v

  if(!r) return <div className="p-8 text-muted">Invalid inputs</div>

  return (
    <SimPage name="Reactor Design"
      tagline="Reaction kinetics, batch, CSTR, PFR, fixed bed (Ergun+Thiele+Mears), heat transfer stability, Turton economics."
      models={['Arrhenius kinetics','Damköhler analysis','Fenske Levenspiel','CSTR V=FA0X/(−rA)','PFR integration','Ergun ΔP','Thiele modulus','Aris effectiveness','Mears criterion','Semenov stability','Turton cost']}>
      <div className="flex gap-6">
        {/* INPUTS */}
        <div className="w-52 flex-shrink-0 text-[12px]">
          <InputSection>Kinetics</InputSection>
          <Field label="A (pre-exponential)" unit="s⁻¹" value={inp.A_freq} onChange={v=>set('A_freq',v)} min={1} step={1000}/>
          <Field label="E_a" unit="J/mol" value={inp.Ea} onChange={v=>set('Ea',v)} min={1000}/>
          <Field label="ΔH_rxn" unit="J/mol" value={inp.dHrx} onChange={v=>set('dHrx',v)} hint="Negative = exothermic"/>
          <Field label="Reaction order n" value={inp.n_order} onChange={v=>set('n_order',v)} min={0} max={3} step={0.5}/>
          <InputSection>Feed &amp; Conversion</InputSection>
          <Field label="F_A0" unit="mol/s" value={inp.FA0} onChange={v=>set('FA0',v)} min={0.001} step={0.01}/>
          <Field label="C_A0" unit="mol/m³" value={inp.CA0} onChange={v=>set('CA0',v)} min={1}/>
          <Field label="v_0" unit="m³/s" value={inp.v0} onChange={v=>set('v0',v)} min={1e-6} step={1e-5}/>
          <Field label="T_feed T_0" unit="°C" value={inp.T0} onChange={v=>set('T0',v)}/>
          <Field label="X target" value={inp.X} onChange={v=>set('X',v)} min={0.01} max={0.99} step={0.01}/>
          <InputSection>Operating Conditions</InputSection>
          <Field label="T_op" unit="°C" value={inp.T_op} onChange={v=>set('T_op',v)}/>
          <Field label="P_op" unit="kPa" value={inp.P_op} onChange={v=>set('P_op',v)} min={10}/>
          <Field label="T_coolant T_c" unit="°C" value={inp.T_c} onChange={v=>set('T_c',v)}/>
          <InputSection>Heat Transfer</InputSection>
          <Field label="U overall" unit="W/(m²·K)" value={inp.U_HT} onChange={v=>set('U_HT',v)} min={10}/>
          <Field label="A_HT available" unit="m²" value={inp.A_HT} onChange={v=>set('A_HT',v)} step={0.5}/>
          <InputSection>Physical Properties</InputSection>
          <Field label="ρ" unit="kg/m³" value={inp.rho} onChange={v=>set('rho',v)} min={1}/>
          <Field label="Cp" unit="J/(kg·K)" value={inp.Cp} onChange={v=>set('Cp',v)} min={100}/>
          <Field label="μ" unit="Pa·s" value={inp.mu} onChange={v=>set('mu',v)} step={0.0001}/>
          <Field label="D_AB" unit="m²/s" value={inp.D_AB} onChange={v=>set('D_AB',v)} step={1e-10}/>
          <InputSection>Reactor Geometry</InputSection>
          <Field label="L_rx" unit="m" value={inp.L_rx} onChange={v=>set('L_rx',v)} min={0.1}/>
          <Field label="D_rx" unit="m" value={inp.D_rx} onChange={v=>set('D_rx',v)} min={0.05} step={0.05}/>
          <InputSection>Catalyst (Fixed Bed)</InputSection>
          <Field label="d_p" unit="m" value={inp.dp} onChange={v=>set('dp',v)} min={0.0001} step={0.0005}/>
          <Field label="ε_b (bed void)" value={inp.eps_b} onChange={v=>set('eps_b',v)} min={0.2} max={0.7} step={0.05}/>
          <Field label="ρ_cat" unit="kg/m³" value={inp.rho_cat} onChange={v=>set('rho_cat',v)} min={100}/>
          <InputSection>Economics</InputSection>
          <Field label="CEPCI ratio" value={inp.CEPCI} onChange={v=>set('CEPCI',v)} step={0.01}/>
          <Field label="FBM" value={inp.FBM} onChange={v=>set('FBM',v)} step={0.1}/>
          <Field label="Steam cost" unit="$/kg" value={inp.steamCost} onChange={v=>set('steamCost',v)} step={0.005}/>
          <Field label="Op hours" unit="h/yr" value={inp.opHours} onChange={v=>set('opHours',v)}/>
          <Field label="c_A feed cost" unit="$/mol" value={inp.cA_cost} onChange={v=>set('cA_cost',v)} step={0.1}/>
        </div>

        {/* RESULTS */}
        <div className="flex-1 min-w-0">
          <TabBar tabs={TABS} active={tab} onChange={setTab}/>

          {tab==='selection' && (
            <div>
              <p className="text-[12px] text-muted mb-4">Levenspiel plot (1/−r_A vs X) and reactor type comparison from 2_SELECTION.</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="V_CSTR" value={f(r.V_cstr,4)} unit="m³"/>
                <MetricCard label="V_PFR" value={f(r.V_pfr,4)} unit="m³"/>
                <MetricCard label="V_CSTR/V_PFR" value={f(r.V_ratio,2)} unit="—"/>
                <MetricCard label="k at T_op" value={r.k?.toExponential(3)} unit="s⁻¹"/>
              </div>
              {/* Levenspiel plot */}
              <div className="border border-line rounded-xl p-4 mb-4">
                <p className="text-[12px] font-semibold text-ink mb-3">Levenspiel plot — 1/(−r_A) vs X</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={r.levenspiel} margin={{top:5,right:10,bottom:20,left:10}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="X" label={{value:'Conversion X',position:'insideBottom',offset:-10,style:{fontSize:11,fill:'#888'}}} tick={{fontSize:10}}/>
                    <YAxis label={{value:'1/(−r_A)  (m³·s/mol)',angle:-90,position:'insideLeft',style:{fontSize:11,fill:'#888'}}} tick={{fontSize:10}}/>
                    <Tooltip contentStyle={{fontSize:11,border:'1px solid #f0f0f0',borderRadius:8}}/>
                    <Line dataKey="1/(-rA)" name="1/(−r_A)" stroke="#2563eb" strokeWidth={2} dot={{r:3}}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <SectionHead>2_SELECTION — reactor comparison</SectionHead>
              <table className="w-full text-[11.5px] border-collapse mb-4">
                <thead>
                  <tr className="border-b-2 border-line">
                    {['Type','Mode','Conversion','Exotherm','Volume'].map(h=><th key={h} className="text-left py-2 px-2 text-muted font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {r.selTable.map(row=>(
                    <tr key={row.type} className="border-b border-line">
                      <td className="py-2 px-2 font-medium">{row.type}</td>
                      <td className="py-2 px-2 text-muted">{row.mode}</td>
                      <td className="py-2 px-2">{row.X}</td>
                      <td className="py-2 px-2">{row.exo}</td>
                      <td className="py-2 px-2 font-medium">{row.V}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <SectionHead>V_CSTR / V_PFR ratio at target X (Levenspiel)</SectionHead>
              <ResultTable rows={[
                ['V_CSTR / V_PFR ratio',f(r.V_ratio,2),'—'],
                ['Interpretation (>1 = CSTR larger, expected at high X)','—',''],
                ['n CSTRs in series for 90% of PFR efficiency','≈ 5–10 (rule of thumb)',''],
              ]}/>
            </div>
          )}

          {tab==='kinetics' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="k at T_op" value={r.k?.toExponential(3)} unit="s⁻¹" highlight/>
                <MetricCard label="ΔT doubles k" value={f(r.dT_double,1)} unit="°C"/>
                <MetricCard label="k at T_op+10°C" value={r.k_plus10?.toExponential(3)} unit="s⁻¹"/>
                <MetricCard label="Da (at τ_geom)" value={f(r.Da,3)} unit="—"/>
                <MetricCard label="C_A,exit" value={f(r.CA_exit,2)} unit="mol/m³"/>
                <MetricCard label="−r_A at exit" value={f(r.rA_exit,5)} unit="mol/(m³·s)"/>
                <MetricCard label="ΔT_adiabatic" value={f(r.dT_ad,1)} unit="°C" highlight/>
                <MetricCard label="T_peak (adiabatic)" value={f(r.T_peak,1)} unit="°C"/>
              </div>
              <SectionHead>3_KINETICS — Arrhenius + Damköhler</SectionHead>
              <ResultTable rows={[
                ['T_op (absolute)',`${inp.T_op} °C = ${(inp.T_op+273.15).toFixed(2)} K`,''],
                ['Rate constant k = A·exp(−E_a/RT)',r.k?.toExponential(4),'s⁻¹'],
                ['Pre-exponential A_freq',inp.A_freq?.toExponential(3),'s⁻¹'],
                ['Activation energy E_a',inp.Ea,'J/mol'],
                ['Temperature sensitivity ΔT₂ = R·T²·ln2/E_a',f(r.dT_double,1),'°C for doubling k'],
                ['k at T_op+10°C (sensitivity check)',r.k_plus10?.toExponential(4),'s⁻¹'],
                ['C_A at exit = C_A0·(1−X)',f(r.CA_exit,2),'mol/m³'],
                ['−r_A at exit (1st order: k·C_A)',f(r.rA_exit,5),'mol/(m³·s)'],
                ['−r_A at feed X=0',f(r.rA_feed,5),'mol/(m³·s)'],
                ['Space time τ_geom = V_geom/v_0',f(r.tau_geom,1),'s'],
                ['Damköhler Da = k·τ',f(r.Da,3),'—'],
                ['Expected CSTR X from Da = Da/(1+Da)',f(r.X_cstr_da,1),'%'],
                ['ΔT_adiabatic = −ΔH_rx·C_A0·X/(ρ·Cp)',f(r.dT_ad,1),'°C'],
                ['Peak T (adiabatic, no cooling)',f(r.T_peak,1),'°C'],
                ['Runaway assessment',Math.abs(r.dT_ad)>50?'⚠ High ΔT_ad — cooling critical':'✓ Moderate adiabatic rise',''],
              ]}/>
            </div>
          )}

          {tab==='batch' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="t_rx" value={f(r.t_rx_s,1)} unit="s" highlight/>
                <MetricCard label="t_rx" value={f(r.t_rx_h,3)} unit="h"/>
                <MetricCard label="V_batch" value={f(r.V_batch,4)} unit="m³"/>
                <MetricCard label="Batches/day" value={f(r.batches_day,1)} unit="—"/>
                <MetricCard label="Q_cool required" value={f(r.Q_cool_batch,0)} unit="W"/>
                <MetricCard label="ΔT_adiabatic" value={f(r.dT_ad,1)} unit="°C"/>
                <MetricCard label="T_peak (adiabatic)" value={f(r.T_peak,1)} unit="°C"/>
              </div>
              <SectionHead>4_BATCH sheet</SectionHead>
              <ResultTable rows={[
                ['k at T_op',r.k?.toExponential(4),'s⁻¹'],
                ['Reaction time t_rx (1st order: −ln(1−X)/k)',f(r.t_rx_s,1),'s'],
                ['Reaction time in hours',f(r.t_rx_h,3),'h'],
                ['Batch volume V = F_A0·t_rx·2/(X·C_A0)  [×2 for 50% downtime]',f(r.V_batch,5),'m³'],
                ['Number of batches per day',f(r.batches_day,1),'batches/day'],
                ['Adiabatic temperature rise ΔT_ad',f(r.dT_ad,1),'°C'],
                ['Peak temperature (adiabatic) = T_op + ΔT_ad',f(r.T_peak,1),'°C'],
                ['Required cooling duty Q_cool = F_A0·|ΔH_rx|·X',f(r.Q_cool_batch,0),'W'],
              ]}/>
            </div>
          )}

          {tab==='cstr' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="V_CSTR" value={f(r.V_cstr,4)} unit="m³" highlight/>
                <MetricCard label="τ_CSTR" value={f(r.tau_cstr,1)} unit="s"/>
                <MetricCard label="D_CSTR" value={f(r.D_cstr,3)} unit="m"/>
                <MetricCard label="H_CSTR" value={f(r.H_cstr,3)} unit="m"/>
                <MetricCard label="Q_gen" value={f(r.Q_gen,0)} unit="W"/>
                <MetricCard label="Q_remove" value={f(r.Q_remove,0)} unit="W"/>
                <MetricCard label="A_HT required" value={f(r.A_HT_req,2)} unit="m²"/>
                <MetricCard label="κ stability param" value={f(r.kappa,3)} unit="—"/>
              </div>
              <SectionHead>5_CSTR — V = F_A0·X/(−r_A)</SectionHead>
              <ResultTable rows={[
                ['Rate at exit −r_A = k·C_A0·(1−X)',f(r.rA_exit,5),'mol/(m³·s)'],
                ['V_CSTR = F_A0·X/(−r_A)  [design eq.]',f(r.V_cstr,5),'m³'],
                ['Residence time τ = V/v_0',f(r.tau_cstr,1),'s'],
                ['D_CSTR (L/D = 1.5 optimal)',f(r.D_cstr,3),'m'],
                ['H_CSTR = 1.5·D',f(r.H_cstr,3),'m'],
                ['Heat generated Q_gen = F_A0·|ΔH_rx|·X',f(r.Q_gen,0),'W'],
                ['Heat removed Q_remove = U·A·(T_op−T_c)',f(r.Q_remove,0),'W'],
                ['Heat balance check |Q_gen−Q_rem|/Q_gen',f(r.hb_check,1),'%'],
                ['A_HT required = Q_gen/(U·ΔT)',f(r.A_HT_req,2),'m²'],
                ['κ = U·A·τ/(ρ·Cp·V)  (stability)',f(r.kappa,3),'κ < 1 → runaway risk'],
              ]}/>
            </div>
          )}

          {tab==='pfr' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="V_PFR" value={f(r.V_pfr,4)} unit="m³" highlight/>
                <MetricCard label="τ_PFR" value={f(r.tau_pfr,1)} unit="s"/>
                <MetricCard label="L_PFR (at D_rx)" value={f(r.L_pfr,2)} unit="m"/>
                <MetricCard label="L/D" value={f(r.LD_pfr,1)} unit="—"/>
                <MetricCard label="V_CSTR/V_PFR" value={f(r.V_ratio,2)} unit="—"/>
                <MetricCard label="Q_PFR (total)" value={f(r.Q_pfr,0)} unit="W"/>
                <MetricCard label="W_cat (fixed bed)" value={f(r.W_cat,1)} unit="kg"/>
              </div>
              <SectionHead>6_PFR — V = (F_A0/C_A0)·(−ln(1−X))/k  [1st order]</SectionHead>
              <ResultTable rows={[
                ['V_PFR = F_A0·(−ln(1−X))/(k·C_A0)  [1st order]',f(r.V_pfr,5),'m³'],
                ['Residence time τ_PFR = V/v_0',f(r.tau_pfr,1),'s'],
                ['L_PFR = V/(π/4·D_rx²)  at given D',f(r.L_pfr,2),'m'],
                ['L/D check  (< 20 ideal, < 50 acceptable)',f(r.LD_pfr,1),'—'],
                ['V_CSTR (from CSTR sheet)',f(r.V_cstr,5),'m³'],
                ['V_CSTR / V_PFR (>1 = CSTR larger)',f(r.V_ratio,2),'—'],
                ['Q_PFR (total heat, same as CSTR)',f(r.Q_pfr,0),'W'],
                ['Catalyst weight W_cat = ρ_cat·V·(1−ε_b)',f(r.W_cat,1),'kg'],
              ]}/>
            </div>
          )}

          {tab==='fixedbed' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="u_s superficial" value={f(r.us,4)} unit="m/s"/>
                <MetricCard label="Re_p" value={f(r.Re_p,2)} unit="—"/>
                <MetricCard label="ΔP/L (Ergun)" value={f(r.dP_L,1)} unit="Pa/m"/>
                <MetricCard label="Total bed ΔP" value={f(r.dP_bed,3)} unit="kPa"/>
                <MetricCard label="ΔP/P_op" value={f(r.dP_check,1)} unit="%"/>
                <MetricCard label="Thiele φ" value={f(r.phi_thiele,3)} unit="—"/>
                <MetricCard label="η (Aris)" value={f(r.eta_aris,3)} unit="—" highlight/>
                <MetricCard label="Mears number" value={f(r.mears,4)} unit="—"/>
              </div>
              <SectionHead>7_FIXEDBED — Ergun equation</SectionHead>
              <ResultTable rows={[
                ['Superficial velocity u_s = v_0/(π/4·D²)',f(r.us,5),'m/s'],
                ['Modified Re_p = ρ·u_s·d_p/(μ·(1−ε_b))',f(r.Re_p,2),'—'],
                ['Ergun viscous term: 150·μ·u·(1−ε)²/(d_p²·ε³)',f(r.dP_L*0.6,1),'Pa/m (approx)'],
                ['Ergun inertial term: 1.75·ρ·u²·(1−ε)/(d_p·ε³)',f(r.dP_L*0.4,1),'Pa/m (approx)'],
                ['Total ΔP/L (Ergun)',f(r.dP_L,1),'Pa/m'],
                ['Total bed ΔP = (ΔP/L)·L_rx',f(r.dP_bed,3),'kPa'],
                ['ΔP/P_op check (< 10%)',f(r.dP_check,1),'%'],
              ]}/>
              <SectionHead>Diffusion — Thiele modulus and Aris effectiveness</SectionHead>
              <ResultTable rows={[
                ['D_eff = D_AB·ε_p/τ_tort  (ε_p=0.35, τ=3)',r.D_eff,'m²/s'],
                ['Thiele modulus φ = (d_p/6)·√(k/D_eff)',f(r.phi_thiele,3),'—'],
                ['η (Aris approx) = 1/(1+φ²/3)',f(r.eta_aris,3),'—'],
                ['Diffusion limitation check η ≥ 0.80',r.eta_aris>=0.80?'✓ PASS':'✗ FAIL',''],
              ]}/>
              <SectionHead>External mass transfer — Mears criterion</SectionHead>
              <ResultTable rows={[
                ['Schmidt number Sc = μ/(ρ·D_AB)',f(r.Sc,1),'—'],
                ['Sherwood Sh = 2+0.6·Re_p^0.5·Sc^(1/3)',f(r.Sh,3),'—'],
                ['Film k_c = Sh·D_AB/d_p',f(r.kc,6),'m/s'],
                ['Mears = r_obs·ρ_b·d_p/(2·k_c·C_A0)',f(r.mears,4),'—'],
                ['Mears check < 0.15',r.mears<0.15?'✓ PASS — external MT not limiting':'✗ FAIL',''],
              ]}/>
            </div>
          )}

          {tab==='heat' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Q_gen" value={f(r.Q_gen,0)} unit="W"/>
                <MetricCard label="Q_sensible" value={f(r.Q_sens2,0)} unit="W"/>
                <MetricCard label="Q_total" value={f(r.Q_tot,0)} unit="W"/>
                <MetricCard label="LMTD jacket" value={f(r.LMTD_jkt,1)} unit="°C"/>
                <MetricCard label="A_jacket available" value={f(r.A_jkt_avail,2)} unit="m²"/>
                <MetricCard label="A_jacket required" value={f(r.A_jkt_req,2)} unit="m²"/>
                <MetricCard label="Extra coil area" value={f(r.A_coil_extra,2)} unit="m²"/>
                <MetricCard label="Semenov Se" value={f(r.Se,4)} unit="— (< 0.25 stable)" highlight/>
              </div>
              <SectionHead>8_HEATTRANS — Semenov runaway analysis</SectionHead>
              <ResultTable rows={[
                ['Q_gen = F_A0·|ΔH_rx|·X',f(r.Q_gen,0),'W'],
                ['Q_sensible = ṁ·Cp·(T_op−T_feed)',f(r.Q_sens2,0),'W'],
                ['Total Q_total = Q_gen + Q_sens',f(r.Q_tot,0),'W'],
                ['LMTD jacket (10°C coolant rise assumed)',f(r.LMTD_jkt,1),'°C'],
                ['A_jacket_req = Q_tot/(U·LMTD)',f(r.A_jkt_req,2),'m²'],
                ['A_jacket available = π·D·L',f(r.A_jkt_avail,2),'m²'],
                ['Extra coil area needed',f(r.A_coil_extra,2),'m²'],
                ['Semenov Se = Q_gen/(U·A·T_op_K)',f(r.Se,5),'Se < 0.25 = stable'],
                ['Semenov assessment',r.Se<0.25?'✓ Stable (Se < 0.25)':r.Se<1.0?'⚠ Check closely (0.25–1.0)':'✗ Thermal runaway risk (Se > 1.0)',''],
                ['dQ_gen/dT at T_op',f(r.dQgen_dT,0),'W/°C'],
                ['Slope criterion: U·A vs dQ_gen/dT',f(inp.U_HT*inp.A_HT,0)+' vs '+f(r.dQgen_dT,0)+' W/°C',r.slope_ok?'✓ Stable':'✗ Unstable'],
              ]}/>
            </div>
          )}

          {tab==='econ' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="V_design (+15%)" value={f(r.V_design,4)} unit="m³"/>
                <MetricCard label="Cp0 (Turton)" value={`$${f(r.Cp0/1000,0)}k`} unit="USD"/>
                <MetricCard label="CBM (installed)" value={`$${f(r.CBM/1000,0)}k`} unit="USD" highlight/>
                <MetricCard label="RM OPEX" value={`$${f(r.OPEX_RM/1000,0)}k/yr`} unit=""/>
              </div>
              <SectionHead>9_ECONOMICS — Turton CSTR cost</SectionHead>
              <ResultTable rows={[
                ['Active volume (CSTR primary)',f(r.V_cstr,4),'m³'],
                ['Design volume (+15% safety)',f(r.V_design,4),'m³'],
                ['L/D ratio (CSTR, L/D=1.5)','1.5','—'],
                ['Volume in US gallons',f(r.V_design*264.172,1),'gal'],
                ['Cp0 (Turton: ln(Cp0) = 3.8751+0.3328·lnV+0.1908·(lnV)²)','$'+f(r.Cp0,0),'USD'],
                ['FBM (jacketed CS CSTR)',inp.FBM,'—'],
                ['CBM = Cp0 × FBM (CEPCI ratio '+inp.CEPCI+')','$'+f(r.CBM,0),'USD'],
                ['Utility OPEX (steam, cooling)',`$${f(r.OPEX_util,0)}/yr`,''],
                ['Raw material OPEX (c_A × F_A0 × h)',`$${f(r.OPEX_RM,0)}/yr`,''],
                ['Total OPEX',`$${f(r.OPEX_total,0)}/yr`,''],
              ]}/>
            </div>
          )}

          {tab==='checks' && (
            <div>
              <p className="text-[12px] text-muted mb-4">10 design checks from the dashboard — all must be PASS before finalising.</p>
              <div className="grid grid-cols-2 gap-2">
                {r.checks.map(c=><Check key={c.l} label={c.l} value={c.v} pass={c.pass}/>)}
              </div>
              <SectionHead>Summary</SectionHead>
              <ResultTable rows={[
                ['Checks passed',`${r.checks.filter(c=>c.pass).length} / ${r.checks.length}`,''],
                ['k at T_op',r.k?.toExponential(4),'s⁻¹'],
                ['Da',f(r.Da,3),'—'],
                ['ΔT_adiabatic',f(r.dT_ad,1),'°C'],
                ['V_CSTR',f(r.V_cstr,4),'m³'],
                ['V_PFR',f(r.V_pfr,4),'m³'],
                ['Thiele φ',f(r.phi_thiele,3),'—'],
                ['η (Aris)',f(r.eta_aris,3),'—'],
                ['Semenov Se',f(r.Se,4),'—'],
                ['CBM (Turton)','$'+f(r.CBM,0),'USD'],
              ]}/>
            </div>
          )}
        </div>
      </div>
    </SimPage>
  )
}
