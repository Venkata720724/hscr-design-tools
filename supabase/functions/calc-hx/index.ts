import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

const STD_T = [6,8,10,12,14,16,18,20,22,25,28,30,32,36,40]
function nextStd(v:number) { return STD_T.find(s=>s>=v)||40 }
function clamp(v:number,lo:number,hi:number){return Math.max(lo,Math.min(hi,v))}

function calcHX(p:any) {
  const {Ds,Bs,Bc,Pt,Nb,do:do_,di,L,Nt,passes,kw,dNs,dNt,
    ms,Ts_in,Ts_out,rhos,mus,musw,ks,Cps,Rfs,
    mt,Tt_in,Tt_out,rhot,mut,mutw,kt,Cpt,Rft,
    ut_max,us_max,dPt_max,dPs_max,
    Pd_mech,Sallow,CA,Ew,FBM,CEPCI,CEPCIbase,opHours,
    rhol_cond,lambda_cond,mus_cond,Pc_bar,Pop_bar,rhov_reb,sigma_reb,lambda_reb,
    shellUtilCost,tubeUtilCost} = p

  // THERMAL
  const Qs = ms*Cps*(Ts_in-Ts_out)
  const Qt = mt*Cpt*(Tt_out-Tt_in)
  const imbalance = Math.abs(Qs-Qt)/Qs*100
  const Q = (Qs+Qt)/2
  const dT1 = Ts_in-Tt_out, dT2 = Ts_out-Tt_in
  const LMTD = Math.abs(dT1-dT2) < 0.01 ? dT1 : (dT1-dT2)/Math.log(Math.abs(dT1/dT2))
  const Rf_val = (Ts_in-Ts_out)/(Tt_out-Tt_in)
  const Sf_val = (Tt_out-Tt_in)/(Ts_in-Tt_in)
  let F = 1.0
  if(passes>=2) {
    const R_val=Rf_val, S_val=Sf_val
    if(Math.abs(R_val-1)<0.001) {
      F = Math.sqrt(2)*(1-S_val)/(Math.log((2/S_val-1-1/Math.sqrt(2))/(2/S_val-1+1/Math.sqrt(2))))
    } else {
      const sqrtR2 = Math.sqrt(R_val*R_val+1)
      const num = Math.log((1-S_val)/(1-R_val*S_val))
      const denom = sqrtR2*Math.log((2-S_val*(R_val+1-sqrtR2))/(2-S_val*(R_val+1+sqrtR2)))
      F = clamp(num/denom, 0.5, 1.0)
    }
  }
  const dTm = F*LMTD
  const A_prov = Math.PI*do_*L*Nt

  // TUBE SIDE
  const Nt_pass = Nt/passes
  const At_flow = Math.PI/4*di*di*Nt_pass
  const ut = mt/(rhot*At_flow)
  const Re_t = rhot*ut*di/mut
  const Pr_t = mut*Cpt/kt
  const regime_t = Re_t>10000?'Turbulent':Re_t>2300?'Transition':'Laminar'
  let Nu_t: number
  if(Re_t>10000) Nu_t = 0.023*Math.pow(Re_t,0.8)*Math.pow(Pr_t,0.4)*Math.pow(mut/mutw,0.14)
  else if(Re_t>2300) Nu_t = 0.116*(Math.pow(Re_t,0.667)-125)*Pr_t^(1/3)*Math.pow(mut/mutw,0.14)
  else Nu_t = 3.66
  const ht = Nu_t*kt/di
  const ht_adj = ht*(di/do_)
  const ft = Math.pow(-2*Math.log10(2.51/(Re_t*Math.sqrt(0.02))),-2)*1.0
  const dPt_pipe = ft*(L*passes/di)*rhot*ut*ut/2
  const uNt = mt/(rhot*Math.PI/4*dNt*dNt)
  const dPt_nozzle = rhot*uNt*uNt
  const dPt_total = (dPt_pipe+dPt_nozzle)/1000

  // SHELL SIDE (Bell-Delaware simplified)
  const As = Ds*Bs*(Pt-do_)/Pt
  const us = ms/(rhos*As)
  const de = (Pt/Math.PI)*(4*(Pt*Pt*Math.sqrt(3)/4-Math.PI*do_*do_/8)/do_) // triangular
  const de2 = 1.1/do_*(Pt*Pt-0.917*do_*do_)
  const de_eff = Math.max(de2, de, 0.005)
  const Re_s = rhos*us*de_eff/mus
  const Pr_s = mus*Cps/ks
  const h_ideal = 0.36*Math.pow(Re_s,0.55)*Math.pow(Pr_s,1/3)*Math.pow(mus/musw,0.14)*ks/de_eff
  const Jc = 0.55+0.72*(1-Bc)
  const theta_ds = 2*Math.acos(1-2*Bc)
  const Jl = 1-0.44*(1-Math.sin(theta_ds/2*2)/(theta_ds/2*2))
  const Jb = 0.70
  const Jr = Re_s<100 ? Math.pow(10/Re_s,0.18) : 1.0
  const ho = h_ideal*Jc*Jl*Jb*Jr
  const uNs = ms/(rhos*Math.PI/4*dNs*dNs)
  const dPs_nozzle = rhos*uNs*uNs
  const dPs_baffle = 4*0.35*Nb*rhos*us*us/2
  const dPs_total = (dPs_baffle+dPs_nozzle)/1000

  // OVERALL U
  const tw = (do_-di)/2
  const dlm = (do_-di)/Math.log(do_/di)
  const Rw = tw*do_/(dlm*kw)
  const Rft_adj = Rft*(do_/di)
  const U_clean = 1/(1/ht_adj + Rw + 1/ho)
  const U_dirty = 1/(1/U_clean + Rft_adj + Rfs)
  const cleanliness = U_dirty/U_clean*100
  const A_req = Q/(U_dirty*dTm)
  const OD = (A_prov-A_req)/A_req*100

  // CONDENSER (Nusselt)
  const T_cond = (Ts_in+Ts_out)/2
  const Nr = Math.max(1, Math.round(Ds/(Pt*2)))
  const T_wall_cond = (T_cond+Tt_out)/2
  const dT_film = Math.max(T_cond-T_wall_cond, 1)
  let h_cond_top = 0, h_cond = 0, A_cond_req = 0
  if(rhol_cond>0 && lambda_cond>0 && mus_cond>0) {
    h_cond_top = 0.725*Math.pow(rhol_cond*rhol_cond*9.81*lambda_cond*Math.pow(ks||0.6,3)/(mus_cond*do_*dT_film),0.25)
    h_cond = h_cond_top*Math.pow(Nr,-1/6)
    A_cond_req = Q/(h_cond*dT_film)
  }

  // REBOILER (Mostinski)
  let Pr_reb=0,Fp_reb=0,q_reb=0,h_nb=0,q_max_zuber=0,flux_frac=0
  if(Pc_bar>0 && Pop_bar>0) {
    Pr_reb = Pop_bar/Pc_bar
    Fp_reb = 1.8*Math.pow(Pr_reb,0.17)+4*Math.pow(Pr_reb,1.2)+10*Math.pow(Pr_reb,10)
    q_reb = Q/A_prov
    h_nb = 0.00417*Math.pow(Pc_bar*100,0.69)*Math.pow(q_reb,0.7)*Fp_reb
    q_max_zuber = sigma_reb>0 ? 0.131*lambda_reb*(rhov_reb*rhov_reb*9.81*sigma_reb*(rhos-rhov_reb))^0.25 : 200000
    flux_frac = q_reb/q_max_zuber*100
  }

  // MECHANICAL
  const Pd_asme = Math.max(1.1*Pd_mech, Pd_mech+0.172)
  const t_shell_calc = Pd_asme*1e6*Ds*500/(Sallow*1e6*Ew-0.6*Pd_asme*1e6)*1000 + CA*1000
  const t_sn = nextStd(t_shell_calc)
  const Do = Ds*1000+2*t_sn
  const MAWP_sh = Sallow*Ew*(t_sn-CA*1000)/((Ds/2*1000+0.6*(t_sn-CA*1000)))*0.001
  const P_ht = 1.3*MAWP_sh
  const shell_OD = (t_sn/t_shell_calc-1)*100
  const t_ts = Ds*1000/2*Math.sqrt(Pd_asme/(0.3*Sallow))
  const W_shell_kN = 7850*Math.PI*(Ds+t_sn/1000)*L*(t_sn/1000)*9.81/1000

  // VIBRATION (Blevins/Connors)
  const L_span = L/(Nb+1)
  const E_steel = 200e9, nu_tube = 0.3
  const I_tube = Math.PI*(Math.pow(do_,4)-Math.pow(di,4))/64
  const m_tube_unit = 7850*Math.PI*(do_*do_-di*di)/4
  const fn = Math.pow(Math.PI/L_span,2)*Math.sqrt(E_steel*I_tube/m_tube_unit)/(2*Math.PI)
  const fv = 0.22*us/do_
  const vortex_ratio = fv/fn
  const delta = 0.03
  const m_eff = m_tube_unit+rhos*Math.PI*do_*do_/4
  const u_crit = 3.3*fn*do_*Math.sqrt(2*Math.PI*delta*m_eff/(rhos*do_*do_))
  const fluid_ratio = us/u_crit

  // ECONOMICS
  let CBM = 0
  if(CEPCI>0 && FBM>0) {
    const Cp0_2001 = Math.exp(11.667-0.8709*Math.log(A_prov)+0.09005*Math.pow(Math.log(A_prov),2))
    CBM = Cp0_2001*FBM*(CEPCI/CEPCIbase)
  }

  // TEMPERATURE PROFILE
  const profile = []
  for(let i=0;i<=10;i++) {
    const x = i/10*100
    profile.push({ pos:x, hot:Ts_out+(Ts_in-Ts_out)*(10-i)/10, cold:Tt_in+(Tt_out-Tt_in)*i/10 })
  }

  // DESIGN CHECKS
  const checks = [
    {l:'Duty balance |Qs−Qt|/Qs < 2%', v:`${imbalance.toFixed(2)}%`, pass:imbalance<2},
    {l:'F-factor ≥ 0.75', v:F.toFixed(3), pass:F>=0.75},
    {l:`Tube velocity ${ut.toFixed(3)} ≤ u_t,max ${ut_max} m/s`, v:`${ut.toFixed(3)} m/s`, pass:ut<=ut_max},
    {l:`Shell velocity ${us.toFixed(3)} ≤ u_s,max ${us_max} m/s`, v:`${us.toFixed(3)} m/s`, pass:us<=us_max},
    {l:`ΔP_tube ${dPt_total.toFixed(1)} kPa ≤ ${dPt_max/1000} kPa`, v:`${dPt_total.toFixed(1)} kPa`, pass:dPt_total<=dPt_max/1000},
    {l:`ΔP_shell ${dPs_total.toFixed(1)} kPa ≤ ${dPs_max/1000} kPa`, v:`${dPs_total.toFixed(1)} kPa`, pass:dPs_total<=dPs_max/1000},
    {l:`Over-design ${OD.toFixed(1)}% in range 5–40%`, v:`${OD.toFixed(1)}%`, pass:OD>=5&&OD<=40},
    {l:'Vibration: vortex ratio < 0.5', v:vortex_ratio.toFixed(3), pass:vortex_ratio<0.5},
    {l:'Vibration: fluidelastic ratio < 0.8', v:fluid_ratio.toFixed(3), pass:fluid_ratio<0.8},
    {l:'Shell MAWP ≥ design pressure', v:`${MAWP_sh.toFixed(3)} MPa`, pass:MAWP_sh>=Pd_mech||Pd_mech===0},
  ]

  return {
    Q,Qs,Qt,imbalance,dT1,dT2,LMTD,Rf:Rf_val,Sf:Sf_val,F,dTm,A_prov,A_req,OD,
    ut,Re_t,Pr_t,Nu_t,ht,ht_adj,ft,dPt_total,regime_t,Nt_pass,At_flow:At_flow,uNt,
    us,Re_s,Pr_s,h_ideal,Jc,Jl,Jb,Jr,ho,dPs_total,As,de:de_eff,uNs,
    U_clean,U_dirty,cleanliness,Rw,Rft_adj,
    T_cond,Nr,dT_film,h_cond_top,h_cond,A_cond_req,
    Pr_reb,Fp_reb,q_reb,h_nb,q_max_zuber,flux_frac,
    t_shell_calc,t_sn,Do,MAWP_sh,P_ht,shell_OD,t_ts,Pd_asme,W_shell_kN,
    fn,fv,vortex_ratio,u_crit,fluid_ratio,CBM,
    profile,checks
  }
}

serve(async (req) => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  try {
    const p = await req.json()
    const result = calcHX(p)
    return new Response(JSON.stringify(result),{headers:{...cors,'Content-Type':'application/json'}})
  } catch(e) {
    return new Response(JSON.stringify({error:String(e)}),{status:400,headers:{...cors,'Content-Type':'application/json'}})
  }
})
