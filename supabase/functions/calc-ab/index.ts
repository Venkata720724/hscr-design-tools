import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
function Psat(A:number,B:number,C:number,T:number){return Math.pow(10,A-B/(C+T))}
function clamp(v:number,lo:number,hi:number){return Math.max(lo,Math.min(hi,v))}
const STD_T=[6,8,10,12,16,20,25,30,36,40,45,50]
function nextStdT(v:number){return STD_T.find((s:number)=>s>=v)||50}
const STD_D=[0.45,0.60,0.75,0.90,1.05,1.20,1.50,1.80,2.10,2.40,3.00]
const PSV_ORI=[{d:'D',a:0.71},{d:'E',a:1.26},{d:'F',a:1.98},{d:'G',a:3.24},{d:'H',a:5.06},{d:'J',a:8.27},{d:'K',a:12.3},{d:'L',a:19.4},{d:'M',a:26.0},{d:'N',a:32.9},{d:'P',a:41.2}]

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

function doDistil(inputs:any):any {
  if(inputs.mode==='multicomponent') return calcMulticomponent(inputs)
  return calcBinary(inputs)
}

serve(async (req) => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  try {
    const {inputs} = await req.json()
    const result = doDistil(inputs)
    return new Response(JSON.stringify(result),{headers:{...cors,'Content-Type':'application/json'}})
  } catch(e:any) {
    return new Response(JSON.stringify({error:e.message}),{status:500,headers:{...cors,'Content-Type':'application/json'}})
  }
})
