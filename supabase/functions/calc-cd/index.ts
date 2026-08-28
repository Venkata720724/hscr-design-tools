import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
function Psat(A:number,B:number,C:number,T:number){return Math.pow(10,A-B/(C+T))}
function clamp(v:number,lo:number,hi:number){return Math.max(lo,Math.min(hi,v))}
const STD_T=[6,8,10,12,16,20,25,30,36,40,45,50]
function nextStdT(v:number){return STD_T.find((s:number)=>s>=v)||50}
const STD_D=[0.45,0.60,0.75,0.90,1.05,1.20,1.50,1.80,2.10,2.40,3.00]
const PSV_ORI=[{d:'D',a:0.71},{d:'E',a:1.26},{d:'F',a:1.98},{d:'G',a:3.24},{d:'H',a:5.06},{d:'J',a:8.27},{d:'K',a:12.3},{d:'L',a:19.4},{d:'M',a:26.0},{d:'N',a:32.9},{d:'P',a:41.2}]

function calcHeatExchanger(p: any) {
  const {Ds,Bs,Bc,Pt,Nb,do:do_,di,L,Nt,passes,kw,dNs,dNt,
    ms,Ts_in,Ts_out,rhos,mus,musw,ks,Cps,Rfs,
    mt,Tt_in,Tt_out,rhot,mut,mutw,kt,Cpt,Rft,
    ut_max,us_max,dPt_max=70000,dPs_max=70000,
    Pd_mech,Sallow,CA,Ew,FBM,CEPCI,CEPCIbase,
    rhol_cond,lambda_cond,mus_cond,Pc_bar,Pop_bar,rhov_reb,sigma_reb,lambda_reb}=p

  const Qs=ms*Cps*Math.abs(Ts_in-Ts_out)
  const Qt=mt*Cpt*Math.abs(Tt_out-Tt_in)
  const Q=Math.max(Qs,Qt)
  const imbalance=Math.abs(Qs-Qt)/Math.max(Qs,1)*100
  const dT1=Ts_in-Tt_out, dT2=Ts_out-Tt_in
  const LMTD=Math.abs(dT1-dT2)<0.01?dT1:(dT1-dT2)/Math.log(Math.abs(dT1/dT2))
  const Rf=Math.abs(Ts_in-Ts_out)/Math.max(Math.abs(Tt_out-Tt_in),0.01)
  const Sf=Math.abs(Tt_out-Tt_in)/Math.max(Math.abs(Ts_in-Tt_in),0.01)
  let F=1.0
  if(Math.abs(Rf-1)>0.001&&Sf>0.01&&Sf<0.99&&Rf>0){
    try{const sqR=Math.sqrt(Rf*Rf+1);const n=sqR*Math.log((1-Sf)/(1-Rf*Sf));const d=(Rf-1)*Math.log((2-Sf*(Rf+1-sqR))/(2-Sf*(Rf+1+sqR)));const Fc=Math.abs(n/d);F=isNaN(Fc)||!isFinite(Fc)?1.0:Math.min(1.0,Math.max(0.5,Fc))}catch(e){F=1.0}
  }
  const dTm=F*LMTD
  const A_prov=Math.PI*do_*L*Nt
  const At_flow=Math.PI/4*di*di*(Nt/passes)
  const ut=mt/(rhot*At_flow)
  const Re_t=rhot*ut*di/mut, Pr_t=mut*Cpt/kt
  const Nu_t=Re_t>10000?0.027*Math.pow(Re_t,0.8)*Math.pow(Pr_t,1/3)*Math.pow(mut/mutw,0.14):Re_t>2300?0.023*Math.pow(Re_t,0.8)*Math.pow(Pr_t,0.4):3.66
  const ht=Nu_t*kt/di, ht_adj=ht*(di/do_)
  const ft=0.25/Math.pow(Math.log10(4.6e-5/di/3.7+5.74/Math.pow(Math.max(Re_t,1),0.9)),2)
  const dPt=ft*rhot*ut*ut*L*passes/(2*di)+4*passes*0.5*rhot*ut*ut
  const As=Ds*Bs*(Pt-do_)/Pt
  const us=ms/(rhos*Math.max(As,1e-6))
  const de=4*(0.866*Pt*Pt-Math.PI/8*do_*do_)/(Math.PI/2*do_)
  const Re_s=rhos*us*de/mus, Pr_s=mus*Cps/ks
  const h_id=0.36*Math.pow(Math.max(Re_s,1),0.55)*Math.pow(Math.max(Pr_s,0.1),1/3)*Math.pow(mus/musw,0.14)*ks/de
  const Jc=0.55+0.72*(1-2*Bc),Jl=Math.max(0.4,0.85-0.15*Bc),Jr=Re_s>10000?1.0:Re_s>2300?0.85:0.65
  const ho=h_id*Jc*Jl*0.70*1.0*Jr
  const dPs=4*0.72*Nb*rhos*us*us/2*0.70*Jl
  const tw=(do_-di)/2, dlm=(do_-di)/Math.log(do_/di)
  const Rw=tw*do_/(dlm*kw), Rft_adj=Rft*(do_/di)
  const U_clean=1/(1/ht_adj+Rw+1/ho)
  const U_dirty=1/(1/U_clean+Rft_adj+Rfs)
  const A_req=dTm>0?Q/(U_dirty*dTm):0
  const OD=A_req>0?(A_prov-A_req)/A_req*100:0
  const Nr=Math.max(1,Math.round(Math.sqrt(Nt/2)))
  const T_cond=(Ts_in+Ts_out)/2, dT_film=Math.max(3,T_cond-(Tt_in+0.2*(T_cond-Tt_in)))
  const h_cond_top=0.725*Math.pow(Math.max(rhol_cond*rhol_cond*9.81*lambda_cond*Math.pow(kt,3)/(mus_cond*do_*dT_film),0),0.25)
  const h_cond=h_cond_top*Math.pow(Nr,-1/6)
  const Pr_reb=Pop_bar/Pc_bar
  const Fp_reb=1.8*Math.pow(Pr_reb,0.17)+4*Math.pow(Pr_reb,1.2)+10*Math.pow(Pr_reb,10)
  const q_reb=Q/Math.max(A_prov,0.1)
  const h_nb=0.00417*Math.pow(Pc_bar,0.69)*Math.pow(Math.max(q_reb,1),0.7)*Fp_reb
  const q_max=0.131*lambda_reb*Math.sqrt(rhov_reb)*Math.pow(Math.max(sigma_reb*9.81*(rhol_cond-rhov_reb),0),0.25)
  const Pd_a=Math.max(1.1*Pd_mech,Pd_mech+0.175)
  const t_sc=Pd_a*Ds/2*1000/(Sallow*Ew-0.6*Pd_a)+CA*1000
  const STD2=[6,8,10,12,16,20,25]; const t_shell=STD2.find(t=>t>=t_sc)||25
  const t_ts=Ds/2*1000*Math.sqrt(Pd_a/(Sallow*0.3))
  const uNs=ms/(rhos*Math.PI/4*dNs*dNs), uNt=mt/(rhot*Math.PI/4*dNt*dNt)
  const I_tube=Math.PI/64*(Math.pow(do_,4)-Math.pow(di,4))
  const m_tube=Math.PI/4*(do_*do_-di*di)*7850+Math.PI/4*di*di*rhot
  const L_span=L/(Math.max(Nb,1)+1)
  const fn=Math.pow(Math.PI/L_span,2)*Math.sqrt(200e9*I_tube/m_tube)/(2*Math.PI)
  const fv=0.22*us/do_
  const u_crit=3.3*fn*do_*Math.sqrt(2*Math.PI*0.03*m_tube/(rhos*do_*do_))
  const Esc=CEPCI/CEPCIbase
  const CBM=FBM*Math.exp(4.3247-0.303*Math.log(Math.max(A_prov,0.5))+0.1634*Math.pow(Math.log(Math.max(A_prov,0.5)),2))*Esc
  const profile=Array.from({length:11},(_:any,i:number)=>({pos:i*10,hot:+(Ts_in-i/10*(Ts_in-Ts_out)).toFixed(1),cold:+(Tt_out-i/10*(Tt_out-Tt_in)).toFixed(1)}))
  const checks=[
    {l:'Duty imbalance < 2%',pass:imbalance<2,v:`${imbalance.toFixed(1)}%`},
    {l:'F-factor ≥ 0.75',pass:F>=0.75,v:`F = ${F.toFixed(3)}`},
    {l:'Over-design 5–25%',pass:OD>=5&&OD<=25,v:`OD = ${OD.toFixed(1)}%`},
    {l:'Tube velocity ≤ u_t,max',pass:ut<=ut_max,v:`u_t = ${ut.toFixed(2)} m/s`},
    {l:'Shell velocity ≤ u_s,max',pass:us<=us_max,v:`u_s = ${us.toFixed(2)} m/s`},
    {l:'Tube ΔP ≤ limit',pass:dPt<=dPt_max,v:`${(dPt/1000).toFixed(1)} kPa`},
    {l:'Shell ΔP ≤ limit',pass:dPs<=dPs_max,v:`${(dPs/1000).toFixed(1)} kPa`},
    {l:'Reboiler flux < 70% critical',pass:q_max>0?q_reb/q_max*100<70:true,v:`${q_max>0?(q_reb/q_max*100).toFixed(1):0}%`},
    {l:'Vortex shedding f_v/f_n < 0.5',pass:fn>0?fv/fn<0.5:true,v:`${fn>0?(fv/fn).toFixed(3):0}`},
    {l:'Fluidelastic u_s/u_crit < 0.8',pass:u_crit>0?us/u_crit<0.8:true,v:`${u_crit>0?(us/u_crit).toFixed(3):0}`},
  ]
  return {
    Qs:+Qs.toFixed(0),Qt:+Qt.toFixed(0),Q:+Q.toFixed(0),imbalance:+imbalance.toFixed(2),
    dT1:+dT1.toFixed(2),dT2:+dT2.toFixed(2),LMTD:+LMTD.toFixed(2),Rf:+Rf.toFixed(3),Sf:+Sf.toFixed(3),
    F:+F.toFixed(3),dTm:+dTm.toFixed(2),A_prov:+A_prov.toFixed(2),A_req:+A_req.toFixed(2),OD:+OD.toFixed(1),
    Nt_pass:Nt/passes,ut:+ut.toFixed(3),Re_t:+Re_t.toFixed(0),Pr_t:+Pr_t.toFixed(2),Nu_t:+Nu_t.toFixed(2),
    ht:+ht.toFixed(0),ht_adj:+ht_adj.toFixed(0),dPt_total:+(dPt/1000).toFixed(1),
    regime_t:Re_t>10000?'Turbulent':Re_t>2300?'Transition':'Laminar',
    As:+As.toFixed(5),us:+us.toFixed(3),de:+de.toFixed(4),Re_s:+Re_s.toFixed(0),Pr_s:+Pr_s.toFixed(2),
    h_ideal:+h_id.toFixed(0),Jc:+Jc.toFixed(3),Jl:+Jl.toFixed(3),Jb:0.70,Js:1.0,Jr:+Jr.toFixed(2),
    ho:+ho.toFixed(0),dPs_total:+(dPs/1000).toFixed(1),regime_s:Re_s>10000?'Turbulent':Re_s>2300?'Transition':'Laminar',
    Rw:+Rw.toFixed(6),Rft_adj:+Rft_adj.toFixed(6),U_clean:+U_clean.toFixed(0),U_dirty:+U_dirty.toFixed(0),
    cleanliness:+(U_dirty/U_clean*100).toFixed(1),
    T_cond:+T_cond.toFixed(1),dT_film:+dT_film.toFixed(1),Nr,
    h_cond_top:+h_cond_top.toFixed(0),h_cond:+h_cond.toFixed(0),A_cond_req:+(Q/Math.max(h_cond*dTm,1)).toFixed(1),
    Pr_reb:+Pr_reb.toFixed(4),Fp_reb:+Fp_reb.toFixed(3),q_reb:+q_reb.toFixed(0),
    h_nb:+h_nb.toFixed(0),q_max_zuber:+q_max.toFixed(0),flux_frac:+(q_max>0?q_reb/q_max*100:0).toFixed(1),
    Pd_asme:+Pd_a.toFixed(3),t_shell_calc:+t_sc.toFixed(2),t_shell,t_ts:+t_ts.toFixed(1),
    uNs:+uNs.toFixed(2),uNt:+uNt.toFixed(2),W_shell_kN:+(7850*Math.PI*Ds*L*t_shell/1000*9.81/1000).toFixed(2),
    fn:+fn.toFixed(2),fv:+fv.toFixed(2),vortex_ratio:+(fn>0?fv/fn:99).toFixed(3),
    u_crit:+u_crit.toFixed(3),fluid_ratio:+(u_crit>0?us/u_crit:99).toFixed(3),
    CBM:+CBM.toFixed(0),profile,checks,
  }
}

