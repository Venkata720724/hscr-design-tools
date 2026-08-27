import { useState, useMemo, useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import SimPage, { TabBar, MetricCard, ResultTable, SectionHead, Check, Field, SelectField, InputSection } from '../../components/SimPage'
import { calculate, DEFAULTS } from './engine'

const TABS = [
  {id:'thermal',  label:'Thermal'},
  {id:'tube',     label:'Tube Side'},
  {id:'shell',    label:'Shell Side (Bell-Delaware)'},
  {id:'overall',  label:'Overall U'},
  {id:'condenser',label:'Condenser'},
  {id:'reboiler', label:'Reboiler'},
  {id:'mech',     label:'Mechanical'},
  {id:'vibration',label:'Vibration'},
  {id:'checks',   label:'Design Checks'},
]

export default function HXPage() {
  const [inp, setInp] = useState(DEFAULTS)
  const [tab, setTab] = useState('thermal')
  const set = (k,v) => setInp(p=>({...p,[k]:v}))
  const r = useMemo(()=>calculate(inp),[inp])
  const f = (v,d=2) => v==null?'—':(+v).toFixed(d)

  return (
    <SimPage name="Heat Exchanger"
      tagline="Shell & tube design — Bell-Delaware shell side, LMTD/F factor, tube hydraulics, Nusselt condenser, Mostinski reboiler, Blevins/Connors vibration, ASME mechanical, Turton cost."
      models={['Bell-Delaware','Sieder-Tate/Dittus-Boelter','LMTD F-factor (Bowman)','Nusselt condensation','Eissenberg row correction','Mostinski nucleate boiling','Zuber critical flux','Blevins f_n','Connors u_crit','ASME UG-27','Turton cost']}>
      <div className="flex gap-6">
        {/* INPUTS */}
        <div className="w-52 flex-shrink-0 text-[12px]">
          <InputSection>Geometry (TEMA)</InputSection>
          <Field label="Shell ID D_s" unit="m" value={inp.Ds} onChange={v=>set('Ds',v)} min={0.1} step={0.05}/>
          <Field label="Baffle spacing B_s" unit="m" value={inp.Bs} onChange={v=>set('Bs',v)} min={0.05} step={0.025}/>
          <Field label="Baffle cut B_c" value={inp.Bc} onChange={v=>set('Bc',v)} min={0.15} max={0.45} step={0.05} hint="Fraction of D_s"/>
          <Field label="Tube pitch P_t" unit="m" value={inp.Pt} onChange={v=>set('Pt',v)} min={0.02} step={0.001}/>
          <Field label="No. of baffles N_b" value={inp.Nb} onChange={v=>set('Nb',v)} min={1}/>
          <Field label="Tube OD d_o" unit="m" value={inp.do} onChange={v=>set('do',v)} min={0.01} step={0.001}/>
          <Field label="Tube ID d_i" unit="m" value={inp.di} onChange={v=>set('di',v)} min={0.008} step={0.001}/>
          <Field label="Tube length L" unit="m" value={inp.L} onChange={v=>set('L',v)} min={1}/>
          <Field label="No. of tubes N_t" value={inp.Nt} onChange={v=>set('Nt',v)} min={10}/>
          <Field label="Tube passes" value={inp.passes} onChange={v=>set('passes',v)} min={1} max={8}/>
          <Field label="k_wall" unit="W/(m·K)" value={inp.kw} onChange={v=>set('kw',v)} min={1}/>
          <Field label="Shell nozzle ID d_Ns" unit="m" value={inp.dNs} onChange={v=>set('dNs',v)} step={0.005}/>
          <Field label="Tube nozzle ID d_Nt" unit="m" value={inp.dNt} onChange={v=>set('dNt',v)} step={0.005}/>
          <InputSection>Shell side (hot)</InputSection>
          <Field label="ṁ_s" unit="kg/s" value={inp.ms} onChange={v=>set('ms',v)} min={0.01}/>
          <Field label="T_s,in" unit="°C" value={inp.Ts_in} onChange={v=>set('Ts_in',v)}/>
          <Field label="T_s,out" unit="°C" value={inp.Ts_out} onChange={v=>set('Ts_out',v)}/>
          <Field label="ρ_s" unit="kg/m³" value={inp.rhos} onChange={v=>set('rhos',v)} min={1}/>
          <Field label="μ_s" unit="Pa·s" value={inp.mus} onChange={v=>set('mus',v)} step={0.0001}/>
          <Field label="μ_s,w" unit="Pa·s" value={inp.musw} onChange={v=>set('musw',v)} step={0.0001}/>
          <Field label="k_s" unit="W/(m·K)" value={inp.ks} onChange={v=>set('ks',v)} step={0.01}/>
          <Field label="Cp_s" unit="J/(kg·K)" value={inp.Cps} onChange={v=>set('Cps',v)} min={100}/>
          <Field label="R_f,s" unit="m²·K/W" value={inp.Rfs} onChange={v=>set('Rfs',v)} step={0.0001}/>
          <InputSection>Tube side (cold)</InputSection>
          <Field label="ṁ_t" unit="kg/s" value={inp.mt} onChange={v=>set('mt',v)} min={0.01}/>
          <Field label="T_t,in" unit="°C" value={inp.Tt_in} onChange={v=>set('Tt_in',v)}/>
          <Field label="T_t,out" unit="°C" value={inp.Tt_out} onChange={v=>set('Tt_out',v)}/>
          <Field label="ρ_t" unit="kg/m³" value={inp.rhot} onChange={v=>set('rhot',v)} min={1}/>
          <Field label="μ_t" unit="Pa·s" value={inp.mut} onChange={v=>set('mut',v)} step={0.0001}/>
          <Field label="μ_t,w" unit="Pa·s" value={inp.mutw} onChange={v=>set('mutw',v)} step={0.0001}/>
          <Field label="k_t" unit="W/(m·K)" value={inp.kt} onChange={v=>set('kt',v)} step={0.01}/>
          <Field label="Cp_t" unit="J/(kg·K)" value={inp.Cpt} onChange={v=>set('Cpt',v)} min={100}/>
          <Field label="R_f,t" unit="m²·K/W" value={inp.Rft} onChange={v=>set('Rft',v)} step={0.0001}/>
          <InputSection>Limits &amp; Mech.</InputSection>
          <Field label="u_t,max" unit="m/s" value={inp.ut_max} onChange={v=>set('ut_max',v)} step={0.5}/>
          <Field label="u_s,max" unit="m/s" value={inp.us_max} onChange={v=>set('us_max',v)} step={0.5}/>
          <Field label="P_design" unit="MPa" value={inp.Pd_mech} onChange={v=>set('Pd_mech',v)} step={0.1}/>
          <Field label="S_allow" unit="MPa" value={inp.Sallow} onChange={v=>set('Sallow',v)}/>
          <Field label="CEPCI" value={inp.CEPCI} onChange={v=>set('CEPCI',v)}/>
          <Field label="FBM" value={inp.FBM} onChange={v=>set('FBM',v)} step={0.01}/>
          <InputSection>Condenser / Reboiler</InputSection>
          <Field label="ρ_L (cond.)" unit="kg/m³" value={inp.rhol_cond} onChange={v=>set('rhol_cond',v)}/>
          <Field label="λ (cond.)" unit="J/kg" value={inp.lambda_cond} onChange={v=>set('lambda_cond',v)}/>
          <Field label="P_c (reb.)" unit="bar" value={inp.Pc_bar} onChange={v=>set('Pc_bar',v)}/>
          <Field label="P_op (reb.)" unit="bar" value={inp.Pop_bar} onChange={v=>set('Pop_bar',v)} step={0.1}/>
          <Field label="ρ_V (reb.)" unit="kg/m³" value={inp.rhov_reb} onChange={v=>set('rhov_reb',v)} step={0.5}/>
        </div>

        {/* RESULTS */}
        <div className="flex-1 min-w-0">
          <TabBar tabs={TABS} active={tab} onChange={setTab}/>

          {tab==='thermal' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Q_design" value={f(r.Q/1000,2)} unit="kW" highlight/>
                <MetricCard label="LMTD" value={f(r.LMTD,2)} unit="°C"/>
                <MetricCard label="F-factor" value={f(r.F,3)} unit="—"/>
                <MetricCard label="Effective ΔT_m" value={f(r.dTm,2)} unit="°C"/>
                <MetricCard label="A_required" value={f(r.A_req,2)} unit="m²"/>
                <MetricCard label="A_provided" value={f(r.A_prov,2)} unit="m²"/>
                <MetricCard label="Over-design OD%" value={f(r.OD,1)} unit="%"/>
                <MetricCard label="Duty imbalance" value={f(r.imbalance,2)} unit="%"/>
              </div>
              {/* Temperature profile chart */}
              <div className="border border-line rounded-xl p-4 mb-4">
                <p className="text-[12px] font-semibold text-ink mb-3">Temperature profile (counter-current)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={r.profile} margin={{top:5,right:10,bottom:15,left:10}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="pos" label={{value:'Position (%)',position:'insideBottom',offset:-10,style:{fontSize:11,fill:'#888'}}} tick={{fontSize:10}}/>
                    <YAxis label={{value:'Temperature (°C)',angle:-90,position:'insideLeft',style:{fontSize:11,fill:'#888'}}} tick={{fontSize:10}}/>
                    <Tooltip contentStyle={{fontSize:11,border:'1px solid #f0f0f0',borderRadius:8}}/>
                    <Legend wrapperStyle={{fontSize:11,paddingTop:8}}/>
                    <Line dataKey="hot" name="Shell (hot)" stroke="#dc2626" strokeWidth={2} dot={false}/>
                    <Line dataKey="cold" name="Tube (cold)" stroke="#2563eb" strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <SectionHead>2_THERMAL sheet detail</SectionHead>
              <ResultTable rows={[
                ['Shell-side duty Q_s = ṁ·Cp·ΔT',f(r.Qs/1000,2),'kW'],
                ['Tube-side duty Q_t = ṁ·Cp·ΔT',f(r.Qt/1000,2),'kW'],
                ['Imbalance |Q_s−Q_t|/Q',f(r.imbalance,2),'%'],
                ['Design duty Q (conservative max)',f(r.Q/1000,2),'kW'],
                ['ΔT₁ = T_s,in − T_t,out',f(r.dT1,2),'°C'],
                ['ΔT₂ = T_s,out − T_t,in',f(r.dT2,2),'°C'],
                ['LMTD (counter-current)',f(r.LMTD,2),'°C'],
                ['Temperature ratio R',f(r.Rf,3),'—'],
                ['Temperature ratio S',f(r.Sf,3),'—'],
                ['F-factor (Bowman 1-2 exchanger)',f(r.F,4),'—'],
                ['Effective ΔT_m = F × LMTD',f(r.dTm,2),'°C'],
                ['A_provided = π·d_o·L·N_t',f(r.A_prov,2),'m²'],
                ['A_required = Q/(U_dirty·ΔT_m)',f(r.A_req,2),'m²'],
                ['Over-design OD% = (A_prov−A_req)/A_req',f(r.OD,1),'%'],
              ]}/>
            </div>
          )}

          {tab==='tube' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="u_t" value={f(r.ut,3)} unit="m/s"/>
                <MetricCard label="Re_t" value={f(r.Re_t,0)} unit="—"/>
                <MetricCard label="Pr_t" value={f(r.Pr_t,2)} unit="—"/>
                <MetricCard label="Nu_t" value={f(r.Nu_t,2)} unit="—"/>
                <MetricCard label="h_t" value={f(r.ht,0)} unit="W/(m²·K)"/>
                <MetricCard label="h_t,adj (outer)" value={f(r.ht_adj,0)} unit="W/(m²·K)" highlight/>
                <MetricCard label="ΔP_t total" value={f(r.dPt_total,1)} unit="kPa"/>
                <MetricCard label="Regime" value={r.regime_t} unit=""/>
              </div>
              <SectionHead>3_TUBESIDE — Dittus-Boelter / Sieder-Tate</SectionHead>
              <ResultTable rows={[
                ['Tubes per pass N_t/pass',r.Nt_pass,''],
                ['Flow area per pass A_t = π/4·d_i²·N_t/pass',f(r.At_flow,6),'m²'],
                ['Tube-side velocity u_t = ṁ/(ρ·A)',f(r.ut,3),'m/s'],
                ['Reynolds number Re_t = ρ·u·d_i/μ',f(r.Re_t,0),'—'],
                ['Prandtl number Pr_t = μ·Cp/k',f(r.Pr_t,2),'—'],
                ['Flow regime',r.regime_t,''],
                ['Nusselt Nu_t (Dittus-Boelter, turbulent)',f(r.Nu_t,2),'—'],
                ['h_t = Nu·k/d_i',f(r.ht,0),'W/(m²·K)'],
                ['h_t,adj = h_t·(d_i/d_o)  [outer area basis]',f(r.ht_adj,0),'W/(m²·K)'],
                ['Relative roughness ε/d_i','4.6e-5/d_i','—'],
                ['ΔP_friction (Darcy-Weisbach, all passes)',f(r.dPt_fric,1),'kPa'],
                ['ΔP_return losses (4 vel. heads per pass)',f(r.dPt_ret,1),'kPa'],
                ['ΔP_tube total',f(r.dPt_total,1),'kPa'],
              ]}/>
            </div>
          )}

          {tab==='shell' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="u_s" value={f(r.us,3)} unit="m/s"/>
                <MetricCard label="Re_s" value={f(r.Re_s,0)} unit="—"/>
                <MetricCard label="h_ideal" value={f(r.h_ideal,0)} unit="W/(m²·K)"/>
                <MetricCard label="h_o (with BD corr.)" value={f(r.ho,0)} unit="W/(m²·K)" highlight/>
                <MetricCard label="J_c" value={f(r.Jc,3)} unit="—"/>
                <MetricCard label="J_l" value={f(r.Jl,3)} unit="—"/>
                <MetricCard label="ΔP_s total" value={f(r.dPs_total,1)} unit="kPa"/>
                <MetricCard label="Regime" value={r.regime_s} unit=""/>
              </div>
              <SectionHead>4_SHELLSIDE — Bell-Delaware method</SectionHead>
              <ResultTable rows={[
                ['Bundle clearance C_t = P_t − d_o',f(r.Ct,4),'m'],
                ['Shell cross-flow area A_s (Kern simplified)',f(r.As,5),'m²'],
                ['Shell velocity u_s = ṁ/(ρ·A_s)',f(r.us,3),'m/s'],
                ['Hydraulic diameter d_e (triangular pitch)',f(r.de,4),'m'],
                ['Shell Re_s = ρ·u_s·d_e/μ',f(r.Re_s,0),'—'],
                ['Shell Pr_s = μ·Cp/k',f(r.Pr_s,2),'—'],
                ['h_ideal = 0.36·Re^0.55·Pr^(1/3)·(μ/μ_w)^0.14·k/d_e',f(r.h_ideal,0),'W/(m²·K)'],
                ['J_c (baffle cut correction)  = 0.55+0.72(1−2B_c)',f(r.Jc,3),'—'],
                ['J_l (baffle leakage)  ≈ 0.85−0.15·B_c',f(r.Jl,3),'—'],
                ['J_b (bundle bypass)  ≈ 0.70',f(r.Jb,2),'—'],
                ['J_s (variable spacing)  = 1.0',f(r.Js,1),'—'],
                ['J_r (Re correction)',f(r.Jr,2),'—'],
                ['h_o = h_ideal × J_c × J_l × J_b × J_s × J_r',f(r.ho,0),'W/(m²·K)'],
                ['ΔP_s ideal (cross-flow)',f(r.dPs_ideal,1),'kPa'],
                ['ΔP_s total (corrected)',f(r.dPs_total,1),'kPa'],
              ]}/>
            </div>
          )}

          {tab==='overall' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="U_clean" value={f(r.U_clean,0)} unit="W/(m²·K)"/>
                <MetricCard label="U_dirty" value={f(r.U_dirty,0)} unit="W/(m²·K)" highlight/>
                <MetricCard label="Cleanliness U_d/U_c" value={f(r.cleanliness,1)} unit="%"/>
                <MetricCard label="Over-design OD%" value={f(r.OD,1)} unit="%"/>
              </div>
              <SectionHead>5_OVERALL — U calculation</SectionHead>
              <ResultTable rows={[
                ['Tube wall thickness t_w = (d_o−d_i)/2',f((inp.do-inp.di)/2*1000,2),'mm'],
                ['Log-mean diameter d_lm = (d_o−d_i)/ln(d_o/d_i)',f(r.Rw>0?(inp.do-inp.di)/r.Rw*inp.do/inp.kw:0,4),'m'],
                ['Wall resistance R_w = t_w·d_o/(d_lm·k_w)',r.Rw?.toExponential(4),'m²·K/W'],
                ['Fouling R_f,t adjusted to outer area',r.Rft_adj?.toExponential(4),'m²·K/W'],
                ['1/U_clean = 1/h_t,adj + R_w + 1/h_o','see below',''],
                ['U_clean',f(r.U_clean,0),'W/(m²·K)'],
                ['1/U_dirty = 1/U_clean + R_f,t,adj + R_f,s','see below',''],
                ['U_dirty (design value)',f(r.U_dirty,0),'W/(m²·K)'],
                ['Cleanliness U_dirty/U_clean',f(r.cleanliness,1),'%'],
                ['A_required = Q/(U_dirty·ΔT_m)',f(r.A_req,2),'m²'],
                ['A_provided = π·d_o·L·N_t',f(r.A_prov,2),'m²'],
                ['Over-design OD% = (A_prov−A_req)/A_req',f(r.OD,1),'%'],
              ]}/>
            </div>
          )}

          {tab==='condenser' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="T_cond" value={f(r.T_cond,1)} unit="°C"/>
                <MetricCard label="ΔT_film" value={f(r.dT_film,1)} unit="°C"/>
                <MetricCard label="h_cond (top row, Nusselt)" value={f(r.h_cond_top,0)} unit="W/(m²·K)"/>
                <MetricCard label="h_cond (N_r corr., Eissenberg)" value={f(r.h_cond,0)} unit="W/(m²·K)" highlight/>
                <MetricCard label="N_r tube rows" value={r.Nr} unit="—"/>
                <MetricCard label="A_cond required" value={f(r.A_cond_req,1)} unit="m²"/>
                <MetricCard label="A_provided" value={f(r.A_prov,2)} unit="m²"/>
              </div>
              <SectionHead>6_CONDENSER — Nusselt film condensation</SectionHead>
              <ResultTable rows={[
                ['Condensing temperature T_cond (avg)',f(r.T_cond,1),'°C'],
                ['Wall temperature T_w (estimate)',f(r.T_cond-r.dT_film,1),'°C'],
                ['Film ΔT',f(r.dT_film,1),'°C'],
                ['Tube rows N_r (approx √(N_t/2))',r.Nr,'—'],
                ['h_cond (Nusselt, horizontal, top row)',f(r.h_cond_top,0),'W/(m²·K)'],
                ['h_cond (Eissenberg N_r^(−1/6) correction)',f(r.h_cond,0),'W/(m²·K)'],
                ['A_cond required = Q/(h_cond·ΔT_m)',f(r.A_cond_req,1),'m²'],
                ['A_provided',f(r.A_prov,2),'m²'],
                ['Condenser check A_prov ≥ A_req',r.A_prov>=r.A_cond_req?'✓ PASS':'✗ FAIL',''],
              ]}/>
            </div>
          )}

          {tab==='reboiler' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="h_nb (Mostinski)" value={f(r.h_nb,0)} unit="W/(m²·K)" highlight/>
                <MetricCard label="q_max (Zuber)" value={f(r.q_max_zuber,0)} unit="W/m²"/>
                <MetricCard label="q/q_max" value={f(r.flux_frac,1)} unit="%"/>
                <MetricCard label="F_p (Mostinski)" value={f(r.Fp_reb,3)} unit="—"/>
              </div>
              <SectionHead>7_REBOILER — Mostinski nucleate boiling</SectionHead>
              <ResultTable rows={[
                ['Critical pressure P_c',inp.Pc_bar,'bar'],
                ['Operating pressure P_op',inp.Pop_bar,'bar'],
                ['Reduced pressure P_r = P_op/P_c',f(r.Pr_reb,5),'—'],
                ['Mostinski pressure factor F_p',f(r.Fp_reb,3),'—'],
                ['Estimated heat flux q = Q/A_prov',f(r.q_reb,0),'W/m²'],
                ['h_nb = 0.00417·P_c^0.69·q^0.7·F_p',f(r.h_nb,0),'W/(m²·K)'],
                ['q_max (Zuber pool boiling)',f(r.q_max_zuber,0),'W/m²'],
                ['Flux fraction q/q_max',f(r.flux_frac,1),'%'],
                ['Critical flux check q/q_max < 70%',r.flux_frac<70?'✓ PASS':'✗ FAIL — reduce flux',''],
              ]}/>
            </div>
          )}

          {tab==='mech' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="P_design" value={f(r.Pd_asme,3)} unit="MPa"/>
                <MetricCard label="t_shell calc" value={f(r.t_shell_calc,2)} unit="mm"/>
                <MetricCard label="t_shell nominal" value={r.t_shell} unit="mm" highlight/>
                <MetricCard label="t_tubesheet (Gardiner)" value={f(r.t_ts,1)} unit="mm"/>
                <MetricCard label="u_N,s (shell nozzle)" value={f(r.uNs,2)} unit="m/s"/>
                <MetricCard label="u_N,t (tube nozzle)" value={f(r.uNt,2)} unit="m/s"/>
                <MetricCard label="W_shell" value={f(r.W_shell_kN,2)} unit="kN"/>
                <MetricCard label="CBM (Turton)" value={`$${f(r.CBM/1000,0)}k`} unit="USD"/>
              </div>
              <SectionHead>8_MECHANICAL</SectionHead>
              <ResultTable rows={[
                ['Design pressure P_d = max(1.1P_op, P_op+175kPa)',f(r.Pd_asme,3),'MPa'],
                ['Shell inside radius R_i = D_s/2',f(inp.Ds/2*1000,0),'mm'],
                ['t_shell_calc = P·R/(S·E−0.6P) + CA  [UG-27]',f(r.t_shell_calc,2),'mm'],
                ['t_shell nominal (next plate)',r.t_shell,'mm'],
                ['t_tubesheet (simplified Gardiner) = D_s/2·√(Pd/(S×0.3))',f(r.t_ts,1),'mm'],
                ['Shell nozzle velocity u_N,s',f(r.uNs,2),'m/s'],
                ['Shell nozzle check < 1.5 m/s',r.uNs<1.5?'✓ PASS':'✗ FAIL',''],
                ['Tube nozzle velocity u_N,t',f(r.uNt,2),'m/s'],
                ['Tube nozzle check < 3 m/s',r.uNt<3?'✓ PASS':'✗ FAIL',''],
                ['Shell weight W_shell (approx)',f(r.W_shell_kN,2),'kN'],
                ['Turton Cp_HX (K1=4.3247, FBM='+inp.FBM+')','$'+f(r.Cp_hx,0),'USD'],
                ['CBM = FBM × Cp (CEPCI-escalated)','$'+f(r.CBM,0),'USD'],
              ]}/>
            </div>
          )}

          {tab==='vibration' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="f_n (Blevins)" value={f(r.fn,2)} unit="Hz"/>
                <MetricCard label="f_v (Strouhal)" value={f(r.fv,2)} unit="Hz"/>
                <MetricCard label="f_v/f_n" value={f(r.vortex_ratio,3)} unit="— (< 0.5)"/>
                <MetricCard label="u_crit (Connors)" value={f(r.u_crit,3)} unit="m/s"/>
                <MetricCard label="u_s" value={f(r.us,3)} unit="m/s"/>
                <MetricCard label="u_s/u_crit" value={f(r.fluid_ratio,3)} unit="— (< 0.8)"/>
                <MetricCard label="L_span" value={f(r.L_span,3)} unit="m"/>
                <MetricCard label="m_tube" value={f(r.m_tube,3)} unit="kg/m"/>
              </div>
              <SectionHead>9_VIBRATION — Blevins natural frequency + Connors critical velocity</SectionHead>
              <ResultTable rows={[
                ['Tube mass per unit length m_t (steel + fluid)',f(r.m_tube,4),'kg/m'],
                ['Tube moment of inertia I_t = π/64·(d_o⁴−d_i⁴)',r.I_tube,'m⁴'],
                ['Baffle span L_span = L/(N_b+1)',f(r.L_span,3),'m'],
                ['E_steel (200 GPa at ambient)','200e9','Pa'],
                ['Natural frequency f_n = (π/L)²·√(EI/m_t)/(2π)  [SS beam]',f(r.fn,2),'Hz'],
                ['Shell velocity u_s',f(r.us,3),'m/s'],
                ['Vortex shedding f_v = St·u_s/d_o  (St=0.22)',f(r.fv,2),'Hz'],
                ['Frequency ratio f_v/f_n',f(r.vortex_ratio,3),'—'],
                ['Vortex shedding check < 0.5',r.vortex_ratio<0.5?'✓ PASS':'✗ FAIL',''],
                ['Connors constant K','3.3','—'],
                ['Damping ratio ζ','0.03','—'],
                ['u_crit = K·f_n·d_o·√(2π·ζ·m_t/(ρ_s·d_o²))',f(r.u_crit,3),'m/s'],
                ['Velocity ratio u_s/u_crit',f(r.fluid_ratio,3),'—'],
                ['Fluidelastic check u_s/u_crit < 0.8',r.fluid_ratio<0.8?'✓ PASS':'✗ FAIL',''],
              ]}/>
            </div>
          )}

          {tab==='checks' && (
            <div>
              <p className="text-[12px] text-muted mb-4">10 design checks from the dashboard sheet — all must be PASS.</p>
              <div className="grid grid-cols-2 gap-2">
                {r.checks.map(c=><Check key={c.l} label={c.l} value={c.v} pass={c.pass}/>)}
              </div>
              <SectionHead>Summary</SectionHead>
              <ResultTable rows={[
                ['Checks passed',`${r.checks.filter(c=>c.pass).length} / ${r.checks.length}`,''],
                ['U_clean',f(r.U_clean,0),'W/(m²·K)'],
                ['U_dirty',f(r.U_dirty,0),'W/(m²·K)'],
                ['A_required',f(r.A_req,2),'m²'],
                ['A_provided',f(r.A_prov,2),'m²'],
                ['Over-design',f(r.OD,1),'%'],
                ['CBM (Turton, installed)','$'+f(r.CBM,0),'USD'],
              ]}/>
            </div>
          )}
        </div>
      </div>
    </SimPage>
  )
}
