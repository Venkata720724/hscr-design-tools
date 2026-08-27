import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { calculate, DEFAULTS } from './engine'
import SimLayout from '../../components/SimLayout'

function Field({ label, unit, value, onChange, min, max, step = 'any', hint }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-[12px] font-medium text-ink">{label}</label>
        {unit && <span className="text-[11px] text-muted">{unit}</span>}
      </div>
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)} className="input-field" />
      {hint && <p className="text-[10.5px] text-muted mt-1">{hint}</p>}
    </div>
  )
}

function CheckCard({ label, pass, value }) {
  return (
    <div className={`rounded-xl p-3 border ${pass ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11.5px] font-medium text-ink leading-snug">{label}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {pass ? 'PASS' : 'FAIL'}
        </span>
      </div>
      <p className="text-[11px] text-muted mt-1">{value}</p>
    </div>
  )
}

const MACHINE_TYPES = [
  { value: 'centrifugal', label: 'Centrifugal pump',   sub: 'Euler · Affinity laws · NPSH' },
  { value: 'pd',          label: 'PD pump',             sub: 'Gear · Plunger · Screw' },
  { value: 'compressor',  label: 'Compressor',          sub: 'Polytropic · Isentropic · Discharge T' },
]

export default function RotaryPage() {
  const [inp, setInp] = useState(DEFAULTS)
  const set = (k, v) => setInp(p => ({ ...p, [k]: v }))
  const res = useMemo(() => calculate(inp), [inp])

  return (
    <SimLayout chapter="04" name="Rotary Equipment"
      tagline="Centrifugal pumps, PD pumps, and compressors — sizing, NPSH, affinity laws, shaft design."
      activeModels={[
        inp.machineType === 'compressor' ? 'Polytropic compression' : 'Euler head (ψ = 0.45)',
        'NPSH — HI 9.6.1 standard',
        'HI viscosity correction (2010)',
        'Affinity laws · VFD energy saving',
        'Dunkerley critical speed',
      ]}>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 space-y-5">
          <div>
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.2px] mb-3">Machine type</p>
            {MACHINE_TYPES.map(m => (
              <button key={m.value} onClick={() => set('machineType', m.value)}
                className={`w-full text-left p-3 rounded-xl border mb-2 transition-all cursor-pointer
                  ${inp.machineType === m.value ? 'border-brand bg-blue-50' : 'border-line bg-white hover:border-neutral-300'}`}>
                <div className="text-[12.5px] font-medium text-ink">{m.label}</div>
                <div className="text-[11px] text-muted mt-0.5">{m.sub}</div>
              </button>
            ))}
          </div>

          <div>
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.2px] mb-3">Process conditions</p>
            <div className="space-y-3">
              <Field label="Flow rate Q" unit="m³/s" value={inp.Q} onChange={v => set('Q', v)} min={0.001} max={10} step={0.001} />
              <Field label="Static head H" unit="m" value={inp.H} onChange={v => set('H', v)} min={1} max={1000} />
              <Field label="Fluid density ρ" unit="kg/m³" value={inp.rho} onChange={v => set('rho', v)} min={1} max={2000} />
              <Field label="Viscosity μ" unit="Pa·s" value={inp.mu} onChange={v => set('mu', v)} min={0.0001} max={10} step={0.0001} />
              <Field label="Vapour pressure P_v" unit="Pa" value={inp.Pv} onChange={v => set('Pv', v)} min={0} max={100000} />
            </div>
          </div>

          <div>
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.2px] mb-3">Pump parameters</p>
            <div className="space-y-3">
              <Field label="Speed N" unit="rpm" value={inp.N} onChange={v => set('N', v)} min={100} max={5000} />
              <Field label="Pump efficiency η" value={inp.eta_pump} onChange={v => set('eta_pump', v)} min={0.3} max={0.95} step={0.01} />
              <Field label="Motor efficiency η_m" value={inp.eta_motor} onChange={v => set('eta_motor', v)} min={0.7} max={0.98} step={0.01} />
              <Field label="VFD speed ratio N₂/N₁" value={inp.N2_frac} onChange={v => set('N2_frac', v)} min={0.3} max={1} step={0.05} hint="For affinity law calculation" />
            </div>
          </div>

          {inp.machineType === 'compressor' && (
            <div>
              <p className="text-[10.5px] font-semibold text-muted uppercase tracking-[1.2px] mb-3">Compressor</p>
              <div className="space-y-3">
                <Field label="Inlet pressure P₁" unit="kPa" value={inp.P1} onChange={v => set('P1', v)} min={10} />
                <Field label="Outlet pressure P₂" unit="kPa" value={inp.P2} onChange={v => set('P2', v)} min={100} />
                <Field label="Inlet temp T₁" unit="K" value={inp.T1} onChange={v => set('T1', v)} min={200} max={600} />
                <Field label="γ (specific heat ratio)" value={inp.gamma} onChange={v => set('gamma', v)} min={1.1} max={1.7} step={0.01} />
                <Field label="Gas MW" unit="g/mol" value={inp.MW_gas} onChange={v => set('MW_gas', v)} min={2} max={200} />
                <Field label="Polytropic efficiency" value={inp.eta_poly} onChange={v => set('eta_poly', v)} min={0.5} max={0.95} step={0.01} />
              </div>
            </div>
          )}
        </div>

        <div className="col-span-9 space-y-5">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'System head',    value: res.H_system,     unit: 'm'   },
              { label: 'Specific speed', value: res.Ns,           unit: 'SI'  },
              { label: 'Impeller D₂',   value: res.D2,           unit: 'mm'  },
              { label: 'Tip speed u₂',  value: res.u2,           unit: 'm/s' },
              { label: 'P hydraulic',   value: res.P_hyd,        unit: 'kW'  },
              { label: 'P shaft',       value: res.P_shaft,      unit: 'kW'  },
              { label: 'P motor',       value: res.P_motor,      unit: 'kW'  },
              { label: 'IEC motor',     value: res.P_IEC,        unit: 'kW'  },
              { label: 'NPSHA',         value: res.NPSHA,        unit: 'm'   },
              { label: 'NPSHR',         value: res.NPSHR,        unit: 'm'   },
              { label: 'NPSH margin',   value: res.margin,       unit: 'm'   },
              { label: inp.machineType === 'compressor' ? 'Discharge T₂' : 'Shaft d_min',
                value: inp.machineType === 'compressor' ? res.T2a : res.d_min,
                unit:  inp.machineType === 'compressor' ? '°C' : 'mm' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="bg-neutral-50 border border-line rounded-xl p-3">
                <p className="text-[11px] text-muted mb-1">{label}</p>
                <p className="text-[18px] font-bold text-ink tracking-tight">{value}</p>
                <p className="text-[10px] text-muted">{unit}</p>
              </div>
            ))}
          </div>

          {/* H-Q Curve */}
          <div className="border border-line rounded-2xl p-5">
            <p className="text-[12px] font-semibold text-ink mb-4">H-Q curve — pump vs system</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={res.hqCurve} margin={{ top: 5, right: 10, bottom: 15, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="Q" label={{ value: 'Flow (m³/h)', position: 'insideBottom', offset: -10, style: { fontSize: 11, fill: '#888' } }} tick={{ fontSize: 10 }} />
                <YAxis label={{ value: 'Head (m)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#888' } }} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #f0f0f0', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line dataKey="Pump head" stroke="#7c3aed" strokeWidth={2} dot={false} />
                <Line dataKey="System head" stroke="#dc2626" strokeWidth={2} dot={false} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* VFD summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Flow at N₂',    value: res.Q2,          unit: 'm³/h' },
              { label: 'Head at N₂',    value: res.H2,          unit: 'm'    },
              { label: 'Power saving',  value: res.power_saving, unit: 'kW'  },
            ].map(({ label, value, unit }) => (
              <div key={label} className="border border-green-100 bg-green-50 rounded-xl p-3">
                <p className="text-[11px] text-muted mb-1">{label}</p>
                <p className="text-[18px] font-bold text-ink tracking-tight">{value}</p>
                <p className="text-[10px] text-muted">{unit}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[12px] font-semibold text-ink mb-3">Design checks</p>
            <div className="grid grid-cols-2 gap-2">
              {res.checks.map(c => <CheckCard key={c.label} {...c} />)}
            </div>
          </div>
        </div>
      </div>
    </SimLayout>
  )
}
