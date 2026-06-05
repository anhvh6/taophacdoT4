import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Card, Button, LineInput, Modal } from '../components/UI';
import { Plus, Edit2, Trash2, Key, ShieldAlert, Shield, RefreshCw, Mail, Lock, CheckCircle, ChevronLeft } from 'lucide-react';
import { adminUserService } from '../src/services/adminUserService';
import { permissionService } from '../src/services/permissionService';
import { AdminUser, Role } from '../types';
import { formatDDMMYYYY } from '../utils/date';

interface AdminUsersManagementProps {
  onNavigate: (page: string, params?: any) => void;
}

export const AdminUsersManagement: React.FC<AdminUsersManagementProps> = ({ onNavigate }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // States cho Modal Tạo mới / Chỉnh sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Tải dữ liệu ban đầu
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [userList, roleList] = await Promise.all([
        adminUserService.getAdminUsers(),
        permissionService.getRoles()
      ]);
      setUsers(userList);
      setRoles(roleList);
      
      // Mặc định chọn vai trò đầu tiên nếu có
      if (roleList.length > 0) {
        setRole(roleList[0].name);
      }
    } catch (e) {
      setError('Không thể tải danh sách tài khoản hoặc vai trò.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Kích hoạt Toast tự tắt
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // Mở modal tạo mới
  const handleOpenCreate = () => {
    setEditingUser(null);
    setEmail('');
    setPassword('');
    if (roles.length > 0) setRole(roles[0].name);
    setIsModalOpen(true);
  };

  // Mở modal chỉnh sửa
  const handleOpenEdit = (user: AdminUser) => {
    setEditingUser(user);
    setEmail(user.email || '');
    setPassword(''); // Mật khẩu để trống (chỉ nhập khi muốn đổi)
    setRole(user.role);
    setIsModalOpen(true);
  };

  // Lưu tài khoản (Tạo mới hoặc Cập nhật)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      alert('Vui lòng nhập Email/Tên đăng nhập!');
      return;
    }
    if (!editingUser && !password) {
      alert('Vui lòng nhập mật khẩu khởi tạo!');
      return;
    }

    setSubmitting(true);
    try {
      if (editingUser) {
        // Không cho phép hạ cấp tài khoản anhvh@gmail.com
        if (editingUser.email === 'anhvh@gmail.com' && role !== 'super_admin') {
          alert('Không thể hạ cấp vai trò của Quản trị viên cấp cao nhất này!');
          setSubmitting(false);
          return;
        }

        // Cập nhật tài khoản
        const updateData: { email?: string; password?: string; role?: string } = {
          role
        };
        if (email !== editingUser.email) updateData.email = email;
        if (password.trim()) updateData.password = password;

        const result = await adminUserService.updateAdminUser(editingUser.id, updateData);
        if (result.success) {
          showToast('Đã cập nhật thông tin tài khoản thành công!');
          setIsModalOpen(false);
          loadData();
        } else {
          alert(`Lỗi: ${result.error}`);
        }
      } else {
        // Tạo tài khoản mới
        const result = await adminUserService.createAdminUser(email, password, role);
        if (result.success) {
          showToast('Đã tạo tài khoản admin mới thành công!');
          setIsModalOpen(false);
          loadData();
        } else {
          alert(`Lỗi: ${result.error}`);
        }
      }
    } catch (e: any) {
      alert(`Đã xảy ra lỗi: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Xóa tài khoản
  const handleDelete = async (user: AdminUser) => {
    if (user.email === 'anhvh@gmail.com') {
      alert('Đây là tài khoản Quản trị viên cấp cao nhất, không thể xóa!');
      return;
    }

    if (confirm(`Bạn có chắc chắn muốn xóa tài khoản ${user.email || 'không có email'}? Hành động này không thể hoàn tác.`)) {
      try {
        const result = await adminUserService.deleteAdminUser(user.id);
        if (result.success) {
          showToast('Đã xóa tài khoản admin thành công!');
          loadData();
        } else {
          alert(`Lỗi: ${result.error}`);
        }
      } catch (e: any) {
        alert(`Không thể xóa: ${e.message}`);
      }
    }
  };

  // Chuyển đổi tên hiển thị quyền
  const getRoleDisplayName = (roleName: string) => {
    const found = roles.find(r => r.name === roleName);
    return found ? found.display_name : roleName;
  };

  // Gán màu sắc badge cho từng vai trò
  const getRoleBadgeStyle = (roleName: string) => {
    switch (roleName) {
      case 'super_admin':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'coach':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'operational_staff':
      case 'staff':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <Layout 
      title={
        <div className="flex items-center gap-2">
          <Shield className="text-blue-600 w-5 h-5" />
          <span className="uppercase font-black text-blue-900 tracking-tight">QUẢN LÝ TÀI KHOẢN ADMIN</span>
        </div>
      }
      onBack={() => onNavigate('dashboard')}
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => onNavigate('permissions')}>
            <ChevronLeft size={16} className="mr-1" /> MA TRẬN PHÂN QUYỀN
          </Button>
          <Button variant="primary" size="sm" onClick={handleOpenCreate}>
            <Plus size={14} className="mr-1.5" /> Thêm Admin mới
          </Button>
        </div>
      }
    >
      <div className="max-w-6xl mx-auto py-2">
        {toast && (
          <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CheckCircle size={18} className="text-emerald-400" />
            <span className="text-sm font-semibold">{toast}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-3xl border border-red-100 flex items-center gap-3">
            <ShieldAlert size={20} className="text-red-500 shrink-0" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        )}

        <Card className="overflow-hidden border border-blue-100/50 shadow-lg shadow-blue-50/20 rounded-[2rem]">
          <div className="p-6 border-b border-blue-50 bg-gradient-to-r from-blue-50/20 to-white">
            <h3 className="text-base font-black text-blue-900 uppercase tracking-widest">Danh sách tài khoản quản trị</h3>
            <p className="text-xs text-gray-500 mt-1">Danh sách nhân viên, huấn luyện viên có quyền đăng nhập vào công cụ Admin này.</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <RefreshCw size={36} className="animate-spin text-blue-600" />
              <p className="text-blue-950 font-bold uppercase tracking-widest text-xs">Đang tải tài khoản...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-gray-400 italic text-sm">Chưa có tài khoản admin nào được khởi tạo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider w-16">STT</th>
                    <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider">Tên đăng nhập (Email)</th>
                    <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider w-56">Quyền hạn</th>
                    <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider w-40">Ngày tạo</th>
                    <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider w-28 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user, idx) => (
                    <tr key={user.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-4 px-6 text-sm font-bold text-slate-400">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                            {(user.email || 'AD').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-bold text-slate-800">{user.email || 'Không có email'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${getRoleBadgeStyle(user.role)}`}>
                          {getRoleDisplayName(user.role)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm font-semibold text-slate-500">
                        {formatDDMMYYYY(user.created_at)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => handleOpenEdit(user)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Sửa thông tin / Gán quyền"
                          >
                            <Edit2 size={15} />
                          </button>
                          {user.email !== 'anhvh@gmail.com' ? (
                            <button 
                              onClick={() => handleDelete(user)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              title="Xóa tài khoản"
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : (
                            <div className="p-2 text-slate-300 cursor-not-allowed" title="Tài khoản hệ thống không thể xóa">
                              <Lock size={14} className="text-slate-400" />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Modal Popup Tạo / Sửa Admin */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'CẬP NHẬT TÀI KHOẢN ADMIN' : 'THÊM ADMIN MỚI'}
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={submitting}>
              HỦY BỎ
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin mr-1.5" />
                  Đang lưu...
                </>
              ) : (
                'LƯU TÀI KHOẢN'
              )}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSave} className="space-y-6 py-2">
          {/* Nhập Email */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-blue-600 uppercase tracking-widest">
              Tên đăng nhập (Email)
            </label>
            <div className="relative">
              <Mail className="absolute left-0 top-3 text-slate-400 w-4 h-4" />
              <input
                type="email"
                required
                className="line-input pl-6 w-full text-sm font-bold text-slate-800"
                placeholder="nhanvien@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Nhập Mật khẩu */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-blue-600 uppercase tracking-widest">
              {editingUser ? 'Mật khẩu mới (Để trống nếu giữ nguyên)' : 'Mật khẩu khởi tạo'}
            </label>
            <div className="relative">
              <Lock className="absolute left-0 top-3 text-slate-400 w-4 h-4" />
              <input
                type="password"
                required={!editingUser}
                className="line-input pl-6 w-full text-sm font-bold text-slate-800"
                placeholder={editingUser ? '••••••••' : 'Nhập mật khẩu ít nhất 6 ký tự'}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Chọn quyền */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-blue-600 uppercase tracking-widest">
              Gán vai trò / Quyền hạn
            </label>
            <div className="relative">
              <Shield className="absolute left-0 top-3 text-slate-400 w-4 h-4" />
              <select
                className="line-input pl-6 w-full text-sm font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                value={role}
                onChange={e => setRole(e.target.value)}
              >
                {roles.map(r => (
                  <option key={r.name} value={r.name}>
                    {r.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};
