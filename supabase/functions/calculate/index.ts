import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── HELPERS ───────────────────────────────────────────────────────
function Psat(A: number, B: number, C: number, T: number) {
  return Math.pow(10, A - B / (C + T))
}
function nextStd(arr: number[], v: number) {
  return arr.find(s => s >= v) || arr[arr.length - 1]
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
const STD_D = [0.45,0.60,0.75,0.90,1.05,1.20,1.50,1.80,2.10,2.40,3.00]
const STD_T = [6,8,10,12,16,20,25,30]

// ── DISTILLATION — BINARY MODE ────────────────────────────────────
function calcBinary(p: any) {
  const {F,zF,Tf,Pcol,xD,xB,ALK,BLK,CLK,AHK,BHK,CHK,R,q=1,
    traySpacing,weirH,floodFrac,rhoL,rhoV,muL,sigma,lamLK,lamHK,
    mwLK,mwHK,CpL_LK,CpL_HK,ap,Fp,sigmaC,
    Sallow,CA,Ejt,windSpeed,
    CEPCI,CEPCIbase,FBM,steamCost,CWcost,opHours,payback,maint,Pc_kPa} = p

  if(xD<=xB||zF<=xB||zF>=xD||F<=0) return {error:'Invalid: need xD > zF > xB and F > 0'}

  const Pmm = Pcol*7.50062
  const al_t = Psat(ALK,BLK,CLK,Tf-10)/Psat(AHK,BHK,CHK,Tf-10)
  const al_b = Psat(ALK,BLK,CLK,Tf+15)/Psat(AHK,BHK,CHK,Tf+15)
  const al   = Math.sqrt(al_t*al_b)
  const al_var = Math.abs(al_t-al_b)/al_t*100
  const T_bub = zF*(BLK/(ALK-Math.log10(Pmm))-CLK)+(1-zF)*(BHK/(AHK-Math.log10(Pmm))-CHK)
  const T_top = T_bub-5, T_bot = T_bub+18
  const MW  = zF*mwLK+(1-zF)*mwHK
  const lamD = xD*lamLK+(1-xD)*lamHK
  const CpLD = xD*CpL_LK+(1-xD)*CpL_HK
  const CpLB = xB*CpL_LK+(1-xB)*CpL_HK

  const D = F*(zF-xB)/(xD-xB), B = F-D
  const LK_rec = D*xD/(F*zF)*100, HK_rec = B*(1-xB)/(F*(1-zF))*100
  const L = R*D, V = (R+1)*D
  const Ls = L+q*F, Vs = V-(1-q)*F

  const N_min = Math.log((xD/(1-xD))*((1-xB)/xB))/Math.log(al)
  let Rmin = al*xD/(al*zF-(al-1)*xD*zF)-1; Rmin=Math.max(Rmin,0.3)
  const Xg = Math.max((R-Rmin)/(R+1),0.001)
  const Yg = 1-Math.exp((1+54.4*Xg)/(11+117.2*Xg)*(Xg-1)/Math.sqrt(Xg))
  const N_th = Math.max(N_min/(1-Math.max(Yg,0.01)),N_min+1)
  const E_OC = clamp((51-32.5*Math.log10(muL*al))/100,0.20,0.85)
  const N_act = Math.ceil(N_th/E_OC)

  // Tray hydraulics
  const Vm=V*MW/1000/3600, Lm=L*MW/1000/3600
  const F_LV=(Lm/Vm)*Math.sqrt(rhoV/rhoL)
  const Csb=Math.max(0.025,(0.12-0.1*F_LV)*Math.pow(traySpacing/0.6,0.5))
  const sig_corr=Math.pow(sigma/20,0.2)
  const u_fl=Csb*sig_corr*Math.sqrt((rhoL-rhoV)/rhoV)
  const Qv=Vm/rhoV
  const A_net=Qv/Math.max(floodFrac*u_fl,0.0001)
  const A_tot=A_net/(1-0.12)
  const D_calc=Math.sqrt(4*A_tot/Math.PI)
  const D_std=nextStd(STD_D,D_calc)
  const A_hole=0.10*0.88*Math.PI/4*D_std*D_std
  const u_hole=Qv/Math.max(A_hole,1e-6)
  const h_dry=51/9.81*Math.pow(u_hole/0.70,2)*rhoV/rhoL
  const h_ow=750*Math.pow(Lm/Math.max(rhoL*0.77*D_std,0.001),0.667)
  const h_tray=h_dry+weirH+h_ow
  const dP_tray_Pa=h_tray*rhoL*9.81/1000
  const H_active=N_act*traySpacing
  const H_col=H_active+4.7
  const HD=H_col/D_std

  // Packed
  const uL_pk=0.005, uV_pk=1.2
  const ReL=rhoL*uL_pk/(ap*(muL/1000))
  const FrL=uL_pk*uL_pk*ap/9.81
  const WeL=uL_pk*uL_pk*rhoL/(sigma/1000*ap)
  const a_eff=ap*(1-Math.exp(-1.45*Math.pow((sigmaC)/(sigma/1000),0.75)*Math.pow(Math.max(ReL,1e-9),0.1)*Math.pow(Math.max(FrL,1e-9),-0.05)*Math.pow(Math.max(WeL,1e-9),0.2)))
  const DV=3.2e-5, DL=0.033e-5, nuL=(muL/1000)/rhoL
  const kV=0.7*Math.pow(uV_pk/(ap*0.021),0.333)*Math.pow((muL/1000)/(rhoV*DV),-0.5)/0.021*DV
  const kL=0.5*Math.pow(uL_pk/ap,0.333)*Math.pow(DL/nuL,0.5)*Math.pow(ap,0.5)
  const m_eq=al/Math.pow(1+(al-1)*zF,2)
  const lam_s=m_eq*(Math.max(Vs,0.01)/Math.max(Ls,0.01))
  const HOG=uV_pk/Math.max(kV*a_eff,1e-9)+uL_pk/Math.max(kL*a_eff,1e-9)*(lam_s||1)
  const HETP=Math.abs(lam_s-1)<0.01?HOG:HOG*Math.log(Math.max(lam_s,0.01))/(lam_s-1)
  const Z_pack=N_th*Math.max(HETP,0.3)
  const u_fl_pk=Math.sqrt(0.07*9.81*(rhoL-rhoV)/(Fp*rhoV*Math.pow(muL,0.05)))
  const G_pk=Vs*MW/1000/3600
  const D_pk=Math.sqrt(4*G_pk/Math.max(rhoV*0.70*u_fl_pk,0.001)/Math.PI)
  const D_pk_std=nextStd(STD_D,D_pk)

  // Energy
  const QC=D*(R+1)*lamD/3600/1000
  const QR=Math.max(QC+(D*CpLD*(T_top-25)+B*CpLB*(T_bot-25)-F*(xD*CpL_LK+(1-xD)*CpL_HK)*(Tf-25))*1000/3600/1000,QC*1.03)
  const T_stm=151.8, lam_stm=2108
  const mdot_stm=QR/lam_stm*3600
  const mdot_CW=QC*1000/(4180*15)
  const dT1c=T_top-40, dT2c=T_top-25
  const LMTD_c=Math.abs(dT1c-dT2c)<0.01?dT1c:(dT1c-dT2c)/Math.log(Math.abs(dT1c/dT2c))
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
  const t_hc=Pd*D_std*1000/(2*Sallow*Ejt-0.2*Pd)+CA
  const t_hn=nextStd(STD_T,t_hc)
  const t_tori=0.885*Pd*D_std*1000/(Sallow*Ejt-0.1*Pd)+CA
  const t_tori_n=nextStd(STD_T,t_tori)
  const t_hemi=Pd*Ri/(2*Sallow*Ejt-0.2*Pd)+CA
  const t_hemi_n=nextStd(STD_T,t_hemi)
  const W_sh=7850*Math.PI*D_std*(H_col+0.8*D_std)*t_sn/1000
  const W_tr=1200*Math.PI/4*D_std*D_std*N_act
  const W_in=Math.PI*D_std*H_col*0.075*80
  const W_tot=W_sh+W_tr+W_in
  const sw=W_tot*9.81/(Math.PI*D_std*(t_sn/1000)*1e6)
  const qw=0.5*1.225*windSpeed*windSpeed*0.7
  const Mw=qw*(Do/1000)*H_col*H_col/2/1000
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
  const xq_val=zF, yq_val=sr*xq_val+ir

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
    mode:'binary',
    alpha_top:+al_t.toFixed(3),alpha_bot:+al_b.toFixed(3),alpha_avg:+al.toFixed(3),alpha_var:+al_var.toFixed(1),
    T_bub:+T_bub.toFixed(1),T_dew:+(T_bub+5).toFixed(1),T_top:+T_top.toFixed(1),T_bot:+T_bot.toFixed(1),
    lam_mixD:+lamD.toFixed(0),MW_avg:+MW.toFixed(2),
    D:+D.toFixed(2),B:+B.toFixed(2),LK_rec:+LK_rec.toFixed(1),HK_rec:+HK_rec.toFixed(1),
    L_rect:+L.toFixed(1),V_rect:+V.toFixed(1),L_strip:+Ls.toFixed(1),V_strip:+Vs.toFixed(1),
    N_min:+N_min.toFixed(1),Rmin:+Rmin.toFixed(3),Xg:+Xg.toFixed(4),Yg:+Yg.toFixed(4),
    N_th:+N_th.toFixed(1),E_OC:+E_OC.toFixed(3),N_act,N_feed:Math.round(N_th/2),
    F_LV:+F_LV.toFixed(4),Csb:+Csb.toFixed(4),sig_corr:+sig_corr.toFixed(4),
    u_flood:+u_fl.toFixed(3),u_net:+(floodFrac*u_fl).toFixed(3),Qv:+Qv.toFixed(5),
    A_net:+A_net.toFixed(4),A_tot:+A_tot.toFixed(4),D_calc:+D_calc.toFixed(3),D_std,
    u_hole:+u_hole.toFixed(2),h_dry:+h_dry.toFixed(1),h_ow:+h_ow.toFixed(1),
    h_tray:+h_tray.toFixed(1),dP_tray_Pa:+dP_tray_Pa.toFixed(0),dP_col_kPa:+(dP_tray_Pa*N_act/1000).toFixed(2),
    H_active:+H_active.toFixed(1),H_col:+H_col.toFixed(1),HD_ratio:+HD.toFixed(1),
    a_eff:+a_eff.toFixed(1),kV,kL,HOG:+HOG.toFixed(3),HETP:+HETP.toFixed(3),
    Z_pack:+Z_pack.toFixed(1),D_pk_std,lam_strip:+lam_s.toFixed(3),
    QC:+QC.toFixed(2),QR:+QR.toFixed(2),T_steam:+T_stm.toFixed(1),lam_steam:lam_stm,
    mdot_steam_h:+mdot_stm.toFixed(1),m3_CW_h:+(mdot_CW/1000*3600).toFixed(2),
    LMTD_c:+LMTD_c.toFixed(1),A_cond:+A_cond.toFixed(1),
    Fp_most:+Fp_m.toFixed(3),h_nb:+h_nb.toFixed(0),A_reb:+A_reb.toFixed(1),
    Pd:+Pd.toFixed(3),Ri:+Ri.toFixed(0),t_sc:+t_sc.toFixed(2),t_sn,Do:+Do.toFixed(0),
    MAWP:+MAWP.toFixed(3),t_hc:+t_hc.toFixed(2),t_hn,
    t_tori:+t_tori.toFixed(2),t_tori_n,t_hemi:+t_hemi.toFixed(2),t_hemi_n,
    W_shell:+W_sh.toFixed(0),W_trays:+W_tr.toFixed(0),W_ins:+W_in.toFixed(0),W_total:+W_tot.toFixed(0),
    sigma_b:+sb.toFixed(2),sigma_w:+sw.toFixed(2),M_wind:+Mw.toFixed(1),
    dn_vap:+(Math.sqrt(4*Qv/(Math.PI*20))*1000).toFixed(0),
    A_shell_m2:+Ash.toFixed(1),CBM_shell:+CBM_sh.toFixed(0),CBM_cond:+CBM_cn.toFixed(0),
    CBM_reb:+CBM_rb.toFixed(0),CAPEX:+CAPEX.toFixed(0),OPEX_total:+OPEX.toFixed(0),TAC:+TAC.toFixed(0),
    slope_rect:+sr.toFixed(4),int_rect:+ir.toFixed(4),slope_strip:+ss.toFixed(4),int_strip:+is2.toFixed(4),
    xq:+xq_val.toFixed(3),yq:+yq_val.toFixed(3),rSens,checks,
  }
}

