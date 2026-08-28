import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import SimPage, {
  TabBar, MetricCard, ResultTable, SectionHead, Check,
  Field, SelectField, InputSection, ModelGuide,
  CalcSpinner, EmptyState, CalcButton, SectionIncomplete
} from '../../components/SimPage'
import { calculate } from '../../lib/calculate'
import { saveRun } from '../../lib/history'

const TABS = [
  { id:'sample',   label:'Sample Calculation' },
  { id:'shell',    label:'Shell (ASME UG-27)' },
  { id:'heads',    label:'Heads (UG-32)' },
  { id:'nozzles',  label:'Nozzles (UG-37)' },
  { id:'flanges',  label:'Flanges' },
  { id:'supports', label:'Supports' },
  { id:'relief',   label:'Relief (API 520)' },
  { id:'weight',   label:'Weight & Loads' },
  { id:'tall',     label:'Wind & Seismic' },
  { id:'checks',   label:'Design Checks' },
]

const SAMPLE = {
  orientation:'vertical', Pd:2, Pop:1.7, Td:250, CA:3, Ej:1.0,
  Di:1.5, L_tt:6,
  headType:'ellipsoidal', r_cr:1.5, r_k:0.09, cone_alpha:30,
  S_allow:138, Sy:220, Su:485, rho_steel:7850,
  d_n1:0.2, S_n1:138, d_n2:0.15, S_n2:138,
  rho_fluid:800, t_ins:75, rho_ins:150, W_plat:2500, W_pipe:3000,
  H_sk:3, D_sk:1.6, b_sad:0.2, theta_sad:120, A_sad:0.5,
  Vw:47, Ss:0.25,
  P_set:2, MW_relief:30, T_relief:250, W_relief:5000,
  flange_class:'300',
  CEPCI:820, CEPCIbase:397, FBM:4.16,
}
const EMPTY = Object.fromEntries(Object.keys(SAMPLE).map(k=>[k,'']))

const HEAD_TYPES = [
  { value:'ellipsoidal', label:'2:1 Semi-ellipsoidal — most common, ASME UG-32(d)' },
  { value:'hemispherical', label:'Hemispherical — thinnest wall, high pressure' },
  { value:'torispherical', label:'Torispherical (Klopper) — standard ASME flange & dished' },
  { value:'conical', label:'Conical — transition sections, hoppers' },
  { value:'flat', label:'Flat — low pressure, jacketed vessels' },
]
const ORIENTATIONS = [
  { value:'vertical', label:'Vertical — use skirt support, wind/seismic analysis' },
  { value:'horizontal', label:'Horizontal — use saddle supports, Zick analysis' },
]
const FLANGE_CLASSES = [
  { value:'150', label:'ASME 150# — up to ~2 MPa depending on temperature' },
  { value:'300', label:'ASME 300# — up to ~5 MPa' },
  { value:'600', label:'ASME 600# — up to ~10 MPa' },
  { value:'900', label:'ASME 900# — up to ~15 MPa' },
  { value:'1500', label:'ASME 1500# — high pressure' },
]

