import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function list() {
  const { data, error } = await supabase
    .from('master_video_tasks')
    .select('*')
    .limit(10);

  if (error) {
    console.error("Error fetching master_video_tasks:", error);
    return;
  }

  console.log("Master Video Tasks:");
  for (const t of data) {
    console.log(`- ID: ${t.id} | Video Date: ${t.video_date} | Nhom: ${t.nhom} | Day: ${t.day}`);
  }
}

list();
