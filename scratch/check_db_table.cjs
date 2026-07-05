const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('master_video_tasks').select('*').eq('video_date', '2026-05-16').eq('day', 26);
  console.log("Table records:", data);
}
run();
