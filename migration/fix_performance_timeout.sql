CREATE INDEX IF NOT EXISTS idx_customers_trim_lookup ON customers(trim(customer_id), trim(token));
CREATE INDEX IF NOT EXISTS idx_customer_tasks_trim_lookup ON customer_tasks(trim(customer_id));

-- 2. Update get_client_customer RPC to remove trim()
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
  require_device_limit boolean,
  raw_backup jsonb
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
    c.require_device_limit,
    c.raw_backup
  from customers c
  where c.customer_id = p_customer_id
    and c.token = p_token
  limit 1;
end;
$$ language plpgsql;

-- 3. Update get_client_tasks RPC to remove trim()
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
  where c.customer_id = p_customer_id
    and c.token = p_token
  limit 1;

  if not found then
    return;
  end if;

  if v_is_customized then
    return query
    select ct.day, ct.type, ct.title, ct.detail, ct.link, ct.sort_order, coalesce(ct.nhom, '')
    from customer_tasks ct
    where ct.customer_id = p_customer_id
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
