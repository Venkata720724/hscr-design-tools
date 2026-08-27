// Central calculation dispatcher
// All engines run server-side via Supabase Edge Functions
// Browser never sees the mathematics

import { supabase } from './supabase'

export async function calculate(simulatorId, inputs) {
  const { data, error } = await supabase.functions.invoke('calculate', {
    body: { simulatorId, inputs }
  })
  if (error) throw new Error(error.message)
  return data
}
