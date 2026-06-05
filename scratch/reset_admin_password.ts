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

async function run() {
  const userId = 'd14bf379-c06a-40db-ad08-f3cfb64db343'; // ID of anhvh@gmail.com
  console.log("Updating password for user:", userId);
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password: 'anhvh@123'
  });
  if (error) {
    console.error("Error updating password:", error);
  } else {
    console.log("Successfully updated password. User email:", data.user?.email);
  }
}

run();
