import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function test() {
  console.log("Testing with Anon Key...");
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, role, email');
    
  if (error) {
    console.error("Error reading admin_users table:", error);
  } else {
    console.log("Successfully retrieved data:", data);
  }
}

test();
