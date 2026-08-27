import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── DISTILLATION ENGINE ───────────────────────────────────────────
function calcDistillation(p: any) {
  const { F,zF,Tf,Pcol,xD,xB,ALK,BLK,CLK,AHK,BHK,CHK,R,
    traySpacing,weirH,floodFrac,rhoL,rhoV,muL,sigma,lamLK,lamHK,
    mwLK,mwHK,CpL_LK,CpL_HK,Sallow,CA,Ejt,windSpeed,
    CEPCI,CEPCIbase,FBM,steamCost,CWcost,opHours,payback,maint,Pc_kPa,
    ap,Fp,sigmaC } = p

  if(xD<=xB||zF<=xB||zF>=xD||F<=0) return {error:'Invalid inputs: check xD > zF > xB'}

  const Psat=(A:number,B:number,C:number,T:number)=>Math.pow(10,A-B/(C+T))
  const STD_D=[0.45,0.60,0.75,0.90,1.05,1.20,1.50,1.80,2.10,2.40,3.00]
  const STD_T=[6,8,10,12,16,20,25,30]
  const nextStd=(arr:number[],v:number)=>arr.find(s=>s>=v)||arr[arr.length-1]
  const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v))

  const Pmm=Pcol*7.50062
  const al_t=Psat(ALK,BLK,CLK,Tf-10)/Psat(AHK,BHK,CHK,Tf-10)
  const al_b=Psat(ALK,BLK,CLK,Tf+15)/Psat(AHK,BHK,CHK,Tf+15)
  const al=Math.sqrt(al_t*al_b)
  const al_var=Math.abs(al_t-al_b)/al_t*100
  const T_bub=zF*(BLK/(ALK-Math.log10(Pmm))-CLK)+(1-zF)*(BHK/(AHK-Math.log10(Pmm))-CHK)
  const T_top=T_bub-5, T_bot=T_bub+18
  const MW=zF*mwLK+(1-zF)*mwHK
  const lamD=xD*lamLK+(1-xD)*lamHK
  const CpLD=xD*CpL_LK+(1-xD)*CpL_HK
  const CpLB=xB*CpL_LK+(1-xB)*CpL_HK

  const D=F*(zF-xB)/(xD-xB), B=F-D
  const LK_rec=D*xD/(F*zF)*100, HK_rec=B*(1-xB)/(F*(1-zF))*100
  const L=R*D, V=(R+1)*D, Ls=L+F, Vs=V

  const N_min=Math.log((xD/(1-xD))*((1-xB)/xB))/Math.log(al)
  let Rmin=al*xD/(al*zF-(al-1)*xD*zF)-1; Rmin=Math.max(Rmin,0.3)
  const Xg=Math.max((R-Rmin)/(R+1),0.001)
  const Yg=1-Math.exp((1+54.4*Xg)/(11+117.2*Xg)*(Xg-1)/Math.sqrt(Xg))
  const N_th=Math.max(N_min/(1-Math.max(Yg,0.01)),N_min+1)
  const E_OC=clamp((51-32.5*Math.log10(muL*al))/100,0.20,0.85)
  const N_act=Math.ceil(N_th/E_OC)

  const Vm=V*MW/1000/3600, Lm=L*MW/1000/3600
  const F_LV=(Lm/Vm)*Math.sqrt(rhoV/rhoL)
  const Csb=Math.max(0.025,(0.12-0.1*F_LV)*Math.pow(traySpacing/0.6,0.5))
  const u_fl=Csb*Math.pow(sigma/20,0.2)*Math.sqrt((rhoL-rhoV)/rhoV)
  const Qv=Vm/rhoV
  const A_net=Qv/Math.max(floodFrac*u_fl,0.0001)
  const D_calc=Math.sqrt(4*A_net/(1-0.12)/Math.PI)
  const D_std=nextStd(STD_D,D_calc)
  const u_hole=Qv/Math.max(0.10*0.88*Math.PI/4*D_std*D_std,1e-6)
  const h_dry=51/9.81*Math.pow(u_hole/0.70,2)*rhoV/rhoL
  const h_ow=750*Math.pow(Lm/Math.max(rhoL*0.77*D_std,0.001),0.667)
  const h_tray=h_dry+weirH+h_ow
  const H_col=N_act*traySpacing+4.7
  const HD=H_col/D_std

  // Packed
  const uL=0.005,uV=1.2
  const ReL=rhoL*uL/(ap*(muL/1000)), FrL=uL*uL*ap/9.81, WeL=uL*uL*rhoL/(sigma/1000*ap)
  const a_eff=ap*(1-Math.exp(-1.45*Math.pow(sigmaC/(sigma/1000),0.75)*Math.pow(Math.max(ReL,1e-9),0.1)*Math.pow(Math.max(FrL,1e-9),-0.05)*Math.pow(Math.max(WeL,1e-9),0.2)))
  const DV=3.2e-5,DL=0.033e-5,nuL=(muL/1000)/rhoL
  const kV=0.7*Math.pow(uV/(ap*0.021),0.333)*Math.pow((muL/1000)/(rhoV*DV),-0.5)/0.021*DV
  const kL=0.5*Math.pow(uL/ap,0.333)*Math.pow(DL/nuL,0.5)*Math.pow(ap,0.5)
  const m_eq=al/Math.pow(1+(al-1)*zF,2)
  const lam_s=m_eq*(Math.max(Vs,0.01)/Math.max(Ls,0.01))
  const HOG=uV/Math.max(kV*a_eff,1e-9)+uL/Math.max(kL*a_eff,1e-9)*(lam_s||1)
  const HETP=Math.abs(lam_s-1)<0.01?HOG:HOG*Math.log(Math.max(lam_s,0.01))/(lam_s-1)
  const Z_pack=N_th*Math.max(HETP,0.3)
  const u_fl_pk=Math.sqrt(0.07*9.81*(rhoL-rhoV)/(Fp*rhoV*Math.pow(muL,0.05)))
  const D_pk_std=nextStd(STD_D,Math.sqrt(4*(Vs*MW/1000/3600)/Math.max(rhoV*0.70*u_fl_pk,0.001)/Math.PI))

  // Energy
  const QC=D*(R+1)*lamD/3600/1000
  const QR=Math.max(QC+(D*CpLD*(T_top-25)+B*CpLB*(T_bot-25)-F*(xD*CpL_LK+(1-xD)*CpL_HK)*(Tf-25))*1000/3600/1000,QC*1.03)
  const T_stm=151.8,lam_stm=2108
  const mdot_stm=QR/lam_stm*3600
  const mdot_CW=QC*1000/(4180*15)
  const LMTD_c=(T_top-40-T_top+25)/Math.log(Math.abs((T_top-40)/(T_top-25)))
  const A_cond=QC*1000/(700*Math.max(LMTD_c,1))*1.2
  const Pc_bar=Pc_kPa/100, Pr=Pcol/100/Pc_bar
  const Fp_m=1.8*Math.pow(Pr,0.17)+4*Math.pow(Pr,1.2)+10*Math.pow(Pr,10)
  const q_fl=QR*1000/Math.max(QR*0.5,5)
  const h_nb=0.00417*Math.pow(Pc_bar,0.69)*Math.pow(q_fl,0.7)*Fp_m
  const A_reb=QR*1000/Math.max(h_nb*10,1)

  // Mechanical
  const Pd=Math.max(1.1*Pcol/1000,Pcol/1000+0.175)
  const Ri=D_std*1000/2
  const t_sc=Pd*Ri/(Sallow*Ejt-0.6*Pd)+CA
  const t_sn=nextStd(STD_T,Math.max(t_sc,D_std<1?6:8))
  const Do=D_std*1000+2*t_sn
  const MAWP=Sallow*Ejt*(t_sn-CA)/(Ri+0.6*(t_sn-CA))
  const t_hn=nextStd(STD_T,Pd*D_std*1000/(2*Sallow*Ejt-0.2*Pd)+CA)
  const W_sh=7850*Math.PI*D_std*(H_col+0.8*D_std)*t_sn/1000
  const W_tr=1200*Math.PI/4*D_std*D_std*N_act
  const W_in=Math.PI*D_std*H_col*(75/1000)*80
  const W_tot=W_sh+W_tr+W_in
  const sw=W_tot*9.81/(Math.PI*D_std*(t_sn/1000)*1e6)
  const Mw=0.5*1.225*windSpeed*windSpeed*0.7*(Do/1000)*H_col*H_col/2/1000
  const I_v=Math.PI/64*(Math.pow(Do/1000,4)-Math.pow(D_std,4))
  const sb=Mw*1000*(Do/1000/2)/I_v/1e6

  // Economics
  const Esc=CEPCI/CEPCIbase
  const Ash=Math.PI*D_std*(H_col+0.8*D_std)
  const Cp_sh=Math.exp(3.4974+0.4485*Math.log(Math.max(Ash,0.1))+0.1074*Math.pow(Math.log(Math.max(Ash,0.1)),2))*Esc
  const CBM_sh=FBM*Cp_sh
  const Cp_cn=Math.exp(4.3247-0.303*Math.log(Math.max(A_cond,0.5))+0.1634*Math.pow(Math.log(Math.max(A_cond,0.5)),2))*Esc
  const CBM_cn=3.17*Cp_cn
  const Cp_rb=Math.exp(4.3247-0.303*Math.log(Math.max(A_reb,0.5))+0.1634*Math.pow(Math.log(Math.max(A_reb,0.5)),2))*Esc
  const CBM_rb=3.17*Cp_rb
  const CAPEX=CBM_sh+CBM_cn+CBM_rb
  const OPEX=mdot_stm*steamCost*opHours+mdot_CW/1000*3600*CWcost*opHours+maint*CAPEX
  const TAC=CAPEX/payback+OPEX

  const sr=R/(R+1), ir=xD/(R+1), ss=Ls/Vs, is2=xB*(1-ss)
  const xq=zF, yq=sr*xq+ir

  const R_mults=[1.1,1.2,1.3,1.5,1.8,2.0]
  const rSens=R_mults.map(k=>{
    const Rv=k*Rmin
    const Xr=Math.max((Rv-Rmin)/(Rv+1),0.001)
    const Yr=1-Math.exp((1+54.4*Xr)/(11+117.2*Xr)*(Xr-1)/Math.sqrt(Xr))
    const Ntr=Math.max(N_min/(1-Math.max(Yr,0.01)),N_min+1)
    const QCr=D*(Rv+1)*lamD/3600/1000
    return {R:+Rv.toFixed(2),mult:k,N:+Ntr.toFixed(1),QC:+QCr.toFixed(1),OPEX:+(QCr*1.05/lam_stm*3600*steamCost*opHours/1000).toFixed(1)}
  })

  const checks=[
    {l:'α_avg > 1.05',pass:al>1.05,v:`α = ${al.toFixed(2)}`},
    {l:'R ≥ 1.1 × R_min',pass:R>=1.1*Rmin,v:`R/Rmin = ${(R/Rmin).toFixed(2)}`},
    {l:'N_theoretical ≥ 3',pass:N_th>=3,v:`N = ${N_th.toFixed(1)}`},
    {l:'Tray efficiency 20–85%',pass:E_OC>=0.2&&E_OC<=0.85,v:`E = ${(E_OC*100).toFixed(1)}%`},
    {l:'Flood fraction ≤ 85%',pass:floodFrac<=0.85,v:`${(floodFrac*100).toFixed(0)}%`},
    {l:'D_col ≥ 0.3 m',pass:D_std>=0.3,v:`D = ${D_std.toFixed(2)} m`},
    {l:'H/D < 30',pass:HD<30,v:`H/D = ${HD.toFixed(1)}`},
    {l:'t_shell ≥ t_calc (UG-27)',pass:t_sn>=t_sc,v:`${t_sn} ≥ ${t_sc.toFixed(1)} mm`},
    {l:'MAWP ≥ P_design',pass:MAWP>=Pd,v:`${MAWP.toFixed(2)} ≥ ${Pd.toFixed(3)} MPa`},
    {l:'σ_b + σ_w ≤ S_allow',pass:(sb+sw)<=Sallow,v:`${(sb+sw).toFixed(1)} ≤ ${Sallow} MPa`},
  ]

  return {
    alpha_top:+al_t.toFixed(3),alpha_bot:+al_b.toFixed(3),alpha_avg:+al.toFixed(3),alpha_var:+al_var.toFixed(1),
    T_bub:+T_bub.toFixed(1),T_dew:+(T_bub+5).toFixed(1),T_top:+T_top.toFixed(1),T_bot:+T_bot.toFixed(1),
    lam_mixD:+lamD.toFixed(0),MW_avg:+MW.toFixed(2),
    D:+D.toFixed(2),B:+B.toFixed(2),LK_rec:+LK_rec.toFixed(1),HK_rec:+HK_rec.toFixed(1),
    L_rect:+L.toFixed(1),V_rect:+V.toFixed(1),L_strip:+Ls.toFixed(1),V_strip:+Vs.toFixed(1),
    N_min:+N_min.toFixed(1),Rmin:+Rmin.toFixed(3),Xg:+Xg.toFixed(4),Yg:+Yg.toFixed(4),
    N_th:+N_th.toFixed(1),E_OC:+E_OC.toFixed(3),N_act,N_feed:Math.round(N_th/2),
    F_LV:+F_LV.toFixed(4),u_flood:+u_fl.toFixed(3),u_net:+(floodFrac*u_fl).toFixed(3),
    D_calc:+D_calc.toFixed(3),D_std,h_dry:+h_dry.toFixed(1),h_ow:+h_ow.toFixed(1),
    h_tray:+h_tray.toFixed(1),dP_col_kPa:+(h_tray*rhoL*9.81/1000*N_act/1000).toFixed(2),
    H_col:+H_col.toFixed(1),HD_ratio:+HD.toFixed(1),
    a_eff:+a_eff.toFixed(1),HOG:+HOG.toFixed(3),HETP:+HETP.toFixed(3),
    Z_pack:+Z_pack.toFixed(1),D_pk_std,lam_strip:+lam_s.toFixed(3),
    QC:+QC.toFixed(2),QR:+QR.toFixed(2),T_steam:+T_stm.toFixed(1),lam_steam:lam_stm,
    mdot_steam_h:+mdot_stm.toFixed(1),m3_CW_h:+(mdot_CW/1000*3600).toFixed(2),
    LMTD_c:+LMTD_c.toFixed(1),A_cond:+A_cond.toFixed(1),h_nb:+h_nb.toFixed(0),A_reb:+A_reb.toFixed(1),
    Pd:+Pd.toFixed(3),t_sc:+t_sc.toFixed(2),t_sn,Do:+Do.toFixed(0),MAWP:+MAWP.toFixed(3),t_hn,
    W_shell:+W_sh.toFixed(0),W_trays:+W_tr.toFixed(0),W_total:+W_tot.toFixed(0),
    sigma_b:+sb.toFixed(2),sigma_w:+sw.toFixed(2),M_wind:+Mw.toFixed(1),
    A_shell_m2:+Ash.toFixed(1),CBM_shell:+CBM_sh.toFixed(0),CBM_cond:+CBM_cn.toFixed(0),
    CBM_reb:+CBM_rb.toFixed(0),CAPEX:+CAPEX.toFixed(0),OPEX_total:+OPEX.toFixed(0),TAC:+TAC.toFixed(0),
    slope_rect:+sr.toFixed(4),int_rect:+ir.toFixed(4),slope_strip:+ss.toFixed(4),int_strip:+is2.toFixed(4),
    xq:+xq.toFixed(3),yq:+yq.toFixed(3),rSens,checks,
  }
}

