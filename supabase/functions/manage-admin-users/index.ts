import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Xử lý CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1) Khởi tạo Supabase Client với Service Role Key để có toàn quyền quản trị auth
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // 2) Xác thực Token của người dùng đang gọi
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Không tìm thấy thông tin đăng nhập' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3) Kiểm tra quyền Super Admin của người gọi trong DB
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('id', callerUser.id)
      .maybeSingle();

    if (profileError || !callerProfile || callerProfile.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Chỉ Super Admin mới có quyền thực hiện thao tác này' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4) Đọc body dữ liệu yêu cầu
    const body = await req.json();
    const { action, userId, email, password, role } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: 'Thiếu tham số action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 5) Thực thi theo action tương ứng
    if (action === 'create') {
      if (!email || !password || !role) {
        return new Response(JSON.stringify({ error: 'Vui lòng cung cấp đầy đủ email, mật khẩu và quyền' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Tạo tài khoản Auth
      const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (createError || !authUser.user) {
        return new Response(JSON.stringify({ error: createError?.message || 'Lỗi khi tạo tài khoản đăng nhập' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Lưu phân quyền vào public.admin_users
      const { error: dbError } = await supabaseAdmin
        .from('admin_users')
        .insert({
          id: authUser.user.id,
          email,
          role
        });

      if (dbError) {
        // Rollback tài khoản vừa tạo nếu lưu thông tin phân quyền thất bại để giữ nhất quán dữ liệu
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        return new Response(JSON.stringify({ error: dbError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, userId: authUser.user.id }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } 
    
    else if (action === 'update') {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Thiếu userId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Lấy email hiện tại để kiểm tra bảo mật
      const { data: targetUser } = await supabaseAdmin
        .from('admin_users')
        .select('email')
        .eq('id', userId)
        .maybeSingle();

      if (targetUser?.email === 'anhvh@gmail.com') {
        if (role && role !== 'super_admin') {
          return new Response(JSON.stringify({ error: 'Không thể hạ cấp vai trò của Quản trị viên cấp cao nhất này!' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      // Cập nhật Auth (nếu có mật khẩu hoặc email mới)
      const authUpdates: any = {};
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;

      if (Object.keys(authUpdates).length > 0) {
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
        if (authUpdateError) {
          return new Response(JSON.stringify({ error: authUpdateError.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      // Cập nhật public.admin_users
      const dbUpdates: any = {};
      if (email) dbUpdates.email = email;
      if (role) dbUpdates.role = role;

      if (Object.keys(dbUpdates).length > 0) {
        const { error: dbError } = await supabaseAdmin
          .from('admin_users')
          .update(dbUpdates)
          .eq('id', userId);

        if (dbError) {
          return new Response(JSON.stringify({ error: dbError.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } 
    
    else if (action === 'delete') {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Thiếu userId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Không cho tự xóa tài khoản của chính mình
      if (userId === callerUser.id) {
        return new Response(JSON.stringify({ error: 'Bạn không thể tự xóa tài khoản của chính mình!' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Không cho phép xóa tài khoản anhvh@gmail.com
      const { data: targetUser } = await supabaseAdmin
        .from('admin_users')
        .select('email')
        .eq('id', userId)
        .maybeSingle();

      if (targetUser?.email === 'anhvh@gmail.com') {
        return new Response(JSON.stringify({ error: 'Không thể xóa tài khoản Quản trị viên cấp cao nhất này!' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Xóa trong Auth (sẽ cascade tự động xóa bên bảng public.admin_users nhờ khóa ngoại cascade)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } 
    
    else {
      return new Response(JSON.stringify({ error: 'Hành động không được hỗ trợ' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (err: any) {
    console.error('Lỗi Edge Function:', err);
    return new Response(JSON.stringify({ error: err.message || 'Lỗi máy chủ nội bộ' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
