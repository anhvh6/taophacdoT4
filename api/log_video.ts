import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: any, res: any) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
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
  
  const { customer_id, token } = req.body;
  
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
    
    // Convert to VN timezone YYYY-MM-DD
    const vnTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    const yyyy = vnTime.getFullYear();
    const mm = String(vnTime.getMonth() + 1).padStart(2, '0');
    const dd = String(vnTime.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
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
