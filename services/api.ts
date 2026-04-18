import { customerService, normalizeCustomer } from '../src/services/customerService';
import { productService } from '../src/services/productService';
import { planService } from '../src/services/planService';
import { customPlanService } from '../src/services/customPlanService';
import { youtubeAccessService } from '../src/services/youtubeAccessService';
import { mockDB } from '../src/lib/mockData';
import { Customer, Product, ExerciseTask, CustomerStatus, ExerciseType, VideoGroup } from '../types';
import { DEFAULT_SIDEBAR_BLOCKS } from '../constants';
import { toISODateKey } from '../utils/date';

export const api = {
  getCustomers: customerService.getCustomers,
  getCustomerById: async (id: string) => {
    return customerService.getCustomerById(id);
  },
  upsertCustomer: customerService.upsertCustomer,
  deleteCustomer: customerService.deleteCustomer,
  
  getProducts: productService.getProducts,
  saveProducts: async (products: Product[]) => {
    await mockDB.saveProducts(products);
    return products;
  },

  getPlanEditorData: async (id?: string, templateId?: string) => {
    let customer = null;
    let tasks = [];
    let template = null;
    let templateTasks = [];

    if (id && id !== 'NEW') {
      customer = await customerService.getCustomerById(id);
      if (customer) {
        tasks = (await customPlanService.getCustomPlan(id));
      }
    }

    if (templateId) {
      template = await customerService.getCustomerById(templateId);
      if (template) {
        templateTasks = (await customPlanService.getCustomPlan(templateId));
      }
    }

    const products = await productService.getProducts();
    
    const videoTasks = await mockDB.tasks || [];
    
    // Create a unique list of {video_date, nhom}
    const uniqueMap = new Map();
    (videoTasks || []).forEach(v => {
      const vDate = v.Video_date || (v as any).video_date;
      const vNhom = v.Nhom || (v as any).nhom;
      if (vDate && !uniqueMap.has(vDate)) {
        uniqueMap.set(vDate, vNhom || vDate);
      }
    });
    
    const dates = Array.from(uniqueMap.entries()).map(([video_date, nhom]) => ({
      video_date,
      nhom
    })).sort((a, b) => b.video_date.localeCompare(a.video_date));

    return {
      customer,
      tasks,
      template,
      templateTasks,
      products: products.filter(p => p.trang_thai === 1),
      dates
    };
  },

  getVideoDates: async () => {
    const tasks = mockDB.tasks || [];
    return Array.from(new Set(tasks.map(v => v.video_date).filter(Boolean))).sort().reverse();
  },

  getVideoGroups: async (): Promise<VideoGroup[]> => {
    const tasks = mockDB.tasks || [];

    const customers = await mockDB.getCustomers();
    const activeCustomers = customers.filter(c => c.status === 'ACTIVE' && c.video_date);

    const counts: Record<string, number> = {};
    activeCustomers.forEach(c => {
      if (c.video_date) {
        const key = toISODateKey(c.video_date);
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    const groupsMap: Record<string, any> = {};
    (tasks || []).forEach(t => {
      const key = (t as any).Video_date || (t as any).video_date;
      const dayNum = Number((t as any).N || (t as any).Day || (t as any).day || 0);
      
      // Only process tasks for the first 30 days
      if (dayNum > 30) return;

      if (!groupsMap[key]) {
        groupsMap[key] = {
          video_date: key,
          video_date_key: key,
          nhom: (t as any).Nhom || (t as any).nhom || "",
          total_days: 0,
          total_tasks: 0,
          mandatory_tasks: 0,
          optional_tasks: 0,
          active_students: counts[key] || 0,
          daysSet: new Set()
        };
      }
      const g = groupsMap[key];
      g.total_tasks++;
      g.daysSet.add(dayNum);
      const taskType = String(t.type || "").toLowerCase();
      if (taskType.includes('bắt buộc') || taskType.includes('bat buoc')) {
        g.mandatory_tasks++;
      } else {
        g.optional_tasks++;
      }
    });

    return Object.values(groupsMap).map(g => ({
      ...g,
      total_days: g.daysSet.size,
      daysSet: undefined
    })).sort((a, b) => b.video_date_key.localeCompare(a.video_date_key));
  },

  getPlan: async (customerId: string, videoDate: string) => {
    console.log(`API getPlan called for customer: ${customerId}, date: ${videoDate}`);
    if (customerId === 'NEW' || !customerId) {
      const master = await planService.getMasterPlan(videoDate);
      const filtered = master;
      console.log(`API getPlan (Master) returned ${filtered.length} tasks (filtered from ${master.length})`);
      return filtered;
    }
    const customTasks = await customPlanService.getCustomPlan(customerId);
    if (customTasks && customTasks.length > 0) {
      const filtered = customTasks;
      console.log(`API getPlan (Custom) returned ${filtered.length} tasks (filtered from ${customTasks.length})`);
      return filtered;
    }
    const master = await planService.getMasterPlan(videoDate);
    const filtered = master.filter(t => t.day <= 30);
    console.log(`API getPlan (Fallback Master) returned ${filtered.length} tasks (filtered from ${master.length})`);
    return filtered;
  },

  saveVideoGroupTasks: async (videoDate: string, tasks: ExerciseTask[], nhom?: string) => {
    const dateKey = toISODateKey(videoDate);
    const tasksToInsert = tasks.map(t => ({ 
      ...t,
      video_date: dateKey,
      nhom: nhom || t.nhom || ""
    }));
    await mockDB.saveVideoGroupTasks(dateKey, tasksToInsert);
    return true;
  },

  deleteVideoGroup: async (videoDateKey: string) => {
    const dateKey = toISODateKey(videoDateKey);
    await mockDB.deleteVideoGroupTasks(dateKey);
    return true;
  },

  deleteVideoTask: async (id: string) => {
    await mockDB.deleteVideoTask(id);
    return true;
  },

  refreshClientData: async (id: string, token?: string) => {
    const customer = await customerService.getCustomerByToken(id, token || '');
    if (!customer) return null;
    
    let tasks = await customPlanService.getCustomPlan(id);
    if (!tasks || tasks.length === 0) {
      if (customer.video_date) {
        tasks = await planService.getMasterPlan(customer.video_date);
      }
    }

    return { customer, tasks: (tasks || []) };
  },

  assignCourseVideos: youtubeAccessService.assignCourseVideos,
  unassignCourseVideos: youtubeAccessService.unassignCourseVideos
};
