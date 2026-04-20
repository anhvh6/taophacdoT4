-- Supabase Schema for Mega Phuong Facial Yoga Management System
-- Standardized for Vercel + Supabase (idempotent, lowercase table names).

create extension if not exists "pgcrypto";

-- 0) Optional migration helper: rename old legacy table names to standardized names
do $$
begin
  if to_regclass('public."Sản phẩm"') is not null and to_regclass('public.products') is null then
    execute 'alter table public."Sản phẩm" rename to products';
  end if;
  if to_regclass('public."Customers"') is not null and to_regclass('public.customers') is null then
    execute 'alter table public."Customers" rename to customers';
  end if;
  if to_regclass('public."Lich phac do"') is not null and to_regclass('public.master_video_tasks') is null then
    execute 'alter table public."Lich phac do" rename to master_video_tasks';
  end if;
  if to_regclass('public."Lịch trình"') is not null and to_regclass('public.customer_tasks') is null then
    execute 'alter table public."Lịch trình" rename to customer_tasks';
  end if;
  if to_regclass('public."Khóa học"') is not null and to_regclass('public.courses') is null then
    execute 'alter table public."Khóa học" rename to courses';
  end if;
end $$;

-- 1) Core tables
create table if not exists admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  id_sp text not null unique,
  ten_sp text,
  gia_nhap numeric not null default 0,
  gia_ban numeric not null default 0,
  trang_thai integer not null default 1,
  raw_backup jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null unique,
  customer_name text,
  sdt text,
  email text,
  dia_chi text,
  san_pham jsonb not null default '[]'::jsonb,
  gia_tien numeric not null default 0,
  trang_thai_gan text,
  trang_thai integer,
  ma_vd text,
  note text,
  chewing_status text,
  start_date date,
  end_date date,
  duration_days integer,
  video_date date,
  status text not null default 'ACTIVE',
  sidebar_blocks_json jsonb not null default '[]'::jsonb,
  link text,
  token text not null,
  app_title text,
  app_slogan text,
  is_customized boolean not null default false,
  require_google_auth boolean not null default true,
  require_device_limit boolean not null default true,
  pending_email text,
  raw_backup jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_devices (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references customers(customer_id) on delete cascade,
  device_id text not null,
  device_name text,
  is_approved boolean not null default false,
  approved_at timestamptz,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(customer_id, device_id)
);

create table if not exists master_video_tasks (
  id uuid primary key default gen_random_uuid(),
  video_date date not null,
  day integer not null,
  type text,
  title text,
  detail text,
  link text,
  nhom text,
  sort_order integer not null default 0,
  raw_backup jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists customer_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references customers(customer_id) on delete cascade,
  day integer not null,
  type text,
  title text,
  detail text,
  link text,
  nhom text,
  is_deleted boolean not null default false,
  sort_order integer not null default 0,
  raw_backup jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists courses (
  id text primary key,
  name text,
  description text,
  fee numeric not null default 0,
  duration text,
  status integer not null default 1,
  raw_backup jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists payment_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id text,
  order_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 2) Helpful indexes
create index if not exists idx_customers_token on customers(token);
create index if not exists idx_customers_lookup on customers(customer_id, token);
create index if not exists idx_customers_dates on customers(start_date, end_date, video_date);
create index if not exists idx_master_tasks_lookup on master_video_tasks(video_date, day, sort_order);
create index if not exists idx_customer_tasks_lookup on customer_tasks(customer_id, day, sort_order);

-- 3) updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_customers_updated_at on customers;
create trigger update_customers_updated_at
before update on customers
for each row execute procedure update_updated_at_column();

drop trigger if exists update_products_updated_at on products;
create trigger update_products_updated_at
before update on products
for each row execute procedure update_updated_at_column();

-- 4) RLS
alter table admin_users enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table master_video_tasks enable row level security;
alter table customer_tasks enable row level security;
alter table courses enable row level security;
alter table customer_devices enable row level security;
alter table payment_orders enable row level security;

-- Admin policies
drop policy if exists admin_users_all_access on admin_users;
create policy admin_users_all_access on admin_users
for all to authenticated
using (exists (select 1 from admin_users au where au.id = auth.uid()))
with check (exists (select 1 from admin_users au where au.id = auth.uid()));

drop policy if exists products_admin_all_access on products;
create policy products_admin_all_access on products
for all to authenticated
using (exists (select 1 from admin_users au where au.id = auth.uid()))
with check (exists (select 1 from admin_users au where au.id = auth.uid()));