// ── HEAT EXCHANGER ENGINE ─────────────────────────────────────────
function calcHeatExchanger(p: any) {
  const {Ds,Bs,Bc,Pt,Nb,do:do_,di,L,Nt,passes,kw,dNs,dNt,
    ms,Ts_in,Ts_out,rhos,mus,musw,ks,Cps,Rfs,
    mt,Tt_in,Tt_out,rhot,mut,mutw,kt,Cpt,Rft,
    ut_max,us_max,dPt_max,dPs_max,Pd_mech,Sallow,CA,Ew,FBM,CEPCI,CEPCIbase,
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
  const STD=[6,8,10,12,16,20,25];const t_shell=STD.find(t=>t>=t_sc)||25
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

  const profile=Array.from({length:11},(_,i)=>({pos:i*10,hot:+(Ts_in-i/10*(Ts_in-Ts_out)).toFixed(1),cold:+(Tt_out-i/10*(Tt_out-Tt_in)).toFixed(1)}))

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
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { simulatorId, inputs } = await req.json()
    let result: any = { error: 'Unknown simulator' }
    if (simulatorId === 'distillation') result = calcDistillation(inputs)
    else if (simulatorId === 'heat-exchanger') result = calcHeatExchanger(inputs)
    else if (simulatorId === 'reactor') result = calcReactor(inputs)
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
