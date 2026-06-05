import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function run() {
  console.log("Checking tables using Anon Key...");
  
  const { data: roles, error: rolesError } = await supabase.from('roles').select('*');
  console.log("roles table:", rolesError || roles);

  const { data: permissions, error: permError } = await supabase.from('permissions').select('*');
  console.log("permissions table count:", permError || (permissions ? permissions.length : 0));

  const { data: rolePermissions, error: rpError } = await supabase.from('role_permissions').select('*');
  console.log("role_permissions table count:", rpError || (rolePermissions ? rolePermissions.length : 0));
}

run();