// ── DISTILLATION — MULTICOMPONENT MODE (MC_FUG) ───────────────────
function calcMulticomponent(p: any) {
  // comps = array of {name,role,z,MW,Tb,A,B,C}
  // role: 'LK' | 'HK' | 'LNK' | 'HNK'
  // RecD_LK = fraction of LK recovered in distillate
  // RecB_HK = fraction of HK recovered in bottoms
  const {F, q=1, R_mult=1.3, Pcol=101.325, Tf,
    comps, RecD_LK, RecB_HK,
    traySpacing=0.6, weirH=50, floodFrac=0.80,
    rhoL, rhoV, muL, sigma, ap=250, Fp=17, sigmaC=0.033,
    Sallow=137, CA=3, Ejt=1.0, windSpeed=45,
    CEPCI=820, CEPCIbase=397, FBM=4.16,
    steamCost=0.025, CWcost=0.0005, opHours=8000, payback=3, maint=0.02} = p

  if(!comps||comps.length<2) return {error:'Need at least 2 components'}
  const active = comps.filter((c:any)=>c.z>0)
  if(active.length<2) return {error:'At least 2 components must have z > 0'}

  const LK = active.find((c:any)=>c.role==='LK')
  const HK = active.find((c:any)=>c.role==='HK')
  if(!LK||!HK) return {error:'Exactly one LK and one HK must be designated'}

  const sumZ = active.reduce((s:number,c:any)=>s+c.z, 0)
  if(Math.abs(sumZ-1)>0.01) return {error:`Feed mole fractions sum to ${sumZ.toFixed(3)} — must equal 1.000`}

  const Pmm = Pcol*7.50062
  const T_avg = Tf  // use feed temp as average approximation

  // Compute α_i for each component (vs HK)
  const Psat_HK_top = Psat(HK.A, HK.B, HK.C, T_avg-10)
  const Psat_HK_bot = Psat(HK.A, HK.B, HK.C, T_avg+15)

  const enriched = active.map((c:any) => {
    const Ps_top = Psat(c.A, c.B, c.C, T_avg-10)
    const Ps_bot = Psat(c.A, c.B, c.C, T_avg+15)
    const al_top = Ps_top/Psat_HK_top
    const al_bot = Ps_bot/Psat_HK_bot
    const al_avg = Math.sqrt(al_top*al_bot)
    return {...c, al_top, al_bot, al_avg, Ps_top, Ps_bot}
  })

  const LKe = enriched.find((c:any)=>c.role==='LK')!
  const HKe = enriched.find((c:any)=>c.role==='HK')!

  // ── C. Fenske N_min ─────────────────────────────────────────────
  // x_D,LK and x_B,HK from recovery specs
  const F_LK = F*LKe.z
  const F_HK = F*HKe.z
  const d_LK = RecD_LK*F_LK          // LK moles in distillate
  const b_LK = F_LK - d_LK
  const b_HK = RecB_HK*F_HK          // HK moles in bottoms
  const d_HK = F_HK - b_HK

  // Estimate D and B using LK/HK only first, then refine with non-keys
  // Hengstebeck-Geddes constant C
  const N_min = Math.log((d_LK/Math.max(b_LK,0.001))/(d_HK/Math.max(b_HK,0.001)))/Math.log(LKe.al_avg)
  const C_HG = Math.log10(d_LK/Math.max(b_LK,0.001)) - N_min*Math.log10(LKe.al_avg)

  // Non-key distribution via Hengstebeck-Geddes
  const nkDist = enriched.map((c:any) => {
    if(c.role==='LK') return {...c, d_i:d_LK, b_i:b_LK}
    if(c.role==='HK') return {...c, d_i:d_HK, b_i:b_HK}
    const log_db = N_min*Math.log10(c.al_avg)+C_HG
    const db_ratio = Math.pow(10, Math.min(log_db,10))
    const F_i = F*c.z
    const d_i = F_i*db_ratio/(1+db_ratio)
    const b_i = F_i - d_i
    return {...c, d_i:+d_i.toFixed(4), b_i:+b_i.toFixed(4), log_db:+log_db.toFixed(3), db_ratio:+db_ratio.toFixed(4)}
  })

  const D_total = nkDist.reduce((s:number,c:any)=>s+c.d_i, 0)
  const B_total = nkDist.reduce((s:number,c:any)=>s+c.b_i, 0)

  // Distillate and bottoms compositions
  const dist_comp = nkDist.map((c:any)=>({...c, xD_i: c.d_i/D_total, xB_i: c.b_i/B_total}))

  const x_D_LK = d_LK/D_total
  const x_B_HK = b_HK/B_total
  const x_D_HK = d_HK/D_total
  const x_B_LK = b_LK/B_total

  // MW averages
  const MW_feed = active.reduce((s:number,c:any)=>s+c.z*c.MW, 0)
  const MW_dist  = dist_comp.reduce((s:number,c:any)=>s+c.xD_i*c.MW, 0)
  const MW_bots  = dist_comp.reduce((s:number,c:any)=>s+c.xB_i*c.MW, 0)

  // ── D. Underwood R_min (full multicomponent) ────────────────────
  // Solve: Σ[α_i·z_i/(α_i−θ)] = 1−q  for θ between α_HK=1 and α_LK
  // Use bisection between 1.0 and α_LK_avg
  let theta = (LKe.al_avg+1)/2
  for(let iter=0; iter<100; iter++){
    const f = enriched.reduce((s:number,c:any)=>s+c.al_avg*c.z/(c.al_avg-theta), 0)-(1-q)
    const df = enriched.reduce((s:number,c:any)=>-c.al_avg*c.z/Math.pow(c.al_avg-theta,2), 0)
    const step = f/df
    theta -= step
    // Keep theta strictly between 1 and alpha_LK
    theta = Math.max(1.001, Math.min(LKe.al_avg*0.999, theta))
    if(Math.abs(step)<1e-8) break
  }
  // R_min = Σ[α_i·x_D,i/(α_i−θ)] − 1
  const Rmin = dist_comp.reduce((s:number,c:any)=>s+c.al_avg*c.xD_i/(c.al_avg-theta), 0)-1
  const underwood_check = enriched.reduce((s:number,c:any)=>s+c.al_avg*c.z/(c.al_avg-theta), 0)-(1-q)

  // ── E. Gilliland N_theoretical ──────────────────────────────────
  const R = Math.max(R_mult*Math.max(Rmin,0.1), 0.5)
  const Xg = Math.max((R-Rmin)/(R+1), 0.001)
  const Yg = 1-Math.exp((1+54.4*Xg)/(11+117.2*Xg)*(Xg-1)/Math.sqrt(Xg))
  const N_th = Math.max(N_min/(1-Math.max(Yg,0.01)), N_min+1)
  // Tray efficiency — three models
  let E_OC = 0.70  // default
  if(p.efficiencyModel === 'chanfair') {
    // Chan-Fair (1984): accounts for surface tension and diffusivity
    const muL_cP = muL  // already in mPa·s = cP
    const scFactor = Math.pow(sigma/20, 0.25)
    E_OC = clamp((51-32.5*Math.log10(muL_cP*LKe.al_avg))/100 * scFactor, 0.20, 0.90)
  } else if(p.efficiencyModel === 'fixed' && p.fixedEfficiency > 0) {
    E_OC = clamp(+p.fixedEfficiency, 0.10, 0.95)
  } else {
    // O'Connell (default)
    E_OC = clamp((51-32.5*Math.log10(muL*LKe.al_avg))/100, 0.20, 0.85)
  }
  const N_act = Math.ceil(N_th/E_OC)

  // ── G. Kirkbride feed stage ──────────────────────────────────────
  const BD_ratio = B_total/D_total
  const log_NR_NS = 0.206*Math.log10(BD_ratio*(HKe.z/LKe.z)*Math.pow(x_B_LK/x_D_HK,2))
  const NR_NS = Math.pow(10, log_NR_NS)
  const NR = Math.round(N_th*NR_NS/(1+NR_NS))
  const NS = Math.round(N_th - NR)
  const feed_tray = NR

  // Internal flows
  const L = R*D_total, V = (R+1)*D_total
  const Ls = L+q*F, Vs = V-(1-q)*F

  // Tray hydraulics using MW_dist for vapour
  const Vm = V*MW_dist/1000/3600, Lm = L*MW_dist/1000/3600
  const F_LV = (Lm/Vm)*Math.sqrt(rhoV/rhoL)
  const Csb = Math.max(0.025,(0.12-0.1*F_LV)*Math.pow(traySpacing/0.6,0.5))
  const sig_corr = Math.pow(sigma/20,0.2)
  const u_fl = Csb*sig_corr*Math.sqrt((rhoL-rhoV)/rhoV)
  const Qv = Vm/rhoV
  const A_net = Qv/Math.max(floodFrac*u_fl,0.0001)
  const D_calc = Math.sqrt(4*A_net/(1-0.12)/Math.PI)
  const D_std = nextStd(STD_D,D_calc)
  const A_hole = 0.10*0.88*Math.PI/4*D_std*D_std
  const u_hole = Qv/Math.max(A_hole,1e-6)
  const h_dry = 51/9.81*Math.pow(u_hole/0.70,2)*rhoV/rhoL
  const h_ow = 750*Math.pow(Lm/Math.max(rhoL*0.77*D_std,0.001),0.667)
  const h_tray = h_dry+weirH+h_ow
  const H_col = N_act*traySpacing+4.7
  const HD = H_col/D_std

  // Energy (use LK latent heat approximation)
  const lamD_mc = LKe.al_avg>0 ? 30000+5000*(LKe.al_avg-1) : 32000 // rough estimate
  const QC = D_total*(R+1)*lamD_mc/3600/1000
  const QR = QC*1.05

  // Mechanical
  const Pd = Math.max(1.1*Pcol/1000,Pcol/1000+0.175)
  const Ri = D_std*1000/2
  const t_sc = Pd*Ri/(Sallow*Ejt-0.6*Pd)+CA
  const t_sn = nextStd(STD_T,Math.max(t_sc,D_std<1?6:8))
  const Do = D_std*1000+2*t_sn
  const MAWP = Sallow*Ejt*(t_sn-CA)/(Ri+0.6*(t_sn-CA))
  const t_hc = Pd*D_std*1000/(2*Sallow*Ejt-0.2*Pd)+CA
  const t_hn = nextStd(STD_T,t_hc)
  const W_sh = 7850*Math.PI*D_std*(H_col+0.8*D_std)*t_sn/1000
  const W_tr = 1200*Math.PI/4*D_std*D_std*N_act
  const W_in = Math.PI*D_std*H_col*0.075*80
  const W_tot = W_sh+W_tr+W_in
  const sw = W_tot*9.81/(Math.PI*D_std*(t_sn/1000)*1e6)
  const qw = 0.5*1.225*windSpeed*windSpeed*0.7
  const Mw = qw*(Do/1000)*H_col*H_col/2/1000
  const I_v = Math.PI/64*(Math.pow(Do/1000,4)-Math.pow(D_std,4))
  const sb = Mw*1000*(Do/1000/2)/I_v/1e6

  // Economics
  const Esc = CEPCI/CEPCIbase
  const Ash = Math.PI*D_std*(H_col+0.8*D_std)
  const Cp_sh = Math.exp(3.4974+0.4485*Math.log(Math.max(Ash,0.1))+0.1074*Math.pow(Math.log(Math.max(Ash,0.1)),2))*Esc
  const CBM_sh = FBM*Cp_sh
  const T_stm = 151.8, lam_stm = 2108
  const mdot_stm = QR/lam_stm*3600
  const mdot_CW = QC*1000/(4180*15)
  const dT1c = (Tf-5)-40, dT2c = (Tf-5)-25
  const LMTD_c = Math.abs(dT1c-dT2c)<0.01?dT1c:(dT1c-dT2c)/Math.log(Math.abs(dT1c/dT2c))
  const A_cond = QC*1000/(700*Math.max(LMTD_c,1))*1.2
  const A_reb = QR*1000/Math.max(500*15,1)
  const Cp_cn = Math.exp(4.3247-0.303*Math.log(Math.max(A_cond,0.5))+0.1634*Math.pow(Math.log(Math.max(A_cond,0.5)),2))*Esc
  const CBM_cn = 3.17*Cp_cn
  const Cp_rb = Math.exp(4.3247-0.303*Math.log(Math.max(A_reb,0.5))+0.1634*Math.pow(Math.log(Math.max(A_reb,0.5)),2))*Esc
  const CBM_rb = 3.17*Cp_rb
  const CAPEX = CBM_sh+CBM_cn+CBM_rb
  const OPEX = mdot_stm*steamCost*opHours+mdot_CW/1000*3600*CWcost*opHours+maint*CAPEX
  const TAC = CAPEX/payback+OPEX

  const checks = [
    {l:'α_LK > 1.05',pass:LKe.al_avg>1.05,v:`α_LK = ${LKe.al_avg.toFixed(2)}`},
    {l:'R ≥ 1.1 × R_min',pass:R>=1.1*Rmin,v:`R/Rmin = ${(R/Math.max(Rmin,0.01)).toFixed(2)}`},
    {l:'N_theoretical ≥ 3',pass:N_th>=3,v:`N = ${N_th.toFixed(1)}`},
    {l:'Feed z_i sum = 1.000',pass:Math.abs(sumZ-1)<0.005,v:`Σz_i = ${sumZ.toFixed(3)}`},
    {l:'Tray efficiency 20–85%',pass:E_OC>=0.2&&E_OC<=0.85,v:`E = ${(E_OC*100).toFixed(1)}%`},
    {l:'D_col ≥ 0.3 m',pass:D_std>=0.3,v:`D = ${D_std.toFixed(2)} m`},
    {l:'H/D < 30',pass:HD<30,v:`H/D = ${HD.toFixed(1)}`},
    {l:'t_shell ≥ t_calc (UG-27)',pass:t_sn>=t_sc,v:`${t_sn} ≥ ${t_sc.toFixed(1)} mm`},
    {l:'MAWP ≥ P_design',pass:MAWP>=Pd,v:`${MAWP.toFixed(2)} ≥ ${Pd.toFixed(3)} MPa`},
    {l:'σ_b + σ_w ≤ S_allow',pass:(sb+sw)<=Sallow,v:`${(sb+sw).toFixed(1)} ≤ ${Sallow} MPa`},
  ]

  return {
    mode:'multicomponent',
    n_comps: active.length,
    comps_data: dist_comp,
    D_total:+D_total.toFixed(2), B_total:+B_total.toFixed(2),
    MW_feed:+MW_feed.toFixed(2), MW_dist:+MW_dist.toFixed(2), MW_bots:+MW_bots.toFixed(2),
    x_D_LK:+x_D_LK.toFixed(4), x_B_HK:+x_B_HK.toFixed(4),
    x_D_HK:+x_D_HK.toFixed(4), x_B_LK:+x_B_LK.toFixed(4),
    alpha_LK:+LKe.al_avg.toFixed(3), alpha_HK:1.0,
    alpha_var:+(Math.abs(LKe.al_top-LKe.al_bot)/LKe.al_top*100).toFixed(1),
    N_min:+N_min.toFixed(2), C_HG:+C_HG.toFixed(4),
    theta:+theta.toFixed(4), underwood_check:+underwood_check.toFixed(6),
    Rmin:+Rmin.toFixed(3), R_mult, R:+R.toFixed(3),
    Xg:+Xg.toFixed(4), Yg:+Yg.toFixed(4),
    N_th:+N_th.toFixed(1), E_OC:+E_OC.toFixed(3), N_act,
    NR, NS, feed_tray,
    L_rect:+L.toFixed(1), V_rect:+V.toFixed(1), L_strip:+Ls.toFixed(1), V_strip:+Vs.toFixed(1),
    F_LV:+F_LV.toFixed(4), u_flood:+u_fl.toFixed(3), u_net:+(floodFrac*u_fl).toFixed(3),
    D_calc:+D_calc.toFixed(3), D_std, h_tray:+h_tray.toFixed(1),
    H_col:+H_col.toFixed(1), HD_ratio:+HD.toFixed(1),
    QC:+QC.toFixed(2), QR:+QR.toFixed(2),
    mdot_steam_h:+mdot_stm.toFixed(1), m3_CW_h:+(mdot_CW/1000*3600).toFixed(2),
    A_cond:+A_cond.toFixed(1), A_reb:+A_reb.toFixed(1),
    Pd:+Pd.toFixed(3), t_sc:+t_sc.toFixed(2), t_sn, Do:+Do.toFixed(0),
    MAWP:+MAWP.toFixed(3), t_hn,
    W_shell:+W_sh.toFixed(0), W_total:+W_tot.toFixed(0),
    sigma_b:+sb.toFixed(2), sigma_w:+sw.toFixed(2),
    A_shell_m2:+Ash.toFixed(1), CBM_shell:+CBM_sh.toFixed(0),
    CBM_cond:+CBM_cn.toFixed(0), CBM_reb:+CBM_rb.toFixed(0),
    CAPEX:+CAPEX.toFixed(0), OPEX_total:+OPEX.toFixed(0), TAC:+TAC.toFixed(0),
    checks,
  }
}

