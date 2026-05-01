import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to reliably parse excel dates
function parseExcelDate(excelDate: any): string | null {
  if (!excelDate) return null;
  if (typeof excelDate === 'number') {
    const unixDate = (excelDate - 25569) * 86400 * 1000;
    return new Date(unixDate).toISOString();
  }
  return new Date(excelDate).toISOString();
}

async function sync() {
  const excelPath = 'd:\\Lap trinh\\Taophacdo\\QLKH_SupaBase (1).xlsx';
  const content = fs.readFileSync(excelPath);
  const workbook = XLSX.read(content, { type: 'buffer' });
  const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'customers') || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const rawData: any[] = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`Loaded ${rawData.length} rows from Excel.`);

  const { data: currentCustomers, error: fetchErr } = await supabase.from('customers').select('customer_id');
  if (fetchErr) {
    console.error("Error fetching current customers from DB:", fetchErr);
    process.exit(1);
  }
  
  const currentDbIds = new Set(currentCustomers?.map(c => c.customer_id) || []);
  const excelIds = new Set(rawData.map(r => r.customer_id));
  
  const customersToUpsert: any[] = [];
  
  for (const row of rawData) {
    // Check fields against DB schema. 
    // Format them correctly.
    // Assuming start_date, end_date, etc. might need correct parsing.
    
    // Process JSON field safely
    let san_pham = [];
    if (typeof row.san_pham === 'string') {
      try { san_pham = JSON.parse(row.san_pham); } catch (e) {}
    } else if (Array.isArray(row.san_pham)) {
      san_pham = row.san_pham;
    }

    let sidebar_blocks = [];
    if (typeof row.sidebar_blocks_json === 'string') {
      try { sidebar_blocks = JSON.parse(row.sidebar_blocks_json); } catch (e) {}
    } else if (Array.isArray(row.sidebar_blocks_json)) {
      sidebar_blocks = row.sidebar_blocks_json;
    }

    const start_date = parseExcelDate(row.start_date);
    const end_date = parseExcelDate(row.end_date);
    const video_date = parseExcelDate(row.Video_date || row.video_date);

    customersToUpsert.push({
      customer_id: row.customer_id,
      customer_name: row.customer_name || '',
      note: row.note || '',
      start_date: start_date,
      end_date: end_date,
      status: row.status || 'ACTIVE',
      created_at: row.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      chewing_status: row.chewing_status || '',
      duration_days: parseInt(row.duration_days || '30', 10) || 30,
      sidebar_blocks_json: sidebar_blocks,
      token: row.token || '',
      link: row.link || '',
      video_date: video_date,
      ma_vd: row.ma_vd || '',
      sdt: row.sdt ? String(row.sdt).trim() : '',
      email: row.email ? String(row.email).trim() : '',
      dia_chi: row.dia_chi || '',
      san_pham: san_pham,
      gia_tien: parseFloat(row.gia_tien || '0') || 0,
      trang_thai_gan: row.trang_thai_gan !== undefined ? row.trang_thai_gan : null,
      trang_thai: parseInt(row.trang_thai || '1', 10) || 1,
      app_title: row.app_title || '',
      app_slogan: row.app_slogan || '',
      // is_customized is checked dynamically usually
    });
  }

  // 1. Upsert records
  console.log(`Upserting ${customersToUpsert.length} records...`);
  const chunkSize = 100;
  for (let i = 0; i < customersToUpsert.length; i += chunkSize) {
    const chunk = customersToUpsert.slice(i, i + chunkSize);
    const { error: upsertErr } = await supabase.from('customers').upsert(chunk, { onConflict: 'customer_id' });
    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
    }
  }

  // 2. Remove redundant records
  const toDelete = [...currentDbIds].filter(id => !excelIds.has(id));
  console.log(`Found ${toDelete.length} records to delete.`);
  // Wait, deleting might break foreign keys as the user noted "kiểm tra lại cấu trúc, mối quan hệ ... để chạy ko bị lỗi"
  // Let's delete related records from customer_tasks and customer_devices first.
  if (toDelete.length > 0) {
    for (const deleteId of toDelete) {
      console.log(`Deleting ${deleteId} completely...`);
      // Delete tasks
      await supabase.from('customer_tasks').delete().eq('customer_id', deleteId);
      // Delete devices
      await supabase.from('customer_devices').delete().eq('customer_id', deleteId);
      // Delete customer
      const { error: delErr } = await supabase.from('customers').delete().eq('customer_id', deleteId);
      if (delErr) {
         console.error(`Failed to delete customer ${deleteId}:`, delErr);
      }
    }
  }

  console.log("Sync complete!");
}

sync().catch(console.error);
