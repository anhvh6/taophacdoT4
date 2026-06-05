import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Mock the global/module supabase client
import { supabase } from '../src/lib/supabaseClient';
import { adminUserService } from '../src/services/adminUserService';
import { permissionService } from '../src/services/permissionService';

async function run() {
  console.log("Supabase URL:", supabaseUrl);
  try {
    const users = await adminUserService.getAdminUsers();
    console.log("Users:", users);
  } catch (err) {
    console.error("Error getAdminUsers:", err);
  }

  try {
    const roles = await permissionService.getRoles();
    console.log("Roles:", roles);
  } catch (err) {
    console.error("Error getRoles:", err);
  }
  
  try {
    const rolePermissions = await permissionService.getRolePermissions();
    console.log("Role Permissions count:", rolePermissions.length);
  } catch (err) {
    console.error("Error getRolePermissions:", err);
  }
}

run();