export default function PressureVesselPage() {
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
      if (state.results) { setR(state.results); setTab('shell') }
    }
  }, [])

  const hasCore = () => ['Pd','Di','L_tt','S_allow','CA','Ej'].every(k=>inp[k]!=='')

  const runCalc = async () => {
    if (!hasCore()) { setErr('Fill required design conditions and geometry fields (*)'); return }
    setLoading(true); setErr('')
    try {
      const nums = Object.fromEntries(Object.entries(inp).map(([k,v])=>[k, typeof v === 'string' && v!=='' && !isNaN(+v)?+v:v==='null'?0:v]))
      const res = await calculate('pressure-vessel', nums)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('shell'); await saveRun('pressure-vessel','Pressure Vessel', nums, res) }
    } catch(e) { setErr('Calculation error: '+e.message) }
    finally { setLoading(false) }
  }

  const loadSample = async () => {
    setInp(SAMPLE); setLoading(true); setErr('')
    try {
      const res = await calculate('pressure-vessel', SAMPLE)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('shell') }
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <SimPage name="Pressure Vessel"
      tagline="ASME VIII Div.1 — shell UG-27, five head types UG-32, nozzle reinforcement UG-37, flanges, skirt/saddle supports, API 520 relief, wind/seismic loads, Turton economics.">
      <div className="flex gap-8">
        <div className="w-[300px] flex-shrink-0 overflow-y-auto" style={{maxHeight:'85vh'}}>

          <InputSection>Vessel identification</InputSection>
          <ModelGuide title="Vessel orientation" criteria={[
            { model:'Vertical', when:'Distillation columns, reactors, absorbers, most process vessels. Uses skirt support. Wind and seismic moment analysis required for H/D > 5.' },
            { model:'Horizontal', when:'Storage vessels, heat exchanger shells, surge drums, separators. Uses two saddle supports. Zick analysis for saddle loads and longitudinal bending.' },
          ]}/>
          <SelectField label="Orientation" value={inp.orientation||'vertical'} onChange={v=>set('orientation',v)} options={ORIENTATIONS}/>

          <InputSection>Design conditions</InputSection>
          <Field label="Design pressure P_d" unit="MPa" value={inp.Pd} onChange={v=>set('Pd',v)} min={0.01}
            hint="MAWP gauge pressure. Must be ≥ operating pressure + 10% OR + 172 kPa, whichever is greater per ASME. Include future operating scenarios."/>
          <Field label="Operating pressure P_op" unit="MPa" value={inp.Pop} onChange={v=>set('Pop',v)} min={0.001}
            hint="Maximum actual operating gauge pressure. Used to verify P_d is adequate."/>
          <Field label="Design temperature T_d" unit="°C" value={inp.Td} onChange={v=>set('Td',v)}
            hint="Maximum metal temperature at design conditions. This drives the allowable stress selection from ASME Table UCS-23. Higher temperature = lower allowable stress."/>
          <Field label="Corrosion allowance CA" unit="mm" value={inp.CA} onChange={v=>set('CA',v)} min={0} max={25}
            hint="Added to all calculated thicknesses. Standard: 3mm carbon steel (20yr life at 0.15mm/yr). Stainless steel: 1.5mm. Lined vessels: 0mm. Sour service: 3–6mm."/>
          <Field label="Joint efficiency E" value={inp.Ej} onChange={v=>set('Ej',v)} min={0.7} max={1.0} step={0.05}
            hint="ASME Table UW-12. Type 1 full radiography: E=1.0. Type 2 spot radiography: E=0.85. Type 3 no radiography: E=0.70. Full RT (E=1.0) reduces wall thickness significantly."/>

          <InputSection>Vessel geometry</InputSection>
          <Field label="Shell inside diameter D_i" unit="m" value={inp.Di} onChange={v=>set('Di',v)} min={0.1}
            hint="Internal diameter of the cylindrical shell. Drives shell thickness, nozzle reinforcement, and all weight calculations."/>
          <Field label="Shell length (T-T) L_tt" unit="m" value={inp.L_tt} onChange={v=>set('L_tt',v)} min={0.3}
            hint="Tangent-to-tangent length — does not include the heads. Total vessel height = L_tt + 2×head depth."/>

          <ModelGuide title="Head type" criteria={[
            { model:'2:1 Ellipsoidal', when:'Most common for moderate pressure (< 5 MPa). Depth = D_i/4. Lower cost than hemispherical. ASME UG-32(d): t = P×D_i/(2SE−0.2P).' },
            { model:'Hemispherical', when:'Highest pressure applications (> 5 MPa), minimum material use. Depth = D_i/2. t = P×R/(2SE−0.2P) — thinnest wall possible.' },
            { model:'Torispherical', when:'ASME flanged & dished (F&D) head. Cheapest to fabricate. Good for atmospheric to moderate pressure. Slightly thicker than ellipsoidal.' },
            { model:'Conical', when:'Transition pieces between different diameters, hoppers, cyclone bottoms. Half-angle must be ≤ 30° per UG-32.' },
            { model:'Flat', when:'Low pressure only (< 0.5 MPa) or jacketed vessel bottoms. Very thick — not economical at high pressure.' },
          ]}/>
          <SelectField label="Head type" value={inp.headType||'ellipsoidal'} onChange={v=>set('headType',v)} options={HEAD_TYPES}/>
          {(inp.headType==='torispherical') && (
            <>
              <Field label="Crown radius r_cr" unit="m" value={inp.r_cr} onChange={v=>set('r_cr',v)} min={0.1}
                hint="Standard tori: r_cr = D_i. Enter as-designed value."/>
              <Field label="Knuckle radius r_k" unit="m" value={inp.r_k} onChange={v=>set('r_k',v)} min={0.01}
                hint="Standard minimum per ASME: r_k = 0.06×D_i. Larger knuckle = less stress concentration."/>
            </>
          )}
          {inp.headType==='conical' && (
            <Field label="Half-apex angle α" unit="°" value={inp.cone_alpha} onChange={v=>set('cone_alpha',v)} min={1} max={60}
              hint="Half-apex angle of the conical section. Maximum 30° for standard ASME UG-32 design without special analysis."/>
          )}

          <InputSection>Material properties</InputSection>
          <Field label="S_allow allowable stress" unit="MPa" value={inp.S_allow} onChange={v=>set('S_allow',v)} min={50}
            hint="From ASME Section II-D Table 1A at design temperature T_d. SA-516 Gr.70@250°C = 138 MPa. SA-240 SS304@250°C = 129 MPa. SA-516 Gr.60@300°C = 125 MPa."/>
          <Field label="Yield strength S_y" unit="MPa" value={inp.Sy} onChange={v=>set('Sy',v)} min={100}
            hint="At design temperature. SA-516 Gr.70@250°C = 220 MPa. Used for Div.2 and local stress checks."/>
          <Field label="UTS S_u" unit="MPa" value={inp.Su} onChange={v=>set('Su',v)} min={100}
            hint="Ultimate tensile strength at room temperature. SA-516 Gr.70 = 485 MPa. Used in hydrostatic test pressure calculation."/>

          <InputSection>Nozzle details</InputSection>
          <Field label="Nozzle 1 bore d_n1" unit="m" value={inp.d_n1} onChange={v=>set('d_n1',v)} min={0.025}
            hint="Inside diameter of process inlet nozzle. Used for UG-37 nozzle reinforcement calculation. Area available vs area required."/>
          <Field label="Nozzle 1 S_allow" unit="MPa" value={inp.S_n1} onChange={v=>set('S_n1',v)} min={50}
            hint="Usually same as shell material unless nozzle is a different grade."/>
          <Field label="Nozzle 2 bore d_n2" unit="m" value={inp.d_n2} onChange={v=>set('d_n2',v)} min={0.025}
            hint="Process outlet nozzle bore."/>
          <Field label="Nozzle 2 S_allow" unit="MPa" value={inp.S_n2} onChange={v=>set('S_n2',v)} min={50}/>

          <InputSection>Contents & weight</InputSection>
          <Field label="Fluid density ρ_fluid" unit="kg/m³" value={inp.rho_fluid} onChange={v=>set('rho_fluid',v)} min={1}
            hint="Process fluid density at operating conditions. Water = 1000, hydrocarbons = 700–900, acids = 1000–1800 kg/m³. Used for operating weight and hydrostatic test."/>
          <Field label="Insulation thickness" unit="mm" value={inp.t_ins} onChange={v=>set('t_ins',v)} min={0}
            hint="Hot insulation: mineral wool 75mm, calcium silicate 75mm. Cold insulation: PUF 50mm, cellular glass 75mm."/>
          <Field label="Insulation density" unit="kg/m³" value={inp.rho_ins} onChange={v=>set('rho_ins',v)} min={10}
            hint="Mineral wool: 150 kg/m³. Calcium silicate: 250 kg/m³. PUF (polyurethane foam): 40 kg/m³."/>

          <InputSection>Support</InputSection>
          {(inp.orientation==='vertical'||!inp.orientation) ? (
            <>
              <Field label="Skirt height H_sk" unit="m" value={inp.H_sk} onChange={v=>set('H_sk',v)} min={0.5}
                hint="Height from grade level to bottom tangent line. Minimum: allow clearance for piping under vessel. Typical: 2–5 m."/>
              <Field label="Skirt diameter D_sk" unit="m" value={inp.D_sk} onChange={v=>set('D_sk',v)} min={0.1}
                hint="Skirt OD. Usually D_i + 2×t_shell + 100mm clearance. Must be large enough to handle wind and seismic moment."/>
            </>
          ) : (
            <>
              <Field label="Saddle width b_sad" unit="m" value={inp.b_sad} onChange={v=>set('b_sad',v)} min={0.1}
                hint="Saddle contact width (b). Typical: 200–300mm. API recommendation: b ≥ D_i/6."/>
              <Field label="Saddle angle θ" unit="°" value={inp.theta_sad} onChange={v=>set('theta_sad',v)} min={90} max={170}
                hint="Contact angle of saddle with vessel. Standard: 120°. Larger angle = better load distribution. API 650 tank saddles: 150°."/>
              <Field label="Saddle to head A" unit="m" value={inp.A_sad} onChange={v=>set('A_sad',v)} min={0.1}
                hint="Distance from saddle centreline to nearest tangent line. Optimal: A ≤ 0.2×L for min. bending stress. Limit: A ≤ 0.25×L (Zick)."/>
            </>
          )}

          <InputSection>Wind & seismic</InputSection>
          <Field label="Basic wind speed V_w" unit="m/s" value={inp.Vw} onChange={v=>set('Vw',v)} min={10}
            hint="From ASCE 7-22 wind map for risk category II. Hyderabad: 44 m/s. Mumbai: 44 m/s. Chennai: 50 m/s. Delhi: 47 m/s. Use site-specific value from IS 875 Part 3."/>
          <Field label="Seismic Ss" unit="g" value={inp.Ss} onChange={v=>set('Ss',v)} min={0} max={3} step={0.05}
            hint="Mapped short-period spectral acceleration from ASCE 7 or IS 1893. Low seismic zone: 0.1–0.3g. High seismic zone: 1.0–2.5g. Hyderabad: ~0.25g (Zone II per IS 1893)."/>

          <InputSection>Relief valve (API 520)</InputSection>
          <Field label="PSV set pressure P_set" unit="MPa" value={inp.P_set} onChange={v=>set('P_set',v)} min={0.01}
            hint="Set pressure = MAWP (typical). Max accumulation = 10% above set for fire case, 3% for process case."/>
          <Field label="Relief fluid MW" unit="g/mol" value={inp.MW_relief} onChange={v=>set('MW_relief',v)} min={1}
            hint="Molecular weight of vapour at PSV inlet. For liquid service: enter 0. Steam: 18. Natural gas: 17. Air: 29."/>
          <Field label="Relief temperature T_relief" unit="°C" value={inp.T_relief} onChange={v=>set('T_relief',v)}
            hint="Temperature at PSV inlet under relief conditions."/>
          <Field label="Required relief flow W_relief" unit="kg/h" value={inp.W_relief} onChange={v=>set('W_relief',v)} min={1}
            hint="From hazard study / process safety analysis. Fire case: from API 521 heat input. Process case: from blocked outlet or cooling failure scenarios."/>

          <InputSection>Flanges</InputSection>
          <ModelGuide title="ASME flange class" criteria={[
            { model:'ASME 150#', when:'P ≤ 2 MPa at 300°C for CS. Most common for low-pressure systems.' },
            { model:'ASME 300#', when:'P ≤ 5 MPa at 300°C. Process industry standard for moderate pressure.' },
            { model:'ASME 600#', when:'P ≤ 10 MPa. High-pressure service.' },
            { model:'ASME 900# / 1500#', when:'Very high pressure service > 10 MPa.' },
          ]}/>
          <SelectField label="Nozzle flange class" value={inp.flange_class||'300'} onChange={v=>set('flange_class',v)} options={FLANGE_CLASSES}/>

          <InputSection>Economics (optional)</InputSection>
          <Field label="CEPCI current" value={inp.CEPCI} onChange={v=>set('CEPCI',v)} required={false} hint="2024 ≈ 820."/>
          <Field label="CEPCI base (2001)" value={inp.CEPCIbase} onChange={v=>set('CEPCIbase',v)} required={false} hint="397 — do not change."/>
          <Field label="FBM factor" value={inp.FBM} onChange={v=>set('FBM',v)} required={false}
            hint="CS vessel: 4.16. SS 304: 5.2. SS 316: 5.8. (Turton Table A.1)"/>

          {err && <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg"><p className="text-[11.5px] text-red-600 leading-snug">{err}</p></div>}
          <CalcButton onClick={runCalc} loading={loading}/>
        </div>

        <div className="flex-1 min-w-0">
          <TabBar tabs={TABS} active={tab} onChange={setTab}/>

          {tab==='sample' && (
            <div className="w-full max-w-4xl">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
                <p className="text-[14px] font-semibold text-blue-900 mb-1">Sample — Vertical pressure vessel, CS SA-516 Gr.70</p>
                <p className="text-[12.5px] text-blue-700 mb-4">D_i = 1.5m, L = 6m, P_d = 2 MPa, T_d = 250°C. 2:1 ellipsoidal heads, full radiography (E=1.0), 3mm CA. Vertical with skirt support.</p>
                <button onClick={loadSample} className="text-[13px] font-semibold bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                  Load and run sample →
                </button>
              </div>
              <SectionHead>Expected results</SectionHead>
              <ResultTable rows={[
                ['Shell t_calc (UG-27)','≈ 11–13','mm'],
                ['Shell t_nominal','14 or 16','mm'],
                ['Head t (2:1 SE, UG-32d)','≈ 8–10','mm'],
                ['MAWP (back-calculated)','≥ 2.0','MPa ✓'],
                ['Empty weight','≈ 8,000–12,000','kg'],
                ['Wind moment (Hyderabad 44m/s)','≈ 80–120','kN·m'],
              ]}/>
            </div>
          )}

          {tab !== 'sample' && loading && <CalcSpinner/>}
          {tab !== 'sample' && !r && !loading && <EmptyState onSample={loadSample}/>}

          {r && tab==='shell' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="t_shell_calc" value={f(r.t_sc,2)} unit="mm"/>
                <MetricCard label="t_shell nominal" value={r.t_sn} unit="mm" highlight/>
                <MetricCard label="D_outer" value={f(r.Do,0)} unit="mm"/>
                <MetricCard label="MAWP shell" value={f(r.MAWP_sh,3)} unit="MPa"/>
              </div>
              <ResultTable rows={[
                ['ASME UG-27 cylindrical shell under internal pressure','',''],
                ['P_design (ASME minimum)',f(r.Pd_code,3),'MPa'],
                ['R_i = D_i/2',f(r.Ri,1),'mm'],
                ['t_calc = P×R/(S×E−0.6P) + CA',f(r.t_sc,2),'mm'],
                ['t_nominal (next standard plate)',r.t_sn,'mm'],
                ['D_outer = D_i + 2×t_nom',f(r.Do,0),'mm'],
                ['MAWP = S×E×(t_nom−CA)/(R+0.6×(t_nom−CA))',f(r.MAWP_sh,3),'MPa'],
                ['Hydrotest pressure = 1.3×MAWP×S_RT/S_T',f(r.P_ht,3),'MPa'],
                ['Over-design (t_nom/t_calc−1)',f(r.shell_OD,1),'%'],
              ]}/>
            </div>
          )}

          {r && tab==='heads' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="t_SE (2:1 ellipsoidal)" value={f(r.t_SE_nom||r.t_head,0)} unit="mm" highlight/>
                <MetricCard label="t_hemi" value={r.t_hemi_nom} unit="mm"/>
                <MetricCard label="t_tori (F&D)" value={r.t_tori_nom} unit="mm"/>
                <MetricCard label="MAWP heads" value={f(r.MAWP_head,3)} unit="MPa"/>
              </div>
              <ResultTable rows={[
                ['2:1 Semi-ellipsoidal (UG-32d): t = P×D/(2SE−0.2P) + CA',f(r.t_SE,2),'mm → '+r.t_SE_nom+'mm nominal'],
                ['Hemispherical (UG-32f): t = P×R/(2SE−0.2P) + CA',f(r.t_hemi,2),'mm → '+r.t_hemi_nom+'mm nominal'],
                ['Torispherical (UG-32e): t = 0.885×P×L/(SE−0.1P) + CA',f(r.t_tori,2),'mm → '+r.t_tori_nom+'mm nominal'],
                ['Conical (UG-32g): t = P×D/(2cos(α)×(SE−0.6P)) + CA',f(r.t_cone,2),'mm (α='+inp.cone_alpha+'°)'],
                ['Flat (UG-34): t = D×√(C×P/SE) + CA',f(r.t_flat,2),'mm'],
                ['Head MAWP (2:1 SE)',f(r.MAWP_head,3),'MPa'],
              ]}/>
            </div>
          )}

          {r && tab==='nozzles' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="t_nozzle 1 calc" value={f(r.t_n1,2)} unit="mm"/>
                <MetricCard label="A_required N1" value={f(r.A_req_n1,1)} unit="mm²"/>
                <MetricCard label="A_available N1" value={f(r.A_avail_n1,1)} unit="mm²"/>
                <MetricCard label="N1 reinforcement" value={r.n1_ok?'ADEQUATE':'REQUIRES PAD'} unit=""/>
              </div>
              <SectionHead>Nozzle 1 — UG-37 reinforcement</SectionHead>
              <ResultTable rows={[
                ['d_n1',f(+inp.d_n1*1000,0),'mm'],
                ['t_n1_req = P×d_n1/(2×S_n−0.2P) + CA',f(r.t_n1,2),'mm'],
                ['A_required = d_n1×t_shell_calc (UG-37)',f(r.A_req_n1,1),'mm²'],
                ['A_available in shell (2.5×t_excess)',f(r.A_avail_n1,1),'mm²'],
                ['Reinforcement adequate?',r.n1_ok?'YES — A_avail ≥ A_req':'NO — reinforcement pad required',''],
              ]}/>
              <SectionHead>Nozzle 2 — UG-37 reinforcement</SectionHead>
              <ResultTable rows={[
                ['d_n2',f(+inp.d_n2*1000,0),'mm'],
                ['A_required',f(r.A_req_n2,1),'mm²'],
                ['A_available',f(r.A_avail_n2,1),'mm²'],
                ['Reinforcement adequate?',r.n2_ok?'YES':'NO — pad required',''],
              ]}/>
            </div>
          )}

          {r && tab==='flanges' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Flange class" value={inp.flange_class||'300'} unit="#"/>
                <MetricCard label="MAWP at T_d" value={f(r.flange_MAWP,2)} unit="MPa"/>
                <MetricCard label="P_d vs flange MAWP" value={r.flange_ok?'OK':'UPGRADE CLASS'} unit=""/>
              </div>
              <ResultTable rows={[
                ['Flange class selected',inp.flange_class+'#','ASME B16.5'],
                ['Flange MAWP at T_d',f(r.flange_MAWP,2),'MPa'],
                ['Design pressure P_d',f(+inp.Pd,3),'MPa'],
                ['Flange class adequate?',r.flange_ok?'YES':'NO — increase flange class',''],
                ['Gasket seating: min bolt load covered by class','Per ASME B16.5',''],
              ]}/>
            </div>
          )}

          {r && tab==='supports' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="W_empty" value={f(r.W_empty,0)} unit="kg"/>
                <MetricCard label="W_operating" value={f(r.W_oper,0)} unit="kg"/>
                <MetricCard label="W_hydrotest" value={f(r.W_htest,0)} unit="kg"/>
              </div>
              {(inp.orientation==='vertical'||!inp.orientation) ? (
                <ResultTable rows={[
                  ['Skirt stress model: σ_s = W_tot/(π×D_sk×t_sk)','',''],
                  ['σ_skirt (dead weight)',f(r.sigma_skirt,2),'MPa'],
                  ['σ_skirt allowable',f(+inp.S_allow*0.667,1),'MPa (0.667×S_allow)'],
                  ['Skirt adequate?',r.skirt_ok?'YES':'NO — increase t_skirt',''],
                ]}/>
              ) : (
                <ResultTable rows={[
                  ['Zick saddle analysis','',''],
                  ['Longitudinal bending stress σ_L',f(r.sigma_L,2),'MPa'],
                  ['Tangential shear stress σ_T',f(r.sigma_T,2),'MPa'],
                  ['Saddle bearing pressure',f(r.sad_bearing,3),'MPa'],
                  ['Saddle check',r.saddle_ok?'PASS':'FAIL',''],
                ]}/>
              )}
            </div>
          )}

          {r && tab==='relief' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="PSV orifice area" value={f(r.A_psv,2)} unit="cm²" highlight/>
                <MetricCard label="API orifice designation" value={r.psv_orifice||'—'} unit=""/>
                <MetricCard label="P1 (inlet pressure)" value={f(r.P1_psv,3)} unit="MPa"/>
              </div>
              <ResultTable rows={[
                ['API 520 Part I — vapour/gas sizing','',''],
                ['Service',inp.MW_relief>0?'Vapour/Gas':'Liquid',''],
                ['P_set',f(+inp.P_set,3),'MPa'],
                ['P1 = 1.03×P_set (3% inlet loss allowance)',f(r.P1_psv,3),'MPa'],
                ['Required orifice area A',f(r.A_psv,2),'cm²'],
                ['API standard orifice (next size up)',r.psv_orifice||'—',''],
              ]}/>
            </div>
          )}

          {r && tab==='weight' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="W_shell" value={f(r.W_sh,0)} unit="kg"/>
                <MetricCard label="W_heads" value={f(r.W_heads,0)} unit="kg"/>
                <MetricCard label="W_total empty" value={f(r.W_empty,0)} unit="kg" highlight/>
                <MetricCard label="W_operating" value={f(r.W_oper,0)} unit="kg"/>
                <MetricCard label="W_hydrotest" value={f(r.W_htest,0)} unit="kg"/>
                <MetricCard label="CBM cost" value={`$${f(r.CBM,0)}`} unit="USD"/>
              </div>
              <ResultTable rows={[
                ['W_shell = ρ_s × π × D_m × L × t_nom',f(r.W_sh,0),'kg'],
                ['W_heads (2 × standard weight)',f(r.W_heads,0),'kg'],
                ['W_insulation',f(r.W_ins,0),'kg'],
                ['W_fluid (operating)',f(r.W_fluid,0),'kg'],
                ['W_platforms + piping',f((+inp.W_plat||0)+(+inp.W_pipe||0),0),'kg'],
                ['W_total empty',f(r.W_empty,0),'kg'],
                ['W_total operating',f(r.W_oper,0),'kg'],
                ['W_total hydrotest (water filled)',f(r.W_htest,0),'kg'],
                ['CBM = FBM × C_p0 (Turton)','$'+f(r.CBM,0),'USD'],
              ]}/>
            </div>
          )}

          {r && tab==='tall' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Wind moment M_w" value={f(r.M_wind,1)} unit="kN·m"/>
                <MetricCard label="Seismic moment M_s" value={f(r.M_seismic,1)} unit="kN·m"/>
                <MetricCard label="Governing moment" value={f(Math.max(r.M_wind||0, r.M_seismic||0),1)} unit="kN·m"/>
                <MetricCard label="σ_b (bending)" value={f(r.sigma_b,2)} unit="MPa"/>
                <MetricCard label="σ_w (weight)" value={f(r.sigma_w,2)} unit="MPa"/>
                <MetricCard label="σ_total vs S_allow" value={`${f((r.sigma_b||0)+(r.sigma_w||0),1)} vs ${inp.S_allow}`} unit="MPa"/>
              </div>
              <ResultTable rows={[
                ['ASCE 7 wind: q_w = 0.5×ρ_air×V_w²×C_d',f(r.q_wind,1),'Pa'],
                ['Wind moment M_w = q_w × D_o × H²/2',f(r.M_wind,1),'kN·m'],
                ['Seismic base shear V_s = Cs × W_oper',f(r.V_seismic,1),'kN'],
                ['Seismic moment M_s',f(r.M_seismic,1),'kN·m'],
                ['Governing moment (max of wind and seismic)',f(Math.max(r.M_wind||0,r.M_seismic||0),1),'kN·m'],
                ['σ_bending = M × D_o/(2×I)',f(r.sigma_b,2),'MPa'],
                ['σ_weight = W/(π×D×t)',f(r.sigma_w,2),'MPa'],
                ['σ_total vs S_allow',`${f((r.sigma_b||0)+(r.sigma_w||0),1)} vs ${inp.S_allow} MPa`,''],
              ]}/>
            </div>
          )}

          {r && tab==='checks' && (
            <div>
              <p className="text-[12px] text-muted mb-4">10 design checks — all must be PASS before finalising.</p>
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
