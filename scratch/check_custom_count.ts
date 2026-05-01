import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCustomizedCount() {
  const { data, error, count } = await supabase
    .from('customers')
    .select('customer_id', { count: 'exact' })
    .eq('trang_thai_gan', '1');

  if (error) console.error(error);
  console.log("Count of students with trang_thai_gan='1':", count);

  const { data: realCustom } = await supabase
    .from('customers')
    .select('customer_id', { count: 'exact' })
    .eq('is_customized', true);
  console.log("Count of students with is_customized=true:", realCustom.length);
}

checkCustomizedCount();
