import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Secret for Bunny Stream Token Authentication
const BUNNY_STREAM_TOKEN_AUTH_KEY = process.env.BUNNY_STREAM_TOKEN_AUTH_KEY || '';
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || '644769';

export default async function handler(req: any, res: any) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { video_id, task_id, customer_id, token } = req.body;
  
  if (!video_id || !BUNNY_STREAM_TOKEN_AUTH_KEY) {
    return res.status(400).json({ error: 'Thiếu thông tin yêu cầu hoặc hệ thống cấu hình chưa đủ.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1 & 2. Xác thực user từ Supabase Auth (Bearer) OR từ token học viên
  const authHeader = req.headers.authorization;
  let isAdmin = false;
  let authUserId = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.split('Bearer ')[1];
    const { data: { user }, error: authErr } = await supabase.auth.getUser(bearer);
    if (!authErr && user) {
       isAdmin = true;
       authUserId = user.id;
    }
  }

  let customer = null;

  if (!isAdmin) {
    if (!customer_id || !token) {
      return res.status(401).json({ error: 'Xác thực không hợp lệ. Vui lòng đăng nhập.' });
    }
    
    // Kiểm tra học viên
    const { data: custData, error: custErr } = await supabase
      .from('customers')
      .select('*')
      .eq('customer_id', customer_id)
      .eq('token', token)
      .maybeSingle();

    if (custErr || !custData) {
      return res.status(401).json({ error: 'Xác thực khách hàng không hợp lệ.' });
    }
    customer = custData;

    // 3. Kiểm tra hạn dùng của học viên
    if (customer.end_date) {
      const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
      today.setHours(0, 0, 0, 0);
      
      const parts = customer.end_date.split('-');
      // format is assumed dd-mm-yyyy or similar based on parsing in frontend.
      // But typically database holds YYYY-MM-DD. Let's parse effectively:
      let end = new Date(customer.end_date);
      if (isNaN(end.getTime()) && parts.length === 3) {
        // Fallback if it's DD-MM-YYYY
        const [d, m, y] = parts;
        end = new Date(`${y}-${m}-${d}T00:00:00Z`);
      }
      
      if (!isNaN(end.getTime()) && today > end) {
        // 4. Nếu user không có quyền hoặc đã hết hạn
        return res.status(403).json({ error: 'Tài khoản của bạn đã hết thời hạn xem video này. Vui lòng liên hệ quản trị viên để gia hạn.' });
      }
    }
    
    let accessState = customer?.access_state || "ACTIVE";
    if (customer?.status === "DELETED" || accessState === "EXPIRED" || accessState === "DELETED") {
       return res.status(403).json({ error: 'Tài khoản của bạn đã hết thời hạn xem video này. Vui lòng liên hệ quản trị viên để gia hạn.' });
    }
  }

  // 5. Nếu hợp lệ, tạo Bunny token 
  // Công thức: expires = current unix timestamp + 300 giây
  // token = SHA256(BUNNY_STREAM_TOKEN_AUTH_KEY + video_id + expires)
  const expires = Math.floor(Date.now() / 1000) + 300; // 5 phút
  
  const hashString = `${BUNNY_STREAM_TOKEN_AUTH_KEY}${video_id}${expires}`;
  const sha256 = crypto.createHash('sha256').update(hashString).digest('hex');
  const tokenUrlParam = sha256;

  const signed_embed_url = `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${video_id}?token=${tokenUrlParam}&expires=${expires}&autoplay=false&responsive=true`;

  // Insert Log if table exists (ignore error if table does not exist)
  if (authUserId || customer) {
     const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
     const user_agent = req.headers['user-agent'] || '';
     
     // We will try to insert async
     supabase.from('video_view_logs').insert({
       user_id: authUserId, // Only if admin/auth user
       customer_id: customer?.customer_id, // Also track customer if applicable
       task_id: task_id || null,
       bunny_video_id: video_id,
       ip: typeof ip === 'string' ? ip : ip[0],
       user_agent: user_agent
     }).then(({ error }) => {
       if (error) console.error("Could not insert log", error);
     });
  }

  return res.status(200).json({ signed_embed_url });
}