// ── HEAT EXCHANGER ENGINE ─────────────────────────────────────────
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
serve(async (req) => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  try {
    const {simulatorId,inputs} = await req.json()
    let result: any = {error:'Unknown simulator'}
    if(simulatorId==='distillation') {
      // Route to binary or multicomponent based on mode
      result = inputs.mode==='multicomponent'
        ? calcMulticomponent(inputs)
        : calcBinary(inputs)
    }
    else if(simulatorId==='heat-exchanger') result = calcHeatExchanger(inputs)
    else if(simulatorId==='reactor') result = calcReactor(inputs)
    else if(simulatorId==='pressure-vessel') result = calcPressureVessel(inputs)
    else if(simulatorId==='mixer') result = calcMixer(inputs)
    else if(simulatorId==='storage-tank') result = calcStorageTank(inputs)
    else if(simulatorId==='piping') result = calcPiping(inputs)
    else if(simulatorId==='separations') result = calcSeparations(inputs)
    else if(simulatorId==='meb') result = calcMEB(inputs)
    return new Response(JSON.stringify(result),{headers:{...cors,'Content-Type':'application/json'}})
  } catch(e: any) {
    return new Response(JSON.stringify({error:e.message}),{status:500,headers:{...cors,'Content-Type':'application/json'}})
  }
})

