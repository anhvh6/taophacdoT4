import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTasks() {
  const customerId = 'C1775727845839MPOCB';
  const { data: tasks } = await supabase
    .from('customer_tasks')
    .select('*')
    .eq('customer_id', customerId);

  console.log("Tasks for student:", tasks);
}

checkTasks();
