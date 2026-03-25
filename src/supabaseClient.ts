import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pbukagdgmzeosugndcat.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_LyW_MBcKUkPcdvdOfwtozg_A-eoHC9C'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
