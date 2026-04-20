import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.vercel') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.vercel');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('Adding missing columns to Supabase...');

  const sql = `
    -- Add approved_at to customer_devices if missing
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_devices' AND column_name='approved_at') THEN
        ALTER TABLE customer_devices ADD COLUMN approved_at timestamptz;
      END IF;
    END $$;

    -- Add pending_email to customers if missing
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='pending_email') THEN
        ALTER TABLE customers ADD COLUMN pending_email text;
      END IF;
    END $$;
  `;

  // We try to run via admin_run_sql if it exists
  const { error } = await supabase.rpc('admin_run_sql', { sql_query: sql });
  
  if (error) {
    console.log('\x1b[33m%s\x1b[0m', 'Warning: Could not run automated SQL migration.');
    console.log('You need to run the following SQL manually in your Supabase Dashboard SQL Editor:');
    console.log('\x1b[36m%s\x1b[0m', sql);
  } else {
    console.log('\x1b[32m%s\x1b[0m', 'Migration successful! Added missing columns.');
  }
}

applyMigration();
