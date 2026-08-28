// ── Distillation Column Simulator Engine ──────────────────────────
// Mirrors every sheet in Distillation_Column_Simulator.xlsx

export const DEFAULTS = {
  // Feed (1_INPUTS)
  F: 100, zF: 0.50, Tf: 80, Pcol: 101.325,
  // Products
  xD: 0.95, xB: 0.05,
  // Antoine LK (Benzene defaults)
  ALK: 6.90565, BLK: 1211.033, CLK: 220.79,
  // Antoine HK (Toluene defaults)
  AHK: 6.95087, BHK: 1342.31, CHK: 219.187,
  // Reflux & column type
  R: 2.5, colType: 'tray',
  // Tray geometry
  traySpacing: 0.6, weirH: 50, holeDiam: 5,
  // Flooding fraction
  floodFrac: 0.80,
  // Physical properties
  rhoL: 870, rhoV: 3.19, muL: 0.42, muV: 0.0073,
  sigma: 21, lamLK: 30720, lamHK: 33180,
  mwLK: 78.11, mwHK: 92.14,
  CpL_LK: 136, CpL_HK: 157, CpV_LK: 82, CpV_HK: 104,
  // Packing
  ap: 250, Fp: 17, epsPk: 0.97, dpPk: 0.05, sigmaC: 0.033,
  // Mechanical (ASME)
  Sallow: 137, CA: 3, Ejt: 1.0, tInsul: 75, rhoInsul: 80,
  windSpeed: 45,
  // Economics
  CEPCI: 820, CEPCIbase: 397, FBM: 4.16,
  steamCost: 0.025, CWcost: 0.0005, elecCost: 0.08,
  opHours: 8000, payback: 3, maint: 0.02,
  Pc_kPa: 4895, // critical pressure for reboiler
}

function Psat(A, B, C, T) { return Math.pow(10, A - B/(C + T)) } // mmHg
function vleY(x, a) { return a*x / (1 + (a-1)*x) }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

const STD_DIAMETERS = [0.45,0.60,0.75,0.90,1.05,1.20,1.50,1.80,2.10,2.40,3.00]
const STD_THICK = [6,8,10,12,16,20,25,30]
function nextStd(arr, val) { return arr.find(s => s >= val) || arr[arr.length-1] }

