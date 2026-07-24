import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// If Supabase isn't configured yet, the app still runs in DEMO MODE (no auth).
export const supabase = url && key ? createClient(url, key) : null
export const hasSupabase = Boolean(supabase)
