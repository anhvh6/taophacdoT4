import { Customer, Product, ExerciseTask, CustomerStatus, ExerciseType } from '../types';
import { DEFAULT_SIDEBAR_BLOCKS } from '../constants';

import { initialCustomers, initialProducts, initialMasterTasks, initialPlanTasks } from '../src/mockDbData';

// Simulated storage
let customers: Customer[] = [...initialCustomers];
let products: Product[] = [...initialProducts];
const masterTasks: Record<string, ExerciseTask[]> = { ...initialMasterTasks };
let planTasks: Record<string, ExerciseTask[]> = { ...initialPlanTasks };

export const api = {
  getCustomers: async () => {
    return [...customers];
  },
  getCustomerById: async (id: string) => {
    return customers.find(c => c.customer_id === id) || null;
  },
  upsertCustomer: async (data: Partial<Customer>) => {
    const existingIndex = customers.findIndex(c => c.customer_id === data.customer_id);
    if (existingIndex > -1) {
      customers[existingIndex] = { ...customers[existingIndex], ...data, updated_at: new Date().toISOString() };
      return customers[existingIndex];
    } else {
      const newId = "C" + Date.now();
      const newCustomer: Customer = {
        customer_id: newId,
        customer_name: (data.customer_name || "").toUpperCase(),
        sdt: data.sdt || "",
        email: data.email || "",
        dia_chi: data.dia_chi || "",
        san_pham: data.san_pham || [],
        gia_tien: data.gia_tien || 0,
        trang_thai_gan: data.trang_thai_gan || "chưa gán",
        trang_thai: data.trang_thai ?? 0,
        ma_vd: data.ma_vd || "",
        note: data.note || "",
        chewing_status: data.chewing_status || "Tập cân bằng 50-50",
        start_date: data.start_date || new Date().toISOString().split('T')[0],
        end_date: data.end_date || "",
        duration_days: data.duration_days || 30,
        video_date: data.video_date || "01/01/2025",
        status: CustomerStatus.ACTIVE,
        sidebar_blocks_json: data.sidebar_blocks_json || DEFAULT_SIDEBAR_BLOCKS,
        token: Math.random().toString(36).substring(2, 10),
        link: `https://mega-phuong.app/#/client/${newId}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      customers.push(newCustomer);
      return newCustomer;
    }
  },
  deleteCustomer: async (id: string) => {
    customers = customers.filter(c => c.customer_id !== id);
    if (planTasks[id]) {
      delete planTasks[id];
    }
  },
  getProducts: async () => {
    return [...products];
  },
  saveProducts: async (newProducts: Product[]) => {
    products = [...newProducts];
  },
  getPlan: async (customerId: string, videoDate: string) => {
    if (customerId === "NEW") {
      return masterTasks[videoDate] || masterTasks["01/01/2025"];
    }
    return planTasks[customerId] || masterTasks[videoDate] || masterTasks["01/01/2025"];
  },
  savePlan: async (customerId: string, tasks: ExerciseTask[]) => {
    planTasks[customerId] = tasks;
  }
};
