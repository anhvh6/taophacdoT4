import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('customers')
    .select('customer_name, video_date');

  if (error) {
    console.error(error);
  } else {
    const dates = {};
    data.forEach(d => {
      dates[d.video_date] = (dates[d.video_date] || 0) + 1;
    });
    console.log("Customer video_dates:");
    console.log(dates);
  }
}

check();
