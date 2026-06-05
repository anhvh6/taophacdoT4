import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listCustomers() {
  const { data: customers, error } = await supabase
    .from('customers')
    .select('customer_id, customer_name, token, raw_backup')
    .limit(10);

  if (error) {
    console.error("Error fetching customers:", error);
    return;
  }

  console.log("Customers:");
  for (const c of customers) {
    console.log(`- ID: ${c.customer_id} | Name: ${c.customer_name} | Token: ${c.token} | Completed Days: ${JSON.stringify(c.raw_backup?.completed_days)}`);
  }
}

listCustomers();