drop policy if exists customers_admin_all_access on customers;
create policy customers_admin_all_access on customers
for all to authenticated
using (exists (select 1 from admin_users au where au.id = auth.uid()))
with check (exists (select 1 from admin_users au where au.id = auth.uid()));

drop policy if exists master_video_tasks_admin_all_access on master_video_tasks;
create policy master_video_tasks_admin_all_access on master_video_tasks
for all to authenticated
using (exists (select 1 from admin_users au where au.id = auth.uid()))
with check (exists (select 1 from admin_users au where au.id = auth.uid()));

drop policy if exists customer_tasks_admin_all_access on customer_tasks;
create policy customer_tasks_admin_all_access on customer_tasks
for all to authenticated
using (exists (select 1 from admin_users au where au.id = auth.uid()))
with check (exists (select 1 from admin_users au where au.id = auth.uid()));

drop policy if exists courses_admin_all_access on courses;
create policy courses_admin_all_access on courses
for all to authenticated
using (exists (select 1 from admin_users au where au.id = auth.uid()))
with check (exists (select 1 from admin_users au where au.id = auth.uid()));

drop policy if exists payment_orders_admin_all_access on payment_orders;
create policy payment_orders_admin_all_access on payment_orders
for all to authenticated
using (exists (select 1 from admin_users au where au.id = auth.uid()))
with check (exists (select 1 from admin_users au where au.id = auth.uid()));

drop policy if exists customer_devices_admin_all_access on customer_devices;
create policy customer_devices_admin_all_access on customer_devices
for all to authenticated
using (exists (select 1 from admin_users au where au.id = auth.uid()))
with check (exists (select 1 from admin_users au where au.id = auth.uid()));

-- 5) RPC functions (public/client safe via token check)
drop function if exists get_client_customer(text, text);
create or replace function get_client_customer(p_customer_id text, p_token text)
returns table (
  customer_id text,
  customer_name text,
  sdt text,
  email text,
  dia_chi text,
  note text,
  start_date date,
  end_date date,
  status text,
  created_at text,
  updated_at text,
  chewing_status text,
  duration_days integer,
  sidebar_blocks_json jsonb,
  token text,
  link text,
  video_date date,
  ma_vd text,
  san_pham jsonb,
  gia_tien numeric,
  trang_thai_gan text,
  trang_thai integer,
  app_title text,
  app_slogan text,
  is_customized boolean,
  require_google_auth boolean,
  require_device_limit boolean
) security definer
set search_path = public
as $$
begin
  return query
  select
    c.customer_id,
    c.customer_name,
    c.sdt,
    c.email,
    c.dia_chi,
    c.note,
    c.start_date,
    c.end_date,
    c.status,
    c.created_at::text,
    c.updated_at::text,
    c.chewing_status,
    c.duration_days,
    c.sidebar_blocks_json,
    c.token,
    c.link,
    c.video_date,
    c.ma_vd,
    c.san_pham,
    c.gia_tien,
    c.trang_thai_gan,
    c.trang_thai,
    c.app_title,
    c.app_slogan,
    c.is_customized,
    c.require_google_auth,
    c.require_device_limit
  from customers c
  where trim(c.customer_id) = trim(p_customer_id)
    and trim(c.token) = trim(p_token)
  limit 1;
end;
$$ language plpgsql;

drop function if exists get_client_tasks(text, text);
create or replace function get_client_tasks(p_customer_id text, p_token text)
returns table (
  day integer,
  type text,
  title text,
  detail text,
  link text,
  sort_order integer,
  nhom text
) security definer
set search_path = public
as $$
declare
  v_is_customized boolean;
  v_video_date date;
begin
  select c.is_customized, c.video_date
  into v_is_customized, v_video_date
  from customers c
  where trim(c.customer_id) = trim(p_customer_id)
    and trim(c.token) = trim(p_token)
  limit 1;

  if not found then
    return;
  end if;

  if v_is_customized then
    return query
    select ct.day, ct.type, ct.title, ct.detail, ct.link, ct.sort_order, coalesce(ct.nhom, '')
    from customer_tasks ct
    where trim(ct.customer_id) = trim(p_customer_id)
      and ct.is_deleted = false
    order by ct.day asc, ct.sort_order asc;
  else
    return query
    select mvt.day, mvt.type, mvt.title, mvt.detail, mvt.link, mvt.sort_order, coalesce(mvt.nhom, '')
    from master_video_tasks mvt
    where mvt.video_date = v_video_date
    order by mvt.day asc, mvt.sort_order asc;
  end if;
end;
$$ language plpgsql;

