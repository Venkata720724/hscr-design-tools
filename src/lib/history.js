import { supabase } from './supabase'

export async function saveRun(simulatorId, simulatorName, inputs, results) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Build a meaningful label from key results
    const labels = {
      distillation: `D=${results.D} mol/h, N=${results.N_act} trays, D_col=${results.D_std}m`,
      'heat-exchanger': `Q=${(results.Q/1000).toFixed(1)}kW, A=${results.A_prov}m², OD=${results.OD}%`,
      reactor: `V_CSTR=${results.V_cstr}m³, X=${inputs.X}, T=${inputs.T_op}°C`,
      'pressure-vessel': `D=${inputs.Di}m, P=${inputs.P_op}kPa, t=${results.t_shell}mm`,
      mixer: `P=${results.P_total}W, Re=${results.Re}`,
      'storage-tank': `V=${results.V_net}m³, t_bot=${results.t_bot}mm`,
      piping: `D=${results.D_opt}m, ΔP=${results.dP_total}kPa`,
      separations: `N=${results.N_stages}, method=${inputs.method}`,
      meb: `Q=${results.Q_total}kW`,
    }

    await supabase.from('runs').insert({
      user_id: user.id,
      simulator_id: simulatorId,
      label: `${simulatorName} — ${labels[simulatorId] || 'run'}`,
      payload: {
        inputs: inputs,
        key_results: results,
        timestamp: new Date().toISOString(),
      }
    })
  } catch (e) {
    // Silent fail — do not interrupt user if save fails
    console.warn('History save failed:', e.message)
  }
}
