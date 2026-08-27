// ── Rotary Equipment Simulator Engine ───────────────────────────────────────

export const DEFAULTS = {
  machineType: 'centrifugal',  // 'centrifugal' | 'pd' | 'compressor'
  // System
  Q:     0.05,   // m³/s
  H:     50,     // m head
  rho:   1000,   // kg/m³
  mu:    0.001,  // Pa·s
  Pv:    3000,   // Pa vapour pressure
  // Piping
  Ls: 5, ds: 0.10,  // suction
  Ld: 30, dd: 0.08, // discharge
  zs: 0,             // suction static head (m)
  eps: 0.046e-3,     // roughness m
  Ps: 101325,        // suction tank pressure Pa
  // Pump
  N:         1450,   // rpm
  eta_pump:  0.72,
  eta_motor: 0.92,
  eta_gear:  0.85,
  // Compressor
  P1: 101.325,    // kPa inlet
  P2: 600,        // kPa outlet
  T1: 298.15,     // K inlet
  gamma: 1.4,     // specific heat ratio
  MW_gas: 29,     // g/mol
  eta_poly: 0.78,
  // VFD
  N2_frac: 0.80,  // speed ratio N2/N1
}

function swameeJain(Re, eps, d) {
  if (Re < 2100) return 64 / Re
  return 0.25 / Math.pow(Math.log10(eps / (3.7 * d) + 5.74 / Math.pow(Math.max(Re, 1), 0.9)), 2)
}

