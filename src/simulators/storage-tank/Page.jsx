import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import SimPage, { TabBar, MetricCard, ResultTable, SectionHead, Check, Field, SelectField, InputSection, ModelGuide, CalcSpinner, EmptyState, CalcButton, SectionIncomplete } from '../../components/SimPage'
import { calculate } from '../../lib/calculate'
import { saveRun } from '../../lib/history'

const TABS = [
  {id:'sample',     label:'Sample Calculation'},
  {id:'shell',      label:'Shell (API 650)'},
  {id:'roof',       label:'Roof'},
  {id:'floating',   label:'Floating Roof'},
  {id:'nozzles',    label:'Nozzles & Piping'},
  {id:'foundation', label:'Foundation'},
  {id:'venting',    label:'Venting (API 2000)'},
  {id:'econ',       label:'Economics'},
  {id:'checks',     label:'Design Checks'},
]

const SAMPLE = {
  tankType:'fixed_cone', D:20, H_max:12, H_shell:12.5, n_c:4, cone_slope:12,
  rho_fluid:850, SG_design:1.0, Td:65, P_gauge:0, CA:3,
  Sd:160, St:175, t_min:6,
  Vw:47, seismic_cat:'D', Ss:0.25,
  Q_fill:500, Pv:15, flash_pt:70,
  CEPCI_ratio:2.065, plate_cost:1500,
}
const EMPTY = Object.fromEntries(Object.keys(SAMPLE).map(k=>[k,'']))

const TANK_TYPES = [
  {value:'fixed_cone',   label:'API 650 Fixed Cone Roof — standard atmospheric storage'},
  {value:'fixed_dome',   label:'API 650 Fixed Dome Roof — low vapour pressure products'},
  {value:'floating_ext', label:'API 650 External Floating Roof — volatile liquids, crude oil'},
  {value:'floating_int', label:'API 650 Internal Floating Roof — lower VOC emissions'},
  {value:'api620',       label:'API 620 Low-Pressure — above 18 kPag, up to 103 kPag'},
]

