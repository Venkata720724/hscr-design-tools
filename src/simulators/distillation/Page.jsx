import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import SimPage, {
  TabBar, MetricCard, ResultTable, SectionHead, Check,
  Field, SelectField, InputSection, ModelGuide,
  CalcSpinner, EmptyState, CalcButton, SectionIncomplete
} from '../../components/SimPage'
import ComponentSelect from '../../components/ComponentSelect'
import MCInputs from './MCInputs'
import { calculate } from '../../lib/calculate'
import { saveRun } from '../../lib/history'

const TABS = [
  { id:'sample', label:'Sample Calculation' },
  { id:'vle',    label:'VLE Thermo' },
  { id:'mat',    label:'Material Balance' },
  { id:'fug',    label:'FUG Shortcut' },
  { id:'tray',   label:'Tray Hydraulics' },
  { id:'packed', label:'Packed Column' },
  { id:'energy', label:'Energy Balance' },
  { id:'mech',   label:'Mechanical' },
  { id:'econ',   label:'Economics' },
  { id:'checks', label:'Design Checks' },
]

// ── Binary sample defaults ────────────────────────────────────────
const SAMPLE = {
  F:100, zF:0.50, Tf:80, Pcol:101.325,
  xD:0.95, xB:0.05,
  ALK:6.90565, BLK:1211.033, CLK:220.79,
  AHK:6.95087, BHK:1342.31, CHK:219.187,
  R:2.5, colType:'tray',
  traySpacing:0.6, weirH:50, floodFrac:0.80,
  rhoL:870, rhoV:3.19, muL:0.42, sigma:21,
  lamLK:30720, lamHK:33180, mwLK:78.11, mwHK:92.14,
  CpL_LK:136, CpL_HK:157,
  ap:250, Fp:17, sigmaC:0.033,
  Sallow:137, CA:3, Ejt:1.0, windSpeed:45,
  CEPCI:820, CEPCIbase:397, FBM:4.16,
  steamCost:0.025, CWcost:0.0005, opHours:8000, payback:3, maint:0.02,
  Pc_kPa:4895,
}
const EMPTY = Object.fromEntries(Object.keys(SAMPLE).map(k => [k, '']))

// ── Multicomponent sample defaults ────────────────────────────────
const MC_SAMPLE_COMPS = [
  { name:'Benzene',  role:'LK',  z:0.25, MW:78.11,  Tb:80.1,  A:6.90565, B:1211.033, C:220.790 },
  { name:'Toluene',  role:'HK',  z:0.40, MW:92.14,  Tb:110.6, A:6.95087, B:1342.310, C:219.187 },
  { name:'o-Xylene', role:'HNK', z:0.20, MW:106.17, Tb:144.4, A:7.00154, B:1462.266, C:215.110 },
  { name:'m-Xylene', role:'HNK', z:0.15, MW:106.17, Tb:139.1, A:6.94760, B:1412.670, C:212.016 },
]
const MC_SAMPLE_GLOBAL = {
  F:100, Tf:100, Pcol:101.325, q:1, R_mult:1.3,
  RecD_LK:0.99, RecB_HK:0.99,
  colType:'tray', traySpacing:0.6, weirH:50, floodFrac:0.80,
  rhoL:870, rhoV:3.5, muL:0.55, sigma:25,
  efficiencyModel:'oconnell', fixedEfficiency:0.70, feedCondModel:'1',
  Sallow:137, CA:3, Ejt:1.0, windSpeed:45,
  CEPCI:820, CEPCIbase:397, FBM:4.16,
  steamCost:0.025, CWcost:0.0005, opHours:8000, payback:3, maint:0.02,
}
const MC_EMPTY_COMPS = [
  { name:'', role:'LK',  z:'', MW:'', Tb:'', A:'', B:'', C:'' },
  { name:'', role:'HK',  z:'', MW:'', Tb:'', A:'', B:'', C:'' },
]
const MC_EMPTY_GLOBAL = {
  F:'', Tf:'', Pcol:'', q:1, R_mult:'', RecD_LK:'', RecB_HK:'',
  colType:'tray', traySpacing:'', weirH:'', floodFrac:'',
  rhoL:'', rhoV:'', muL:'', sigma:'',
  efficiencyModel:'oconnell', fixedEfficiency:'', feedCondModel:'1',
  Sallow:'', CA:'', Ejt:'', windSpeed:'',
  CEPCI:'', CEPCIbase:'', FBM:'', steamCost:'', CWcost:'', opHours:'', payback:'', maint:'',
}

