const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n');
env.forEach(l => {
  const parts = l.split('=');
  if (parts.length >= 2) {
    process.env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
supabase.from('customers').select('*').limit(1).then(d => {
  console.log(d.error);
  if (d.data && d.data.length > 0) {
    console.log(Object.keys(d.data[0]));
  } else {
    console.log("No data");
  }
}).catch(console.error);
