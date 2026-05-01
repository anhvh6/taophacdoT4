import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('master_video_tasks')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Columns:", Object.keys(data[0] || {}));
  console.log("Sample row:", data[0]);
}

checkSchema();
