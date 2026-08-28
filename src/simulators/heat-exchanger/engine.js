// ── Heat Exchanger Simulator Engine ──────────────────────────────
// Mirrors every sheet in Heat_Exchanger_Simulator.xlsx

export const DEFAULTS = {
  // Geometry (1_INPUTS)
  Ds: 0.50, Bs: 0.25, Bc: 0.25, Pt: 0.031, Nb: 6,
  do: 0.025, di: 0.020, L: 4.5, Nt: 100, passes: 2,
  kw: 45, dNs: 0.05, dNt: 0.04,
  // Shell side (hot)
  ms: 10, Ts_in: 120, Ts_out: 60,
  rhos: 900, mus: 0.001, musw: 0.0008, ks: 0.6, Cps: 4000, Rfs: 0.0002,
  // Tube side (cold)
  mt: 8, Tt_in: 25, Tt_out: 75,
  rhot: 1000, mut: 0.001, mutw: 0.0008, kt: 0.6, Cpt: 4180, Rft: 0.0002,
  // Limits
  ut_max: 3.0, us_max: 1.5, dPt_max: 70000, dPs_max: 70000, OD_target: 0.10,
  // Mechanical
  Pd_mech: 1.0, Sallow: 137, CA: 0.003, Ew: 1.0, Fmat: 1.0, FBM: 3.17,
  // Economics
  CEPCI: 820, CEPCIbase: 397, opHours: 8000,
  shellUtil: 0.025, tubeUtil: 0.0005,
  // Condenser extras
  rhol_cond: 700, lambda_cond: 200000, mus_cond: 0.001,
  // Reboiler extras
  Pc_bar: 40, Pop_bar: 1.0, rhov_reb: 10, sigma_reb: 0.02, lambda_reb: 200000,
}