drop function if exists get_master_tasks(date);
create or replace function get_master_tasks(p_video_date date)
returns table (
  day integer,
  type text,
  title text,
  detail text,
  link text,
  sort_order integer,
  nhom text
) security definer
set search_path = public
as $$
begin
  return query
  select mvt.day, mvt.type, mvt.title, mvt.detail, mvt.link, mvt.sort_order, coalesce(mvt.nhom, '')
  from master_video_tasks mvt
  where mvt.video_date = p_video_date
  order by mvt.day asc, mvt.sort_order asc;
end;
$$ language plpgsql;

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
  if not exists (select 1 from customers where customer_id = p_customer_id and token = p_token) then
    return;
  end if;

  return query
  select cd.device_id, cd.is_approved, cd.created_at
  from customer_devices cd
  where cd.customer_id = p_customer_id;
end;
$$ language plpgsql;

drop function if exists authorize_device(text, text, text, text);
create or replace function authorize_device(p_customer_id text, p_token text, p_device_id text, p_device_name text)
returns json security definer
set search_path = public
as $$
declare
  v_count integer;
  v_is_approved boolean;
  v_require_limit boolean;
begin
  -- Check customer
  select require_device_limit into v_require_limit
  from customers where customer_id = p_customer_id and token = p_token;
  
  if not found then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  if v_require_limit = false then
    return json_build_object('success', true, 'message', 'Limit disabled');
  end if;

  -- Check if device already exists
  select is_approved into v_is_approved
  from customer_devices where customer_id = p_customer_id and device_id = p_device_id;

  if found then
    if v_is_approved then
        return json_build_object('success', true, 'message', 'Already approved');
    else
        return json_build_object('success', false, 'message', 'Pending approval');
    end if;
  end if;

  -- New device, check count
  select count(*) into v_count from customer_devices where customer_id = p_customer_id;

  if v_count < 2 then
    -- Auto approve
    insert into customer_devices (customer_id, device_id, device_name, is_approved)
    values (p_customer_id, p_device_id, p_device_name, true);
    return json_build_object('success', true, 'message', 'Auto approved');
  else
    -- Block and wait for admin
    -- Note: We don't auto-insert here, we wait for user to click "Contact" and then we might insert or user might just contact.
    -- Actually, user wants "Tự động lưu thông số thiết bị mới vào danh sách chờ duyệt của Admin" when button "Liên hệ" is clicked.
    -- So this function will just return "Blocked".
    return json_build_object('success', false, 'message', 'Device limit reached');
  end if;
end;
$$ language plpgsql;

drop function if exists request_device_approval(text, text, text, text);
create or replace function request_device_approval(p_customer_id text, p_token text, p_device_id text, p_device_name text)
returns json security definer
set search_path = public
as $$
begin
  if not exists (select 1 from customers where customer_id = p_customer_id and token = p_token) then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  insert into customer_devices (customer_id, device_id, device_name, is_approved)
  values (p_customer_id, p_device_id, p_device_name, false)
  on conflict (customer_id, device_id) do nothing;

  return json_build_object('success', true, 'message', 'Requested');
end;
$$ language plpgsql;

grant execute on function get_client_tasks(text, text) to anon, authenticated;
grant execute on function get_master_tasks(date) to anon, authenticated;
grant execute on function get_client_devices(text, text) to anon, authenticated;
grant execute on function authorize_device(text, text, text, text) to anon, authenticated;
grant execute on function request_device_approval(text, text, text, text) to anon, authenticated;

drop function if exists enroll_customer_email(text, text, text);
create or replace function enroll_customer_email(p_customer_id text, p_email text, p_token text)
returns json security definer
set search_path = public
as $$
begin
  if not exists (select 1 from customers where customer_id = p_customer_id and token = p_token) then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  update customers 
  set email = p_email 
  where customer_id = p_customer_id 
    and (email is null or email = '');

  return json_build_object('success', true);
end;
$$ language plpgsql;

drop function if exists request_customer_email_change(text, text, text);
create or replace function request_customer_email_change(p_customer_id text, p_new_email text, p_token text)
returns json security definer
set search_path = public
as $$
begin
  if not exists (select 1 from customers where customer_id = p_customer_id and token = p_token) then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  update customers 
  set pending_email = p_new_email 
  where customer_id = p_customer_id;

  return json_build_object('success', true);
end;
$$ language plpgsql;

grant execute on function enroll_customer_email(text, text, text) to anon, authenticated;
grant execute on function request_customer_email_change(text, text, text) to anon, authenticated;