export default function StorageTankPage() {
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

  const hasCore = () => ['D','H_shell','H_max','Sd','CA'].every(k=>inp[k]!=='')

  const runCalc = async () => {
    if (!hasCore()) { setErr('Fill required tank geometry and material fields (*)'); return }
    setLoading(true); setErr('')
    try {
      const nums = Object.fromEntries(Object.entries(inp).map(([k,v])=>[k,typeof v==='string'&&v!==''&&!isNaN(+v)?+v:v]))
      const res = await calculate('storage-tank', nums)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('shell'); await saveRun('storage-tank','Storage Tank', nums, res) }
    } catch(e) { setErr('Calculation error: '+e.message) }
    finally { setLoading(false) }
  }

  const loadSample = async () => {
    setInp(SAMPLE); setLoading(true); setErr('')
    try {
      const res = await calculate('storage-tank', SAMPLE)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('shell') }
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <SimPage name="Storage Tank"
      tagline="API 650 shell one-foot method, fixed cone/dome roof, external/internal floating roof, API 2000 venting, API 521 fire case, foundation bearing, Towler-Sinnott economics.">
      <div className="flex gap-8">
        <div className="w-[300px] flex-shrink-0 overflow-y-auto" style={{maxHeight:'85vh'}}>

          <InputSection>Tank type</InputSection>
          <ModelGuide title="Tank type selection" criteria={[
            {model:'Fixed cone roof',when:'Non-volatile liquids (flash point > 38°C), water, diesel, fuel oil. Simple construction, lowest cost. Vapour space exists — suitable for low vapour pressure products (P_v < 14 kPag).'},
            {model:'Fixed dome roof',when:'Similar to cone but structurally superior for larger diameters (> 60m). Slightly lower evaporation losses than cone.'},
            {model:'External floating roof',when:'Volatile liquids (crude oil, gasoline, naphtha). Roof floats on liquid surface — no fixed vapour space, minimises evaporation losses. For flash point < 38°C.'},
            {model:'Internal floating roof',when:'Lower VOC emissions than external floating roof. Used when weather protection of product is needed. Combines fixed shell with floating roof inside.'},
            {model:'API 620',when:'Operating pressure above 18 kPag (2.5 psi). Maximum 103 kPag. Cryogenic tanks (LNG, LN2). Different design rules from API 650.'},
          ]}/>
          <SelectField label="Tank type" value={inp.tankType||'fixed_cone'} onChange={v=>set('tankType',v)} options={TANK_TYPES}/>

          <InputSection>Tank geometry</InputSection>
          <Field label="Tank diameter D" unit="m" value={inp.D} onChange={v=>set('D',v)} min={1}
            hint="Nominal inside diameter. Standard API 650 range: 3–75m. For new tanks, H/D = 0.6–1.0 is optimal. Small tanks (< 6m): H/D up to 3. Large crude tanks (> 60m): H/D ≈ 0.3–0.5."/>
          <Field label="Maximum liquid height H_max" unit="m" value={inp.H_max} onChange={v=>set('H_max',v)} min={0.5}
            hint="Maximum operating fill height. Typically 90% of shell height. API 650: H_max ≤ H_shell − 0.3m freeboard minimum."/>
          <Field label="Shell height H_shell" unit="m" value={inp.H_shell} onChange={v=>set('H_shell',v)} min={1}
            hint="Total shell height from bottom to top angle. Standard course heights: 2.5m or 3.0m. H_shell = n_courses × course height."/>
          <Field label="Number of shell courses n_c" value={inp.n_c} onChange={v=>set('n_c',v)} min={1} max={20}
            hint="Number of horizontal shell plates. Each course is a ring of plates. Course height: 2.5–3.0m typical. More courses = optimised thickness per course."/>
          <Field label="Cone roof slope 1:n" value={inp.cone_slope} onChange={v=>set('cone_slope',v)} min={8} max={20}
            hint="Rise 1 for run n. API 650 standard: 1:12 to 1:16. Steeper (1:8) = better drainage but more steel. H_apex = D/(2×n). Minimum 1:16."/>

          <InputSection>Fluid & design conditions</InputSection>
          <Field label="Stored fluid density ρ" unit="kg/m³" value={inp.rho_fluid} onChange={v=>set('rho_fluid',v)} min={300}
            hint="Product: crude oil ≈ 850, diesel ≈ 820, gasoline ≈ 740, water = 1000, fuel oil ≈ 950 kg/m³."/>
          <Field label="SG design (API 650: use 1.0)" value={inp.SG_design} onChange={v=>set('SG_design',v)} min={0.5} max={2} step={0.05}
            hint="API 650 shell thickness is always designed for water (SG=1.0) unless product is heavier. For product lighter than water, use SG=1.0 for conservative design."/>
          <Field label="Design temperature T_d" unit="°C" value={inp.Td} onChange={v=>set('Td',v)}
            hint="Maximum operating temperature. Drives allowable stress selection per API 650 Table 3-2."/>
          <Field label="Operating pressure (gauge)" unit="kPa" value={inp.P_gauge} onChange={v=>set('P_gauge',v)} min={0} max={18}
            hint="API 650 maximum: 18 kPag (2.5 psi). Anything above requires API 620. Atmospheric tanks operate at 0 kPag with vents."/>
          <Field label="Corrosion allowance CA" unit="mm" value={inp.CA} onChange={v=>set('CA',v)} min={0} max={10}
            hint="API 650: typically 1.5–6mm. Crude oil: 3mm. Water: 1.5–3mm. Acidic products: 4–6mm. Based on corrosion rate × design life."/>

          <InputSection>Material stresses</InputSection>
          <Field label="S_d allowable stress (design)" unit="MPa" value={inp.Sd} onChange={v=>set('Sd',v)} min={50}
            hint="API 650 Table 3-2. A36: 160 MPa. A283-C: 138 MPa. A516 Gr.60: 179 MPa. A516 Gr.70: 186 MPa. SS 304L: 115 MPa."/>
          <Field label="S_t allowable stress (hydro test)" unit="MPa" value={inp.St} onChange={v=>set('St',v)} min={50}
            hint="API 650: S_t = 1.25×S_d typically. A36: 175 MPa. Used only during hydrostatic test (water filled to overflow level)."/>
          <Field label="Minimum plate thickness" unit="mm" value={inp.t_min} onChange={v=>set('t_min',v)} min={4}
            hint="API 650 §5.6.1.1 minimum: 6mm for D > 15m, 5mm for D < 15m. 4mm absolute minimum for any tank. Usually governs upper courses of large tanks."/>

          <InputSection>Wind & seismic</InputSection>
          <Field label="Basic wind speed V_w" unit="m/s" value={inp.Vw} onChange={v=>set('Vw',v)} min={10}
            hint="From ASCE 7 or IS 875. Hyderabad: 44 m/s. Used for wind overturning moment and roof uplift check."/>
          <Field label="Seismic Ss" unit="g" value={inp.Ss} onChange={v=>set('Ss',v)} min={0} max={3} step={0.05}
            hint="Mapped spectral acceleration. Used in API 650 Annex E seismic design."/>

          <InputSection>Venting (API 2000)</InputSection>
          <Field label="Filling rate Q_fill" unit="m³/h" value={inp.Q_fill} onChange={v=>set('Q_fill',v)} min={1}
            hint="Maximum liquid inflow rate. Drives inbreathing/outbreathing vent sizing per API 2000. Include pump maximum capacity."/>
          <Field label="Vapour pressure P_v at max T" unit="kPa abs" value={inp.Pv} onChange={v=>set('Pv',v)} min={0}
            hint="Product vapour pressure at maximum operating temperature. Used for thermal breathing vent sizing."/>
          <Field label="Flash point T_fp" unit="°C" value={inp.flash_pt} onChange={v=>set('flash_pt',v)}
            hint="Product flash point. < 38°C = Class I flammable (stricter venting). 38–60°C = Class II. > 60°C = Class III. Determines API 2000 vent type."/>

          <InputSection>Economics</InputSection>
          <Field label="CEPCI ratio (current/2001)" value={inp.CEPCI_ratio} onChange={v=>set('CEPCI_ratio',v)} min={1}
            hint="Current CEPCI / 397 (2001 base). 2024: 820/397 = 2.065."/>
          <Field label="Plate cost" unit="$/tonne" value={inp.plate_cost} onChange={v=>set('plate_cost',v)} min={100}
            hint="Fabricated tank steel plate cost. CS: $1200–2000/tonne. SS 304: $4000–6000/tonne. Includes material + basic fabrication."/>

          {err && <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg"><p className="text-[11.5px] text-red-600 leading-snug">{err}</p></div>}
          <CalcButton onClick={runCalc} loading={loading}/>
        </div>

        <div className="flex-1 min-w-0">
          <TabBar tabs={TABS} active={tab} onChange={setTab}/>
          {tab==='sample' && (
            <div className="w-full max-w-4xl">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
                <p className="text-[14px] font-semibold text-blue-900 mb-1">Sample — API 650 fixed cone roof, crude oil, 20m diameter</p>
                <p className="text-[12.5px] text-blue-700 mb-4">D=20m, H=12.5m, A36 steel, crude oil ρ=850 kg/m³, T_d=65°C, P_gauge=0 kPa. Cone slope 1:12.</p>
                <button onClick={loadSample} className="text-[13px] font-semibold bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">Load and run sample →</button>
              </div>
              <SectionHead>Expected results</SectionHead>
              <ResultTable rows={[
                ['Bottom course thickness (H=12.5m, SG=1)','≈ 10–12','mm'],
                ['Top course thickness','6','mm (minimum)'],
                ['Net volume V_net','≈ 3,760','m³'],
                ['Cone roof area','≈ 330','m²'],
                ['Foundation bearing pressure','≈ 120–180','kPa'],
                ['Installed cost (Towler)','≈ $600k–$1.2M','USD'],
              ]}/>
            </div>
          )}
          {tab !== 'sample' && loading && <CalcSpinner/>}
          {tab !== 'sample' && !r && !loading && <EmptyState onSample={loadSample}/>}

          {r && tab==='shell' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="t_bottom course" value={f(r.t_bot,1)} unit="mm" highlight/>
                <MetricCard label="t_top course" value={f(r.t_top,1)} unit="mm"/>
                <MetricCard label="σ_h (hoop stress)" value={f(r.sigma_h,1)} unit="MPa"/>
                <MetricCard label="V_net" value={f(r.V_net,0)} unit="m³"/>
              </div>
              <SectionHead>API 650 one-foot method — shell thickness per course</SectionHead>
              <p className="text-[11px] text-muted mb-3">t = 4.9×D×(H−0.3)/S_d + CA [mm]  — design condition. t_test = 4.9×D×(H−0.3)/S_t [mm] — hydro test. Take maximum of design and test, minimum t_min.</p>
              <table className="w-full text-[12px] border-collapse mb-4">
                <thead>
                  <tr className="bg-soft border-b border-line">
                    {['Course','H from bottom (m)','t_design (mm)','t_test (mm)','t_nominal (mm)'].map(h=>(
                      <th key={h} className="text-left py-2 px-2 text-[10.5px] font-bold text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.courses?.map((c,i)=>(
                    <tr key={i} className="border-b border-line">
                      <td className="py-2 px-2 font-medium text-ink">{i+1}</td>
                      <td className="py-2 px-2 text-muted">{f(c.H,2)}</td>
                      <td className="py-2 px-2">{f(c.t_d,1)}</td>
                      <td className="py-2 px-2">{f(c.t_t,1)}</td>
                      <td className="py-2 px-2 font-semibold text-ink">{f(c.t_nom,1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ResultTable rows={[
                ['Net volume V = π/4×D²×H_max',f(r.V_net,0),'m³'],
                ['Gross volume V = π/4×D²×H_shell',f(r.V_gross,0),'m³'],
                ['σ_h (hoop stress, bottom course)',f(r.sigma_h,1),'MPa (must be ≤ S_d)'],
                ['Annular plate thickness',f(r.t_annular,1),'mm'],
                ['Total shell steel weight',f(r.W_shell_t,1),'tonnes'],
              ]}/>
            </div>
          )}

          {r && tab==='roof' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Cone roof area" value={f(r.A_roof,1)} unit="m²"/>
                <MetricCard label="t_roof" value={f(r.t_roof,1)} unit="mm" highlight/>
                <MetricCard label="H_apex" value={f(r.H_apex,2)} unit="m"/>
                <MetricCard label="Roof weight" value={f(r.W_roof,1)+'t'} unit=""/>
              </div>
              <ResultTable rows={[
                ['Cone roof slope',`1:${inp.cone_slope}`,''],
                ['H_apex = D/(2×n_slope)',f(r.H_apex,2),'m'],
                ['Slant height = √((D/2)²+H_apex²)',f(r.L_slant,2),'m'],
                ['Cone area = π×(D/2)×L_slant',f(r.A_roof,1),'m²'],
                ['Roof t (API 650 min 5mm or wind check)',f(r.t_roof,1),'mm'],
                ['Roof steel weight',f(r.W_roof,1),'tonnes'],
              ]}/>
            </div>
          )}

          {r && tab==='floating' && (
            <div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <MetricCard label="Pontoon width" value={f(r.pontoon_w,2)} unit="m"/>
                <MetricCard label="Pontoon area" value={f(r.pontoon_A,1)} unit="m²"/>
              </div>
              <ResultTable rows={[
                ['External floating roof — pontoon sizing','',''],
                ['Single-deck: pontoon width = 0.065×D',f(r.pontoon_w,2),'m'],
                ['Double-deck: full area deck','Safer for fire',''],
                ['Pontoon area',f(r.pontoon_A,1),'m²'],
                ['Rim seal type','Mechanical shoe seal or liquid-filled seal',''],
                ['Drain requirement: secondary seal + drain','Required per API 650',''],
              ]}/>
            </div>
          )}

          {r && tab==='nozzles' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Inlet velocity" value={f(r.u_inlet,2)} unit="m/s"/>
                <MetricCard label="Outlet velocity" value={f(r.u_outlet,2)} unit="m/s"/>
              </div>
              <ResultTable rows={[
                ['Inlet nozzle DN300 (standard)',f(r.u_inlet,2),'m/s (limit 2.0 m/s per API 650)'],
                ['Outlet nozzle DN300',f(r.u_outlet,2),'m/s'],
                ['Clean-out nozzle','DN450 minimum per API 650',''],
                ['Gauge hatch','600mm × 900mm minimum',''],
                ['Emergency vent','Per API 2000 fire case',''],
              ]}/>
            </div>
          )}

          {r && tab==='foundation' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="W_full (hydrotest)" value={f(r.W_full,0)} unit="kg" highlight/>
                <MetricCard label="Foundation bearing q" value={f(r.q_found,1)} unit="kPa"/>
                <MetricCard label="Concrete ring req'd?" value={r.ring_req?'YES':'NO (earthen ok)'} unit=""/>
              </div>
              <ResultTable rows={[
                ['W_empty (steel)',f(r.W_steel_tot,0),'kg'],
                ['W_full (water in hydrotest)',f(r.W_full,0),'kg'],
                ['Foundation area A = π/4×D²',f(r.A_found,1),'m²'],
                ['Bearing pressure q = W_full/(A×1000)',f(r.q_found,1),'kPa (limit 200 kPa for soil)'],
                ['Concrete ring foundation required?',r.ring_req?'YES — q > 100 kPa':'NO — earthen pad adequate',''],
              ]}/>
            </div>
          )}

          {r && tab==='venting' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Outbreathing Q_out" value={f(r.Q_outbreath,1)} unit="m³/h" highlight/>
                <MetricCard label="Vent area required" value={f(r.A_vent,1)} unit="cm²"/>
                <MetricCard label="Fire vent flow" value={f(r.Q_fire,1)} unit="m³/h"/>
              </div>
              <ResultTable rows={[
                ['API 2000 outbreathing (filling + thermal)',f(r.Q_outbreath,1),'m³/h vapour equivalent'],
                ['API 2000 inbreathing (emptying)',f(r.Q_inbreath,1),'m³/h'],
                ['Vent area required (outbreathing governs)',f(r.A_vent,1),'cm²'],
                ['API 521 fire case flow',f(r.Q_fire,1),'m³/h'],
                ['Emergency vent required?',r.emerg_vent?'YES':'NO',''],
              ]}/>
            </div>
          )}

          {r && tab==='econ' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Steel weight" value={f(r.W_steel_tot,1)} unit="tonnes"/>
                <MetricCard label="Tank cost" value={`$${f(r.C_tank,0)}`} unit="USD"/>
                <MetricCard label="Installed cost" value={`$${f(r.C_installed,0)}`} unit="USD" highlight/>
              </div>
              <ResultTable rows={[
                ['Total steel weight',f(r.W_steel_tot,1),'tonnes'],
                ['Plate cost × weight','$'+f(r.C_tank,0),'USD'],
                ['Installed cost (Towler factor × 2.5)','$'+f(r.C_installed,0),'USD'],
                ['Cost per m³ storage','$'+f(r.cost_per_m3,1),'/m³'],
              ]}/>
            </div>
          )}

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
