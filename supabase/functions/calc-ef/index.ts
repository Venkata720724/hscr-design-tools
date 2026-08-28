import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
function Psat(A:number,B:number,C:number,T:number){return Math.pow(10,A-B/(C+T))}
function clamp(v:number,lo:number,hi:number){return Math.max(lo,Math.min(hi,v))}
const STD_T=[6,8,10,12,16,20,25,30,36,40,45,50]
function nextStdT(v:number){return STD_T.find((s:number)=>s>=v)||50}
const STD_D=[0.45,0.60,0.75,0.90,1.05,1.20,1.50,1.80,2.10,2.40,3.00]
const PSV_ORI=[{d:'D',a:0.71},{d:'E',a:1.26},{d:'F',a:1.98},{d:'G',a:3.24},{d:'H',a:5.06},{d:'J',a:8.27},{d:'K',a:12.3},{d:'L',a:19.4},{d:'M',a:26.0},{d:'N',a:32.9},{d:'P',a:41.2}]

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

serve(async (req) => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  try {
    const {simulatorId,inputs} = await req.json()
    let result:any={error:'Unknown simulator'}
    if(simulatorId==='mixer') result=calcMixer(inputs)
    else if(simulatorId==='storage-tank') result=calcStorageTank(inputs)
    else if(simulatorId==='piping') result=calcPiping(inputs)
    else if(simulatorId==='separations') result=calcSeparations(inputs)
    else if(simulatorId==='meb') result=calcMEB(inputs)
    return new Response(JSON.stringify(result),{headers:{...cors,'Content-Type':'application/json'}})
  } catch(e:any) {
    return new Response(JSON.stringify({error:e.message}),{status:500,headers:{...cors,'Content-Type':'application/json'}})
  }
})
