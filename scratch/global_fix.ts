import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function globalFix() {
  console.log("Starting global fix...");

  // 1. Fix video_date offsets
  const { data: masters } = await supabase.from('master_video_tasks').select('video_date');
  const masterDates = new Set(masters.map(m => m.video_date));
  
  const { data: customers } = await supabase.from('customers').select('customer_id, video_date');
  
  let dateFixCount = 0;
  for (const c of customers) {
    if (c.video_date && !masterDates.has(c.video_date)) {
      // Try offset -1 day
      const d = new Date(c.video_date);
      d.setDate(d.getDate() - 1);
      const newDate = d.toISOString().split('T')[0];
      
      if (masterDates.has(newDate)) {
        console.log(`Fixing date for ${c.customer_id}: ${c.video_date} -> ${newDate}`);
        await supabase.from('customers').update({ video_date: newDate }).eq('customer_id', c.customer_id);
        dateFixCount++;
      }
    }
  }
  console.log(`Updated ${dateFixCount} student video_dates.`);

  // 2. Fix is_customized and redundant customer_tasks
  // We'll look for students who have is_customized=true or trang_thai_gan=1
  // and have very few custom tasks (e.g. < 5)
  console.log("Checking for redundant custom plans...");
  const { data: customized } = await supabase
    .from('customers')
    .select('customer_id, is_customized, trang_thai_gan');

  let planFixCount = 0;
  for (const c of customized) {
    const { data: tasks } = await supabase
      .from('customer_tasks')
      .select('id')
      .eq('customer_id', c.customer_id);

    const taskCount = tasks?.length || 0;
    
    // If they have very few tasks, they probably shouldn't be customized
    if (taskCount < 5 && (c.is_customized || c.trang_thai_gan == 1)) {
        console.log(`Reverting ${c.customer_id} to master plan (taskCount: ${taskCount})`);
        // Delete redundant tasks
        if (taskCount > 0) {
            await supabase.from('customer_tasks').delete().eq('customer_id', c.customer_id);
        }
        // Set is_customized to false
        await supabase.from('customers').update({ is_customized: false, trang_thai_gan: 0 }).eq('customer_id', c.customer_id);
        planFixCount++;
    }
  }
  console.log(`Reverted ${planFixCount} students to master plan.`);

  console.log("Global fix complete!");
}

globalFix().catch(console.error);
