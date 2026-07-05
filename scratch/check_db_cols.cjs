const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('customer_tasks').select('*').limit(1);
  console.log("Error:", error);
  if (data?.length) console.log("Keys:", Object.keys(data[0]));
}
run();
