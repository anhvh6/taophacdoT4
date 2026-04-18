import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * SUPABASE IMPORT SCRIPT
 * 
 * 1. Export your Google Sheets data using export_script.gs
 * 2. Save the JSON output to migration/data_export.json
 * 3. Set your Supabase credentials in .env or environment variables:
 *    - VITE_SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY
 * 4. Run: npx tsx migration/import_to_supabase.ts
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for migration

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  const rawData = fs.readFileSync('./migration/data_export.json', 'utf8');
  const data = JSON.parse(rawData);

  // 1. Migrate Products
  if (data['Sản phẩm']) {
    console.log('Migrating products...');
    const products = data['Sản phẩm'].map((row: any) => ({
      id_sp: row['ID'] || row['id_sp'],
      ten_sp: row['Tên sản phẩm'] || row['ten_sp'],
      gia_nhap: parseFloat(row['Giá nhập'] || row['gia_nhap'] || 0),
      gia_ban: parseFloat(row['Giá bán'] || row['gia_ban'] || 0),
      trang_thai: parseInt(row['Trạng thái'] || row['trang_thai'] || 1),
      raw_backup: row
    }));
    await supabase.from('products').upsert(products, { onConflict: 'id_sp' });
  }

  // 2. Migrate Customers
  if (data['Customers']) {
    console.log('Migrating customers...');
    const customers = data['Customers'].map((row: any) => ({
      customer_id: row['customer_id'],
      customer_name: row['customer_name'],
      sdt: row['sdt'],
      email: row['email'],
      dia_chi: row['dia_chi'],
      san_pham: typeof row['san_pham'] === 'string' ? JSON.parse(row['san_pham']) : [],
      gia_tien: parseFloat(row['gia_tien'] || 0),
      trang_thai_gan: row['trang_thai_gan'],
      trang_thai: parseInt(row['trang_thai'] || 1),
      ma_vd: row['ma_vd'],
      note: row['note'],
      chewing_status: row['chewing_status'],
      start_date: row['start_date'] ? new Date(row['start_date']).toISOString().split('T')[0] : null,
      end_date: row['end_date'] ? new Date(row['end_date']).toISOString().split('T')[0] : null,
      duration_days: parseInt(row['duration_days'] || 30),
      video_date: row['video_date'] ? new Date(row['video_date']).toISOString().split('T')[0] : null,
      status: row['status'] || 'ACTIVE',
      sidebar_blocks_json: typeof row['sidebar_blocks_json'] === 'string' ? JSON.parse(row['sidebar_blocks_json']) : [],
      link: row['link'],
      token: row['token'],
      app_title: row['app_title'],
      app_slogan: row['app_slogan'],
      is_customized: row['is_customized'] === true || row['is_customized'] === 'TRUE',
      raw_backup: row
    }));
    await supabase.from('customers').upsert(customers, { onConflict: 'customer_id' });
  }

  // 3. Migrate Master Plan
  if (data['Lich phac do']) {
    console.log('Migrating master plan...');
    const masterTasks = data['Lich phac do'].map((row: any) => ({
      video_date: row['Video_date'] ? new Date(row['Video_date']).toISOString().split('T')[0] : null,
      day: parseInt(row['Day'] || 0),
      type: row['type'],
      title: row['title'],
      detail: row['detail'],
      link: row['Link'],
      sort_order: parseInt(row['N'] || 0),
      raw_backup: row
    }));
    await supabase.from('master_video_tasks').insert(masterTasks);
  }

  // 4. Migrate Customer Tasks
  if (data['Lịch trình']) {
    console.log('Migrating customer tasks...');
    const customerTasks = data['Lịch trình'].map((row: any) => ({
      customer_id: row['customer_id'],
      day: parseInt(row['day'] || 0),
      type: row['type'],
      title: row['title'],
      detail: row['detail'],
      link: row['link'],
      is_deleted: row['is_deleted'] === true || row['is_deleted'] === 'TRUE',
      sort_order: parseInt(row['sort_order'] || 0),
      raw_backup: row
    }));
    await supabase.from('customer_tasks').insert(customerTasks);
  }

  // 5. Migrate Courses
  if (data['Khóa học']) {
    console.log('Migrating courses...');
    const courses = data['Khóa học'].map((row: any) => ({
      id: row['ID'] || row['id'],
      name: row['Tên khóa học'] || row['name'],
      description: row['Mô tả'] || row['description'],
      fee: parseFloat(row['Học phí'] || row['fee'] || 0),
      duration: row['Thời lượng'] || row['duration'],
      status: parseInt(row['Trạng thái'] || row['status'] || 1),
      raw_backup: row
    }));
    await supabase.from('courses').upsert(courses, { onConflict: 'id' });
  }

  console.log('Migration completed successfully!');
}

migrate().catch(console.error);
