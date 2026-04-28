import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Save, Trash2, Plus, RefreshCw, Moon, Sun, Info, Copy, CopyPlus, UserPlus, Link as LinkIcon, Sparkles, RotateCcw, Search, Lock, Maximize2, Loader2, ArrowRight, Layout as LayoutIcon, Type, Video, Palette, AlertCircle, FileJson, CheckCircle, MessageSquare, Terminal, ShieldAlert, Bot, Eraser, Play, ChevronDown, ChevronRight, X, ShoppingBag, Clock, Calendar, User } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card, Button, Modal } from '../components/UI';
import { LineInput } from '../components/UI';
import { api } from '../services/api';
import { customPlanService } from '../src/services/customPlanService';
import { generateCustomerLink, customerService } from '../src/services/customerService';
import { Customer, ExerciseTask, ExerciseType, SidebarBlock, CustomerStatus, Product } from '../types';
import { EXERCISE_TYPES, DEFAULT_SIDEBAR_BLOCKS, DEFAULT_CHEWING_INSTRUCTION } from '../constants';
import { GoogleGenAI } from "@google/genai";
import { toInputDateString, formatDDMM, parseVNDate, addDays, formatVNDate } from '../utils/date';

const isFlagEnabled = (value: any, fallback = true) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['false', '0', 'off', 'no', 'n', 'f', 'disabled'].includes(normalized)) return false;
    if (['true', '1', 'on', 'yes', 'y', 't', 'enabled'].includes(normalized)) return true;
  }
  return fallback;
};

