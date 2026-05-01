import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncVideoDates() {
  // 1. Get valid master dates
  const { data: masterData } = await supabase
    .from('master_video_tasks')
    .select('video_date');
  
  const validDates = [...new Set(masterData?.map(d => d.video_date) || [])];
  console.log("Valid master video dates:", validDates);

  if (validDates.length === 0) {
    console.error("No valid master video dates found!");
    return;
  }

  // Use 2026-04-18 as the default "Bảo mật 1" group if it exists
  const defaultDate = validDates.includes('2026-04-18') ? '2026-04-18' : validDates[0];
  console.log("Using defaultDate for invalid entries:", defaultDate);

  // 2. Find customers with invalid video_date
  const { data: customers } = await supabase
    .from('customers')
    .select('id, customer_id, customer_name, video_date');
  
  const invalidCustomers = customers?.filter(c => !c.video_date || !validDates.includes(c.video_date)) || [];
  console.log(`Found ${invalidCustomers.length} customers with invalid video_date.`);

  // 3. Fix them
  if (invalidCustomers.length > 0) {
    console.log(`Updating ${invalidCustomers.length} customers to ${defaultDate}...`);
    
    // Process in batches
    const idsToUpdate = invalidCustomers.map(c => c.id);
    const { error } = await supabase
        .from('customers')
        .update({ video_date: defaultDate })
        .in('id', idsToUpdate);
    
    if (error) {
        console.error("Update Error:", error);
    } else {
        console.log("Successfully fixed all invalid video_dates.");
    }
  }

  // 4. Special check: 2026-04-19 specifically (since it was mentioned in summary)
  const { count: c19 } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('video_date', '2026-04-19');
  
  if (c19 && c19 > 0) {
    console.log(`Found ${c19} remaining customers on 2026-04-19, fixing...`);
    await supabase.from('customers').update({ video_date: defaultDate }).eq('video_date', '2026-04-19');
  }
}

syncVideoDates();
