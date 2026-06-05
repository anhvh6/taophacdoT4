import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card, Button, Modal, LineInput, Toast } from '../components/UI';
import { Plus, Shield, Check, Lock, Save, Key, Trash2 } from 'lucide-react';
import { Role, Permission, RolePermission } from '../types';
import { permissionService } from '../src/services/permissionService';

interface PermissionsManagementProps {
  onNavigate: (page: string, params?: any) => void;
  currentUserRole?: string;
}

export const PermissionsManagement: React.FC<PermissionsManagementProps> = ({ onNavigate, currentUserRole = 'super_admin' }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [mappings, setMappings] = useState<RolePermission[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPermCode, setNewPermCode] = useState('');
  const [newPermName, setNewPermName] = useState('');

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDisplayName, setNewRoleDisplayName] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, pData, mData] = await Promise.all([
        permissionService.getRoles(),
        permissionService.getPermissions(),
        permissionService.getRolePermissions()
      ]);
      setRoles(rData);
      setPermissions(pData);
      setMappings(mData);
    } catch (e) {
      console.error(e);
      setToastType('error');
      setToastMsg('Lỗi khi tải cấu hình phân quyền');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTogglePermission = (roleName: string, permCode: string) => {
    // Super Admin role must always have all permissions and cannot be modified to avoid lockout
    if (roleName === 'super_admin') return;

    setMappings(prev => {
      const exists = prev.some(m => m.role_name === roleName && m.permission_code === permCode);
      if (exists) {
        return prev.filter(m => !(m.role_name === roleName && m.permission_code === permCode));
      } else {
        return [...prev, { role_name: roleName, permission_code: permCode }];
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await permissionService.saveRolePermissions(mappings);
      if (success) {
        setToastType('success');
        setToastMsg('Lưu cấu hình phân quyền thành công!');
      } else {
        throw new Error('Save failed');
      }
    } catch (e) {
      console.error(e);
      setToastType('error');
      setToastMsg('Lưu thất bại. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPermCode || !newPermName) return;

    const cleanCode = newPermCode.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanCode) {
      setToastType('error');
      setToastMsg('Mã quyền không hợp lệ (chỉ chấp nhận chữ cái thường, số và gạch dưới)');
      return;
    }

    try {
      const created = await permissionService.addPermission(cleanCode, newPermName);
      if (created) {
        setToastType('success');
        setToastMsg(`Đã tạo thành công quyền "${newPermName}"!`);
        setIsModalOpen(false);
        setNewPermCode('');
        setNewPermName('');
        await loadData();
      } else {
        setToastType('error');
        setToastMsg('Quyền này đã tồn tại hoặc mã quyền không khả dụng.');
      }
    } catch (e) {
      console.error(e);
      setToastType('error');
      setToastMsg('Có lỗi xảy ra khi tạo quyền mới.');
    }
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName || !newRoleDisplayName) return;

    const cleanName = newRoleName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanName) {
      setToastType('error');
      setToastMsg('Mã vai trò không hợp lệ');
      return;
    }

    try {
      const created = await permissionService.addRole(cleanName, newRoleDisplayName);
      if (created) {
        setToastType('success');
        setToastMsg(`Đã tạo thành công vai trò "${newRoleDisplayName}"!`);
        setIsRoleModalOpen(false);
        setNewRoleName('');
        setNewRoleDisplayName('');
        await loadData();
      } else {
        setToastType('error');
        setToastMsg('Vai trò này đã tồn tại.');
      }
    } catch (e) {
      console.error(e);
      setToastType('error');
      setToastMsg('Có lỗi xảy ra khi tạo vai trò mới.');
    }
  };

  const handleDeletePermission = async (code: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa quyền "${code}"? Tất cả cấu hình phân quyền liên kết sẽ bị xóa.`)) {
      try {
        const success = await permissionService.deletePermission(code);
        if (success) {
          setToastType('success');
          setToastMsg('Xóa quyền thành công!');
          await loadData();
        } else {
          setToastType('error');
          setToastMsg('Xóa quyền thất bại.');
        }
      } catch (e) {
        console.error(e);
        setToastType('error');
        setToastMsg('Có lỗi xảy ra khi xóa quyền.');
      }
    }
  };

  const handleDeleteRole = async (name: string) => {
    const systemRoles = ['super_admin', 'coach', 'staff', 'collaborator'];
    if (systemRoles.includes(name)) {
      alert('Không thể xóa vai trò mặc định của hệ thống.');
      return;
    }

    if (confirm(`Bạn có chắc chắn muốn xóa vai trò "${name}"? Mọi phân quyền cho vai trò này sẽ bị hủy bỏ.`)) {
      try {
        const success = await permissionService.deleteRole(name);
        if (success) {
          setToastType('success');
          setToastMsg('Xóa vai trò thành công!');
          await loadData();
        } else {
          setToastType('error');
          setToastMsg('Xóa vai trò thất bại.');
        }
      } catch (e) {
        console.error(e);
        setToastType('error');
        setToastMsg('Có lỗi xảy ra khi xóa vai trò.');
      }
    }
  };

  const isChecked = (roleName: string, permCode: string) => {
    return mappings.some(m => m.role_name === roleName && m.permission_code === permCode);
  };

  return (
    <Layout
      title="QUẢN LÝ MA TRẬN PHÂN QUYỀN"
      onBack={() => onNavigate('dashboard')}
      actions={
        <div className="flex gap-2 shrink-0">
          {currentUserRole === 'super_admin' && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onNavigate('admin-users')}
              className="flex items-center gap-1.5"
            >
              <Shield size={14} /> Quản lý tài khoản
            </Button>
          )}
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => setIsRoleModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus size={14} /> Thêm vai trò mới
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus size={14} /> Thêm quyền mới
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleSave} 
            disabled={saving}
            className="flex items-center gap-1.5"
          >
            <Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </Button>
        </div>
      }
    >
      <div className="pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <Card className="overflow-hidden border border-blue-50/50 p-0 rounded-[2rem] shadow-sm">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-50/50 to-indigo-50/20 border-b border-blue-50">
                    <th className="p-6 font-black text-blue-900 uppercase tracking-widest text-[10px] w-[220px] sticky left-0 bg-slate-50/90 backdrop-blur-sm z-10 border-r border-blue-50/20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                      Vai trò \ Quyền hạn
                    </th>
                    {permissions.map(perm => (
                      <th 
                        key={perm.code} 
                        className="p-6 font-black text-blue-850 uppercase tracking-widest text-[9px] text-center border-l border-blue-50/30 group relative"
                        title={perm.code}
                      >
                        <div className="flex flex-col items-center gap-1 justify-center min-w-[120px] relative group/header">
                          <span className="text-[11px] font-black tracking-normal normal-case text-slate-700 pr-4">{perm.display_name}</span>
                          <span className="text-[8px] font-mono text-slate-400 font-medium select-all pr-4">{perm.code}</span>
                          
                          {/* Nút xóa quyền */}
                          <button
                            onClick={() => handleDeletePermission(perm.code)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-red-500 rounded hover:bg-red-50 transition-colors opacity-0 group-hover/header:opacity-100"
                            title="Xóa quyền này"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50/50">
                  {roles.map(role => (
                    <tr key={role.name} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-6 font-black text-blue-950 text-xs uppercase tracking-wider sticky left-0 bg-white group-hover:bg-slate-50 transition-colors shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] z-10 border-r border-blue-50/20">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Shield size={14} className={role.name === 'super_admin' ? "text-amber-500" : "text-blue-500"} />
                            <div>
                              <p className="font-extrabold text-[12px]">{role.display_name}</p>
                              <p className="text-[8px] font-mono text-slate-400 tracking-normal normal-case mt-0.5">{role.name}</p>
                            </div>
                          </div>
                          
                          {/* Nút xóa vai trò */}
                          {!['super_admin', 'coach', 'staff', 'collaborator'].includes(role.name) && (
                            <button
                              onClick={() => handleDeleteRole(role.name)}
                              className="p-1 text-slate-300 hover:text-red-500 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                              title="Xóa vai trò này"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                      {permissions.map(perm => {
                        const checked = isChecked(role.name, perm.code);
                        const disabled = role.name === 'super_admin';
                        return (
                          <td 
                            key={perm.code} 
                            onClick={() => !disabled && handleTogglePermission(role.name, perm.code)}
                            className={`p-6 text-center border-l border-blue-50/30 transition-all ${disabled ? 'bg-amber-50/10 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50/30'}`}
                          >
                            <div className="flex items-center justify-center">
                              {disabled ? (
                                <div className="w-5 h-5 rounded-md bg-amber-100 flex items-center justify-center text-amber-600 border border-amber-200">
                                  <Lock size={10} />
                                </div>
                              ) : (
                                <div className={`w-5.5 h-5.5 rounded-lg border flex items-center justify-center transition-all ${checked ? 'bg-emerald-500 border-emerald-600 shadow-sm text-white' : 'border-slate-300 bg-white hover:border-blue-400'}`}>
                                  {checked && <Check size={12} className="stroke-[3.5]" />}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Add Permission Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="THÊM QUYỀN HẠN MỚI (CỘT MỚI)"
      >
        <form onSubmit={handleAddPermission} className="flex flex-col gap-5">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed mb-1">
            Quyền mới sẽ tự động sinh ra một cột tương ứng trên bảng ma trận phân quyền để bạn cấp phép cho các vai trò.
          </p>
          <LineInput
            label="Mã quyền (Viết thường, không dấu, dùng gạch dưới)"
            placeholder="ví dụ: approve_email, manage_videos"
            value={newPermCode}
            onChange={(e) => setNewPermCode(e.target.value)}
            required
            icon={<Key size={14} />}
          />
          <LineInput
            label="Tên hiển thị quyền hạn"
            placeholder="ví dụ: Duyệt đổi email, Quản lý video bài tập"
            value={newPermName}
            onChange={(e) => setNewPermName(e.target.value)}
            required
          />
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              HỦY
            </Button>
            <Button variant="primary" size="sm" type="submit">
              THÊM QUYỀN
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Role Modal */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title="THÊM VAI TRÒ MỚI (DÒNG MỚI)"
      >
        <form onSubmit={handleAddRole} className="flex flex-col gap-5">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed mb-1">
            Vai trò mới sẽ tự động sinh ra một hàng tương ứng trên bảng ma trận phân quyền để bạn cấp phép.
          </p>
          <LineInput
            label="Mã vai trò (Viết thường, không dấu, dùng gạch dưới)"
            placeholder="ví dụ: key_account, cskh"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            required
            icon={<Key size={14} />}
          />
          <LineInput
            label="Tên hiển thị vai trò"
            placeholder="ví dụ: Quản lý khách hàng VIP, Nhân viên CSKH"
            value={newRoleDisplayName}
            onChange={(e) => setNewRoleDisplayName(e.target.value)}
            required
          />
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsRoleModalOpen(false)}>
              HỦY
            </Button>
            <Button variant="primary" size="sm" type="submit">
              THÊM VAI TRÒ
            </Button>
          </div>
        </form>
      </Modal>

      {toastMsg && (
        <Toast 
          message={toastMsg} 
          variant={toastType} 
          onClose={() => setToastMsg(null)} 
        />
      )}
    </Layout>
  );
};
