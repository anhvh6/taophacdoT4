import { supabase } from '../lib/supabaseClient';
import { Role, Permission, RolePermission } from '../../types';

// Fallback seed values
const DEFAULT_ROLES: Role[] = [
  { name: 'super_admin', display_name: 'Super Admin' },
  { name: 'coach', display_name: 'Manager / Coach' },
  { name: 'staff', display_name: 'Operational Staff' },
  { name: 'collaborator', display_name: 'Collaborator / Supporter' }
];

const DEFAULT_PERMISSIONS: Permission[] = [
  { code: 'view_students', display_name: 'Xem học viên' },
  { code: 'add_student', display_name: 'Thêm học viên mới' },
  { code: 'edit_student', display_name: 'Sửa thông tin học viên' },
  { code: 'delete_student', display_name: 'Xóa học viên' },
  { code: 'restore_student', display_name: 'Khôi phục học viên' },
  { code: 'view_plan', display_name: 'Xem phác đồ' },
  { code: 'edit_plan', display_name: 'Sửa phác đồ học viên' },
  { code: 'save_template', display_name: 'Lưu phác đồ mẫu' },
  { code: 'view_devices', display_name: 'Xem thiết bị' },
  { code: 'approve_device', display_name: 'Duyệt / Khóa thiết bị' },
  { code: 'delete_device', display_name: 'Xóa vĩnh viễn thiết bị' },
  { code: 'view_products', display_name: 'Xem sản phẩm' },
  { code: 'manage_products', display_name: 'Thêm / Sửa / Xóa sản phẩm' },
  { code: 'view_reports', display_name: 'Xem báo cáo truy cập' },
  { code: 'view_financials', display_name: 'Xem doanh thu tài chính' },
  { code: 'manage_admins', display_name: 'Quản lý tài khoản Admin' },
  { code: 'system_settings', display_name: 'Cấu hình hệ thống' },
  { code: 'xem_bao_cao', display_name: 'xem báo cáo' }
];

const DEFAULT_ROLE_PERMISSIONS: RolePermission[] = [
  // Super Admin: all
  ...DEFAULT_PERMISSIONS.map(p => ({ role_name: 'super_admin', permission_code: p.code })),
  
  // Manager/Coach
  { role_name: 'coach', permission_code: 'view_students' },
  { role_name: 'coach', permission_code: 'add_student' },
  { role_name: 'coach', permission_code: 'edit_student' },
  { role_name: 'coach', permission_code: 'delete_student' },
  { role_name: 'coach', permission_code: 'restore_student' },
  { role_name: 'coach', permission_code: 'view_plan' },
  { role_name: 'coach', permission_code: 'edit_plan' },
  { role_name: 'coach', permission_code: 'save_template' },
  { role_name: 'coach', permission_code: 'view_devices' },
  { role_name: 'coach', permission_code: 'approve_device' },
  { role_name: 'coach', permission_code: 'view_products' },
  { role_name: 'coach', permission_code: 'view_reports' },

  // Operational Staff
  { role_name: 'staff', permission_code: 'view_students' },
  { role_name: 'staff', permission_code: 'add_student' },
  { role_name: 'staff', permission_code: 'edit_student' },
  { role_name: 'staff', permission_code: 'delete_student' },
  { role_name: 'staff', permission_code: 'restore_student' },
  { role_name: 'staff', permission_code: 'view_plan' },
  { role_name: 'staff', permission_code: 'edit_plan' },
  { role_name: 'staff', permission_code: 'save_template' },
  { role_name: 'staff', permission_code: 'view_devices' },
  { role_name: 'staff', permission_code: 'approve_device' },
  { role_name: 'staff', permission_code: 'view_products' },

  // Collaborator
  { role_name: 'collaborator', permission_code: 'view_students' },
  { role_name: 'collaborator', permission_code: 'view_plan' },
  { role_name: 'collaborator', permission_code: 'view_devices' },
  { role_name: 'collaborator', permission_code: 'view_products' },
  { role_name: 'collaborator', permission_code: 'view_reports' }
];