// ── REACTOR ENGINE ────────────────────────────────────────────────
function calcReactor(p: any) {
  const {A_freq,Ea,dHrx,n_order,FA0,CA0,v0,T0,X,T_op,P_op,T_c,U_HT,A_HT,rho,Cp,mu,D_AB,L_rx,D_rx,dp,eps_b,rho_cat,CEPCI,steamCost,opHours,cA_cost,FBM}=p
  if(X<=0||X>=1||CA0<=0||FA0<=0) return {error:'Invalid inputs'}
  const R_g=8.314, T_K=T_op+273.15
  const k=A_freq*Math.exp(-Ea/(R_g*T_K))
  const dT_double=R_g*T_K*T_K*Math.log(2)/Ea
  const k10=A_freq*Math.exp(-Ea/(R_g*(T_K+10)))
  const CA_exit=CA0*(1-X)
  const rA_exit=k*Math.pow(CA_exit,n_order)
  const tau_geom=(Math.PI/4*D_rx*D_rx*L_rx)/v0
  const Da=k*tau_geom
  const dT_ad=-dHrx*CA0*X/(rho*Cp)
  const t_rx=n_order===1?-Math.log(1-X)/k:X/(k*Math.pow(CA0,n_order-1)*(1-X))
  const V_batch=FA0*t_rx*2/(X*CA0)
  const V_cstr=FA0*X/Math.max(rA_exit,1e-10)
  const tau_cstr=V_cstr/v0
  const D_cstr=Math.pow(4*V_cstr/Math.PI/1.5,1/3)
  const Q_gen=FA0*Math.abs(dHrx)*X
  const Q_remove=U_HT*A_HT*(T_op-T_c)
  const A_HT_req=Q_gen/Math.max(U_HT*(T_op-T_c),1)
  const kappa=U_HT*A_HT*tau_cstr/(rho*Cp*V_cstr)
  const V_pfr=n_order===1?FA0*(-Math.log(1-X))/(k*CA0):FA0*X/(k*Math.pow(CA0,n_order)*(1-X)*(1-X)*0.5+1e-15)
  const L_pfr=V_pfr/(Math.PI/4*D_rx*D_rx)
  const A_cross=Math.PI/4*D_rx*D_rx
  const us_bed=v0/A_cross
  const Re_p=rho*us_bed*dp/(mu*(1-eps_b))
  const dP_L=150*mu*us_bed*Math.pow(1-eps_b,2)/(dp*dp*Math.pow(eps_b,3))+1.75*rho*us_bed*us_bed*(1-eps_b)/(dp*Math.pow(eps_b,3))
  const dP_bed=dP_L*L_rx/1000
  const D_eff=D_AB*0.35/3.0
  const phi=dp/6*Math.sqrt(k/D_eff)
  const eta=1/(1+phi*phi/3)
  const Sc=mu/(rho*D_AB)
  const Sh=2+0.6*Math.pow(Math.max(Re_p,0.01),0.5)*Math.pow(Sc,1/3)
  const kc=Sh*D_AB/dp
  const mears=k*CA0*(1-X)*rho_cat*(1-eps_b)*dp/(2*kc*CA0)
  const mdot=FA0*90/1000
  const Q_sens=mdot*Cp*(T_op-T0)
  const Q_tot=Q_gen+Q_sens
  const LMTD_jkt=T_op-T_c-5
  const A_jkt_req=Q_tot/Math.max(U_HT*LMTD_jkt,1)
  const A_jkt_avail=Math.PI*D_rx*L_rx
  const Se=Q_gen/(U_HT*A_HT*T_K)
  const dQdT=-dHrx*FA0*X*(Ea/(R_g*T_K*T_K))
  const V_design=V_cstr*1.15
  const V_gal=V_design*264.172
  const Cp0=Math.exp(3.8751+0.3328*Math.log(Math.max(V_gal,0.5))+0.1908*Math.pow(Math.log(Math.max(V_gal,0.5)),2))*CEPCI
  const CBM=FBM*Cp0
  const OPEX_RM=cA_cost*FA0*opHours*3600
  const X_vals=[0,0.2,0.4,0.6,0.8,0.9,0.95]
  const levenspiel=X_vals.map(xi=>({X:xi,'1/(-rA)':+(1/Math.max(k*Math.pow(CA0*(1-xi),n_order),1e-15)).toFixed(4)}))
  const selTable=[
    {type:'CSTR',mode:'Continuous, well-mixed',X:'Low per stage',exo:'Excellent',V:+V_cstr.toFixed(4)+' m³'},
    {type:'PFR',mode:'Plug flow, tubular',X:'High conversion',exo:'Moderate',V:+V_pfr.toFixed(4)+' m³'},
    {type:'Batch',mode:'Semi-batch',X:'Any',exo:'Cooling coil',V:+V_batch.toFixed(4)+' m³'},
    {type:'Fixed bed',mode:'Heterogeneous cat.',X:'High conversion',exo:'Limited',V:+V_pfr.toFixed(4)+' m³'},
  ]
  const checks=[
    {l:'k > 0 at T_op',pass:k>0,v:`k = ${k.toExponential(3)} s⁻¹`},
    {l:'Da reasonable (0.1–100)',pass:Da>=0.1&&Da<=100,v:`Da = ${Da.toFixed(2)}`},
    {l:'ΔT_adiabatic < 100°C',pass:Math.abs(dT_ad)<100,v:`ΔT_ad = ${dT_ad.toFixed(1)} °C`},
    {l:'Heat balance imbalance < 10%',pass:Math.abs(Q_gen-Q_remove)/Math.max(Q_gen,1)*100<10,v:`${(Math.abs(Q_gen-Q_remove)/Math.max(Q_gen,1)*100).toFixed(1)}%`},
    {l:'A_HT ≥ A_HT_req',pass:A_HT>=A_HT_req,v:`${A_HT} ≥ ${A_HT_req.toFixed(2)} m²`},
    {l:'Semenov Se < 0.25',pass:Se<0.25,v:`Se = ${Se.toFixed(3)}`},
    {l:'Slope U·A > dQ_gen/dT',pass:U_HT*A_HT>dQdT,v:`${(U_HT*A_HT).toFixed(0)} vs ${dQdT.toFixed(0)} W/°C`},
    {l:'Bed ΔP/P_op < 10%',pass:dP_bed/P_op*100<10,v:`${(dP_bed/P_op*100).toFixed(1)}%`},
    {l:'η_Aris ≥ 0.80',pass:eta>=0.80,v:`η = ${eta.toFixed(3)}`},
    {l:'Mears criterion < 0.15',pass:mears<0.15,v:`Mears = ${mears.toFixed(3)}`},
  ]
  return {
    k,dT_double:+dT_double.toFixed(1),k_plus10:k10,
    CA_exit:+CA_exit.toFixed(2),rA_exit:+rA_exit.toFixed(5),rA_feed:+(k*Math.pow(CA0,n_order)).toFixed(5),
    tau_geom:+tau_geom.toFixed(1),Da:+Da.toFixed(3),X_cstr_da:+(Da/(1+Da)*100).toFixed(1),
    dT_ad:+dT_ad.toFixed(1),T_peak:+(T_op+dT_ad).toFixed(1),
    t_rx_s:+t_rx.toFixed(1),t_rx_h:+(t_rx/3600).toFixed(3),V_batch:+V_batch.toFixed(4),
    batches_day:+(24/(t_rx/3600*2)).toFixed(1),Q_cool_batch:+(FA0*Math.abs(dHrx)*X).toFixed(0),
    V_cstr:+V_cstr.toFixed(4),tau_cstr:+tau_cstr.toFixed(1),D_cstr:+D_cstr.toFixed(3),H_cstr:+(1.5*D_cstr).toFixed(3),
    Q_gen:+Q_gen.toFixed(0),Q_remove:+Q_remove.toFixed(0),A_HT_req:+A_HT_req.toFixed(2),kappa:+kappa.toFixed(3),
    V_pfr:+V_pfr.toFixed(4),tau_pfr:+(V_pfr/v0).toFixed(1),L_pfr:+L_pfr.toFixed(2),LD_pfr:+(L_pfr/D_rx).toFixed(1),
    V_ratio:+(V_cstr/Math.max(V_pfr,1e-10)).toFixed(2),W_cat:+(rho_cat*V_pfr*(1-eps_b)).toFixed(1),
    us_bed:+us_bed.toFixed(5),Re_p:+Re_p.toFixed(2),dP_L:+dP_L.toFixed(1),dP_bed:+dP_bed.toFixed(3),
    dP_check:+(dP_bed/P_op*100).toFixed(1),D_eff:D_eff.toExponential(3),
    phi_thiele:+phi.toFixed(3),eta_aris:+eta.toFixed(3),Sc:+Sc.toFixed(1),Sh:+Sh.toFixed(2),mears:+mears.toFixed(4),
    Q_sens2:+Q_sens.toFixed(0),Q_tot:+Q_tot.toFixed(0),LMTD_jkt:+LMTD_jkt.toFixed(1),
    A_jkt_req:+A_jkt_req.toFixed(2),A_jkt_avail:+A_jkt_avail.toFixed(2),
    A_coil_extra:+(Math.max(0,A_jkt_req-A_jkt_avail)).toFixed(2),
    Se:+Se.toFixed(4),dQgen_dT:+dQdT.toFixed(0),slope_ok:U_HT*A_HT>dQdT,
    V_design:+V_design.toFixed(4),Cp0:+Cp0.toFixed(0),CBM:+CBM.toFixed(0),
    OPEX_RM:+OPEX_RM.toFixed(0),OPEX_total:+OPEX_RM.toFixed(0),
    selTable,levenspiel,checks,
  }
}

