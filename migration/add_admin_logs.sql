-- Migration: Create admin_logs table for tracking self-approvals and other system events
create table if not exists admin_logs (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- 'AUTO_APPROVED_EMAIL', 'AUTO_APPROVED_DEVICE', etc.
  customer_id text references customers(customer_id) on delete cascade,
  old_email text,
  new_email text,
  approved_device text,
  message text,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table admin_logs enable row level security;

-- Admin can see all logs
drop policy if exists admin_logs_admin_all_access on admin_logs;
create policy admin_logs_admin_all_access on admin_logs
for all to authenticated
using (exists (select 1 from admin_users au where au.id = auth.uid()))
with check (exists (select 1 from admin_users au where au.id = auth.uid()));

-- Index for searching
create index if not exists idx_admin_logs_customer on admin_logs(customer_id);
create index if not exists idx_admin_logs_type on admin_logs(type);
create index if not exists idx_admin_logs_created_at on admin_logs(created_at desc);
