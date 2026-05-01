import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRpc() {
  const { data, error } = await supabase.rpc('get_master_tasks', {
    p_video_date: '2026-01-01'
  });

  if (error) {
    console.error("RPC Error:", error);
    return;
  }

  console.log("First task from RPC:", data[0]);
}

checkRpc();
