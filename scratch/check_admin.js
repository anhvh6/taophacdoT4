import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const TARGET_URL = process.env.VITE_SUPABASE_URL || 'https://yovjwbswfeblfswdxown.supabase.co';
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const targetSupabase = createClient(TARGET_URL, TARGET_KEY);

async function run() {
  try {
    const { data: admins, error } = await targetSupabase.from('admin_users').select('*');
    console.log('Admins:', admins);
  } catch(e) {
    console.error(e);
  }
}

run();