export function calculate(inp) {
  const p = { ...DEFAULTS, ...inp }
  const { F,zF,Tf,Pcol,xD,xB,ALK,BLK,CLK,AHK,BHK,CHK,R,colType,
    traySpacing,weirH,floodFrac,rhoL,rhoV,muL,sigma,lamLK,lamHK,
    mwLK,mwHK,CpL_LK,CpL_HK,Sallow,CA,Ejt,tInsul,rhoInsul,windSpeed,
    CEPCI,CEPCIbase,FBM,steamCost,CWcost,opHours,payback,maint,Pc_kPa,
    ap,epsPk,dpPk,sigmaC,Fp } = p

  if (xD<=xB || zF<=xB || zF>=xD || F<=0) return null

  // ── 2_VLE_THERMO ─────────────────────────────────────────────────
  const Pmm = Pcol * 7.50062
  const PsLK_t = Psat(ALK,BLK,CLK,Tf-10)
  const PsHK_t = Psat(AHK,BHK,CHK,Tf-10)
  const PsLK_b = Psat(ALK,BLK,CLK,Tf+15)
  const PsHK_b = Psat(AHK,BHK,CHK,Tf+15)
  const PsLK_f = Psat(ALK,BLK,CLK,Tf)
  const PsHK_f = Psat(AHK,BHK,CHK,Tf)
  const alpha_top = PsLK_t / PsHK_t
  const alpha_bot = PsLK_b / PsHK_b
  const alpha_avg = Math.sqrt(alpha_top * alpha_bot)
  const alpha_var = Math.abs(alpha_top-alpha_bot)/alpha_top*100
  const T_bub = zF*(BLK/(ALK-Math.log10(Pmm))-CLK) + (1-zF)*(BHK/(AHK-Math.log10(Pmm))-CHK)
  const T_dew = T_bub + 5
  const T_top = T_bub - 5
  const T_bot = T_bub + 18
  const lam_mix_D = xD*lamLK + (1-xD)*lamHK
  const lam_mix_B = xB*lamLK + (1-xB)*lamHK
  const CpL_mix_D = xD*CpL_LK + (1-xD)*CpL_HK
  const CpL_mix_B = xB*CpL_LK + (1-xB)*CpL_HK
  const MW_avg = zF*mwLK + (1-zF)*mwHK

  // ── 3_MATBAL ─────────────────────────────────────────────────────
  const D = F*(zF-xB)/(xD-xB)
  const B = F - D
  const LK_in = F*zF, LK_D = D*xD
  const LK_rec = LK_D/LK_in*100
  const HK_rec = (B*(1-xB))/(F*(1-zF))*100
  const L_rect = R*D
  const V_rect = (R+1)*D
  const q = 1.0  // bubble-point feed default (user can change via Tf vs T_bub)
  const L_strip = L_rect + q*F
  const V_strip = V_rect - (1-q)*F

  // ── 4_SHORTCUT_FUG ───────────────────────────────────────────────
  const N_min = Math.log((xD/(1-xD))*((1-xB)/xB))/Math.log(alpha_avg)
  let Rmin = alpha_avg*xD/(alpha_avg*zF-(alpha_avg-1)*xD*zF)-1
  Rmin = Math.max(Rmin, 0.3)
  const Xg = Math.max((R-Rmin)/(R+1), 0.001)
  const Yg = 1 - Math.exp((1+54.4*Xg)/(11+117.2*Xg)*(Xg-1)/Math.sqrt(Xg))
  const N_th = Math.max(N_min/(1-Math.max(Yg,0.01)), N_min+1)
  const E_OC = clamp((51-32.5*Math.log10(muL*alpha_avg))/100, 0.20, 0.85)
  const N_act = Math.ceil(N_th/E_OC)
  // Kirkbride feed tray
  const N_feed = Math.max(1, Math.round(N_th/2))

  // ── 5A_TRAY_COLUMN ───────────────────────────────────────────────
  const V_mass = V_rect*MW_avg/1000/3600  // kg/s
  const L_mass = L_rect*MW_avg/1000/3600
  const F_LV = (L_mass/V_mass)*Math.sqrt(rhoV/rhoL)
  const Csb = Math.max(0.025,(0.12-0.1*F_LV)*Math.pow(traySpacing/0.6,0.5))
  const sig_corr = Math.pow(sigma/20, 0.2)
  const u_flood = Csb*sig_corr*Math.sqrt((rhoL-rhoV)/rhoV)
  const u_net = floodFrac*u_flood
  const Qv = V_mass/rhoV  // m³/s
  const Ad_frac = 0.12
  const A_net = Qv/Math.max(u_net,0.0001)
  const A_tot = A_net/(1-Ad_frac)
  const D_calc = Math.sqrt(4*A_tot/Math.PI)
  const D_std = nextStd(STD_DIAMETERS, D_calc)
  // Hole area & dry pressure drop
  const Ah_frac = 0.10
  const A_hole = Ah_frac*(1-Ad_frac)*Math.PI/4*D_std*D_std
  const u_hole = Qv/Math.max(A_hole,1e-6)
  const Co = 0.70
  const h_dry = 51/9.81*Math.pow(u_hole/Co,2)*rhoV/rhoL  // mm liq
  const l_w = 0.77*D_std
  const Lw_kgs = L_mass  // kg/s liquid
  const h_ow = 750*Math.pow(Lw_kgs/Math.max(rhoL*l_w,0.001),0.667)
  const h_tray = h_dry + weirH + h_ow
  const h_dc = h_tray + h_ow + weirH*0.5
  const dP_tray_Pa = h_tray*rhoL*9.81/1000
  const dP_col_kPa = dP_tray_Pa*N_act/1000
  // Column height (5A row 92-99)
  const H_active = N_act*traySpacing
  const H_col = H_active + 2 + 1.5 + 0.8 + 0.4  // sump+disengagement+overhead+feed
  const HD_ratio = H_col/D_std

  // ── 5B_PACKED_COLUMN ─────────────────────────────────────────────
  const uL_pk = 0.005, uV_pk = 1.2
  const ReL_pk = rhoL*uL_pk/(ap*(muL/1000))
  const FrL_pk = uL_pk*uL_pk*ap/9.81
  const WeL_pk = uL_pk*uL_pk*rhoL/(sigma/1000*ap)
  const a_eff = ap*(1-Math.exp(-1.45*Math.pow(sigmaC/(sigma/1000),0.75)
    *Math.pow(Math.max(ReL_pk,1e-9),0.1)*Math.pow(Math.max(FrL_pk,1e-9),-0.05)*Math.pow(Math.max(WeL_pk,1e-9),0.2)))
  const DV = 3.2e-5, DL = 0.033e-5
  const nuL = (muL/1000)/rhoL
  const ScV = (muL/1000)/(rhoV*DV)
  const kV = 0.7*Math.pow(uV_pk/(ap*0.021),0.333)*Math.pow(ScV,-0.5)/0.021*DV
  const kL = 0.5*Math.pow(uL_pk/ap,0.333)*Math.pow(DL/nuL,0.5)*Math.pow(ap,0.5)
  const m_eq = alpha_avg/Math.pow(1+(alpha_avg-1)*zF,2)
  const lam_strip = m_eq*(Math.max(V_strip,0.01)/Math.max(L_strip,0.01))
  const HV = uV_pk/Math.max(kV*a_eff,1e-9)
  const HL = uL_pk/Math.max(kL*a_eff,1e-9)
  const HOG = HV + HL*(lam_strip||1)
  const HETP = Math.abs(lam_strip-1)<0.01 ? HOG : HOG*Math.log(Math.max(lam_strip,0.01))/(lam_strip-1)
  const Z_pack = N_th*Math.max(HETP,0.3)
  const dP_pk_kPa = 200*Z_pack/1000
  const H_pk = Z_pack + 4  // add distributors/sump
  // GPDC flooding → packed diameter
  const Ygpdc = 0.07
  const u_fl_pk = Math.sqrt(Ygpdc*9.81*(rhoL-rhoV)/(Fp*rhoV*Math.pow(muL,0.05)))
  const u_op_pk = 0.70*u_fl_pk
  const G_mass = V_strip*MW_avg/1000/3600
  const A_pk = G_mass/Math.max(rhoV*u_op_pk,0.001)
  const D_pk = Math.sqrt(4*A_pk/Math.PI)
  const D_pk_std = nextStd(STD_DIAMETERS, D_pk)

  // ── 6_ENERGY_BALANCE ─────────────────────────────────────────────
  const lam_mixD = xD*lamLK + (1-xD)*lamHK
  const QC = D*(R+1)*lam_mixD/3600/1000   // kW (Eq 2.79)
  // Full energy balance: QR = QC + D·HD + B·HB - F·HF
  const HD_enth = CpL_mix_D*(T_top-25)/1000  // kJ/mol → kW·h/mol
  const HB_enth = CpL_mix_B*(T_bot-25)/1000
  const HF_enth = (xD*CpL_LK+(1-xD)*CpL_HK)*(Tf-25)/1000
  const QR_eb = QC + (D*HD_enth + B*HB_enth - F*HF_enth)*1000/3600/1000  // kW
  const QR = Math.max(QR_eb, QC*1.03)  // at minimum 3% more than QC

  // Steam selection (1_INPUTS row 87: 5bar→152°C)
  const P_steam = p.steamP || 5  // bar
  const T_steam = P_steam<=5?151.8:P_steam<=10?179.9:P_steam<=15?198.3:212
  const lam_steam = P_steam<=5?2108:P_steam<=10?2015:P_steam<=15?1947:1890  // kJ/kg
  const dT_steam = T_steam - T_bot
  const mdot_steam = QR/lam_steam  // kg/s
  const mdot_steam_h = mdot_steam*3600

  // CW (Eq 2.82)
  const T_CW_in = 25, T_CW_out = 40
  const mdot_CW = QC*1000/(4180*(T_CW_out-T_CW_in))  // kg/s
  const m3_CW_h = mdot_CW/1000*3600

  // Condenser LMTD and area
  const dT1c = T_top - T_CW_out, dT2c = T_top - T_CW_in
  const LMTD_c = Math.abs(dT1c-dT2c)<0.01 ? dT1c : (dT1c-dT2c)/Math.log(Math.abs(dT1c/dT2c))
  const Ucond = 700  // W/(m²K) estimated
  const A_cond = QC*1000/(Ucond*Math.max(LMTD_c,1))*1.2  // +20% fouling

  // Reboiler Mostinski (Eq 2.86)
  const Pc_bar = Pc_kPa/100
  const Pr = (Pcol/100)/Pc_bar
  const Fp_most = 1.8*Math.pow(Pr,0.17)+4*Math.pow(Pr,1.2)+10*Math.pow(Pr,10)
  const A_reb_est = Math.max(5, QR*0.5)
  const q_flux = QR*1000/A_reb_est
  const h_nb = 0.00417*Math.pow(Pc_bar,0.69)*Math.pow(q_flux,0.7)*Fp_most
  const dT_reb = Math.max(dT_steam*0.5, 10)
  const A_reb = QR*1000/Math.max(h_nb*dT_reb,1)
  // Zuber max flux
  const lam_V_kgkg = lam_mixD/((xB*mwLK+(1-xB)*mwHK)/1000)
  const q_max_zub = 0.131*lam_V_kgkg*Math.sqrt(rhoV)*Math.pow(Math.max(sigma/1000*9.81*(rhoL-rhoV),0),0.25)
  const flux_frac = q_max_zub>0 ? q_flux/q_max_zub*100 : 0

  // ── 7_MECHANICAL ─────────────────────────────────────────────────
  const Pd = Math.max(1.1*Pcol/1000, Pcol/1000+0.175)  // MPa
  const Ri = D_std*1000/2  // mm
  const t_sc = Pd*Ri/(Sallow*Ejt-0.6*Pd)+CA
  const t_min_shell = D_std<1 ? 6 : 8
  const t_gov = Math.max(t_sc, t_min_shell)
  const t_sn = nextStd(STD_THICK, t_gov)
  const Do = D_std*1000 + 2*t_sn  // mm
  const MAWP = Sallow*Ejt*(t_sn-CA)/(Ri+0.6*(t_sn-CA))
  // 2:1 SE head (UG-32d)
  const t_hc = Pd*D_std*1000/(2*Sallow*Ejt-0.2*Pd)+CA
  const t_hn = nextStd(STD_THICK, t_hc)
  const H_head_21 = D_std*1000/4  // mm
  // Toriconical head (UG-32e)
  const L_cr = D_std*1000
  const t_tori = 0.885*Pd*L_cr/(Sallow*Ejt-0.1*Pd)+CA
  const t_tori_n = nextStd(STD_THICK, t_tori)
  // Hemispherical head (UG-32f)
  const t_hemi = Pd*Ri/(2*Sallow*Ejt-0.2*Pd)+CA
  const t_hemi_n = nextStd(STD_THICK, t_hemi)
  // Weights
  const rho_st = 7850  // kg/m³
  const W_shell = rho_st*Math.PI*D_std*(H_col+0.8*D_std)*t_sn/1000
  const W_trays = 1200*Math.PI/4*D_std*D_std*N_act
  const W_ins = Math.PI*D_std*H_col*(tInsul/1000)*rhoInsul
  const W_total = W_shell+W_trays+W_ins
  const sigma_w = W_total*9.81/(Math.PI*D_std*(t_sn/1000)*1e6)  // MPa
  // Wind loading (ASCE 7 simplified)
  const q_wind = 0.5*1.225*windSpeed*windSpeed*0.7  // Pa, Cf=0.7
  const M_wind = q_wind*(Do/1000)*H_col*H_col/2/1000  // kN·m
  const I_vessel = Math.PI/64*(Math.pow(Do/1000,4)-Math.pow(D_std,4))
  const sigma_b = M_wind*1000*(Do/1000/2)/I_vessel/1e6  // MPa
  // Nozzle sizing
  const dn_vap = Math.sqrt(4*Qv/(Math.PI*20))*1000  // mm at 20 m/s
  const Ql_bot = (L_strip*MW_avg/1000/3600)/rhoL
  const dn_liq = Math.sqrt(4*Ql_bot/(Math.PI*1.0))*1000  // mm at 1 m/s
  const dn_steam = Math.sqrt(4*(mdot_steam/rhoV)/(Math.PI*20))*1000

  // ── 8_ECONOMICS (Turton) ─────────────────────────────────────────
  const Esc = CEPCI/CEPCIbase
  // Shell: K1=3.4974, K2=0.4485, K3=0.1074 (vertical vessel, surface area m²)
  const A_shell_m2 = Math.PI*D_std*(H_col+0.8*D_std)
  const Cp_shell = Math.exp(3.4974+0.4485*Math.log(Math.max(A_shell_m2,0.1))+0.1074*Math.pow(Math.log(Math.max(A_shell_m2,0.1)),2))*Esc
  const CBM_shell = FBM*Cp_shell
  // Condenser & reboiler: K1=4.3247, K2=-0.303, K3=0.1634 (floating head S&T)
  const Cp_cond = Math.exp(4.3247-0.303*Math.log(Math.max(A_cond,0.5))+0.1634*Math.pow(Math.log(Math.max(A_cond,0.5)),2))*Esc
  const CBM_cond = 3.17*Cp_cond
  const Cp_reb = Math.exp(4.3247-0.303*Math.log(Math.max(A_reb,0.5))+0.1634*Math.pow(Math.log(Math.max(A_reb,0.5)),2))*Esc
  const CBM_reb = 3.17*Cp_reb
  const CAPEX = CBM_shell+CBM_cond+CBM_reb
  const OPEX_steam = mdot_steam_h*steamCost*opHours
  const OPEX_CW = m3_CW_h*CWcost*opHours
  const OPEX_maint = maint*CAPEX
  const OPEX_total = OPEX_steam+OPEX_CW+OPEX_maint
  const TAC = CAPEX/payback+OPEX_total

  // R sensitivity table (8_ECONOMICS rows 46-51)
  const R_mults = [1.1,1.2,1.3,1.5,1.8,2.0]
  const rSens = R_mults.map(k => {
    const Rv = k*Rmin
    const Xr = Math.max((Rv-Rmin)/(Rv+1), 0.001)
    const Yr = 1-Math.exp((1+54.4*Xr)/(11+117.2*Xr)*(Xr-1)/Math.sqrt(Xr))
    const Ntr = Math.max(N_min/(1-Math.max(Yr,0.01)),N_min+1)
    const QCr = D*(Rv+1)*lam_mixD/3600/1000
    const msr = QCr*1.05/lam_steam*3600
    const opxr = msr*steamCost*opHours+OPEX_maint
    return { R: +Rv.toFixed(2), mult: k, N: +Ntr.toFixed(1), QC: +QCr.toFixed(1), OPEX: +(opxr/1000).toFixed(1) }
  })

  // ── McCabe-Thiele chart data ──────────────────────────────────────
  // Operating line slopes/intercepts
  const slope_rect = R/(R+1)
  const int_rect = xD/(R+1)
  const slope_strip = L_strip/V_strip
  const int_strip = xB*(1-slope_strip)
  // q-line / rect intersection (feed tray)
  const xq = zF  // bubble-point: q=1, vertical q-line
  const yq = slope_rect*xq + int_rect

  // ── 9_DASHBOARD checks ────────────────────────────────────────────
  const checks = [
    { l:'α_avg > 1.05',                pass: alpha_avg>1.05,         v: `α = ${alpha_avg.toFixed(2)}` },
    { l:'R ≥ 1.1 × R_min',             pass: R>=1.1*Rmin,            v: `R/Rmin = ${(R/Rmin).toFixed(2)}` },
    { l:'N_theoretical ≥ 3',           pass: N_th>=3,                v: `N = ${N_th.toFixed(1)}` },
    { l:'Tray efficiency 20–85%',       pass: E_OC>=0.2&&E_OC<=0.85, v: `E = ${(E_OC*100).toFixed(1)}%` },
    { l:'Flood fraction ≤ design %',   pass: floodFrac<=0.85,        v: `${(floodFrac*100).toFixed(0)}% of flood` },
    { l:'D_col ≥ 0.3 m',               pass: D_std>=0.3,             v: `D = ${D_std.toFixed(2)} m` },
    { l:'H/D < 30',                    pass: HD_ratio<30,            v: `H/D = ${HD_ratio.toFixed(1)}` },
    { l:'t_shell ≥ t_calc (UG-27)',    pass: t_sn>=t_sc,            v: `${t_sn} ≥ ${t_sc.toFixed(1)} mm` },
    { l:'MAWP ≥ P_design',             pass: MAWP>=Pd,              v: `${MAWP.toFixed(2)} ≥ ${Pd.toFixed(3)} MPa` },
    { l:'σ_b + σ_w ≤ S_allowable',    pass: (sigma_b+sigma_w)<=Sallow, v: `${(sigma_b+sigma_w).toFixed(1)} ≤ ${Sallow} MPa` },
  ]

  return {
    // VLE
    alpha_top:+alpha_top.toFixed(3), alpha_bot:+alpha_bot.toFixed(3),
    alpha_avg:+alpha_avg.toFixed(3), alpha_var:+alpha_var.toFixed(1),
    T_bub:+T_bub.toFixed(1), T_dew:+T_dew.toFixed(1),
    T_top:+T_top.toFixed(1), T_bot:+T_bot.toFixed(1),
    lam_mixD:+lam_mixD.toFixed(0), MW_avg:+MW_avg.toFixed(2),
    // Material balance
    D:+D.toFixed(2), B:+B.toFixed(2), LK_rec:+LK_rec.toFixed(1), HK_rec:+HK_rec.toFixed(1),
    L_rect:+L_rect.toFixed(1), V_rect:+V_rect.toFixed(1),
    L_strip:+L_strip.toFixed(1), V_strip:+V_strip.toFixed(1),
    // FUG
    N_min:+N_min.toFixed(1), Rmin:+Rmin.toFixed(3),
    Xg:+Xg.toFixed(4), Yg:+Yg.toFixed(4),
    N_th:+N_th.toFixed(1), E_OC:+E_OC.toFixed(3), N_act, N_feed,
    // Tray
    F_LV:+F_LV.toFixed(4), Csb:+Csb.toFixed(4), sig_corr:+sig_corr.toFixed(4),
    u_flood:+u_flood.toFixed(3), u_net:+u_net.toFixed(3), Qv:+Qv.toFixed(5),
    A_net:+A_net.toFixed(4), A_tot:+A_tot.toFixed(4), D_calc:+D_calc.toFixed(3), D_std,
    u_hole:+u_hole.toFixed(2), h_dry:+h_dry.toFixed(1), h_ow:+h_ow.toFixed(1),
    h_tray:+h_tray.toFixed(1), h_dc:+h_dc.toFixed(1),
    dP_tray_Pa:+dP_tray_Pa.toFixed(0), dP_col_kPa:+dP_col_kPa.toFixed(2),
    H_active:+H_active.toFixed(1), H_col:+H_col.toFixed(1), HD_ratio:+HD_ratio.toFixed(1),
    // Packed
    a_eff:+a_eff.toFixed(1), kV, kL, HOG:+HOG.toFixed(3), HETP:+HETP.toFixed(3),
    Z_pack:+Z_pack.toFixed(1), dP_pk_kPa:+dP_pk_kPa.toFixed(3), H_pk:+H_pk.toFixed(1),
    D_pk_std, u_fl_pk:+u_fl_pk.toFixed(3), u_op_pk:+u_op_pk.toFixed(3),
    lam_strip:+lam_strip.toFixed(3),
    // Energy
    QC:+QC.toFixed(2), QR:+QR.toFixed(2),
    T_steam:+T_steam.toFixed(1), lam_steam, dT_steam:+dT_steam.toFixed(1),
    mdot_steam_h:+mdot_steam_h.toFixed(1), m3_CW_h:+m3_CW_h.toFixed(2),
    LMTD_c:+LMTD_c.toFixed(1), A_cond:+A_cond.toFixed(1),
    Fp_most:+Fp_most.toFixed(3), h_nb:+h_nb.toFixed(0), A_reb:+A_reb.toFixed(1),
    q_flux:+q_flux.toFixed(0), q_max_zub:+q_max_zub.toFixed(0), flux_frac:+flux_frac.toFixed(1),
    // Mechanical
    Pd:+Pd.toFixed(3), Ri:+Ri.toFixed(0), t_sc:+t_sc.toFixed(2), t_sn, Do:+Do.toFixed(0),
    MAWP:+MAWP.toFixed(3), t_hc:+t_hc.toFixed(2), t_hn, t_tori:+t_tori.toFixed(2), t_tori_n,
    t_hemi:+t_hemi.toFixed(2), t_hemi_n,
    W_shell:+W_shell.toFixed(0), W_trays:+W_trays.toFixed(0), W_ins:+W_ins.toFixed(0), W_total:+W_total.toFixed(0),
    sigma_w:+sigma_w.toFixed(2), sigma_b:+sigma_b.toFixed(2), M_wind:+M_wind.toFixed(1),
    dn_vap:+dn_vap.toFixed(0), dn_liq:+dn_liq.toFixed(0), dn_steam:+dn_steam.toFixed(0),
    // Economics
    A_shell_m2:+A_shell_m2.toFixed(1), Cp_shell:+Cp_shell.toFixed(0), CBM_shell:+CBM_shell.toFixed(0),
    Cp_cond:+Cp_cond.toFixed(0), CBM_cond:+CBM_cond.toFixed(0),
    Cp_reb:+Cp_reb.toFixed(0), CBM_reb:+CBM_reb.toFixed(0), CAPEX:+CAPEX.toFixed(0),
    OPEX_steam:+OPEX_steam.toFixed(0), OPEX_CW:+OPEX_CW.toFixed(0),
    OPEX_maint:+OPEX_maint.toFixed(0), OPEX_total:+OPEX_total.toFixed(0), TAC:+TAC.toFixed(0),
    // Chart
    slope_rect:+slope_rect.toFixed(4), int_rect:+int_rect.toFixed(4),
    slope_strip:+slope_strip.toFixed(4), int_strip:+int_strip.toFixed(4),
    xq:+xq.toFixed(3), yq:+yq.toFixed(3),
    rSens, checks,
  }
}
