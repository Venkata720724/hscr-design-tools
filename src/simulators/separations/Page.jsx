import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import SimPage, { TabBar, MetricCard, ResultTable, SectionHead, Check, Field, SelectField, InputSection, ModelGuide, CalcSpinner, EmptyState, CalcButton, SectionIncomplete } from '../../components/SimPage'
import { calculate } from '../../lib/calculate'
import { saveRun } from '../../lib/history'

const TABS = [
  {id:'sample',  label:'Sample Calculation'},
  {id:'absorb',  label:'Absorption (Kremser)'},
  {id:'strip',   label:'Stripping'},
  {id:'extract', label:'Liquid-Liquid Extraction'},
  {id:'cryst',   label:'Crystallisation'},
  {id:'dry',     label:'Drying'},
  {id:'checks',  label:'Design Checks'},
]

const SAMPLE = {
  G:10, y1:0.05, y2:0.002, x2:0, m_abs:0.5, L_abs:15, D_abs:0.8, HTU:0.5,
  L_str:20, x1_str:0.04, x2_str:0.002, G_str:15, m_str:2,
  F_ext:100, zF:0.1, xR:0.01, S_ext:80, D_ext:2.5,
  C_feed:300, C_sat:80, w_s:0.21, V_feed:10, rho_cryst:2680,
  X_in:0.3, X_out:0.05, m_dry:500, X_c:0.15, N_const:3, T_air:90,
}
const EMPTY = Object.fromEntries(Object.keys(SAMPLE).map(k=>[k,'']))

const DRYER_TYPES = [
  {value:'rotary',  label:'Rotary dryer — granules, pellets, crystals'},
  {value:'spray',   label:'Spray dryer — slurries, solutions'},
  {value:'tray',    label:'Tray (shelf) dryer — batch, fragile solids'},
  {value:'fluid',   label:'Fluidised bed dryer — fine particles, uniform drying'},
  {value:'drum',    label:'Drum (contact) dryer — pastes, slurries'},
]

