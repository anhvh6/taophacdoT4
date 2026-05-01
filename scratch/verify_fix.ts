import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyHONGCHINH() {
  const studentId = 'C1775727845839MPOCB';
  const { data: customer } = await supabase
    .from('customers')
    .select('customer_id, video_date, is_customized')
    .eq('customer_id', studentId)
    .single();

  console.log("Verified HONG CHINH:", customer);

  const { data: tasks } = await supabase
    .from('customer_tasks')
    .select('id')
    .eq('customer_id', studentId);
    
  console.log("Custom tasks count now:", tasks?.length || 0);
}

verifyHONGCHINH();
