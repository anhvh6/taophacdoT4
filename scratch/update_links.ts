import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateLinks() {
  console.log("Fetching customers...");
  const { data: customers, error: fetchErr } = await supabase
    .from('customers')
    .select('customer_id, link');

  if (fetchErr) {
    console.error("Error fetching customers:", fetchErr);
    return;
  }

  console.log(`Found ${customers.length} customers.`);
  let updateCount = 0;

  for (const customer of customers) {
    if (!customer.link) continue;
    
    let newLink = customer.link;
    const oldDomains = [
      'phacdo4.vercel.app',
      '30ngaythaydoi.vercel.app',
      'taophacdot4.vercel.app',
      'phacdo-megaphuong.vercel.app',
      'phacdo.netlify.app'
    ];

    let changed = false;
    for (const domain of oldDomains) {
      if (newLink.includes(domain)) {
        newLink = newLink.replace(domain, 'phacdo.vercel.app');
        changed = true;
      }
    }

    if (changed) {
      console.log(`Updating ${customer.customer_id}: ${customer.link} -> ${newLink}`);
      const { error: updateErr } = await supabase
        .from('customers')
        .update({ link: newLink })
        .eq('customer_id', customer.customer_id);

      if (updateErr) {
        console.error(`Error updating ${customer.customer_id}:`, updateErr);
      } else {
        updateCount++;
      }
    }
  }

  console.log(`Updated ${updateCount} links.`);
}

updateLinks().catch(console.error);
