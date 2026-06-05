-- 1) Thêm cột email vào bảng public.admin_users
alter table public.admin_users add column if not exists email text;

-- 2) Kích hoạt RLS cho public.admin_users
alter table public.admin_users enable row level security;

-- 3) Chính sách bảo mật RLS
-- Cho phép tất cả người dùng đọc bảng admin_users để kiểm tra vai trò (cần thiết khi vừa xác thực xong)
drop policy if exists admin_users_read_all on public.admin_users;
create policy admin_users_read_all on public.admin_users for select using (true);

-- Chỉ Super Admin mới được thay đổi trực tiếp (insert, update, delete) bảng public.admin_users
-- Tách riêng biệt ra các quyền Insert, Update, Delete để tránh lỗi loop đệ quy vô hạn (infinite recursion) của SELECT
drop policy if exists admin_users_write_all on public.admin_users;

drop policy if exists admin_users_insert on public.admin_users;
create policy admin_users_insert on public.admin_users for insert to authenticated
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.role = 'super_admin'));

drop policy if exists admin_users_update on public.admin_users;
create policy admin_users_update on public.admin_users for update to authenticated
  using (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.role = 'super_admin'));

drop policy if exists admin_users_delete on public.admin_users;
create policy admin_users_delete on public.admin_users for delete to authenticated
  using (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.role = 'super_admin'));