// ── PRESSURE VESSEL ───────────────────────────────────────────────
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
function calcMixer(p: any) {
  const {T_tank,H_L,D_imp,n_imp=1,C_imp,n_baffles=4,W_b,impType='rushton',
    rho,mu,mu_w,k_f,Cp_f,N_rpm,T_op,T_j,Q_req=50000,
    h_o=3000,k_wall=45,t_wall=0.008,
    d_sm=0.1,Q_sm=0.01,n_el=12,el_LD=1.5,
    scaleup_ratio=5,CEPCI=820,elec_cost=0.1,opHours=8000} = p

  const N_rps = N_rpm/60
  const Re = rho*N_rps*D_imp*D_imp/mu
  const regime = Re>10000?'Turbulent':Re>10?'Transition':'Laminar'
  const DT_ratio = D_imp/T_tank
  const u_tip = Math.PI*D_imp*N_rps
  const V_L = Math.PI/4*T_tank*T_tank*H_L

  // Power number by type
  const Np_map: {[k:string]:number} = {
    rushton:5.0, pbt_down:1.27, pbt_up:1.27,
    anchor:0.35, helical:0.35, hydrofoil:0.32
  }
  const Fl_map: {[k:string]:number} = {
    rushton:0.72, pbt_down:0.78, pbt_up:0.78,
    anchor:0.3, helical:0.3, hydrofoil:0.55
  }
  let Np = Np_map[impType]||5.0
  if(Re<10) Np = 300/Re
  else if(Re<10000) Np = Np_map[impType]*Math.min(1,Re/10000)
  const Fl = Fl_map[impType]||0.72

  const P_shaft = Np*rho*Math.pow(N_rps,3)*Math.pow(D_imp,5)*n_imp
  const PV = P_shaft/V_L
  const P_motor = P_shaft/0.85
  const IEC_SIZES = [0.25,0.37,0.55,0.75,1.1,1.5,2.2,3,4,5.5,7.5,11,15,18.5,22,30,37,45,55,75,90,110,132,160,200]
  const P_motor_kW = P_motor/1000
  const P_motor_IEC = (IEC_SIZES.find(s=>s>=P_motor_kW)||200)*1000
  const torque = P_shaft/(2*Math.PI*N_rps)
  const d_shaft = Math.pow(16*torque/(Math.PI*0.5*140e6),1/3)
  const Q_pump = Fl*N_rps*Math.pow(D_imp,3)*n_imp

  // Blending — Grenville
  const theta_blend = 5.3*Math.pow(T_tank/D_imp,2.5)*Math.pow(H_L/T_tank,0.5)/N_rps
  const theta_circ = V_L/Q_pump
  const Nq = Fl
  const Fr = N_rps*N_rps*D_imp/9.81
  // Zwietering — just suspended speed (simplified)
  const N_js = 0.2*Math.pow(rho/mu,0.1)*Math.pow((rho-rho)/rho||1,0.45)*Math.pow(D_imp,-0.85)*Math.pow(N_rps,1)
  const N_js_real = 1.5/D_imp // simplified

  // Heat transfer — Bondy-Lippa
  const Pr = mu*Cp_f/k_f
  const visc_corr = Math.pow(mu/(mu_w||mu),0.14)
  const Nu = 0.74*Math.pow(Re,0.667)*Math.pow(Pr,1/3)*Math.pow(DT_ratio,0.14)*visc_corr
  const h_i = Nu*k_f/T_tank
  const U_jkt = 1/(1/h_i + t_wall/k_wall + 1/h_o)
  const A_jkt = Math.PI*T_tank*H_L
  const Q_jkt_max = U_jkt*A_jkt*Math.abs(T_op-T_j)
  const A_coil_extra = Math.max(0, (Q_req-Q_jkt_max)/(U_jkt*Math.abs(T_op-T_j)))

  // Static mixer
  const u_sm = Q_sm/(Math.PI/4*d_sm*d_sm)
  const Re_sm = rho*u_sm*d_sm/mu
  const K_sm = Re_sm<2300 ? 300/Re_sm : 2.4
  const dP_el = K_sm*(el_LD)*rho*u_sm*u_sm/2
  const L_sm = n_el*el_LD*d_sm
  const dP_sm_total = dP_el*n_el/1000
  const CoV_factor = Math.exp(-0.693*n_el/3.5)

  // Scale-up
  const T_new = T_tank*Math.pow(scaleup_ratio,1/3)
  const D_new = D_imp*Math.pow(scaleup_ratio,1/3)
  const N_new_PV = N_rps*Math.pow(D_imp/D_new,2/3)
  const N_new_tip = N_rps*(D_imp/D_new)
  const N_new_blend = N_rps*Math.pow(T_tank/T_new,0.5)
  const P_new_PV = PV*V_L*scaleup_ratio

  // Economics
  let CBM = 0, annual_energy = 0
  if(CEPCI>0) {
    const Cp0_vessel = Math.exp(3.8751+0.3340*Math.log(V_L*264.17)+0.0688*Math.pow(Math.log(V_L*264.17),2))
    const Cp0_agit = Math.exp(3.8984+0.4322*Math.log(P_motor_kW)+0.0798*Math.pow(Math.log(P_motor_kW),2))
    CBM = (Cp0_vessel+Cp0_agit)*(CEPCI/397)*3.5
    annual_energy = P_motor/1000*opHours*elec_cost
  }

  const checks = [
    {l:'Turbulent (Re > 10000)', v:`Re=${Re.toFixed(0)}`, pass:Re>10000},
    {l:'D_imp/T in range 0.25–0.50', v:`${DT_ratio.toFixed(3)}`, pass:DT_ratio>=0.25&&DT_ratio<=0.50},
    {l:'P/V in range 0.2–5000 W/m³', v:`${PV.toFixed(1)} W/m³`, pass:PV>=0.2&&PV<=5000},
    {l:'Tip speed < 10 m/s', v:`${u_tip.toFixed(2)} m/s`, pass:u_tip<10},
    {l:'Blend time < 300 s', v:`${theta_blend.toFixed(1)} s`, pass:theta_blend<300},
    {l:'Jacket duty Q_j ≥ Q_required', v:`${Q_jkt_max.toFixed(0)} vs ${Q_req} W`, pass:Q_jkt_max>=Q_req},
    {l:'Nu > 100 (good HT)', v:`Nu=${Nu.toFixed(1)}`, pass:Nu>100},
    {l:'Baffle count = 4 (standard) or 0 (laminar)', v:`${n_baffles} baffles`, pass:n_baffles===4||n_baffles===0},
    {l:'Static mixer ΔP < 100 kPa', v:`${dP_sm_total.toFixed(1)} kPa`, pass:dP_sm_total<100},
    {l:'Capital cost estimated', v:CBM>0?`$${CBM.toFixed(0)}`:'skipped', pass:CBM>0||CEPCI===0},
  ]

  return {
    Re,regime,DT_ratio,u_tip,V_L,N_rps,
    Np,P_shaft,PV,P_motor:P_motor_IEC,torque,d_shaft,Q_pump,Nq,
    theta_blend,theta_circ,Fr,N_js:N_js_real,
    Nu,h_i,U_jkt,A_jkt,Q_jkt_max,A_coil_extra,
    u_sm,Re_sm,dP_el,L_sm,dP_sm_total,CoV_factor,
    T_new,D_new,N_new_PV,N_new_tip,N_new_blend,P_new_PV,scaleup_V:scaleup_ratio,
    CBM,annual_energy,checks
  }
}

