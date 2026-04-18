-- Supabase Schema for Mega Phương Facial Yoga Management System

-- 0. Migration Helper (Optional: Rename existing tables if they exist with old names)
-- ALTER TABLE IF EXISTS "Sản phẩm" RENAME TO products;
-- ALTER TABLE IF EXISTS "Customers" RENAME TO customers;
-- ALTER TABLE IF EXISTS "Lich phac do" RENAME TO master_video_tasks;
-- ALTER TABLE IF EXISTS "Lịch trình" RENAME TO customer_tasks;
-- ALTER TABLE IF EXISTS "Khóa học" RENAME TO courses;

-- 1. Tables

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- 1. Admin Users Table
create table admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text default 'admin',
  created_at timestamptz default now()
);

-- 2. Products Table
create table products (
  id uuid primary key default gen_random_uuid(),
  id_sp text unique not null,
  ten_sp text,
  gia_nhap numeric default 0,
  gia_ban numeric default 0,
  trang_thai integer default 1,
  raw_backup jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Customers Table
create table customers (
  id uuid primary key default gen_random_uuid(),
  customer_id text unique not null,
  customer_name text,
  sdt text,
  email text,
  dia_chi text,
  san_pham jsonb default '[]'::jsonb,
  gia_tien numeric default 0,
  trang_thai_gan text,
  trang_thai integer,
  ma_vd text,
  note text,
  chewing_status text,
  start_date date,
  end_date date,
  duration_days integer,
  video_date date,
  status text default 'ACTIVE',
  sidebar_blocks_json jsonb default '[]'::jsonb,
  link text,
  token text not null,
  app_title text,
  app_slogan text,
  is_customized boolean default false,
  raw_backup jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Master Video Tasks (Lich phac do)
create table master_video_tasks (
  id uuid primary key default gen_random_uuid(),
  video_date date not null,
  day integer not null,
  type text,
  title text,
  detail text,
  link text,
  sort_order integer default 0,
  raw_backup jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 5. Customer Tasks (Lịch trình riêng)
create table customer_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references customers(customer_id) on delete cascade,
  day integer not null,
  type text,
  title text,
  detail text,
  link text,
  is_deleted boolean default false,
  sort_order integer default 0,
  raw_backup jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 6. Courses Table
create table courses (
  id text primary key,
  name text,
  description text,
  fee numeric default 0,
  duration text,
  status integer default 1,
  raw_backup jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 7. Payment Orders Table
create table payment_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id text,
  order_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Indexes
create index idx_customers_token on customers(token);
create index idx_customers_dates on customers(start_date, end_date, video_date);
create index idx_master_tasks_lookup on master_video_tasks(video_date, day);
create index idx_customer_tasks_lookup on customer_tasks(customer_id, day);

-- Updated At Trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_customers_updated_at before update on customers for each row execute procedure update_updated_at_column();
create trigger update_products_updated_at before update on products for each row execute procedure update_updated_at_column();

-- RLS (Row Level Security)
alter table admin_users enable row level security;
alter table products enable row level security;
alter table "Customers" enable row level security;
alter table master_video_tasks enable row level security;
alter table customer_tasks enable row level security;
alter table courses enable row level security;
alter table payment_orders enable row level security;

-- Admin Policies
create policy "Admins can do everything" on products for all to authenticated using (exists (select 1 from admin_users where id = auth.uid()));
create policy "Admins can do everything" on "Customers" for all to authenticated using (exists (select 1 from admin_users where id = auth.uid()));
create policy "Admins can do everything" on master_video_tasks for all to authenticated using (exists (select 1 from admin_users where id = auth.uid()));
create policy "Admins can do everything" on customer_tasks for all to authenticated using (exists (select 1 from admin_users where id = auth.uid()));
create policy "Admins can do everything" on courses for all to authenticated using (exists (select 1 from admin_users where id = auth.uid()));
create policy "Admins can do everything" on payment_orders for all to authenticated using (exists (select 1 from admin_users where id = auth.uid()));

-- RPC Functions for Public Client Access

-- Drop existing functions first to avoid return type mismatch errors
drop function if exists get_client_customer(text, text);
drop function if exists get_client_tasks(text, text);
drop function if exists get_master_tasks(date);

-- 1. Get Customer by ID and Token
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
  ma_vd numeric,
  san_pham jsonb,
  gia_tien numeric,
  trang_thai_gan numeric,
  trang_thai numeric,
  app_title text,
  app_slogan text,
  is_customized boolean
) security definer as $$
begin
  return query
  select 
    c.customer_id, c.customer_name, c.sdt, c.email, c.dia_chi, c.note, 
    c.start_date, c.end_date, c.status, c.created_at, c.updated_at, 
    c.chewing_status, c.duration_days, c.sidebar_blocks_json, c.token, c.link, 
    c."Video_date" as video_date, c.ma_vd, c.san_pham, c.gia_tien, 
    c.trang_thai_gan, c.trang_thai, c.app_title, c.app_slogan,
    (case when c.trang_thai_gan = 1 then true else false end) as is_customized
  from "Customers" c
  where trim(c.customer_id) = trim(p_customer_id) and trim(c.token) = trim(p_token)
  limit 1;
end;
$$ language plpgsql;

-- 2. Get Tasks for Client
create or replace function get_client_tasks(p_customer_id text, p_token text)
returns table (
  day integer,
  type text,
  title text,
  detail text,
  link text,
  sort_order integer,
  nhom text
) security definer as $$
declare
  v_is_customized boolean;
  v_video_date date;
begin
  -- Verify token first
  select (case when trang_thai_gan = 1 then true else false end), "Video_date" 
  into v_is_customized, v_video_date
  from "Customers"
  where trim(customer_id) = trim(p_customer_id) and trim(token) = trim(p_token)
  limit 1;

  if not found then
    return;
  end if;

  if v_is_customized then
    return query
    select ct.day, ct.type, ct.title, ct.detail, ct.link, 0 as sort_order, '' as nhom
    from "Lịch trình" ct
    where trim(ct.customer_id) = trim(p_customer_id) and (ct.is_deleted = 0 or ct.is_deleted is null)
    order by ct.day asc;
  else
    return query
    select mvt."N"::integer as day, mvt.type, mvt.title, mvt.detail, mvt."Link" as link, 0 as sort_order, mvt."Nhom" as nhom
    from "Lich phac do" mvt
    where mvt."Video_date" = v_video_date
    order by mvt."N" asc;
  end if;
end;
$$ language plpgsql;

-- 3. Get Master Tasks by Date
create or replace function get_master_tasks(p_video_date date)
returns table (
  day integer,
  type text,
  title text,
  detail text,
  link text,
  sort_order integer,
  nhom text
) security definer as $$
begin
  return query
  select mvt."N"::integer as day, mvt.type, mvt.title, mvt.detail, mvt."Link" as link, 0 as sort_order, mvt."Nhom" as nhom
  from "Lich phac do" mvt
  where mvt."Video_date" = p_video_date
  order by mvt."N" asc;
end;
$$ language plpgsql;
