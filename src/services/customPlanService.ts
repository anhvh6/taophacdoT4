import { mockDB } from '../lib/mockData';
import { supabase } from '../lib/supabaseClient';

export const customPlanService = {
  async getCustomPlan(customerId: string, token?: string) {
    const cleanId = String(customerId || '').trim();
    const tok = token?.trim();
    if (tok) {
      const { data, error } = await supabase.rpc('get_client_tasks', {
        p_customer_id: cleanId,
        p_token: tok
      });
      if (error) {
        console.error('get_client_tasks RPC:', error);
        return [];
      }
      const rows = data || [];
      return rows.map((t: any) => ({
        ...t,
        day: Number(t.day || 0),
        link: t.link || '',
        title: t.title || '',
        detail: t.detail || '',
        type: t.type || 'Bài bắt buộc',
        nhom: t.nhom || '',
        is_deleted: false
      }));
    }

    const tasks = await mockDB.getCustomPlan(customerId);
    const mapped = tasks.map(t => ({
      ...t,
      day: Number(t.day || 0),
      link: t.link || "",
      title: t.title || "",
      detail: t.detail || "",
      type: t.type || "Bài bắt buộc",
      nhom: t.nhom || t.Nhom || "",
      is_deleted: Number(t.is_deleted || 0) === 1
    }));
    return mapped;
  },

  async saveCustomPlan(customerId: string, tasks: any[]) {
    const cleanId = (customerId || '').trim();
    if (!tasks || tasks.length === 0) {
      await mockDB.saveCustomPlan(cleanId, []);
      return true;
    }

    const rows = tasks.map(t => ({
      customer_id: cleanId,
      day: Number(t.day || 0),
      type: t.type || '',
      title: t.title || '',
      detail: t.detail || '',
      link: t.link || '',
      is_deleted: t.is_deleted ? 1 : 0,
      nhom: t.nhom || t.Nhom || ''
    })).filter(t => t.day > 0);

    await mockDB.saveCustomPlan(cleanId, rows as any[]);
    return true;
  }
};
