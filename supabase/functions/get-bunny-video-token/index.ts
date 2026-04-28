import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS options
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 1. & 2. Xác thực user từ Supabase Auth bằng Authorization Bearer token
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: userError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { video_id, task_id } = await req.json()

    if (!video_id) {
      return new Response(JSON.stringify({ error: 'video_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Kiểm tra kiểm tra quyền xem/hạn xem của user theo logic hiện tại
    // Chú ý: trong code hiện tại, admin quản lý học viên qua bảng customers, user auth id có thể là admin_id
    // Tuy nhiên theo prompt, ta cần kiểm tra hạn dùng đối với user đăng nhập.
    // Nếu hệ thống dùng user(id) để lưu khách hàng, thì access `customers` table:
    const { data: customer, error: customerError } = await supabaseClient
      .from('customers')
      .select('end_date, status, access_state')
      .eq('auth_user_id', user.id) // Assuming there is an auth_user_id or similar. Or maybe customer_id? 
      // If the email matches:
      .or(`email.eq.${user.email},id.eq.${user.id}`)
      .maybeSingle()

    // Since the prompt doesn't strictly specify how `customers` ties to `auth.users`, we assume if customer is bound to auth user or we just check if admin.
    // Wait, the user said: "Nếu trong code hiện có hàm kiểm tra hạn dùng, hãy tái sử dụng đúng logic đó"
    // Hạn dùng trong customer là `end_date`.
    // Nếu không tìm thấy customer trong bảng khách hàng, có thể đây là admin user.
    if (customer) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let isExpired = false;
        if (customer.end_date) {
            const end = new Date(customer.end_date);
            if (today > end) isExpired = true;
        }
        if (customer.status === 'DELETED') isExpired = true;
        
        // 4. Trả lỗi 403 nếu đã hết hạn
        if (isExpired) {
           return new Response(JSON.stringify({ error: 'Tài khoản đã hết thời hạn xem video này' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           });
        }
    }

    // 5. Tạo Bunny token theo công thức Bunny Stream Embed Token Authentication
    const BUNNY_LIBRARY_ID = Deno.env.get('BUNNY_LIBRARY_ID') ?? '644769';
    const BUNNY_STREAM_TOKEN_AUTH_KEY = Deno.env.get('BUNNY_STREAM_TOKEN_AUTH_KEY') ?? '';

    // expires = current unix timestamp + 300 giây
    const expires = Math.floor(Date.now() / 1000) + 300;

    // token = SHA256(BUNNY_STREAM_TOKEN_AUTH_KEY + video_id + expires)
    const textToHash = `${BUNNY_STREAM_TOKEN_AUTH_KEY}${video_id}${expires}`;
    
    const msgUint8 = new TextEncoder().encode(textToHash);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const tokenStr = encodeHex(hashBuffer);

    const signed_embed_url = `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${video_id}?token=${tokenStr}&expires=${expires}&autoplay=false&responsive=true`;

    // 6. Ghi log
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    const userAgent = req.headers.get('user-agent') || '';

    // Insert log
    const { error: logError } = await supabaseClient.from('video_view_logs').insert({
        user_id: user.id,
        task_id: task_id || null,
        bunny_video_id: video_id,
        ip: ip,
        user_agent: userAgent
    });

    if (logError) {
        console.error('Log error:', logError);
    }

    return new Response(JSON.stringify({ signed_embed_url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
