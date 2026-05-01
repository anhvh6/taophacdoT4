import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateAllToBaoMat1() {
  console.log("Updating all students to 'Bảo mật 1' (2026-04-19)...");

  // 1. Update video_date for all customers
  const { data, error, count } = await supabase
    .from('customers')
    .update({ video_date: '2026-04-19' })
    .neq('video_date', '2026-04-19'); // Only update if different

  if (error) {
    console.error("Error updating customers:", error);
    return;
  }

  console.log(`Successfully updated customers.`);

  // 2. Logic Check: If they are NOT customized, they will now follow the new master plan.
  // If they ARE customized, they will keep their private tasks but the 'video_date' 
  // reference in the editor will now show 'Bảo mật 1'.
  
  // Optional: Should we reset is_customized for those who have very few tasks?
  // I did this in global_fix.ts before. I'll do a quick check again to be sure.
  const { data: customized } = await supabase
    .from('customers')
    .select('customer_id, is_customized');

  let resetCount = 0;
  for (const c of (customized || [])) {
    const { data: tasks } = await supabase
      .from('customer_tasks')
      .select('id')
      .eq('customer_id', c.customer_id);

    // If they have is_customized=true but 0 tasks, it's a logic error, reset it.
    if (c.is_customized && (!tasks || tasks.length === 0)) {
       await supabase.from('customers').update({ is_customized: false }).eq('customer_id', c.customer_id);
       resetCount++;
    }
  }
  
  console.log(`Reset is_customized for ${resetCount} students who had no custom tasks.`);
  console.log("Update complete!");
}

updateAllToBaoMat1().catch(console.error);
