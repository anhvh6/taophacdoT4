import React, { useState } from 'react';
// MOCK: Supabase removed, mock it to avoid import error
const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null } })
  }
};
import { Database, Code, Copy, Check } from 'lucide-react';
import { Button } from '../../components/UI';
import data from '../../migration/data_export.json';

const SQL_SCHEMA = `-- Supabase Schema for Mega Phương Facial Yoga Management System

-- 1. Tables
create extension if not exists "pgcrypto";

create table if not exists admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text default 'admin',
  created_at timestamptz default now()
);

create table if not exists "Sản phẩm" (
  id uuid primary key default gen_random_uuid(),
  "ID_SP" text unique not null,
  "Ten_SP" text,
  "Gia_Nhap" numeric default 0,
  "Gia_Ban" numeric default 0,
  "Trang_Thai" integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists "Customers" (
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
  "Video_date" date,
  status text default 'ACTIVE',
  sidebar_blocks_json jsonb default '[]'::jsonb,
  link text,
  token text not null,
  app_title text,
  app_slogan text,
  is_customized boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists "Lich phac do" (
  id uuid primary key default gen_random_uuid(),
  "Video_date" date not null,
  "Day" integer not null default 0,
  type text,
  title text,
  detail text,
  "Link" text,
  "N" integer default 0,
  "Nhom" text,
  created_at timestamptz default now()
);

create table if not exists "Lịch trình" (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references "Customers"(customer_id) on delete cascade,
  day integer not null,
  type text,
  title text,
  detail text,
  link text,
  is_deleted integer default 0,
  "Nhom" text,
  created_at timestamptz default now()
);

-- Ensure columns exist for existing tables
do $$ 
begin
  -- Check and add 'Day' to 'Lich phac do'
  if not exists (select 1 from information_schema.columns where table_name='Lich phac do' and column_name='Day') then
    alter table "Lich phac do" add column "Day" integer not null default 0;
  end if;
  
  -- Check and add 'Nhom' to 'Lich phac do'
  if not exists (select 1 from information_schema.columns where table_name='Lich phac do' and column_name='Nhom') then
    alter table "Lich phac do" add column "Nhom" text;
  end if;

  -- Check and add 'Nhom' to 'Lịch trình'
  if not exists (select 1 from information_schema.columns where table_name='Lịch trình' and column_name='Nhom') then
    alter table "Lịch trình" add column "Nhom" text;
  end if;

  -- Check and add 'is_customized' to 'Customers'
  if not exists (select 1 from information_schema.columns where table_name='Customers' and column_name='is_customized') then
    alter table "Customers" add column "is_customized" boolean default false;
  end if;

  -- Ensure unique constraints for upsert operations
  if not exists (
    select 1 from pg_constraint 
    where conname = 'Sản phẩm_ID_SP_key' 
    or (conrelid = '"Sản phẩm"'::regclass and contype = 'u' and (select array_agg(attname::text) from pg_attribute where attrelid = conrelid and attnum = any(conkey)) @> array['ID_SP'])
  ) then
    begin
      alter table "Sản phẩm" add constraint "Sản phẩm_ID_SP_key" unique ("ID_SP");
    exception when others then
      raise notice 'Could not add unique constraint to Sản phẩm.ID_SP - might already exist or have duplicates';
    end;
  end if;

  if not exists (
    select 1 from pg_constraint 
    where conname = 'Customers_customer_id_key' 
    or (conrelid = '"Customers"'::regclass and contype = 'u' and (select array_agg(attname::text) from pg_attribute where attrelid = conrelid and attnum = any(conkey)) @> array['customer_id'])
  ) then
    begin
      alter table "Customers" add constraint "Customers_customer_id_key" unique ("customer_id");
    exception when others then
      raise notice 'Could not add unique constraint to Customers.customer_id - might already exist or have duplicates';
    end;
  end if;
end $$;

-- RLS
alter table admin_users enable row level security;
alter table "Sản phẩm" enable row level security;
alter table "Customers" enable row level security;
alter table "Lich phac do" enable row level security;
alter table "Lịch trình" enable row level security;

-- Admin Policies (Drop first to ensure fresh start)
drop policy if exists "Admins can do everything on products" on "Sản phẩm";
drop policy if exists "Admins can do everything on customers" on "Customers";
drop policy if exists "Admins can do everything on master tasks" on "Lich phac do";
drop policy if exists "Admins can do everything on customer tasks" on "Lịch trình";

create policy "Admins can do everything on products" on "Sản phẩm" for all to authenticated using (true) with check (true);
create policy "Admins can do everything on customers" on "Customers" for all to authenticated using (true) with check (true);
create policy "Admins can do everything on master tasks" on "Lich phac do" for all to authenticated using (true) with check (true);
create policy "Admins can do everything on customer tasks" on "Lịch trình" for all to authenticated using (true) with check (true);

-- Public Policies for Client Access (using Token)
drop policy if exists "Clients can read their own data" on "Customers";
drop policy if exists "Clients can read their own tasks" on "Lịch trình";
drop policy if exists "Clients can read master tasks" on "Lich phac do";

create policy "Clients can read their own data" on "Customers" for select using (true);
create policy "Clients can read their own tasks" on "Lịch trình" for select using (true);
create policy "Clients can read master tasks" on "Lich phac do" for select using (true);

-- 3. RPC Functions for Public Client Access
drop function if exists get_client_customer(text, text);
create or replace function get_client_customer(p_customer_id text, p_token text)
returns table (
  customer_id text,
  customer_name text,
  start_date date,
  end_date date,
  video_date date,
  status text,
  sidebar_blocks_json jsonb,
  app_title text,
  app_slogan text,
  is_customized boolean,
  link text,
  token text
) security definer as $$
begin
  return query
  select 
    c.customer_id, c.customer_name, c.start_date, c.end_date, c."Video_date" as video_date, 
    c.status, c.sidebar_blocks_json, c.app_title, c.app_slogan, c.is_customized,
    c.link, c.token
  from "Customers" c
  where c.customer_id = p_customer_id and c.token = p_token;
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
) security definer as $$
declare
  v_is_customized boolean;
  v_video_date date;
begin
  -- Verify token first
  select is_customized, "Video_date" into v_is_customized, v_video_date
  from "Customers"
  where customer_id = p_customer_id and token = p_token;

  if not found then
    return;
  end if;

  if v_is_customized then
    return query
    select ct.day, ct.type, ct.title, ct.detail, ct.link, 0 as sort_order, ct."Nhom" as nhom
    from "Lịch trình" ct
    where ct.customer_id = p_customer_id and (ct.is_deleted = 0 or ct.is_deleted is null)
    order by ct.day asc;
  else
    return query
    select mvt."N" as day, mvt.type, mvt.title, mvt.detail, mvt."Link" as link, mvt."N" as sort_order, mvt."Nhom" as nhom
    from "Lich phac do" mvt
    where mvt."Video_date" = v_video_date
    order by mvt."N" asc;
  end if;
end;
$$ language plpgsql;

drop function if exists get_master_tasks(date);
create or replace function get_master_tasks(p_video_date date)
returns table (
  id uuid,
  day integer,
  type text,
  title text,
  detail text,
  link text,
  nhom text,
  sort_order integer
) security definer as $$
begin
  return query
  select 
    mvt.id, mvt."N" as day, mvt.type, mvt.title, mvt.detail, mvt."Link" as link, mvt."Nhom" as nhom, mvt."N" as sort_order
  from "Lich phac do" mvt
  where mvt."Video_date" = p_video_date
  order by mvt."N" asc;
end;
$$ language plpgsql;
`;

