import { useState, useEffect, useRef } from 'react'
import SimPage, { TabBar, MetricCard, ResultTable, SectionHead, Check,
  Field, SelectField, InputSection, ModelGuide, CalcSpinner, EmptyState, CalcButton } from '../../components/SimPage'
import { calculate } from '../../lib/calculate'

const TABS = [
  {id:'sample',  label:'Sample Calculation'},
  {id:'vle',     label:'VLE Thermo'},
  {id:'mat',     label:'Material Balance'},
  {id:'fug',     label:'FUG Shortcut'},
  {id:'tray',    label:'Tray Hydraulics'},
  {id:'packed',  label:'Packed Column'},
  {id:'energy',  label:'Energy Balance'},
  {id:'mech',    label:'Mechanical'},
  {id:'econ',    label:'Economics'},
  {id:'checks',  label:'Design Checks'},
]

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

function MCTChart({ r, xD, xB, zF }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current; if(!cv||!r) return
    const ctx = cv.getContext('2d')
    const W = cv.clientWidth||600, H = 360
    cv.width=W; cv.height=H
    const pad={l:44,r:16,t:16,b:44}
    const pw=W-pad.l-pad.r, ph=H-pad.t-pad.b
    const px=x=>pad.l+x*pw, py=y=>pad.t+(1-y)*ph
    ctx.clearRect(0,0,W,H)
    ctx.strokeStyle='#f0f0f0'; ctx.lineWidth=0.5
    for(let i=0;i<=10;i++){const v=i/10;ctx.beginPath();ctx.moveTo(px(v),py(0));ctx.lineTo(px(v),py(1));ctx.stroke();ctx.beginPath();ctx.moveTo(px(0),py(v));ctx.lineTo(px(1),py(v));ctx.stroke()}
    ctx.strokeStyle='#bbb'; ctx.lineWidth=1.5
    ctx.beginPath();ctx.moveTo(px(0),py(0));ctx.lineTo(px(1),py(0));ctx.stroke()
    ctx.beginPath();ctx.moveTo(px(0),py(0));ctx.lineTo(px(0),py(1));ctx.stroke()
    ctx.fillStyle='#999';ctx.font='11px system-ui';ctx.textAlign='center'
    for(let i=0;i<=10;i++){const v=i/10;ctx.fillText(v.toFixed(1),px(v),py(0)+18);ctx.textAlign='right';ctx.fillText(v.toFixed(1),px(0)-5,py(v)+4);ctx.textAlign='center'}
    ctx.fillText('x (liquid mole fraction)',px(0.5),py(0)+34)
    ctx.save();ctx.translate(px(0)-34,py(0.5));ctx.rotate(-Math.PI/2);ctx.fillText('y (vapour mole fraction)',0,0);ctx.restore()
    const poly=(pts,c,lw,dash)=>{if(!pts||pts.length<2)return;ctx.save();ctx.strokeStyle=c;ctx.lineWidth=lw||2;ctx.setLineDash(dash||[]);ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.stroke();ctx.restore()}
    const vleY=(x,a)=>a*x/(1+(a-1)*x)
    const a=r.alpha_avg, xDn=+xD, xBn=+xB, zFn=+zF
    poly([[0,0],[1,1]],'#ddd',1,[4,4])
    poly(Array.from({length:101},(_,i)=>{const x=i/100;return[x,vleY(x,a)]}),'#2563eb',2.5)
    poly([[xDn,xDn],[r.xq,r.yq]],'#16a34a',2)
    poly([[xBn,xBn],[r.xq,r.yq]],'#f97316',2)
    poly([[zFn,0],[zFn,vleY(zFn,a)]],'#dc2626',1.5,[4,3])
    ctx.strokeStyle='#7c3aed';ctx.lineWidth=1.8;ctx.setLineDash([])
    let yc=xDn,xp=xDn
    for(let s=0;s<80&&yc>xBn+0.003;s++){
      const xe=yc/(a-(a-1)*yc)
      ctx.beginPath();ctx.moveTo(px(xp),py(yc));ctx.lineTo(px(xe),py(yc));ctx.stroke()
      if(xe<=xBn)break
      const yo=xe>=r.xq?r.slope_rect*xe+r.int_rect:r.slope_strip*xe+r.int_strip
      ctx.beginPath();ctx.moveTo(px(xe),py(yc));ctx.lineTo(px(xe),py(Math.max(yo,0)));ctx.stroke()
      yc=Math.max(yo,0);xp=xe;if(yc<=xBn+0.001)break
    }
    const leg=[['Equilibrium','#2563eb'],['Rectifying OL','#16a34a'],['Stripping OL','#f97316'],['q-line','#dc2626'],['Stages','#7c3aed']]
    ctx.font='11px system-ui';ctx.textAlign='left'
    leg.forEach(([lb,c],i)=>{const lx=pad.l+4+(i>2?(i-3)*150:i*150),ly=pad.t+(i>2?20:4);ctx.fillStyle=c;ctx.fillRect(lx,ly+4,16,3);ctx.fillStyle='#555';ctx.fillText(lb,lx+20,ly+9)})
  },[r,xD,xB,zF])
  return <canvas ref={ref} style={{width:'100%',height:360,display:'block'}}/>
}

