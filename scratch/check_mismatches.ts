import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVideoDateMismatches() {
  const { data: customers } = await supabase.from('customers').select('customer_id, video_date');
  const { data: masters } = await supabase.from('master_video_tasks').select('video_date');
  
  const masterDates = new Set(masters.map(m => m.video_date));
  
  const mismatches = customers.filter(c => c.video_date && !masterDates.has(c.video_date));
  
  console.log(`Found ${mismatches.length} students with mismatched video_date.`);
  
  const mismatchCounts = {};
  mismatches.forEach(m => {
    mismatchCounts[m.video_date] = (mismatchCounts[m.video_date] || 0) + 1;
  });
  
  console.log("Mismatch counts by date:", mismatchCounts);
}

checkVideoDateMismatches();
