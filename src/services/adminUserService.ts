import { supabase } from '../lib/supabaseClient';
import { AdminUser } from '../../types';

// Fallback Mock data
const DEFAULT_ADMINS: AdminUser[] = [
  { id: 'mock-1', email: 'admin@example.com', role: 'super_admin', created_at: new Date().toISOString() }
];

export const adminUserService = {
  async getAdminUsers(): Promise<AdminUser[]> {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Lỗi khi lấy danh sách admin từ Supabase, chuyển sang chế độ dự phòng:', e);
      const cached = localStorage.getItem('mega_admin_users_cache');
      return cached ? JSON.parse(cached) : DEFAULT_ADMINS;
    }
  },

  async createAdminUser(email: string, password: string, role: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('manage-admin-users', {
        body: { action: 'create', email, password, role }
      });

      if (error) throw error;
      if (data && data.error) throw new Error(data.error);

      // Đồng bộ cache local nếu thành công
      const admins = await this.getAdminUsers();
      const updated = [
        { id: data.userId || `mock-${Date.now()}`, email, role, created_at: new Date().toISOString() },
        ...admins
      ];
      localStorage.setItem('mega_admin_users_cache', JSON.stringify(updated));

      return { success: true, userId: data.userId };
    } catch (e: any) {
      console.error('Lỗi khi tạo tài khoản admin:', e);
      // Fallback
      if (import.meta.env.DEV) {
        const admins = await this.getAdminUsers();
        const nextId = `mock-${Date.now()}`;
        const updated = [{ id: nextId, email, role, created_at: new Date().toISOString() }, ...admins];
        localStorage.setItem('mega_admin_users_cache', JSON.stringify(updated));
        return { success: true, userId: nextId };
      }
      return { success: false, error: e.message || 'Không thể tạo tài khoản' };
    }
  },

  async updateAdminUser(userId: string, updateData: { email?: string; password?: string; role?: string }): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('manage-admin-users', {
        body: { action: 'update', userId, ...updateData }
      });

      if (error) throw error;
      if (data && data.error) throw new Error(data.error);

      // Cập nhật cache local
      const admins = await this.getAdminUsers();
      const updated = admins.map(a => {
        if (a.id === userId) {
          return {
            ...a,
            email: updateData.email || a.email,
            role: updateData.role || a.role
          };
        }
        return a;
      });
      localStorage.setItem('mega_admin_users_cache', JSON.stringify(updated));

      return { success: true };
    } catch (e: any) {
      console.error('Lỗi khi cập nhật tài khoản admin:', e);
      // Fallback
      if (import.meta.env.DEV) {
        const admins = await this.getAdminUsers();
        const updated = admins.map(a => {
          if (a.id === userId) {
            return {
              ...a,
              email: updateData.email || a.email,
              role: updateData.role || a.role
            };
          }
          return a;
        });
        localStorage.setItem('mega_admin_users_cache', JSON.stringify(updated));
        return { success: true };
      }
      return { success: false, error: e.message || 'Không thể cập nhật tài khoản' };
    }
  },

  async deleteAdminUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('manage-admin-users', {
        body: { action: 'delete', userId }
      });

      if (error) throw error;
      if (data && data.error) throw new Error(data.error);

      // Xóa trong cache local
      const admins = await this.getAdminUsers();
      const updated = admins.filter(a => a.id !== userId);
      localStorage.setItem('mega_admin_users_cache', JSON.stringify(updated));

      return { success: true };
    } catch (e: any) {
      console.error('Lỗi khi xóa tài khoản admin:', e);
      // Fallback
      if (import.meta.env.DEV) {
        const admins = await this.getAdminUsers();
        const updated = admins.filter(a => a.id !== userId);
        localStorage.setItem('mega_admin_users_cache', JSON.stringify(updated));
        return { success: true };
      }
      return { success: false, error: e.message || 'Không thể xóa tài khoản' };
    }
  }
};
