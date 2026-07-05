const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n');
env.forEach(l => {
  const parts = l.split('=');
  if (parts.length >= 2) {
    process.env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('customers').select('customer_id, customer_name, raw_backup').limit(5).then(d => {
  console.log(JSON.stringify(d.data, null, 2));
}).catch(console.error);
