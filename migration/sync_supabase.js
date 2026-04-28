import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const SOURCE_URL = 'https://stzxreguggqwuvljymzq.supabase.co';
const SOURCE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0enhyZWd1Z2dxd3V2bGp5bXpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjM2MDcyNiwiZXhwIjoyMDg3OTM2NzI2fQ.6D1WrFW2nQXUM-joKiVBML7Vk2HJVImzjTIAjNjmGF4';

const TARGET_URL = process.env.VITE_SUPABASE_URL || 'https://yovjwbswfeblfswdxown.supabase.co';
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvdmp3YnN3ZmVibGZzd2R4b3duIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ5NzU5MiwiZXhwIjoyMDkyMDczNTkyfQ.Spo-CLoGoqY5n32MjxI0LSBegyAcvdh7LPAKH49ScZs';

const sourceSupabase = createClient(SOURCE_URL, SOURCE_KEY);
const targetSupabase = createClient(TARGET_URL, TARGET_KEY);

const tables = [
  { src: 'Sản phẩm', target: 'products' },
  { src: 'Lich phac do', target: 'master_video_tasks' },
  { src: 'Customers', target: 'customers' },
  { src: 'Lịch trình', target: 'customer_tasks' }
];

function transformRow(target, row) {
  let newRow = {};

  if (target === 'products') {
    newRow.id_sp = row.ID_SP;
    newRow.ten_sp = row.Ten_SP;
    newRow.gia_nhap = row.Gia_Nhap || 0;
    newRow.gia_ban = row.Gia_Ban || 0;
    newRow.trang_thai = row.Trang_Thai || 1;
  } 
  else if (target === 'master_video_tasks') {
    newRow.video_date = row.Video_date;
    newRow.day = row.Day || 1;
    newRow.type = row.type;
    newRow.title = row.title;
    newRow.detail = row.detail;
    newRow.link = row.Link || row.link;
    newRow.nhom = row.Nhom || row.nhom;
    // Don't include other legacy fields like 'N', 'VIP3', 'Thời lượng'
  }
  else if (target === 'customers') {
    // Copy all fields and adjust 'Video_date'
    for (const k of Object.keys(row)) {
        if (k === 'Video_date') {
            newRow.video_date = row[k];
        } else {
            newRow[k] = row[k];
        }
    }
    if (!newRow.sidebar_blocks_json) newRow.sidebar_blocks_json = [];
    if (!newRow.san_pham) newRow.san_pham = [];
    if (!newRow.raw_backup) newRow.raw_backup = {};
  }
  else if (target === 'customer_tasks') {
    // Copy all fields and adjust 'Nhom'
    for (const k of Object.keys(row)) {
        if (k === 'Nhom') {
            newRow.nhom = row[k];
        } else if (k === 'Lọc') {
            // Ignore
        } else {
            newRow[k] = row[k];
        }
    }
  }

  // Clean empty strings for dates
  const dateFields = ['start_date', 'end_date', 'video_date', 'created_at', 'updated_at'];
  for (const field of dateFields) {
    if (newRow[field] === '') {
      newRow[field] = null;
    }
  }

  return newRow;
}

async function run() {
  console.log('Target URL:', TARGET_URL);
  try {
    for (const { src, target } of tables) {
      console.log(`\nProcessing table: ${src} -> ${target} ...`);
      
      let { data: sourceData, error: fetchError } = await sourceSupabase
        .from(src)
        .select('*');
        
      if (fetchError) {
        console.log(`Failed to fetch from ${src}:`, fetchError.message);
        continue;
      }
      
      console.log(`Found ${sourceData ? sourceData.length : 0} records in ${src}`);

      let pk = target === 'customers' ? 'id' : 'id';
      
      const { data: targetIds } = await targetSupabase.from(target).select(pk);
      if (targetIds && targetIds.length > 0) {
        console.log(`Deleting ${targetIds.length} existing records in ${target}...`);
        const ids = targetIds.map(t => t[pk]);
        const chunkSize = 1000;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          await targetSupabase.from(target).delete().in(pk, chunk);
        }
      }

      if (!sourceData || sourceData.length === 0) continue;

      // Transform data
      let finalData = sourceData.map(row => transformRow(target, row));
      for (const item of finalData) {
          // ensure customer_id exists for customer_tasks
          if (target === 'customer_tasks' && !item.customer_id) {
              console.warn("Missing customer_id for a task");
          }
      }
      
      const chunkSize = 500;
      for (let i = 0; i < finalData.length; i += chunkSize) {
        const chunk = finalData.slice(i, i + chunkSize);
        
        const { error: insertError } = await targetSupabase
          .from(target)
          .insert(chunk);
          
        if (insertError) {
          console.error(`Error inserting chunk to ${target}:`, insertError);
        } else {
            console.log(`Inserted ${chunk.length} records into ${target}`);
        }
      }
    }
    console.log("\nMigration completed successfully.");
  } catch(e) {
    console.error(e);
  }
}

run();
