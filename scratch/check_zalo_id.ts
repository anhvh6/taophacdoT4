import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCustomer() {
  const { data, error } = await supabase
    .from('customers')
    .select('customer_name')
    .eq('customer_id', 'C1772299961778')
    .maybeSingle();
    
  console.log("Customer result:", data);
}

checkCustomer();
