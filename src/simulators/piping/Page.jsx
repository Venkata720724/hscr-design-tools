import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import SimPage, { TabBar, MetricCard, ResultTable, SectionHead, Check, Field, SelectField, InputSection, ModelGuide, CalcSpinner, EmptyState, CalcButton, SectionIncomplete } from '../../components/SimPage'
import { calculate } from '../../lib/calculate'
import { saveRun } from '../../lib/history'

const TABS = [
  {id:'sample',  label:'Sample Calculation'},
  {id:'pipe',    label:'Pipe Hydraulics'},
  {id:'pressure',label:'Pressure Drop'},
  {id:'cv',      label:'Control Valve (ISA)'},
  {id:'psv',     label:'Relief Valve (API 520)'},
  {id:'econ',    label:'Economics'},
  {id:'checks',  label:'Design Checks'},
]

const SAMPLE = {
  serviceType:'liquid', Q:0.005, rho:900, mu:0.005, P_op:500, T_op:100,
  MW_gas:100,
  d_i:0.1, t_pipe:0.006, L_pipe:200, roughness:0.046,
  n_elbow90:4, n_gate:2, n_globe:1, n_check:1, n_tee:2,
  dP_cv:50, SG_cv:0.9,
  P_set:600, W_psv:1000, MW_psv:100, T_psv:150,
  t_ins:50, T_amb:25,
  pipe_cost:350, CEPCI_ratio:2.065,
}
const EMPTY = Object.fromEntries(Object.keys(SAMPLE).map(k=>[k,'']))

const SERVICE_TYPES = [
  {value:'liquid',    label:'Liquid (pump discharge / gravity)'},
  {value:'gas',       label:'Gas / vapour (compressor discharge)'},
  {value:'steam',     label:'Steam line'},
  {value:'twophase',  label:'Two-phase (liquid + gas)'},
]

