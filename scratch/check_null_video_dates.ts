import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStudent() {
  // Use lowercase column name 'video_date'
  const { data, error } = await supabase
    .from('customers')
    .select('customer_id, customer_name, video_date, status')
    .eq('id', 'd9dbddc7-b203-4ded-aaaa-2bed772e35f5')
    .maybeSingle();
    
  console.log("Student details (by id):", data);
  if (error) console.error("Error details:", error);

  // Check how many students have null video_date
  const { count, error: countError } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .is('video_date', null);
  
  if (countError) console.error("Count Error:", countError);
  console.log("Total students with NULL video_date:", count);

  // Take a peek at some of them
  if (count && count > 0) {
    const { data: samples } = await supabase
        .from('customers')
        .select('id, customer_id, customer_name, created_at')
        .is('video_date', null)
        .order('created_at', { ascending: false })
        .limit(5);
    console.log("Sample students with missing video_date:", samples);
  }
}

checkStudent();
