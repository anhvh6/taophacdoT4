import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function run() {
  console.log("Signing in as anhvh@gmail.com...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'anhvh@gmail.com',
    password: 'anhvh123'
  });

  if (authError) {
    console.error("Auth failed:", authError);
    return;
  }

  console.log("Auth succeeded! User ID:", authData.user.id);
  console.log("Querying admin_users table as user...");

  const { data, error } = await supabase
    .from('admin_users')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (error) {
    console.error("Query failed with error:", error);
  } else {
    console.log("Query succeeded! Data:", data);
  }
}

run();