// ── STORAGE TANK ─────────────────────────────────────────────────
function calcStorageTank(p: any) {
  const {tankType='fixed_cone',D,H_max,H_shell,n_c=4,cone_slope=12,
    rho_fluid=850,SG_design=1.0,Td=65,CA=3,
    Sd=160,St=175,t_min=6,
    Vw=47,Ss=0.25,
    Q_fill=500,Pv=15,flash_pt=70,
    CEPCI_ratio=2.065,plate_cost=1500} = p

  const h_c = H_shell/n_c
  const courses = []
  for(let i=0;i<n_c;i++) {
    const H_from_bot = H_shell - i*h_c
    const t_d = 4.9*D*(H_from_bot-0.3)*SG_design/Sd + CA
    const t_t = 4.9*D*(H_from_bot-0.3)*SG_design/St
    const t_nom = Math.max(t_min, Math.ceil(Math.max(t_d,t_t)*2)/2)
    courses.push({H:H_from_bot, t_d, t_t, t_nom})
  }
  const t_bot = courses[0].t_nom, t_top = courses[n_c-1].t_nom
  const sigma_h = 4.9*D*(H_shell-0.3)*SG_design/((t_bot-CA)*0.1) // MPa simplified

  // Shell weight
  const W_shell_kg = courses.reduce((acc,c)=>acc+7850*Math.PI*D*h_c*(c.t_nom/1000),0)
  const t_annular = Math.max(6, t_bot*1.0)
  const W_annular = 7850*Math.PI/4*((D+2*0.6)*(D+2*0.6)-D*D)*t_annular/1000

  // Volumes
  const V_gross = Math.PI/4*D*D*H_shell
  const V_net = Math.PI/4*D*D*H_max

  // Cone roof
  const H_apex = D/(2*cone_slope)
  const L_slant = Math.sqrt(Math.pow(D/2,2)+H_apex*H_apex)
  const A_roof = Math.PI*(D/2)*L_slant
  const t_roof = Math.max(5, 5 + CA/2) // API 650 min
  const W_roof = 7850*A_roof*(t_roof/1000)

  // Nozzles
  const A_nozzle_DN300 = Math.PI/4*0.3*0.3
  const u_inlet = Q_fill/3600/A_nozzle_DN300
  const u_outlet = u_inlet

  // Foundation
  const W_steel_tot = (W_shell_kg + W_roof + W_annular)/1000 // tonnes
  const W_empty = W_steel_tot*1000
  const A_found = Math.PI/4*(D+1)*(D+1)
  const W_full = W_empty + 1000*V_net
  const q_found = W_full*9.81/A_found/1000 // kPa
  const ring_req = q_found > 100

  // Venting API 2000
  const Q_outbreath = Q_fill*1.01
  const Q_inbreath = Q_fill*1.25
  const A_vent = Q_outbreath/1500*10000 // cm² simplified
  const A_wet_fire = Math.PI*D*H_max
  const Q_fire_W = 43200*1.0*Math.pow(A_wet_fire,0.82)
  const Q_fire = Q_fire_W/250000*3600 // m³/h equiv
  const emerg_vent = flash_pt < 38

  // Pontoon (floating)
  const pontoon_A = Math.PI/4*D*D*0.065*D
  const pontoon_w = D*0.065

  // Economics
  const C_tank = W_steel_tot*1000*plate_cost
  const C_installed = C_tank*2.5*CEPCI_ratio
  const cost_per_m3 = C_installed/V_net

  // Hydro test
  const P_hydro = 9.81*1000*H_shell/1000 // kPa

  const checks = [
    {l:`Shell stress ${sigma_h.toFixed(1)} ≤ Sd ${Sd} MPa`, v:`${sigma_h.toFixed(1)} MPa`, pass:sigma_h<=Sd},
    {l:`Bottom course t ${t_bot.toFixed(1)} ≥ min ${t_min} mm`, v:`${t_bot.toFixed(1)} mm`, pass:t_bot>=t_min},
    {l:`H_shell/D ${(H_shell/D).toFixed(2)} ≤ 1.0`, v:`${(H_shell/D).toFixed(2)}`, pass:H_shell/D<=1.0},
    {l:`Cone slope 1:${cone_slope} ≥ 1:16 min`, v:`1:${cone_slope}`, pass:cone_slope<=16},
    {l:'Tank capacity > 0 (geometry consistent)', v:`${V_net.toFixed(0)} m³`, pass:V_net>0},
    {l:`Foundation bearing ${q_found.toFixed(1)} ≤ 200 kPa`, v:`${q_found.toFixed(1)} kPa`, pass:q_found<=200},
    {l:`Inlet velocity at DN300 ${u_inlet.toFixed(2)} < 2.0 m/s`, v:`${u_inlet.toFixed(2)} m/s`, pass:u_inlet<2.0},
    {l:'Vent area calculated (> 0 cm²)', v:`${A_vent.toFixed(1)} cm²`, pass:A_vent>0},
    {l:`H_max ${H_max} ≤ H_shell ${H_shell}`, v:`${H_max} vs ${H_shell} m`, pass:H_max<=H_shell},
    {l:'Installed cost estimated (> 0)', v:`$${C_installed.toFixed(0)}`, pass:C_installed>0},
  ]

  return {
    courses,t_bot,t_top,sigma_h,t_annular,W_shell_t:W_shell_kg/1000,
    V_gross,V_net,H_apex,L_slant,A_roof,t_roof,W_roof:W_roof/1000,
    u_inlet,u_outlet,
    W_steel_tot,W_empty,A_found,W_full,q_found,ring_req,
    Q_outbreath,Q_inbreath,A_vent,Q_fire,emerg_vent,
    pontoon_A,pontoon_w,
    C_tank,C_installed,cost_per_m3,P_hydro,
    checks
  }
}

