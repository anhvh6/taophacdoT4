import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const TARGET_URL = process.env.VITE_SUPABASE_URL || 'https://yovjwbswfeblfswdxown.supabase.co';
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(TARGET_URL, TARGET_KEY);

async function run() {
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    
    console.log(`Found ${users.length} users in auth.users`);
    
    for (const u of users) {
      console.log('User:', u.email, u.id);
      
      const { error: insertError } = await supabase
        .from('admin_users')
        .insert({ id: u.id, role: 'admin' })
        .select();
        
      if (insertError) {
        if (insertError.code === '23505') {
            console.log(`User ${u.email} is already in admin_users`);
        } else {
            console.error(`Error inserting ${u.email}:`, insertError);
        }
      } else {
        console.log(`Added ${u.email} to admin_users`);
      }
    }
    console.log("Done fixing admins");
  } catch(e) {
    console.error(e);
  }
}

run();
