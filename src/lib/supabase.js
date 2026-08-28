import { createClient } from '@supabase/supabase-js'

// ── Replace these two values after Supabase setup (instructions at end) ────
const SUPABASE_URL  = 'https://suhwnaclzvcaycrrfids.supabase.co'
const SUPABASE_ANON = 'sb_publishable_bzZnXyi2KzfsyzXC5h6WRw_jrJin6d_'
// ──────────────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
