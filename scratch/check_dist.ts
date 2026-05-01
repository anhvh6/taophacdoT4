import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDateDistribution() {
  const { data: customers } = await supabase.from('customers').select('video_date');
  const counts = {};
  customers.forEach(c => {
    const d = c.video_date || 'null';
    counts[d] = (counts[d] || 0) + 1;
  });
  console.log("Current date distribution:", counts);
}

checkDateDistribution();
