import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDay16() {
  const { data: masterTasks } = await supabase
    .from('master_video_tasks')
    .select('*')
    .eq('video_date', '2026-03-23')
    .eq('day', 16);

  console.log("Master Day 16 tasks:", masterTasks);
}

checkDay16();
