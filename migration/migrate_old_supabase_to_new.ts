import { createClient, SupabaseClient } from '@supabase/supabase-js';

type AnyRow = Record<string, any>;

const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL;
const OLD_SUPABASE_SERVICE_ROLE_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;
const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL;
const NEW_SUPABASE_SERVICE_ROLE_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;

if (!OLD_SUPABASE_URL || !OLD_SUPABASE_SERVICE_ROLE_KEY || !NEW_SUPABASE_URL || !NEW_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY, NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const oldDb = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY);
const newDb = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY);

const pick = (row: AnyRow, keys: string[], fallback: any = null) => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return row[k];
  }
  return fallback;
};

const toNum = (v: any, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const toDate = (v: any) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

async function fetchAllFromCandidates(client: SupabaseClient, candidates: string[]): Promise<{ table: string; rows: AnyRow[] }> {
  for (const table of candidates) {
    try {
      const { data, error } = await client.from(table).select('*').limit(1);
      if (error) continue;

      const rows: AnyRow[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const to = from + pageSize - 1;
        const { data: page, error: pageErr } = await client.from(table).select('*').range(from, to);
        if (pageErr) throw pageErr;
        if (!page || page.length === 0) break;
        rows.push(...page);
        if (page.length < pageSize) break;
        from += pageSize;
      }
      return { table, rows };
    } catch {
      // try next table name
    }
  }
  return { table: '', rows: [] };
}

async function upsertBatched(table: string, rows: AnyRow[], onConflict: string) {
  if (!rows.length) return;
  const size = 500;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await newDb.from(table).upsert(chunk, { onConflict });
    if (error) throw error;
  }
}

async function insertBatched(table: string, rows: AnyRow[]) {
  if (!rows.length) return;
  const size = 500;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await newDb.from(table).insert(chunk);
    if (error) throw error;
  }
}

