import { Customer, Product, ExerciseTask, ExerciseType, CustomerStatus } from '../../types';

import { initialCustomers, initialProducts, initialMasterTasks, initialPlanTasks } from '../mockDbData';
import { toISODateKey } from '../../utils/date';

export const INITIAL_MOCK_CUSTOMERS: Customer[] = initialCustomers;

export const INITIAL_MOCK_PRODUCTS: Product[] = initialProducts;

// Flatten master tasks
const flattenedMasterTasks: ExerciseTask[] = [];
Object.keys(initialMasterTasks).forEach(videoDate => {
  const tasks = initialMasterTasks[videoDate];
  const isoKey = toISODateKey(videoDate) || videoDate;
  tasks.forEach((t, index) => {
    flattenedMasterTasks.push({
      ...t,
      video_date: isoKey,
      _video_date_key: isoKey,
      sort_order: index + 1,
      id: `mt-${isoKey}-${index}`
    });
  });
});

export const INITIAL_MOCK_TASKS: ExerciseTask[] = flattenedMasterTasks;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class MockDatabase {
  customers: Customer[];
  products: Product[];
  tasks: ExerciseTask[];
  customTasks: Record<string, ExerciseTask[]>;
  customerOverrides: Record<string, Customer>;
  deletedCustomerIds: string[];
  customTasksOverrides: Record<string, ExerciseTask[]>;

  constructor() {
    this.customerOverrides = {};
    this.deletedCustomerIds = [];
    this.customTasksOverrides = {};
    this.load();
  }

  load() {
    try {
      // Clear out the old massive keys to free up LocalStorage Quota
      localStorage.removeItem('MOCK_DB_CUSTOMERS');
      localStorage.removeItem('mega_customers_cache');
      localStorage.removeItem('MOCK_DB_CUSTOM_TASKS');
      
      const overridesStr = localStorage.getItem('MOCK_DB_CUSTOMERS_OVERRIDE');
      const deletedStr = localStorage.getItem('MOCK_DB_CUSTOMERS_DELETED');
      const ctOverridesStr = localStorage.getItem('MOCK_DB_CUSTOM_TASKS_OVERRIDE');
      
      this.customerOverrides = overridesStr ? JSON.parse(overridesStr) : {};
      this.deletedCustomerIds = deletedStr ? JSON.parse(deletedStr) : [];
      this.customTasksOverrides = ctOverridesStr ? JSON.parse(ctOverridesStr) : {};

      const p = localStorage.getItem('MOCK_DB_PRODUCTS');
      const t = localStorage.getItem('MOCK_DB_TASKS');

      // Reconstruct customers safely
      let baseCustomers = [...INITIAL_MOCK_CUSTOMERS];
      
      // Apply overrides and new additions
      Object.values(this.customerOverrides).forEach(mod => {
        const idx = baseCustomers.findIndex(x => x.customer_id === mod.customer_id);
        if (idx !== -1) {
          baseCustomers[idx] = mod;
        } else {
          baseCustomers.unshift(mod);
        }
      });
      
      // Remove deleted
      if (this.deletedCustomerIds.length > 0) {
        baseCustomers = baseCustomers.filter(c => !this.deletedCustomerIds.includes(c.customer_id));
      }
      this.customers = baseCustomers;

      this.products = p ? JSON.parse(p) : [...INITIAL_MOCK_PRODUCTS];
      this.tasks = t ? JSON.parse(t) : [...INITIAL_MOCK_TASKS];
      
      // Build custom tasks safely
      this.customTasks = { ...initialPlanTasks };
      Object.keys(this.customTasksOverrides).forEach(cid => {
        this.customTasks[cid] = this.customTasksOverrides[cid];
      });

    } catch (e) {
      console.warn("Lỗi khi load từ memory, tải mặc định", e);
      this.customers = [...INITIAL_MOCK_CUSTOMERS];
      this.products = [...INITIAL_MOCK_PRODUCTS];
      this.tasks = [...INITIAL_MOCK_TASKS];
      this.customTasks = { ...initialPlanTasks };
      this.customerOverrides = {};
      this.deletedCustomerIds = [];
      this.customTasksOverrides = {};
    }
  }

  save() {
    try {
      // Instead of full lists, save only deltas
      localStorage.setItem('MOCK_DB_CUSTOMERS_OVERRIDE', JSON.stringify(this.customerOverrides));
      localStorage.setItem('MOCK_DB_CUSTOMERS_DELETED', JSON.stringify(this.deletedCustomerIds));
      localStorage.setItem('MOCK_DB_CUSTOM_TASKS_OVERRIDE', JSON.stringify(this.customTasksOverrides));
      
      localStorage.setItem('MOCK_DB_PRODUCTS', JSON.stringify(this.products));
      localStorage.setItem('MOCK_DB_TASKS', JSON.stringify(this.tasks));
    } catch (e) {
      console.warn("Lỗi khi lưu vào LocalStorage (có thể do quá giới hạn 5MB):", e);
    }
  }

  async getCustomers() {
    await sleep(200);
    return [...this.customers];
  }

  async upsertCustomer(c: Partial<Customer>) {
    await sleep(300);
    const id = c.customer_id;
    const idx = this.customers.findIndex(x => x.customer_id === id);
    let result;
    if (idx !== -1) {
      this.customers[idx] = { ...this.customers[idx], ...c } as Customer;
      result = this.customers[idx];
    } else {
      const newCust = {
        ...c,
        customer_id: id || ('C' + new Date().getTime()),
        created_at: new Date().toISOString()
      } as Customer;
      this.customers.unshift(newCust);
      result = newCust;
    }
    
    // Save delta
    if (result && result.customer_id) {
      this.customerOverrides[result.customer_id] = result;
      // if it was deleted before, un-delete it
      this.deletedCustomerIds = this.deletedCustomerIds.filter(did => did !== result.customer_id);
    }
    
    this.save();
    return result;
  }

  async deleteCustomer(id: string) {
    await sleep(200);
    this.customers = this.customers.filter(c => c.customer_id !== id);
    delete this.customTasks[id];
    delete this.customerOverrides[id];
    delete this.customTasksOverrides[id];
    if (!this.deletedCustomerIds.includes(id)) {
       this.deletedCustomerIds.push(id);
    }
    this.save();
  }

  async getProducts() {
    await sleep(100);
    return [...this.products];
  }

  async saveProducts(prods: Product[]) {
    await sleep(300);
    this.products = [...prods];
    this.save();
    return true;
  }

  async getPlan(date: string) {
    await sleep(200);
    return this.tasks.filter(t => t.video_date === date || t._video_date_key === date);
  }

  async getCustomPlan(id: string) {
    await sleep(200);
    return this.customTasks[id] || [];
  }

  async saveCustomPlan(id: string, tasks: ExerciseTask[]) {
    await sleep(300);
    this.customTasks[id] = [...tasks];
    this.customTasksOverrides[id] = [...tasks];
    this.save();
  }

  async saveVideoGroupTasks(date: string, tasks: ExerciseTask[]) {
    await sleep(300);
    this.tasks = this.tasks.filter(t => t.video_date !== date);
    this.tasks.push(...tasks);
    this.save();
  }

  async deleteVideoGroupTasks(date: string) {
    await sleep(200);
    this.tasks = this.tasks.filter(t => t.video_date !== date);
    this.save();
  }

  async deleteVideoTask(id: string) {
    await sleep(100);
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.save();
  }
}

export const mockDB = new MockDatabase();
