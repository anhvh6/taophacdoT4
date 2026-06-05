import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function check() {
  const { data: adminUsers, error: dbError } = await supabase
    .from('admin_users')
    .select('*');
  if (dbError) {
    console.error("Error fetching admin_users table:", dbError);
    return;
  }

  console.log("\nContents of public.admin_users table:");
  console.log(JSON.stringify(adminUsers, null, 2));
}

check();
