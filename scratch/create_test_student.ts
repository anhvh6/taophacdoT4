import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.vercel') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  const customerId = 'TEST_' + Date.now();
  const token = Math.random().toString(36).substring(2, 15);
  
  const payload = {
    customer_id: customerId,
    customer_name: 'HỌC VIÊN KIỂM THỬ',
    token: token,
    email: '', // Empty email to trigger enrollment
    status: 'ACTIVE',
    video_date: '2024-04-20',
    start_date: '2026-04-20',
    duration_days: 30,
    require_google_auth: true
  };

  const { data, error } = await supabase
    .from('customers')
    .upsert(payload)
    .select()
    .single();

  if (error) {
    console.error('Error creating test customer:', error);
    return;
  }

  console.log('Test Customer Created:', data.customer_id);
  console.log('Public Link:', `https://taophacdot4.vercel.app/#/client/${data.customer_id}?t=${data.token}`);
}

test();
