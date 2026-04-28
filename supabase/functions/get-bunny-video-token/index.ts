import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
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

    const { video_id, task_id, customer_id, token } = await req.json()

    if (!video_id) {
      return new Response(JSON.stringify({ error: 'video_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Xác thực user (Hỗ trợ cả Admin qua JWT và Học viên qua customer_id + token)
    let authUser = null;
    let isStudentValid = false;
    let end_date = null;
    let status = null;

    // Admin: Xác thực thông qua Bearer token
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
       const { data: { user } } = await supabaseClient.auth.getUser();
       if (user) {
         authUser = user;
       }
    }

    // Client/Student: Xác thực thông qua customer_id và token
    // Để truy vấn không bị chặn bởi RLS, dùng service_role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (!authUser) {
       if (!customer_id || !token) {
           return new Response(JSON.stringify({ error: 'Unauthorized: Missing credentials' }), {
               status: 401,
               headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           });
       }

       const { data: customer } = await supabaseAdmin
           .from('customers')
           .select('end_date, status')
           .eq('customer_id', customer_id)
           .eq('token', token)
           .maybeSingle();

       if (!customer) {
           return new Response(JSON.stringify({ error: 'Tài khoản không hợp lệ hoặc sai Token' }), {
               status: 403,
               headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           });
       }
       
       isStudentValid = true;
       end_date = customer.end_date;
       status = customer.status;
    } else {
       // Nếu là admin, có thể cho vượt quyền hoặc kiểm tra nếu cần (ở đây mặc định Admin đc xem)
       isStudentValid = true;
       // Optional: you can query customers by auth_user_id if you want Admin to have expiration as well.
    }

    if (isStudentValid && !authUser) {
        // Kiểm tra hạn dùng
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let isExpired = false;
        
        if (end_date) {
            const end = new Date(end_date);
            if (today > end) isExpired = true;
        }
        if (status === 'DELETED') isExpired = true;
        
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
    const { error: logError } = await supabaseAdmin.from('video_view_logs').insert({
        user_id: authUser ? authUser.id : null,
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
