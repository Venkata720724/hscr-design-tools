import { supabase } from './supabase'

// Route each simulator to the correct Edge Function
// calc-ab: distillation (binary + multicomponent)
// calc-cd: heat-exchanger, reactor, pressure-vessel
// calc-ef: mixer, storage-tank, piping, separations, meb

const ROUTES = {
  'distillation':    'calc-ab',
  'heat-exchanger':  'calc-cd',
  'reactor':         'calc-cd',
  'pressure-vessel': 'calc-cd',
  'mixer':           'calc-ef',
  'storage-tank':    'calc-ef',
  'piping':          'calc-ef',
  'separations':     'calc-ef',
  'meb':             'calc-ef',
}

export async function calculate(simulatorId, inputs) {
  const fnName = ROUTES[simulatorId]
  if (!fnName) throw new Error(`Unknown simulator: ${simulatorId}`)

  const { data, error } = await supabase.functions.invoke(fnName, {
    body: { simulatorId, inputs }
  })
  if (error) throw new Error(error.message)
  return data
}