export default function DistillationPage() {
  const [inp, setInp] = useState(EMPTY)
  const [tab, setTab] = useState('sample')
  const [r, setR] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const set = (k,v) => setInp(p=>({...p,[k]:v}))
  const f = (v,d=2) => v==null?'—':(+v).toFixed(d)

  const allFilled = () => ['F','zF','xD','xB','ALK','BLK','CLK','AHK','BHK','CHK','R','rhoL','rhoV','muL','sigma','lamLK','lamHK','mwLK','mwHK'].every(k=>inp[k]!=='')

  const runCalc = async () => {
    if(!allFilled()){setErr('Please fill all required fields (*)');return}
    setLoading(true);setErr('')
    try {
      const nums = Object.fromEntries(Object.entries(inp).map(([k,v])=>[k,v===''?0:+v]))
      const res = await calculate('distillation', nums)
      if(res.error){setErr(res.error)}else{setR(res);setTab('vle')}
    } catch(e){setErr('Calculation failed: '+e.message)}
    finally{setLoading(false)}
  }

  const loadSample = () => { setInp(SAMPLE); setR(null); setTab('sample') }

  return (
    <SimPage name="Distillation Column"
      tagline="Binary column design — VLE, McCabe-Thiele, FUG shortcut, tray & packed hydraulics, energy balance, ASME mechanical, Turton economics."
      models={['Antoine VLE','McCabe-Thiele','Fenske-Underwood-Gilliland','Fair flooding','Onda mass transfer','Mostinski boiling','ASME UG-27','Turton cost']}>
      <div className="flex gap-6">
        {/* INPUTS */}
        <div className="w-52 flex-shrink-0 text-[12px] overflow-y-auto" style={{maxHeight:'85vh'}}>
          <InputSection>Feed conditions</InputSection>
          <Field label="Feed flow F" unit="mol/h" value={inp.F} onChange={v=>set('F',v)} min={1}/>
          <Field label="z_F light key" unit="mol/mol" value={inp.zF} onChange={v=>set('zF',v)} min={0.01} max={0.99} step={0.01}/>
          <Field label="Feed temperature" unit="°C" value={inp.Tf} onChange={v=>set('Tf',v)}/>
          <Field label="Column pressure" unit="kPa" value={inp.Pcol} onChange={v=>set('Pcol',v)} min={10}/>
          <InputSection>Product specifications</InputSection>
          <Field label="x_D distillate" unit="mol/mol" value={inp.xD} onChange={v=>set('xD',v)} min={0.51} max={0.999} step={0.005}/>
          <Field label="x_B bottoms" unit="mol/mol" value={inp.xB} onChange={v=>set('xB',v)} min={0.001} max={0.49} step={0.005}/>
          <InputSection>Antoine constants — light key</InputSection>
          <Field label="A" value={inp.ALK} onChange={v=>set('ALK',v)} step={0.001} hint="log₁₀(P/mmHg) = A−B/(C+T°C)"/>
          <Field label="B" value={inp.BLK} onChange={v=>set('BLK',v)} step={0.001}/>
          <Field label="C" value={inp.CLK} onChange={v=>set('CLK',v)} step={0.001}/>
          <InputSection>Antoine constants — heavy key</InputSection>
          <Field label="A" value={inp.AHK} onChange={v=>set('AHK',v)} step={0.001}/>
          <Field label="B" value={inp.BHK} onChange={v=>set('BHK',v)} step={0.001}/>
          <Field label="C" value={inp.CHK} onChange={v=>set('CHK',v)} step={0.001}/>
          <InputSection>Reflux and column type</InputSection>
          <Field label="Reflux ratio R" value={inp.R} onChange={v=>set('R',v)} min={0.5} max={30} step={0.1}/>
          <ModelGuide title="Column internals" criteria={[
            {model:'Sieve tray',when:'Throughput > 5 m³/h, fouling fluids, or when turndown > 3:1 is needed.'},
            {model:'Packed column',when:'Pressure drop must be minimised (vacuum or low P), or column diameter < 0.6 m, or corrosive service.'},
          ]}/>
          <SelectField label="Column type" value={inp.colType} onChange={v=>set('colType',v)}
            options={[{value:'tray',label:'Sieve tray'},{value:'packed',label:'Packed column'}]}/>
          <Field label="Tray spacing" unit="m" value={inp.traySpacing} onChange={v=>set('traySpacing',v)} min={0.3} max={0.9} step={0.05}/>
          <Field label="Weir height" unit="mm" value={inp.weirH} onChange={v=>set('weirH',v)} min={20} max={100}/>
          <Field label="Flood fraction" value={inp.floodFrac} onChange={v=>set('floodFrac',v)} min={0.6} max={0.85} step={0.05}/>
          <InputSection>Physical properties</InputSection>
          <Field label="ρ_L liquid density" unit="kg/m³" value={inp.rhoL} onChange={v=>set('rhoL',v)} min={400}/>
          <Field label="ρ_V vapour density" unit="kg/m³" value={inp.rhoV} onChange={v=>set('rhoV',v)} min={0.1} step={0.01}/>
          <Field label="μ_L liquid viscosity" unit="mPa·s" value={inp.muL} onChange={v=>set('muL',v)} min={0.05} step={0.01}/>
          <Field label="σ surface tension" unit="mN/m" value={inp.sigma} onChange={v=>set('sigma',v)} min={1}/>
          <Field label="λ_LK latent heat" unit="J/mol" value={inp.lamLK} onChange={v=>set('lamLK',v)} min={1000}/>
          <Field label="λ_HK latent heat" unit="J/mol" value={inp.lamHK} onChange={v=>set('lamHK',v)} min={1000}/>
          <Field label="MW_LK" unit="g/mol" value={inp.mwLK} onChange={v=>set('mwLK',v)} min={1}/>
          <Field label="MW_HK" unit="g/mol" value={inp.mwHK} onChange={v=>set('mwHK',v)} min={1}/>
          <Field label="Cp_L (LK)" unit="J/mol·K" value={inp.CpL_LK} onChange={v=>set('CpL_LK',v)} min={1}/>
          <Field label="Cp_L (HK)" unit="J/mol·K" value={inp.CpL_HK} onChange={v=>set('CpL_HK',v)} min={1}/>
          <Field label="P_c critical" unit="kPa" value={inp.Pc_kPa} onChange={v=>set('Pc_kPa',v)} min={100}/>
          <InputSection>Mechanical (ASME)</InputSection>
          <Field label="S_allow" unit="MPa" value={inp.Sallow} onChange={v=>set('Sallow',v)} min={50}/>
          <Field label="Corrosion allowance" unit="mm" value={inp.CA} onChange={v=>set('CA',v)} min={0} max={10}/>
          <Field label="Joint efficiency E" value={inp.Ejt} onChange={v=>set('Ejt',v)} min={0.7} max={1} step={0.05}/>
          <Field label="Wind speed" unit="m/s" value={inp.windSpeed} onChange={v=>set('windSpeed',v)} min={10}/>
          <InputSection>Economics</InputSection>
          <Field label="CEPCI current" value={inp.CEPCI} onChange={v=>set('CEPCI',v)} min={300}/>
          <Field label="CEPCI base (2001)" value={inp.CEPCIbase} onChange={v=>set('CEPCIbase',v)}/>
          <Field label="FBM factor" value={inp.FBM} onChange={v=>set('FBM',v)} min={1} step={0.01}/>
          <Field label="Steam cost" unit="$/kg" value={inp.steamCost} onChange={v=>set('steamCost',v)} step={0.005}/>
          <Field label="CW cost" unit="$/m³" value={inp.CWcost} onChange={v=>set('CWcost',v)} step={0.0001}/>
          <Field label="Operating hours" unit="h/yr" value={inp.opHours} onChange={v=>set('opHours',v)} min={1000}/>
          <Field label="Payback period" unit="yr" value={inp.payback} onChange={v=>set('payback',v)} min={1}/>

          {err && <p className="text-[11px] text-red-500 mt-2 leading-snug">{err}</p>}
          <CalcButton onClick={runCalc} loading={loading}/>
        </div>

        {/* RESULTS */}
        <div className="flex-1 min-w-0">
          <TabBar tabs={TABS} active={tab} onChange={setTab}/>

          {tab==='sample' && (
            <div className="max-w-2xl">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
                <p className="text-[13px] font-semibold text-blue-900 mb-1">Sample calculation — Benzene / Toluene separation</p>
                <p className="text-[12px] text-blue-700 mb-3">Binary system at atmospheric pressure. Feed is equimolar at bubble point. Distillate 95 mol% benzene, bottoms 5 mol% benzene.</p>
                <button onClick={async()=>{setInp(SAMPLE);setLoading(true);setErr('');try{const res=await calculate('distillation',SAMPLE);if(res.error){setErr(res.error)}else{setR(res);setTab('vle')}}catch(e){setErr(e.message)}finally{setLoading(false)}}}
                  className="text-[12px] font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  Load and run sample →
                </button>
              </div>
              <SectionHead>Sample inputs</SectionHead>
              <ResultTable rows={[
                ['Feed flow F','100','mol/h'],['Feed composition z_F','0.50','mol/mol benzene'],
                ['Feed temperature','80','°C'],['Column pressure','101.325','kPa (atmospheric)'],
                ['Distillate spec x_D','0.95','mol/mol benzene'],['Bottoms spec x_B','0.05','mol/mol benzene'],
                ['Reflux ratio R','2.5','— (≈ 1.6 × R_min)'],
                ['Antoine A (benzene)','6.90565','—'],['Antoine B (benzene)','1211.033','—'],['Antoine C (benzene)','220.79','—'],
                ['Antoine A (toluene)','6.95087','—'],['Antoine B (toluene)','1342.31','—'],['Antoine C (toluene)','219.187','—'],
                ['ρ_L','870','kg/m³'],['ρ_V','3.19','kg/m³'],['μ_L','0.42','mPa·s'],['σ','21','mN/m'],
                ['λ_benzene','30720','J/mol'],['λ_toluene','33180','J/mol'],
                ['MW benzene','78.11','g/mol'],['MW toluene','92.14','g/mol'],
              ]}/>
              <SectionHead>Expected key results</SectionHead>
              <ResultTable rows={[
                ['α_avg relative volatility','≈ 2.45','—'],['N_min (Fenske)','≈ 7.0','stages'],
                ['R_min (Underwood)','≈ 1.53','—'],['N_theoretical','≈ 11.5','stages'],
                ['N_actual trays (O\'Connell ~65%)','≈ 18','trays'],
                ['Column diameter D_std','0.45 – 0.60','m'],['Q_condenser','≈ 95','kW'],
                ['Q_reboiler','≈ 98','kW'],['CAPEX (installed)','≈ $180k','USD'],
              ]}/>
              <p className="text-[11px] text-muted mt-4">Fill your own values in the left panel and click Calculate to run your design.</p>
            </div>
          )}

          {tab!=='sample' && !r && !loading && <EmptyState onSample={loadSample}/>}
          {loading && <CalcSpinner/>}

          {r && tab==='vle' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="T_bubble" value={f(r.T_bub,1)} unit="°C"/>
                <MetricCard label="α_top" value={f(r.alpha_top,3)} unit="—"/>
                <MetricCard label="α_bottom" value={f(r.alpha_bot,3)} unit="—"/>
                <MetricCard label="α_avg (geom.)" value={f(r.alpha_avg,3)} unit="—" highlight/>
                <MetricCard label="T_dew (est.)" value={f(r.T_dew,1)} unit="°C"/>
                <MetricCard label="α variation" value={f(r.alpha_var,1)} unit="%"/>
                <MetricCard label="λ_mix distillate" value={f(r.lam_mixD,0)} unit="J/mol"/>
                <MetricCard label="MW_avg" value={f(r.MW_avg,2)} unit="g/mol"/>
              </div>
              <div className="border border-line rounded-xl p-4 mb-4">
                <p className="text-[12px] font-semibold text-ink mb-3">McCabe-Thiele — equilibrium curve, two operating lines, q-line, stages</p>
                <MCTChart r={r} xD={inp.xD} xB={inp.xB} zF={inp.zF}/>
              </div>
              <SectionHead>VLE detail</SectionHead>
              <ResultTable rows={[
                ['Model','Antoine: log₁₀(P*) = A − B/(C+T)  [Raoult\'s law]',''],
                ['T_bubble',f(r.T_bub,1),'°C'],['T_dew (approx)',f(r.T_dew,1),'°C'],
                ['T_top (distillate)',f(r.T_top,1),'°C'],['T_bottom (reboiler)',f(r.T_bot,1),'°C'],
                ['α_top',f(r.alpha_top,3),'—'],['α_bottom',f(r.alpha_bot,3),'—'],
                ['α_avg = √(α_top × α_bot)',f(r.alpha_avg,3),'—'],
                ['α variation',`${f(r.alpha_var,1)}% ${r.alpha_var>15?'⚠ >15% — use rigorous':'✓ OK'}`,''],
              ]}/>
            </div>
          )}

          {r && tab==='mat' && (
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
              <SectionHead>Overall mass balance</SectionHead>
              <ResultTable rows={[
                ['D = F·(z_F−x_B)/(x_D−x_B)',f(r.D,2),'mol/h'],
                ['B = F − D',f(r.B,2),'mol/h'],
                ['LK recovery',f(r.LK_rec,1),'%'],['HK recovery',f(r.HK_rec,1),'%'],
                ['Rectifying slope R/(R+1)',f(r.slope_rect,4),'—'],
                ['Rectifying intercept x_D/(R+1)',f(r.int_rect,4),'—'],
                ['Stripping slope L′/V′',f(r.slope_strip,4),'—'],
                ['q-line intersection (x_q, y_q)',`(${r.xq}, ${f(r.yq,3)})`,''],
              ]}/>
            </div>
          )}

          {r && tab==='fug' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="N_min (Fenske)" value={f(r.N_min,1)} unit="stages"/>
                <MetricCard label="R_min (Underwood)" value={f(r.Rmin,3)} unit="—"/>
                <MetricCard label="N_theoretical" value={f(r.N_th,1)} unit="stages" highlight/>
                <MetricCard label="N_actual" value={r.N_act} unit="trays" highlight/>
                <MetricCard label="E_OC (O′Connell)" value={f(r.E_OC*100,1)} unit="%"/>
                <MetricCard label="Feed tray (Kirkbride)" value={r.N_feed} unit="from top"/>
                <MetricCard label="Gilliland X" value={f(r.Xg,4)} unit="—"/>
                <MetricCard label="Gilliland Y" value={f(r.Yg,4)} unit="—"/>
              </div>
              <SectionHead>Fenske — Underwood — Gilliland</SectionHead>
              <ResultTable rows={[
                ['N_min = ln[(x_D/(1−x_D))·((1−x_B)/x_B)] / ln(α)',f(r.N_min,2),'stages'],
                ['R_min (bubble-point feed)',f(r.Rmin,3),'—'],
                ['X_Gilliland = (R − R_min)/(R + 1)',f(r.Xg,4),'—'],
                ['Y_Gilliland (Abbott)',f(r.Yg,4),'—'],
                ['N_theoretical = N_min/(1−Y)',f(r.N_th,1),'stages'],
                ['E_OC = (51 − 32.5·log₁₀(μ_L·α))/100',f(r.E_OC*100,1),'%'],
                ['N_actual = ⌈N_th / E_OC⌉',r.N_act,'trays'],
                ['Feed tray (Kirkbride)',`${r.N_feed} from top`,''],
              ]}/>
            </div>
          )}

          {r && tab==='tray' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="D_col (standard)" value={f(r.D_std,2)} unit="m" highlight/>
                <MetricCard label="u_flood" value={f(r.u_flood,3)} unit="m/s"/>
                <MetricCard label="u_design" value={f(r.u_net,3)} unit="m/s"/>
                <MetricCard label="h_tray" value={f(r.h_tray,1)} unit="mm liq"/>
                <MetricCard label="H_col" value={f(r.H_col,1)} unit="m"/>
                <MetricCard label="H/D ratio" value={f(r.HD_ratio,1)} unit="—"/>
                <MetricCard label="ΔP total" value={f(r.dP_col_kPa,2)} unit="kPa"/>
                <MetricCard label="F_LV" value={f(r.F_LV,4)} unit="—"/>
              </div>
              <SectionHead>Fair flooding correlation</SectionHead>
              <ResultTable rows={[
                ['F_LV = (L/V)·√(ρ_V/ρ_L)',f(r.F_LV,4),'—'],
                ['u_flood = C_sb·(σ/20)^0.2·√((ρ_L−ρ_V)/ρ_V)',f(r.u_flood,3),'m/s'],
                ['u_design = flood fraction × u_flood',f(r.u_net,3),'m/s'],
                ['D_calculated',f(r.D_calc,3),'m'],['D_standard',f(r.D_std,2),'m'],
                ['h_dry',f(r.h_dry,1),'mm liq'],['h_ow (Francis weir)',f(r.h_ow,1),'mm liq'],
                ['h_tray = h_dry + h_w + h_ow',f(r.h_tray,1),'mm liq'],
                ['H_col',f(r.H_col,1),'m'],['H/D',f(r.HD_ratio,1),'—'],
              ]}/>
            </div>
          )}

          {r && tab==='packed' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="D_packed (std)" value={f(r.D_pk_std,2)} unit="m" highlight/>
                <MetricCard label="Z_packing" value={f(r.Z_pack,1)} unit="m" highlight/>
                <MetricCard label="HETP (Onda)" value={f(r.HETP,3)} unit="m"/>
                <MetricCard label="H_OG" value={f(r.HOG,3)} unit="m"/>
                <MetricCard label="a_eff" value={f(r.a_eff,1)} unit="m²/m³"/>
                <MetricCard label="λ_strip (stripping factor)" value={f(r.lam_strip,3)} unit="—"/>
              </div>
              <ResultTable rows={[
                ['a_eff (Onda 1968)',f(r.a_eff,1),'m²/m³'],
                ['H_OG = H_V + λ·H_L',f(r.HOG,3),'m'],
                ['HETP = H_OG·ln(λ)/(λ−1)',f(r.HETP,3),'m'],
                ['Z_packing = N_th × HETP',f(r.Z_pack,1),'m'],
                ['D_packed standard',f(r.D_pk_std,2),'m'],
              ]}/>
            </div>
          )}

          {r && tab==='energy' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="Q_condenser" value={f(r.QC,2)} unit="kW" highlight/>
                <MetricCard label="Q_reboiler" value={f(r.QR,2)} unit="kW" highlight/>
                <MetricCard label="A_condenser" value={f(r.A_cond,1)} unit="m²"/>
                <MetricCard label="A_reboiler" value={f(r.A_reb,1)} unit="m²"/>
                <MetricCard label="Steam rate" value={f(r.mdot_steam_h,1)} unit="kg/h"/>
                <MetricCard label="CW rate" value={f(r.m3_CW_h,2)} unit="m³/h"/>
                <MetricCard label="LMTD condenser" value={f(r.LMTD_c,1)} unit="°C"/>
                <MetricCard label="h_nb (Mostinski)" value={f(r.h_nb,0)} unit="W/(m²·K)"/>
              </div>
              <SectionHead>Condenser and reboiler</SectionHead>
              <ResultTable rows={[
                ['Q_C = D·(R+1)·λ_mix',f(r.QC,2),'kW'],
                ['Q_R (full energy balance)',f(r.QR,2),'kW'],
                ['LMTD condenser',f(r.LMTD_c,1),'°C'],
                ['A_condenser (+20% fouling)',f(r.A_cond,1),'m²'],
                ['h_nb (Mostinski)',f(r.h_nb,0),'W/(m²·K)'],
                ['A_reboiler',f(r.A_reb,1),'m²'],
                ['Steam (5 bar, '+f(r.T_steam,0)+'°C)',f(r.mdot_steam_h,1),'kg/h'],
                ['CW flow',f(r.m3_CW_h,2),'m³/h'],
              ]}/>
              <SectionHead>R sensitivity (N and Q_C)</SectionHead>
              <ResultTable rows={r.rSens.map(s=>[`R = ${s.R}  (${s.mult}×R_min)`,`N = ${s.N},  Q_C = ${s.QC} kW,  Steam ≈ $${s.OPEX}k/yr`,''])}/>
            </div>
          )}

          {r && tab==='mech' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="t_shell" value={r.t_sn} unit="mm" highlight/>
                <MetricCard label="t_head 2:1 SE" value={r.t_hn} unit="mm"/>
                <MetricCard label="D_outer" value={f(r.Do,0)} unit="mm"/>
                <MetricCard label="MAWP" value={f(r.MAWP,3)} unit="MPa"/>
                <MetricCard label="W_total" value={f(r.W_total,0)} unit="kg"/>
                <MetricCard label="σ_b (wind)" value={f(r.sigma_b,2)} unit="MPa"/>
                <MetricCard label="σ_w (weight)" value={f(r.sigma_w,2)} unit="MPa"/>
                <MetricCard label="Wind moment" value={f(r.M_wind,1)} unit="kN·m"/>
              </div>
              <SectionHead>ASME UG-27 shell and heads</SectionHead>
              <ResultTable rows={[
                ['P_design',f(r.Pd,3),'MPa'],
                ['t_shell_calc = P·R/(S·E−0.6P) + CA',f(r.t_sc,2),'mm'],
                ['t_shell nominal',r.t_sn,'mm'],['D_outer',f(r.Do,0),'mm'],
                ['MAWP',f(r.MAWP,3),'MPa'],['t_head 2:1 SE nominal',r.t_hn,'mm'],
                ['W_shell',f(r.W_shell,0),'kg'],['W_trays',f(r.W_trays,0),'kg'],['W_total',f(r.W_total,0),'kg'],
                ['σ_b + σ_w',f(r.sigma_b+r.sigma_w,1),'MPa'],
              ]}/>
            </div>
          )}

          {r && tab==='econ' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <MetricCard label="CAPEX" value={`$${f(r.CAPEX/1000,0)}k`} unit="installed" highlight/>
                <MetricCard label="TAC" value={`$${f(r.TAC/1000,0)}k/yr`} unit="" highlight/>
                <MetricCard label="CBM shell" value={`$${f(r.CBM_shell/1000,0)}k`} unit=""/>
                <MetricCard label="CBM condenser" value={`$${f(r.CBM_cond/1000,0)}k`} unit=""/>
                <MetricCard label="CBM reboiler" value={`$${f(r.CBM_reb/1000,0)}k`} unit=""/>
                <MetricCard label="Steam OPEX" value={`$${f(r.OPEX_total/1000,0)}k/yr`} unit=""/>
              </div>
              <SectionHead>Turton equipment costs</SectionHead>
              <ResultTable rows={[
                ['Shell area A_sh',f(r.A_shell_m2,1),'m²'],
                ['CBM_shell (FBM='+inp.FBM+')','$'+f(r.CBM_shell,0),'USD'],
                ['CBM_condenser','$'+f(r.CBM_cond,0),'USD'],
                ['CBM_reboiler','$'+f(r.CBM_reb,0),'USD'],
                ['Total CAPEX','$'+f(r.CAPEX,0),'USD'],
                ['Total OPEX/yr','$'+f(r.OPEX_total,0),'/yr'],
                ['TAC = CAPEX/payback + OPEX','$'+f(r.TAC,0),'/yr'],
              ]}/>
            </div>
          )}

          {r && tab==='checks' && (
            <div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {r.checks.map(c=><Check key={c.l} label={c.l} value={c.v} pass={c.pass}/>)}
              </div>
              <ResultTable rows={[
                ['Checks passed',`${r.checks.filter(c=>c.pass).length} / ${r.checks.length}`,''],
                ['N_actual',r.N_act,'trays'],['D_std',f(r.D_std,2),'m'],
                ['H_col',f(r.H_col,1),'m'],['CAPEX','$'+f(r.CAPEX,0),'USD'],
              ]}/>
            </div>
          )}
        </div>
      </div>
    </SimPage>
  )
}
