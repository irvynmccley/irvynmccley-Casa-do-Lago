import { createClient } from '@supabase/supabase-js'

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pbukagdgmzeosugndcat.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_LyW_MBcKUkPcdvdOfwtozg_A-eoHC9C'

// Limpa a URL de espaços em branco
supabaseUrl = supabaseUrl.trim();

// Se o usuário colocou apenas o ID do projeto (ex: pbukagdgmzeosugndcat)
if (supabaseUrl && !supabaseUrl.startsWith('http') && !supabaseUrl.includes('.')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`;
} 
// Se o usuário colocou a URL sem https://
else if (supabaseUrl && !supabaseUrl.startsWith('http')) {
  supabaseUrl = `https://${supabaseUrl}`;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
