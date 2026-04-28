import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const TARGET_URL = process.env.VITE_SUPABASE_URL || 'https://yovjwbswfeblfswdxown.supabase.co';
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  try {
    const res = await fetch(`${TARGET_URL}/auth/v1/admin/users`, {
      headers: {
        'Authorization': `Bearer ${TARGET_KEY}`,
        'apikey': TARGET_KEY
      }
    });
    
    if (!res.ok) {
        console.error('Failed to fetch users:', res.status, await res.text());
        return;
    }
    
    const users = await res.json();
    console.log(`Found ${users.length || users.users?.length} users.`);
    const userList = users.users || users;
    
    for (const u of userList) {
        console.log(`Email: ${u.email}, ID: ${u.id}`);
    }
    
    // Now insert all of them into admin_users!
    const { createClient } = await import('@supabase/supabase-js');
    const targetSupabase = createClient(TARGET_URL, TARGET_KEY);
    
    for (const u of userList) {
        const { error } = await targetSupabase.from('admin_users').insert({ id: u.id, role: 'admin' });
        if (error) {
            console.error(`Failed to insert ${u.email}:`, error.message);
        } else {
            console.log(`Successfully added ${u.email} to admin_users!`);
        }
    }
  } catch(e) {
    console.error(e);
  }
}

run();
