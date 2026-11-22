import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined) || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : undefined) as string | undefined;
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined) || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : undefined) as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}
if (import.meta.env.VITE_MP_ENVIRONMENT === 'staging' && new URL(supabaseUrl).hostname === 'yovjwbswfeblfswdxown.supabase.co') {
  throw new Error('Staging cannot use the Production Supabase project.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
