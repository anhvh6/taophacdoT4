import { mockDB } from '../lib/mockData';
import { supabase } from '../lib/supabaseClient';
import { Customer } from '../../types';
import { DEFAULT_SIDEBAR_BLOCKS, DEFAULT_CHEWING_INSTRUCTION } from '../../constants';
import { parseVNDate, addDays, toISODateKey } from '../../utils/date';

const parseFlag = (value: any, fallback = true): boolean => {
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

export const normalizeCustomer = (item: any): Customer => {
  if (!item) return item;
  
  let blocks = item.sidebar_blocks_json;
  if (typeof blocks === 'string' && blocks.trim() !== '') {
    try { blocks = JSON.parse(blocks); } catch (e) { blocks = DEFAULT_SIDEBAR_BLOCKS; }
  }
  if (!Array.isArray(blocks) || blocks.length === 0) blocks = DEFAULT_SIDEBAR_BLOCKS;

  let sanPham = item.san_pham;
  if (typeof sanPham === 'string' && sanPham.trim() !== '') {
    try { sanPham = JSON.parse(sanPham); } catch (e) { sanPham = []; }
  }

  // Use trang_thai_gan as a proxy for is_customized if is_customized is missing
  // Handle both string "1" and number 1 for trang_thai_gan
  const isCustomized = item.is_customized === 1 || item.is_customized === true || item.trang_thai_gan == 1 || item.trang_thai_gan === "1";

  return { 
    ...item, 
    is_customized: isCustomized,
    id: item.id,
    customer_id: String(item.customer_id || item.id || ""),
    customer_name: String(item.customer_name || "").toUpperCase(),
    sdt: String(item.sdt || "").trim(),
    email: String(item.email || "").trim().toLowerCase(),
    dia_chi: String(item.dia_chi || "").trim(),
    note: String(item.note || ""), 
    sidebar_blocks_json: blocks,
    san_pham: Array.isArray(sanPham) ? sanPham : [],
    gia_tien: Number(item.gia_tien || 0),
    trang_thai: Number(item.trang_thai || 0),
    chewing_status: String(item.chewing_status || DEFAULT_CHEWING_INSTRUCTION),
    app_title: item.app_title || "Phác đồ 30 ngày thay đổi khuôn mặt",
    app_slogan: item.app_slogan || "Hành trình đánh thức vẻ đẹp tự nhiên, gìn giữ thanh xuân.",
    video_date: item.Video_date || item.video_date,
    link: item.link || "",
    token: item.token || "",
    require_google_auth: parseFlag(item.require_google_auth, true),
    require_device_limit: parseFlag(item.require_device_limit, true),
    pending_email: item.pending_email || ""
  };
};

/** Domain public cho học viên (tách khỏi admin). Mặc định phacdo4.vercel.app */
export const getClientPublicOrigin = () => {
  const env = (import.meta as any).env?.VITE_CLIENT_PUBLIC_URL as string | undefined;
  const fallback = 'https://phacdo4.vercel.app';
  return (env && env.trim() ? env.trim() : fallback).replace(/\/$/, '');
};

export const generateCustomerLink = (customerId: string, token: string) => {
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  // Local dev: mở cùng origin để test; production: luôn dùng domain học viên
  const base = isLocalhost ? window.location.origin : getClientPublicOrigin();
  const t = encodeURIComponent(token);
  return `${base}/client/${encodeURIComponent(customerId)}?t=${t}`;
};

export const customerService = {
  normalizeCustomer,
  generateCustomerLink,

  async getClientSecurityFlags(customerId: string, token: string) {
    const id = String(customerId || '').trim();
    const tok = String(token || '').trim();
    if (!id || !tok) return null;

    try {
      const query = new URLSearchParams({ id, t: tok }).toString();
      const resp = await fetch(`/api/security?${query}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data) return null;
      return {
        require_google_auth: data.require_google_auth,
        require_device_limit: data.require_device_limit
      };
    } catch {
      return null;
    }
  },

  async getCustomerByToken(customerId: string, token: string) {
    const id = String(customerId || '').trim();
    const tok = String(token || '').trim();
    if (!id || !tok) return null;

    const { data, error } = await supabase.rpc('get_client_customer', {
      p_customer_id: id,
      p_token: tok
    });
    if (error) {
      console.error('get_client_customer RPC:', error);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    const missingGoogleAuth = !Object.prototype.hasOwnProperty.call(row, 'require_google_auth');
    const missingDeviceLimit = !Object.prototype.hasOwnProperty.call(row, 'require_device_limit');
    let enrichedRow: any = row;

    // Some deployed DB RPC versions omit security flags.
    // In that case, fetch flags from server-side API (service-role guarded) by id + token.
    if (missingGoogleAuth || missingDeviceLimit) {
      const securityData = await customerService.getClientSecurityFlags(id, tok);
      if (securityData) {
        enrichedRow = { ...row, ...securityData };
      }
    }

    return normalizeCustomer(enrichedRow);
  },

  async getCustomerById(customerId: string) {
    const customers = await mockDB.getCustomers();
    const data = customers.find(c => c.customer_id === customerId);
    return data ? normalizeCustomer(data) : null;
  },

  async getCustomers() {
    const customers = await mockDB.getCustomers();
    
    // ĐỒNG BỘ NỀN: Lấy Email xác thực từ Supabase thế chỗ vào MockDB của Admin để Admin thấy Email học viên
    try {
      const { data: sbCustomers } = await supabase.from('customers').select('customer_id, email');
      if (sbCustomers && Array.isArray(sbCustomers)) {
         let hasUpdates = false;
         for (const c of customers) {
            const sbC = sbCustomers.find(sc => sc.customer_id === c.customer_id);
            if (sbC && sbC.email && sbC.email.trim() !== '' && c.email !== sbC.email) {
               c.email = sbC.email;
               hasUpdates = true;
               // Cập nhật ngầm vào mockDB từng bản ghi
               await mockDB.upsertCustomer(c);
            }
         }
      }
    } catch(e) {
      console.warn("Background email sync failed:", e);
    }

    // Sort descending by created_at conceptually
    customers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return customers.map(normalizeCustomer);
  },

  async upsertCustomer(payload: Partial<Customer>, tasks?: any[] | null) {
    const customerId = String(payload.customer_id || ('C' + Date.now() + Math.random().toString(36).substring(2, 7).toUpperCase())).trim();
    
    // Fetch existing data for merging
    const { data: existingData, error: fetchError } = await supabase
      .from('customers')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();
      
    const isNew = !existingData;
    
    // Preserve or generate token
    let token = payload.token || existingData?.token;
    if (!token) {
      token = (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    }
    
    // Calculate end_date based on current (merged) start_date and duration_days
    const startDate = payload.start_date !== undefined ? payload.start_date : existingData?.start_date;
    const durationCount = payload.duration_days !== undefined ? Number(payload.duration_days) : Number(existingData?.duration_days || 30);
    
    let endDate = payload.end_date;
    const start = parseVNDate(startDate);
    if (start && durationCount > 0) {
      endDate = toISODateKey(addDays(start, durationCount));
    }

    const link = generateCustomerLink(customerId, token);

    // Build DB payload by merging existing and new (only if defined)
    const dbPayload: any = {
      ...(existingData || {}),
      customer_id: customerId,
      token: token,
      link: link,
      updated_at: new Date().toISOString()
    };

    // Only update fields that are present in the payload
    const fields = [
      'customer_name', 'sdt', 'email', 'dia_chi', 'san_pham', 'gia_tien', 
      'trang_thai', 'ma_vd', 'note', 'chewing_status', 'start_date', 
      'status', 'sidebar_blocks_json', 'app_title', 'app_slogan',
      'require_google_auth', 'require_device_limit', 'pending_email', 'video_date'
    ];

    fields.forEach(field => {
      if (payload[field as keyof Customer] !== undefined) {
        dbPayload[field] = payload[field as keyof Customer];
      }
    });

    // Special handling for legacy/derived fields
    if (payload.is_customized !== undefined) {
      dbPayload.is_customized = !!payload.is_customized;
      dbPayload.trang_thai_gan = payload.is_customized ? 1 : 0;
    }
    if (durationCount !== undefined) {
      dbPayload.duration_days = durationCount;
      dbPayload.end_date = endDate;
    }
    if (payload.Video_date !== undefined) {
      dbPayload.video_date = payload.Video_date;
    }

    if (isNew) {
      dbPayload.created_at = new Date().toISOString();
    }

    const savedCustomerResult = await mockDB.upsertCustomer(dbPayload);
    const savedCustomer = normalizeCustomer(savedCustomerResult);

    if (tasks !== undefined && tasks !== null) {
      if (tasks.length > 0) {
        const tasksToInsert = tasks.map(t => ({
          customer_id: customerId,
          day: Number(t.day || 0),
          type: String(t.type || "Bài bắt buộc"),
          title: String(t.title || ""),
          detail: String(t.detail || ""),
          link: String(t.link || ""),
          is_deleted: t.is_deleted ? 1 : 0,
          nhom: t.nhom || t.Nhom || ""
        })).filter(t => t.day > 0);
        
        await mockDB.saveCustomPlan(customerId, tasksToInsert as any[]);
      } else {
        await mockDB.saveCustomPlan(customerId, []);
      }
    }

    return savedCustomer;
  },

  async deleteCustomer(id: string) {
    const customers = await mockDB.getCustomers();
    const existing = customers.find(c => c.customer_id === id);
    if (existing) {
      await mockDB.upsertCustomer({ ...existing, status: CustomerStatus.DELETED, updated_at: new Date().toISOString() } as Partial<Customer>);
    }
    return true;
  },

  async getDevices(customerId: string) {
    const { data, error } = await supabase
      .from('customer_devices')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async updateDevice(deviceId: string, updates: any) {
    const { error } = await supabase
      .from('customer_devices')
      .update(updates)
      .eq('id', deviceId);
    if (error) throw error;
    return true;
  },

  async deleteDevice(deviceId: string) {
    const { error } = await supabase
      .from('customer_devices')
      .delete()
      .eq('id', deviceId);
    if (error) throw error;
    return true;
  },

  async authorizeDevice(customerId: string, token: string, deviceId: string, deviceName: string) {
    const { data, error } = await supabase.rpc('authorize_device', {
      p_customer_id: customerId,
      p_token: token,
      p_device_id: deviceId,
      p_device_name: deviceName
    });
    if (error) throw error;
    return data;
  },

  async requestDeviceApproval(customerId: string, token: string, deviceId: string, deviceName: string) {
    const { data, error } = await supabase.rpc('request_device_approval', {
      p_customer_id: customerId,
      p_token: token,
      p_device_id: deviceId,
      p_device_name: deviceName
    });
    if (error) throw error;
    return data;
  },

  async getPendingDeviceRequests() {
    const { data, error } = await supabase
      .from('customer_devices')
      .select('id, customer_id, device_name, created_at, customers(customer_name)')
      .eq('is_approved', false)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('getPendingDeviceRequests:', error);
      return [];
    }
    return data || [];
  },

  async updateCustomerEmailByToken(customerId: string, token: string, newEmail: string) {
    let supabaseResult = { success: false, message: 'Not connected' };
    
    // Gửi tín hiệu đến API giấu kín (Serverless Function) của Vercel
    // Api này xài Service Role có quyền Admin tối cao trên Supabase nên sẽ luôn ghi đè thành công
    try {
      const response = await fetch('/api/enroll_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, token, email: newEmail })
      });
      if (response.ok) {
        supabaseResult = await response.json();
      } else {
        console.warn("API enroll_email trả về lỗi HTTP:", response.status);
      }
    } catch (e) {
      console.warn("Lỗi khi kết nối đến API enroll_email:", e);
    }

    // Always fallback to MockDB to ensure student is not blocked
    try {
      const customers = await mockDB.getCustomers();
      const customer = customers.find(c => c.customer_id === customerId);
      if (customer) {
        // Cập nhật cả email và tự động duyệt luôn thiết bị (tuỳ chọn) nhưng chủ yếu là email
        await mockDB.upsertCustomer({ ...customer, email: newEmail });
        return { success: true, message: 'Saved to local mockDB' };
      }
    } catch (mockErr) {
      console.error("MockDB update failed:", mockErr);
    }

    // Nếu Supabase có kết quả (kể cả lỗi unauthorized) thì trả về
    if (supabaseResult && supabaseResult.success !== undefined) {
       return supabaseResult;
    }

    throw new Error("Không thể lưu email vào máy chủ.");
  },

  async requestEmailChange(customerId: string, newEmail: string, token?: string) {
    if (!token) {
       // Old legacy behavior (admin)
       const { error } = await supabase
        .from('customers')
        .update({ pending_email: newEmail })
        .eq('customer_id', customerId);
       if (error) throw error;
       return true;
    }

    const { data, error } = await supabase
      .rpc('request_customer_email_change', {
        p_customer_id: customerId,
        p_new_email: newEmail,
        p_token: token
      });

    if (error) throw error;
    return data;
  },

  async getPendingEmailRequests() {
    // Try to get from Supabase
    const { data, error } = await supabase
      .from('customers')
      .select('customer_id, customer_name, pending_email, updated_at')
      .not('pending_email', 'is', null)
      .neq('pending_email', '');
    
    if (error) {
      console.warn('getPendingEmailRequests failed, trying mock:', error);
      const customers = await mockDB.getCustomers();
      return customers
        .filter(c => c.pending_email && c.pending_email.trim() !== '')
        .map(c => ({
          customer_id: c.customer_id,
          customer_name: c.customer_name,
          pending_email: c.pending_email,
          created_at: c.updated_at
        }));
    }
    return data || [];
  }
};
