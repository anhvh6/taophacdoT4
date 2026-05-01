import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixNulls() {
  const { data, error } = await supabase
    .from('customers')
    .update({ video_date: '2026-04-19' })
    .is('video_date', null);
    
  console.log("Fixed null video_dates.");
}

fixNulls();