export const permissionService = {
  async getRoles(): Promise<Role[]> {
    try {
      const { data, error } = await supabase.from('roles').select('*').order('name');
      if (error) throw error;
      return (data && data.length > 0) ? data : DEFAULT_ROLES;
    } catch (e) {
      console.warn('Supabase getRoles failed, using fallback', e);
      const cached = localStorage.getItem('mega_roles_cache');
      return cached ? JSON.parse(cached) : DEFAULT_ROLES;
    }
  },

  async getPermissions(): Promise<Permission[]> {
    try {
      const { data, error } = await supabase.from('permissions').select('*').order('code');
      if (error) throw error;
      return (data && data.length > 0) ? data : DEFAULT_PERMISSIONS;
    } catch (e) {
      console.warn('Supabase getPermissions failed, using fallback', e);
      const cached = localStorage.getItem('mega_permissions_cache');
      if (cached) return JSON.parse(cached);
      
      localStorage.setItem('mega_permissions_cache', JSON.stringify(DEFAULT_PERMISSIONS));
      return DEFAULT_PERMISSIONS;
    }
  },

  async getRolePermissions(): Promise<RolePermission[]> {
    try {
      const { data, error } = await supabase.from('role_permissions').select('*');
      if (error) throw error;
      return (data && data.length > 0) ? data : DEFAULT_ROLE_PERMISSIONS;
    } catch (e) {
      console.warn('Supabase getRolePermissions failed, using fallback', e);
      const cached = localStorage.getItem('mega_role_permissions_cache');
      if (cached) return JSON.parse(cached);
      
      localStorage.setItem('mega_role_permissions_cache', JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
      return DEFAULT_ROLE_PERMISSIONS;
    }
  },

  async saveRolePermissions(mappings: RolePermission[]): Promise<boolean> {
    try {
      // 1. Delete all existing mapping
      const { error: delError } = await supabase.from('role_permissions').delete().neq('role_name', '');
      if (delError) throw delError;

      // 2. Insert new mapping
      if (mappings.length > 0) {
        const { error: insError } = await supabase.from('role_permissions').insert(mappings);
        if (insError) throw insError;
      }
      
      // Sync cache
      localStorage.setItem('mega_role_permissions_cache', JSON.stringify(mappings));
      return true;
    } catch (e) {
      console.error('Supabase saveRolePermissions failed, using localStorage', e);
      localStorage.setItem('mega_role_permissions_cache', JSON.stringify(mappings));
      return true;
    }
  },

  async addPermission(code: string, display_name: string): Promise<Permission | null> {
    const cleanCode = code.trim().toLowerCase();
    const newPerm: Permission = { code: cleanCode, display_name: display_name.trim() };
    
    try {
      const { data, error } = await supabase.from('permissions').insert(newPerm).select('*').single();
      if (error) throw error;
      
      // Auto assign to super_admin in DB
      await supabase.from('role_permissions').insert({ role_name: 'super_admin', permission_code: cleanCode });
      
      return data;
    } catch (e) {
      console.error('Supabase addPermission failed, using localStorage fallback', e);
      // Fallback
      const permissions = await this.getPermissions();
      if (permissions.some(p => p.code === cleanCode)) return null;
      
      const nextPerms = [...permissions, newPerm];
      localStorage.setItem('mega_permissions_cache', JSON.stringify(nextPerms));
      return newPerm;
    }
  },

  async deletePermission(code: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('permissions').delete().eq('code', code);
      if (error) throw error;
      
      // Sync cache
      const cached = localStorage.getItem('mega_permissions_cache');
      if (cached) {
        const perms: Permission[] = JSON.parse(cached);
        localStorage.setItem('mega_permissions_cache', JSON.stringify(perms.filter(p => p.code !== code)));
      }
      return true;
    } catch (e) {
      console.error('Supabase deletePermission failed', e);
      return false;
    }
  },

  async addRole(name: string, display_name: string): Promise<Role | null> {
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const newRole: Role = { name: cleanName, display_name: display_name.trim() };
    try {
      const { data, error } = await supabase.from('roles').insert(newRole).select('*').single();
      if (error) throw error;
      
      // Sync cache
      const cached = localStorage.getItem('mega_roles_cache');
      const roles = cached ? JSON.parse(cached) : DEFAULT_ROLES;
      if (!roles.some((r: Role) => r.name === cleanName)) {
        localStorage.setItem('mega_roles_cache', JSON.stringify([...roles, newRole]));
      }
      return data;
    } catch (e) {
      console.error('Supabase addRole failed, using localStorage fallback', e);
      return newRole;
    }
  },

  async deleteRole(name: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('roles').delete().eq('name', name);
      if (error) throw error;
      
      // Sync cache
      const cached = localStorage.getItem('mega_roles_cache');
      if (cached) {
        const roles: Role[] = JSON.parse(cached);
        localStorage.setItem('mega_roles_cache', JSON.stringify(roles.filter(r => r.name !== name)));
      }
      return true;
    } catch (e) {
      console.error('Supabase deleteRole failed', e);
      return false;
    }
  }
};