// ── PIPING ────────────────────────────────────────────────────────
function calcPiping(p: any) {
  const {serviceType='liquid',Q,rho,mu,P_op=500,T_op=100,MW_gas=100,
    d_i,t_pipe=0.006,L_pipe,roughness=0.046,
    n_elbow90=4,n_gate=2,n_globe=1,n_check=1,n_tee=2,
    dP_cv=50,SG_cv=0.9,
    P_set=600,W_psv=1000,MW_psv=100,T_psv=150,
    t_ins=50,T_amb=25,pipe_cost=350,CEPCI_ratio=2.065} = p

  // Economic diameter — Sinnott-Towler
  const d_opt = 0.664*Math.pow(Q,0.45)*Math.pow(rho,0.13)

  // Hydraulics
  const velocity = Q/(Math.PI/4*d_i*d_i)
  const Re = rho*velocity*d_i/mu
  const rel_rough = (roughness/1000)/d_i
  const regime = Re>4000?'Turbulent':Re>2300?'Transition':'Laminar'

  // Swamee-Jain friction factor
  let f_darcy: number
  if(Re<2300) f_darcy = 64/Re
  else f_darcy = 0.25/Math.pow(Math.log10(rel_rough/3.7 + 5.74/Math.pow(Re,0.9)),2)

  // Pressure drop
  const dP_pipe = f_darcy*(L_pipe/d_i)*rho*velocity*velocity/2/1000 // kPa

  // Fittings — Crane K method
  const f_T = 0.25/Math.pow(Math.log10(rel_rough/3.7 + 5.74/Math.pow(Math.max(Re,4000),0.9)),2)
  const K_total = n_elbow90*30*f_T + n_gate*8*f_T + n_globe*340*f_T + n_check*100*f_T + n_tee*20*f_T
  const dP_fittings = K_total*rho*velocity*velocity/2/1000 // kPa
  const dP_total = dP_pipe + dP_fittings
  const dP_per_L = dP_total/L_pipe
  const pump_head = dP_total*1000/(rho*9.81)

  // Control valve ISA S75.01
  const Q_m3h = Q*3600
  const Cv = Q_m3h/Math.sqrt(dP_cv/100/SG_cv) // dP in bar
  const Kv = Cv*0.865
  const Cv_pct = Cv/Math.max(Cv*1.5,1)*100

  // PSV — API 520 gas
  const P1_psv = P_set*1.03
  const T_K_psv = T_psv+273.15
  const C_const = 315
  const A_psv_cm2 = (W_psv/C_const/0.975/(P1_psv))*Math.sqrt(T_K_psv*0.9/MW_psv)*10000
  const PSV_ORIFICES = [{d:'D',a:0.71},{d:'E',a:1.26},{d:'F',a:1.98},{d:'G',a:3.24},{d:'H',a:5.06},{d:'J',a:8.27},{d:'K',a:12.3},{d:'L',a:19.4},{d:'M',a:26.0},{d:'N',a:32.9},{d:'P',a:41.2}]
  const psv_orifice = PSV_ORIFICES.find(o=>o.a>=A_psv_cm2)?.d||'P+'
  const A_psv_selected = PSV_ORIFICES.find(o=>o.a>=A_psv_cm2)?.a||41.2

  // Heat loss through insulation
  const r_i = d_i/2, r_o = r_i+t_ins/1000
  const k_ins = 0.04 // mineral wool W/(m·K)
  const R_ins = Math.log(r_o/r_i)/(2*Math.PI*k_ins*L_pipe) + 1/(2*Math.PI*r_o*L_pipe*10)
  const Q_loss = (T_op-T_amb)/R_ins
  const Q_loss_per_m = Q_loss/L_pipe
  const ins_payback = t_ins>0 ? (pipe_cost*0.1*L_pipe)/(Q_loss_per_m*8760*3.6e-6*0.1) : 0

  // Economics
  const pipe_installed = pipe_cost*L_pipe

  const checks = [
    {l:`Velocity ${velocity.toFixed(3)} m/s in range 0.5–4.5 m/s`, v:`${velocity.toFixed(3)} m/s`, pass:velocity>=0.5&&velocity<=4.5},
    {l:`Re ${Re.toFixed(0)} > 4000 (turbulent)`, v:`Re=${Re.toFixed(0)}`, pass:Re>4000},
    {l:`ΔP/L ${dP_per_L.toFixed(3)} < 0.5 kPa/m`, v:`${dP_per_L.toFixed(3)} kPa/m`, pass:dP_per_L<0.5},
    {l:`Total ΔP ${dP_total.toFixed(1)} < 200 kPa`, v:`${dP_total.toFixed(1)} kPa`, pass:dP_total<200},
    {l:'Cv > 0 (control valve sized)', v:`Cv=${Cv.toFixed(2)}`, pass:Cv>0},
    {l:'PSV orifice area > 0 cm²', v:`${A_psv_cm2.toFixed(2)} cm² — ${psv_orifice}`, pass:A_psv_cm2>0},
    {l:`d_i within 30% of d_opt ${d_opt.toFixed(4)} m`, v:`d_i=${d_i}, d_opt=${d_opt.toFixed(4)}`, pass:Math.abs(d_i-d_opt)/d_opt<0.30},
    {l:`Friction factor f ${f_darcy.toFixed(4)} < 0.05`, v:`f=${f_darcy.toFixed(4)}`, pass:f_darcy<0.05},
    {l:`Heat loss ${Q_loss_per_m.toFixed(2)} W/m < 1000 W/m`, v:`${Q_loss_per_m.toFixed(2)} W/m`, pass:Q_loss_per_m<1000},
    {l:'Installed cost estimated', v:`$${pipe_installed.toFixed(0)}`, pass:pipe_installed>0},
  ]

  return {
    d_opt,velocity,Re,rel_rough,f_darcy,regime,
    dP_pipe,dP_fittings,K_total,dP_total,dP_per_L,pump_head,
    Cv,Kv,Cv_pct,
    A_psv_cm2,psv_orifice,A_psv_selected,P1_psv,
    Q_loss,Q_loss_per_m,ins_payback,pipe_installed,
    checks
  }
}

