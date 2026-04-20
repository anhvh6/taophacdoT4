import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.vercel') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySchema() {
  console.log('Applying database updates...');

  const sql = `
    -- Add new security columns to customers
    alter table customers add column if not exists require_google_auth boolean not null default true;
    alter table customers add column if not exists require_device_limit boolean not null default true;

    -- Create customer_devices table
    create table if not exists customer_devices (
      id uuid primary key default gen_random_uuid(),
      customer_id text not null references customers(customer_id) on delete cascade,
      device_id text not null,
      device_name text,
      is_approved boolean not null default false,
      last_used_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      unique(customer_id, device_id)
    );

    -- RLS for customer_devices
    alter table customer_devices enable row level security;

    drop policy if exists customer_devices_admin_all_access on customer_devices;
    create policy customer_devices_admin_all_access on customer_devices
    for all to authenticated
    using (exists (select 1 from admin_users au where au.id = auth.uid()))
    with check (exists (select 1 from admin_users au where au.id = auth.uid()));

    -- Grant access to RPC functions for client
    grant select, insert, update on customer_devices to anon, authenticated;

    -- RPC to get client devices
    drop function if exists get_client_devices(text, text);
    create or replace function get_client_devices(p_customer_id text, p_token text)
    returns table (
      device_id text,
      is_approved boolean,
      created_at timestamptz
    ) security definer
    set search_path = public
    as $$
    begin
      -- Verify customer access first
      if not exists (select 1 from customers where customer_id = p_customer_id and token = p_token) then
        return;
      end if;

      return query
      select cd.device_id, cd.is_approved, cd.created_at
      from customer_devices cd
      where cd.customer_id = p_customer_id;
    end;
    $$ language plpgsql;

    grant execute on function get_client_devices(text, text) to anon, authenticated;
  `;

  const { error } = await supabase.rpc('admin_run_sql', { sql_query: sql });
  
  if (error) {
    if (error.message.includes('function admin_run_sql(text) does not exist')) {
        console.log('RPC admin_run_sql not found. You need to run the following SQL manually in Supabase Dashboard SQL Editor:');
        console.log(sql);
    } else {
        console.error('Error applying schema:', error);
    }
  } else {
    console.log('Schema updated successfully!');
  }
}

applySchema();
