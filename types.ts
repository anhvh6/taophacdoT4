
export enum ExerciseType {
  MANDATORY = "Bài bắt buộc",
  OPTIONAL = "Bài bổ trợ"
}

export enum CustomerStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DELETED = "DELETED"
}

export interface Product {
  id_sp: string;
  ten_sp: string;
  gia_nhap: number;
  gia_ban: number;
  trang_thai: number; 
}

export interface PurchasedProduct {
  id_sp: string;
  ten_sp: string;
  so_luong: number;
  don_gia: number;
  gia_nhap: number;
  thanh_tien: number;
}

export interface SidebarBlock {
  id: string;
  title: string;
  content: string;
  type: 'default' | 'dark';
  video_link?: string;
  is_chat?: boolean;
}

export interface ExerciseTask {
  id?: string;
  day: number;
  type: ExerciseType;
  title: string;
  detail: string;
  link: string;
  is_deleted: boolean;
  sort_order?: number;
  video_date?: string; 
  nhom?: string;
  _rowNumber?: number;
  _video_date_key?: string;
  _is_master?: boolean; // Flag to identify if task is from master sheet
}

export interface VideoGroup {
  video_date: string;
  video_date_key: string;
  total_days: number;
  total_tasks: number;
  mandatory_tasks: number;
  optional_tasks: number;
  active_students: number;
  nhom?: string;
}

export interface Customer {
  id?: string;
  customer_id: string;
  customer_name: string;
  sdt: string;
  email: string;
  dia_chi: string;
  san_pham: PurchasedProduct[];
  gia_tien: number;
  trang_thai_gan: string;
  trang_thai: number;
  ma_vd: string;
  note: string;
  chewing_status: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  video_date: string;
  status: CustomerStatus;
  sidebar_blocks_json: SidebarBlock[];
  link: string;
  token: string;
  created_at: string;
  updated_at: string;
  app_title?: string;
  app_slogan?: string;
  is_customized?: boolean;
  expire_warning?: boolean;
  Video_date?: string;
  require_google_auth?: boolean;
  require_device_limit?: boolean;
  pending_email?: string;
  // Fix: Added missing optional properties used in ClientView logic to satisfy TypeScript
  allowed_day?: number;
  access_state?: string;
  blocks?: SidebarBlock[];
  raw_backup?: any;
}

export interface CustomerDevice {
  id?: string;
  customer_id: string;
  device_id: string;
  device_name: string;
  is_approved: boolean;
  last_used_at?: string;
  created_at?: string;
}
