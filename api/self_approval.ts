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
  
  const { customer_id, type, code, old_email, new_email, device_id, device_name, token } = req.body;
  
  if (!customer_id || !type || !code || !token || !supabaseUrl || !supabaseServiceKey) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin yêu cầu hoặc cấu hình hệ thống.' });
  }

  // Generate Daily Verification Code (VN Timezone)
  const vnTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
  const dayStr = String(vnTime.getDate()).padStart(2, '0');
  const monthStr = String(vnTime.getMonth() + 1).padStart(2, '0');
  const expectedCode = `${dayStr[0]}${monthStr}${dayStr[1]}`;

  if (code !== expectedCode) {
    return res.status(200).json({ success: false, message: 'Mã xác thực của bạn không đúng, hãy liên hệ để được trợ giúp.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Security Check: Verify customer_id and token
  const { data: customer, error: authError } = await supabase
    .from('customers')
    .select('*')
    .eq('customer_id', customer_id)
    .eq('token', token)
    .maybeSingle();

  if (authError || !customer) {
    return res.status(401).json({ success: false, message: 'Xác thực khách hàng không hợp lệ.' });
  }

  try {
    if (type === 'email') {
      if (!new_email) return res.status(400).json({ success: false, message: 'Thiếu email mới.' });
      
      // Update email and reset pending_email
      const { error: updateError } = await supabase
        .from('customers')
        .update({ 
          email: new_email.toLowerCase().trim(),
          pending_email: null,
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', customer_id);

      if (updateError) throw updateError;

      // Log the event
      await supabase.from('admin_logs').insert({
        type: 'AUTO_APPROVED_EMAIL',
        customer_id: customer_id,
        old_email: old_email || customer.email,
        new_email: new_email,
        message: 'Học viên đã tự phê duyệt đổi email bằng mã xác thực.'
      });

    } else if (type === 'device') {
      if (!device_id) return res.status(400).json({ success: false, message: 'Thiếu thông tin thiết bị.' });

      // Upsert device and approve it
      const { error: deviceError } = await supabase
        .from('customer_devices')
        .upsert({
          customer_id: customer_id,
          device_id: device_id,
          device_name: device_name || 'Thiết bị tự phê duyệt',
          is_approved: true,
          approved_at: new Date().toISOString(),
          last_used_at: new Date().toISOString()
        }, { onConflict: 'customer_id,device_id' });

      if (deviceError) throw deviceError;

      // Log the event
      await supabase.from('admin_logs').insert({
        type: 'AUTO_APPROVED_DEVICE',
        customer_id: customer_id,
        approved_device: device_id,
        message: 'Học viên đã tự phê duyệt thiết bị mới bằng mã xác thực.'
      });

    } else {
      return res.status(400).json({ success: false, message: 'Loại phê duyệt không hợp lệ.' });
    }

    return res.status(200).json({ 
      success: true, 
      type: type,
      message: 'Tự phê duyệt thành công!',
      customer: type === 'email' ? { ...customer, email: new_email } : customer
    });

  } catch (err: any) {
    console.error('Self Approval Error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi thực hiện phê duyệt: ' + err.message });
  }
}
