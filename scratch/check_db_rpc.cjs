const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('customers').select('token').eq('customer_id', 'C17805017503853H9O3').single();
  const token = data?.token;
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_client_tasks', { p_customer_id: 'C17805017503853H9O3', p_token: token });
  console.log("Error:", rpcErr);
}
run();
