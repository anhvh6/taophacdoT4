
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Plus, Trash2, Calendar, CheckSquare, Square, Loader2, ChevronDown, Target, CheckCircle2, Zap, Users, RefreshCw, AlertCircle, Play, FileSpreadsheet, Edit3, Eye, Home, ArrowUpDown, Filter, Copy, X, Check } from 'lucide-react';
import { Layout as MainLayout } from '../components/Layout';
import { Button, LineInput, Modal, Toast } from '../components/UI';
import { api } from '../services/api';
import { VideoGroup, ExerciseTask, ExerciseType, Customer } from '../types';
import { EXERCISE_TYPES } from '../constants';
import { formatDDMM, formatDDMMYYYY, toISODateKey } from '../utils/date';

export const VideoGroupManagement: React.FC<{ onNavigate: (page: string, params?: any) => void }> = ({ onNavigate }) => {
  const [groups, setGroups] = useState<VideoGroup[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [tasks, setTasks] = useState<ExerciseTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<ExerciseTask | null>(null);
  const [newGroupDate, setNewGroupDate] = useState(""); 
  const [newGroupName, setNewGroupName] = useState("");
  const [contentSearch, setContentSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<{task: ExerciseTask, groupDateKey: string} | null>(null);
  const [newTaskData, setNewTaskData] = useState<Partial<ExerciseTask>>({ day: 1, type: ExerciseType.MANDATORY, title: "", detail: "", link: "" });
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; type: 'task' | 'group'; payload: any; title: string; message: string; }>({ isOpen: false, type: 'task', payload: null, title: "", message: "" });
  const [isStudentStatsModalOpen, setIsStudentStatsModalOpen] = useState(false);
  const [studentStats, setStudentStats] = useState<Customer[]>([]);
  const [studentStatsLoading, setStudentStatsLoading] = useState(false);
  const [studentSortConfig, setStudentSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [studentFilterConfig, setStudentFilterConfig] = useState<boolean | null>(null);
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | 'active' | 'finished'>('all');
  const [editingStudents, setEditingStudents] = useState<Record<string, Partial<Customer>>>({});
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' } | null>(null);

  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  const fetchStudentStats = async () => {
    if (selectedKeys.length === 0) return;
    setStudentStatsLoading(true);
    setIsStudentStatsModalOpen(true);
    try {
      const allCustomers = await api.getCustomers();
      const filtered = allCustomers.filter(c => 
        c.video_date && selectedKeys.includes(toISODateKey(c.video_date)) && c.status === 'ACTIVE'
      );
      setStudentStats(filtered);
      setEditingStudents({});
    } catch (e) {
      console.error("Lỗi tải thông tin học viên:", e);
      alert("Không thể tải thông tin học viên.");
    } finally {
      setStudentStatsLoading(false);
    }
  };

  const calculateRemainingDays = (endDateStr: string) => {
    if (!endDateStr) return 0;
    const end = new Date(endDateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleSaveStudentStats = async () => {
    const studentsToUpdate = Object.keys(editingStudents);
    if (studentsToUpdate.length === 0) {
      setIsStudentStatsModalOpen(false);
      return;
    }

    setSaving(true);
    try {
      for (const id of studentsToUpdate) {
        const original = studentStats.find(s => s.customer_id === id);
        if (original) {
          const updates = editingStudents[id];
          await api.upsertCustomer({ ...original, ...updates });
        }
      }
      // Refresh
      const allCustomers = await api.getCustomers();
      const filtered = allCustomers.filter(c => 
        c.video_date && selectedKeys.includes(toISODateKey(c.video_date)) && c.status === 'ACTIVE'
      );
      setStudentStats(filtered);
      setEditingStudents({});
      setToast({ message: "Đã lưu thay đổi thành công!" });
      setIsStudentStatsModalOpen(false);
    } catch (e) {
      console.error("Lỗi khi lưu thông tin học viên:", e);
      alert("Lỗi khi lưu thông tin học viên.");
    } finally {
      setSaving(false);
    }
  };

  const processedStudents = useMemo(() => {
    let result = [...studentStats];

    // Filter by customization
    if (studentFilterConfig !== null) {
      result = result.filter(s => {
        const isCustomized = editingStudents[s.customer_id]?.is_customized ?? s.is_customized;
        return isCustomized === studentFilterConfig;
      });
    }

    // Filter by status
    if (studentStatusFilter !== 'all') {
      result = result.filter(s => {
        const remainingDays = calculateRemainingDays(s.end_date);
        return studentStatusFilter === 'active' ? remainingDays >= 0 : remainingDays < 0;
      });
    }

    // Sort
    if (studentSortConfig) {
      result.sort((a, b) => {
        let valA: any = a[studentSortConfig.key as keyof Customer];
        let valB: any = b[studentSortConfig.key as keyof Customer];

        if (studentSortConfig.key === 'remainingDays') {
          valA = calculateRemainingDays(a.end_date);
          valB = calculateRemainingDays(b.end_date);
        } else if (studentSortConfig.key === 'email') {
          valA = (editingStudents[a.customer_id]?.email ?? (a.email || "")).toLowerCase();
          valB = (editingStudents[b.customer_id]?.email ?? (b.email || "")).toLowerCase();
        } else if (studentSortConfig.key === 'start_date') {
          valA = new Date(a.start_date || 0).getTime();
          valB = new Date(b.start_date || 0).getTime();
        }

        if (valA < valB) return studentSortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return studentSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [studentStats, studentSortConfig, studentFilterConfig, editingStudents]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(contentSearch), 300);
    return () => clearTimeout(handler);
  }, [contentSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const groupStats = useMemo(() => {
    const selectedGroups = groups.filter(g => selectedKeys.includes(g.video_date_key));
    const studentCount = selectedGroups.reduce((acc, curr) => acc + (curr.active_students || 0), 0);
    
    if (tasks.length > 0) {
      return {
        totalTasks: tasks.length,
        mandatory: tasks.filter(t => String(t.type || "").toLowerCase().includes('bắt buộc') || String(t.type || "").toLowerCase().includes('bat buoc')).length,
        optional: tasks.filter(t => !String(t.type || "").toLowerCase().includes('bắt buộc') && !String(t.type || "").toLowerCase().includes('bat buoc')).length,
        uniqueDays: new Set(tasks.map(t => t.day)).size,
        studentCount
      };
    }

    return {
      totalTasks: selectedGroups.reduce((acc, curr) => acc + (Number(curr.total_tasks) || 0), 0),
      mandatory: selectedGroups.reduce((acc, curr) => acc + (Number(curr.mandatory_tasks) || 0), 0),
      optional: selectedGroups.reduce((acc, curr) => acc + (Number(curr.optional_tasks) || 0), 0),
      uniqueDays: selectedGroups.reduce((acc, curr) => acc + (Number(curr.total_days) || 0), 0),
      studentCount
    };
  }, [tasks, groups, selectedKeys]);

  const fetchTasksForSelected = useCallback(async (keys: string[]) => {
    if (!keys.length) { setTasks([]); return; }
    setTasksLoading(true);
    try {
      const results = await Promise.all(keys.map(k => api.getPlan("NEW", k)));
      const all: ExerciseTask[] = [];
      results.forEach((data, idx) => {
        if (Array.isArray(data)) {
          all.push(...data.map((t, index) => ({ 
            ...t, 
            id: t.id || `task-${keys[idx]}-${index}`,
            video_date: formatDDMM(keys[idx]), 
            _video_date_key: keys[idx] 
          })));
        }
      });
      setTasks(all.sort((a, b) => {
        const dayA = Number(a.day) || 0;
        const dayB = Number(b.day) || 0;
        if (dayA !== dayB) return dayA - dayB;
        
        const isAMandatory = String(a.type || "").toLowerCase().includes('bắt buộc') || String(a.type || "").toLowerCase().includes('bat buoc');
        const isBMandatory = String(b.type || "").toLowerCase().includes('bắt buộc') || String(b.type || "").toLowerCase().includes('bat buoc');
        
        if (isAMandatory && !isBMandatory) return -1;
        if (!isAMandatory && isBMandatory) return 1;
        return 0;
      }));
    } catch (e) { 
      console.error("Lỗi tải bài tập:", e); 
      setTasks([]);
    } finally { 
      setTasksLoading(false); 
    }
  }, []);

  const fetchInitialData = useCallback(async (targetKeyToSelect?: string) => {
    setLoading(true);
    try {
      const data = await api.getVideoGroups();
      const sortedGroups = Array.isArray(data) ? [...data].sort((a, b) => b.video_date_key.localeCompare(a.video_date_key)) : [];
      setGroups(sortedGroups);
      
      let keyToUse = targetKeyToSelect;
      if (!keyToUse && sortedGroups.length > 0) {
        keyToUse = sortedGroups[0].video_date_key;
      }
      
      if (keyToUse) {
        setSelectedKeys([keyToUse]);
      }
    } catch (e) { 
      console.error("Lỗi khởi tạo:", e); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { 
    fetchInitialData(); 
  }, []); 

  useEffect(() => { 
    if (!loading && selectedKeys.length > 0) {
      fetchTasksForSelected(selectedKeys); 
    } else if (!loading && selectedKeys.length === 0) {
      setTasks([]);
    }
  }, [selectedKeys, loading, fetchTasksForSelected]);

  const handleConfirmedDelete = async () => {
    const { type, payload } = confirmDelete;
    setConfirmDelete(prev => ({ ...prev, isOpen: false }));
    if (type === 'task') {
      setTasksLoading(true);
      try {
        await api.deleteVideoTask(payload.id!);
        await fetchTasksForSelected(selectedKeys);
      } catch (e) { alert("Xóa thất bại"); } finally { setTasksLoading(false); }
    } else {
      try {
        await api.deleteVideoGroup(payload.video_date_key);
        setGroups(prev => prev.filter(g => g.video_date_key !== payload.video_date_key));
        setSelectedKeys(prev => prev.filter(k => k !== payload.video_date_key));
      } catch (e) { alert("Xóa nhóm thất bại"); }
    }
  };

  const exportToExcel = () => {
    if (tasks.length === 0) return alert("Không có dữ liệu để xuất!");
    const headers = ["Ngày tập", "Loại", "Tên bài tập", "Chi tiết", "Link Video", "Nhóm Video"];
    const rows = tasks.map(t => [t.day, t.type, t.title, (t.detail || "").replace(/\n/g, ' '), t.link, t.video_date]);
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PhacDoMau_${selectedKeys.length === 1 ? formatDDMM(selectedKeys[0]).replace(/\//g, '-') : 'TongHop'}.csv`;
    link.click();
  };

  const filteredTasks = useMemo(() => {
    const s = debouncedSearch.toLowerCase();
    return s ? tasks.filter(t => (t.title || "").toLowerCase().includes(s) || (t.detail || "").toLowerCase().includes(s)) : tasks;
  }, [tasks, debouncedSearch]);

  const handleEditClick = (e: React.MouseEvent, task: ExerciseTask) => {
    e.stopPropagation();
    setEditingTask({ task, groupDateKey: task._video_date_key! });
    setNewTaskData(task);
    setIsTaskModalOpen(true);
  };

  return (
    <MainLayout title="QUẢN LÝ PHÁC ĐỒ MẪU" onBack={() => onNavigate('dashboard')} actions={
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => onNavigate('dashboard')}><Home size={14} className="mr-1.5" /> Home</Button>
        <Button variant="secondary" size="sm" onClick={() => onNavigate('management')}><Users size={14} className="mr-1.5" /> Học viên</Button>
        <Button variant="secondary" size="sm" onClick={() => onNavigate('plan-editor')}><Plus size={14} className="mr-1.5" /> Tạo PĐ</Button>
        <Button variant="outline" size="sm" onClick={exportToExcel} disabled={tasks.length === 0}><FileSpreadsheet size={16} className="mr-2 text-green-600" /> XUẤT EXCEL</Button>
        {selectedKeys.length === 1 && (
          <Button variant="primary" size="sm" onClick={() => { setIsTaskModalOpen(true); setEditingTask(null); setNewTaskData({ day: 1, type: ExerciseType.MANDATORY, title: "", detail: "", link: "" }); }}><Plus size={16} className="mr-2" /> THÊM BÀI TẬP</Button>
        )}
      </div>
    }>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-x-8 gap-y-2 px-6 py-4 bg-white border border-blue-100 rounded-[2rem] shadow-sm mb-2 items-center">
          <div className="text-[13px] font-bold text-blue-900 flex items-center gap-2">
            <Target size={14} className="text-blue-600" />
            Tổng bài tập: <span className="text-blue-600 font-black">{groupStats.totalTasks}</span>
          </div>
          <div className="text-[13px] font-bold text-blue-900 flex items-center gap-2">
            <Zap size={14} className="text-orange-500" />
            Bắt buộc: <span className="text-orange-500 font-black">{groupStats.mandatory}</span>
          </div>
          <div className="text-[13px] font-bold text-blue-900 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-500" />
            Bổ trợ: <span className="text-green-500 font-black">{groupStats.optional}</span>
          </div>
          <div className="text-[13px] font-bold text-blue-900 flex items-center gap-2">
            <Calendar size={14} className="text-blue-500" />
            Ngày tập: <span className="text-blue-500 font-black">{groupStats.uniqueDays}</span>
          </div>
          <div className="text-[13px] font-bold text-blue-900 flex items-center gap-2 cursor-pointer hover:bg-blue-50 p-2 rounded-xl transition-all" onClick={fetchStudentStats}>
            <Users size={14} className="text-purple-500" />
            Học viên: <span className="text-purple-500 font-black">{groupStats.studentCount}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 flex flex-col gap-2" ref={dropdownContainerRef}>
            <label className="text-[11px] font-black text-blue-600 uppercase tracking-widest px-1">Chọn Nhóm Video</label>
            <div className="relative">
              <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="w-full bg-white border border-blue-100 rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-sm hover:border-blue-300 transition-all text-sm font-bold text-blue-900">
                <div className="flex items-center gap-2"><Calendar size={18} className="text-blue-500" /><span>{selectedKeys.length} nhóm đang chọn</span></div>
                <ChevronDown size={18} className={`text-blue-300 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-[100] mt-2 bg-white border border-blue-50 rounded-2xl shadow-2xl max-h-80 overflow-y-auto p-2 animate-in fade-in slide-in-from-top-2">
                  <button onClick={() => { setIsNewGroupModalOpen(true); setIsDropdownOpen(false); }} className="w-full mb-2 flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase shadow-md"><Plus size={16} /> Thêm nhóm mới</button>
                  {groups.map(g => (
                    <div key={g.video_date_key} className={`flex items-center justify-between hover:bg-blue-50 rounded-xl p-3 cursor-pointer group ${selectedKeys.includes(g.video_date_key) ? 'bg-blue-50/50' : ''}`} onClick={() => setSelectedKeys(prev => prev.includes(g.video_date_key) ? prev.filter(k => k !== g.video_date_key) : [...prev, g.video_date_key])}>
                      <div className="flex items-center gap-3">{selectedKeys.includes(g.video_date_key) ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-gray-300" />}<span className="text-sm font-bold text-blue-900">{formatDDMM(g.video_date)} {g.nhom}</span></div>
                      {(g.active_students || 0) === 0 && (
                        <button onClick={e => { e.stopPropagation(); setConfirmDelete({ isOpen: true, type: 'group', payload: g, title: "XÓA NHÓM", message: `Xóa nhóm ngày ${formatDDMMYYYY(g.video_date)}?` }); }} className="text-red-200 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-8 flex flex-col gap-2">
            <label className="text-[11px] font-black text-blue-600 uppercase tracking-widest px-1">Tìm bài tập</label>
            <div className="relative"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" /><input className="w-full bg-white border border-blue-100 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-blue-900 outline-none focus:border-blue-300 shadow-sm" placeholder="Tìm tên bài hoặc chi tiết..." value={contentSearch} onChange={e => setContentSearch(e.target.value)} /></div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-blue-50 shadow-xl overflow-hidden min-h-[400px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-blue-900 text-white">
                <tr>
                  <th className="p-4 text-[10px] font-black uppercase w-16 text-center">STT</th>
                  <th className="p-4 text-[10px] font-black uppercase w-24">Nhóm</th>
                  <th className="p-4 text-[10px] font-black uppercase w-16 text-center">Day</th>
                  <th className="p-4 text-[10px] font-black uppercase w-40">Loại</th>
                  <th className="p-4 text-[10px] font-black uppercase">Tên bài tập</th>
                  <th className="p-4 text-[10px] font-black uppercase w-24 text-center">Thao tác</th>
                  <th className="p-4 text-center text-[10px] font-black uppercase w-16">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tasksLoading ? (
                  <tr><td colSpan={7} className="p-20 text-center"><Loader2 size={32} className="animate-spin text-blue-600 mx-auto" /><p className="mt-4 text-[10px] font-black text-blue-400 uppercase tracking-widest">Đang tải phác đồ...</p></td></tr>
                ) : filteredTasks.map((t, idx) => (
                  <tr key={idx} className={`${!t.link ? 'bg-blue-50/40' : 'bg-white'} hover:bg-blue-100/40 cursor-pointer transition-colors`} onClick={() => {setViewingTask(t); setIsViewModalOpen(true);}}>
                    <td className="p-4 text-center text-[10px] font-bold text-gray-400">#{idx + 1}</td>
                    <td className="p-4 text-[11px] font-black text-blue-600">
                      {t.nhom || groups.find(g => g.video_date_key === t._video_date_key)?.nhom || t.video_date}
                    </td>
                    <td className="p-4 text-sm font-black text-blue-900 text-center">{t.day}</td>
                    <td className="p-4 whitespace-nowrap"><span className={`text-[10px] font-black px-3 py-1.5 rounded-full border shadow-sm ${String(t.type || "").toLowerCase().includes('bắt buộc') || String(t.type || "").toLowerCase().includes('bat buoc') ? 'bg-blue-600 text-white border-blue-600' : 'bg-green-100 text-green-700 border-green-200'}`}>{t.type}</span></td>
                    <td className="p-4 text-sm font-black text-blue-900">
                      <div className="flex items-center gap-2">{t.link && <Play size={14} className="text-blue-600" fill="currentColor" />}<span>{t.title}</span></div>
                    </td>
                    <td className="p-4 text-center">
                       <span onClick={(e) => handleEditClick(e, t)} className="text-[10px] font-black text-blue-600 uppercase underline cursor-pointer hover:text-blue-800 flex items-center justify-center gap-1"><Edit3 size={12} /> Sửa</span>
                    </td>
                    <td className="p-4 text-center"><button onClick={e => { e.stopPropagation(); setConfirmDelete({ isOpen: true, type: 'task', payload: t, title: "XÓA BÀI", message: `Xóa bài "${t.title}"?` }); }} className="text-red-200 hover:text-red-500 transition-all active:scale-90"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
                {!tasksLoading && filteredTasks.length === 0 && (
                  <tr><td colSpan={7} className="p-24 text-center text-gray-400 italic font-medium">Không tìm thấy bài tập nào trong các nhóm đã chọn.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={isNewGroupModalOpen} onClose={() => setIsNewGroupModalOpen(false)} title="TẠO NHÓM MỚI">
        <LineInput label="Ngày khởi tạo" type="date" value={newGroupDate} onChange={e => setNewGroupDate(e.target.value)} />
        <LineInput label="Tên nhóm" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Ví dụ: Gốc 1_Đổi tên_Gán" />
        <Button variant="primary" className="w-full mt-6" onClick={async () => {
          if (!newGroupDate) return alert("Vui lòng chọn ngày");
          setIsCreatingGroup(true);
          try {
            await api.saveVideoGroupTasks(newGroupDate, [{ day: 1, type: ExerciseType.MANDATORY, title: "Khởi động phác đồ", detail: "Bài tập mặc định", link: "", is_deleted: false }], newGroupName);
            await fetchInitialData(toISODateKey(newGroupDate));
            setIsNewGroupModalOpen(false);
            setNewGroupName("");
            setNewGroupDate("");
          } catch (e: any) {
            console.error("Lỗi khởi tạo nhóm:", e);
            alert("Lỗi khởi tạo nhóm: " + (e.message || "Không xác định"));
          } finally { setIsCreatingGroup(false); }
        }} disabled={isCreatingGroup || !newGroupDate}>{isCreatingGroup ? <Loader2 size={16} className="animate-spin" /> : "KHỞI TẠO"}</Button>
      </Modal>

      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title={editingTask ? "SỬA BÀI TẬP MẪU" : "THÊM BÀI TẬP MẪU"} maxWidth="max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <LineInput type="number" label="Ngày tập" value={newTaskData.day ?? 1} onChange={e => setNewTaskData({...newTaskData, day: parseInt(e.target.value) || 1})} />
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mt-4">Loại bài tập</label>
            <select className="line-input font-bold" value={newTaskData.type || ''} onChange={e => setNewTaskData({...newTaskData, type: e.target.value as ExerciseType})}>{EXERCISE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
          </div>
        </div>
        <LineInput label="Tiêu đề bài tập" value={newTaskData.title || ''} onChange={e => setNewTaskData({...newTaskData, title: e.target.value})} />
        <LineInput isTextArea label="Nội dung chi tiết" className="h-48" value={newTaskData.detail || ''} onChange={e => setNewTaskData({...newTaskData, detail: e.target.value})} />
        <LineInput label="Link Video hướng dẫn" value={newTaskData.link || ''} onChange={e => setNewTaskData({...newTaskData, link: e.target.value})} />
        <Button variant="primary" className="w-full mt-6 py-4" onClick={async () => {
          setSaving(true);
          try {
            const currentGroupKey = editingTask ? editingTask.groupDateKey : selectedKeys[0];
            const groupData = groups.find(g => g.video_date_key === currentGroupKey);
            if (!groupData) return;
            const currentGroupTasks = tasks.filter(x => x._video_date_key === currentGroupKey);
            const nextTasks = editingTask 
              ? currentGroupTasks.map(x => x.id === editingTask.task.id ? (newTaskData as ExerciseTask) : x) 
              : [...currentGroupTasks, { ...newTaskData, id: `new-task-${Date.now()}` } as ExerciseTask];
            await api.saveVideoGroupTasks(groupData.video_date, nextTasks, groupData.nhom);
            await fetchTasksForSelected(selectedKeys);
            setIsTaskModalOpen(false);
          } finally { setSaving(false); }
        }} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin mr-2" /> : "LƯU THAY ĐỔI"}</Button>
      </Modal>

      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="CHI TIẾT BÀI TẬP" maxWidth="max-w-3xl">
        {viewingTask && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-blue-50 pb-4">
               <div><div className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">Ngày {viewingTask.day} • {viewingTask.type}</div><h2 className="text-2xl font-black text-blue-900 leading-tight">{viewingTask.title}</h2></div>
               {viewingTask.link && <button onClick={() => window.open(viewingTask.link, '_blank')} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase shadow-lg shadow-blue-100 transition-all active:scale-95"><Play size={14} fill="currentColor" /> Xem Video</button>}
            </div>
            <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-50 max-h-96 overflow-y-auto custom-scrollbar"><p className="text-base text-gray-700 leading-relaxed font-medium whitespace-pre-line text-justify">{viewingTask.detail || "Nội dung đang được cập nhật..."}</p></div>
            <div className="flex justify-end gap-3 mt-2"><Button variant="ghost" onClick={() => setIsViewModalOpen(false)}>Đóng</Button><Button variant="primary" onClick={(e) => { setIsViewModalOpen(false); handleEditClick(e as any, viewingTask!); }}><Edit3 size={14} className="mr-2" /> CHỈNH SỬA</Button></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={confirmDelete.isOpen} onClose={() => setConfirmDelete(prev => ({...prev, isOpen: false}))} title={confirmDelete.title}>
        <div className="text-center py-4"><AlertCircle size={32} className="text-red-500 mx-auto mb-4" /><p className="font-medium text-gray-600">{confirmDelete.message}</p><div className="flex gap-3 mt-6"><Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(prev => ({...prev, isOpen: false}))}>HỦY</Button><Button variant="danger" className="flex-1" onClick={handleConfirmedDelete}>XÓA</Button></div></div>
      </Modal>

      <Modal isOpen={isStudentStatsModalOpen} onClose={() => setIsStudentStatsModalOpen(false)} title="THỐNG KÊ CHI TIẾT HỌC VIÊN" maxWidth="max-w-6xl">
        <div className="flex flex-col gap-4">
          <div className="absolute top-6 right-8 z-20 flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsStudentStatsModalOpen(false)}>ĐÓNG</Button>
            <Button variant="primary" size="sm" onClick={handleSaveStudentStats} disabled={saving || Object.keys(editingStudents).length === 0}>
              {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : <Check size={14} className="mr-2" />}
              LƯU
            </Button>
          </div>
          <div className="bg-white rounded-2xl border border-blue-50 shadow-sm overflow-hidden min-h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-blue-900 text-white">
                  <tr>
                    <th className="p-4 text-[10px] font-black uppercase w-12 text-center">STT</th>
                    <th className="p-4 text-[10px] font-black uppercase">Tên học viên</th>
                    <th className="p-4 text-[10px] font-black uppercase w-32 cursor-pointer hover:bg-blue-800 transition-colors" onClick={() => setStudentSortConfig(prev => ({ key: 'start_date', direction: prev?.key === 'start_date' && prev.direction === 'asc' ? 'desc' : 'asc' }))}>
                      <div className="flex items-center gap-2">
                        Ngày bắt đầu
                        <ArrowUpDown size={12} className={studentSortConfig?.key === 'start_date' ? 'text-white' : 'text-blue-400'} />
                      </div>
                    </th>
                    <th className="p-4 text-[10px] font-black uppercase w-32 cursor-pointer hover:bg-blue-800 transition-colors" onClick={() => setStudentStatusFilter(prev => prev === 'all' ? 'active' : prev === 'active' ? 'finished' : 'all')}>
                      <div className="flex items-center gap-2">
                        Trạng thái
                        <Filter size={12} className={studentStatusFilter !== 'all' ? 'text-orange-400' : 'text-blue-400'} />
                      </div>
                    </th>
                    <th className="p-4 text-[10px] font-black uppercase w-40 cursor-pointer hover:bg-blue-800 transition-colors" onClick={() => setStudentSortConfig(prev => ({ key: 'remainingDays', direction: prev?.key === 'remainingDays' && prev.direction === 'asc' ? 'desc' : 'asc' }))}>
                      <div className="flex items-center gap-2">
                        Số ngày còn lại
                        <ArrowUpDown size={12} className={studentSortConfig?.key === 'remainingDays' ? 'text-white' : 'text-blue-400'} />
                      </div>
                    </th>
                    <th className="p-4 text-[10px] font-black uppercase cursor-pointer hover:bg-blue-800 transition-colors" onClick={() => setStudentSortConfig(prev => ({ key: 'email', direction: prev?.key === 'email' && prev.direction === 'asc' ? 'desc' : 'asc' }))}>
                      <div className="flex items-center gap-2">
                        Email
                        <ArrowUpDown size={12} className={studentSortConfig?.key === 'email' ? 'text-white' : 'text-blue-400'} />
                      </div>
                    </th>
                    <th className="p-4 text-[10px] font-black uppercase w-40">
                      <div className="flex items-center justify-between">
                        <span>Trạng thái gán</span>
                        <button onClick={(e) => { e.stopPropagation(); setStudentFilterConfig(prev => prev === null ? true : prev === true ? false : null); }} className={`p-1 rounded hover:bg-blue-800 transition-colors ${studentFilterConfig !== null ? 'text-orange-400' : 'text-blue-400'}`}>
                          <Filter size={12} />
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {studentStatsLoading ? (
                    <tr><td colSpan={7} className="p-20 text-center"><Loader2 size={32} className="animate-spin text-blue-600 mx-auto" /><p className="mt-4 text-[10px] font-black text-blue-400 uppercase tracking-widest">Đang tải dữ liệu...</p></td></tr>
                  ) : processedStudents.map((s, idx) => {
                    const remainingDays = calculateRemainingDays(s.end_date);
                    const isEditingEmail = editingStudents[s.customer_id]?.email !== undefined;
                    const currentEmail = editingStudents[s.customer_id]?.email ?? s.email;
                    const isCustomized = editingStudents[s.customer_id]?.is_customized ?? s.is_customized;

                    return (
                      <tr key={s.customer_id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="p-4 text-center text-[11px] font-bold text-gray-400">#{idx + 1}</td>
                        <td className="p-4 text-sm font-black text-blue-900 uppercase cursor-pointer hover:text-blue-600 transition-colors" onClick={() => { navigator.clipboard.writeText(s.customer_name); setToast({ message: `Đã copy tên: ${s.customer_name}` }); }}>{s.customer_name}</td>
                        <td className="p-4 text-sm font-bold text-gray-600">{formatDDMMYYYY(s.start_date)}</td>
                        <td className="p-4">
                          <span className={`text-[10px] font-black px-2 py-1 rounded-full border ${remainingDays >= 0 ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                            {remainingDays >= 0 ? 'HOẠT ĐỘNG' : 'ĐÃ KẾT THÚC'}
                          </span>
                        </td>
                        <td className={`p-4 text-sm font-black ${remainingDays < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {remainingDays} ngày
                        </td>
                        <td className="p-4">
                          {currentEmail ? (
                            <div className="flex items-center gap-2 group">
                              <span 
                                className="text-sm font-medium text-gray-600 truncate max-w-[150px] cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={() => { navigator.clipboard.writeText(currentEmail); alert("Đã copy email!"); }}
                                title="Click để copy email"
                              >
                                {currentEmail}
                              </span>
                              <button onClick={() => setEditingStudents(prev => ({ ...prev, [s.customer_id]: { ...prev[s.customer_id], email: "" } }))} className="p-1 text-gray-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all">
                                <Edit3 size={14} />
                              </button>
                            </div>
                          ) : (
                            <input 
                              type="email" 
                              placeholder="Nhập email..." 
                              className="text-xs p-1 border-b border-blue-100 outline-none focus:border-blue-500 w-full bg-transparent"
                              onBlur={(e) => {
                                if (e.target.value) {
                                  setEditingStudents(prev => ({ ...prev, [s.customer_id]: { ...prev[s.customer_id], email: e.target.value } }));
                                }
                              }}
                            />
                          )}
                        </td>
                        <td className="p-4">
                          <select 
                            className={`text-[10px] font-black px-2 py-1 rounded-lg border outline-none cursor-pointer ${isCustomized ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}
                            value={isCustomized ? "1" : "0"}
                            onChange={(e) => setEditingStudents(prev => ({ ...prev, [s.customer_id]: { ...prev[s.customer_id], is_customized: e.target.value === "1" } }))}
                          >
                            <option value="1">ĐÃ GÁN</option>
                            <option value="0">CHƯA GÁN</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                  {!studentStatsLoading && processedStudents.length === 0 && (
                    <tr><td colSpan={7} className="p-24 text-center text-gray-400 italic font-medium">Không tìm thấy học viên nào.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
    </MainLayout>
  );
};
