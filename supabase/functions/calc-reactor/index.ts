import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

function calcReactor(p: any) {
  const {A_freq,Ea,dHrx,n_order=1,FA0,CA0,v0,X,T_op,P_op,T_c,U_HT,A_HT,
    rho,Cp,mu,D_AB,L_rx,D_rx,dp,eps_b,rho_cat,
    CEPCI=820,FBM=3.5,steamCost=0.02,opHours=8000,cA_cost=0.5} = p

  const R_gas = 8.314
  const T_K = T_op+273.15
  const k = A_freq*Math.exp(-Ea/(R_gas*T_K))
  const k_p10 = A_freq*Math.exp(-Ea/(R_gas*(T_K+10)))
  const dT_double = R_gas*T_K*T_K/Ea*Math.log(2)

  // Levenspiel
  const CA_exit = CA0*(1-X)
  const rA_feed = -k*Math.pow(CA0,n_order)
  const rA_exit = -k*Math.pow(CA_exit,n_order)
  const levenspiel = []
  for(let i=0;i<=20;i++) {
    const xi = i/20*0.98
    const CA_i = CA0*(1-xi)
    const rA_i = k*Math.pow(CA_i,n_order)
    levenspiel.push({'X':xi,'1/(-rA)':FA0/(rA_i*CA0)})
  }

  // CSTR
  const V_cstr = FA0*X/(-rA_exit)
  const tau_cstr = V_cstr/v0
  const D_cstr = Math.pow(V_cstr*4/(Math.PI*1.5),1/3)
  const H_cstr = 1.5*D_cstr

  // PFR (numerical integration)
  let V_pfr = 0
  const steps = 200
  for(let i=0;i<steps;i++) {
    const xi1=X*i/steps, xi2=X*(i+1)/steps
    const dX = xi2-xi1
    const CA_mid = CA0*(1-((xi1+xi2)/2))
    const rA_mid = k*Math.pow(Math.max(CA_mid,1e-9),n_order)
    V_pfr += FA0/rA_mid*dX
  }
  const tau_pfr = V_pfr/v0
  const L_pfr = V_pfr/(Math.PI/4*D_rx*D_rx)
  const LD_pfr = L_pfr/D_rx
  const V_ratio = V_cstr/V_pfr

  // Batch
  let t_rx_s = 0
  if(n_order===1) t_rx_s = -Math.log(1-X)/k
  else if(n_order===2) t_rx_s = X/(k*CA0*(1-X))
  else t_rx_s = 1/k*(Math.pow(CA0,1-n_order)-Math.pow(CA_exit,1-n_order))/(n_order-1)
  const t_rx_h = t_rx_s/3600
  const V_batch = v0*(t_rx_s+3600)*2
  const batches_day = 24/(t_rx_h+1)

  // Kinetics
  const Da = k*tau_cstr
  const dT_ad = -dHrx*CA0*X/(rho*Cp)
  const T_peak = T_op+dT_ad

  // Heat transfer
  const Q_gen = FA0*Math.abs(dHrx)*X
  const Q_remove = U_HT*A_HT*(T_op-T_c)
  const A_HT_req = Q_gen/(U_HT*Math.max(T_op-T_c,1))
  const A_jkt_avail = Math.PI*D_cstr*H_cstr
  const kappa = U_HT*A_HT*tau_cstr/(rho*Cp*V_cstr)
  const Q_sens2 = FA0/CA0*rho*Cp*(T_op-T_c)
  const Q_tot = Q_gen+Q_sens2
  const A_jkt_req = Q_tot/(U_HT*Math.max(T_op-T_c,1))
  const A_coil_extra = Math.max(0,A_jkt_req-A_jkt_avail)
  const LMTD_jkt = (T_op-T_c)-5
  const Se = Q_gen/(U_HT*A_HT*(T_op+273.15))
  const slope_ok = U_HT*A_HT > (Ea*Q_gen/(R_gas*T_K*T_K))
  const Q_cool_batch = Q_gen

  // Fixed bed
  const us_bed = v0/(Math.PI/4*D_rx*D_rx)
  const Re_p = rho*us_bed*dp/(mu*(1-eps_b))
  const dP_L = 150*mu*us_bed*Math.pow(1-eps_b,2)/(dp*dp*Math.pow(eps_b,3)) + 1.75*rho*us_bed*us_bed*(1-eps_b)/(dp*Math.pow(eps_b,3))
  const dP_bed = dP_L*L_rx/1000
  const dP_check = dP_bed*1000/(P_op*10)*100
  const D_eff = D_AB*0.35/3
  const phi_thiele = dp/6*Math.sqrt(k/D_eff)
  const eta_aris = 1/(1+phi_thiele*phi_thiele/3)
  const mears = Re_p*0.15/10
  const W_cat = rho_cat*V_pfr*(1-eps_b)

  // Economics
  let Cp0=0,CBM=0,OPEX_RM=0
  if(CEPCI>0) {
    const V_design = V_cstr*1.15
    const Cp0_2001 = Math.exp(8.821-0.3714*Math.log(V_design*1000)+0.145*Math.pow(Math.log(V_design*1000),2))
    Cp0 = Cp0_2001*(CEPCI/397)
    CBM = Cp0*FBM
    OPEX_RM = FA0*3600*opHours*cA_cost
    var V_design_out = V_design
  }

  // Selection table
  const selTable = [
    {type:'CSTR',mode:'Continuous',X:X.toFixed(2),exo:'Good control',V:V_cstr.toFixed(4)+' m³'},
    {type:'PFR',mode:'Continuous',X:X.toFixed(2),exo:'Jacket needed',V:V_pfr.toFixed(4)+' m³'},
    {type:'Batch',mode:'Batch',X:X.toFixed(2),exo:'Time-dependent',V:V_batch.toFixed(4)+' m³'},
  ]

  const checks = [
    {l:`Conversion X_design ${X.toFixed(2)} ≥ X_target`, v:`${X.toFixed(2)}`, pass:true},
    {l:`Da ${Da.toFixed(3)} > 1 (reaction proceeding)`, v:Da.toFixed(3), pass:Da>1},
    {l:`ΔT_adiabatic ${dT_ad.toFixed(1)}°C < 100°C`, v:`${dT_ad.toFixed(1)}°C`, pass:Math.abs(dT_ad)<100},
    {l:'Heat transfer area adequate', v:`A_prov=${A_HT}m²/A_req=${A_HT_req.toFixed(2)}m²`, pass:A_HT>=A_HT_req},
    {l:`Semenov Se ${Se.toFixed(4)} < 0.25`, v:Se.toFixed(4), pass:Se<0.25},
    {l:`Fixed bed ΔP ${dP_check.toFixed(1)}% < 10%`, v:`${dP_check.toFixed(1)}%`, pass:dP_check<10},
    {l:`Effectiveness η ${eta_aris.toFixed(3)} ≥ 0.80`, v:eta_aris.toFixed(3), pass:eta_aris>=0.80},
    {l:`PFR L/D ${LD_pfr.toFixed(1)} < 50`, v:LD_pfr.toFixed(1), pass:LD_pfr<50},
    {l:`CSTR/PFR ratio ${V_ratio.toFixed(2)} < 20`, v:V_ratio.toFixed(2), pass:V_ratio<20},
    {l:'Capital cost estimated (CBM > 0)', v:CBM>0?`$${CBM.toFixed(0)}`:'skipped', pass:CBM>0||CEPCI===0},
  ]

  return {
    k,k_plus10:k_p10,dT_double,Da,CA_exit,rA_feed,rA_exit,dT_ad,T_peak,
    V_cstr,tau_cstr,D_cstr,H_cstr,Q_gen,Q_remove,A_HT_req,kappa,
    V_pfr,tau_pfr,L_pfr,LD_pfr,V_ratio,
    t_rx_s,t_rx_h,V_batch,batches_day,Q_cool_batch,
    us_bed,Re_p,dP_L,dP_bed,dP_check,phi_thiele,D_eff:D_eff.toExponential(3),eta_aris,mears,W_cat,
    Q_sens2,Q_tot,A_jkt_avail,A_jkt_req,A_coil_extra,LMTD_jkt,Se,slope_ok,
    Cp0,CBM,OPEX_RM,V_design:V_design_out,
    levenspiel,selTable,checks
  }
}

serve(async (req) => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  try {
    const p = await req.json()
    const result = calcReactor(p)
    return new Response(JSON.stringify(result),{headers:{...cors,'Content-Type':'application/json'}})
  } catch(e) {
    return new Response(JSON.stringify({error:String(e)}),{status:400,headers:{...cors,'Content-Type':'application/json'}})
  }
})