export default function SeparationsPage() {
  const location = useLocation()
  const [inp, setInp] = useState(EMPTY)
  const [tab, setTab] = useState('sample')
  const [r, setR] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setInp(p => ({...p, [k]: v}))
  const f = (v, d=2) => v == null ? '—' : (+v).toFixed(d)

  useEffect(() => {
    const state = location.state
    if (state?.restore && state?.inputs) {
      setInp(state.inputs)
      if (state.results) { setR(state.results); setTab('absorb') }
    }
  }, [])

  const hasAbsorb = () => ['G','y1','y2','m_abs','L_abs','HTU'].every(k=>inp[k]!=='')
  const hasStrip  = () => ['L_str','x1_str','x2_str','G_str','m_str'].every(k=>inp[k]!=='')
  const hasExt    = () => ['F_ext','zF','xR','S_ext','D_ext'].every(k=>inp[k]!=='')
  const hasCryst  = () => ['C_feed','C_sat','V_feed'].every(k=>inp[k]!=='')
  const hasDry    = () => ['X_in','X_out','m_dry','X_c','N_const'].every(k=>inp[k]!=='')

  const runCalc = async () => {
    setLoading(true); setErr('')
    try {
      const nums = Object.fromEntries(Object.entries(inp).map(([k,v])=>[k,typeof v==='string'&&v!==''&&!isNaN(+v)?+v:v]))
      const res = await calculate('separations', nums)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('absorb'); await saveRun('separations','Separations', nums, res) }
    } catch(e) { setErr('Calculation error: '+e.message) }
    finally { setLoading(false) }
  }

  const loadSample = async () => {
    setInp(SAMPLE); setLoading(true); setErr('')
    try {
      const res = await calculate('separations', SAMPLE)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('absorb') }
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <SimPage name="Separations"
      tagline="Kremser absorption/stripping, NTU-HTU, Kremser stages, Hunter-Nash liquid-liquid extraction, crystal yield, drying rate equations for 5 separation operations.">
      <div className="flex gap-8">
        <div className="w-[300px] flex-shrink-0 overflow-y-auto" style={{maxHeight:'85vh'}}>

          <InputSection>Gas absorption</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug amber-note">Absorption: solute transfers from gas to liquid. Typical applications: CO₂ scrubbing, SO₂ removal, H₂S absorption in amine contactors.</p>
          <Field label="Gas feed rate G" unit="kmol/h" value={inp.G} onChange={v=>set('G',v)} min={0.01}
            hint="Inert carrier gas (solute-free basis). CO₂ scrubbing: total flue gas - CO₂. Amine contactors: total gas on inlet side."/>
          <Field label="Inlet gas y1 (mole fraction)" value={inp.y1} onChange={v=>set('y1',v)} min={0} max={1} step={0.001}
            hint="Inlet solute mole fraction in gas. CO₂ scrubbing: 0.10–0.15 (10–15 mol%). H₂S removal: 0.01–0.05. VOC: 0.001–0.05."/>
          <Field label="Outlet gas y2 (target)" value={inp.y2} onChange={v=>set('y2',v)} min={0} max={0.99} step={0.0001}
            hint="Exit gas target. Drives recovery efficiency = (y1−y2)/y1. CO₂ < 500 ppm (y < 0.0005). H₂S < 4 ppm."/>
          <Field label="Inlet solvent composition x2" value={inp.x2} onChange={v=>set('x2',v)} min={0} max={0.5} step={0.001}
            hint="Solute in incoming solvent. Pure solvent: x2 = 0. Regenerated amine (lean loading): x2 = 0.01–0.05 mol fraction."/>
          <Field label="Henry's constant m (y* = mx)" value={inp.m_abs} onChange={v=>set('m_abs',v)} min={0.001} step={0.05}
            hint="Slope of equilibrium line y* = m×x. m < 1 = favourable for absorption (solute prefers liquid). CO₂ in water: m ≈ 0.8. SO₂ in water: m ≈ 0.02. Higher temperature → higher m (harder to absorb)."/>
          <Field label="Liquid flow rate L (operating)" unit="kmol/h" value={inp.L_abs} onChange={v=>set('L_abs',v)} min={0.01}
            hint="Operating solvent flow. Must be > L_min for feasible absorption. L/G > 1.2×(L/G)_min is standard. Absorption factor A = L/(m×G) must be > 1."/>
          <Field label="Column diameter D_col" unit="m" value={inp.D_abs} onChange={v=>set('D_abs',v)} min={0.05}
            hint="From flooding velocity design. For lab-scale: 0.05–0.15m. Pilot: 0.15–0.5m. Industrial: 0.5–5m."/>
          <Field label="Height of Transfer Unit HTU" unit="m" value={inp.HTU} onChange={v=>set('HTU',v)} min={0.1} step={0.05}
            hint="Packing efficiency parameter. Structured packing (Sulzer MellapakTM): 0.3–0.8m. Random packing (25mm Pall rings): 0.5–1.5m. Large rings: 1.0–2.0m."/>

          <InputSection>Stripping</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug amber-note">Stripping: solute transfers from liquid to gas. Used to remove dissolved gases or regenerate solvents.</p>
          <Field label="Liquid feed rate L_str" unit="kmol/h" value={inp.L_str} onChange={v=>set('L_str',v)} min={0.01}
            hint="Feed liquid to be stripped (rich solvent). Enter on inert solvent basis."/>
          <Field label="Inlet liquid x1_str" value={inp.x1_str} onChange={v=>set('x1_str',v)} min={0} max={1} step={0.001}
            hint="Inlet solute mole fraction in liquid. Rich amine loading: 0.03–0.05. Dissolved O₂ in boiler feedwater: 0.0001."/>
          <Field label="Target outlet x2_str" value={inp.x2_str} onChange={v=>set('x2_str',v)} min={0} max={0.5} step={0.0001}
            hint="Required exit liquid composition after stripping (lean condition). Regenerated amine: 0.01–0.02."/>
          <Field label="Stripping gas G_str" unit="kmol/h" value={inp.G_str} onChange={v=>set('G_str',v)} min={0.01}
            hint="Steam or inert gas for stripping. Steam stripping: uses steam as carrier, condensed downstream."/>
          <Field label="Stripping factor m_str (y*/x)" value={inp.m_str} onChange={v=>set('m_str',v)} min={0.01} step={0.1}
            hint="Equilibrium ratio at stripping conditions. m > 1 favours stripping (solute prefers vapour). High temperature → high m. Stripping factor S = m×G/L must be > 1."/>

          <InputSection>Liquid-liquid extraction</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug amber-note">Extraction: solute transferred from aqueous feed to organic solvent. Used when distillation is not feasible (close boiling, thermally sensitive).</p>
          <Field label="Feed flow rate F_ext" unit="kg/h" value={inp.F_ext} onChange={v=>set('F_ext',v)} min={0.01}
            hint="Aqueous feed containing solute to extract. Rate of feed phase entering the extractor."/>
          <Field label="Solute in feed z_F (mass fraction)" value={inp.zF} onChange={v=>set('zF',v)} min={0} max={0.99} step={0.01}
            hint="Mass fraction of solute in feed. 0.10 = 10 wt%. Pharmaceutical API: typically 0.001–0.05. Metals extraction: 0.05–0.30."/>
          <Field label="Target raffinate x_R" value={inp.xR} onChange={v=>set('xR',v)} min={0} max={0.5} step={0.001}
            hint="Required solute mass fraction in final raffinate (depleted feed phase). Lower = more stages or more solvent required."/>
          <Field label="Solvent flow rate S_ext" unit="kg/h" value={inp.S_ext} onChange={v=>set('S_ext',v)} min={0.01}
            hint="Organic solvent flow. S_min from mass balance where operating line touches equilibrium line. Use 1.2–1.5×S_min."/>
          <Field label="Distribution ratio K_D (y/x)" value={inp.D_ext} onChange={v=>set('D_ext',v)} min={0.01} step={0.1}
            hint="Ratio of solute concentration in solvent extract to raffinate at equilibrium. K_D > 1 = favours solvent phase (good extraction). K_D < 1 = many stages needed."/>

          <InputSection>Crystallisation</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug amber-note">Cooling or evaporative crystallisation from solution. Yield = mass of crystals obtained from feed solution.</p>
          <Field label="Feed concentration C_feed" unit="g/L" value={inp.C_feed} onChange={v=>set('C_feed',v)} min={0.01}
            hint="Solute concentration in hot feed solution. Na₂SO₄ at 30°C: 400 g/L. KNO₃ at 70°C: 1360 g/L. NaCl at 60°C: 370 g/L."/>
          <Field label="Saturation concentration C_sat" unit="g/L" value={inp.C_sat} onChange={v=>set('C_sat',v)} min={0}
            hint="Solubility at the crystallisation temperature. Get from solubility data (Perry's, or CRC Handbook). Lower T → lower C_sat → higher yield."/>
          <Field label="Water of crystallisation w_s (mass fraction)" value={inp.w_s} onChange={v=>set('w_s',v)} min={0} max={0.8} step={0.01}
            hint="Fraction of water molecules per mole of crystal. Na₂SO₄·10H₂O: 0.56. CuSO₄·5H₂O: 0.36. Anhydrous crystals (KNO₃, NaCl): 0.0."/>
          <Field label="Feed volume V_feed" unit="m³" value={inp.V_feed} onChange={v=>set('V_feed',v)} min={0.001}
            hint="Batch volume or hourly throughput (for continuous crystalliser). Enter volume of hot solution to be processed."/>
          <Field label="Crystal density ρ_cryst" unit="kg/m³" value={inp.rho_cryst} onChange={v=>set('rho_cryst',v)} min={500}
            hint="Density of dry crystal product. Na₂SO₄=2680. KNO₃=2110. NaCl=2160. Sucrose=1590 kg/m³."/>

          <InputSection>Drying</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug amber-note">Thermal drying by hot air or gas. Drying rate divided into constant-rate period and falling-rate period at critical moisture X_c.</p>
          <SelectField label="Dryer type" value={inp.dryer_type||'rotary'} onChange={v=>set('dryer_type',v)} options={DRYER_TYPES}/>
          <Field label="Initial moisture X_in (wet basis)" unit="kg/kg wet" value={inp.X_in} onChange={v=>set('X_in',v)} min={0.01} max={0.99} step={0.01}
            hint="Initial moisture content on wet basis. X_in = m_water/(m_water + m_dry). Typical filter cake: 0.20–0.40. Crystalliser product: 0.05–0.15."/>
          <Field label="Final moisture X_out (wet basis)" unit="kg/kg wet" value={inp.X_out} onChange={v=>set('X_out',v)} min={0} max={0.5} step={0.01}
            hint="Target final moisture content. Bone dry: 0.0. Pharmaceutical: < 0.005. Food: 0.03–0.10. Fertiliser: 0.01–0.03."/>
          <Field label="Dry solid feed m_s" unit="kg dry/h" value={inp.m_dry} onChange={v=>set('m_dry',v)} min={0.01}
            hint="Mass flow rate of dry (bone-dry) solid. m_dry = m_wet × (1 − X_in)."/>
          <Field label="Critical moisture X_c" unit="kg/kg" value={inp.X_c} onChange={v=>set('X_c',v)} min={0} max={0.5} step={0.01}
            hint="Transition from constant-rate to falling-rate drying. Determined from drying curve. Above X_c: surface moisture controls. Below X_c: internal diffusion controls."/>
          <Field label="Constant drying rate N_const" unit="kg/(m²·h)" value={inp.N_const} onChange={v=>set('N_const',v)} min={0.01}
            hint="Rate during constant-rate period. Driven by external heat and mass transfer. From psychrometric chart: N = h×(T_air − T_wb)/(λ). Typical: 1–5 kg/(m²·h)."/>
          <Field label="Air temperature T_air" unit="°C" value={inp.T_air} onChange={v=>set('T_air',v)} min={30}
            hint="Drying air temperature. Higher T = faster drying but risk of product degradation. Pharmaceuticals: < 80°C. Food: < 120°C. Ceramics: 120–250°C."/>

          {err && <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg"><p className="text-[11.5px] text-red-600 leading-snug">{err}</p></div>}
          <CalcButton onClick={runCalc} loading={loading}/>
        </div>

        <div className="flex-1 min-w-0">
          <TabBar tabs={TABS} active={tab} onChange={setTab}/>
          {tab==='sample' && (
            <div className="w-full max-w-4xl">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
                <p className="text-[14px] font-semibold text-blue-900 mb-1">Sample — 5 separation operations, all active simultaneously</p>
                <p className="text-[12.5px] text-blue-700 mb-4">Absorption (CO₂ removal), stripping (solvent regeneration), liquid-liquid extraction, Na₂SO₄ crystallisation, rotary dryer. All sections calculate independently.</p>
                <button onClick={loadSample} className="text-[13px] font-semibold bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">Load and run sample →</button>
              </div>
              <SectionHead>Expected results</SectionHead>
              <ResultTable rows={[
                ['Absorption factor A','1.5 (> 1.2 = adequate solvent)',''],
                ['N_OG (transfer units)','5–10','—'],
                ['Column height Z = N_OG × HTU','2.5–5','m'],
                ['Stripping stages','4–8','—'],
                ['Crystal yield','≈ 55–65 kg/m³ feed','kg/m³'],
                ['Drying time','several hours','depends on rate'],
              ]}/>
            </div>
          )}
          {tab !== 'sample' && loading && <CalcSpinner/>}
          {tab !== 'sample' && !r && !loading && <EmptyState onSample={loadSample}/>}

          {r && tab==='absorb' && (!hasAbsorb() ? <SectionIncomplete section="Absorption"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Absorption factor A" value={f(r.A_abs,3)} unit="— (> 1.2 req.)" highlight/>
                <MetricCard label="N_OG (transfer units)" value={f(r.N_OG,2)} unit="—"/>
                <MetricCard label="Column height Z" value={f(r.Z_col,2)} unit="m" highlight/>
                <MetricCard label="Recovery η" value={f(r.eta_abs*100,1)} unit="%"/>
                <MetricCard label="L/G operating" value={f(r.LG_actual,3)} unit="—"/>
                <MetricCard label="(L/G)_min" value={f(r.LG_min,3)} unit="—"/>
                <MetricCard label="L/G ratio vs min" value={f(r.LG_ratio,2)} unit="× minimum"/>
                <MetricCard label="Kremser stages N" value={f(r.N_krem_abs,1)} unit="stages"/>
              </div>
              <ResultTable rows={[
                ['Absorption factor A = L/(m×G)',f(r.A_abs,3),'— (must be > 1.0 for feasible absorption)'],
                ['(L/G)_min = m×(y1−y2)/(y1/m−x2)',f(r.LG_min,3),'—'],
                ['N_OG (Kremser/NTU): N_OG = ln[(1−1/A)×(y1−m×x2)/(y2−m×x2)+1/A]/(1−1/A)',f(r.N_OG,2),'transfer units'],
                ['Column height Z = N_OG × HTU',f(r.Z_col,2),'m'],
                ['Kremser stages (plate column equivalent)',f(r.N_krem_abs,1),'theoretical stages'],
                ['x1 exit solvent (rich loading)',f(r.x1_exit,4),'mole fraction'],
                ['Absorption efficiency (y1−y2)/y1',f(r.eta_abs*100,1),'%'],
              ]}/>
            </div>
          ))}

          {r && tab==='strip' && (!hasStrip() ? <SectionIncomplete section="Stripping"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Stripping factor S" value={f(r.S_strip,3)} unit="— (> 1 req.)" highlight/>
                <MetricCard label="Kremser stages" value={f(r.N_str,1)} unit="stages"/>
                <MetricCard label="y1_strip (vapour out)" value={f(r.y1_str,4)} unit="mole fraction"/>
                <MetricCard label="Stripping efficiency" value={f(r.eta_str*100,1)} unit="%"/>
              </div>
              <ResultTable rows={[
                ['Stripping factor S = m×G_str/L_str',f(r.S_strip,3),'— (> 1.0 required for stripping to be feasible)'],
                ['Kremser stages N = ln[(x1−y_in/m)/(x2−y_in/m)×(1−1/S)+1/S]/ln(S)',f(r.N_str,1),'theoretical stages'],
                ['Vapour outlet y1_str (rich vapour)',f(r.y1_str,4),'mole fraction solute in exiting gas'],
                ['Stripping efficiency (x1−x2)/x1',f(r.eta_str*100,1),'%'],
              ]}/>
            </div>
          ))}

          {r && tab==='extract' && (!hasExt() ? <SectionIncomplete section="Extraction"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Extraction factor E" value={f(r.E_ext,3)} unit="— (> 1 req.)" highlight/>
                <MetricCard label="Kremser stages N" value={f(r.N_ext,1)} unit="stages"/>
                <MetricCard label="Extract y_E (loaded solvent)" value={f(r.y_E,4)} unit="mass fraction"/>
                <MetricCard label="Recovery %" value={f(r.eta_ext*100,1)} unit="%"/>
              </div>
              <ResultTable rows={[
                ['Extraction factor E = K_D × S_ext/F_ext',f(r.E_ext,3),'— (must be > 1.0 for practical extraction)'],
                ['Kremser stages N = ln[(z_F−y_E_min/K_D)/(x_R−y_E_min/K_D)×(1−1/E)+1/E]/ln(E)',f(r.N_ext,1),'theoretical stages'],
                ['Extract composition y_E',f(r.y_E,4),'mass fraction solute in extract phase'],
                ['Recovery = (z_F−x_R)/z_F',f(r.eta_ext*100,1),'%'],
                ['S_min (L/L minimum solvent)',f(r.S_min_ext,1),'kg/h'],
                ['S_actual / S_min',f(r.S_ratio_ext,2),'× (should be 1.2–1.5×)'],
              ]}/>
            </div>
          ))}

          {r && tab==='cryst' && (!hasCryst() ? <SectionIncomplete section="Crystallisation"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Supersaturation ratio" value={f(r.S_super,3)} unit="— (> 1 req.)" highlight/>
                <MetricCard label="Crystal yield Y" value={f(r.Y_cryst,1)} unit="kg/batch"/>
                <MetricCard label="Yield / feed volume" value={f(r.yield_per_m3,1)} unit="kg/m³"/>
                <MetricCard label="Crystal recovery" value={f(r.cryst_recovery*100,1)} unit="%"/>
              </div>
              <ResultTable rows={[
                ['Supersaturation ratio C_feed/C_sat',f(r.S_super,3),'— (must be > 1 for crystallisation to occur)'],
                ['Mass balance: Y = V_feed×[(C_feed−C_sat)×(1−w_s)/(1−w_s×C_sat/1000)]',f(r.Y_cryst,1),'kg crystals per batch'],
                ['Yield per unit feed volume',f(r.yield_per_m3,1),'kg/m³'],
                ['Solute recovery (crystals / feed solute)',f(r.cryst_recovery*100,1),'%'],
                ['Water removed with crystals (hydration)',f(r.W_hydration,1),'kg water'],
                ['Mother liquor volume remaining',f(r.V_mother,3),'m³'],
              ]}/>
            </div>
          ))}

          {r && tab==='dry' && (!hasDry() ? <SectionIncomplete section="Drying"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Water removed" value={f(r.W_water,1)} unit="kg/h" highlight/>
                <MetricCard label="t_constant rate" value={f(r.t_const,2)} unit="h"/>
                <MetricCard label="t_falling rate" value={f(r.t_fall,2)} unit="h"/>
                <MetricCard label="Dryer area required" value={f(r.A_dryer,1)} unit="m²"/>
                <MetricCard label="Drying duty Q_dry" value={f(r.Q_dry,0)} unit="W"/>
                <MetricCard label="Specific drying rate" value={f(r.spec_rate,2)} unit="kg/(m²·h)"/>
              </div>
              <ResultTable rows={[
                ['Moisture to remove ΔX = X_in − X_out',f(r.dX,3),'kg water/kg wet (wet basis)'],
                ['Water removed rate',f(r.W_water,1),'kg/h'],
                ['t_const = m_dry_free × (X_c_dry − X_out_dry) / (N_const × A)',f(r.t_const,2),'h'],
                ['t_fall (falling rate period) = m_dry_free×X_c_dry/(N_const×A)×ln(X_c_dry/X_out_dry)',f(r.t_fall,2),'h'],
                ['Total drying time per batch',f((r.t_const||0)+(r.t_fall||0),2),'h'],
                ['Dryer area required',f(r.A_dryer,1),'m²'],
                ['Drying duty Q_dry = m_water × λ_water',f(r.Q_dry,0),'W'],
              ]}/>
            </div>
          ))}

          {r && tab==='checks' && (
            <div>
              <p className="text-[12px] text-muted mb-4">10 design checks — all must be PASS.</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {r.checks?.map(c=><Check key={c.l} label={c.l} value={c.v} pass={c.pass}/>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </SimPage>
  )
}
