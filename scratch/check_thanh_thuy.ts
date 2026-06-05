import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('customers')
    .select('customer_name, video_date, raw_backup')
    .eq('customer_id', 'C17791901848355Y5KS')
    .single();

  if (error) {
    console.error(error);
  } else {
    console.log(data.customer_name, "video_date:", data.video_date);
  }
}

check();
