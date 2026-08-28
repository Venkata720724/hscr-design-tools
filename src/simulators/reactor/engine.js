// ── Reactor Design Simulator Engine ──────────────────────────────
// Mirrors every sheet in Reactor_Design_Simulator.xlsx

export const DEFAULTS = {
  // Kinetics (1_INPUTS)
  A_freq: 1.2e6,  // s⁻¹
  Ea: 55000,       // J/mol
  dHrx: -80000,    // J/mol (negative=exothermic)
  n_order: 1,      // reaction order
  // Feed
  FA0: 0.05,       // mol/s
  CA0: 500,        // mol/m³
  v0: 1e-4,        // m³/s volumetric flow
  T0: 25,          // °C feed temperature
  X: 0.85,         // desired conversion
  // Operating
  T_op: 80,        // °C
  P_op: 200,       // kPa abs
  T_c: 20,         // °C coolant temperature
  // Heat transfer
  U_HT: 400,       // W/(m²·K)
  A_HT: 2.0,       // m² (jacket area available)
  // Fluid properties
  rho: 900,        // kg/m³
  Cp: 2000,        // J/(kg·K)
  mu: 0.002,       // Pa·s
  D_AB: 1e-9,      // m²/s diffusivity
  // Reactor geometry
  L_rx: 3.0,       // m length
  D_rx: 0.5,       // m diameter
  // Catalyst (fixed bed)
  dp: 0.003,       // m particle diameter
  eps_b: 0.40,     // bed void fraction
  rho_cat: 1200,   // kg/m³ bulk
  eta_cat: 0.85,   // assumed effectiveness
  // Economics
  CEPCI: 2.065,    // ratio (current/base)
  elecCost: 0.08,  // $/kWh
  steamCost: 0.025,// $/kg
  opHours: 8000,   // h/yr
  cA_cost: 0.5,    // $/mol raw material A
  FBM: 3.5,
}

const R_gas = 8.314

