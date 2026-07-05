const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('customer_tasks').select('*').eq('customer_id', 'C17805017503853H9O3');
  console.log("Count:", data?.length);
  console.log("First:", data?.[0]);
}
run();
