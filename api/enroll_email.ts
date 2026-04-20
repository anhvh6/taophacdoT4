import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: any, res: any) {
  // Bật CORS cho Vercel
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { customerId, token, email } = req.body;
  
  if (!customerId || !token || !email || !supabaseUrl || !supabaseServiceKey) {
    return res.status(400).json({ success: false, message: 'Missing parameters or missing env variables (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Verify token using service role (bypasses RLS)
  const { data: customer } = await supabase
    .from('customers')
    .select('customer_id, email')
    .eq('customer_id', customerId)
    .eq('token', token)
    .maybeSingle();
    
  if (!customer) {
    return res.status(401).json({ success: false, message: 'Unauthorized (Token sai hoặc mã khách hàng không tồn tại trên Supabase)' });
  }

  if (customer.email && customer.email.trim() !== '') {
    // Đã có email rồi
    return res.status(200).json({ success: true, message: 'Email đã tồn tại từ trước' });
  }

  // Update email trực tiếp bằng quyền Service Role
  const { error } = await supabase
    .from('customers')
    .update({ email: email })
    .eq('customer_id', customerId);

  if (error) {
    return res.status(500).json({ success: false, message: error.message });
  }

  res.status(200).json({ success: true, message: 'Ghi Email thành công' });
}
