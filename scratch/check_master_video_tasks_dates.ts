import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function list() {
  const { data, error } = await supabase
    .from('master_video_tasks')
    .select('video_date, nhom')
    .ilike('nhom', '%20.5%');

  if (error) {
    console.error("Error fetching master_video_tasks:", error);
    return;
  }

  const unique = new Set(data.map(d => `${d.video_date} | ${d.nhom}`));
  console.log("Master Video Tasks for 20.5:");
  unique.forEach(u => console.log(u));
  
  // also check exactly what dates exist around May 19-21
  const { data: d2 } = await supabase.from('master_video_tasks').select('video_date, nhom').gte('video_date', '2026-05-18').lte('video_date', '2026-05-22');
  const u2 = new Set((d2 || []).map(d => `${d.video_date} | ${d.nhom}`));
  console.log("Master Video Tasks around May 20:");
  u2.forEach(u => console.log(u));
}

list();
