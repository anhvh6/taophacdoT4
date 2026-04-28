import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha256(message: string) {
  const msgUint8 = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    const body = await req.json()
    const { video_id, customer_id, token, task_id } = body

    if (!video_id) {
      return new Response(JSON.stringify({ error: 'Thiếu video_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let hasAccess = false;
    let end_date = null;
    let status = null;

    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
       const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
       if (user) hasAccess = true;
    }

    if (!hasAccess && customer_id && token) {
       const { data: customer } = await supabaseAdmin
           .from('customers')
           .select('end_date, status')
           .eq('customer_id', customer_id)
           .eq('token', token)
           .maybeSingle();

       if (customer) {
          hasAccess = true;
          end_date = customer.end_date;
          status = customer.status;
       }
    }

    if (!hasAccess) {
       return new Response(JSON.stringify({ error: 'Truy cập không hợp lệ hoặc sai Token' }), {
         status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       })
    }

    if (end_date || status) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (status === 'DELETED' || (end_date && today > new Date(end_date))) {
          return new Response(JSON.stringify({ error: 'Tài khoản đã hết thời hạn xem video này' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
    }

    const libraryId = Deno.env.get('BUNNY_LIBRARY_ID') || '644769';
    const securityKey = Deno.env.get('BUNNY_STREAM_TOKEN_AUTH_KEY') || '';
    const expires = Math.floor(Date.now() / 1000) + 300;
    
    const tokenStr = await sha256(securityKey + video_id + expires);
    const signed_embed_url = `https://iframe.mediadelivery.net/embed/${libraryId}/${video_id}?token=${tokenStr}&expires=${expires}&autoplay=false&responsive=true`;

    // Ghi log (Sử dụng try-catch riêng để không làm ảnh hưởng đến việc xem video nếu log lỗi)
    try {
      await supabaseAdmin.from('video_view_logs').insert({
          bunny_video_id: video_id,
          task_id: task_id || null,
          ip: req.headers.get('x-forwarded-for') || '',
          user_agent: req.headers.get('user-agent') || ''
      });
    } catch (logErr) {
      console.error('Lỗi khi ghi log:', logErr);
    }

    return new Response(JSON.stringify({ signed_embed_url }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Lỗi hệ thống:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