async function migrate() {
  console.log('Starting migration OLD -> NEW Supabase ...');

  // Products
  const productsSource = await fetchAllFromCandidates(oldDb, ['products', 'Sản phẩm']);
  const products = productsSource.rows
    .map((r) => ({
      id_sp: String(pick(r, ['id_sp', 'ID_SP', 'ID'], '')).trim(),
      ten_sp: String(pick(r, ['ten_sp', 'Ten_SP', 'Tên sản phẩm'], '')).trim(),
      gia_nhap: toNum(pick(r, ['gia_nhap', 'Gia_Nhap', 'Giá nhập'], 0), 0),
      gia_ban: toNum(pick(r, ['gia_ban', 'Gia_Ban', 'Giá bán'], 0), 0),
      trang_thai: Math.trunc(toNum(pick(r, ['trang_thai', 'Trang_Thai', 'Trạng thái'], 1), 1)),
      raw_backup: r
    }))
    .filter((r) => r.id_sp);
  await upsertBatched('products', products, 'id_sp');
  console.log(`Products: ${products.length} rows from ${productsSource.table || 'N/A'}`);

  // Customers
  const customersSource = await fetchAllFromCandidates(oldDb, ['customers', 'Customers']);
  const customers = customersSource.rows
    .map((r) => {
      const sanPhamRaw = pick(r, ['san_pham'], []);
      const sidebarRaw = pick(r, ['sidebar_blocks_json'], []);
      const parseJson = (v: any, def: any) => {
        if (typeof v === 'string') {
          try {
            return JSON.parse(v);
          } catch {
            return def;
          }
        }
        return v ?? def;
      };
      const token = String(pick(r, ['token'], '')).trim();
      return {
        customer_id: String(pick(r, ['customer_id'], '')).trim(),
        customer_name: pick(r, ['customer_name'], null),
        sdt: pick(r, ['sdt'], null),
        email: pick(r, ['email'], null),
        dia_chi: pick(r, ['dia_chi'], null),
        san_pham: parseJson(sanPhamRaw, []),
        gia_tien: toNum(pick(r, ['gia_tien'], 0), 0),
        trang_thai_gan: pick(r, ['trang_thai_gan'], null),
        trang_thai: Math.trunc(toNum(pick(r, ['trang_thai'], 1), 1)),
        ma_vd: pick(r, ['ma_vd'], null),
        note: pick(r, ['note'], null),
        chewing_status: pick(r, ['chewing_status'], null),
        start_date: toDate(pick(r, ['start_date'], null)),
        end_date: toDate(pick(r, ['end_date'], null)),
        duration_days: Math.trunc(toNum(pick(r, ['duration_days'], 30), 30)),
        video_date: toDate(pick(r, ['video_date', 'Video_date'], null)),
        status: pick(r, ['status'], 'ACTIVE') || 'ACTIVE',
        sidebar_blocks_json: parseJson(sidebarRaw, []),
        link: pick(r, ['link'], null),
        token: token || Math.random().toString(36).slice(2, 16),
        app_title: pick(r, ['app_title'], null),
        app_slogan: pick(r, ['app_slogan'], null),
        is_customized: !!pick(r, ['is_customized'], false),
        raw_backup: r
      };
    })
    .filter((r) => r.customer_id);
  await upsertBatched('customers', customers, 'customer_id');
  console.log(`Customers: ${customers.length} rows from ${customersSource.table || 'N/A'}`);

  // Master tasks
  const masterSource = await fetchAllFromCandidates(oldDb, ['master_video_tasks', 'Lich phac do']);
  const masterTasks = masterSource.rows
    .map((r) => ({
      video_date: toDate(pick(r, ['video_date', 'Video_date'], null)),
      day: Math.trunc(toNum(pick(r, ['day', 'Day', 'N'], 0), 0)),
      type: pick(r, ['type'], null),
      title: pick(r, ['title'], null),
      detail: pick(r, ['detail'], null),
      link: pick(r, ['link', 'Link'], null),
      nhom: pick(r, ['nhom', 'Nhom'], null),
      sort_order: Math.trunc(toNum(pick(r, ['sort_order', 'N', 'day', 'Day'], 0), 0)),
      raw_backup: r
    }))
    .filter((r) => r.video_date && r.day > 0);
  if (masterTasks.length) {
    const { error: delErr } = await newDb.from('master_video_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) throw delErr;
    await insertBatched('master_video_tasks', masterTasks);
  }
  console.log(`Master tasks: ${masterTasks.length} rows from ${masterSource.table || 'N/A'}`);

  // Customer tasks
  const customerTaskSource = await fetchAllFromCandidates(oldDb, ['customer_tasks', 'Lịch trình']);
  const customerTasks = customerTaskSource.rows
    .map((r) => ({
      customer_id: String(pick(r, ['customer_id'], '')).trim(),
      day: Math.trunc(toNum(pick(r, ['day', 'Day'], 0), 0)),
      type: pick(r, ['type'], null),
      title: pick(r, ['title'], null),
      detail: pick(r, ['detail'], null),
      link: pick(r, ['link', 'Link'], null),
      nhom: pick(r, ['nhom', 'Nhom'], null),
      is_deleted: !!pick(r, ['is_deleted'], false),
      sort_order: Math.trunc(toNum(pick(r, ['sort_order', 'day'], 0), 0)),
      raw_backup: r
    }))
    .filter((r) => r.customer_id && r.day > 0);
  if (customerTasks.length) {
    const { error: delErr } = await newDb.from('customer_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) throw delErr;
    await insertBatched('customer_tasks', customerTasks);
  }
  console.log(`Customer tasks: ${customerTasks.length} rows from ${customerTaskSource.table || 'N/A'}`);

  // Courses
  const coursesSource = await fetchAllFromCandidates(oldDb, ['courses', 'Khóa học']);
  const courses = coursesSource.rows
    .map((r) => ({
      id: String(pick(r, ['id', 'ID'], '')).trim(),
      name: pick(r, ['name', 'Tên khóa học'], null),
      description: pick(r, ['description', 'Mô tả'], null),
      fee: toNum(pick(r, ['fee', 'Học phí'], 0), 0),
      duration: pick(r, ['duration', 'Thời lượng'], null),
      status: Math.trunc(toNum(pick(r, ['status', 'Trạng thái'], 1), 1)),
      raw_backup: r
    }))
    .filter((r) => r.id);
  await upsertBatched('courses', courses, 'id');
  console.log(`Courses: ${courses.length} rows from ${coursesSource.table || 'N/A'}`);

  console.log('Migration completed successfully.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
