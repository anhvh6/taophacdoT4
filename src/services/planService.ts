import { mockDB } from '../lib/mockData';
import { supabase } from '../lib/supabaseClient';
import { toISODateKey } from '../../utils/date';

const mapTask = (t: any) => {
  // Use a very robust way to get the day number
  const dayRaw = t.day ?? t.Day ?? t.N ?? t.n ?? 0;
  let day = 0;
  
  if (typeof dayRaw === 'number') {
    day = dayRaw;
  } else {
    const dayStr = String(dayRaw);
    const dayMatch = dayStr.match(/\d+/);
    day = dayMatch ? parseInt(dayMatch[0], 10) : 0;
  }

  const mapped = {
    ...t,
    id: t.id || `${t.N || t.n || day || Math.random().toString(36).slice(2, 5)}-${Math.random().toString(36).slice(2, 8)}`,
    day: day,
    link: t.link || t.Link || "",
    title: t.title || t.Title || "",
    detail: t.detail || t.Detail || "",
    type: t.type || t.Type || "Bài bắt buộc",
    nhom: t.nhom || t.Nhom || "",
    sort_order: Number(t.sort_order || t.N || t.n || day || 0),
    is_deleted: false
  };
  
  return mapped;
};

export const planService = {
  async getMasterPlan(videoDate: string) {
    if (!videoDate) return [];
    const dateKey = toISODateKey(videoDate);
    
    // Use direct query instead of RPC to ensure we get the 'id' field
    const tasks = await mockDB.getPlan(dateKey);
    if (tasks && tasks.length > 0) {
      return tasks.map(mapTask).filter(t => t.day >= 0).sort((a, b) => a.day - b.day);
    }

    // Fallback to RPC if direct query fails for some reason or returns no data
    const { data, error } = await supabase.rpc('get_master_tasks', {
      p_video_date: dateKey
    });
    
    if (error) {
      console.error('get_master_tasks RPC:', error);
      return [];
    }
    
    const rows = data || [];
    return rows.map(mapTask).filter(t => t.day >= 0).sort((a, b) => a.day - b.day);
  }
};
