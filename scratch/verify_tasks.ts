import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  const { count } = await supabase
    .from('master_video_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('video_date', '2026-04-18');
  
  console.log("Tasks for 2026-04-18 count:", count);
}

verify();
