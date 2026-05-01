import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBaoMat1() {
  const { data } = await supabase
    .from('master_video_tasks')
    .select('nhom')
    .eq('video_date', '2026-04-19')
    .limit(1);
    
  console.log("Group name for 2026-04-19:", data?.[0]?.nhom);
}

checkBaoMat1();
