
import { Search, UserPlus, Users, Calendar, ExternalLink, Edit2, Copy, Package, Clock, AlertTriangle, CheckCircle, Archive, Zap, CopyPlus, UserCircle, Filter, Eraser, AlertCircle, X, Plus, Mail, MapPin, Truck, FileWarning, User, Play, List, ChevronDown, ChevronRight, ChevronLeft, Trash2, RefreshCw, ShoppingBag, Phone, ClipboardList, BookOpen, LogOut, BarChart3, Bell } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Card, Button, LineInput, Modal, Toast } from '../components/UI';
import { DateInput } from '../components/DateInput';
import { api } from '../services/api'; 
import { generateCustomerLink, customerService } from '../src/services/customerService';
import { Customer, CustomerStatus, Product } from '../types';
import { calcRevenueCostProfit, isChuaGan, buildProductMap, getProfitMonth } from '../utils/finance';
import { formatDDMM, formatDDMMYYYY, toISODateKey, parseVNDate, getDiffDays } from '../utils/date';
import { ProfitChartModal } from '../components/ProfitChartModal';

const formatVND = (num: number) => new Intl.NumberFormat('vi-VN').format(num);


const Toggle: React.FC<{ checked: boolean; onChange: (val: boolean) => void; color?: string }> = ({ checked, onChange, color = 'peer-checked:bg-green-500' }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${color}`}></div>
  </label>
);

interface CustomerCardProps {
  customer: Customer;
  products: Product[];
  productMap?: Map<string, Product>;
  onEdit: (id: string) => void;
  onPreview: (id: string, token?: string) => void;
  onDuplicate: (id: string) => void;
  onCopyPlan: (id: string) => void;
  onDetail: (id: string) => void;
  onCopyLink: (link: string, customer?: Customer) => void;
  onCopyName: (name: string) => void;
  groupColor: string;
  groupIcon: any;
}

const getCategory = (c: Customer, products: Product[], productMap?: Map<string, Product>): 'orange' | 'green' | 'gray' | 'brown' | null => {
  const fin = calcRevenueCostProfit(c, products, productMap);
  const isUnassigned = String(c.trang_thai ?? '') === '0';
  const isAssigned = String(c.trang_thai ?? '') === '1';
  const emailEmpty = !c.email || String(c.email).trim() === '';
  const addressEmpty = !c.dia_chi || String(c.dia_chi).trim() === '';
  const mvdEmpty = !c.ma_vd || String(c.ma_vd).trim() === '';
  const hasCost = (fin.revenue - fin.profit) !== 0;

  if (isUnassigned && emailEmpty) return 'orange';
  if (isUnassigned && !emailEmpty) return 'green';
  if (isAssigned && addressEmpty && hasCost) return 'gray';
  if (isAssigned && mvdEmpty && !addressEmpty && hasCost) return 'brown';
  
  return null;
};

const CustomerCardBase: React.FC<CustomerCardProps> = ({ customer, products, productMap, onEdit, onPreview, onDuplicate, onCopyPlan, onDetail, onCopyLink, onCopyName, groupColor, groupIcon: GroupIcon }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const start = parseVNDate(customer.start_date) || new Date();
  const end = parseVNDate(customer.end_date);
  
  const currentDay = getDiffDays(start, today) + 1;
  let daysLeft = 0;
  if (end) {
    const diff = end.getTime() - today.getTime();
    daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
  } else {
    daysLeft = (customer.duration_days || 30) - (currentDay > 0 ? currentDay : 0);
  }

  const formattedStart = formatDDMM(customer.start_date);
  const hasPlan = !!customer.video_date && String(customer.video_date).trim() !== "";
  
  const category = getCategory(customer, products, productMap);

  let StatusIcon = GroupIcon;
  let iconColorClass = "text-blue-500";
  let iconBgClass = "bg-blue-100/50";
  let cardBorderClass = "border-blue-100";
  let cardGradientClass = "bg-gradient-to-r from-blue-50/40 to-white";

  if (customer.status === CustomerStatus.DELETED) {
    StatusIcon = Trash2;
    iconColorClass = "text-gray-400";
    iconBgClass = "bg-gray-100";
    cardBorderClass = "border-gray-200";
    cardGradientClass = "bg-gray-50";
  } else if (!hasPlan) {
    StatusIcon = FileWarning; 
    iconColorClass = "text-red-500";
    iconBgClass = "bg-red-100";
    cardBorderClass = "border-red-200";
    cardGradientClass = "bg-gradient-to-r from-red-50/60 to-white";
  } else if (category === 'orange') {
    StatusIcon = Mail; 
    iconColorClass = "text-orange-600";
    iconBgClass = "bg-orange-100";
    cardBorderClass = "border-orange-200";
    cardGradientClass = "bg-gradient-to-r from-orange-50/60 to-white";
  } else if (category === 'green') {
    StatusIcon = Play; 
    iconColorClass = "text-green-600";
    iconBgClass = "bg-green-100";
    cardBorderClass = "border-green-200";
    cardGradientClass = "bg-gradient-to-r from-green-50/60 to-white";
  } else if (category === 'gray') {
    StatusIcon = MapPin; 
    iconColorClass = "text-slate-600";
    iconBgClass = "bg-slate-200";
    cardBorderClass = "border-slate-300";
    cardGradientClass = "bg-gradient-to-r from-slate-50 to-white";
  } else if (category === 'brown') {
    StatusIcon = Truck; 
    iconColorClass = "text-amber-800";
    iconBgClass = "bg-amber-100";
    cardBorderClass = "border-amber-300";
    cardGradientClass = "bg-gradient-to-r from-amber-50/60 to-white";
  } else {
    StatusIcon = GroupIcon;
    iconColorClass = groupColor;
    iconBgClass = groupColor.replace('text-', 'bg-').replace('600', '100').replace('500', '100').replace('400', '100');
    cardBorderClass = groupColor.replace('text-', 'border-').replace('600', '100').replace('500', '100').replace('400', '100');
    cardGradientClass = "bg-gradient-to-r from-blue-50/40 to-white";
  }

  const handleCardClick = () => {
    if (customer.status === CustomerStatus.DELETED) onEdit(customer.customer_id);
    else if (hasPlan) onPreview(customer.customer_id, customer.token);
    else onEdit(customer.customer_id);
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`relative flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 ${cardGradientClass} rounded-[1.5rem] transition-all hover:shadow-xl hover:-translate-y-1 group cursor-pointer shadow-sm overflow-hidden`}
    >
      <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="flex items-center gap-4 w-full sm:w-auto">
        <div 
          onClick={(e) => { e.stopPropagation(); onDetail(customer.customer_id); }}
          className={`relative z-10 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex-shrink-0 flex items-center justify-center ${iconBgClass} ${iconColorClass} shadow-inner transition-transform group-hover:scale-105 active:scale-95`}
          title="Quản lý chi tiết học viên"
        >
          <StatusIcon size={24} strokeWidth={1.5} />
        </div>
        <div className="relative z-10 flex-1 min-w-0 sm:hidden">
          <h4 
            onClick={(e) => { e.stopPropagation(); onCopyName(customer.customer_name); }}
            className="text-[14px] font-extrabold text-[#1E3A8A] truncate uppercase tracking-tight hover:text-blue-600 transition-colors"
          >
            {customer.customer_name}
          </h4>
        </div>
      </div>
      <div className="relative z-10 flex-1 min-w-0 w-full">
        <div className="hidden sm:flex items-center gap-2 mb-1">
          <h4 
            onClick={(e) => { e.stopPropagation(); onCopyName(customer.customer_name); }}
            className="text-[14px] font-extrabold text-[#1E3A8A] truncate uppercase tracking-tight hover:text-blue-600 transition-colors"
          >
            {customer.customer_name}
          </h4>
        </div>
        <div className="flex flex-col gap-2">
          {/* Dòng 1: Thông tin về ngày */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/60 px-2 py-0.5 rounded-lg border border-white/50 shadow-sm">
              <Calendar size={11} className="text-blue-400" />
              <span className="text-[10px] text-gray-500 font-bold">{formattedStart}</span>
            </div>
            {customer.status !== CustomerStatus.DELETED && (
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border shadow-sm ${daysLeft < 0 ? 'bg-red-50 text-red-500 border-red-100' : daysLeft <= 5 ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                 <span className="text-[10px] font-black uppercase tracking-tighter">
                   {currentDay > 0 ? currentDay : 0}/{daysLeft < 0 ? 'HH' : `${daysLeft}D`}
                 </span>
              </div>
            )}
            {customer.status === CustomerStatus.DELETED && (
              <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500">Đã xóa</span>
            )}
          </div>

          {/* Dòng 2: Số tiền và các icon chức năng */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 bg-white/60 px-2 py-0.5 rounded-lg border border-white/50 shadow-sm">
              <ShoppingBag size={11} className="text-emerald-500" />
              <span className="text-[10px] text-emerald-700 font-bold">{formatVND(customer.gia_tien || 0)}</span>
            </div>

            <div className="flex items-center gap-1">
              {hasPlan && customer.status !== CustomerStatus.DELETED && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); onCopyLink(customer.link, customer); }} className="w-7 h-7 flex items-center justify-center text-blue-600 bg-white/80 hover:bg-blue-600 hover:text-white rounded-lg transition-all shadow-sm border border-blue-50 active:scale-90"><Copy size={12} /></button>
                  <button 
                    onMouseEnter={() => api.getPlanEditorData(undefined, customer.customer_id)}
                    onClick={(e) => { e.stopPropagation(); onDuplicate(customer.customer_id); }} 
                    className="w-7 h-7 flex items-center justify-center text-orange-600 bg-white/80 hover:bg-orange-600 hover:text-white rounded-lg transition-all shadow-sm border border-orange-50 active:scale-90"
                  >
                    <CopyPlus size={12} />
                  </button>
                </>
              )}
              {!hasPlan && customer.status !== CustomerStatus.DELETED && (
                <button 
                  onMouseEnter={() => api.getPlanEditorData(undefined, customer.customer_id)}
                  onClick={(e) => { e.stopPropagation(); onCopyPlan(customer.customer_id); }} 
                  className="w-7 h-7 flex items-center justify-center text-orange-600 bg-white/80 hover:bg-orange-600 hover:text-white rounded-lg transition-all shadow-sm border border-orange-50 active:scale-90"
                  title="Copy phác đồ từ học viên khác"
                >
                  <ClipboardList size={12} />
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); onEdit(customer.customer_id); }} className="w-7 h-7 flex items-center justify-center text-green-600 bg-white/80 hover:bg-green-600 hover:text-white rounded-lg transition-all shadow-sm border border-green-50 active:scale-90"><Edit2 size={12} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


const CustomerCard = React.memo(CustomerCardBase, (prev, next) => {
  return prev.customer === next.customer && prev.productMap === next.productMap;
});

const GroupHeader: React.FC<{ icon: any; title: string; count: number; colorClass: string; isCollapsed: boolean; onToggle: () => void }> = ({ icon: Icon, title, count, colorClass, isCollapsed, onToggle }) => (
  <div 
    onClick={onToggle}
    className={`flex items-center justify-between mb-5 mt-12 first:mt-0 ${colorClass} cursor-pointer hover:opacity-80 transition-all select-none group`}
  >
    <div className="flex items-center gap-3">
      <div className="w-1.5 h-6 bg-current opacity-30 rounded-full"></div>
      <Icon size={22} strokeWidth={3} className="opacity-80" />
      <h3 className="text-[14px] font-black uppercase tracking-[0.15em] flex items-center">
        {title} <span className="ml-2 px-2 py-0.5 bg-current/10 rounded-lg text-[11px]">{count}</span>
      </h3>
    </div>
    <div className="p-1 rounded-full group-hover:bg-current/10 transition-colors">
      {isCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
    </div>
  </div>
);

export const Dashboard: React.FC<{ 
  onNavigate: (page: string, params?: any) => void; 
  initialAction?: string;
  filterStatus?: string;
  customers: Customer[];
  products: Product[];
  loading: boolean;
  onRefresh: () => void;
  onUpsert: (payload: Partial<Customer>) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
  onLogout: () => void;
}> = ({ onNavigate, initialAction, filterStatus, customers, products, loading, onRefresh, onUpsert, onDelete, onLogout }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [videoOpenFilter, setVideoOpenFilter] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    'expired': true,
    'deleted': true
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [targetCustomerId, setTargetCustomerId] = useState<string | null>(null);
  const [copySearchTerm, setCopySearchTerm] = useState("");
  const [isCopying, setIsCopying] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [isProfitModalOpen, setIsProfitModalOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [viewedCustomerIds, setViewedCustomerIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('admin_viewed_notifications');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
      return new Set();
    }
  });
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);
  const [customerDevices, setCustomerDevices] = useState<any[]>([]);
  const [draftDevices, setDraftDevices] = useState<Record<string, boolean>>({});
  const [draftEmailApproved, setDraftEmailApproved] = useState(false);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [handledCustomerIds, setHandledCustomerIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('admin_handled_notifications');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
      return new Set();
    }
  });

  const prevPendingRef = React.useRef<string[]>([]);
  const isFirstLoadRef = React.useRef(true);

  const fetchPending = async () => {
    try {
      const [devices, emails] = await Promise.all([
        customerService.getPendingDeviceRequests(),
        customerService.getPendingEmailRequests()
      ]);
      
      const combined = [
        ...devices.map(d => ({ ...d, type: 'device' })),
        ...emails.map(e => ({ ...e, type: 'email' }))
      ].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const currentIds = combined.map(r => `${r.type}_${r.id || r.customer_id}_${r.created_at || r.updated_at || ''}_${r.pending_email || ''}`);
      const newItems = combined.filter(r => !prevPendingRef.current.includes(`${r.type}_${r.id || r.customer_id}_${r.created_at || r.updated_at || ''}_${r.pending_email || ''}`));

      if (!isFirstLoadRef.current && newItems.length > 0) {
        setToast(`🔔 Có ${newItems.length} yêu cầu duyệt mới!`);
        
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          newItems.forEach(item => {
            const name = item.type === 'device' ? (item.customers?.customer_name || 'Học viên ẩn') : (item.customer_name || 'Học viên ẩn');
            const msg = item.type === 'device' ? 'Yêu cầu duyệt thiết bị mới' : `Yêu cầu đổi sang email: ${item.pending_email}`;
            new Notification(`🔔 Yêu cầu mới từ ${name}`, {
              body: msg,
              icon: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg'
            });
          });
        }
      }

      isFirstLoadRef.current = false;
      prevPendingRef.current = currentIds;
      setPendingRequests(combined);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    fetchPending();
    const timer = setInterval(fetchPending, 10000); 
    return () => clearInterval(timer);
  }, []);

  const handleCopyPlan = (id: string) => {
    setTargetCustomerId(id);
    setIsCopyModalOpen(true);
  };

  const handleCopyName = (name: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(name).then(() => {
        setToast("Đã copy tên học viên!");
      }).catch(() => {
        fallbackCopyName(name);
      });
    } else {
      fallbackCopyName(name);
    }
  };

  const fallbackCopyName = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setToast("Đã copy tên học viên!");
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
  };

  const handleAddStudent = () => {
    // If we're already in the middle of editing/adding (modal open), don't reset everything
    // unless it's the very first time we're opening it for a new student.
    if (isAddModalOpen && formData.customer_name) return;

    let defaultProducts: any[] = [];
    let defaultTotal = 0;
    
    // Default product ID: SP1768731546380
    const targetProductId = 'SP1768731546380';
    const defaultProduct = products.find(p => p.id_sp === targetProductId && p.trang_thai === 1) 
      || products.find(p => p.trang_thai === 1);

    if (defaultProduct) {
      defaultProducts = [{ 
        id_sp: defaultProduct.id_sp, 
        ten_sp: defaultProduct.ten_sp, 
        so_luong: 1, 
        don_gia: defaultProduct.gia_ban, 
        gia_nhap: defaultProduct.gia_nhap, 
        thanh_tien: defaultProduct.gia_ban 
      }];
      defaultTotal = defaultProduct.gia_ban;
    }

    setFormData({
      customer_name: '',
      sdt: '',
      email: '',
      dia_chi: '',
      ma_vd: '',
      trang_thai_gan: '0', // Match DB default
      trang_thai: 0,
      start_date: toISODateKey(new Date()),
      duration_days: 30,
      san_pham: defaultProducts,
      gia_tien: defaultTotal,
      status: CustomerStatus.ACTIVE,
      link: '',
      video_date: null
    });
    setIsAddModalOpen(true);
    setShowProductDropdown(false);
  };

  const handleSave = async () => {
    if (!formData.customer_name) {
      alert("Vui lòng nhập tên học viên!");
      return;
    }
    
    setIsSaving(true);
    try {
      // App.tsx đã thực hiện optimistic update nên UI sẽ cập nhật ngay lập tức.
      // Ta đóng modal ngay để tạo cảm giác tốc độ tức thì cho người dùng.
      onUpsert(formData).then(() => {
        onNavigate('dashboard', { toast: "Đã lưu học viên mới thành công!" });
      }).catch(e => {
        console.error("Lỗi khi lưu dữ liệu ngầm:", e);
        onNavigate('dashboard', { toast: "Lỗi: Không thể lưu học viên mới!" });
      });
      
      setIsAddModalOpen(false);
    } catch (e) {
      console.error("Lỗi khi xử lý lưu:", e);
      onNavigate('dashboard', { toast: "Lỗi hệ thống khi lưu!" });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleProduct = (product: Product) => {
    const current = formData.san_pham || [];
    const exists = current.find(p => p.id_sp === product.id_sp);
    let newItems;
    if (exists) {
      newItems = current.map(p => {
        if (p.id_sp === product.id_sp) {
          const nextQty = (p.so_luong || 1) + 1;
          return { ...p, so_luong: nextQty, thanh_tien: nextQty * p.don_gia };
        }
        return p;
      });
    } else {
      newItems = [...current, { 
        id_sp: product.id_sp, ten_sp: product.ten_sp, so_luong: 1, 
        don_gia: product.gia_ban, gia_nhap: product.gia_nhap, thanh_tien: product.gia_ban 
      }];
    }
    const total = newItems.reduce((acc, curr) => acc + curr.thanh_tien, 0);
    setFormData({ ...formData, san_pham: newItems, gia_tien: total });
    setShowProductDropdown(false);
  };

  const updateProductQty = (id: string, qty: number) => {
    const newItems = (formData.san_pham || []).map(p => {
      if (p.id_sp === id) { 
        const q = Math.max(0, qty); 
        return { ...p, so_luong: q, thanh_tien: q * p.don_gia }; 
      }
      return p;
    });
    const total = newItems.reduce((acc, curr) => acc + curr.thanh_tien, 0);
    setFormData({ ...formData, san_pham: newItems, gia_tien: total });
  };

  const updateProductPrice = (id: string, price: number) => {
    const newItems = (formData.san_pham || []).map(p => {
      if (p.id_sp === id) { 
        const pr = Math.max(0, price); 
        return { ...p, don_gia: pr, thanh_tien: p.so_luong * pr }; 
      }
      return p;
    });
    const total = newItems.reduce((acc, curr) => acc + curr.thanh_tien, 0);
    setFormData({ ...formData, san_pham: newItems, gia_tien: total });
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const getDefaultDateRange = () => {
    const today = new Date();
    const day = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    let fromDate, toDate;
    if (day <= 14) {
      fromDate = new Date(currentYear, currentMonth - 1, 15);
      toDate = new Date(currentYear, currentMonth, 14);
    } else {
      fromDate = new Date(currentYear, currentMonth, 15);
      toDate = new Date(currentYear, currentMonth + 1, 14);
    }
    return { from: toISODateKey(fromDate), to: toISODateKey(toDate) };
  };

  useEffect(() => {
    const defaults = getDefaultDateRange();
    setDateFrom(defaults.from);
    setDateTo(defaults.to);
  }, []);

  useEffect(() => {
    if (initialAction === 'add') {
      handleAddStudent();
    }
    if (filterStatus) {
      // Clear other filters
      setSearchTerm("");
      setDateFrom("");
      setDateTo("");
      setColorFilter(null);
      
      // We need to handle the filtering logic. 
      // Since Dashboard uses useMemo for groups, we just need to ensure the groups reflect the filter.
      // However, the current group logic is complex. 
      // Let's add a state for status filter if needed, or just scroll to the group.
      const groupElement = document.getElementById(`group-${filterStatus}`);
      if (groupElement) {
        groupElement.scrollIntoView({ behavior: 'smooth' });
      }
      
      // Expand the group if it's collapsed
      setCollapsedGroups(prev => ({ ...prev, [filterStatus]: false }));
    }
  }, [initialAction, filterStatus, products]); 


  useEffect(() => {
    // Pre-fetch dữ liệu cho trang tạo phác đồ mới để khi ấn nút "Tạo PĐ" sẽ nhanh hơn
    api.getPlanEditorData(); 
  }, []);

  const productMap = useMemo(() => buildProductMap(products), [products]);

  const todayStr = toISODateKey(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const calcInfo = (c: Customer) => {
    const start = parseVNDate(c.start_date) || new Date();
    const end = parseVNDate(c.end_date);
    const diff = today.getTime() - start.getTime();
    const currentDay = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    
    let daysLeft = 0;
    if (end) {
      const diffEnd = end.getTime() - today.getTime();
      daysLeft = Math.ceil(diffEnd / (1000 * 60 * 60 * 24));
    } else {
      daysLeft = (c.duration_days || 30) - (currentDay > 0 ? currentDay : 0);
    }
    
    return { currentDay, daysLeft, start };
  };

  const filteredBySearch = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return customers.filter(c => {
      const matchSearch = String(c.customer_name || '').toLowerCase().includes(term) || 
                          String(c.ma_vd || '').toLowerCase().includes(term) || 
                          String(c.sdt || '').includes(searchTerm);
      
      if (term) return matchSearch;

      let matchVideoOpen = true;
      if (videoOpenFilter) {
        if (c.raw_backup && c.raw_backup.last_video_open_time) {
           const openTime = new Date(c.raw_backup.last_video_open_time);
           const vnTime = new Date(openTime.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
           const todayVn = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
           
           matchVideoOpen = vnTime.getDate() === todayVn.getDate() && 
                            vnTime.getMonth() === todayVn.getMonth() && 
                            vnTime.getFullYear() === todayVn.getFullYear();
        } else {
           matchVideoOpen = false;
        }
      }

      return matchSearch && matchVideoOpen;
    });
  }, [customers, searchTerm, videoOpenFilter, products, productMap]);

  // Helper function for sorting by most recent creation (using full timestamp)
  const getCreationTime = (c: Customer) => {
    if (c.created_at) {
      const t = new Date(c.created_at).getTime();
      if (!isNaN(t)) return t;
    }
    // Fallback: Use timestamp from customer_id (e.g., C1705123456789)
    const idMatch = c.customer_id?.match(/C(\d+)/);
    return idMatch ? parseInt(idMatch[1]) : 0;
  };

  const groups = useMemo(() => {
    const deleted: Customer[] = [];
    const newToday: Customer[] = [];
    const expiring: Customer[] = [];
    const noPlan: Customer[] = [];
    const active: Customer[] = [];
    const notStarted: Customer[] = [];
    const expired: Customer[] = [];

    const isSearching = searchTerm.trim() !== "";

    filteredBySearch.forEach(c => {
      if (c.status === CustomerStatus.DELETED) {
        deleted.push(c);
        return;
      }

      const { currentDay, daysLeft } = calcInfo(c);
      const isNewToday = toISODateKey(c.created_at) === todayStr;
      const hasPlan = !!c.video_date && String(c.video_date).trim() !== "";
      
      const createdAtISO = toISODateKey(c.created_at);
      const matchDate = isSearching || videoOpenFilter || ((!dateFrom || createdAtISO >= dateFrom) && (!dateTo || createdAtISO <= dateTo));

      if (isNewToday) newToday.push(c);

      if (!hasPlan) {
        if (matchDate) noPlan.push(c);
      } else if (currentDay < 1) {
        if (matchDate) notStarted.push(c);
      } else if (daysLeft < 0) {
        // Expired group always ignores date filter per request
        expired.push(c);
      } else if (daysLeft <= 5) {
        // Expiring group always ignores date filter per request
        expiring.push(c);
      } else {
        // Active group cards now MUST respect date filter per latest request
        if (matchDate) {
          active.push(c);
        }
      }
    });

    // Sort each group
    deleted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    newToday.sort((a, b) => getCreationTime(b) - getCreationTime(a));
    expiring.sort((a, b) => calcInfo(a).daysLeft - calcInfo(b).daysLeft);
    noPlan.sort((a, b) => getCreationTime(b) - getCreationTime(a));
    active.sort((a, b) => calcInfo(a).daysLeft - calcInfo(b).daysLeft);
    notStarted.sort((a, b) => calcInfo(a).start.getTime() - calcInfo(b).start.getTime());
    expired.sort((a, b) => (calcInfo(b).start.getTime() + (b.duration_days || 0) * 86400000) - (calcInfo(a).start.getTime() + (a.duration_days || 0) * 86400000));

    return { newToday, noPlan, expiring, active, notStarted, expired, deleted };
  }, [filteredBySearch, todayStr, dateFrom, dateTo, searchTerm, videoOpenFilter]);

  const summaryStats = useMemo(() => {
    // Calculate "Hoạt động" count independent of date filter
    // but still respecting search term and color filter
    const totalActiveCount = filteredBySearch.filter(c => {
      if (c.status === CustomerStatus.DELETED) return false;
      const { currentDay, daysLeft } = calcInfo(c);
      const hasPlan = !!c.video_date && String(c.video_date).trim() !== "";
      return hasPlan && currentDay >= 1 && daysLeft >= 0 && daysLeft > 5;
    }).length;

    return { 
      new: groups.newToday.length, 
      noPlan: groups.noPlan.length,
      active: totalActiveCount, // This is the "Tổng số phác đồ đang hoạt động" independent of date filter
      expiring: groups.expiring.length, 
      total: customers.filter(c => c.status !== CustomerStatus.DELETED).length
    };
  }, [groups, customers, filteredBySearch]);

  const isSearching = searchTerm.trim() !== "";

  const hvVaoHocCount = useMemo(() => {
    let count = 0;
    const todayVn = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    
    customers.filter(c => c.status !== CustomerStatus.DELETED).forEach(c => {
      if (c.raw_backup && c.raw_backup.last_video_open_time) {
         const openTime = new Date(c.raw_backup.last_video_open_time);
         const vnTime = new Date(openTime.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
         
         if (vnTime.getDate() === todayVn.getDate() && 
             vnTime.getMonth() === todayVn.getMonth() && 
             vnTime.getFullYear() === todayVn.getFullYear()) {
             count++;
         }
      }
    });
    return count;
  }, [customers]);
  
  const handleCopyLink = (link: string, customer?: Customer) => {
    const dbToken = customer?.token && String(customer.token).trim() !== "" ? String(customer.token).trim() : "";
    const dbCustomerId = customer?.customer_id || "";

    // Always regenerate to ensure correct domain (phacdo.vercel.app)
    let linkToCopy = "";
    
    if (dbCustomerId && dbToken) {
      linkToCopy = generateCustomerLink(dbCustomerId, dbToken);
    } else {
      // Fallback to existing link if we don't have enough info to regenerate
      linkToCopy = customer?.link && String(customer.link).trim() !== "" ? String(customer.link).trim() : (link && String(link).trim() !== "" ? String(link).trim() : "");
    }

    if (!linkToCopy && dbCustomerId) {
      linkToCopy = 'https://phacdo.vercel.app/client/' + dbCustomerId + (dbToken ? '?t=' + dbToken : '');
    }

    if (linkToCopy) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(linkToCopy).then(() => {
          setToast("Đã copy link phác đồ thành công!");
        }).catch(() => {
          fallbackCopy(linkToCopy);
        });
      } else {
        fallbackCopy(linkToCopy);
      }
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setToast("Đã copy link phác đồ thành công!");
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
  };

  const totalProfit = useMemo(() => {
    return customers
      .filter(c => c.status !== CustomerStatus.DELETED)
      .filter(c => {
        const createdAtISO = toISODateKey(c.created_at);
        return (!dateFrom || createdAtISO >= dateFrom) && (!dateTo || createdAtISO <= dateTo);
      })
      .reduce((acc, c) => {
        const fin = calcRevenueCostProfit(c, products, productMap);
        return acc + fin.profit;
      }, 0);
  }, [customers, products, dateFrom, dateTo, productMap]);

  return (
    <Layout 
      title={
        <div className="flex items-center gap-2">
          <a 
            href="https://docs.google.com/spreadsheets/d/193-BwKDTSLZdgwfQSo-0N3ueREo0HeJ2Ta9gLbI3oc8/edit?usp=sharing" 
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 transition-colors"
          >
            MEGA PHƯƠNG ADMIN
          </a>
          {(() => {
            const unviewedCount = pendingRequests.length;
            return (
              <div 
                className="relative cursor-pointer group"
                onClick={(e) => { e.stopPropagation(); setIsRequestModalOpen(true); }}
              >
                <div className={`p-2 rounded-xl transition-all ${unviewedCount > 0 ? 'bg-red-50 text-red-500 animate-[pulse_2s_infinite]' : 'bg-blue-50 text-blue-400'}`}>
                  <Bell size={20} strokeWidth={2.5} />
                </div>
                {unviewedCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-md">
                    {unviewedCount}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      }
      onIconClick={handleAddStudent}
      actions={
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => onNavigate('plan-editor')}>
            <Plus size={14} className="mr-1.5" /> Tạo PĐ
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('management')}>
            <Users size={14} className="mr-1.5" /> HV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('products')}>
             <Package size={14} className="mr-1.5" /> SP
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('video-groups')}>
            <List size={14} className="mr-1.5" /> PĐ mẫu
          </Button>
          <button 
            onClick={onLogout}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all ml-1"
            title="Đăng xuất"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 sm:gap-6 pb-20">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-x-8 sm:gap-y-2 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-blue-900 px-1 py-1">
             <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-blue-50 sm:border-none sm:p-0"><Zap size={14} className="text-orange-500" /> {summaryStats.new} Mới</div>
             <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-blue-50 sm:border-none sm:p-0"><FileWarning size={14} className="text-red-500" /> {summaryStats.noPlan} Chưa có PĐ</div>
             <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-blue-50 sm:border-none sm:p-0"><CheckCircle size={14} className="text-green-500" /> {summaryStats.active} Hoạt động</div>
             <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-blue-50 sm:border-none sm:p-0"><AlertTriangle size={14} className="text-orange-400" /> {summaryStats.expiring} Sắp hết hạn</div>
             <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-blue-50 sm:border-none sm:p-0"><Clock size={14} className="text-blue-500" /> {summaryStats.total} Tổng</div>
             <div 
               onClick={() => onNavigate('analytics')}
               className="flex items-center gap-2 bg-green-50 p-2 rounded-xl border border-green-100 sm:border-none sm:p-0 text-green-700 cursor-pointer hover:bg-green-100 transition-all"
               title="Xem thống kê chi tiết"
             >
               <CheckCircle size={14} className="text-green-600" /> {formatVND(totalProfit)}
             </div>
          </div>
          
          <div className="flex overflow-x-auto gap-3 sm:gap-x-4 sm:gap-y-2 mt-1 px-1 items-center scrollbar-hide pb-2 sm:pb-0">
             <button onClick={() => setVideoOpenFilter(!videoOpenFilter)} className={`shrink-0 group flex items-center gap-2 transition-all p-2 px-3 rounded-xl border ${videoOpenFilter ? 'bg-indigo-50 border-indigo-200 shadow-sm scale-105' : 'bg-white border-blue-50 sm:bg-transparent sm:border-transparent opacity-70 hover:opacity-100 hover:bg-gray-50'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${videoOpenFilter ? 'bg-indigo-600 animate-pulse' : 'bg-indigo-400'}`}></div>
                <span className={`text-[10px] font-black uppercase tracking-tight ${videoOpenFilter ? 'text-indigo-800' : 'text-indigo-600'}`}>
                   HV VÀO HỌC <span className="text-black ml-1">:{hvVaoHocCount}</span>
                </span>
             </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end px-1 py-1">
          <div className="relative flex-1 w-full">
            <input 
              className="line-input pl-0 text-base font-bold text-blue-900 placeholder:text-blue-300" 
              placeholder="Tên, SĐT, Mã VD..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <div className="grid grid-cols-2 sm:flex gap-4 w-full md:w-auto">
            <div className="w-full sm:w-40">
              <LineInput 
                label="Từ ngày"
                type="date" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)} 
              />
            </div>
            <div className="w-full sm:w-40 relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">Đến ngày</label>
                <button 
                  onClick={() => { 
                    setSearchTerm(""); 
                    const def = getDefaultDateRange();
                    setDateFrom(def.from); 
                    setDateTo(def.to); 
                    setVideoOpenFilter(false); 
                  }} 
                  className="text-gray-400 hover:text-red-500 transition-all active:scale-90" 
                  title="Xóa bộ lọc"
                >
                  <Eraser size={14} />
                </button>
              </div>
              <DateInput 
                value={dateTo} 
                onChange={val => setDateTo(val)} 
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
        ) : (
          <div className="flex flex-col gap-6 px-1">
            {groups.newToday.length > 0 && (
              <div>
                <GroupHeader icon={Zap} title="Mới tạo hôm nay" count={groups.newToday.length} colorClass="text-orange-700" isCollapsed={!!collapsedGroups['newToday'] && !isSearching} onToggle={() => toggleGroup('newToday')} />
                {(!collapsedGroups['newToday'] || isSearching) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300">
                    {groups.newToday.map(c => <CustomerCard key={c.customer_id} customer={c} products={products} productMap={productMap} onEdit={(id) => onNavigate('plan-editor', { customerId: id, returnTo: 'dashboard' })} onPreview={(id, token) => onNavigate('preview', { customerId: id, token })} onDuplicate={(id) => onNavigate('plan-editor', { templateId: id })} onCopyPlan={handleCopyPlan} onDetail={(id) => onNavigate('management', { customerId: id })} onCopyLink={handleCopyLink} onCopyName={handleCopyName} groupColor="text-orange-600" groupIcon={Zap} />)}
                  </div>
                )}
              </div>
            )}
            {groups.noPlan.length > 0 && (
              <div id="group-noPlan">
                <GroupHeader icon={FileWarning} title="Chưa có Phác đồ" count={groups.noPlan.length} colorClass="text-red-700" isCollapsed={!!collapsedGroups['noPlan'] && !isSearching} onToggle={() => toggleGroup('noPlan')} />
                {(!collapsedGroups['noPlan'] || isSearching) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300">
                    {groups.noPlan.map(c => <CustomerCard key={c.customer_id} customer={c} products={products} productMap={productMap} onEdit={(id) => onNavigate('plan-editor', { customerId: id, returnTo: 'dashboard' })} onPreview={(id, token) => onNavigate('preview', { customerId: id, token })} onDuplicate={(id) => onNavigate('plan-editor', { templateId: id })} onCopyPlan={handleCopyPlan} onDetail={(id) => onNavigate('management', { customerId: id })} onCopyLink={handleCopyLink} onCopyName={handleCopyName} groupColor="text-red-500" groupIcon={FileWarning} />)}
                  </div>
                )}
              </div>
            )}
            {groups.expiring.length > 0 && (
              <div id="group-expiring">
                <GroupHeader icon={AlertTriangle} title="Sắp hết hạn" count={groups.expiring.length} colorClass="text-amber-700" isCollapsed={!!collapsedGroups['expiring'] && !isSearching} onToggle={() => toggleGroup('expiring')} />
                {(!collapsedGroups['expiring'] || isSearching) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300">
                    {groups.expiring.map(c => <CustomerCard key={c.customer_id} customer={c} products={products} productMap={productMap} onEdit={(id) => onNavigate('plan-editor', { customerId: id, returnTo: 'dashboard' })} onPreview={(id, token) => onNavigate('preview', { customerId: id, token })} onDuplicate={(id) => onNavigate('plan-editor', { templateId: id })} onCopyPlan={handleCopyPlan} onDetail={(id) => onNavigate('management', { customerId: id })} onCopyLink={handleCopyLink} onCopyName={handleCopyName} groupColor="text-amber-500" groupIcon={AlertTriangle} />)}
                  </div>
                )}
              </div>
            )}
            {groups.active.length > 0 && (
              <div id="group-active">
                <GroupHeader icon={CheckCircle} title="Hoạt động" count={groups.active.length} colorClass="text-green-800" isCollapsed={!!collapsedGroups['active'] && !isSearching} onToggle={() => toggleGroup('active')} />
                {(!collapsedGroups['active'] || isSearching) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300">
                    {groups.active.map(c => <CustomerCard key={c.customer_id} customer={c} products={products} productMap={productMap} onEdit={(id) => onNavigate('plan-editor', { customerId: id, returnTo: 'dashboard' })} onPreview={(id, token) => onNavigate('preview', { customerId: id, token })} onDuplicate={(id) => onNavigate('plan-editor', { templateId: id })} onCopyPlan={handleCopyPlan} onDetail={(id) => onNavigate('management', { customerId: id })} onCopyLink={handleCopyLink} onCopyName={handleCopyName} groupColor="text-green-600" groupIcon={CheckCircle} />)}
                  </div>
                )}
              </div>
            )}
            {groups.notStarted.length > 0 && (
              <div id="group-notStarted">
                <GroupHeader icon={Clock} title="Chưa bắt đầu" count={groups.notStarted.length} colorClass="text-blue-800" isCollapsed={!!collapsedGroups['notStarted'] && !isSearching} onToggle={() => toggleGroup('notStarted')} />
                {(!collapsedGroups['notStarted'] || isSearching) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300">
                    {groups.notStarted.map(c => <CustomerCard key={c.customer_id} customer={c} products={products} productMap={productMap} onEdit={(id) => onNavigate('plan-editor', { customerId: id, returnTo: 'dashboard' })} onPreview={(id, token) => onNavigate('preview', { customerId: id, token })} onDuplicate={(id) => onNavigate('plan-editor', { templateId: id })} onCopyPlan={handleCopyPlan} onDetail={(id) => onNavigate('management', { customerId: id })} onCopyLink={handleCopyLink} onCopyName={handleCopyName} groupColor="text-blue-500" groupIcon={Clock} />)}
                  </div>
                )}
              </div>
            )}
            {groups.expired.length > 0 && (
              <div id="group-expired">
                <GroupHeader icon={Archive} title="Đã kết thúc" count={groups.expired.length} colorClass="text-red-800" isCollapsed={!!collapsedGroups['expired'] && !isSearching} onToggle={() => toggleGroup('expired')} />
                {(!collapsedGroups['expired'] || isSearching) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300">
                    {groups.expired.map(c => <CustomerCard key={c.customer_id} customer={c} products={products} productMap={productMap} onEdit={(id) => onNavigate('plan-editor', { customerId: id, returnTo: 'dashboard' })} onPreview={(id, token) => onNavigate('preview', { customerId: id, token })} onDuplicate={(id) => onNavigate('plan-editor', { templateId: id })} onCopyPlan={handleCopyPlan} onDetail={(id) => onNavigate('management', { customerId: id })} onCopyLink={handleCopyLink} onCopyName={handleCopyName} groupColor="text-red-500" groupIcon={Archive} />)}
                  </div>
                )}
              </div>
            )}
            {groups.deleted.length > 0 && (
              <div>
                <GroupHeader icon={Trash2} title="Đã xóa" count={groups.deleted.length} colorClass="text-gray-500" isCollapsed={!!collapsedGroups['deleted'] && !isSearching} onToggle={() => toggleGroup('deleted')} />
                {(!collapsedGroups['deleted'] || isSearching) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300 opacity-70 grayscale-[0.3]">
                    {groups.deleted.map(c => <CustomerCard key={c.customer_id} customer={c} products={products} productMap={productMap} onEdit={(id) => onNavigate('plan-editor', { customerId: id, returnTo: 'dashboard' })} onPreview={(id, token) => onNavigate('preview', { customerId: id, token })} onDuplicate={(id) => onNavigate('plan-editor', { templateId: id })} onCopyPlan={handleCopyPlan} onDetail={(id) => onNavigate('management', { customerId: id })} onCopyLink={handleCopyLink} onCopyName={handleCopyName} groupColor="text-gray-400" groupIcon={Trash2} />)}
                  </div>
                )}
              </div>
            )}
            {groups.newToday.length === 0 && groups.expiring.length === 0 && groups.active.length === 0 && groups.notStarted.length === 0 && groups.expired.length === 0 && groups.deleted.length === 0 && !loading && (
              <div className="py-24 text-center bg-gray-50/50 rounded-[2.5rem] border border-dashed border-gray-200">
                <p className="text-gray-400 italic text-sm font-medium">Hệ thống không tìm thấy học viên nào khớp với bộ lọc...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {isProfitModalOpen && (
        <ProfitChartModal 
          isOpen={isProfitModalOpen} 
          onClose={() => setIsProfitModalOpen(false)} 
          customers={customers} 
          products={products} 
        />
      )}

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="THÊM HỌC VIÊN MỚI"
        maxWidth="max-w-4xl"
        footer={
          <div className="flex justify-between items-center w-full">
            <div>
              {formData.customer_id && (
                <Button 
                  variant="ghost" 
                  className="text-red-500 hover:bg-red-50"
                  onClick={async () => {
                    if (confirm(`Bạn có chắc chắn muốn xóa học viên ${formData.customer_name}?`)) {
                      try {
                        await onDelete(formData.customer_id!);
                        setIsAddModalOpen(false);
                        setToast("Đã xóa học viên thành công!");
                      } catch (e) {
                        alert("Lỗi khi xóa học viên!");
                      }
                    }
                  }}
                >
                  <Trash2 size={16} className="mr-2" />
                  XÓA
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => { setIsAddModalOpen(false); onNavigate('dashboard'); }}>HỦY BỎ</Button>
              <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <RefreshCw size={16} className="animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
                LƯU
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-1">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
              <h3 className="text-[13px] font-black text-blue-900 uppercase tracking-widest">Thông tin cơ bản</h3>
            </div>
            
            <LineInput 
              label="Tên học viên" 
              placeholder="VÍ DỤ: NGUYỄN THỊ MAI" 
              value={formData.customer_name} 
              onChange={e => setFormData({ ...formData, customer_name: e.target.value.toUpperCase() })} 
            />
            
            <div className="grid grid-cols-2 gap-4">
              <LineInput 
                label="Số điện thoại" 
                placeholder="09xx..." 
                value={formData.sdt} 
                onChange={e => setFormData({ ...formData, sdt: e.target.value })} 
              />
              <LineInput 
                label="Email" 
                placeholder="example@mail.com" 
                value={formData.email} 
                onChange={e => setFormData({ ...formData, email: e.target.value })} 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <LineInput 
                label="Ngày bắt đầu" 
                type="date" 
                value={formData.start_date} 
                onChange={e => setFormData({ ...formData, start_date: e.target.value })} 
              />
              <LineInput 
                label="Số ngày tập" 
                type="number" 
                value={formData.duration_days} 
                onChange={e => setFormData({ ...formData, duration_days: parseInt(e.target.value) || 0 })} 
              />
            </div>

            <LineInput 
              label="Mã vận đơn" 
              placeholder="Mã vận đơn..." 
              value={formData.ma_vd} 
              onChange={e => setFormData({ ...formData, ma_vd: e.target.value })} 
            />

            <LineInput 
              label="Địa chỉ" 
              placeholder="Số nhà, tên đường, quận/huyện..." 
              value={formData.dia_chi} 
              onChange={e => setFormData({ ...formData, dia_chi: e.target.value })} 
            />
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                <h3 className="text-[13px] font-black text-blue-900 uppercase tracking-widest">Đơn hàng & Sản phẩm</h3>
              </div>
              <div className="relative">
                <button 
                  onClick={() => setShowProductDropdown(!showProductDropdown)}
                  className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-all shadow-md active:scale-95"
                >
                  <Plus size={20} />
                </button>
                
                {showProductDropdown && (
                  <div className="absolute right-0 top-10 w-72 sm:w-80 bg-white border border-blue-50 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                      <span className="text-[11px] font-black text-blue-900 uppercase">Danh sách sản phẩm</span>
                      <button onClick={() => setShowProductDropdown(false)}><X size={14} className="text-blue-400" /></button>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
                      {products.filter(p => p.trang_thai === 1).map(p => (
                        <div 
                          key={p.id_sp} 
                          onClick={() => toggleProduct(p)}
                          className="flex items-center justify-between p-3 hover:bg-blue-50 rounded-xl cursor-pointer transition-colors group"
                        >
                          <div className="flex flex-col">
                            <span className="text-[12px] font-bold text-gray-700 uppercase group-hover:text-blue-600">{p.ten_sp}</span>
                            <span className="text-[10px] font-bold text-gray-400">{formatVND(p.gia_ban)}</span>
                          </div>
                          <Plus size={14} className="text-blue-200 group-hover:text-blue-600" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50/50 rounded-3xl p-6 border border-blue-50">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">PHÁC ĐỒ:</span>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setIsAddModalOpen(false);
                      onNavigate('plan-editor', { draftCustomer: formData });
                    }}
                    className="flex items-center justify-center w-10 h-10 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all border border-blue-100 hover:scale-110"
                    title="Thêm phác đồ mới"
                  >
                    <Plus size={22} />
                  </button>
                  <button 
                    onClick={() => setIsCopyModalOpen(true)}
                    className="flex items-center justify-center w-10 h-10 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-all border border-orange-100 hover:scale-110"
                    title="Copy phác đồ từ học viên khác"
                  >
                    <CopyPlus size={22} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-4 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                {(formData.san_pham || []).map(item => (
                  <div key={item.id_sp} className="flex items-center justify-between group bg-white p-3 rounded-2xl border border-blue-50/50 shadow-sm">
                    <div className="flex-1">
                      <div className="text-[12px] font-black text-blue-900 uppercase">{item.ten_sp}</div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-[11px] font-bold text-gray-400">SL: <input type="number" className="w-8 bg-transparent outline-none font-bold text-blue-600 border-b border-blue-50 focus:border-blue-400" value={item.so_luong || 0} onChange={e => updateProductQty(item.id_sp, parseInt(e.target.value) || 0)} /></span>
                        <span className="text-[11px] font-bold text-gray-400">GIÁ: <input type="text" className="w-20 bg-transparent outline-none font-bold text-blue-900 border-b border-blue-50 focus:border-blue-400" value={formatVND(item.don_gia || 0)} onChange={e => updateProductPrice(item.id_sp, parseInt(e.target.value.replace(/\D/g, '')) || 0)} /></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-black text-blue-600">{formatVND(item.thanh_tien)}</span>
                      <button onClick={() => toggleProduct(products.find(p => p.id_sp === item.id_sp)!)} className="text-red-200 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
                {(formData.san_pham || []).length === 0 && (
                  <div className="py-10 text-center">
                    <ShoppingBag size={32} className="mx-auto text-blue-100 mb-2" />
                    <p className="text-gray-400 italic text-[11px]">Chưa chọn sản phẩm nào cho đơn hàng này</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-blue-100 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">TỔNG THANH TOÁN</span>
                  <input 
                    type="text" 
                    className="text-2xl font-black text-blue-600 bg-transparent outline-none border-b border-blue-100 focus:border-blue-400 w-full" 
                    value={formatVND(formData.gia_tien || 0)} 
                    onChange={e => setFormData({...formData, gia_tien: parseInt(e.target.value.replace(/\D/g, '')) || 0})} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isCopyModalOpen}
        onClose={() => { setIsCopyModalOpen(false); setCopySearchTerm(""); setTargetCustomerId(null); }}
        title="CHỌN HỌC VIÊN ĐỂ COPY PHÁC ĐỒ"
        maxWidth="max-w-2xl"
      >
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Tìm tên, SĐT học viên..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-blue-900"
              value={copySearchTerm}
              onChange={(e) => setCopySearchTerm(e.target.value)}
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar flex flex-col gap-2">
            {customers
              .filter(c => c.video_date && (
                c.customer_name.toLowerCase().includes(copySearchTerm.toLowerCase()) ||
                c.sdt.includes(copySearchTerm)
              ))
              .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
              .map(c => (
                <div 
                  key={c.customer_id}
                  onMouseEnter={() => api.getPlanEditorData(undefined, c.customer_id)}
                  onClick={async () => {
                    if (isCopying) return;
                    setIsCopying(true);
                    try {
                      if (targetCustomerId) {
                        onNavigate('plan-editor', { customerId: targetCustomerId, templateId: c.customer_id });
                      } else {
                        onNavigate('plan-editor', { draftCustomer: formData, templateId: c.customer_id });
                      }
                      setIsCopyModalOpen(false);
                      setIsAddModalOpen(false);
                      setTargetCustomerId(null);
                    } catch (e) {
                      alert("Lỗi khi copy phác đồ!");
                    } finally {
                      setIsCopying(false);
                    }
                  }}
                  className="flex items-center justify-between p-4 hover:bg-blue-50 rounded-2xl cursor-pointer border border-transparent hover:border-blue-100 transition-all group"
                >
                  <div className="flex flex-col">
                    <span className="font-black text-blue-900 uppercase text-sm group-hover:text-blue-600">{c.customer_name}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SĐT: {c.sdt || '---'} | NGÀY: {formatDDMMYYYY(c.video_date)}</span>
                  </div>
                  <CopyPlus size={18} className="text-gray-300 group-hover:text-blue-600" />
                </div>
              ))}
            {customers.filter(c => c.video_date).length === 0 && (
              <div className="py-10 text-center text-gray-400 italic text-sm">Chưa có học viên nào có phác đồ để copy...</div>
            )}
          </div>
        </div>
      </Modal>
      <div className="mt-12 pb-8 text-center">
        <span className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.3em]">Phiên bản hệ thống v2.5.0 • Cập nhật 2024</span>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* 🚀 MODAL DANH SÁCH YÊU CẦU THIẾT BỊ / EMAIL */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => {
          setIsRequestModalOpen(false);
          setDetailCustomerId(null);
        }}
        title={detailCustomerId ? "CHI TIẾT YÊU CẦU" : "YÊU CẦU DUYỆT THIẾT BỊ / EMAIL"}
        maxWidth="max-w-xl"
      >
        <div className="flex flex-col gap-4">
          {(() => {
            const detailCustomerReq = detailCustomerId ? pendingRequests.find(r => r.customer_id === detailCustomerId) : null;
            const detailCustomerName = detailCustomerReq ? (detailCustomerReq.type === 'device' ? (detailCustomerReq.customers?.customer_name || 'Học viên ẩn') : (detailCustomerReq.customer_name || 'Học viên ẩn')) : 'Học viên ẩn';

            return (
              <>
          { !detailCustomerId ? (
            // VIEW CHUNG: DANH SÁCH HỌC VIÊN CÓ YÊU CẦU
            <>
              {(() => {
                const grouped = pendingRequests.reduce((acc: any, req: any) => {
                  const cid = req.customer_id;
                  if (!acc[cid]) {
                    acc[cid] = {
                      customer_id: cid,
                      name: req.type === 'device' ? (req.customers?.customer_name || 'Học viên ẩn') : (req.customer_name || 'Học viên ẩn'),
                      deviceCount: 0,
                      hasEmail: false,
                      pending_email: '',
                      email: req.email || '',
                      lastDate: req.created_at,
                      requests: []
                    };
                  }
                  acc[cid].requests.push(req);
                  if (req.type === 'device') acc[cid].deviceCount++;
                  if (req.type === 'email') {
                    acc[cid].hasEmail = true;
                    acc[cid].pending_email = req.pending_email;
                  }
                  // Keep the most recent date
                  if (new Date(req.created_at) > new Date(acc[cid].lastDate)) {
                    acc[cid].lastDate = req.created_at;
                  }
                  return acc;
                }, {});

                const studentGroups = Object.values(grouped)
                  .sort((a: any, b: any) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());

                if (studentGroups.length === 0) {
                  return <div className="py-10 text-center text-gray-400 italic text-sm">Hiện không có yêu cầu nào chờ duyệt.</div>;
                }

                return studentGroups.map((group: any) => {
                  return (
                  <div 
                    key={group.customer_id}
                    className="p-4 border rounded-[2rem] flex items-center justify-between hover:bg-blue-50/70 transition-all cursor-pointer shadow-sm group bg-blue-50 border-blue-200"
                    onClick={async () => {
                      setDetailCustomerId(group.customer_id);
                      setDraftDevices({});
                      setDraftEmailApproved(false);
                      setIsLoadingDevices(true);
                      try {
                        const devices = await customerService.getDevices(group.customer_id);
                        setCustomerDevices(devices.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
                      } catch (e) {
                        console.error(e);
                      } finally {
                        setIsLoadingDevices(false);
                      }
                    }}
                  >
                    <div className="flex flex-col gap-2">
                       <div className="flex items-center gap-3">
                          <span className="uppercase group-hover:text-blue-600 font-black text-blue-900 text-[14px]">{group.name}</span>
                          <span className="text-[10px] font-bold text-gray-400 font-mono mt-0.5">{formatDDMMYYYY(group.lastDate)}</span>
                       </div>
                      <div className="flex items-center gap-2">
                        {group.deviceCount > 0 && (
                          <span className="text-[9px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-md uppercase">
                            {group.deviceCount} Thiết bị chờ duyệt
                          </span>
                        )}
                        {group.hasEmail && (
                          <span className="text-[9px] font-black bg-orange-100 text-orange-600 px-2 py-0.5 rounded-md uppercase">
                            Yêu cầu đổi Email
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronLeft size={18} className="text-blue-400 rotate-180 group-hover:text-blue-600" />
                  </div>
                  );
                });
              })()}
            </>
          ) : (
            // VIEW CHI TIẾT: DANH SÁCH THIẾT BỊ & EMAIL CỦA HỌC VIÊN ĐÓ
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => setDetailCustomerId(null)}
                  className="flex items-center gap-1 text-[10px] font-black text-blue-500 uppercase hover:text-blue-700 w-fit"
                >
                  <ChevronLeft size={14} /> Quay lại danh sách
                </button>
                <div className="flex items-center gap-2 px-1">
                  <User size={18} className="text-blue-500" />
                  <span className="text-[15px] font-black text-blue-900 uppercase">{detailCustomerName}</span>
                </div>
              </div>

              {(() => {
                const hasEmailReq = pendingRequests.some(r => r.customer_id === detailCustomerId && r.type === 'email');
                const emailReq = pendingRequests.find(r => r.customer_id === detailCustomerId && r.type === 'email');

                const handleSave = async () => {
                  let successCount = 0;
                  let failCount = 0;
                  
                  try {
                    // Update Email
                    if (hasEmailReq && draftEmailApproved) {
                      await onUpsert({ 
                        customer_id: emailReq.customer_id, 
                        email: emailReq.pending_email, 
                        pending_email: '' 
                      });
                      setPendingRequests(prev => prev.filter(r => !(r.customer_id === detailCustomerId && r.type === 'email')));
                      successCount++;
                    }

                    // Update Devices
                    for (const dev of customerDevices) {
                      const newStatus = draftDevices[dev.id];
                      if (newStatus !== undefined && newStatus !== dev.is_approved) {
                        try {
                          const updates: any = { is_approved: newStatus };
                          // Try to include approved_at but don't crash if column is missing
                          updates.approved_at = newStatus ? new Date().toISOString() : null;
                          
                          await customerService.updateDevice(dev.id, updates);
                          
                          if (newStatus) {
                            setPendingRequests(prev => prev.filter(r => !(r.type === 'device' && r.id === dev.id)));
                          }
                          successCount++;
                        } catch (devErr: any) {
                          console.warn("Lỗi khi cập nhật thiết bị:", devErr);
                          // Nếu lỗi do thiếu cột approved_at, thử lại chỉ với is_approved
                          if (devErr.message?.includes('column "approved_at" does not exist')) {
                             try {
                               await customerService.updateDevice(dev.id, { is_approved: newStatus });
                               successCount++;
                             } catch (retryErr) {
                               failCount++;
                             }
                          } else {
                            failCount++;
                          }
                        }
                      }
                    }

                    if (detailCustomerId) {
                      setViewedCustomerIds(prev => {
                        const next = new Set(prev);
                        const detailCustomerReqs = pendingRequests.filter(r => r.customer_id === detailCustomerId);
                        detailCustomerReqs.forEach((r: any) => next.add(`${r.type}_${r.id || r.customer_id}_${r.created_at || r.updated_at || ''}`));
                        localStorage.setItem('admin_viewed_notifications', JSON.stringify(Array.from(next)));
                        return next;
                      });
                    }

                    if (failCount === 0) {
                      setToast("Đã lưu thay đổi thành công!");
                    } else {
                      setToast(`Đã lưu ${successCount} mục, thất bại ${failCount} mục.`);
                    }
                    
                    setDetailCustomerId(null);
                    fetchPending();
                  } catch (e) {
                    console.error("Lỗi tổng quát khi lưu:", e);
                    setToast("Có lỗi xảy ra khi lưu! Vui lòng kiểm tra lại kết nối.");
                  }
                };

                return (
                  <div className="space-y-6">
                    {/* PHẦN EMAIL */}
                    {hasEmailReq && (
                      <div className="bg-orange-50/50 border border-orange-100 rounded-3xl p-5">
                        <div className="flex items-center justify-between mb-3 text-[10px] font-black uppercase tracking-widest">
                           <div className="text-orange-600">YÊU CẦU ĐỔI EMAIL</div>
                           <span className="text-orange-400 opacity-60">{formatDDMMYYYY(emailReq.created_at)}</span>
                         </div>
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex flex-col min-w-0">
                              <span className="text-[10px] font-bold text-gray-400 uppercase">Email hiện tại</span>
                              <span className="text-[11px] font-bold text-blue-900 truncate">
                                {customers.find(c => c.customer_id === detailCustomerId)?.email || '---'}
                              </span>
                            </div>
                            <div className="text-orange-300">→</div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-[10px] font-bold text-gray-400 uppercase">Email mới</span>
                              <span className="text-[11px] font-black text-blue-900 truncate">{emailReq.pending_email}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-orange-100/50 mt-2">
                             <div className="flex items-center gap-2">
                               <Toggle 
                                 checked={draftEmailApproved} 
                                 onChange={setDraftEmailApproved} 
                               />
                               <span className="text-[10px] font-black text-green-600 uppercase">Duyệt thay đổi</span>
                             </div>
                             <button 
                               onClick={() => {
                                 if (confirm("Xóa yêu cầu đổi Email này?")) {
                                   onUpsert({ customer_id: emailReq.customer_id, pending_email: '' });
                                   setPendingRequests(prev => prev.filter(r => !(r.customer_id === detailCustomerId && r.type === 'email')));
                                   if (!pendingRequests.some(r => r.customer_id === detailCustomerId && r.type !== 'email')) {
                                      setDetailCustomerId(null);
                                   }
                                 }
                               }}
                               className="text-red-400 hover:text-red-600 p-1"
                             >
                               <X size={16} />
                             </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PHẦN THIẾT BỊ */}
                    <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-5">
                      <div className="text-[10px] font-black text-blue-600 uppercase mb-3 tracking-widest">DANH SÁCH THIẾT BỊ</div>
                      
                      {isLoadingDevices ? (
                        <div className="py-4 text-center"><RefreshCw size={20} className="animate-spin text-blue-300 mx-auto" /></div>
                      ) : customerDevices.length === 0 ? (
                        <div className="py-4 text-center text-[11px] text-gray-400 italic">Học viên chưa có thiết bị nào.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-blue-100 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                <th className="pb-2">Thiết bị</th>
                                <th className="pb-2">Ngày đăng ký</th>
                                <th className="pb-2">Ngày duyệt</th>
                                <th className="pb-2 text-center">Trạng thái</th>
                                <th className="pb-2 text-right">#</th>
                              </tr>
                            </thead>
                            <tbody>
                              {customerDevices.map(dev => {
                                const isApproved = draftDevices[dev.id] ?? dev.is_approved;
                                return (
                                  <tr key={dev.id} className="border-b border-blue-50/50 text-[10px]">
                                    <td className="py-3 font-bold text-blue-900">
                                      <div className="flex flex-col">
                                        <span>{dev.device_name || 'Không tên'}</span>
                                        <span className="text-[8px] font-medium text-gray-400 font-mono">{dev.device_id.substring(0, 12)}...</span>
                                      </div>
                                    </td>
                                    <td className="py-3 text-gray-500">{formatDDMMYYYY(dev.created_at)}</td>
                                    <td className="py-3 text-gray-500">{dev.approved_at ? formatDDMMYYYY(dev.approved_at) : '---'}</td>
                                    <td className="py-3 text-center">
                                      <Toggle 
                                        checked={isApproved} 
                                        onChange={(val) => setDraftDevices(prev => ({ ...prev, [dev.id]: val }))} 
                                      />
                                    </td>
                                    <td className="py-3 text-right">
                                      <button 
                                        onClick={() => {
                                          if (confirm("Xóa thiết bị này?")) {
                                            customerService.deleteDevice(dev.id).then(() => {
                                              setCustomerDevices(prev => prev.filter(d => d.id !== dev.id));
                                              setPendingRequests(prev => prev.filter(r => !(r.type === 'device' && r.id === dev.id)));
                                            });
                                          }
                                        }}
                                        className="text-red-300 hover:text-red-500"
                                      >
                                        <X size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <Button variant="primary" className="w-full py-4 rounded-3xl uppercase text-xs font-black tracking-widest shadow-xl" onClick={handleSave}>
                       Lưu thay đổi
                    </Button>
                  </div>
                );
              })()}
            </div>
          )}
              </>
            );
          })()}
        </div>
      </Modal>
    </Layout>
  );
};