// Separate component for task rows to prevent unnecessary re-renders
const Toggle: React.FC<{ checked: boolean; onChange: (val: boolean) => void; color?: string }> = ({ checked, onChange, color = 'peer-checked:bg-green-500' }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${color}`}></div>
  </label>
);

const TaskRow = React.memo(({ 
  task, 
  index, 
  onEdit, 
  onDelete, 
  isMandatory 
}: { 
  task: ExerciseTask; 
  index: number; 
  onEdit: (index: number, updates: Partial<ExerciseTask>) => void; 
  onDelete: (index: number) => void;
  isMandatory: (task: ExerciseTask) => boolean;
}) => {
  const [localDay, setLocalDay] = useState(task.day ?? 0);
  const [localTitle, setLocalTitle] = useState(task.title || '');
  const [localLink, setLocalLink] = useState(task.link || '');

  // Sync local state when task prop changes (e.g. after save or sync)
  useEffect(() => {
    setLocalDay(task.day ?? 0);
    setLocalTitle(task.title || '');
    setLocalLink(task.link || '');
  }, [task.day, task.title, task.link]);

  return (
    <tr className="hover:bg-blue-50/20 transition-colors">
      <td className="p-4 pl-8">
        <input 
          type="number" 
          className="w-12 bg-transparent border-none font-black text-blue-900 outline-none text-center focus:ring-0"
          value={localDay}
          onChange={e => setLocalDay(parseInt(e.target.value) || 0)}
          onBlur={() => onEdit(index, { day: localDay })}
        />
      </td>
      <td className="p-4">
        <div className="relative group flex items-center">
          <select 
            className={`w-full bg-transparent border-none text-[11px] font-bold uppercase outline-none cursor-pointer appearance-none pr-6 focus:ring-0 ${isMandatory(task) ? 'text-blue-600' : 'text-blue-400'}`}
            value={task.type || ''}
            onChange={e => onEdit(index, { type: e.target.value as ExerciseType })}
          >
            {EXERCISE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-blue-300" />
        </div>
      </td>
      <td className="p-4">
        <input 
          className={`w-full bg-transparent border-none text-[13px] outline-none placeholder:text-blue-300 focus:ring-0 ${isMandatory(task) ? 'font-black text-blue-900 uppercase' : 'font-bold text-blue-500'}`}
          placeholder="Tên bài tập..."
          value={localTitle}
          onChange={e => setLocalTitle(e.target.value)}
          onBlur={() => onEdit(index, { title: localTitle })}
        />
      </td>
      <td className="p-4">
        <input 
          className="w-full bg-transparent border-none text-[12px] font-bold text-blue-600 outline-none placeholder:text-blue-300 focus:ring-0"
          placeholder="https://youtu.be/..."
          value={localLink}
          onChange={e => setLocalLink(e.target.value)}
          onBlur={() => onEdit(index, { link: localLink })}
        />
      </td>
      <td className="p-4 text-center">
        <button 
          onClick={() => onDelete(index)} 
          className="p-2 text-red-200 hover:text-red-500 transition-colors active:scale-90"
        >
          <Trash2 size={18} />
        </button>
      </td>
    </tr>
  );
});

// Separate component for sidebar blocks to prevent unnecessary re-renders
const SidebarBlockCard = React.memo(({ 
  block, 
  onUpdate, 
  onDelete
}: { 
  block: SidebarBlock; 
  onUpdate: (id: string, updates: Partial<SidebarBlock>, shouldSync?: boolean) => void; 
  onDelete: (id: string) => void;
}) => {
  const [localTitle, setLocalTitle] = useState(block.title || '');
  const [localContent, setLocalContent] = useState(block.content || '');
  const [localLink, setLocalLink] = useState(block.video_link || '');

  // Sync local state when block prop changes (e.g. from template or AI)
  // but only if the values are actually different to avoid unnecessary resets
  useEffect(() => {
    if (block.title !== localTitle) setLocalTitle(block.title || '');
    if (block.content !== localContent) setLocalContent(block.content || '');
    if (block.video_link !== localLink) setLocalLink(block.video_link || '');
  }, [block.title, block.content, block.video_link]);

  const handleInputFocus = (field: keyof SidebarBlock, currentValue: string) => {
    const defaultValues = ['Khối thông tin mới', 'Nhập nội dung hiển thị tại đây...', 'Link video (nếu có)...'];
    if (defaultValues.includes(currentValue)) {
      onUpdate(block.id, { [field]: '' });
    }
  };

  return (
    <Card className={`relative flex flex-col group transition-all duration-500 ${block.type === 'dark' ? 'bg-[#1E3A8A] border-transparent shadow-xl' : 'bg-white border-blue-100 hover:border-blue-300'} p-7 rounded-[2.5rem] min-h-[300px]`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => onUpdate(block.id, { type: block.type === 'dark' ? 'default' : 'dark' }, true)} className={`p-2 rounded-xl transition-all ${block.type === 'dark' ? 'bg-white/10 text-white' : 'bg-blue-50 text-blue-600'}`}>
            {block.type === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button onClick={() => onUpdate(block.id, { is_chat: !block.is_chat }, true)} className={`p-2 rounded-xl transition-all ${block.is_chat ? 'bg-orange-500 text-white shadow-lg' : (block.type === 'dark' ? 'bg-white/10 text-white' : 'bg-blue-50 text-blue-600')}`}>
            <MessageSquare size={16} />
          </button>
        </div>
        <button onClick={() => onDelete(block.id)} className={`p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all ${block.type === 'dark' ? 'hover:bg-red-500 text-white/40' : 'hover:bg-red-50 text-red-300'}`}>
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <input 
          className={`bg-transparent border-none text-lg font-black uppercase tracking-tight outline-none ${block.type === 'dark' ? 'text-white placeholder:text-white/40' : 'text-blue-900 placeholder:text-blue-300'}`}
          placeholder="Tiêu đề khối..."
          value={localTitle}
          onFocus={() => handleInputFocus('title', localTitle)}
          onChange={e => setLocalTitle(e.target.value)}
          onBlur={() => onUpdate(block.id, { title: localTitle }, true)}
        />
        <textarea 
          className={`bg-transparent border-none text-sm font-medium leading-relaxed resize-none h-32 outline-none ${block.type === 'dark' ? 'text-white/90 placeholder:text-white/30' : 'text-blue-800 placeholder:text-blue-400'}`}
          placeholder="Nội dung hiển thị..."
          value={localContent}
          onFocus={() => handleInputFocus('content', localContent)}
          onChange={e => setLocalContent(e.target.value)}
          onBlur={() => onUpdate(block.id, { content: localContent }, true)}
        />
        <div className="relative mt-2">
           <LinkIcon size={14} className={`absolute left-0 top-1/2 -translate-y-1/2 ${block.type === 'dark' ? 'text-white/40' : 'text-blue-400'}`} />
           <input 
            className={`w-full bg-transparent border-none pl-6 text-[10px] font-bold outline-none ${block.type === 'dark' ? 'text-white/60 placeholder:text-white/20' : 'text-blue-600 placeholder:text-blue-400'}`}
            placeholder="Link video (nếu có)..."
            value={localLink}
            onFocus={() => handleInputFocus('video_link', localLink)}
            onChange={e => setLocalLink(e.target.value)}
            onBlur={() => onUpdate(block.id, { video_link: localLink }, true)}
          />
        </div>
      </div>
    </Card>
  );
});

export const PlanEditor: React.FC<{ 
  onNavigate: (page: string, params?: any) => void; 
  customerId?: string; 
  templateId?: string; 
  returnTo?: string;
  draftCustomer?: Partial<Customer>;
  products: Product[];
  onUpsert: (payload: Partial<Customer>, tasks?: any) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
}> = ({ onNavigate, customerId, templateId, returnTo, draftCustomer, products, onUpsert, onDelete }) => {
  const isEditMode = !!customerId;
  
  const [customer, setCustomer] = useState<Partial<Customer>>({
    customer_name: draftCustomer?.customer_name || "",
    app_title: "PHÁC ĐỒ 65 NGÀY THAY ĐỔI KHUÔN MẶT",
    app_slogan: "Hành trình đánh thức vẻ đẹp tự nhiên, gìn giữ thanh xuân bằng sự hiểu biết và tình yêu bản thân.",
    start_date: toInputDateString(new Date()),
    duration_days: draftCustomer?.duration_days || 65,
    video_date: null,
    sidebar_blocks_json: [...DEFAULT_SIDEBAR_BLOCKS],
    note: draftCustomer?.note || "",
    chewing_status: draftCustomer?.chewing_status || DEFAULT_CHEWING_INSTRUCTION,
    require_google_auth: true,
    require_device_limit: true,
    trang_thai: 0,
    trang_thai_gan: "0",
    san_pham: [],
    gia_tien: 0
  });

  // Sync end_date when start_date or duration_days changes
  useEffect(() => {
    const startDate = parseVNDate(customer.start_date);
    if (startDate && customer.duration_days) {
      const endDate = addDays(startDate, customer.duration_days);
      const endDateStr = toInputDateString(endDate);
      if (customer.end_date !== endDateStr) {
        setCustomer(prev => ({ ...prev, end_date: endDateStr }));
      }
    }
  }, [customer.start_date, customer.duration_days]);

  // Local states for inputs to prevent lag
  const [localName, setLocalName] = useState(draftCustomer?.customer_name || "");
  const [localNote, setLocalNote] = useState(draftCustomer?.note || "");
  const [localChewing, setLocalChewing] = useState(draftCustomer?.chewing_status || DEFAULT_CHEWING_INSTRUCTION);
  const [localBlocks, setLocalBlocks] = useState<SidebarBlock[]>([]);

  // Reset local states when customer identity or data changes
  useEffect(() => {
    setLocalName(customer.customer_name || "");
    setLocalNote(customer.note || "");
    setLocalChewing(customer.chewing_status || "");
    setLocalBlocks(customer.sidebar_blocks_json || []);
  }, [customer.customer_id, customer.customer_name, customer.note, customer.chewing_status, customer.sidebar_blocks_json]);
  
  const [tasks, setTasks] = useState<ExerciseTask[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [isCustomized, setIsCustomized] = useState(false);
  const [masterDates, setMasterDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [copySearchTerm, setCopySearchTerm] = useState('');
  const [copyToast, setCopyToast] = useState(false);
  const [originalNote, setOriginalNote] = useState<string | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isChewingModalOpen, setIsChewingModalOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'confirm' | 'alert' | 'save_error';
    onConfirm?: () => void;
    dataToCopy?: any;
    isForbidden?: boolean;
  }>({ isOpen: false, title: "", message: "", type: 'alert' });

  const showAlert = (title: string, message: string) => setModalConfig({ isOpen: true, title, message, type: 'alert' });
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setModalConfig({ isOpen: true, title, message, type: 'confirm', onConfirm });
  const showSaveError = (title: string, message: string, data: any, isForbidden = false) => 
    setModalConfig({ isOpen: true, title, message, type: 'save_error', dataToCopy: data, isForbidden });
  
  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  const sortedDates = useMemo(() => {
    if (!Array.isArray(masterDates) || masterDates.length === 0) return [];
    return masterDates;
  }, [masterDates]);

  const loadMasterPreview = async (date: string) => {
    if (!date) return;
    setIsSyncing(true);
    try {
      console.log("Loading master preview for date:", date);
      const t = await api.getPlan("NEW", date);
      const newTasks = Array.isArray(t) ? t : [];
      
      if (newTasks.length === 0) {
        console.warn("Master plan is empty for date:", date);
      } else {
        console.log(`Loaded ${newTasks.length} tasks from master plan`);
      }
      
      setTasks(newTasks.filter(t => t.day <= 30));
      // Only mark as customized if we actually found tasks
      if (newTasks.length > 0) {
        setIsCustomized(true);
      } else {
        setIsCustomized(false);
      }
    } catch (e) {
      console.error("Lỗi tải phác đồ mẫu:", e);
      showAlert("LỖI", "Không thể tải phác đồ mẫu cho ngày này.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleVideoDateChange = async (date: string) => {
    setCustomer(prev => ({ ...prev, video_date: date }));
    if (date) {
      await loadMasterPreview(date);
    }
  };

  const clearCustomization = () => {
    showConfirm("XÁC NHẬN", "Bạn có muốn xóa toàn bộ các bài tập tùy chỉnh và quay về chế độ đồng bộ tự động theo nhóm video mẫu?", () => {
      setIsCustomized(false);
      if (customer.video_date) {
        loadMasterPreview(customer.video_date);
      } else {
        setTasks([]);
      }
      closeModal();
    });
  };

  const manualSyncTemplate = async () => {
    if (!customer.video_date) { 
      showAlert("THÔNG BÁO", "Vui lòng chọn Nhóm video để đồng bộ."); 
      return; 
    }
    setIsCustomized(true);
    await loadMasterPreview(customer.video_date);
  };

  const fetchData = async () => {
    try {
      setError(null);
      const cleanId = (customerId || '').trim();
      const cleanTemplateId = (templateId || '').trim();
      
      // Thử lấy từ cache trước
      const cacheKey = `plan_editor_cache_${cleanId || 'new'}_${cleanTemplateId || 'none'}`;
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const data = JSON.parse(cachedData);
          applyFetchedData(data);
          setLoading(false); // Có cache thì ẩn loading ngay
        } catch (e) {}
      } else {
        setLoading(true); // Chỉ hiện loading nếu không có cache
      }

      const data = await api.getPlanEditorData(cleanId, cleanTemplateId);
      localStorage.setItem(cacheKey, JSON.stringify(data));
      applyFetchedData(data);
    } catch (err: any) {
      console.error("PlanEditor Fetch Error:", err);
      setError(err.message || "Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  const applyFetchedData = (data: any) => {
    const dates = Array.isArray(data.dates) ? data.dates : [];
    setMasterDates(dates);
    
    // Deduplicate tasks to prevent "multiplied" rows
    const deduplicate = (list: ExerciseTask[]) => {
      const seen = new Set();
      return list.filter(t => {
        const key = `${t.day}-${t.title}-${t.link}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const tasksData = deduplicate(Array.isArray(data.tasks) ? data.tasks : []).filter(t => t.day <= 30);
    const templateTasks = deduplicate(Array.isArray(data.templateTasks) ? data.templateTasks : []).filter(t => t.day <= 30);
    
    // Set tasks: if editing existing, use its tasks. If new from template, use template tasks.
    if (customerId) {
      setTasks(tasksData);
    } else if (templateId) {
      setTasks(templateTasks);
    } else {
      setTasks(tasksData);
    }

    let currentVideoDate = "";

    if (customerId && data.customer) {
      const c = data.customer;
      let pc = { ...c };
      if (c.start_date) pc.start_date = toInputDateString(c.start_date);
      setCustomer(pc);
      currentVideoDate = pc.video_date;
      
      // Đồng bộ vào local state để hiển thị và sửa đổi
      setLocalName(pc.customer_name || "");
      setLocalNote(String(pc.note || ""));
      setLocalChewing(String(pc.chewing_status || ""));
      setLocalBlocks(pc.sidebar_blocks_json || []);
      
      // If we have tasks from CustomPlans, it's customized
      // Also check the explicit is_customized flag from the customer record
      const customized = tasksData.length > 0 || !!pc.is_customized;
      setIsCustomized(customized);
      
      // If not customized, load the master plan to show in the editor
      if (!customized && pc.video_date) {
        loadMasterPreview(pc.video_date);
      }
    } else {
      // New student case
      let defaultProducts: any[] = [];
      let defaultTotal = 0;
      const availableProducts = data.products || products;
      
      // Default product SP1768731546380
      const defaultProd = availableProducts.find((p: any) => p.id_sp === 'SP1768731546380');
      
      if (defaultProd) {
        defaultProducts = [{
          id_sp: defaultProd.id_sp,
          ten_sp: defaultProd.ten_sp,
          so_luong: 1,
          don_gia: defaultProd.gia_ban,
          gia_nhap: defaultProd.gia_nhap,
          thanh_tien: defaultProd.gia_ban
        }];
        defaultTotal = defaultProd.gia_ban;
      } else if (availableProducts.length > 0) {
        const firstP = availableProducts[0];
        defaultProducts = [{
          id_sp: firstP.id_sp,
          ten_sp: firstP.ten_sp,
          so_luong: 1,
          don_gia: firstP.gia_ban,
          gia_nhap: firstP.gia_nhap,
          thanh_tien: firstP.gia_ban
        }];
        defaultTotal = firstP.gia_ban;
      }

      setCustomer(prev => {
        const next = { 
          ...prev, 
          ...draftCustomer,
          trang_thai: 0,
          trang_thai_gan: "0",
          duration_days: draftCustomer?.duration_days || 65,
          san_pham: draftCustomer?.san_pham || defaultProducts,
          gia_tien: draftCustomer?.gia_tien || defaultTotal
        };
        return next;
      });
      currentVideoDate = draftCustomer?.video_date || "";
    }

    if (templateId && data.template) {
      const source = data.template;
      const noteVal = String(source.note || "");
      const chewingVal = String(source.chewing_status || DEFAULT_CHEWING_INSTRUCTION);
      
      setCustomer(prev => ({
        ...prev,
        duration_days: source.duration_days,
        start_date: toInputDateString(new Date()),
        video_date: source.video_date,
        sidebar_blocks_json: [...(source.sidebar_blocks_json || DEFAULT_SIDEBAR_BLOCKS)],
        note: noteVal,
        chewing_status: chewingVal,
        app_title: source.app_title,
        app_slogan: source.app_slogan,
      }));
      setLocalNote(noteVal);
      setLocalChewing(chewingVal);
      setLocalBlocks([...(source.sidebar_blocks_json || DEFAULT_SIDEBAR_BLOCKS)]);
      
      // Template loading always counts as customized
      setIsCustomized(true);
    } else if (!customerId) {
      // New student without template
      const latestDate = dates.length > 0 ? dates[0].video_date : "";
      const videoDate = currentVideoDate || latestDate;
      
      if (videoDate) {
        setCustomer(prev => ({ ...prev, video_date: videoDate }));
        
        if (!templateId && tasksData.length === 0) {
          setIsCustomized(false);
          loadMasterPreview(videoDate);
        }
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [customerId, templateId]);

  const toggleProduct = (product: Product) => {
    if (!product) return;
    setCustomer(prev => {
      const current = prev.san_pham || [];
      const exists = current.find(p => p.id_sp === product.id_sp);
      let newItems;
      if (exists) {
        newItems = current.filter(p => p.id_sp !== product.id_sp);
      } else {
        newItems = [...current, { 
          id_sp: product.id_sp, ten_sp: product.ten_sp, so_luong: 1, 
          don_gia: product.gia_ban, gia_nhap: product.gia_nhap, thanh_tien: product.gia_ban 
        }];
      }
      const total = newItems.reduce((acc, curr) => acc + curr.thanh_tien, 0);
      return { ...prev, san_pham: newItems, gia_tien: total };
    });
    setShowProductDropdown(false);
  };

  const updateProductQty = (id: string, qty: number) => {
    setCustomer(prev => {
      const newItems = (prev.san_pham || []).map(p => {
        if (p.id_sp === id) { 
          const q = Math.max(0, qty); 
          return { ...p, so_luong: q, thanh_tien: q * p.don_gia }; 
        }
        return p;
      });
      const total = newItems.reduce((acc, curr) => acc + curr.thanh_tien, 0);
      return { ...prev, san_pham: newItems, gia_tien: total };
    });
  };

  const updateProductPrice = (id: string, price: number) => {
    setCustomer(prev => {
      const newItems = (prev.san_pham || []).map(p => {
        if (p.id_sp === id) { 
          const pr = Math.max(0, price); 
          return { ...p, don_gia: pr, thanh_tien: p.so_luong * pr }; 
        }
        return p;
      });
      const total = newItems.reduce((acc, curr) => acc + curr.thanh_tien, 0);
      return { ...prev, san_pham: newItems, gia_tien: total };
    });
  };

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN').format(num);

  const handleAiOptimize = async () => {
    const currentNote = String(localNote || customer.note || "");
    if (!currentNote.trim()) return;
    setIsAiProcessing(true);
    
    // Save original note if not already saved
    if (!originalNote) setOriginalNote(currentNote);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Bạn là chuyên gia Yoga Face của Mega Phương, bạn hãy viết lại nội dung của từng thói quen như ăn nhai, nằm nghiêng và vắt chéo chân sao cho logic và đưa ra hậu quả của các thói quen xấu đó. Nội dung được bạn viết lại không quá 5 dòng cho toàn bộ 3 thói quen đó, bỏ chủ ngữ như em, chị.... nội dung viết lại chia ra làm 2 mục: "Tình trạng hiện tại:" / "Và mong muốn cải thiện" dựa trên nội dung cung cấp từ khách hàng. Câu trả lời viết dưới dạng liệt kê các ý (chia ra làm 2 mục rõ ràng), không viết các nội dung thừa và không liên quan. Input: "${currentNote}"`;
      
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: prompt 
      });
      
      if (response && response.text) {
        const optimized = response.text.trim();
        setLocalNote(optimized);
        setCustomer(prev => ({ ...prev, note: optimized }));
      } else {
        throw new Error("AI không trả về kết quả.");
      }
    } catch (error) {
      console.error("AI Error:", error);
      showAlert("LỖI AI", "Không thể xử lý nội dung bằng AI lúc này. Vui lòng thử lại sau.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!localName) { showAlert("THÔNG BÁO", "Vui lòng nhập tên học viên!"); return; }
    if (!customer.video_date) { showAlert("THÔNG BÁO", "Vui lòng chọn nhóm video!"); return; }
    
    // Bật trạng thái điều hướng ngay lập tức
    setIsNavigating(true);
    
    try {
      // Recalculate end_date one last time to be absolutely sure
      let calculatedEndDate = customer.end_date;
      const startDate = parseVNDate(customer.start_date);
      if (startDate && customer.duration_days) {
        const endDate = addDays(startDate, customer.duration_days);
        calculatedEndDate = toInputDateString(endDate);
      }

      // Đảm bảo lấy dữ liệu mới nhất từ local state
      const payload = { 
        ...customer, 
        customer_name: localName,
        note: localNote,
        chewing_status: localChewing,
        require_google_auth: isFlagEnabled(customer.require_google_auth, true),
        require_device_limit: isFlagEnabled(customer.require_device_limit, true),
        sidebar_blocks_json: localBlocks,
        is_customized: isCustomized,
        end_date: calculatedEndDate || customer.end_date,
        duration_days: Number(customer.duration_days || 30)
      };
      
      console.log("PlanEditor: Saving student with payload:", payload);
      console.log("PlanEditor: Note being saved:", payload.note);
      console.log("PlanEditor: isCustomized state:", isCustomized);
      console.log("Tasks in state:", tasks.length);

      const finalTasks = tasks
        .map(t => ({
          day: Number(t.day || (t as any).Day || (t as any).n || (t as any).N || 0),
          type: t.type || "Bài bắt buộc",
          title: t.title || "",
          detail: t.detail || "",
          link: t.link || (t as any).Link || "",
          is_deleted: !!t.is_deleted,
          sort_order: Number(t.sort_order || (t as any).N || (t as any).n || 0)
        }))
        .filter(t => t.day > 0 && t.day <= 30 && !t.is_deleted);
      
      console.log(`Saving student with ${finalTasks.length} tasks (isCustomized: ${isCustomized})`);
      if (finalTasks.length > 0) {
        console.log("First task to save:", JSON.stringify(finalTasks[0]));
      }
      
      // 1. Thực hiện lưu trên server
      const result = await onUpsert(payload, finalTasks);

      if (!result || !result.customer_id) {
        throw new Error("Không nhận được phản hồi hợp lệ từ máy chủ sau khi lưu.");
      }

      // Cập nhật lại state customer tại chỗ để hiển thị link ngay lập tức
      setCustomer(result);
      setLocalName(result.customer_name || "");
      setLocalNote(result.note || "");
      setLocalChewing(result.chewing_status || "");
      setLocalBlocks(result.sidebar_blocks_json || []);

      // 2. Cập nhật cache Preview (phacdo_cache_...) với dữ liệu thật từ server
      // Luôn cache tasks hiện tại để preview mượt mà, dù là customized hay không
      const cacheTasks = tasks.filter(t => !t.is_deleted);
      
      try {
        localStorage.setItem(`phacdo_cache_${result.customer_id}`, JSON.stringify({
          customer: result,
          tasks: cacheTasks,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn("Could not cache to localStorage:", e);
      }

      // 3. Xóa cache PlanEditor để lần sau load lại từ server
      const cleanId = (payload.customer_id || 'new').trim();
      const cleanTemplateId = (templateId || 'none').trim();
      localStorage.removeItem(`plan_editor_cache_${cleanId}_${cleanTemplateId}`);

      // 4. Chuyển hướng với ID thật và Token thật
      if (returnTo === 'dashboard') {
        onNavigate('dashboard');
      } else {
        onNavigate('preview', { customerId: result.customer_id, token: result.token });
      }

    } catch (err: any) {
      setIsNavigating(false);
      showAlert("LỖI LƯU DỮ LIỆU", err.message || "Lỗi không xác định");
    }
  };

  const handleDelete = () => {
    showConfirm("XÁC NHẬN XÓA", `Xóa học viên ${customer.customer_name}?`, async () => {
      closeModal();
      setIsNavigating(true);
      
      const customerId = customer.customer_id;
      if (!customerId) {
        onNavigate('dashboard');
        return;
      }

      try {
        const cleanId = (customerId || '').trim();
        // 1. Xóa cache của chính phác đồ này
        localStorage.removeItem(`plan_editor_cache_${cleanId}_none`);

        // 2. Chuyển hướng về trang chủ NGAY LẬP TỨC
        onNavigate('dashboard');

        // 3. Thực hiện xóa trên server (App.tsx handles optimistic update of customers list)
        await onDelete(customerId);
      } catch (e) {
        console.error("Delete failed:", e);
      }
    });
  };

  const handleRestore = () => {
    showConfirm("XÁC NHẬN KHÔI PHỤC", `Khôi phục học viên ${customer.customer_name} về trạng thái hoạt động?`, async () => {
      closeModal();
      setLoading(true);
      try {
        if (customer.customer_id) {
          await api.upsertCustomer({ ...customer, status: CustomerStatus.ACTIVE });
          showAlert("THÀNH CÔNG", "Đã khôi phục học viên.");
          setCustomer(prev => ({ ...prev, status: CustomerStatus.ACTIVE }));
        }
      } catch (e) { showAlert("LỖI", "Không thể khôi phục."); } finally { setLoading(false); }
    });
  };

  const addSidebarBlock = () => {
    const newBlock: SidebarBlock = {
      id: 'sb_' + Date.now(),
      title: 'Khối thông tin mới',
      content: 'Nhập nội dung hiển thị tại đây...',
      type: 'default'
    };
    const next = [newBlock, ...localBlocks];
    setLocalBlocks(next);
    setCustomer(prev => ({ ...prev, sidebar_blocks_json: next }));
  };

  const updateSidebarBlock = (id: string, updates: Partial<SidebarBlock>, shouldSync = false) => {
    setLocalBlocks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, ...updates } : b);
      if (shouldSync || updates.type !== undefined || updates.is_chat !== undefined) {
        setCustomer(c => ({ ...c, sidebar_blocks_json: next }));
      }
      return next;
    });
  };

  const deleteSidebarBlock = (id: string) => {
    setLocalBlocks(prev => {
      const next = prev.filter(b => b.id !== id);
      setCustomer(c => ({ ...c, sidebar_blocks_json: next }));
      return next;
    });
  };

  const syncSidebarBlocks = () => {
    setCustomer(prev => ({ ...prev, sidebar_blocks_json: localBlocks }));
  };

  const handleCopyJson = () => {
    if (modalConfig.dataToCopy) {
      const jsonStr = JSON.stringify(modalConfig.dataToCopy, null, 2);
      navigator.clipboard.writeText(jsonStr);
      showAlert("THÀNH CÔNG", "Đã copy dữ liệu phác đồ!");
    }
  };

  const formatDateDisplay = (s: any) => {
    if (!s) return "";
    const str = String(s);
    const d = new Date(str);
    if (!isNaN(d.getTime())) return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return str;
  };

  const hasContent = customer.note && typeof customer.note === 'string' && customer.note.trim() !== "";

  const isMandatory = (task: ExerciseTask) => {
    const type = String(task.type || "").toLowerCase();
    return type.includes('bắt buộc') || type.includes('bat buoc');
  };

  const memoizedTasks = useMemo(() => {
    return [...tasks]
      .filter(t => t.day <= 30)
      .sort((a, b) => {
      const dayA = Number(a.day) || 0;
      const dayB = Number(b.day) || 0;
      if (dayA !== dayB) return dayA - dayB;
      
      const isAMandatory = isMandatory(a);
      const isBMandatory = isMandatory(b);
      
      if (isAMandatory && !isBMandatory) return -1;
      if (!isAMandatory && isBMandatory) return 1;
      return 0;
    });
  }, [tasks]);

  const handleTaskDelete = useCallback((index: number) => {
    setIsCustomized(true);
    setTasks(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleTaskEdit = useCallback((index: number, updates: Partial<ExerciseTask>) => {
    setIsCustomized(true);
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, ...updates } : t));
  }, []);

  const handleCopyPlan = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomers();
      // Filter out current customer if editing
      const filtered = data.filter(c => c.customer_id !== customerId);
      setAllCustomers(filtered);
      setIsCopyModalOpen(true);
    } catch (error) {
      console.error('Error fetching customers for copy:', error);
      setModalConfig({
        isOpen: true,
        type: 'alert',
        title: 'LỖI',
        message: 'Không thể tải danh sách phác đồ để sao chép.'
      });
    } finally {
      setLoading(false);
    }
  };

  const performCopy = async (sourceCustomer: Customer) => {
    try {
      setLoading(true);
      // Fetch source plan tasks
      const sourceTasks = await customPlanService.getCustomPlan(sourceCustomer.customer_id);
      
      setCustomer(prev => ({
        ...prev,
        note: sourceCustomer.note || prev.note,
        chewing_status: sourceCustomer.chewing_status || prev.chewing_status,
        sidebar_blocks_json: sourceCustomer.sidebar_blocks_json || prev.sidebar_blocks_json,
        app_title: sourceCustomer.app_title || prev.app_title,
        app_slogan: sourceCustomer.app_slogan || prev.app_slogan,
        duration_days: sourceCustomer.duration_days || prev.duration_days,
        video_date: sourceCustomer.video_date || prev.video_date,
        // Keep current start_date
      }));

      setLocalNote(sourceCustomer.note || "");
      setLocalChewing(sourceCustomer.chewing_status || "");
      setLocalBlocks(sourceCustomer.sidebar_blocks_json || []);

      setTasks(sourceTasks.filter(t => t.day <= 30));
      setIsCustomized(true);
      setIsCopyModalOpen(false);
    } catch (error) {
      console.error('Error copying plan:', error);
      setModalConfig({
        isOpen: true,
        type: 'alert',
        title: 'LỖI',
        message: 'Không thể sao chép dữ liệu phác đồ.'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomersForCopy = allCustomers.filter(c => 
    c.customer_name.toLowerCase().includes(copySearchTerm.toLowerCase()) ||
    c.customer_id.toLowerCase().includes(copySearchTerm.toLowerCase())
  );

  if (isNavigating) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <Loader2 size={48} className="animate-spin text-blue-600" />
        <p className="text-blue-900 font-bold uppercase tracking-widest text-xs">Đang lưu phác đồ...</p>
      </div>
    );
  }

  return (
    <Layout 
      title={
        <div className="flex items-center justify-between w-full gap-2">
          <span className="truncate uppercase">
            PHÁC ĐỒ: {customer.customer_name || 'TẠO MỚI'}
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleCopyPlan}
              disabled={loading || isSyncing}
              className="flex items-center gap-1.5 text-orange-600 hover:text-orange-800 font-black text-[11px] sm:text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shrink-0"
              title="Sao chép từ phác đồ khác"
            >
              <Copy size={14} />
              Sao chép
            </button>
            <button 
              onClick={handleSave}
              disabled={loading || isSyncing}
              className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-black text-[11px] sm:text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shrink-0"
            >
              {loading || isSyncing ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Lưu
            </button>
          </div>
        </div>
      }
      onBack={() => onNavigate('dashboard')}
      actions={
        <div className="flex gap-2">
          {isEditMode && (
            <div className="flex flex-col sm:flex-row items-center bg-blue-50 p-2 rounded-2xl gap-2 border border-blue-100">
              <div className="flex gap-1">
                <button 
                  onClick={() => { 
                    const dbToken = customer?.token && String(customer.token).trim() !== "" ? String(customer.token).trim() : "";
                    const dbCustomerId = customer?.customer_id || "";

                    if (!dbCustomerId) {
                      showAlert("THÔNG BÁO", "Vui lòng lưu phác đồ trước khi copy link.");
                      return;
                    }

                    // Always regenerate to ensure correct domain (phacdo.vercel.app)
                    const linkToCopy = generateCustomerLink(dbCustomerId, dbToken);
                    navigator.clipboard.writeText(linkToCopy); 
                    setCopyToast(true);
                    setTimeout(() => setCopyToast(false), 2000);
                  }} 
                  className="p-2 hover:bg-white rounded-lg text-blue-600 transition-all"
                  title="Copy Link"
                >
                  <Copy size={16} />
                </button>
                <button 
                  onMouseEnter={() => api.getPlanEditorData(undefined, customer.customer_id)}
                  onClick={() => onNavigate('plan-editor', { templateId: customer.customer_id })} 
                  className="p-2 hover:bg-white rounded-lg text-orange-600 transition-all" 
                  title="Nhân bản"
                >
                  <CopyPlus size={16} />
                </button>
                <button onClick={() => onNavigate('management', { customerId: customer.customer_id })} className="p-2 hover:bg-white rounded-lg text-purple-600 transition-all" title="Quản lý"><UserPlus size={16} /></button>
                <button 
                  onClick={customer.status === CustomerStatus.DELETED ? handleRestore : handleDelete} 
                  className={`p-2 rounded-lg transition-all ${customer.status === CustomerStatus.DELETED ? 'hover:bg-green-50 text-green-600' : 'hover:bg-red-50 text-red-500'}`}
                  title={customer.status === CustomerStatus.DELETED ? "Khôi phục" : "Xóa"}
                >
                  {customer.status === CustomerStatus.DELETED ? <RotateCcw size={16} /> : <Trash2 size={16} />}
                </button>
              </div>
            </div>
          )}
        </div>
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <RefreshCw size={48} className="animate-spin text-blue-600" />
          <p className="text-blue-900 font-bold uppercase tracking-widest text-xs animate-pulse">Đang nạp dữ liệu...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-40 gap-6 text-center">
          <AlertCircle size={64} className="text-red-500" />
          <div>
            <h3 className="text-xl font-bold text-blue-900 uppercase">Lỗi Kết Nối Máy Chủ</h3>
            <p className="text-gray-500 mt-2 max-w-md">{error}</p>
          </div>
          <Button variant="primary" onClick={fetchData}>
            <RefreshCw size={16} className="mr-2" /> THỬ LẠI
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6 sm:gap-10 pb-20">
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <Card className="flex flex-col gap-6 p-6 sm:p-8">
              <div className="flex flex-col gap-6">
                 <LineInput 
                   label="Tên học viên" 
                   placeholder="VÍ DỤ: NGUYỄN THỊ MAI" 
                   value={localName} 
                   onChange={e => setLocalName(e.target.value.toUpperCase())}
                   onBlur={() => setCustomer({...customer, customer_name: localName})}
                 />
                 <div className="grid grid-cols-2 gap-4">
                    <LineInput label="Ngày bắt đầu" type="date" value={customer.start_date} onChange={e => setCustomer({...customer, start_date: e.target.value})} />
                    <LineInput label="Số ngày tập" type="number" value={customer.duration_days} onChange={e => setCustomer({...customer, duration_days: parseInt(e.target.value) || 0})} />
                 </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">Nhóm video lộ trình</label>
                <div className="flex items-center gap-3">
                  <select 
                    className="line-input flex-1 cursor-pointer font-bold text-blue-900" 
                    value={customer.video_date} 
                    onChange={e => handleVideoDateChange(e.target.value)}
                  >
                    <option value="">-- Chọn nhóm video --</option>
                    {sortedDates.map(d => <option key={d.video_date} value={d.video_date}>{d.nhom}</option>)}
                  </select>
                  <Button variant="secondary" size="sm" onClick={manualSyncTemplate} disabled={!customer.video_date || isSyncing}>
                    <RefreshCw size={14} className={`mr-2 ${isSyncing ? 'animate-spin' : ''}`} /> {isSyncing ? "ĐANG ĐỒNG BỘ..." : "Đồng bộ mẫu"}
                  </Button>
                </div>
              </div>
            </Card>
            
            <Card className="flex flex-col gap-6 p-6 sm:p-8">
              <h3 className="text-sm font-bold text-blue-900 uppercase tracking-widest flex items-center justify-between">
                <div className="flex items-center gap-2"><ShoppingBag size={16} /> Đơn hàng & Sản phẩm</div>
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
              </h3>
              
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar border-b border-blue-50 pb-4">
                  {(customer.san_pham || []).map(item => (
                    <div key={item.id_sp} className="flex items-center justify-between group">
                      <div className="flex-1">
                        <div className="text-[12px] font-black text-blue-900 uppercase">{item.ten_sp}</div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                          <span className="text-[11px] font-bold text-gray-400">SL: <input type="number" className="w-8 bg-transparent outline-none font-bold text-blue-600 border-b border-blue-50 focus:border-blue-400" value={item.so_luong || 0} onChange={e => updateProductQty(item.id_sp, parseInt(e.target.value) || 0)} /></span>
                          <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
                            GIÁ: 
                            <input 
                              type="text" 
                              className="w-20 bg-transparent outline-none font-bold text-blue-900 border-b border-blue-50 focus:border-blue-400" 
                              value={formatVND(item.don_gia || 0)} 
                              onChange={e => updateProductPrice(item.id_sp, parseInt(e.target.value.replace(/\D/g, '')) || 0)} 
                            />
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-6">
                        <span className="text-sm font-black text-blue-600">{formatVND(item.thanh_tien)}</span>
                        <button 
                          onClick={() => {
                            const prod = products.find(p => p.id_sp === item.id_sp) || { id_sp: item.id_sp } as Product;
                            toggleProduct(prod);
                          }} 
                          className="text-red-200 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(customer.san_pham || []).length === 0 && (
                    <p className="text-center text-gray-400 italic text-xs py-4">Chưa chọn sản phẩm nào...</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">TỔNG THANH TOÁN</span>
                    <span className="text-xl font-black text-blue-600">{formatVND(customer.gia_tien || 0)}</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="flex flex-col gap-6 p-6 sm:p-8">
              <div className="flex flex-col gap-2">
                <label onClick={() => setIsChewingModalOpen(true)} className="text-[11px] font-bold text-blue-600 uppercase tracking-widest cursor-pointer hover:text-blue-800 flex items-center gap-1.5">Ăn nhai cân bằng <Maximize2 size={10} /></label>
                <div 
                  onClick={() => setIsChewingModalOpen(true)}
                  className="p-4 bg-gray-50/50 rounded-2xl border border-blue-50 text-sm font-medium text-blue-900 min-h-[96px] cursor-pointer hover:bg-blue-50/30 transition-all line-clamp-4 overflow-hidden"
                >
                  {localChewing || "Nhấn để nhập chỉ dẫn ăn nhai..."}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label onClick={() => setIsNoteModalOpen(true)} className="text-[11px] font-bold text-blue-600 uppercase tracking-widest cursor-pointer hover:text-blue-800 flex items-center gap-1.5">Tình trạng và mong muốn <Maximize2 size={10} /></label>
                  <div className="flex items-center gap-2">
                    <button onClick={handleAiOptimize} disabled={!hasContent || isAiProcessing} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-all shadow-sm" title="Phân tích bằng AI"><Sparkles size={18} className={isAiProcessing ? 'animate-pulse' : ''} /></button>
                    <button 
                      onClick={() => { 
                        if(originalNote) {
                          setLocalNote(originalNote);
                          setCustomer(prev => ({...prev, note: originalNote})); 
                        }
                      }} 
                      disabled={!originalNote} 
                      className="p-1.5 text-orange-500 hover:bg-orange-100 rounded-lg transition-all" 
                      title="Khôi phục nội dung gốc"
                    >
                      <RotateCcw size={18} />
                    </button>
                  </div>
                </div>
                <div 
                  onClick={() => setIsNoteModalOpen(true)}
                  className="p-4 bg-gray-50/50 rounded-2xl border border-blue-50 text-sm font-medium text-blue-900 min-h-[96px] cursor-pointer hover:bg-blue-50/30 transition-all line-clamp-4 overflow-hidden"
                >
                  {localNote || "Nhấn để nhập tình trạng học viên..."}
                </div>
              </div>
            </Card>

            <Card className="flex flex-col gap-6 p-6 sm:p-8">
              <h3 className="text-sm font-bold text-blue-900 uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert size={16} className="text-blue-600" /> Thanh công cụ Bảo mật
              </h3>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 transition-all hover:bg-blue-50">
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] font-black text-blue-900 uppercase">Xác thực Google (OAuth2)</span>
                    <span className="text-[10px] font-bold text-gray-400">Học viên phải đăng nhập Google để xem video</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={isFlagEnabled(customer.require_google_auth, true)}
                      onChange={e => setCustomer({...customer, require_google_auth: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 transition-all hover:bg-blue-50">
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] font-black text-blue-900 uppercase">Giới hạn thiết bị</span>
                    <span className="text-[10px] font-bold text-gray-400">Tối đa 2 thiết bị tự động duyệt, chặn từ thiết bị t3</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={isFlagEnabled(customer.require_device_limit, true)}
                      onChange={e => setCustomer({...customer, require_device_limit: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </Card>

            {isEditMode && <DeviceManagementCard customerId={customerId!} />}
          </section>

          <section>
             <div className="flex flex-col sm:flex-row items-center justify-end mb-8 px-1 gap-4">
               <Button variant="secondary" size="sm" onClick={addSidebarBlock} className="w-full sm:w-auto rounded-full shadow-lg shadow-blue-100"><Plus size={16} className="mr-2"/> THÊM KHỐI</Button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {localBlocks.map((block, idx) => (
                  <SidebarBlockCard 
                    key={block.id}
                    block={block}
                    onUpdate={updateSidebarBlock}
                    onDelete={deleteSidebarBlock}
                  />
                ))}
             </div>
          </section>

          <section className="bg-white rounded-[2.5rem] p-6 sm:p-10 border border-blue-50 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between mb-10 px-2 gap-4">
              <h3 className="text-[14px] font-black text-blue-900 uppercase tracking-[0.2em] flex items-center gap-2">
                LỊCH TRÌNH CHI TIẾT (HIỂN THỊ TỐI ĐA 30 NGÀY)
                <span className={`text-[10px] px-3 py-1 rounded-full border ${isCustomized ? 'bg-orange-100 text-orange-600 border-orange-200' : 'hidden'}`}>
                  {isCustomized ? 'ĐÃ TÙY CHỈNH RIÊNG' : ''}
                </span>
              </h3>
              <div className="flex flex-wrap gap-3 w-full sm:w-auto justify-center sm:justify-end">
                {isCustomized && (
                  <Button variant="outline" size="sm" onClick={clearCustomization} className="flex-1 sm:flex-none rounded-full">
                    <RefreshCw size={14} className="mr-2" /> XÓA TÙY CHỈNH
                  </Button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-blue-50 overflow-hidden shadow-sm">
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left min-w-[700px]">
                  <thead>
                    <tr className="bg-blue-50/50">
                      <th className="p-4 pl-8 text-[10px] font-black text-blue-700 uppercase tracking-widest w-20 text-center">NGÀY</th>
                      <th className="p-4 text-[10px] font-black text-blue-700 uppercase tracking-widest w-32">LOẠI</th>
                      <th className="p-4 text-[10px] font-black text-blue-700 uppercase tracking-widest">TÊN BÀI TẬP</th>
                      <th className="p-4 text-[10px] font-black text-blue-700 uppercase tracking-widest">LINK VIDEO</th>
                      <th className="p-4 text-[10px] font-black text-blue-700 uppercase tracking-widest w-20 text-center">XÓA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {memoizedTasks.map((t, idx) => (
                      <TaskRow 
                        key={idx}
                        task={t}
                        index={tasks.indexOf(t)}
                        onEdit={handleTaskEdit}
                        onDelete={handleTaskDelete}
                        isMandatory={isMandatory}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Copy Toast Notification */}
      {copyToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] bg-green-600 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center gap-2">
          <CheckCircle size={18} /> ĐÃ COPY LINK PHÁC ĐỒ!
        </div>
      )}

      {/* Modals for Details and Chewing instructions */}
      <Modal 
        isOpen={isCopyModalOpen} 
        onClose={() => setIsCopyModalOpen(false)} 
        title="SAO CHÉP DỮ LIỆU PHÁC ĐỒ" 
        maxWidth="max-w-2xl"
      >
        <div className="flex flex-col gap-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Tìm kiếm theo tên học viên hoặc mã ID..."
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-blue-300 transition-all font-medium"
              value={copySearchTerm}
              onChange={e => setCopySearchTerm(e.target.value)}
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-2">
            {filteredCustomersForCopy.length > 0 ? (
              filteredCustomersForCopy.map(c => (
                <div 
                  key={c.customer_id}
                  onClick={() => performCopy(c)}
                  className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all group"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-blue-900 uppercase group-hover:text-blue-600 transition-colors">{c.customer_name}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">ID: {c.customer_id} • {c.duration_days} ngày</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bắt đầu</div>
                      <div className="text-xs font-bold text-blue-900">{formatVNDate(c.start_date)}</div>
                    </div>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <Copy size={16} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400 font-medium">Không tìm thấy phác đồ nào phù hợp...</p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isNoteModalOpen} 
        onClose={() => setIsNoteModalOpen(false)} 
        title="MÔ TẢ TÌNH TRẠNG & MONG MUỐN" 
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => {
              setLocalNote(customer.note || "");
              setIsNoteModalOpen(false);
            }}>HỦY</Button>
            <Button variant="primary" onClick={() => {
              setCustomer(prev => ({ ...prev, note: localNote }));
              setIsNoteModalOpen(false);
            }}>XÁC NHẬN</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-end gap-3 mb-2 px-1">
             <div className="flex items-center gap-2">
                <button 
                  onClick={handleAiOptimize} 
                  disabled={!hasContent || isAiProcessing} 
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all border border-blue-100 shadow-sm group disabled:opacity-50"
                >
                  {isAiProcessing ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} className="group-hover:scale-110 transition-transform" />}
                  <span className="text-[10px] font-black uppercase tracking-widest">Phân tích bằng AI</span>
                </button>
                <button 
                  onClick={() => { 
                    if(originalNote) {
                      setLocalNote(originalNote);
                      setCustomer(prev => ({...prev, note: originalNote})); 
                    }
                  }} 
                  disabled={!originalNote} 
                  className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-xl transition-all border border-orange-100 shadow-sm group disabled:opacity-50"
                >
                  <RotateCcw size={16} className="group-hover:-rotate-45 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Khôi phục gốc</span>
                </button>
             </div>
          </div>
          <textarea 
            className="w-full h-96 p-8 bg-blue-50/30 border border-blue-50 rounded-[2rem] outline-none text-sm font-medium leading-relaxed resize-none focus:bg-white focus:border-blue-300 transition-all custom-scrollbar"
            placeholder="Nhập chi tiết tình trạng học viên (ăn nhai, nằm nghiêng, vắt chéo chân...)"
            value={localNote}
            onChange={e => setLocalNote(e.target.value)}
          />
        </div>
      </Modal>

      <Modal 
        isOpen={isChewingModalOpen} 
        onClose={() => setIsChewingModalOpen(false)} 
        title="CHỈ DẪN ĂN NHAI CÂN BẰNG" 
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => {
              setLocalChewing(customer.chewing_status || "");
              setIsChewingModalOpen(false);
            }}>HỦY</Button>
            <Button variant="primary" onClick={() => {
              setCustomer(prev => ({ ...prev, chewing_status: localChewing }));
              setIsChewingModalOpen(false);
            }}>XÁC NHẬN</Button>
          </>
        }
      >
        <textarea 
          className="w-full h-64 p-8 bg-blue-50/30 border border-blue-50 rounded-[2rem] outline-none text-sm font-medium leading-relaxed resize-none focus:bg-white focus:border-blue-300 transition-all custom-scrollbar"
          placeholder="Nhập hướng dẫn ăn nhai chi tiết..."
          value={localChewing}
          onChange={e => setLocalChewing(e.target.value)}
        />
      </Modal>

      <Modal 
        isOpen={modalConfig.isOpen} 
        onClose={closeModal} 
        title={modalConfig.title}
        footer={
          modalConfig.type === 'confirm' ? (
            <>
              <Button variant="ghost" size="sm" onClick={closeModal}>HỦY</Button>
              <Button variant="primary" size="sm" onClick={modalConfig.onConfirm}>ĐỒNG Ý</Button>
            </>
          ) : modalConfig.type === 'save_error' ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleCopyJson}><Copy size={14} className="mr-2"/> COPY JSON</Button>
              <Button variant="primary" size="sm" onClick={closeModal}>ĐÓNG</Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={closeModal}>ĐÃ HIỂU</Button>
          )
        }
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle size={48} className={modalConfig.type === 'save_error' ? "text-red-500" : "text-orange-500"} />
          <p className="font-medium text-gray-600 leading-relaxed">{modalConfig.message}</p>
        </div>
      </Modal>
    </Layout>
  );
};

const DeviceManagementCard: React.FC<{ customerId: string }> = ({ customerId }) => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const fetchDevices = async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const data = await customerService.getDevices(customerId);
      setDevices(data);
      // Auto expand if there are pending devices
      if (data.some((d: any) => !d.is_approved)) {
        setIsCollapsed(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [customerId]);



  const handleToggleApprove = async (device: any) => {
    try {
      await customerService.updateDevice(device.id, { is_approved: !device.is_approved });
      fetchDevices();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (deviceId: string) => {
    if (!confirm("Bạn có chắc chắn muốn XÓA VĨNH VIỄN thiết bị này? Học viên sẽ được giải phóng 1 lượt đăng ký.")) return;
    try {
      await customerService.deleteDevice(deviceId);
      fetchDevices();
      setSelectedIds(prev => prev.filter(id => id !== deviceId));
    } catch (e) { console.error(e); }
  };

  return (
    <Card className={`flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? 'p-0 h-auto' : 'p-6 sm:p-8'}`}>
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`flex items-center justify-between cursor-pointer transition-all ${isCollapsed ? 'p-6 sm:p-8 hover:bg-slate-50' : 'mb-6'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border transition-colors ${isCollapsed ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-blue-100 border-blue-200 text-blue-600'}`}>
            <Maximize2 size={18} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
              Quản lý thiết bị
              {devices.length > 0 && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black">
                  {devices.length}
                </span>
              )}
            </h3>
            {isCollapsed && devices.some(d => !d.is_approved) && (
              <span className="text-[9px] font-black text-red-500 animate-pulse uppercase mt-0.5">Yêu cầu chờ duyệt!</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">

          {isCollapsed ? <ChevronRight size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-blue-400" />}
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={28} className="animate-spin text-blue-300" />
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-10 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
              <p className="text-slate-400 italic text-[11px] font-bold">Chưa có thiết bị nào đăng ký cho học viên này.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-black text-blue-300 uppercase tracking-widest border-b border-blue-50 mb-2">
                <div className="col-span-1 flex justify-center">Duyệt</div>
                <div className="col-span-6">Tên thiết bị / ID</div>
                <div className="col-span-3">Ngày đăng ký</div>
                <div className="col-span-2 text-right">Thao tác</div>
              </div>
              
              {devices.map(d => (
                <div 
                  key={d.id} 
                  className={`relative grid grid-cols-12 items-center gap-3 p-4 rounded-2xl border transition-all ${d.is_approved ? 'bg-white border-blue-50 hover:border-blue-100 hover:shadow-sm' : 'bg-red-50/30 border-red-100 ring-1 ring-red-500/10'} `}
                >
                  <div className="col-span-1 flex justify-center">
                      <Toggle 
                        checked={d.is_approved}
                        onChange={() => handleToggleApprove(d)}
                        color="peer-checked:bg-emerald-500"
                      />
                  </div>

                  <div className="col-span-11 sm:col-span-6 flex flex-col gap-0.5 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className={`text-[13px] font-black uppercase truncate ${d.is_approved ? 'text-blue-900' : 'text-red-900'}`}>
                        {d.device_name || 'Thiết bị lạ'}
                      </span>
                      {!d.is_approved && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-md animate-pulse">
                          <AlertCircle size={10} /> CHỜ DUYỆT
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 font-mono tracking-tight truncate">{d.device_id}</span>
                  </div>

                  <div className="col-span-12 sm:col-span-3 flex flex-col sm:items-start pl-8 sm:pl-0 mt-2 sm:mt-0">
                    <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-300" />
                      {new Date(d.last_used_at || d.created_at).toLocaleDateString('vi-VN')}
                    </span>
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">
                      {new Date(d.last_used_at || d.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="col-span-12 sm:col-span-2 text-right flex justify-end gap-1 mt-2 sm:mt-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-200 hover:text-red-500 hover:bg-red-100 transition-all border border-transparent hover:border-red-100"
                      title="Xóa vĩnh viễn"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