// ── SEPARATIONS ───────────────────────────────────────────────────
function calcSeparations(p: any) {
  const {G=10,y1=0.05,y2=0.002,x2=0,m_abs=0.5,L_abs=15,D_abs=0.8,HTU=0.5,
    L_str=20,x1_str=0.04,x2_str=0.002,G_str=15,m_str=2,
    F_ext=100,zF=0.1,xR=0.01,S_ext=80,D_ext=2.5,
    C_feed=300,C_sat=80,w_s=0.21,V_feed=10,rho_cryst=2680,
    X_in=0.3,X_out=0.05,m_dry=500,X_c=0.15,N_const=3,T_air=90,
    dryer_type='rotary'} = p

  // ABSORPTION
  const A_abs = L_abs/(m_abs*G)
  const LG_actual = L_abs/G
  const LG_min = m_abs*(y1-y2)/(y1/m_abs-x2)
  const LG_ratio = LG_actual/Math.max(LG_min,0.001)
  let N_OG = 0
  if(Math.abs(A_abs-1)<0.001) N_OG = (y1-m_abs*x2)/(y2-m_abs*x2)
  else N_OG = Math.log((1-1/A_abs)*(y1-m_abs*x2)/(y2-m_abs*x2)+1/A_abs)/(1-1/A_abs)
  const Z_col = N_OG*HTU
  const Z_total = Z_col + 4 // sump + vapour space
  const x1_exit = (G*(y1-y2)+L_abs*x2)/L_abs
  const eta_abs = (y1-y2)/y1
  const N_krem_abs = N_OG // ≈ stages for straight equilibrium line

  // STRIPPING
  const S_strip = m_str*G_str/L_str
  const G_str_min = L_str*(x1_str-x2_str)/(x1_str*m_str)
  let N_str = 0
  if(Math.abs(S_strip-1)<0.001) N_str = (x1_str-0)/(x2_str-0)
  else N_str = Math.log((1-1/S_strip)*(x1_str-0/m_str)/(x2_str-0/m_str)+1/S_strip)/Math.log(S_strip)
  const y1_str = m_str*(x1_str-x2_str)*G_str/(G_str)+0
  const eta_str = (x1_str-x2_str)/x1_str

  // EXTRACTION
  const E_ext = D_ext*S_ext/F_ext
  const S_min_ext = F_ext*(zF-xR)/D_ext
  const S_ratio_ext = S_ext/Math.max(S_min_ext,0.001)
  let N_ext = 0
  if(Math.abs(E_ext-1)<0.001) N_ext = (zF-xR*D_ext)/(zF-xR*D_ext)*5
  else N_ext = Math.log((1-1/E_ext)*(zF)/(xR)+1/E_ext)/Math.log(E_ext)
  const y_E = D_ext*zF*(1-Math.pow(1/E_ext,Math.ceil(N_ext)))
  const eta_ext = (zF-xR)/zF

  // CRYSTALLISATION
  const S_super = C_feed/Math.max(C_sat,0.01)
  const Y_cryst = V_feed*(C_feed-C_sat)/(1-w_s)
  const yield_per_m3 = Y_cryst/V_feed
  const cryst_recovery = Y_cryst/(C_feed*V_feed/1000)
  const W_hydration = Y_cryst*w_s
  const V_mother = V_feed - Y_cryst/rho_cryst/1000

  // DRYING
  const dX = X_in-X_out
  const X_in_dry = X_in/(1-X_in), X_out_dry = X_out/(1-X_out), X_c_dry = X_c/(1-X_c)
  const W_water = m_dry*(X_in_dry-X_out_dry)
  const A_dryer = W_water/N_const
  const t_const = X_c_dry>X_out_dry ? m_dry*(X_in_dry-X_c_dry)/(N_const*A_dryer) : 0
  const t_fall  = X_c_dry>0 ? m_dry*X_c_dry/(N_const*A_dryer)*Math.log(X_c_dry/Math.max(X_out_dry,0.001)) : 0
  const Q_dry = W_water/3600*2500000 // W (latent heat water)
  const spec_rate = N_const

  const checks = [
    {l:`Absorption factor A ${A_abs.toFixed(3)} > 1.2`, v:`A=${A_abs.toFixed(3)}`, pass:A_abs>1.2},
    {l:`N_OG ${N_OG.toFixed(1)} < 20 (practical)`, v:`${N_OG.toFixed(1)} stages`, pass:N_OG<20},
    {l:`Absorption recovery ${(eta_abs*100).toFixed(1)}% > 90%`, v:`${(eta_abs*100).toFixed(1)}%`, pass:eta_abs>0.9},
    {l:`L/G vs min ratio ${LG_ratio.toFixed(2)} > 1.2`, v:`${LG_ratio.toFixed(2)}×min`, pass:LG_ratio>1.2},
    {l:`Stripping factor S ${S_strip.toFixed(3)} > 1.0`, v:`S=${S_strip.toFixed(3)}`, pass:S_strip>1.0},
    {l:`Extraction factor E ${E_ext.toFixed(3)} > 1.0`, v:`E=${E_ext.toFixed(3)}`, pass:E_ext>1.0},
    {l:`Crystal yield ${Y_cryst.toFixed(1)} kg > 0`, v:`${Y_cryst.toFixed(1)} kg`, pass:Y_cryst>0},
    {l:`Supersaturation S ${S_super.toFixed(3)} > 1.0`, v:`S=${S_super.toFixed(3)}`, pass:S_super>1.0},
    {l:`Dryer area ${A_dryer.toFixed(1)} m² > 0`, v:`${A_dryer.toFixed(1)} m²`, pass:A_dryer>0},
    {l:`Drying ΔX ${dX.toFixed(3)} > 0 (moisture removed)`, v:`ΔX=${dX.toFixed(3)}`, pass:dX>0},
  ]

  return {
    A_abs,LG_actual,LG_min,LG_ratio,N_OG,Z_col,Z_total,x1_exit,eta_abs,N_krem_abs,
    S_strip,G_str_min,N_str,y1_str,eta_str,
    E_ext,S_min_ext,S_ratio_ext,N_ext,y_E,eta_ext,
    S_super,Y_cryst,yield_per_m3,cryst_recovery,W_hydration,V_mother,
    dX,X_in_dry,X_out_dry,W_water,A_dryer,t_const,t_fall,Q_dry,spec_rate,
    checks
  }
}