export function calculate(inp) {
  const p = { ...DEFAULTS, ...inp }
  const g = 9.81
  const R_gas = 8314  // J/(kmol·K)

  // ── System curve ─────────────────────────────────────────────────────────
  const vs = p.Q / (Math.PI / 4 * p.ds * p.ds)
  const vd = p.Q / (Math.PI / 4 * p.dd * p.dd)
  const Re_s = p.rho * vs * p.ds / p.mu
  const Re_d = p.rho * vd * p.dd / p.mu
  const fs = swameeJain(Re_s, p.eps, p.ds)
  const fd = swameeJain(Re_d, p.eps, p.dd)
  const hf_s = fs * p.Ls / p.ds * vs * vs / (2 * g)
  const hf_d = fd * p.Ld / p.dd * vd * vd / (2 * g)
  const hm_s = 0.5 * vs * vs / (2 * g)  // entrance loss
  const hm_d = 1.0 * vd * vd / (2 * g)  // exit loss
  const H_system = hf_s + hf_d + hm_s + hm_d + p.H  // p.H = static head

  // ── Centrifugal pump ─────────────────────────────────────────────────────
  const Ns = p.N * Math.pow(p.Q, 0.5) / Math.pow(Math.max(H_system, 1), 0.75)
  const n_stages = Math.max(1, Math.ceil(H_system / 120))
  const psi = 0.45
  const u2 = Math.sqrt(psi * H_system / n_stages * g)
  const D2 = 60 * u2 / (Math.PI * p.N / 60)  // m
  const H0 = H_system * 1.20
  const K_curve = (H0 - H_system) / (p.Q * p.Q)
  const P_hyd = p.rho * g * p.Q * H_system / 1000  // kW
  const P_shaft = P_hyd / p.eta_pump
  const P_motor = P_shaft / p.eta_motor
  const IEC_sizes = [0.37,0.55,0.75,1.1,1.5,2.2,3,4,5.5,7.5,11,15,18.5,22,30,37,45,55,75,90,110,132,160,200,250,315]
  const P_IEC = IEC_sizes.find(s => s >= P_motor * 1.1) || 315

  // ── NPSH ────────────────────────────────────────────────────────────────
  const NPSHA = p.Ps / (p.rho * g) - p.Pv / (p.rho * g) + vs * vs / (2 * g) + p.zs - hf_s - hm_s
  const NPSHR = Math.max(0.5, H_system * 0.08)  // typical 8% of total head
  const margin = NPSHA - NPSHR
  const Ss = p.N * Math.pow(p.Q, 0.5) / Math.pow(Math.max(NPSHR, 0.01), 0.75)

  // ── HI Viscosity correction ──────────────────────────────────────────────
  const nu = p.mu / p.rho * 1e6  // cSt
  const B = 16.5 * Math.pow(p.Q, 0.0625) / Math.pow(Math.max(H_system, 1), 0.25) / Math.pow(Math.max(nu, 0.1), 0.5)
  const CQ = 1 - 0.0547 * Math.pow(1 - Math.exp(-6.19 / Math.max(B, 0.001)), 0.73)
  const CH = 1 - 0.0835 * Math.pow(1 - Math.exp(-6.19 / Math.max(B, 0.001)), 0.97)
  const Ceta = 1 - 0.703 * (1 - Math.exp(-B / 3.7))

  // ── Compressor ───────────────────────────────────────────────────────────
  const rp = p.P2 / p.P1
  const n_exp = p.gamma / (p.gamma - 1) / p.eta_poly * (p.gamma - 1) / p.gamma  // n/(n-1) rearranged
  const n_poly = 1 / (1 - (p.gamma - 1) / (p.gamma * p.eta_poly))
  const T2s = p.T1 * Math.pow(rp, (p.gamma - 1) / p.gamma)
  const T2a = p.T1 + (T2s - p.T1) / p.eta_poly
  const W_is = p.gamma / (p.gamma - 1) * R_gas * p.T1 / p.MW_gas * (Math.pow(rp, (p.gamma - 1) / p.gamma) - 1)
  const rho1 = p.P1 * 1000 * p.MW_gas / (R_gas * p.T1)
  const mdot = p.Q * rho1
  const P_comp = mdot * W_is / p.eta_poly / 1000  // kW

  // ── Affinity laws ─────────────────────────────────────────────────────────
  const Q2 = p.Q * p.N2_frac
  const H2 = H_system * p.N2_frac * p.N2_frac
  const P2_aff = P_motor * Math.pow(p.N2_frac, 3)
  const power_saving = P_motor - P2_aff

  // ── Shaft design ─────────────────────────────────────────────────────────
  const T_shaft = P_shaft * 1000 * 60 / (2 * Math.PI * p.N)
  const Sy = 550e6  // Pa (4140 steel)
  const tau = Sy / (2 * 2.0)
  const d_min = Math.pow(16 * T_shaft / (Math.PI * tau), 1/3) * 1000  // mm
  const d_shaft = Math.ceil(d_min / 5) * 5

  // Dunkerley critical speed
  const E_steel = 200e9
  const I_shaft = Math.PI / 64 * Math.pow(d_shaft / 1000, 4)
  const L_span  = d_shaft / 1000 * 15
  const m_rotor = 7800 * Math.PI / 4 * Math.pow(d_shaft / 1000, 2) * L_span * 1.5
  const N_crit  = Math.pow(Math.PI / L_span, 2) * Math.sqrt(E_steel * I_shaft / m_rotor) * 60 / (2 * Math.PI)
  const speed_ratio = p.N / N_crit

  // ── H-Q curve data ────────────────────────────────────────────────────────
  const hqCurve = Array.from({ length: 21 }, (_, i) => {
    const q = i / 20 * p.Q * 1.4
    const h_pump = Math.max(0, H0 - K_curve * q * q)
    const h_sys  = hf_s + fd * p.Ld / p.dd * Math.pow(q / p.Q, 2) * vd * vd / (2 * g) + p.H
    return { Q: +(q * 3600).toFixed(1), 'Pump head': +h_pump.toFixed(1), 'System head': +h_sys.toFixed(1) }
  })

  // ── Checks ────────────────────────────────────────────────────────────────
  const checks = [
    { label: 'NPSH margin ≥ 0.6 m (HI)',         pass: margin >= 0.6,           value: `NPSHA−NPSHR = ${margin.toFixed(2)} m`    },
    { label: 'NPSH margin ≥ 1.0 m (API 610)',     pass: margin >= 1.0,           value: `Margin = ${margin.toFixed(2)} m`         },
    { label: 'Suction specific speed Ss < 210',   pass: Ss < 210,                value: `Ss = ${Ss.toFixed(0)}`                  },
    { label: 'System head vs pump head',           pass: H0 > H_system,          value: `H_pump = ${H0.toFixed(1)}, H_sys = ${H_system.toFixed(1)} m`},
    { label: 'Impeller tip speed u₂ < 65 m/s',   pass: u2 < 65,                 value: `u₂ = ${u2.toFixed(1)} m/s`             },
    { label: 'Shaft diameter adequate',            pass: d_shaft >= d_min,        value: `d = ${d_shaft} mm, d_min = ${d_min.toFixed(1)} mm`},
    { label: 'Critical speed ratio < 0.75',       pass: speed_ratio < 0.75,      value: `N/N_crit = ${speed_ratio.toFixed(2)}`   },
    { label: 'IEC motor selected',                 pass: P_IEC >= P_motor * 1.1, value: `P_IEC = ${P_IEC} kW, P_req = ${P_motor.toFixed(1)} kW`},
    { label: 'Compressor T₂ < 200°C',             pass: T2a - 273.15 < 200,     value: `T₂ = ${(T2a - 273.15).toFixed(1)} °C` },
    { label: 'HI viscosity correction needed',     pass: B >= 1,                  value: `B = ${B.toFixed(2)} (≥1 = mild)`        },
  ]

  return {
    H_system: +H_system.toFixed(1), Ns: +Ns.toFixed(0), n_stages,
    u2: +u2.toFixed(2), D2: +(D2*1000).toFixed(0),
    P_hyd: +P_hyd.toFixed(2), P_shaft: +P_shaft.toFixed(2), P_motor: +P_motor.toFixed(2), P_IEC,
    NPSHA: +NPSHA.toFixed(2), NPSHR: +NPSHR.toFixed(2), margin: +margin.toFixed(2), Ss: +Ss.toFixed(0),
    CQ: +CQ.toFixed(3), CH: +CH.toFixed(3), Ceta: +Ceta.toFixed(3),
    T2a: +(T2a - 273.15).toFixed(1), P_comp: +P_comp.toFixed(1), rp: +rp.toFixed(2),
    Q2: +(Q2 * 3600).toFixed(1), H2: +H2.toFixed(1), P2_aff: +P2_aff.toFixed(2), power_saving: +power_saving.toFixed(2),
    d_min: +d_min.toFixed(1), d_shaft, T_shaft: +T_shaft.toFixed(0), N_crit: +N_crit.toFixed(0), speed_ratio: +speed_ratio.toFixed(3),
    checks, hqCurve,
  }
}