export function calculate(inp) {
  const p = { ...DEFAULTS, ...inp }
  const { A_freq,Ea,dHrx,n_order,FA0,CA0,v0,T0,X,T_op,P_op,T_c,
    U_HT,A_HT,rho,Cp,mu,D_AB,L_rx,D_rx,dp,eps_b,rho_cat,eta_cat,
    CEPCI,elecCost,steamCost,opHours,cA_cost,FBM } = p

  if(X<=0||X>=1||CA0<=0||FA0<=0) return null

  // ── 3_KINETICS ─────────────────────────────────────────────────
  const T_K = T_op + 273.15
  const T0_K = T0 + 273.15
  const k = A_freq*Math.exp(-Ea/(R_gas*T_K))  // s⁻¹ (1st order)
  // Sensitivity: ΔT for doubling k
  const dT_double = R_gas*T_K*T_K*Math.log(2)/Ea
  const k_plus10 = A_freq*Math.exp(-Ea/(R_gas*(T_K+10)))
  const CA_exit = CA0*(1-X)
  const rA_exit = k*Math.pow(CA_exit, n_order)   // mol/(m³·s)
  const rA_feed = k*Math.pow(CA0, n_order)
  const tau_geom = (Math.PI/4*D_rx*D_rx*L_rx)/v0
  const Da = k*tau_geom
  const X_cstr_da = Da/(1+Da)
  const dT_ad = -dHrx*CA0*X/(rho*Cp)  // °C adiabatic rise
  const T_peak = T_op + dT_ad

  // ── 4_BATCH ────────────────────────────────────────────────────
  const t_rx_s = n_order===1
    ? -Math.log(1-X)/k
    : X/(k*Math.pow(CA0,n_order-1)*(1-X))  // 2nd order simplified
  const t_rx_h = t_rx_s/3600
  const V_batch = FA0*t_rx_s*2/(X*CA0)  // ×2 for downtime (50% utilisation)
  const batches_day = 24/(t_rx_h+t_rx_h*1.0)  // 50% downtime
  const Q_cool_batch = FA0*Math.abs(dHrx)*X  // W

  // ── 5_CSTR ─────────────────────────────────────────────────────
  const V_cstr = FA0*X/Math.max(rA_exit,1e-10)  // m³
  const tau_cstr = V_cstr/v0
  const D_cstr = Math.pow(4*V_cstr/Math.PI/1.5, 1/3)
  const H_cstr = 1.5*D_cstr
  const Q_gen = FA0*Math.abs(dHrx)*X  // W (exothermic)
  const Q_remove = U_HT*A_HT*(T_op-T_c)
  const hb_check = Math.abs(Q_gen-Q_remove)/Math.max(Q_gen,1)*100
  const A_HT_req = Q_gen/Math.max(U_HT*(T_op-T_c),1)
  const kappa = U_HT*A_HT*tau_cstr/(rho*Cp*V_cstr)

  // ── 6_PFR ──────────────────────────────────────────────────────
  const V_pfr = n_order===1
    ? FA0*(-Math.log(1-X))/(k*CA0)
    : FA0*X/(k*Math.pow(CA0,n_order)*(1-X)*(1-X)*0.5+1e-15)
  const tau_pfr = V_pfr/v0
  const L_pfr = V_pfr/(Math.PI/4*D_rx*D_rx)
  const LD_pfr = L_pfr/D_rx
  const V_ratio = V_cstr/Math.max(V_pfr,1e-10)
  const Q_pfr = Q_gen  // same total heat
  const W_cat = rho_cat*V_pfr*(1-eps_b)

  // ── 7_FIXEDBED ─────────────────────────────────────────────────
  const A_cross = Math.PI/4*D_rx*D_rx
  const us = v0/A_cross
  const Re_p = rho*us*dp/(mu*(1-eps_b))
  // Ergun equation (Eq 2.111)
  const dP_L = 150*mu*us*Math.pow(1-eps_b,2)/(dp*dp*Math.pow(eps_b,3))
    + 1.75*rho*us*us*(1-eps_b)/(dp*Math.pow(eps_b,3))  // Pa/m
  const dP_bed = dP_L*L_rx/1000  // kPa
  const dP_check = dP_bed/(P_op)*100  // % of P_op
  // Diffusion
  const eps_p = 0.35, tau_tort = 3.0
  const D_eff = D_AB*eps_p/tau_tort
  const phi_thiele = (dp/6)*Math.sqrt(k/D_eff)
  const eta_aris = 1/(1+phi_thiele*phi_thiele/3)  // Aris approximation
  // External mass transfer (Mears criterion)
  const Sc = mu/(rho*D_AB)
  const Sh = 2+0.6*Math.pow(Math.max(Re_p,0.01),0.5)*Math.pow(Sc,1/3)
  const kc = Sh*D_AB/dp
  const rho_b = rho_cat*(1-eps_b)
  const r_obs = k*CA0*(1-X)
  const mears = r_obs*rho_b*dp/(2*kc*CA0)

  // ── 8_HEATTRANS ────────────────────────────────────────────────
  const Q_sens = FA0*(mw_approx=90)*Cp*(T_op-T0)/1000  // rough; FA0 in mol/s → kg/s approx
  var mw_approx=90  // g/mol approximation
  const mdot = FA0*mw_approx/1000  // kg/s rough
  const Q_sens2 = mdot*Cp*(T_op-T0)
  const Q_tot = Q_gen + Q_sens2
  const dT1_jkt = T_op-T_c-10, dT2_jkt = T_op-T_c
  const LMTD_jkt = Math.abs(dT1_jkt-dT2_jkt)<0.1?dT2_jkt:(dT1_jkt-dT2_jkt)/Math.log(Math.abs(dT1_jkt/dT2_jkt))
  const A_jkt_req = Q_tot/Math.max(U_HT*LMTD_jkt,1)
  const A_jkt_avail = Math.PI*D_rx*L_rx
  const A_coil_extra = Math.max(0, A_jkt_req-A_jkt_avail)
  // Semenov number
  const Se = Q_gen/(U_HT*A_HT*(T_K))
  const dQgen_dT = -dHrx*FA0*X*(Ea/(R_gas*T_K*T_K))  // W/°C
  const slope_ok = U_HT*A_HT > dQgen_dT

  // ── 9_ECONOMICS ────────────────────────────────────────────────
  // Active volume
  const V_active = V_cstr  // CSTR as primary
  const V_design = V_active*1.15  // +15% safety
  // Turton (Eq): ln(Cp0) = 3.8751 + 0.3328·ln(V_gal) + 0.1908·(ln(V_gal))²
  const V_gal = V_design*264.172
  const Cp0 = Math.exp(3.8751+0.3328*Math.log(Math.max(V_gal,0.5))+0.1908*Math.pow(Math.log(Math.max(V_gal,0.5)),2))*CEPCI
  const CBM = FBM*Cp0
  const OPEX_util = Q_gen*opHours*3600/2000/steamCost*0.001  // rough steam
  const OPEX_RM = cA_cost*FA0*opHours*3600
  const OPEX_total = OPEX_util+OPEX_RM

  // Selection table
  const selTable = [
    {type:'CSTR', mode:'Continuous, well-mixed', X:'Low per stage', exo:'Excellent', V:f3(V_cstr)+' m³'},
    {type:'PFR',  mode:'Plug flow, tubular',     X:'High conversion', exo:'Moderate jacket', V:f3(V_pfr)+' m³'},
    {type:'Batch',mode:'Semi-batch or batch',    X:'Any',           exo:'Cooling coil', V:f3(V_batch)+' m³'},
    {type:'Fixed bed',mode:'Heterogeneous cat.',X:'High conversion', exo:'Limited', V:f3(V_pfr)+' m³'},
  ]
  const X_vals = [0,0.2,0.4,0.6,0.8,0.9,0.95]
  const levenspiel = X_vals.map(xi => ({
    X: xi,
    '1/(-rA)': +(1/Math.max(k*Math.pow(CA0*(1-xi),n_order),1e-15)).toFixed(4),
    V_CSTR: +(FA0*xi/Math.max(k*Math.pow(CA0*(1-xi),n_order),1e-15)).toFixed(4),
    V_PFR: +(n_order===1?FA0*(-Math.log(1-Math.max(xi,0.001)))/(k*CA0):FA0*xi/(k*Math.pow(CA0,n_order)*Math.pow(1-xi,n_order))).toFixed(4),
  }))

  const checks = [
    { l:'k > 0 at T_op',          pass:k>0,             v:`k = ${k.toExponential(3)} s⁻¹` },
    { l:'Da reasonable (0.1–100)', pass:Da>=0.1&&Da<=100,v:`Da = ${Da.toFixed(2)}` },
    { l:'ΔT_adiabatic < 100°C',   pass:Math.abs(dT_ad)<100,v:`ΔT_ad = ${dT_ad.toFixed(1)} °C` },
    { l:'Heat balance: Q_gen ≈ Q_rem',pass:hb_check<10, v:`imbalance = ${hb_check.toFixed(1)}%` },
    { l:'A_HT ≥ A_HT_req',        pass:A_HT>=A_HT_req, v:`${A_HT} ≥ ${A_HT_req.toFixed(2)} m²` },
    { l:'Semenov Se < 0.25 (stable)',pass:Se<0.25,      v:`Se = ${Se.toFixed(3)}` },
    { l:'Slope U·A > dQ_gen/dT',   pass:slope_ok,       v:`${(U_HT*A_HT).toFixed(0)} vs ${dQgen_dT.toFixed(0)} W/°C` },
    { l:'Bed ΔP/P_op < 10%',       pass:dP_check<10,   v:`ΔP/P = ${dP_check.toFixed(1)}%` },
    { l:'η_Aris ≥ 0.80 (no diffusion limit)',pass:eta_aris>=0.80,v:`η = ${eta_aris.toFixed(3)}` },
    { l:'Mears criterion < 0.15',  pass:mears<0.15,     v:`Mears = ${mears.toFixed(3)}` },
  ]

  function f3(v){ return v==null?'—':(+v).toFixed(3) }

  return {
    // Kinetics
    k, dT_double:+dT_double.toFixed(1), k_plus10,
    CA_exit:+CA_exit.toFixed(2), rA_exit:+rA_exit.toFixed(4), rA_feed:+rA_feed.toFixed(4),
    tau_geom:+tau_geom.toFixed(1), Da:+Da.toFixed(3), X_cstr_da:+(X_cstr_da*100).toFixed(1),
    dT_ad:+dT_ad.toFixed(1), T_peak:+T_peak.toFixed(1),
    // Batch
    t_rx_s:+t_rx_s.toFixed(1), t_rx_h:+t_rx_h.toFixed(3), V_batch:+V_batch.toFixed(4),
    batches_day:+batches_day.toFixed(1), Q_cool_batch:+Q_cool_batch.toFixed(0),
    // CSTR
    V_cstr:+V_cstr.toFixed(4), tau_cstr:+tau_cstr.toFixed(1),
    D_cstr:+D_cstr.toFixed(3), H_cstr:+H_cstr.toFixed(3),
    Q_gen:+Q_gen.toFixed(0), Q_remove:+Q_remove.toFixed(0), hb_check:+hb_check.toFixed(1),
    A_HT_req:+A_HT_req.toFixed(2), kappa:+kappa.toFixed(3),
    // PFR
    V_pfr:+V_pfr.toFixed(4), tau_pfr:+tau_pfr.toFixed(1), L_pfr:+L_pfr.toFixed(2),
    LD_pfr:+LD_pfr.toFixed(1), V_ratio:+V_ratio.toFixed(2), Q_pfr:+Q_pfr.toFixed(0),
    W_cat:+W_cat.toFixed(1),
    // Fixed bed
    us:+us.toFixed(4), Re_p:+Re_p.toFixed(2), dP_L:+dP_L.toFixed(1), dP_bed:+dP_bed.toFixed(3),
    dP_check:+dP_check.toFixed(1), D_eff:+D_eff.toExponential(3),
    phi_thiele:+phi_thiele.toFixed(3), eta_aris:+eta_aris.toFixed(3),
    Sc:+Sc.toFixed(1), Sh:+Sh.toFixed(2), kc:+kc.toFixed(5), mears:+mears.toFixed(4),
    // Heat
    Q_sens2:+Q_sens2.toFixed(0), Q_tot:+Q_tot.toFixed(0), LMTD_jkt:+LMTD_jkt.toFixed(1),
    A_jkt_req:+A_jkt_req.toFixed(2), A_jkt_avail:+A_jkt_avail.toFixed(2),
    A_coil_extra:+A_coil_extra.toFixed(2), Se:+Se.toFixed(4), dQgen_dT:+dQgen_dT.toFixed(0),
    slope_ok,
    // Econ
    V_design:+V_design.toFixed(4), Cp0:+Cp0.toFixed(0), CBM:+CBM.toFixed(0),
    OPEX_util:+OPEX_util.toFixed(0), OPEX_RM:+OPEX_RM.toFixed(0), OPEX_total:+OPEX_total.toFixed(0),
    selTable, levenspiel, checks,
  }
}