// ── McCabe-Thiele chart ───────────────────────────────────────────
function MCTChart({ r, xD, xB, zF }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current; if (!cv || !r) return
    const ctx = cv.getContext('2d')
    const W = cv.clientWidth || 600, H = 360
    cv.width = W; cv.height = H
    const pad = { l:44, r:16, t:16, b:44 }
    const pw = W-pad.l-pad.r, ph = H-pad.t-pad.b
    const px = x => pad.l+x*pw, py = y => pad.t+(1-y)*ph
    ctx.clearRect(0, 0, W, H)
    ctx.strokeStyle='#f0f0f0'; ctx.lineWidth=0.5
    for (let i=0; i<=10; i++) {
      const v=i/10
      ctx.beginPath(); ctx.moveTo(px(v),py(0)); ctx.lineTo(px(v),py(1)); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(px(0),py(v)); ctx.lineTo(px(1),py(v)); ctx.stroke()
    }
    ctx.strokeStyle='#bbb'; ctx.lineWidth=1.5
    ctx.beginPath(); ctx.moveTo(px(0),py(0)); ctx.lineTo(px(1),py(0)); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(px(0),py(0)); ctx.lineTo(px(0),py(1)); ctx.stroke()
    ctx.fillStyle='#999'; ctx.font='11px system-ui'; ctx.textAlign='center'
    for (let i=0; i<=10; i++) {
      const v=i/10
      ctx.fillText(v.toFixed(1), px(v), py(0)+18)
      ctx.textAlign='right'; ctx.fillText(v.toFixed(1), px(0)-5, py(v)+4); ctx.textAlign='center'
    }
    ctx.fillText('x (liquid mole fraction)', px(0.5), py(0)+34)
    ctx.save(); ctx.translate(px(0)-34, py(0.5)); ctx.rotate(-Math.PI/2)
    ctx.fillText('y (vapour mole fraction)', 0, 0); ctx.restore()
    const poly = (pts, c, lw, dash) => {
      if (!pts || pts.length < 2) return
      ctx.save(); ctx.strokeStyle=c; ctx.lineWidth=lw||2; ctx.setLineDash(dash||[])
      ctx.beginPath(); pts.forEach(([x,y],i) => i ? ctx.lineTo(px(x),py(y)) : ctx.moveTo(px(x),py(y))); ctx.stroke(); ctx.restore()
    }
    const vleY = (x, a) => a*x/(1+(a-1)*x)
    const a=r.alpha_avg, xDn=+xD, xBn=+xB, zFn=+zF
    poly([[0,0],[1,1]], '#ddd', 1, [4,4])
    poly(Array.from({length:101},(_,i)=>{const x=i/100;return[x,vleY(x,a)]}), '#2563eb', 2.5)
    poly([[xDn,xDn],[r.xq,r.yq]], '#16a34a', 2)
    poly([[xBn,xBn],[r.xq,r.yq]], '#f97316', 2)
    poly([[zFn,0],[zFn,vleY(zFn,a)]], '#dc2626', 1.5, [4,3])
    ctx.strokeStyle='#7c3aed'; ctx.lineWidth=1.8; ctx.setLineDash([])
    let yc=xDn, xp=xDn
    for (let s=0; s<80&&yc>xBn+0.003; s++) {
      const xe=yc/(a-(a-1)*yc)
      ctx.beginPath(); ctx.moveTo(px(xp),py(yc)); ctx.lineTo(px(xe),py(yc)); ctx.stroke()
      if (xe<=xBn) break
      const yo=xe>=r.xq?r.slope_rect*xe+r.int_rect:r.slope_strip*xe+r.int_strip
      ctx.beginPath(); ctx.moveTo(px(xe),py(yc)); ctx.lineTo(px(xe),py(Math.max(yo,0))); ctx.stroke()
      yc=Math.max(yo,0); xp=xe; if(yc<=xBn+0.001) break
    }
    ctx.font='11px system-ui'; ctx.textAlign='left'
    const leg=[['Equilibrium','#2563eb'],['Rectifying OL','#16a34a'],['Stripping OL','#f97316'],['q-line','#dc2626'],['Stages','#7c3aed']]
    leg.forEach(([lb,c],i) => {
      const lx=pad.l+4+(i>2?(i-3)*155:i*155), ly=pad.t+(i>2?20:4)
      ctx.fillStyle=c; ctx.fillRect(lx,ly+4,16,3); ctx.fillStyle='#555'; ctx.fillText(lb,lx+20,ly+9)
    })
  }, [r, xD, xB, zF])
  return <canvas ref={ref} style={{width:'100%',height:360,display:'block'}}/>
}

