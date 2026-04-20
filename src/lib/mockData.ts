import { Customer, Product, ExerciseTask } from '../../types';
import { supabase } from './supabaseClient';
import { toISODateKey } from '../../utils/date';

class SupabaseDatabase {
  private mapTaskRow(row: any): ExerciseTask {
    return {
      id: row.id,
      day: Number(row.day || 0),
      type: row.type || 'Bài bắt buộc',
      title: row.title || '',
      detail: row.detail || '',
      link: row.link || '',
      nhom: row.nhom || '',
      video_date: row.video_date || '',
      sort_order: Number(row.sort_order || 0),
      is_deleted: !!row.is_deleted
    };
  }

  async getCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Customer[];
  }

  async upsertCustomer(c: Partial<Customer>) {
    const { data, error } = await supabase
      .from('customers')
      .upsert(c, { onConflict: 'customer_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data as Customer;
  }

  async deleteCustomer(id: string) {
    const { error } = await supabase
      .from('customers')
      .update({ status: 'DELETED' })
      .eq('customer_id', id);
    if (error) throw error;
  }

  async getProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('ten_sp', { ascending: true });
    if (error) throw error;
    return (data || []) as Product[];
  }

  async saveProducts(prods: Product[]) {
    const { error } = await supabase.from('products').upsert(prods, { onConflict: 'id_sp' });
    if (error) throw error;
    return true;
  }

  async getAllMasterTasks() {
    const { data, error } = await supabase
      .from('master_video_tasks')
      .select('*')
      .order('video_date', { ascending: false })
      .order('day', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data || []).map((row) => this.mapTaskRow(row));
  }

  async getPlan(date: string) {
    const dateKey = toISODateKey(date);
    const { data, error } = await supabase
      .from('master_video_tasks')
      .select('*')
      .eq('video_date', dateKey)
      .order('day', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data || []).map((row) => this.mapTaskRow(row));
  }

  async getCustomPlan(id: string) {
    const { data, error } = await supabase
      .from('customer_tasks')
      .select('*')
      .eq('customer_id', id)
      .order('day', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data || []).map((row) => this.mapTaskRow(row));
  }

  async saveCustomPlan(id: string, tasks: ExerciseTask[]) {
    const { error: deleteError } = await supabase.from('customer_tasks').delete().eq('customer_id', id);
    if (deleteError) throw deleteError;
    if (!tasks.length) return;
    const rows = tasks.map((t) => ({
      customer_id: id,
      day: Number(t.day || 0),
      type: t.type || '',
      title: t.title || '',
      detail: t.detail || '',
      link: t.link || '',
      nhom: t.nhom || '',
      is_deleted: !!t.is_deleted,
      sort_order: Number(t.sort_order || t.day || 0)
    }));
    const { error } = await supabase.from('customer_tasks').insert(rows);
    if (error) throw error;
  }

  async saveVideoGroupTasks(date: string, tasks: ExerciseTask[]) {
    const dateKey = toISODateKey(date);
    const { error: deleteError } = await supabase.from('master_video_tasks').delete().eq('video_date', dateKey);
    if (deleteError) throw deleteError;
    if (!tasks.length) return;
    const rows = tasks.map((t) => ({
      video_date: dateKey,
      day: Number(t.day || 0),
      type: t.type || '',
      title: t.title || '',
      detail: t.detail || '',
      link: t.link || '',
      nhom: t.nhom || '',
      sort_order: Number(t.sort_order || t.day || 0)
    }));
    const { error } = await supabase.from('master_video_tasks').insert(rows);
    if (error) throw error;
  }

  async deleteVideoGroupTasks(date: string) {
    const dateKey = toISODateKey(date);
    const { error } = await supabase.from('master_video_tasks').delete().eq('video_date', dateKey);
    if (error) throw error;
  }

  async deleteVideoTask(id: string) {
    const { error } = await supabase.from('master_video_tasks').delete().eq('id', id);
    if (error) throw error;
  }
}

export const mockDB = new SupabaseDatabase();
