import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function list() {
  const { data, error } = await supabase.from('master_video_tasks').select('video_date, nhom');

  if (error) {
    console.error("Error fetching master_video_tasks:", error);
    return;
  }

  const unique = new Set(data.map(d => `${d.video_date} | ${d.nhom}`));
  unique.forEach(u => console.log(u));
}

list();
