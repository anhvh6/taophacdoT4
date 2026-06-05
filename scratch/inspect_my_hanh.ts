import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('customer_id', 'C1779724069261IOH8H')
    .single();

  if (error) {
    console.error("Error fetching customer:", error);
    return;
  }

  console.log(JSON.stringify(customer, null, 2));
}

check();