export function calculate(inp) {
  const p = { ...DEFAULTS, ...inp }
  const { Ds,Bs,Bc,Pt,Nb,do:do_,di,L,Nt,passes,kw,dNs,dNt,
    ms,Ts_in,Ts_out,rhos,mus,musw,ks,Cps,Rfs,
    mt,Tt_in,Tt_out,rhot,mut,mutw,kt,Cpt,Rft,
    ut_max,us_max,dPt_max,dPs_max,
    Pd_mech,Sallow,CA,Ew,FBM,CEPCI,CEPCIbase,opHours,
    rhol_cond,lambda_cond,mus_cond,Pc_bar,Pop_bar,rhov_reb,sigma_reb,lambda_reb } = p

  // ── 2_THERMAL ─────────────────────────────────────────────────
  const Qs = ms*Cps*Math.abs(Ts_in-Ts_out)
  const Qt = mt*Cpt*Math.abs(Tt_out-Tt_in)
  const imbalance = Math.abs(Qs-Qt)/Math.max(Qs,1)*100
  const Q = Math.max(Qs,Qt)  // conservative
  const dT1 = Ts_in - Tt_out
  const dT2 = Ts_out - Tt_in
  const LMTD = Math.abs(dT1-dT2)<0.01 ? dT1 : (dT1-dT2)/Math.log(Math.abs(dT1/dT2))
  // Bowman F-factor (1-2 exchanger)
  const Rf = Math.abs(Ts_in-Ts_out)/Math.max(Math.abs(Tt_out-Tt_in),0.01)
  const Sf = Math.abs(Tt_out-Tt_in)/Math.max(Math.abs(Ts_in-Tt_in),0.01)
  let F = 1.0
  if(Math.abs(Rf-1)>0.001 && Sf>0.01 && Sf<0.99 && Rf>0){
    try {
      const sqR = Math.sqrt(Rf*Rf+1)
      const num = sqR*Math.log((1-Sf)/(1-Rf*Sf))
      const den = (Rf-1)*Math.log((2-Sf*(Rf+1-sqR))/(2-Sf*(Rf+1+sqR)))
      const Fc = Math.abs(num/den)
      F = isNaN(Fc)||!isFinite(Fc) ? 1.0 : Math.min(1.0,Math.max(0.5,Fc))
    } catch(e){ F=1.0 }
  }
  const dTm = F*LMTD
  const A_prov = Math.PI*do_*L*Nt  // m²

  // ── 3_TUBESIDE ───────────────────────────────────────────────
  const Nt_pass = Nt/passes
  const At_flow = Math.PI/4*di*di*Nt_pass
  const ut = mt/(rhot*At_flow)
  const Re_t = rhot*ut*di/mut
  const Pr_t = mut*Cpt/kt
  const Nu_t = Re_t>10000
    ? 0.027*Math.pow(Re_t,0.8)*Math.pow(Pr_t,1/3)*Math.pow(mut/mutw,0.14)
    : Re_t>2300
      ? 0.023*Math.pow(Re_t,0.8)*Math.pow(Pr_t,0.4)
      : 3.66
  const ht = Nu_t*kt/di
  const ht_adj = ht*(di/do_)  // adjusted to outer area
  const eps_d = 4.6e-5/di
  const ft = 0.25/Math.pow(Math.log10(eps_d/3.7+5.74/Math.pow(Math.max(Re_t,1),0.9)),2)
  const dPt_fric = ft*rhot*ut*ut*L*passes/(2*di)
  const dPt_ret = 4*passes*0.5*rhot*ut*ut
  const dPt_total = dPt_fric + dPt_ret
  const regime_t = Re_t>10000?'Turbulent':Re_t>2300?'Transition':'Laminar'

  // ── 4_SHELLSIDE (Bell-Delaware) ──────────────────────────────
  const Ct = Pt - do_  // clearance
  const As = Ds*Bs*Ct/Pt  // Kern simplified
  const us = ms/(rhos*Math.max(As,1e-6))
  const de = 4*(0.866*Pt*Pt-Math.PI/8*do_*do_)/(Math.PI/2*do_)
  const Re_s = rhos*us*de/mus
  const Pr_s = mus*Cps/ks
  const h_ideal = 0.36*Math.pow(Math.max(Re_s,1),0.55)*Math.pow(Math.max(Pr_s,0.1),1/3)*Math.pow(mus/musw,0.14)*ks/de
  const Jc = 0.55+0.72*(1-2*Bc)
  const Jl = Math.max(0.4, 0.85-0.15*Bc)
  const Jb = 0.70, Js = 1.0
  const Jr = Re_s>10000?1.0:Re_s>2300?0.85:0.65
  const ho = h_ideal*Jc*Jl*Jb*Js*Jr
  const dPs_ideal = 4*0.72*Nb*rhos*us*us/2
  const dPs_total = dPs_ideal*Jb*Jl
  const regime_s = Re_s>10000?'Turbulent':Re_s>2300?'Transition':'Laminar'

  // ── 5_OVERALL ───────────────────────────────────────────────
  const tw = (do_-di)/2
  const dlm = (do_-di)/Math.log(do_/di)
  const Rw = tw*do_/(dlm*kw)
  const Rft_adj = Rft*(do_/di)
  const U_clean = 1/(1/ht_adj+Rw+1/ho)
  const U_dirty = 1/(1/U_clean+Rft_adj+Rfs)
  const cleanliness = U_dirty/U_clean*100
  const A_req = dTm>0 ? Q/(U_dirty*dTm) : 0
  const OD = A_req>0 ? (A_prov-A_req)/A_req*100 : 0

  // ── 6_CONDENSER (Nusselt + Eissenberg) ──────────────────────
  const T_cond = (Ts_in+Ts_out)/2
  const Tw_cond = Tt_in+0.2*(T_cond-Tt_in)
  const dT_film = Math.max(3, T_cond-Tw_cond)
  const Nr = Math.max(1, Math.round(Math.sqrt(Nt/2)))  // approx rows
  // Nusselt horizontal tube condensation
  const h_cond_top = 0.725*Math.pow(Math.max(rhol_cond*rhol_cond*9.81*lambda_cond*Math.pow(kt,3)/(mus_cond*do_*dT_film),0),0.25)
  const h_cond = h_cond_top*Math.pow(Nr,-1/6)  // Eissenberg row correction
  const A_cond_req = Q/Math.max(h_cond*dTm,1)

  // ── 7_REBOILER (Mostinski + Zuber) ──────────────────────────
  const Pr_reb = Pop_bar/Pc_bar
  const Fp_reb = 1.8*Math.pow(Pr_reb,0.17)+4*Math.pow(Pr_reb,1.2)+10*Math.pow(Pr_reb,10)
  const q_reb = Q/Math.max(A_prov,0.1)
  const h_nb = 0.00417*Math.pow(Pc_bar,0.69)*Math.pow(Math.max(q_reb,1),0.7)*Fp_reb
  const q_max_zuber = 0.131*lambda_reb*Math.sqrt(rhov_reb)*Math.pow(Math.max(sigma_reb*9.81*(rhol_cond-rhov_reb),0),0.25)
  const flux_frac = q_max_zuber>0 ? q_reb/q_max_zuber*100 : 0

  // ── 8_MECHANICAL ────────────────────────────────────────────
  const Pd_asme = Math.max(1.1*Pd_mech, Pd_mech+0.175)
  const Ri_shell = Ds/2
  const t_shell_calc = Pd_asme*Ri_shell*1000/(Sallow*Ew-0.6*Pd_asme)+CA*1000
  const STD=[6,8,10,12,16,20,25]
  const t_shell = STD.find(t=>t>=t_shell_calc)||25
  // Tubesheet: simplified Gardiner t_ts = D_s/2 × √(Pd/(S×0.3))
  const t_ts = Ds/2*1000*Math.sqrt(Pd_asme/(Sallow*0.3))
  // Nozzle velocities
  const uNs = ms/(rhos*Math.PI/4*dNs*dNs)
  const uNt = mt/(rhot*Math.PI/4*dNt*dNt)
  // Shell weight
  const W_shell_kN = 7850*Math.PI*Ds*L*t_shell/1000*9.81/1000

  // ── 9_VIBRATION ─────────────────────────────────────────────
  const E_steel = 200e9
  const I_tube = Math.PI/64*(Math.pow(do_,4)-Math.pow(di,4))
  const rho_steel = 7850
  const m_tube = Math.PI/4*(do_*do_-di*di)*rho_steel + Math.PI/4*di*di*rhot  // kg/m
  const L_span = L/(Math.max(Nb,1)+1)
  const fn = Math.pow(Math.PI/L_span,2)*Math.sqrt(E_steel*I_tube/m_tube)/(2*Math.PI)
  const fv = 0.22*us/do_  // Strouhal St=0.22
  const vortex_ratio = fn>0 ? fv/fn : 99
  const K_conn = 3.3
  const zeta = 0.03
  const u_crit = K_conn*fn*do_*Math.sqrt(2*Math.PI*zeta*m_tube/(rhos*do_*do_))
  const fluid_ratio = u_crit>0 ? us/u_crit : 99

  // ── Economics ───────────────────────────────────────────────
  const Esc = CEPCI/CEPCIbase
  const Cp_hx = Math.exp(4.3247-0.303*Math.log(Math.max(A_prov,0.5))+0.1634*Math.pow(Math.log(Math.max(A_prov,0.5)),2))*Esc
  const CBM = FBM*Cp_hx

  // ── Temperature profile data ─────────────────────────────────
  const profile = Array.from({length:11},(_,i)=>{
    const frac=i/10
    return {
      pos: +(frac*100).toFixed(0),
      hot: +(Ts_in-frac*(Ts_in-Ts_out)).toFixed(1),
      cold: +(Tt_out-frac*(Tt_out-Tt_in)).toFixed(1),
    }
  })

  // ── Checks (10_DASHBOARD) ────────────────────────────────────
  const checks = [
    { l:'Duty imbalance |Qs−Qt|/Q < 2%', pass:imbalance<2,          v:`${imbalance.toFixed(1)}%` },
    { l:'LMTD F-factor ≥ 0.75',          pass:F>=0.75,              v:`F = ${F.toFixed(3)}` },
    { l:'Over-design 5–25%',             pass:OD>=5&&OD<=25,        v:`OD = ${OD.toFixed(1)}%` },
    { l:'Tube velocity ≤ u_t,max',       pass:ut<=ut_max,           v:`u_t = ${ut.toFixed(2)} m/s` },
    { l:'Shell velocity ≤ u_s,max',      pass:us<=us_max,           v:`u_s = ${us.toFixed(2)} m/s` },
    { l:'Tube ΔP ≤ limit',              pass:dPt_total<=dPt_max,   v:`ΔP_t = ${(dPt_total/1000).toFixed(1)} kPa` },
    { l:'Shell ΔP ≤ limit',             pass:dPs_total<=dPs_max,   v:`ΔP_s = ${(dPs_total/1000).toFixed(1)} kPa` },
    { l:'Reboiler flux q/q_max < 70%',  pass:flux_frac<70,         v:`${flux_frac.toFixed(1)}%` },
    { l:'Vortex shedding f_v/f_n < 0.5',pass:vortex_ratio<0.5,    v:`f_v/f_n = ${vortex_ratio.toFixed(3)}` },
    { l:'Fluidelastic u_s/u_crit < 0.8',pass:fluid_ratio<0.8,     v:`u_s/u_crit = ${fluid_ratio.toFixed(3)}` },
  ]

  const f = (v,d=2) => v==null?'—':(+v).toFixed(d)
  return {
    Qs:+Qs.toFixed(0), Qt:+Qt.toFixed(0), Q:+Q.toFixed(0), imbalance:+imbalance.toFixed(2),
    dT1:+dT1.toFixed(2), dT2:+dT2.toFixed(2), LMTD:+LMTD.toFixed(2),
    Rf:+Rf.toFixed(3), Sf:+Sf.toFixed(3), F:+F.toFixed(3), dTm:+dTm.toFixed(2),
    A_prov:+A_prov.toFixed(2), A_req:+A_req.toFixed(2), OD:+OD.toFixed(1),
    // Tube side
    Nt_pass, At_flow:+At_flow.toFixed(5), ut:+ut.toFixed(3), Re_t:+Re_t.toFixed(0),
    Pr_t:+Pr_t.toFixed(2), Nu_t:+Nu_t.toFixed(2), ht:+ht.toFixed(0), ht_adj:+ht_adj.toFixed(0),
    regime_t, dPt_fric:+(dPt_fric/1000).toFixed(1), dPt_ret:+(dPt_ret/1000).toFixed(1), dPt_total:+(dPt_total/1000).toFixed(1),
    // Shell side
    Ct:+Ct.toFixed(4), As:+As.toFixed(5), us:+us.toFixed(3), de:+de.toFixed(4),
    Re_s:+Re_s.toFixed(0), Pr_s:+Pr_s.toFixed(2), h_ideal:+h_ideal.toFixed(0),
    Jc:+Jc.toFixed(3), Jl:+Jl.toFixed(3), Jb, Js, Jr, ho:+ho.toFixed(0),
    regime_s, dPs_ideal:+(dPs_ideal/1000).toFixed(1), dPs_total:+(dPs_total/1000).toFixed(1),
    // Overall
    Rw:+Rw.toFixed(6), Rft_adj:+Rft_adj.toFixed(6), U_clean:+U_clean.toFixed(0),
    U_dirty:+U_dirty.toFixed(0), cleanliness:+cleanliness.toFixed(1),
    // Condenser
    T_cond:+T_cond.toFixed(1), dT_film:+dT_film.toFixed(1), Nr,
    h_cond_top:+h_cond_top.toFixed(0), h_cond:+h_cond.toFixed(0), A_cond_req:+A_cond_req.toFixed(1),
    // Reboiler
    Pr_reb:+Pr_reb.toFixed(4), Fp_reb:+Fp_reb.toFixed(3), q_reb:+q_reb.toFixed(0),
    h_nb:+h_nb.toFixed(0), q_max_zuber:+q_max_zuber.toFixed(0), flux_frac:+flux_frac.toFixed(1),
    // Mechanical
    Pd_asme:+Pd_asme.toFixed(3), t_shell_calc:+t_shell_calc.toFixed(2), t_shell,
    t_ts:+t_ts.toFixed(1), uNs:+uNs.toFixed(2), uNt:+uNt.toFixed(2), W_shell_kN:+W_shell_kN.toFixed(2),
    // Vibration
    m_tube:+m_tube.toFixed(3), I_tube:+I_tube.toExponential(3), L_span:+L_span.toFixed(3),
    fn:+fn.toFixed(2), fv:+fv.toFixed(2), vortex_ratio:+vortex_ratio.toFixed(3),
    u_crit:+u_crit.toFixed(3), fluid_ratio:+fluid_ratio.toFixed(3),
    // Economics
    Cp_hx:+Cp_hx.toFixed(0), CBM:+CBM.toFixed(0),
    profile, checks,
  }
}
