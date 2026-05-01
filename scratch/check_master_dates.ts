import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMasterTasks() {
  const { data, count } = await supabase
    .from('master_video_tasks')
    .select('video_date', { count: 'exact', head: true })
    .eq('video_date', '2026-04-19');
    
  console.log("Master tasks for 2026-04-19 count:", count);

  // Also see what unique video_dates ARE available
  const { data: dates } = await supabase
    .from('master_video_tasks')
    .select('video_date')
    .order('video_date', { ascending: false });
  
  if (dates) {
    const uniqueDates = [...new Set(dates.map(d => d.video_date))];
    console.log("Available unique video_dates in master_video_tasks:", uniqueDates);
  }
}

checkMasterTasks();