// ── MAIN HANDLER ─────────────────────────────────────────────────
function calcPressureVessel(p: any) {
  const {orientation='vertical',Pd,Pop,Td,CA=3,Ej=1.0,
    Di,L_tt,headType='ellipsoidal',r_cr,r_k,cone_alpha=30,
    S_allow,Sy=220,Su=485,rho_steel=7850,
    d_n1=0.2,S_n1,d_n2=0.15,S_n2,
    rho_fluid=800,t_ins=75,rho_ins=150,W_plat=2500,W_pipe=3000,
    H_sk=3,D_sk=1.6,b_sad=0.2,theta_sad=120,A_sad=0.5,
    Vw=47,Ss=0.25,
    P_set,MW_relief=30,T_relief=250,W_relief=5000,
    flange_class='300',
    CEPCI=820,CEPCIbase=397,FBM=4.16} = p

  const Pd_code = Math.max(1.1*Pop, Pop+0.172)
  const Ri = Di/2*1000 // mm
  const t_sc = Pd_code*1e6*Ri/(S_allow*1e6*Ej - 0.6*Pd_code*1e6) + CA
  const STD_T = [6,8,10,12,14,16,18,20,22,25,28,30,32,36,40,45,50]
  const t_sn = STD_T.find(s=>s>=t_sc)||50
  const Do = Di*1000 + 2*t_sn // mm
  const MAWP_sh = S_allow*Ej*(t_sn-CA)/((Ri+0.6*(t_sn-CA)))*0.001
  const P_ht = 1.3*MAWP_sh*(S_allow/S_allow) // simplified
  const shell_OD = (t_sn/t_sc-1)*100

  // Heads — all 5 types
  const t_SE = Pd_code*1e6*(Di*1000)/(2*S_allow*1e6*Ej-0.2*Pd_code*1e6) + CA
  const t_SE_nom = STD_T.find(s=>s>=t_SE)||40
  const MAWP_head = S_allow*Ej*(t_SE_nom-CA)/((Di*500)+0.2*(t_SE_nom-CA))*0.001
  const t_hemi = Pd_code*1e6*Ri/(2*S_allow*1e6*Ej-0.2*Pd_code*1e6) + CA
  const t_hemi_nom = STD_T.find(s=>s>=t_hemi)||30
  const M_tori = r_cr&&r_k ? (1/4)*(3+Math.sqrt(r_cr/r_k)) : 1.77
  const t_tori = Pd_code*1e6*M_tori*(r_cr||Di)*1000/(2*S_allow*1e6*Ej-0.2*Pd_code*1e6) + CA
  const t_tori_nom = STD_T.find(s=>s>=t_tori)||40
  const alpha_rad = cone_alpha*Math.PI/180
  const t_cone = Pd_code*1e6*(Di*1000)/(2*Math.cos(alpha_rad)*(S_allow*1e6*Ej-0.6*Pd_code*1e6)) + CA
  const t_flat = (Di*1000)*Math.sqrt(0.33*Pd_code*1e6/(S_allow*1e6*Ej)) + CA

  // Nozzles UG-37
  const t_n1 = Pd_code*1e6*(d_n1/2*1000)/((S_n1||S_allow)*1e6*Ej-0.6*Pd_code*1e6) + CA
  const t_n1_nom = STD_T.find(s=>s>=t_n1)||12
  const A_req_n1 = (d_n1*1000)*(t_sc-CA)
  const A_avail_n1 = 2*(t_sn-t_sc)*(d_n1*1000) + 2*t_n1_nom*(t_n1_nom-t_n1)*2.5
  const n1_ok = A_avail_n1 >= A_req_n1
  const t_n2 = Pd_code*1e6*(d_n2/2*1000)/((S_n2||S_allow)*1e6*Ej-0.6*Pd_code*1e6) + CA
  const A_req_n2 = (d_n2*1000)*(t_sc-CA)
  const A_avail_n2 = 2*(t_sn-t_sc)*(d_n2*1000) + 2*(STD_T.find(s=>s>=t_n2)||10)*(12-t_n2)*2.5
  const n2_ok = A_avail_n2 >= A_req_n2

  // Flanges — ASME B16.5 MAWP at 250°C (approx)
  const flangeMAWP: {[k:string]:number} = {'150':1.98,'300':5.14,'600':10.28,'900':15.41,'1500':25.69,'2500':42.82}
  const flange_MAWP = flangeMAWP[String(flange_class)]||5.14
  const flange_ok = flange_MAWP >= Pd_code

  // Weights
  const Dm_sh = (Di + t_sn/1000)
  const W_sh = rho_steel*Math.PI*Dm_sh*L_tt*(t_sn/1000)
  const W_heads = 2*(rho_steel*Math.PI/4*Di*Di*(t_SE_nom/1000)*0.25) // approx 2:1 SE
  const W_fluid = rho_fluid*Math.PI/4*Di*Di*L_tt
  const W_ins = rho_ins*Math.PI*(Di+2*t_ins/1000)*L_tt*(t_ins/1000)
  const W_empty = W_sh + W_heads + W_ins + (W_plat||0) + (W_pipe||0)
  const W_oper = W_empty + W_fluid
  const W_htest = W_sh + W_heads + 1000*Math.PI/4*Di*Di*L_tt // water filled

  // Skirt stress
  const sigma_w = W_oper*9.81/(Math.PI*D_sk*0.02*1e6)
  const sigma_skirt = sigma_w
  const skirt_ok = sigma_skirt <= S_allow*0.667
  // Saddle (Zick simplified)
  const sigma_L = W_oper*9.81*A_sad/(Math.PI*(Di/2)*(Di/2)*(t_sn/1000))*1e-6
  const sigma_T = sigma_L*0.6
  const sad_bearing = W_oper*9.81/(2*b_sad*Math.PI*Di*0.001)
  const saddle_ok = sigma_L <= 1.25*S_allow

  // Wind & seismic
  const Kz = 1.0, Cf = 0.7, Kd = 0.85
  const q_wind = 0.613*Kz*Vw*Vw*Cf*Kd
  const H_total = L_tt + Di/2 + H_sk
  const M_wind = q_wind*(Do/1000)*H_total*H_total/2/1000 // kN·m
  const Fa = 1.6, SDS = (2/3)*Fa*Ss, RI = 1.5
  const V_seismic = SDS*W_oper*9.81/((3/RI)*1000) // kN
  const M_seismic = V_seismic*H_total*2/3
  const I_sec = Math.PI/64*(Math.pow(Do/1000,4)-Math.pow(Di,4))
  const sigma_b = Math.max(M_wind,M_seismic)*1000*(Do/1000/2)/I_sec/1e6
  const sigma_w2 = W_oper*9.81/(Math.PI*Di*(t_sn/1000)*1e6)

  // Relief — API 520
  const P1_psv = (P_set||Pd)*1.03
  const T_K_rel = (T_relief||Td)+273.15
  const C_api = 315
  const Z_gas = 0.9
  const A_psv_cm2 = MW_relief>0
    ? (W_relief/(C_api*0.975*P1_psv*1000))*Math.sqrt(T_K_rel*(Z_gas||1)/MW_relief)*10000
    : (W_relief/11.78/(P1_psv*1000*0.62))*Math.sqrt(rho_fluid)*10000
  const PSV_ORIFICES = [{d:'D',a:0.71},{d:'E',a:1.26},{d:'F',a:1.98},{d:'G',a:3.24},{d:'H',a:5.06},{d:'J',a:8.27},{d:'K',a:12.3},{d:'L',a:19.4},{d:'M',a:26.0},{d:'N',a:32.9},{d:'P',a:41.2}]
  const psv_orifice = PSV_ORIFICES.find(o=>o.a>=A_psv_cm2)?.d||'P+'

  // Economics
  let CBM = 0
  if(CEPCI>0&&FBM>0) {
    const V_vessel = Math.PI/4*Di*Di*L_tt
    const Cp0_2001 = Math.exp(7.0132+0.18255*Math.log(V_vessel*1000)+0.02297*Math.pow(Math.log(V_vessel*1000),2))
    CBM = Cp0_2001*(CEPCI/CEPCIbase)*FBM
  }

  const checks = [
    {l:'Shell MAWP ≥ Design pressure P_d', v:`${MAWP_sh.toFixed(3)} MPa`, pass:MAWP_sh>=Pd_code},
    {l:'Head MAWP ≥ Design pressure P_d', v:`${MAWP_head.toFixed(3)} MPa`, pass:MAWP_head>=Pd_code},
    {l:'Flange class MAWP ≥ P_d', v:`${flange_MAWP.toFixed(2)} MPa`, pass:flange_ok},
    {l:'Nozzle 1 reinforcement adequate', v:`A_avail=${A_avail_n1.toFixed(0)} vs A_req=${A_req_n1.toFixed(0)} mm²`, pass:n1_ok},
    {l:'Shell over-design 5–30%', v:`${shell_OD.toFixed(1)}%`, pass:shell_OD>=5&&shell_OD<=30},
    {l:orientation==='vertical'?'Skirt stress ≤ allowable':'Saddle stress ≤ allowable',
      v:orientation==='vertical'?`σ=${sigma_skirt.toFixed(2)} MPa`:`σ_L=${sigma_L.toFixed(2)} MPa`,
      pass:orientation==='vertical'?skirt_ok:saddle_ok},
    {l:'Cone angle α ≤ 30° (UG-32 validity)', v:`α=${cone_alpha}°`, pass:cone_alpha<=30},
    {l:`Hydrotest P_ht ${P_ht.toFixed(3)} ≤ 1.5×P_d`, v:`${P_ht.toFixed(3)} MPa`, pass:P_ht<=1.5*Pd_code},
    {l:'Relief valve area calculated', v:`${A_psv_cm2.toFixed(2)} cm² — Orifice ${psv_orifice}`, pass:A_psv_cm2>0},
    {l:'Capital cost estimated', v:CBM>0?`$${CBM.toFixed(0)}`:'skipped', pass:CBM>0||CEPCI===0},
  ]

  return {
    Pd_code,t_sc,t_sn,Do,MAWP_sh,P_ht,shell_OD,Ri,
    t_SE,t_SE_nom,MAWP_head,t_hemi,t_hemi_nom,t_tori,t_tori_nom,t_cone,t_flat,
    t_n1,t_n1_nom,A_req_n1,A_avail_n1,n1_ok,t_n2,A_req_n2,A_avail_n2,n2_ok,
    flange_MAWP,flange_ok,
    W_sh,W_heads,W_fluid,W_ins,W_empty,W_oper,W_htest,
    sigma_w:sigma_w2,sigma_b,sigma_skirt,skirt_ok,sigma_L,sigma_T,sad_bearing,saddle_ok,
    q_wind,M_wind,V_seismic,M_seismic,
    A_psv:A_psv_cm2,psv_orifice,P1_psv,
    CBM,checks
  }
}

// ── MIXER ─────────────────────────────────────────────────────────

serve(async (req) => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  try {
    const {simulatorId,inputs} = await req.json()
    let result:any={error:'Unknown simulator'}
    if(simulatorId==='heat-exchanger') result=calcHeatExchanger(inputs)
    else if(simulatorId==='reactor') result=calcReactor(inputs)
    else if(simulatorId==='pressure-vessel') result=calcPressureVessel(inputs)
    return new Response(JSON.stringify(result),{headers:{...cors,'Content-Type':'application/json'}})
  } catch(e:any) {
    return new Response(JSON.stringify({error:e.message}),{status:500,headers:{...cors,'Content-Type':'application/json'}})
  }
})