// ── Main page component ───────────────────────────────────────────
export default function DistillationPage() {
  const location = useLocation()
  const [mode, setMode] = useState('binary')
  const [inp, setInp] = useState(EMPTY)
  const [mcComps, setMcComps] = useState(MC_EMPTY_COMPS)
  const [mcGlobal, setMcGlobal] = useState(MC_EMPTY_GLOBAL)
  const [tab, setTab] = useState('sample')
  const [r, setR] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setInp(p => ({...p, [k]: v}))
  const f = (v, d=2) => v == null ? '—' : (+v).toFixed(d)

  // Restore from history
  useEffect(() => {
    const state = location.state
    if (state?.restore && state?.inputs) {
      setInp(state.inputs)
      if (state.results) { setR(state.results); setTab('vle') }
    }
  }, [])

  const hasCore  = () => ['F','zF','xD','xB','R'].every(k => inp[k] !== '')
  const hasVLE   = () => ['ALK','BLK','CLK','AHK','BHK','CHK'].every(k => inp[k] !== '')
  const hasTray  = () => ['rhoL','rhoV','muL','sigma','traySpacing','weirH','floodFrac'].every(k => inp[k] !== '')
  const hasMech  = () => ['Sallow','CA','Ejt'].every(k => inp[k] !== '')
  const hasEcon  = () => ['CEPCI','FBM','steamCost','opHours'].every(k => inp[k] !== '')

  // Binary calculate
  const runCalc = async () => {
    if (!hasCore()) { setErr('Fill required feed, product and reflux fields (*)'); return }
    setLoading(true); setErr('')
    try {
      const nums = Object.fromEntries(Object.entries(inp).map(([k,v]) => [k, v===''?0:+v]))
      const res = await calculate('distillation', nums)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('vle'); await saveRun('distillation','Distillation Column', nums, res) }
    } catch(e) { setErr('Calculation error: '+e.message) }
    finally { setLoading(false) }
  }

  // Binary load sample
  const loadSampleBinary = async () => {
    setInp(SAMPLE); setLoading(true); setErr('')
    try {
      const res = await calculate('distillation', SAMPLE)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('vle') }
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  // Multicomponent calculate
  const runCalcMC = async () => {
    const active = mcComps.filter(c => +c.z > 0)
    if (active.length < 2) { setErr('Need at least 2 components with z > 0'); return }
    if (!active.some(c => c.role==='LK')) { setErr('Designate exactly one component as LK'); return }
    if (!active.some(c => c.role==='HK')) { setErr('Designate exactly one component as HK'); return }
    const sumZ = active.reduce((s,c) => s+(+c.z), 0)
    if (Math.abs(sumZ-1) > 0.01) { setErr(`Feed fractions sum to ${sumZ.toFixed(3)} — must equal 1.000`); return }
    if (!mcGlobal.F || !mcGlobal.RecD_LK || !mcGlobal.RecB_HK || !mcGlobal.rhoL) {
      setErr('Fill required fields: F, T_f, RecD_LK, RecB_HK, physical properties'); return
    }
    setLoading(true); setErr('')
    try {
      const inputs = {
        mode: 'multicomponent', ...mcGlobal,
        q: mcGlobal.feedCondModel === 'custom' ? +mcGlobal.q : +mcGlobal.feedCondModel,
        comps: active.map(c => ({...c, z:+c.z, MW:+c.MW, Tb:+c.Tb, A:+c.A, B:+c.B, C:+c.C})),
      }
      const res = await calculate('distillation', inputs)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('vle') }
    } catch(e) { setErr('Calculation error: '+e.message) }
    finally { setLoading(false) }
  }

  // Multicomponent load sample
  const loadSampleMC = async () => {
    setMcComps(MC_SAMPLE_COMPS); setMcGlobal(MC_SAMPLE_GLOBAL)
    setLoading(true); setErr('')
    try {
      const inputs = { mode:'multicomponent', ...MC_SAMPLE_GLOBAL, q:1, comps:MC_SAMPLE_COMPS }
      const res = await calculate('distillation', inputs)
      if (res.error) setErr(res.error)
      else { setR(res); setTab('vle') }
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  // Auto-fill from component search
  const selectLK = (comp) => setInp(p => ({...p,
    ALK:comp.antoine.A, BLK:comp.antoine.B, CLK:comp.antoine.C,
    mwLK:comp.MW, lamLK:comp.lambda, CpL_LK:comp.CpL,
    rhoL:comp.rhoL, rhoV:comp.rhoV, muL:comp.muL, sigma:comp.sigma,
  }))
  const selectHK = (comp) => setInp(p => ({...p,
    AHK:comp.antoine.A, BHK:comp.antoine.B, CHK:comp.antoine.C,
    mwHK:comp.MW, lamHK:comp.lambda, CpL_HK:comp.CpL,
  }))

  return (
    <SimPage name="Distillation Column"
      tagline="Binary and multicomponent column design — VLE, McCabe-Thiele, FUG shortcut, tray and packed hydraulics, energy balance, ASME mechanical, Turton economics.">
      <div className="flex gap-8">

        {/* ── INPUT PANEL ──────────────────────────────────────── */}
        <div className="w-[300px] flex-shrink-0 overflow-y-auto" style={{maxHeight:'85vh'}}>

          {/* Mode toggle */}
          <div className="mb-4 border border-line rounded-xl p-1 flex bg-soft">
            <button onClick={() => { setMode('binary'); setR(null); setTab('sample') }}
              className={`flex-1 py-2 rounded-lg text-[12.5px] font-semibold transition-colors cursor-pointer border-0
                ${mode==='binary' ? 'bg-white text-ink shadow-sm' : 'bg-transparent text-muted hover:text-ink'}`}>
              Binary
            </button>
            <button onClick={() => { setMode('multicomponent'); setR(null); setTab('sample') }}
              className={`flex-1 py-2 rounded-lg text-[12.5px] font-semibold transition-colors cursor-pointer border-0
                ${mode==='multicomponent' ? 'bg-white text-ink shadow-sm' : 'bg-transparent text-muted hover:text-ink'}`}>
              Multicomponent
            </button>
          </div>

          {/* Multicomponent inputs */}
          {mode==='multicomponent' && (
            <div>
              <MCInputs comps={mcComps} setComps={setMcComps} mcGlobal={mcGlobal} setMcGlobal={setMcGlobal}/>
              {err && <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg"><p className="text-[11.5px] text-red-600 leading-snug">{err}</p></div>}
              <CalcButton onClick={runCalcMC} loading={loading}/>
            </div>
          )}

          {/* Binary inputs */}
          {mode==='binary' && (
            <div>
              <InputSection>Feed conditions</InputSection>
              <Field label="Feed flow F" unit="mol/h" value={inp.F} onChange={v=>set('F',v)} min={1}
                hint="Total molar feed rate to the column."/>
              <Field label="z_F — light key" unit="mol/mol" value={inp.zF} onChange={v=>set('zF',v)} min={0.01} max={0.99} step={0.01}
                hint="Mole fraction of the more volatile component in the feed. Must be between x_B and x_D."/>
              <Field label="Feed temperature" unit="°C" value={inp.Tf} onChange={v=>set('Tf',v)}
                hint="Actual temperature of the feed stream entering the column."/>
              <Field label="Column pressure" unit="kPa" value={inp.Pcol} onChange={v=>set('Pcol',v)} min={1}
                hint="Operating pressure at the top of the column. Use 101.325 kPa for atmospheric."/>

              <InputSection>Product specifications</InputSection>
              <Field label="x_D — distillate purity" unit="mol/mol" value={inp.xD} onChange={v=>set('xD',v)} min={0.51} max={0.999} step={0.005}
                hint="Required purity of light key in the distillate. Higher purity requires more stages and higher reflux."/>
              <Field label="x_B — bottoms purity" unit="mol/mol" value={inp.xB} onChange={v=>set('xB',v)} min={0.001} max={0.49} step={0.005}
                hint="Light key content remaining in the bottoms. Lower value = tighter separation = more stages."/>

              <InputSection>Light key component</InputSection>
              <ComponentSelect label="Search and select light key" onSelect={selectLK}/>
              <Field label="Antoine A (LK)" value={inp.ALK} onChange={v=>set('ALK',v)} step={0.001}
                hint="Auto-filled from component search. Source: NIST WebBook (webbook.nist.gov). Formula: log₁₀(P/mmHg) = A − B/(C+T°C)."/>
              <Field label="Antoine B (LK)" value={inp.BLK} onChange={v=>set('BLK',v)} step={0.001}/>
              <Field label="Antoine C (LK)" value={inp.CLK} onChange={v=>set('CLK',v)} step={0.001}/>

              <InputSection>Heavy key component</InputSection>
              <ComponentSelect label="Search and select heavy key" onSelect={selectHK}/>
              <Field label="Antoine A (HK)" value={inp.AHK} onChange={v=>set('AHK',v)} step={0.001}
                hint="Auto-filled from component search above."/>
              <Field label="Antoine B (HK)" value={inp.BHK} onChange={v=>set('BHK',v)} step={0.001}/>
              <Field label="Antoine C (HK)" value={inp.CHK} onChange={v=>set('CHK',v)} step={0.001}/>

              <InputSection>Reflux and column type</InputSection>
              <Field label="Reflux ratio R" value={inp.R} onChange={v=>set('R',v)} min={0.5} max={30} step={0.1}
                hint="R_min is calculated automatically. Typical design: 1.1–1.5 × R_min. Higher R = more stages but higher energy cost."/>
              <ModelGuide title="Column type" criteria={[
                { model:'Sieve tray', when:'Throughput > 5 m³/h; fouling or solids present; turndown > 3:1 needed.' },
                { model:'Packed column', when:'Pressure drop must be minimised; column diameter < 0.6 m; corrosive service.' },
              ]}/>
              <SelectField label="Column type" value={inp.colType} onChange={v=>set('colType',v)}
                options={[{value:'tray',label:'Sieve tray column'},{value:'packed',label:'Packed column'}]}/>
              <Field label="Tray spacing" unit="m" value={inp.traySpacing} onChange={v=>set('traySpacing',v)} min={0.3} max={0.9} step={0.05}
                hint="Standard: 0.6 m. Use 0.45 m for small columns. Use 0.75–0.9 m for high liquid loads or foaming systems."/>
              <Field label="Weir height" unit="mm" value={inp.weirH} onChange={v=>set('weirH',v)} min={20} max={100}
                hint="Standard: 50 mm. Higher weir increases liquid holdup and efficiency but also pressure drop."/>
              <Field label="Flood fraction" value={inp.floodFrac} onChange={v=>set('floodFrac',v)} min={0.60} max={0.85} step={0.05}
                hint="Design velocity as fraction of flooding velocity. 0.75 = conservative. 0.80 = standard. 0.85 = maximum."/>

              <InputSection>Physical properties</InputSection>
              <p className="text-[10.5px] text-muted mb-2 leading-snug">Auto-filled when you select components above. Verify values at your operating temperature.</p>
              <Field label="ρ_L liquid density" unit="kg/m³" value={inp.rhoL} onChange={v=>set('rhoL',v)} min={300}
                hint="Typical organics: 600–900 kg/m³."/>
              <Field label="ρ_V vapour density" unit="kg/m³" value={inp.rhoV} onChange={v=>set('rhoV',v)} min={0.1} step={0.01}
                hint="Estimate: ρ_V = P·MW/(R·T). Typical near-atmospheric: 1–10 kg/m³."/>
              <Field label="μ_L liquid viscosity" unit="mPa·s" value={inp.muL} onChange={v=>set('muL',v)} min={0.05} step={0.01}
                hint="Light organics: 0.3–1.0 mPa·s. Used in tray efficiency and flooding correlations."/>
              <Field label="σ surface tension" unit="mN/m" value={inp.sigma} onChange={v=>set('sigma',v)} min={1}
                hint="Typical organics: 15–35 mN/m. Used in Fair flooding correction."/>
              <Field label="λ_LK latent heat" unit="J/mol" value={inp.lamLK} onChange={v=>set('lamLK',v)} min={1000}/>
              <Field label="λ_HK latent heat" unit="J/mol" value={inp.lamHK} onChange={v=>set('lamHK',v)} min={1000}/>
              <Field label="MW_LK" unit="g/mol" value={inp.mwLK} onChange={v=>set('mwLK',v)} min={1}/>
              <Field label="MW_HK" unit="g/mol" value={inp.mwHK} onChange={v=>set('mwHK',v)} min={1}/>
              <Field label="Cp_L (LK)" unit="J/mol·K" value={inp.CpL_LK} onChange={v=>set('CpL_LK',v)} min={1}/>
              <Field label="Cp_L (HK)" unit="J/mol·K" value={inp.CpL_HK} onChange={v=>set('CpL_HK',v)} min={1}/>
              <Field label="P_c critical pressure" unit="kPa" value={inp.Pc_kPa} onChange={v=>set('Pc_kPa',v)} min={100}
                hint="Critical pressure of bottoms fluid. Used in Mostinski reboiler correlation. Find from NIST or Perry's."/>

              <InputSection>Mechanical — ASME (optional)</InputSection>
              <p className="text-[10.5px] text-muted mb-2 leading-snug">Leave blank to skip mechanical calculations.</p>
              <Field label="S_allow allowable stress" unit="MPa" value={inp.Sallow} onChange={v=>set('Sallow',v)} min={50} required={false}
                hint="ASME Table UCS-23. Carbon steel SA-516 Gr.70: 137 MPa. Stainless 304: 138 MPa."/>
              <Field label="Corrosion allowance" unit="mm" value={inp.CA} onChange={v=>set('CA',v)} min={0} max={10} required={false}
                hint="Standard: 3 mm carbon steel, 1.5 mm stainless steel."/>
              <Field label="Joint efficiency E" value={inp.Ejt} onChange={v=>set('Ejt',v)} min={0.7} max={1.0} step={0.05} required={false}
                hint="Full radiography (Type 1): 1.0. Spot (Type 2): 0.85. No radiography (Type 3): 0.70."/>
              <Field label="Wind speed" unit="m/s" value={inp.windSpeed} onChange={v=>set('windSpeed',v)} min={10} required={false}
                hint="Hyderabad (IS 875 Zone II): 44 m/s. Use local wind zone map."/>

              <InputSection>Economics (optional)</InputSection>
              <p className="text-[10.5px] text-muted mb-2 leading-snug">Leave blank to skip cost estimation.</p>
              <Field label="CEPCI current" value={inp.CEPCI} onChange={v=>set('CEPCI',v)} min={300} required={false}
                hint="Current year CEPCI. 2024 ≈ 820. Find at che.com/pci."/>
              <Field label="CEPCI base (2001)" value={inp.CEPCIbase} onChange={v=>set('CEPCIbase',v)} required={false}
                hint="Turton base year = 397. Do not change."/>
              <Field label="FBM factor" value={inp.FBM} onChange={v=>set('FBM',v)} min={1} step={0.01} required={false}
                hint="Carbon steel column: 4.16. Stainless 304: 5.2. (Turton Table A.1)"/>
              <Field label="Steam cost" unit="$/kg" value={inp.steamCost} onChange={v=>set('steamCost',v)} step={0.005} required={false}
                hint="LP steam (5 bar): $0.018–0.025/kg."/>
              <Field label="CW cost" unit="$/m³" value={inp.CWcost} onChange={v=>set('CWcost',v)} step={0.0001} required={false}
                hint="Typical: $0.0003–0.001/m³."/>
              <Field label="Operating hours" unit="h/yr" value={inp.opHours} onChange={v=>set('opHours',v)} min={1000} required={false}
                hint="Continuous plant: 8000–8760 h/yr."/>
              <Field label="Payback period" unit="yr" value={inp.payback} onChange={v=>set('payback',v)} min={1} required={false}
                hint="Standard TAC payback: 3 years."/>

              {err && (
                <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-[11.5px] text-red-600 leading-snug">{err}</p>
                </div>
              )}
              <CalcButton onClick={runCalc} loading={loading}/>
            </div>
          )}
        </div>

        {/* ── RESULTS PANEL ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <TabBar tabs={TABS} active={tab} onChange={setTab}/>

          {/* ── Sample tab — Binary ── */}
          {tab==='sample' && mode==='binary' && (
            <div className="w-full max-w-4xl">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
                <p className="text-[14px] font-semibold text-blue-900 mb-1">Sample calculation — Benzene / Toluene</p>
                <p className="text-[12.5px] text-blue-700 mb-4">Binary system at atmospheric pressure. Feed equimolar at bubble point. Target: 95 mol% benzene distillate, 5 mol% benzene bottoms.</p>
                <button onClick={loadSampleBinary}
                  className="text-[13px] font-semibold bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                  Load and run sample →
                </button>
              </div>
              <SectionHead>Sample inputs</SectionHead>
              <ResultTable rows={[
                ['Feed flow F','100','mol/h'],['Feed composition z_F','0.50','mol/mol benzene'],
                ['Feed temperature','80','°C'],['Column pressure','101.325','kPa'],
                ['Distillate x_D','0.95','mol/mol'],['Bottoms x_B','0.05','mol/mol'],
                ['Reflux ratio R','2.5','—'],
                ['Antoine (benzene) A/B/C','6.90565 / 1211.033 / 220.79','—'],
                ['Antoine (toluene) A/B/C','6.95087 / 1342.31 / 219.187','—'],
              ]}/>
              <SectionHead>Expected key results</SectionHead>
              <ResultTable rows={[
                ['α_avg','≈ 2.45','—'],['N_min','≈ 7.0','stages'],
                ['R_min','≈ 1.53','—'],['N_theoretical','≈ 11.5','stages'],
                ['N_actual','≈ 18','trays'],['D_col','0.45–0.60','m'],
                ['Q_condenser','≈ 95','kW'],['CAPEX','≈ $180k','USD'],
              ]}/>
              <p className="text-[11.5px] text-muted mt-4 p-3 bg-soft rounded-lg">
                To run your own design, fill values in the left panel and click <strong>Calculate</strong>. Fields marked <span className="text-red-400">*</span> are required.
              </p>
            </div>
          )}

          {/* ── Sample tab — Multicomponent ── */}
          {tab==='sample' && mode==='multicomponent' && (
            <div className="w-full max-w-4xl">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
                <p className="text-[14px] font-semibold text-blue-900 mb-1">Sample calculation — Benzene / Toluene / o-Xylene / m-Xylene</p>
                <p className="text-[12.5px] text-blue-700 mb-1">4-component aromatic mixture. Separate benzene (LK) from toluene (HK) with xylenes as heavy non-keys.</p>
                <p className="text-[11.5px] text-blue-600 mb-4">Feed: 25% benzene, 40% toluene, 20% o-xylene, 15% m-xylene. Target: 99% benzene recovery in distillate, 99% toluene in bottoms.</p>
                <button onClick={loadSampleMC}
                  className="text-[13px] font-semibold bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                  Load and run sample →
                </button>
              </div>
              <SectionHead>Sample inputs</SectionHead>
              <ResultTable rows={[
                ['Feed flow F','100','mol/h'],['Feed temperature','100','°C'],
                ['Column pressure','101.325','kPa (atmospheric)'],
                ['Feed condition q','1.0','bubble-point liquid'],
                ['R multiplier','1.3','× R_min'],
                ['Comp A — Benzene (LK)','z = 0.25','—'],
                ['Comp B — Toluene (HK)','z = 0.40','—'],
                ['Comp C — o-Xylene (HNK)','z = 0.20','—'],
                ['Comp D — m-Xylene (HNK)','z = 0.15','—'],
                ['RecD_LK','0.99','99% benzene in distillate'],
                ['RecB_HK','0.99','99% toluene in bottoms'],
              ]}/>
              <SectionHead>Methods used</SectionHead>
              <ResultTable rows={[
                ['Relative volatility','Antoine equation for each component vs HK',''],
                ['N_min','Fenske equation using LK/HK pair',''],
                ['R_min','Underwood — full multicomponent (θ root by Newton-Raphson)',''],
                ['Non-key distribution','Hengstebeck-Geddes: log(d_i/b_i) = N_min·log(α_i) + C',''],
                ['N_theoretical','Gilliland-Molokanov correlation',''],
                ['Feed tray','Kirkbride method (NR/NS ratio)',''],
              ]}/>
            </div>
          )}

          {/* Loading */}
          {tab !== 'sample' && loading && <CalcSpinner/>}

          {/* Empty state */}
          {tab !== 'sample' && !r && !loading && (
            <EmptyState onSample={() => mode==='binary' ? loadSampleBinary() : loadSampleMC()}/>
          )}

          {/* ── VLE tab ── */}
          {r && tab==='vle' && r.mode==='multicomponent' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Components" value={r.n_comps} unit="active"/>
                <MetricCard label="α_LK (vs HK)" value={f(r.alpha_LK,3)} unit="—" highlight/>
                <MetricCard label="α variation" value={f(r.alpha_var,1)} unit="%"/>
                <MetricCard label="MW_feed" value={f(r.MW_feed,2)} unit="g/mol"/>
                <MetricCard label="MW_distillate" value={f(r.MW_dist,2)} unit="g/mol"/>
                <MetricCard label="MW_bottoms" value={f(r.MW_bots,2)} unit="g/mol"/>
              </div>
              <SectionHead>Relative volatilities (vs HK)</SectionHead>
              <table className="w-full text-[12px] border-collapse mb-4">
                <thead>
                  <tr className="bg-soft border-b border-line">
                    {['Component','Role','z_i','α_top','α_bot','α_avg'].map(h=>(
                      <th key={h} className="text-left py-2 px-2 text-[10.5px] font-bold text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.comps_data?.map((c,i)=>(
                    <tr key={i} className="border-b border-line">
                      <td className="py-2 px-2 font-medium text-ink">{c.name||`Comp ${String.fromCharCode(65+i)}`}</td>
                      <td className="py-2 px-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.role==='LK'?'bg-green-100 text-green-700':c.role==='HK'?'bg-blue-100 text-blue-700':'bg-soft text-muted'}`}>
                          {c.role}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-muted">{(+c.z).toFixed(3)}</td>
                      <td className="py-2 px-2">{c.al_top?(+c.al_top).toFixed(3):'—'}</td>
                      <td className="py-2 px-2">{c.al_bot?(+c.al_bot).toFixed(3):'—'}</td>
                      <td className="py-2 px-2 font-semibold">{c.al_avg?(+c.al_avg).toFixed(3):'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ResultTable rows={[
                ['Underwood θ (Newton-Raphson)',`θ = ${f(r.theta,4)}  (between α_HK=1 and α_LK=${f(r.alpha_LK,3)})`,''],
                ['Underwood check (should be ≈ 0)',f(r.underwood_check,6),''],
                ['α variation check',`${f(r.alpha_var,1)}%  ${+r.alpha_var>15?'⚠ consider rigorous simulation':'✓ constant α acceptable'}`,''],
              ]}/>
            </div>
          )}

          {r && tab==='vle' && r.mode!=='multicomponent' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="T_bubble" value={f(r.T_bub,1)} unit="°C"/>
                <MetricCard label="T_dew (est.)" value={f(r.T_dew,1)} unit="°C"/>
                <MetricCard label="α_avg (geom. mean)" value={f(r.alpha_avg,3)} unit="—" highlight/>
                <MetricCard label="α variation" value={f(r.alpha_var,1)} unit="%"/>
              </div>
              <div className="border border-line rounded-xl p-4 mb-5">
                <p className="text-[12.5px] font-semibold text-ink mb-3">McCabe-Thiele diagram</p>
                <MCTChart r={r} xD={inp.xD} xB={inp.xB} zF={inp.zF}/>
              </div>
              <ResultTable rows={[
                ['Model','Antoine log₁₀(P*) = A − B/(C+T) with Raoult\'s law',''],
                ['T_bubble',f(r.T_bub,1),'°C'],['T_dew',f(r.T_dew,1),'°C'],
                ['T_top (distillate)',f(r.T_top,1),'°C'],['T_bottom (reboiler)',f(r.T_bot,1),'°C'],
                ['α_avg',f(r.alpha_avg,3),'—'],
                ['α variation',`${f(r.alpha_var,1)}%  ${r.alpha_var>15?'⚠ use rigorous':'✓ OK'}`,''],
              ]}/>
            </div>
          )}

          {/* ── Material Balance tab ── */}
          {r && tab==='mat' && r.mode==='multicomponent' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Distillate D" value={f(r.D_total,2)} unit="mol/h" highlight/>
                <MetricCard label="Bottoms B" value={f(r.B_total,2)} unit="mol/h" highlight/>
                <MetricCard label="x_D,LK" value={f(r.x_D_LK,4)} unit="mol/mol"/>
                <MetricCard label="x_B,HK" value={f(r.x_B_HK,4)} unit="mol/mol"/>
              </div>
              <SectionHead>Component distribution — Hengstebeck-Geddes</SectionHead>
              <table className="w-full text-[12px] border-collapse mb-4">
                <thead>
                  <tr className="bg-soft border-b border-line">
                    {['Component','Role','F·z_i','d_i distillate','b_i bottoms','x_D,i','x_B,i'].map(h=>(
                      <th key={h} className="text-left py-2 px-2 text-[10.5px] font-bold text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.comps_data?.map((c,i)=>(
                    <tr key={i} className="border-b border-line">
                      <td className="py-2 px-2 font-medium text-ink">{c.name||`Comp ${String.fromCharCode(65+i)}`}</td>
                      <td className="py-2 px-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.role==='LK'?'bg-green-100 text-green-700':c.role==='HK'?'bg-blue-100 text-blue-700':'bg-soft text-muted'}`}>{c.role}</span>
                      </td>
                      <td className="py-2 px-2 text-muted">{(c.z*100).toFixed(1)}</td>
                      <td className="py-2 px-2 text-green-700 font-medium">{(+c.d_i).toFixed(2)}</td>
                      <td className="py-2 px-2 text-orange-700 font-medium">{(+c.b_i).toFixed(2)}</td>
                      <td className="py-2 px-2">{(+c.xD_i).toFixed(4)}</td>
                      <td className="py-2 px-2">{(+c.xB_i).toFixed(4)}</td>
                    </tr>
                  ))}
                  <tr className="bg-soft font-semibold border-t-2 border-line">
                    <td className="py-2 px-2" colSpan={3}>Total</td>
                    <td className="py-2 px-2 text-green-700">{f(r.D_total,2)} mol/h</td>
                    <td className="py-2 px-2 text-orange-700">{f(r.B_total,2)} mol/h</td>
                    <td className="py-2 px-2">1.0000</td>
                    <td className="py-2 px-2">1.0000</td>
                  </tr>
                </tbody>
              </table>
              <ResultTable rows={[
                ['Hengstebeck-Geddes constant C',f(r.C_HG,4),'—'],
                ['Mass balance check D+B',f(+r.D_total+ +r.B_total,2),'mol/h (should equal F)'],
              ]}/>
            </div>
          )}

          {r && tab==='mat' && r.mode!=='multicomponent' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Distillate D" value={f(r.D,2)} unit="mol/h" highlight/>
                <MetricCard label="Bottoms B" value={f(r.B,2)} unit="mol/h" highlight/>
                <MetricCard label="LK recovery" value={f(r.LK_rec,1)} unit="%"/>
                <MetricCard label="HK recovery" value={f(r.HK_rec,1)} unit="%"/>
                <MetricCard label="L rectifying" value={f(r.L_rect,1)} unit="mol/h"/>
                <MetricCard label="V rectifying" value={f(r.V_rect,1)} unit="mol/h"/>
                <MetricCard label="L′ stripping" value={f(r.L_strip,1)} unit="mol/h"/>
                <MetricCard label="V′ stripping" value={f(r.V_strip,1)} unit="mol/h"/>
              </div>
              <ResultTable rows={[
                ['D = F·(z_F−x_B)/(x_D−x_B)',f(r.D,2),'mol/h'],
                ['B = F − D',f(r.B,2),'mol/h'],
                ['LK recovery η_LK',f(r.LK_rec,1),'%'],['HK recovery η_HK',f(r.HK_rec,1),'%'],
                ['L_rectifying = R·D',f(r.L_rect,1),'mol/h'],
                ['V_rectifying = (R+1)·D',f(r.V_rect,1),'mol/h'],
                ['L′_stripping = L+q·F',f(r.L_strip,1),'mol/h'],
                ['V′_stripping = V−(1−q)·F',f(r.V_strip,1),'mol/h'],
                ['q-line / rect. intersection (x_q, y_q)',`(${r.xq}, ${f(r.yq,3)})`,''],
              ]}/>
            </div>
          )}

          {/* ── FUG tab ── */}
          {r && tab==='fug' && r.mode==='multicomponent' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="N_min (Fenske)" value={f(r.N_min,2)} unit="stages"/>
                <MetricCard label="R_min (Underwood)" value={f(r.Rmin,3)} unit="—"/>
                <MetricCard label="R actual" value={f(r.R,3)} unit={`(${r.R_mult}×R_min)`}/>
                <MetricCard label="N_theoretical" value={f(r.N_th,1)} unit="stages" highlight/>
                <MetricCard label="N_actual" value={r.N_act} unit="trays" highlight/>
                <MetricCard label="E_OC efficiency" value={f(r.E_OC*100,1)} unit="%"/>
                <MetricCard label="NR (above feed)" value={r.NR} unit="stages"/>
                <MetricCard label="NS (below feed)" value={r.NS} unit="stages"/>
              </div>
              <SectionHead>Fenske — minimum stages</SectionHead>
              <ResultTable rows={[
                ['N_min = ln[(d_LK/b_LK)/(d_HK/b_HK)] / ln(α_LK)',f(r.N_min,2),'stages'],
                ['Hengstebeck-Geddes constant C',f(r.C_HG,4),'—'],
              ]}/>
              <SectionHead>Underwood — full multicomponent R_min</SectionHead>
              <ResultTable rows={[
                ['θ root (Newton-Raphson)',f(r.theta,4),'—'],
                ['Underwood check Σ[α_i·z_i/(α_i−θ)]−(1−q)',f(r.underwood_check,6),'≈ 0 ✓'],
                ['R_min = Σ[α_i·x_D,i/(α_i−θ)] − 1',f(r.Rmin,3),'—'],
                ['R actual = mult × R_min',f(r.R,3),'—'],
              ]}/>
              <SectionHead>Gilliland + Efficiency + Kirkbride</SectionHead>
              <ResultTable rows={[
                ['X = (R−R_min)/(R+1)',f(r.Xg,4),'—'],['Y (Molokanov)',f(r.Yg,4),'—'],
                ['N_theoretical = N_min/(1−Y)',f(r.N_th,1),'stages'],
                ['Tray efficiency E_OC',f(r.E_OC*100,1),'%'],
                ['N_actual = ⌈N_th/E_OC⌉',r.N_act,'trays'],
                ['NR (stages above feed)',r.NR,''],['NS (stages below feed)',r.NS,''],
                ['Feed tray from top',r.feed_tray,''],
              ]}/>
            </div>
          )}

          {r && tab==='fug' && r.mode!=='multicomponent' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="N_min (Fenske)" value={f(r.N_min,1)} unit="stages"/>
                <MetricCard label="R_min (Underwood)" value={f(r.Rmin,3)} unit="—"/>
                <MetricCard label="N_theoretical" value={f(r.N_th,1)} unit="stages" highlight/>
                <MetricCard label="N_actual" value={r.N_act} unit="trays" highlight/>
                <MetricCard label="E_OC efficiency" value={f(r.E_OC*100,1)} unit="%"/>
                <MetricCard label="Feed tray (Kirkbride)" value={r.N_feed} unit="from top"/>
                <MetricCard label="Gilliland X" value={f(r.Xg,4)} unit="—"/>
                <MetricCard label="Gilliland Y" value={f(r.Yg,4)} unit="—"/>
              </div>
              <ResultTable rows={[
                ['N_min = ln[(x_D/(1−x_D))·((1−x_B)/x_B)] / ln(α)',f(r.N_min,2),'stages'],
                ['R_min (bubble-point feed)',f(r.Rmin,3),'—'],
                ['X = (R−R_min)/(R+1)',f(r.Xg,4),'—'],
                ['Y (Abbott approximation)',f(r.Yg,4),'—'],
                ['N_theoretical = N_min/(1−Y)',f(r.N_th,1),'stages'],
                ['E_OC = (51−32.5·log₁₀(μ·α))/100',f(r.E_OC*100,1),'%'],
                ['N_actual = ⌈N_th/E_OC⌉',r.N_act,'trays'],
                ['Feed tray (Kirkbride)',`${r.N_feed} from top`,''],
              ]}/>
            </div>
          )}

          {/* ── Tray Hydraulics tab ── */}
          {r && tab==='tray' && (!hasTray() ? <SectionIncomplete section="Tray hydraulics"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="D_col (standard)" value={f(r.D_std,2)} unit="m" highlight/>
                <MetricCard label="u_flood" value={f(r.u_flood,3)} unit="m/s"/>
                <MetricCard label="H_col" value={f(r.H_col,1)} unit="m"/>
                <MetricCard label="H/D ratio" value={f(r.HD_ratio,1)} unit="—"/>
                <MetricCard label="h_tray total" value={f(r.h_tray,1)} unit="mm liq"/>
                <MetricCard label="ΔP total" value={f(r.dP_col_kPa,2)} unit="kPa"/>
                <MetricCard label="F_LV" value={f(r.F_LV,4)} unit="—"/>
                <MetricCard label="D_calculated" value={f(r.D_calc,3)} unit="m"/>
              </div>
              <ResultTable rows={[
                ['F_LV = (L/V)·√(ρ_V/ρ_L)',f(r.F_LV,4),'—'],
                ['u_flood (Fair correlation)',f(r.u_flood,3),'m/s'],
                ['u_design = flood fraction × u_flood',f(r.u_net,3),'m/s'],
                ['D_calculated',f(r.D_calc,3),'m'],['D_standard',f(r.D_std,2),'m'],
                ['h_dry',f(r.h_dry,1),'mm liq'],['h_ow (Francis weir)',f(r.h_ow,1),'mm liq'],
                ['h_tray = h_dry + h_w + h_ow',f(r.h_tray,1),'mm liq'],
                ['H_col',f(r.H_col,1),'m'],['H/D',f(r.HD_ratio,1),'—'],
                ['Total column ΔP',f(r.dP_col_kPa,2),'kPa'],
              ]}/>
            </div>
          ))}

          {/* ── Packed Column tab ── */}
          {r && tab==='packed' && (!hasTray() ? <SectionIncomplete section="Packed column"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="D_packed (std)" value={f(r.D_pk_std,2)} unit="m" highlight/>
                <MetricCard label="Z_packing" value={f(r.Z_pack,1)} unit="m" highlight/>
                <MetricCard label="HETP" value={f(r.HETP,3)} unit="m"/>
                <MetricCard label="H_OG" value={f(r.HOG,3)} unit="m"/>
              </div>
              <ResultTable rows={[
                ['a_eff (Onda)',f(r.a_eff,1),'m²/m³'],
                ['H_OG = H_V + λ·H_L',f(r.HOG,3),'m'],
                ['HETP = H_OG·ln(λ)/(λ−1)',f(r.HETP,3),'m'],
                ['Z_packing = N_th × HETP',f(r.Z_pack,1),'m'],
                ['D_packed standard',f(r.D_pk_std,2),'m'],
              ]}/>
            </div>
          ))}

          {/* ── Energy Balance tab ── */}
          {r && tab==='energy' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Q_condenser" value={f(r.QC,2)} unit="kW" highlight/>
                <MetricCard label="Q_reboiler" value={f(r.QR,2)} unit="kW" highlight/>
                <MetricCard label="A_condenser" value={f(r.A_cond,1)} unit="m²"/>
                <MetricCard label="A_reboiler" value={f(r.A_reb,1)} unit="m²"/>
                <MetricCard label="Steam rate" value={f(r.mdot_steam_h,1)} unit="kg/h"/>
                <MetricCard label="CW rate" value={f(r.m3_CW_h,2)} unit="m³/h"/>
              </div>
              <ResultTable rows={[
                ['Q_C = D·(R+1)·λ_mix',f(r.QC,2),'kW'],
                ['Q_R (energy balance)',f(r.QR,2),'kW'],
                ['A_condenser',f(r.A_cond,1),'m²'],
                ['h_nb reboiler (Mostinski)',f(r.h_nb,0),'W/(m²·K)'],
                ['A_reboiler',f(r.A_reb,1),'m²'],
                ['Steam (5 bar)',f(r.mdot_steam_h,1),'kg/h'],
                ['Cooling water',f(r.m3_CW_h,2),'m³/h'],
              ]}/>
              {r.rSens && (
                <>
                  <SectionHead>Reflux sensitivity</SectionHead>
                  <ResultTable rows={r.rSens.map(s=>[`R = ${s.R} (${s.mult}×R_min)`,`N = ${s.N} stages,  Q_C = ${s.QC} kW,  Steam ≈ $${s.OPEX}k/yr`,''])}/>
                </>
              )}
            </div>
          )}

          {/* ── Mechanical tab ── */}
          {r && tab==='mech' && (!hasMech() ? <SectionIncomplete section="Mechanical"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="t_shell nominal" value={r.t_sn} unit="mm" highlight/>
                <MetricCard label="t_head 2:1 SE" value={r.t_hn} unit="mm"/>
                <MetricCard label="D_outer" value={f(r.Do,0)} unit="mm"/>
                <MetricCard label="MAWP" value={f(r.MAWP,3)} unit="MPa"/>
                <MetricCard label="W_total" value={f(r.W_total,0)} unit="kg"/>
                <MetricCard label="σ_b (wind)" value={f(r.sigma_b,2)} unit="MPa"/>
                <MetricCard label="σ_w (weight)" value={f(r.sigma_w,2)} unit="MPa"/>
              </div>
              <ResultTable rows={[
                ['P_design',f(r.Pd,3),'MPa'],
                ['t_shell_calc',f(r.t_sc,2),'mm'],['t_shell nominal',r.t_sn,'mm'],
                ['D_outer',f(r.Do,0),'mm'],['MAWP',f(r.MAWP,3),'MPa'],
                ['t_head 2:1 SE nominal',r.t_hn,'mm'],
                ['W_shell / W_trays / W_total',`${f(r.W_shell,0)} / ${f(r.W_trays,0)} / ${f(r.W_total,0)}`,'kg'],
                ['σ_b + σ_w vs S_allow',`${f((r.sigma_b||0)+(r.sigma_w||0),1)} vs ${inp.Sallow||mcGlobal.Sallow} MPa`,''],
              ]}/>
            </div>
          ))}

          {/* ── Economics tab ── */}
          {r && tab==='econ' && (!hasEcon() ? <SectionIncomplete section="Economics"/> : (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="CAPEX (installed)" value={`$${f(r.CAPEX/1000,0)}k`} unit="USD" highlight/>
                <MetricCard label="TAC" value={`$${f(r.TAC/1000,0)}k/yr`} unit="" highlight/>
                <MetricCard label="CBM shell" value={`$${f(r.CBM_shell/1000,0)}k`} unit=""/>
                <MetricCard label="OPEX" value={`$${f(r.OPEX_total/1000,0)}k/yr`} unit=""/>
              </div>
              <ResultTable rows={[
                ['CBM_shell','$'+f(r.CBM_shell,0),'USD'],
                ['CBM_condenser','$'+f(r.CBM_cond,0),'USD'],
                ['CBM_reboiler','$'+f(r.CBM_reb,0),'USD'],
                ['Total CAPEX','$'+f(r.CAPEX,0),'USD'],
                ['OPEX/yr','$'+f(r.OPEX_total,0),'/yr'],
                ['TAC = CAPEX/payback + OPEX','$'+f(r.TAC,0),'/yr'],
              ]}/>
            </div>
          ))}

          {/* ── Design Checks tab ── */}
          {r && tab==='checks' && (
            <div>
              <p className="text-[12px] text-muted mb-4">10 design checks — all must be PASS before finalising.</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {r.checks.map(c=><Check key={c.l} label={c.l} value={c.v} pass={c.pass}/>)}
              </div>
              <ResultTable rows={[
                ['Checks passed',`${r.checks.filter(c=>c.pass).length} / ${r.checks.length}`,''],
                ['N_actual',r.N_act,'trays'],
                ['D_col',f(r.D_std||r.D_calc,2),'m'],
                ['H_col',f(r.H_col,1),'m'],
              ]}/>
            </div>
          )}

        </div>
      </div>
    </SimPage>
  )
}
