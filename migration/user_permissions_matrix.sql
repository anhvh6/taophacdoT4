-- 1) Bảng danh sách các Vai trò (Roles)
create table if not exists roles (
  name text primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- 2) Bảng danh sách Quyền hạn (Permissions)
create table if not exists permissions (
  code text primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- 3) Bảng liên kết vai trò và quyền hạn (Role Permissions Mapping)
create table if not exists role_permissions (
  role_name text references roles(name) on delete cascade,
  permission_code text references permissions(code) on delete cascade,
  primary key (role_name, permission_code)
);

-- 4) RLS & Quyền truy cập cho các bảng phân quyền (Chỉ Super Admin được thao tác)
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;

drop policy if exists roles_admin_all on roles;
create policy roles_admin_all on roles for all to authenticated
  using (exists (select 1 from admin_users au where au.id = auth.uid() and au.role = 'super_admin'));

drop policy if exists permissions_admin_all on permissions;
create policy permissions_admin_all on permissions for all to authenticated
  using (exists (select 1 from admin_users au where au.id = auth.uid() and au.role = 'super_admin'));

drop policy if exists role_permissions_admin_all on role_permissions;
create policy role_permissions_admin_all on role_permissions for all to authenticated
  using (exists (select 1 from admin_users au where au.id = auth.uid() and au.role = 'super_admin'));

-- Cho phép các tài khoản admin khác đọc cấu hình quyền để kiểm tra quyền hạn ở client
drop policy if exists roles_read_all on roles;
create policy roles_read_all on roles for select to authenticated using (true);

drop policy if exists permissions_read_all on permissions;
create policy permissions_read_all on permissions for select to authenticated using (true);

drop policy if exists role_permissions_read_all on role_permissions;
create policy role_permissions_read_all on role_permissions for select to authenticated using (true);

-- Seed Roles
insert into roles (name, display_name) values
  ('super_admin', 'Super Admin'),
  ('coach', 'Manager / Coach'),
  ('staff', 'Operational Staff'),
  ('collaborator', 'Collaborator / Supporter')
on conflict (name) do update set display_name = excluded.display_name;

-- Seed Permissions
insert into permissions (code, display_name) values
  ('view_students', 'Xem học viên'),
  ('add_student', 'Thêm học viên mới'),
  ('edit_student', 'Sửa thông tin học viên'),
  ('delete_student', 'Xóa học viên'),
  ('restore_student', 'Khôi phục học viên'),
  ('view_plan', 'Xem phác đồ'),
  ('edit_plan', 'Sửa phác đồ học viên'),
  ('save_template', 'Lưu phác đồ mẫu'),
  ('view_devices', 'Xem thiết bị'),
  ('approve_device', 'Duyệt / Khóa thiết bị'),
  ('delete_device', 'Xóa vĩnh viễn thiết bị'),
  ('view_products', 'Xem sản phẩm'),
  ('manage_products', 'Thêm / Sửa / Xóa sản phẩm'),
  ('view_reports', 'Xem báo cáo truy cập'),
  ('view_financials', 'Xem doanh thu tài chính'),
  ('manage_admins', 'Quản lý tài khoản Admin'),
  ('system_settings', 'Cấu hình hệ thống')
on conflict (code) do update set display_name = excluded.display_name;

-- Seed Mapping
-- Super Admin: Full quyền
insert into role_permissions (role_name, permission_code)
select 'super_admin', code from permissions
on conflict do nothing;

-- Manager/Coach
insert into role_permissions (role_name, permission_code) values
  ('coach', 'view_students'),
  ('coach', 'add_student'),
  ('coach', 'edit_student'),
  ('coach', 'delete_student'),
  ('coach', 'restore_student'),
  ('coach', 'view_plan'),
  ('coach', 'edit_plan'),
  ('coach', 'save_template'),
  ('coach', 'view_devices'),
  ('coach', 'approve_device'),
  ('coach', 'view_products'),
  ('coach', 'view_reports')
on conflict do nothing;

-- Operational Staff (Không có các quyền view_reports, view_financials, manage_admins, system_settings)
insert into role_permissions (role_name, permission_code) values
  ('staff', 'view_students'),
  ('staff', 'add_student'),
  ('staff', 'edit_student'),
  ('staff', 'delete_student'),
  ('staff', 'restore_student'),
  ('staff', 'view_plan'),
  ('staff', 'edit_plan'),
  ('staff', 'save_template'),
  ('staff', 'view_devices'),
  ('staff', 'approve_device'),
  ('staff', 'view_products')
on conflict do nothing;

-- Collaborator
insert into role_permissions (role_name, permission_code) values
  ('collaborator', 'view_students'),
  ('collaborator', 'view_plan'),
  ('collaborator', 'view_devices'),
  ('collaborator', 'view_products'),
  ('collaborator', 'view_reports')
on conflict do nothing;
