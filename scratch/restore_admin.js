import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const SOURCE_URL = 'https://stzxreguggqwuvljymzq.supabase.co';
const SOURCE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0enhyZWd1Z2dxd3V2bGp5bXpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjM2MDcyNiwiZXhwIjoyMDg3OTM2NzI2fQ.6D1WrFW2nQXUM-joKiVBML7Vk2HJVImzjTIAjNjmGF4';

const TARGET_URL = process.env.VITE_SUPABASE_URL || 'https://yovjwbswfeblfswdxown.supabase.co';
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvdmp3YnN3ZmVibGZzd2R4b3duIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ5NzU5MiwiZXhwIjoyMDkyMDczNTkyfQ.Spo-CLoGoqY5n32MjxI0LSBegyAcvdh7LPAKH49ScZs';

const sourceSupabase = createClient(SOURCE_URL, SOURCE_KEY);
const targetSupabase = createClient(TARGET_URL, TARGET_KEY);

async function run() {
  try {
    const { data: sourceAdmins, error } = await sourceSupabase.from('admin_users').select('*');
    if (error) {
      console.error(error);
      return;
    }
    
    console.log('Source admins:', sourceAdmins);
    for (const admin of sourceAdmins) {
      const { error: insertError } = await targetSupabase.from('admin_users').insert(admin);
      if (insertError) {
        console.error('Target insert error:', insertError);
      } else {
        console.log(`Inserted admin ${admin.id} into target.`);
      }
    }
  } catch(e) {
    console.error(e);
  }
}

run();
