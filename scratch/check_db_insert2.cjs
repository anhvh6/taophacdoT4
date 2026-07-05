const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { error } = await supabase.from('customer_tasks').insert([{ customer_id: 'TEST1234', day: 1, type: 'TEST', title: 'TEST', detail: '', link: 'test-link', nhom: '', sort_order: 1 }]);
  console.log("Insert with 'link' error:", error);
  const { error: err2 } = await supabase.from('customer_tasks').insert([{ customer_id: 'TEST1234', day: 1, type: 'TEST', title: 'TEST', detail: '', video_link: 'test-link', nhom: '', sort_order: 1 }]);
  console.log("Insert with 'video_link' error:", err2);
}
run();
