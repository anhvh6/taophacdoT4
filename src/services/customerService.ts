import { mockDB } from '../lib/mockData';
import { Customer } from '../../types';
import { DEFAULT_SIDEBAR_BLOCKS, DEFAULT_CHEWING_INSTRUCTION } from '../../constants';
import { parseVNDate, addDays, toISODateKey } from '../../utils/date';

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
    token: item.token || ""
  };
};

export const generateCustomerLink = (customerId: string, token: string) => {
  // Tự động nhận diện môi trường localhost hoặc production
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const baseUrl = isLocalhost ? window.location.origin + '/#' : "https://phacdo.vercel.app/#";
  
  return `${baseUrl}/client/${customerId}?t=${token}`;
};

export const customerService = {
  normalizeCustomer,
  generateCustomerLink,

  async getCustomerByToken(customerId: string, token: string) {
    const customers = await mockDB.getCustomers();
    const data = customers.filter(c => c.customer_id === customerId && c.token === token);
    if (!data || data.length === 0) return null;
    return normalizeCustomer(data[0]);
  },

  async getCustomerById(customerId: string) {
    const customers = await mockDB.getCustomers();
    const data = customers.find(c => c.customer_id === customerId);
    return data ? normalizeCustomer(data) : null;
  },

  async getCustomers() {
    const customers = await mockDB.getCustomers();
    // Sort descending by created_at conceptually
    customers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return customers.map(normalizeCustomer);
  },

  async upsertCustomer(payload: Partial<Customer>, tasks?: any[] | null) {
    const customerId = String(payload.customer_id || ('C' + Date.now() + Math.random().toString(36).substring(2, 7).toUpperCase())).trim();
    
    const customers = await mockDB.getCustomers();
    const existingCustomer = customers.find(c => c.customer_id === customerId);
    const isNew = !existingCustomer;
    
    // Preserve or generate token
    let token = payload.token;
    if (!token) {
      if (!isNew && existingCustomer?.token) {
        token = existingCustomer.token;
      } else {
        token = (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
      }
    }
    
    // Calculate end_date
    let endDate = payload.end_date;
    const start = parseVNDate(payload.start_date);
    const duration = Number(payload.duration_days || 0);
    
    if (start && duration > 0) {
      const end = addDays(start, duration);
      endDate = toISODateKey(end);
    }

    const link = generateCustomerLink(customerId, token);

    const dbPayload: any = {
      customer_id: customerId,
      customer_name: payload.customer_name,
      sdt: payload.sdt,
      email: payload.email,
      dia_chi: payload.dia_chi,
      san_pham: payload.san_pham || [],
      gia_tien: payload.gia_tien || 0,
      trang_thai_gan: payload.is_customized ? 1 : 0, 
      is_customized: payload.is_customized || false,
      trang_thai: payload.trang_thai ?? 0,
      ma_vd: payload.ma_vd || 0,
      note: payload.note || "",
      chewing_status: payload.chewing_status || "",
      start_date: payload.start_date || null,
      end_date: endDate || null,
      duration_days: duration || 30,
      Video_date: payload.video_date || payload.Video_date || null,
      status: payload.status || 'ACTIVE',
      sidebar_blocks_json: payload.sidebar_blocks_json || DEFAULT_SIDEBAR_BLOCKS,
      link: link,
      token: token,
      app_title: payload.app_title || "PHÁC ĐỒ 30 NGÀY THAY ĐỔI KHUÔN MẶT",
      app_slogan: payload.app_slogan || "Hành trình đánh thức vẻ đẹp tự nhiên, gìn giữ thanh xuân bằng sự hiểu biết và tình yêu bản thân.",
      updated_at: new Date().toISOString()
    };

    if (isNew) {
      dbPayload.created_at = new Date().toISOString();
    } else {
      dbPayload.created_at = existingCustomer.created_at || new Date().toISOString();
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
  }
};