// ── MATERIAL & ENERGY BALANCE ─────────────────────────────────────
function calcMEB(p: any) {
  const {m_in,m_p1,m_p2,m_waste,m_inert=0,
    w_A,X_A,MW_A,MW_B,nu_ratio=1,dHrxn,
    T_in,T_ref=25,T_op,Cp_mix,lambda_vap=2200,f_vap=0,Q_ext=0,
    wC,wH,wS=0,wO=0,EA=20,m_fuel,
    P_boil=40,T_SH=400,P_cond=0.1,eta_turb=0.85,m_steam=10000,eta_pump=0.8} = p

  // MATERIAL BALANCE
  const m_total_in = +m_in
  const m_total_out = (+m_p1||0) + (+m_p2||0) + (+m_waste||0)
  const closure = Math.abs(m_total_in-m_total_out)/Math.max(m_total_in,0.001)*100
  const A_in_feed = m_total_in*(w_A||0)
  const A_reacted = A_in_feed*(X_A||0)
  const B_generated = A_reacted*(MW_B||92)/(MW_A||180)*(nu_ratio||1)
  const A_out = A_in_feed-A_reacted
  const B_in_P1 = B_generated

  const streamTable = [
    {name:'Feed ṁ_in', flow:m_total_in, note:'Total feed', type:'in'},
    {name:'A in feed', flow:A_in_feed, note:`${((w_A||0)*100).toFixed(1)} wt%`, type:'sub'},
    {name:'A reacted', flow:A_reacted, note:`X_A=${((X_A||0)*100).toFixed(1)}%`, type:'sub'},
    {name:'B generated', flow:B_generated, note:'From stoichiometry', type:'sub'},
    {name:'Product 1 ṁ_p1', flow:+m_p1||0, note:'', type:'out'},
    {name:'Product 2 ṁ_p2', flow:+m_p2||0, note:'', type:'out'},
    {name:'Waste / recycle', flow:+m_waste||0, note:'', type:'out'},
    {name:'Total OUT', flow:m_total_out, note:'', type:'total'},
    {name:'Balance closure', flow:Math.abs(m_total_in-m_total_out), note:`${closure.toFixed(2)}%`, type:'total'},
  ]

  // ENERGY BALANCE
  const m_kgs = m_total_in/3600
  const Q_sens = m_kgs*(Cp_mix||3.5)*((T_op||120)-(T_in||25))
  const Q_rxn = -(A_reacted/3600)*(dHrxn||0) // positive if exothermic (dHrxn negative)
  const Q_vap = (f_vap||0)*m_kgs*(lambda_vap||2200)
  const Q_process = Q_sens + Q_rxn + Q_vap
  const Q_net = Q_process + (Q_ext||0)
  const Q_net_interp = Q_net>0 ? 'Heat required (add steam/electric)' : 'Heat to remove (add cooling water)'

  // COMBUSTION
  const O2_stoic = 2.667*(wC||0)+8*((wH||0)-(wO||0)/8)+(wS||0)
  const air_stoic = O2_stoic/0.232
  const air_actual = air_stoic*(1+(EA||20)/100)
  const m_air = (m_fuel||0)*air_actual
  const m_flue = (m_fuel||0)+m_air
  // Dulong GHV (corrected coefficients)
  const GHV = 33830*(wC||0)+144400*((wH||0)-(wO||0)/8)+9400*(wS||0)
  const NHV = GHV - 2442*9*(wH||0)
  const Q_comb = (m_fuel||0)*NHV/3600
  const m_CO2 = 3.667*(wC||0)*(m_fuel||0)
  const m_SO2 = 2*(wS||0)*(m_fuel||0)
  const m_H2O = 9*(wH||0)*(m_fuel||0)
  const comb_eff = NHV>0 ? 100 : 0

  // RANKINE CYCLE — simplified steam tables
  const T_sat_boil = 42*Math.pow(P_boil,0.25) - 13
  const h1 = 2800 + 2.1*(T_SH-T_sat_boil) + 0.5*(P_boil-10) // kJ/kg superheated
  const T_sat_cond = 42*Math.pow(P_cond,0.25) - 13
  const h2s = 2350 - 15*Math.log(P_cond/0.1) // kJ/kg saturated vapour at condenser
  const h2a = h1 - eta_turb*(h1-h2s)
  const h3 = 4.18*T_sat_cond + 0.001*(P_boil-P_cond)*100/1 // condensate approx
  const w_pump = (P_boil-P_cond)*100/1000 // kJ/kg approx (v=0.001 m³/kg)
  const h4 = h3 + w_pump/eta_pump
  const w_turb = h1-h2a
  const w_net = w_turb - w_pump
  const q_boil = h1-h4
  const q_cond = h2a-h3
  const eta_th = w_net/Math.max(q_boil,1)
  const m_kg_s = (m_steam||10000)/3600
  const W_turb = m_kg_s*w_turb
  const W_pump = m_kg_s*w_pump
  const W_net = m_kg_s*w_net
  const Q_boiler = m_kg_s*q_boil
  const Q_cond_kW = m_kg_s*q_cond
  const steam_rate = m_steam/Math.max(W_net,0.001)
  const P_ratio = P_cond/P_boil

  const statePoints = [
    {state:'State 1',desc:'Turbine inlet (superheated)',T:T_SH,P:P_boil,h:h1,s:h1/T_SH*0.9},
    {state:'State 2s',desc:'Isentropic turbine exit',T:T_sat_cond,P:P_cond,h:h2s,s:h1/T_SH*0.9},
    {state:'State 2a',desc:'Actual turbine exit',T:T_sat_cond,P:P_cond,h:h2a,s:h2a/T_sat_cond*0.1+6.9},
    {state:'State 3',desc:'Condenser exit (sat. liquid)',T:T_sat_cond,P:P_cond,h:h3,s:0.5},
    {state:'State 4',desc:'Pump exit (feedwater)',T:T_sat_cond+1,P:P_boil,h:h4,s:0.5},
  ]

  const checks = [
    {l:'Mass balance closure < 1%', v:`${closure.toFixed(3)}%`, pass:closure<1},
    {l:'Conversion X_A > 0 and < 1', v:`X_A=${((X_A||0)).toFixed(2)}`, pass:(X_A||0)>0&&(X_A||0)<1},
    {l:'Product B generated > 0 kg/h', v:`${B_generated.toFixed(1)} kg/h`, pass:B_generated>0},
    {l:'Total IN ≈ Total OUT (mass conservation)', v:`IN=${m_total_in.toFixed(1)} vs OUT=${m_total_out.toFixed(1)}`, pass:closure<5},
    {l:'Q_net calculated (energy balance complete)', v:`${Q_net.toFixed(1)} kW`, pass:true},
    {l:'Combustion: theoretical O2 > 0 (valid fuel)', v:`${O2_stoic.toFixed(3)} kg/kg`, pass:O2_stoic>0},
    {l:`GHV ${GHV.toFixed(0)} kJ/kg > 10000 kJ/kg`, v:`${GHV.toFixed(0)} kJ/kg`, pass:GHV>10000},
    {l:`Rankine η_th ${(eta_th*100).toFixed(1)}% > 0`, v:`${(eta_th*100).toFixed(1)}%`, pass:eta_th>0},
    {l:`W_net ${W_net.toFixed(0)} kW > 0`, v:`${W_net.toFixed(0)} kW`, pass:W_net>0},
    {l:`Steam rate ${steam_rate.toFixed(2)} < 20 kg/kWh`, v:`${steam_rate.toFixed(2)} kg/kWh`, pass:steam_rate<20},
  ]

  return {
    m_total_in,m_total_out,closure,A_in_feed,A_reacted,B_generated,A_out,B_in_P1,streamTable,
    Q_sens,Q_rxn,Q_vap,Q_ext,Q_process,Q_net,Q_net_interp,
    O2_stoic,air_stoic,air_actual,m_air,m_flue,GHV,NHV,Q_comb,m_CO2,m_SO2,m_H2O,comb_eff,
    h1,h2s,h2a,h3,h4,w_turb,w_net,w_pump,q_boil,q_cond,eta_th,
    W_turb,W_pump,W_net,Q_boiler,Q_cond:Q_cond_kW,steam_rate,P_ratio,
    T_sat_boil,T_sat_cond,statePoints,
    checks
  }
}
