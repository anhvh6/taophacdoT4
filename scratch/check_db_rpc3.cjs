const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.rpc('get_client_tasks', { p_customer_id: 'C17805017503853H9O3', p_token: 'valid_token' });
  console.log("Count:", data?.length);
  console.log("First:", data?.[0]);
}
run();
