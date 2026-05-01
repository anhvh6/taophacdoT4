import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectStudent() {
  const studentId = 'a1ba1240-1d39-4bd6-8389-3501100f646a'; 
  console.log(`Inspecting student with ID: ${studentId}...`);

  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .or(`customer_id.eq.${studentId},customer_id.eq.C1775727845839MPOCB`) // Added the ID from the screenshot URL just in case
    .single();

  if (cErr) {
    console.error("Customer Error:", cErr);
    
    // Try searching by name
    const { data: byName } = await supabase
        .from('customers')
        .select('*')
        .ilike('customer_name', '%HONG CHINH%');
    console.log("Search by name result:", byName);
    return;
  }

  console.log("Customer data:", JSON.stringify(customer, null, 2));

  // Check if they have custom tasks
  const { data: tasks, error: tErr } = await supabase
    .from('customer_tasks')
    .select('*')
    .eq('customer_id', customer.customer_id);

  console.log(`Custom tasks count: ${tasks?.length || 0}`);
}

inspectStudent();
