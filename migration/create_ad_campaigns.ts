import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySchema() {
  console.log('Applying ad campaigns schema...');

  const sql = `
    create table if not exists ad_campaigns (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      media jsonb not null default '[]'::jsonb,
      cta_name text,
      cta_link text,
      description text,
      display_now boolean not null default false,
      display_days integer,
      from_session integer,
      to_session integer,
      start_time timestamptz default now(),
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table ad_campaigns enable row level security;

    drop policy if exists ad_campaigns_admin_all_access on ad_campaigns;
    create policy ad_campaigns_admin_all_access on ad_campaigns
    for all to authenticated
    using (exists (select 1 from admin_users au where au.id = auth.uid()))
    with check (exists (select 1 from admin_users au where au.id = auth.uid()));

    drop policy if exists ad_campaigns_client_read on ad_campaigns;
    create policy ad_campaigns_client_read on ad_campaigns
    for select to anon, authenticated
    using (is_active = true and display_now = true);
  `;

  const { error } = await supabase.rpc('admin_run_sql', { sql_query: sql });
  
  if (error) {
    console.error('Error applying schema:', error);
  } else {
    console.log('Schema updated successfully!');
  }
}

applySchema();
