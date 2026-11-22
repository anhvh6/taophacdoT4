import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: any, res: any) {
  // CORS Configuration
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  if (origin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { customer_id, token, day, client_date, client_timezone } = req.body;
  
  if (!customer_id || !token || !supabaseUrl || !supabaseServiceKey) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin yêu cầu.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify customer
  const { data: customer, error: authError } = await supabase
    .from('customers')
    .select('customer_id, raw_backup')
    .eq('customer_id', customer_id)
    .eq('token', token)
    .maybeSingle();

  if (authError || !customer) {
    return res.status(401).json({ success: false, message: 'Xác thực không hợp lệ.' });
  }

  try {
    let raw_backup = customer.raw_backup || {};
    if (typeof raw_backup === 'string') {
      try {
        raw_backup = JSON.parse(raw_backup);
      } catch (e) {
        raw_backup = {};
      }
    }
    raw_backup.last_video_open_time = new Date().toISOString();

    // Add to video_open_dates
    if (!raw_backup.video_open_dates || !Array.isArray(raw_backup.video_open_dates)) {
      raw_backup.video_open_dates = [];
    }

    // Add to completed_days
    if (!raw_backup.completed_days || !Array.isArray(raw_backup.completed_days)) {
      raw_backup.completed_days = [];
    }

    if (!raw_backup.completed_days_map || typeof raw_backup.completed_days_map !== 'object') {
      raw_backup.completed_days_map = {};
    }
    if (!raw_backup.date_to_lesson_day_map || typeof raw_backup.date_to_lesson_day_map !== 'object') {
      raw_backup.date_to_lesson_day_map = {};
    }
    if (!raw_backup.lesson_open_times || typeof raw_backup.lesson_open_times !== 'object') {
      raw_backup.lesson_open_times = {};
    }

    // Tự động sửa chữa dữ liệu nếu học viên có ngày học bị lệch do múi giờ VN ghi đè (ví dụ Bảo Ánh Dương)
    const curMap = raw_backup.completed_days_map;
    if (
      customer_id === 'C1795142748594ZH2TD' ||
      ((curMap[1] === '2026-11-21' || curMap['1'] === '2026-11-21') && (curMap[2] === '2026-11-21' || curMap['2'] === '2026-11-21'))
    ) {
      curMap[1] = '2026-11-19';
      curMap['1'] = '2026-11-19';
      curMap[2] = '2026-11-20';
      curMap['2'] = '2026-11-20';
      delete raw_backup.date_to_lesson_day_map['2026-11-21'];
      raw_backup.date_to_lesson_day_map['2026-11-19'] = 1;
      raw_backup.date_to_lesson_day_map['2026-11-20'] = 2;
      if (raw_backup.last_video_open_date === '2026-11-21') {
        raw_backup.last_video_open_date = '2026-11-20';
      }
      if (!raw_backup.video_open_dates) raw_backup.video_open_dates = [];
      if (!raw_backup.video_open_dates.includes('2026-11-19')) raw_backup.video_open_dates.push('2026-11-19');
      if (!raw_backup.video_open_dates.includes('2026-11-20')) raw_backup.video_open_dates.push('2026-11-20');
      raw_backup.video_open_dates = raw_backup.video_open_dates.filter((d: string) => d !== '2026-11-21');
    }

    // Xác định ngày học (dateStr) theo múi giờ thiết bị địa lý của học viên
    let dateStr = '';
    if (client_date && /^\d{4}-\d{2}-\d{2}$/.test(String(client_date).trim())) {
      dateStr = String(client_date).trim();
    } else {
      const vercelTz = req.headers['x-vercel-ip-timezone'] as string | undefined;
      const tz = client_timezone || vercelTz || 'Asia/Ho_Chi_Minh';
      try {
        const localTime = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
        const yyyy = localTime.getFullYear();
        const mm = String(localTime.getMonth() + 1).padStart(2, '0');
        const dd = String(localTime.getDate()).padStart(2, '0');
        dateStr = `${yyyy}-${mm}-${dd}`;
      } catch (e) {
        const now = new Date();
        dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }
    }

    if (client_timezone) {
      raw_backup.client_timezone = client_timezone;
    }

    const hasCompleted30 = raw_backup.completed_days.includes(30);

    if (day !== undefined && day !== null) {
      const dayNum = parseInt(day, 10);
      if (!isNaN(dayNum) && dayNum > 0 && dayNum <= 30) {
        if (!raw_backup.completed_days.includes(dayNum)) {
          raw_backup.completed_days.push(dayNum);
        }
        // Ghi nhan chinh xac ngay hoc va moc thoi gian UTC thuc te ma hoc vien mo
        raw_backup.completed_days_map[dayNum] = dateStr;
        raw_backup.lesson_open_times[dayNum] = new Date().toISOString();

        if (!hasCompleted30) {
          // Chưa học hết 30 bài: hệ thống ghi nhận bài học có ngày lớn nhất
          raw_backup.date_to_lesson_day_map[dateStr] = Math.max(Number(raw_backup.date_to_lesson_day_map[dateStr]) || 0, dayNum);
          raw_backup.last_opened_lesson_day = Math.max(Number(raw_backup.last_opened_lesson_day) || 0, dayNum);
        } else {
          // Đã học hết bài 30: ghi nhận bài mở / học gần nhất
          raw_backup.date_to_lesson_day_map[dateStr] = dayNum;
          raw_backup.last_opened_lesson_day = dayNum;
        }
        raw_backup.last_video_open_date = dateStr;
      }
    }
    
    if (!raw_backup.video_open_dates.includes(dateStr)) {
      raw_backup.video_open_dates.push(dateStr);
    }

    // Update customers table
    const { error: updateError } = await supabase
      .from('customers')
      .update({ raw_backup })
      .eq('customer_id', customer_id);

    if (updateError) throw updateError;

    // Log to attendance_logs table
    await supabase
      .from('attendance_logs')
      .upsert({ 
        customer_id: customer_id, 
        access_date: dateStr 
      }, { onConflict: 'customer_id,access_date' });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Log Video Error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
}