export default function PipingPage() {
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
      if (state.results) { setR(state.results); setTab('pipe') }
    }
  }, [])

  const hasCore = () => ['Q','rho','mu','d_i','L_pipe'].every(k=>inp[k]!=='')

  const runCalc = async () => {
    if (!hasCore()) { setErr('Fill required fluid and pipe geometry fields (*)'); return }
    setLoading(true); setErr('')
    try {
      const nums = Object.fromEntries(Object.entries(inp).map(([k,v])=>[k,typeof v==='string'&&v!==''&&!isNaN(+v)?+v:v]))
      const res = await calculate('piping', nums)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('pipe'); await saveRun('piping','Piping & Valves', nums, res) }
    } catch(e) { setErr('Calculation error: '+e.message) }
    finally { setLoading(false) }
  }

  const loadSample = async () => {
    setInp(SAMPLE); setLoading(true); setErr('')
    try {
      const res = await calculate('piping', SAMPLE)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('pipe') }
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <SimPage name="Piping & Valves"
      tagline="Economic diameter (Sinnott-Towler), Darcy-Weisbach friction, ISA control valve Cv/Kv, API 520 PSV sizing, insulation heat loss, installed cost estimation.">
      <div className="flex gap-8">
        <div className="w-[300px] flex-shrink-0 overflow-y-auto" style={{maxHeight:'85vh'}}>

          <InputSection>Fluid & flow</InputSection>
          <ModelGuide title="Service type" criteria={[
            {model:'Liquid',when:'Any single-phase liquid flow. Use Darcy-Weisbach. Typical velocity: 1–3 m/s for process, 0.5–1.5 m/s for gravity. Economic diameter from Sinnott-Towler.'},
            {model:'Gas/vapour',when:'Compressible gas or vapour. Use Darcy-Weisbach with compressibility factor Z. Typical velocity: 15–30 m/s. Mach < 0.3 for incompressible assumption.'},
            {model:'Steam',when:'Steam distribution lines. Typical velocity: 25–35 m/s. High velocity increases erosion — limit based on pressure rating.'},
            {model:'Two-phase',when:'Liquid-gas mixture. Use Lockhart-Martinelli correlation. More complex — consult process engineer. Slug flow is hazardous.'},
          ]}/>
          <SelectField label="Service type" value={inp.serviceType||'liquid'} onChange={v=>set('serviceType',v)} options={SERVICE_TYPES}/>
          <Field label="Volumetric flow Q" unit="m³/s" value={inp.Q} onChange={v=>set('Q',v)} min={1e-6} step={0.001}
            hint="Design flow rate. Use maximum flow for pipe sizing. Normal flow for pressure drop and control valve sizing. Q = v × (π/4 × d²)."/>
          <Field label="Fluid density ρ" unit="kg/m³" value={inp.rho} onChange={v=>set('rho',v)} min={0.1}
            hint="At operating conditions. Liquids: 700–1100 kg/m³. Steam@5bar: 2.7 kg/m³. Air@1bar, 20°C: 1.2 kg/m³. For gas: ρ = PM/(ZRT)."/>
          <Field label="Dynamic viscosity μ" unit="Pa·s" value={inp.mu} onChange={v=>set('mu',v)} min={1e-7} step={0.0001}
            hint="At operating temperature. Water@20°C: 0.001. Water@80°C: 0.00035. Organic solvents: 0.001–0.01. Steam: 0.000015. For Re calculation."/>
          <Field label="Operating pressure P_op" unit="kPa abs" value={inp.P_op} onChange={v=>set('P_op',v)} min={1}
            hint="Line operating pressure. Used for PSV inlet pressure check and gas density calculation."/>
          <Field label="Operating temperature T_op" unit="°C" value={inp.T_op} onChange={v=>set('T_op',v)}
            hint="Fluid temperature for property evaluation and insulation heat loss."/>
          {(inp.serviceType==='gas'||inp.serviceType==='steam') && (
            <Field label="Molecular weight MW" unit="g/mol" value={inp.MW_gas} onChange={v=>set('MW_gas',v)} min={1}
              hint="Molecular weight of gas. Steam: 18. Natural gas: 17. Air: 29. Propane: 44. Used for ideal gas density calculation."/>
          )}

          <InputSection>Pipe geometry</InputSection>
          <Field label="Pipe internal diameter d_i" unit="m" value={inp.d_i} onChange={v=>set('d_i',v)} min={0.01} step={0.005}
            hint="Nominal bore. Standard: DN25(0.025m), DN50(0.051m), DN80(0.078m), DN100(0.102m), DN150(0.154m), DN200(0.205m). Economic diameter calculated automatically — compare your choice."/>
          <Field label="Wall thickness t_pipe" unit="m" value={inp.t_pipe} onChange={v=>set('t_pipe',v)} min={0.001} step={0.001}
            hint="Schedule 40: DN100=6.02mm. Schedule 80: DN100=8.59mm. Schedule 160: DN100=12.7mm."/>
          <Field label="Pipe length L" unit="m" value={inp.L_pipe} onChange={v=>set('L_pipe',v)} min={0.1}
            hint="Total straight pipe length. Does not include fittings — use the fittings section below for those."/>
          <Field label="Roughness ε" unit="mm" value={inp.roughness} onChange={v=>set('roughness',v)} min={0} step={0.001}
            hint="Pipe wall roughness. Carbon steel new: 0.046mm. Old/corroded CS: 0.3–1.0mm. Stainless steel: 0.015mm. PVC: 0.0015mm. Concrete: 0.3–3.0mm."/>

          <InputSection>Fittings (equivalent length method)</InputSection>
          <p className="text-[10.5px] text-muted mb-2 leading-snug">Enter count of each fitting type. ΔP from fittings is calculated using Crane K-factor method.</p>
          <Field label="90° elbows (standard radius)" value={inp.n_elbow90} onChange={v=>set('n_elbow90',v)} min={0}
            hint="Standard radius: K = 30×f_T. Long radius: K = 16×f_T. f_T = fully turbulent friction factor."/>
          <Field label="Gate valves (fully open)" value={inp.n_gate} onChange={v=>set('n_gate',v)} min={0}
            hint="K = 8×f_T when fully open. Never use as throttle valve — gate valves are on/off only."/>
          <Field label="Globe valves" value={inp.n_globe} onChange={v=>set('n_globe',v)} min={0}
            hint="K = 340×f_T. High resistance — used for throttling. Consider control valve instead for modulating service."/>
          <Field label="Check valves (swing)" value={inp.n_check} onChange={v=>set('n_check',v)} min={0}
            hint="Swing check: K = 100×f_T. Lift check: K = 600×f_T. Wafer check: K = 120×f_T."/>
          <Field label="Tee (flow through run)" value={inp.n_tee} onChange={v=>set('n_tee',v)} min={0}
            hint="Run direction: K = 20×f_T. Branch direction: K = 60×f_T. Enter tees as run or branch depending on flow path."/>

          <InputSection>Control valve</InputSection>
          <Field label="Control valve ΔP" unit="kPa" value={inp.dP_cv} onChange={v=>set('dP_cv',v)} min={1}
            hint="Pressure drop allocated to the control valve at design flow. Typically 30–50% of total system ΔP. Minimum: 35 kPa for good controllability. Too high = wasted energy. Too low = poor control."/>
          <Field label="Fluid SG (relative to water)" value={inp.SG_cv} onChange={v=>set('SG_cv',v)} min={0.1} step={0.01}
            hint="Specific gravity at flowing conditions. Water = 1.0. Organic liquids: 0.7–0.95. For gas service: use Z×MW/28.97."/>

          <InputSection>Pressure safety valve (PSV)</InputSection>
          <Field label="PSV set pressure P_set" unit="kPa abs" value={inp.P_set} onChange={v=>set('P_set',v)} min={100}
            hint="PSV set pressure = MAWP. Inlet pressure drop must be < 3% of set pressure per API 520. Back pressure < 10% (conventional) or 50% (balanced)."/>
          <Field label="Required relief flow W_psv" unit="kg/h" value={inp.W_psv} onChange={v=>set('W_psv',v)} min={1}
            hint="From relief load analysis. Process case (blocked outlet): from P&ID. Fire case: from API 521 heat input to vessel."/>
          <Field label="Relief fluid MW" unit="g/mol" value={inp.MW_psv} onChange={v=>set('MW_psv',v)} min={1}
            hint="Molecular weight of vapour at PSV inlet. Liquid service: enter 0 for API 520 Part I liquid sizing. Gas: actual MW at relief temperature."/>
          <Field label="Relief temperature T_psv" unit="°C" value={inp.T_psv} onChange={v=>set('T_psv',v)}
            hint="Temperature at PSV inlet during relief. Gas: use relieving temperature (may be higher than normal operating). Liquid: use maximum operating temperature."/>

          <InputSection>Insulation & economics</InputSection>
          <Field label="Insulation thickness t_ins" unit="mm" value={inp.t_ins} onChange={v=>set('t_ins',v)} min={0}
            hint="Hot pipe insulation: mineral wool 50–75mm, calcium silicate 50mm. Cold pipe: cellular glass 50–75mm. 0 = bare pipe."/>
          <Field label="Ambient temperature T_amb" unit="°C" value={inp.T_amb} onChange={v=>set('T_amb',v)}
            hint="Design ambient for heat loss calculation. Winter minimum for heat loss. Summer maximum for cold pipe (condensation check)."/>
          <Field label="Pipe cost per metre (installed)" unit="$/m" value={inp.pipe_cost} onChange={v=>set('pipe_cost',v)} min={10}
            hint="Installed cost including pipe, fittings, supports, hangers, painting. CS DN100: $200–500/m. SS DN100: $500–1000/m. Includes labour."/>
          <Field label="CEPCI ratio (current/2001)" value={inp.CEPCI_ratio} onChange={v=>set('CEPCI_ratio',v)} min={1}
            hint="2024: 820/397 = 2.065."/>

          {err && <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg"><p className="text-[11.5px] text-red-600 leading-snug">{err}</p></div>}
          <CalcButton onClick={runCalc} loading={loading}/>
        </div>

        <div className="flex-1 min-w-0">
          <TabBar tabs={TABS} active={tab} onChange={setTab}/>
          {tab==='sample' && (
            <div className="w-full max-w-4xl">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
                <p className="text-[14px] font-semibold text-blue-900 mb-1">Sample — Liquid hydrocarbon line, DN100, 200m</p>
                <p className="text-[12.5px] text-blue-700 mb-4">Q=0.005 m³/s, ρ=900 kg/m³, μ=0.005 Pa·s, d_i=100mm, L=200m. 4 elbows, 2 gate valves, 1 globe valve, 1 check valve.</p>
                <button onClick={loadSample} className="text-[13px] font-semibold bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">Load and run sample →</button>
              </div>
              <SectionHead>Expected results</SectionHead>
              <ResultTable rows={[
                ['Velocity','≈ 0.6–0.7','m/s'],
                ['Economic diameter d_opt (Sinnott-Towler)','≈ 0.08–0.12','m'],
                ['ΔP total','≈ 30–80','kPa'],
                ['Control valve Cv (ISA)','≈ 10–20','—'],
                ['PSV orifice (API 520)','Letter designation','cm²'],
              ]}/>
            </div>
          )}
          {tab !== 'sample' && loading && <CalcSpinner/>}
          {tab !== 'sample' && !r && !loading && <EmptyState onSample={loadSample}/>}

          {r && tab==='pipe' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="d_opt (economic)" value={f(r.d_opt,4)} unit="m" highlight/>
                <MetricCard label="Velocity" value={f(r.velocity,3)} unit="m/s"/>
                <MetricCard label="Reynolds Re" value={f(r.Re,0)} unit="—"/>
                <MetricCard label="Friction factor f" value={f(r.f_darcy,4)} unit="—"/>
              </div>
              <ResultTable rows={[
                ['Sinnott-Towler economic diameter d_opt = 0.664×Q^0.51×ρ^0.36×μ^0.18',f(r.d_opt,4),'m'],
                ['Velocity v = Q/(π/4×d_i²)',f(r.velocity,3),'m/s'],
                ['Reynolds Re = ρ×v×d_i/μ',f(r.Re,0),'—'],
                ['Flow regime',r.regime,'(turbulent > 4000)'],
                ['Darcy friction factor f (Swamee-Jain)',f(r.f_darcy,4),'—'],
                ['Relative roughness ε/d',f(r.rel_rough,6),'—'],
              ]}/>
            </div>
          )}

          {r && tab==='pressure' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="ΔP_pipe (straight)" value={f(r.dP_pipe,1)} unit="kPa" highlight/>
                <MetricCard label="ΔP_fittings" value={f(r.dP_fittings,1)} unit="kPa"/>
                <MetricCard label="ΔP_total" value={f(r.dP_total,1)} unit="kPa" highlight/>
                <MetricCard label="ΔP/L" value={f(r.dP_per_L,3)} unit="kPa/m"/>
              </div>
              <ResultTable rows={[
                ['ΔP_pipe = f×(L/d)×(ρ×v²/2)',f(r.dP_pipe,1),'kPa'],
                ['ΔP_fittings (Crane K-factor)',f(r.dP_fittings,1),'kPa'],
                ['Fitting K total',f(r.K_total,2),'—'],
                ['ΔP_total = ΔP_pipe + ΔP_fittings',f(r.dP_total,1),'kPa'],
                ['ΔP/L (specific)',f(r.dP_per_L,3),'kPa/m (limit 0.5 kPa/m)'],
                ['Pump head required',f(r.pump_head,2),'m'],
              ]}/>
            </div>
          )}

          {r && tab==='cv' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Cv (US, ISA)" value={f(r.Cv,2)} unit="—" highlight/>
                <MetricCard label="Kv (metric)" value={f(r.Kv,2)} unit="m³/h·bar^0.5"/>
                <MetricCard label="Valve type" value={inp.serviceType==='liquid'?'Liquid':'Gas'} unit=""/>
              </div>
              <ResultTable rows={[
                ['ISA S75.01 liquid sizing: Cv = Q×√(SG/ΔP_cv)',f(r.Cv,2),'—'],
                ['Kv = 0.865×Cv',f(r.Kv,2),'m³/h per bar^0.5'],
                ['Recommended valve style','Globe for Cv < 100, butterfly for Cv > 100',''],
                ['ΔP_cv at design flow',inp.dP_cv,'kPa'],
                ['Note: select next standard Cv from manufacturer catalogue','',''],
              ]}/>
            </div>
          )}

          {r && tab==='psv' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Orifice area A_req" value={f(r.A_psv_cm2,2)} unit="cm²" highlight/>
                <MetricCard label="API orifice" value={r.psv_orifice||'—'} unit=""/>
                <MetricCard label="P1 (set + 3%)" value={f(r.P1_psv,1)} unit="kPa"/>
              </div>
              <ResultTable rows={[
                ['API 520 Part I — gas/vapour sizing','',''],
                ['P_set',inp.P_set,'kPa abs'],
                ['P1 = P_set × 1.03',f(r.P1_psv,1),'kPa abs'],
                ['T_relief',inp.T_psv,'°C → '+(+inp.T_psv+273.15).toFixed(1)+' K'],
                ['Required orifice area A',f(r.A_psv_cm2,2),'cm²'],
                ['API 526 standard orifice',r.psv_orifice,'— next size up'],
                ['Selected orifice area',f(r.A_psv_selected,2),'cm²'],
              ]}/>
            </div>
          )}

          {r && tab==='econ' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Pipe installed cost" value={`$${f(r.pipe_installed,0)}`} unit="USD" highlight/>
                <MetricCard label="Heat loss" value={f(r.Q_loss,1)} unit="W"/>
                <MetricCard label="Heat loss/m" value={f(r.Q_loss_per_m,2)} unit="W/m"/>
              </div>
              <ResultTable rows={[
                ['Pipe installed cost = cost/m × L',`$${f(r.pipe_installed,0)}`,'USD'],
                ['Heat loss (insulated)',f(r.Q_loss,1),'W total'],
                ['Heat loss per unit length',f(r.Q_loss_per_m,2),'W/m (limit 1 kW/m per check)'],
                ['Insulation payback period',f(r.ins_payback,1),'years (if applicable)'],
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