export const MigrationTool: React.FC = () => {
  const [status, setStatus] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [serviceKey, setServiceKey] = useState('');
  const [customUrl, setCustomUrl] = useState((import.meta as any).env.VITE_SUPABASE_URL || '');
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);

  const addLog = (msg: string) => {
    setStatus(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runMigration = async () => {
    if (!serviceKey) {
      alert('Vui lòng nhập Supabase Service Role Key');
      return;
    }

    if (!customUrl || customUrl.includes('placeholder-project')) {
      alert('Vui lòng nhập Supabase URL hợp lệ');
      return;
    }

    setLoading(true);
    setStatus([]);
    addLog('Bắt đầu quá trình migration...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      const response = await fetch('/api/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          serviceKey: serviceKey.trim(),
          supabaseUrl: customUrl.trim(),
          userId
        })
      });

      const result = await response.text();
      let jsonResult: any;
      try {
        jsonResult = JSON.parse(result);
      } catch (e) {
        throw new Error(`Server returned non-JSON response: ${result.substring(0, 100)}...`);
      }

      if (jsonResult.logs) {
        setStatus(jsonResult.logs);
      }

      if (!response.ok) {
        throw new Error(jsonResult.error || 'Migration failed');
      }

      if (!userId) {
        addLog('Cảnh báo: Không tìm thấy session đăng nhập. Bạn cần đăng ký tài khoản và chạy lại bước này để có quyền Admin.');
      }

      addLog('Migration hoàn tất thành công!');
    } catch (err: any) {
      addLog(`LỖI: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-3xl shadow-xl mt-10 mb-20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-2xl">
            <Database className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Thiết lập Cơ sở dữ liệu</h1>
            <p className="text-gray-500">Khởi tạo bảng và import dữ liệu vào Supabase</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          onClick={() => setShowSql(!showSql)}
          className="flex items-center gap-2"
        >
          <Code size={18} />
          {showSql ? 'Ẩn SQL' : 'Xem SQL'}
        </Button>
      </div>

      <div className="space-y-6">
        {showSql && (
          <div className="relative bg-gray-900 rounded-2xl p-6 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-sm">SQL Schema</h3>
              <button 
                onClick={handleCopySql}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-xs"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                {copied ? 'Đã copy' : 'Copy SQL'}
              </button>
            </div>
            <pre className="text-green-400 font-mono text-[10px] overflow-x-auto h-64 scrollbar-hide">
              {SQL_SCHEMA}
            </pre>
            <div className="mt-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-xl text-[10px] text-blue-200">
              <strong>Hướng dẫn:</strong> Copy đoạn mã trên, dán vào <strong>SQL Editor</strong> trong Supabase Dashboard và nhấn <strong>Run</strong> trước khi thực hiện Import.
            </div>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-2xl text-sm text-yellow-800">
          <p className="font-bold mb-1">Lưu ý quan trọng:</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>Bạn phải sử dụng <strong>Service Role Key</strong> (không phải Anon Key).</li>
            <li>Key này thường là một chuỗi rất dài bắt đầu bằng <code>eyJ...</code></li>
            <li>Tìm thấy tại: <strong>Project Settings</strong> &gt; <strong>API</strong> &gt; <strong>Project API Keys</strong> &gt; <strong>service_role</strong>.</li>
            <li>Đừng nhầm với <i>Personal Access Token</i> (bắt đầu bằng <code>sbp_</code>) hoặc <i>Management API Key</i>.</li>
          </ul>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Supabase URL</label>
          <input 
            type="text" 
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
            placeholder="https://xyz.supabase.co"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Supabase Service Role Key (JWT)</label>
          <input 
            type="password" 
            value={serviceKey}
            onChange={(e) => setServiceKey(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
            placeholder="Dán key bắt đầu bằng eyJ... vào đây"
          />
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={runMigration} 
            disabled={loading}
            className="flex-1 py-4 text-lg bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100"
          >
            {loading ? 'Đang Import...' : 'Bắt đầu Import Dữ liệu'}
          </Button>
        </div>

        <div className="bg-gray-900 rounded-2xl p-4 h-64 overflow-y-auto font-mono text-xs text-green-400">
          {status.length === 0 && <p className="text-gray-500 italic">Chưa có hoạt động nào...</p>}
          {status.map((log, i) => (
            <div key={i} className="mb-1">{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
};
