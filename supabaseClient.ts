import { createClient } from '@supabase/supabase-js'

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pbukagdgmzeosugndcat.supabase.co'
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_LyW_MBcKUkPcdvdOfwtozg_A-eoHC9C'

// Limpa a URL de espaços em branco e aspas (comum ao copiar/colar no Vercel)
supabaseUrl = String(supabaseUrl).replace(/['"]/g, '').trim();
supabaseAnonKey = String(supabaseAnonKey).replace(/['"]/g, '').trim();

// Se o usuário colocou apenas o ID do projeto (ex: pbukagdgmzeosugndcat)
if (supabaseUrl && !supabaseUrl.startsWith('http') && !supabaseUrl.includes('.')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`;
} 
// Se o usuário colocou a URL sem https://
else if (supabaseUrl && !supabaseUrl.startsWith('http')) {
  supabaseUrl = `https://${supabaseUrl}`;
}

// Validação final de segurança para evitar tela branca (crash no top-level)
try {
  new URL(supabaseUrl);
} catch (e) {
  console.error("URL do Supabase inválida configurada no Vercel:", supabaseUrl);
  // Fallback seguro para não quebrar a tela
  supabaseUrl = 'https://pbukagdgmzeosugndcat.supabase.co';
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
