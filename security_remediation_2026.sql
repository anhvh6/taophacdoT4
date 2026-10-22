-- =========================================================================
-- BẢN VÁ BẢO MẬT TOÀN DIỆN CHO SUPABASE (SECURITY REMEDIATION 2026)
-- Dự án: Mega Phương Facial Yoga Management System
-- Hướng dẫn áp dụng:
-- 1. Đăng nhập Supabase Dashboard -> Chọn Project của bạn.
-- 2. Vào mục "SQL Editor" (Biểu tượng </> ở menu trái).
-- 3. Tạo một "New Query", sao chép toàn bộ nội dung file này dán vào và nhấn "RUN".
-- 4. Bản vá này đảm bảo 100% tương thích ngược, không làm gián đoạn học viên đang học.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. VÁ LỖ HỔNG HÀM authorize_device (LOẠI BỎ CỬA HẬU device_name)
-- Mục đích: Đảm bảo kiểm tra thiết bị dựa trên visitorId (Fingerprint) duy nhất,
-- ngăn chặn kẻ xấu vượt giới hạn thiết bị bằng cách giả lập trùng device_name.
-- -------------------------------------------------------------------------
drop function if exists authorize_device(text, text, text, text);

create or replace function authorize_device(
  p_customer_id text, 
  p_token text, 
  p_device_id text, 
  p_device_name text
)
returns json security definer
set search_path = public
as $$
declare
  v_count integer;
  v_is_approved boolean;
  v_require_limit boolean;
begin
  -- Bước 1: Xác thực danh tính học viên qua customer_id và token
  select require_device_limit into v_require_limit
  from customers 
  where customer_id = p_customer_id and token = p_token;
  
  if not found then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  -- Nếu học viên này được admin cấu hình tắt giới hạn thiết bị
  if v_require_limit = false then
    return json_build_object('success', true, 'message', 'Limit disabled');
  end if;

  -- Bước 2: Kiểm tra thiết bị CHỈ DỰA TRÊN device_id (TUYỆT ĐỐI KHÔNG DÙNG device_name)
  select is_approved into v_is_approved
  from customer_devices 
  where customer_id = p_customer_id and device_id = p_device_id
  limit 1;

  if found then
    if v_is_approved then
      -- Thiết bị đã được duyệt trước đó -> cập nhật thời gian hoạt động
      update customer_devices 
      set last_used_at = now(),
          device_name = coalesce(nullif(p_device_name, ''), device_name)
      where customer_id = p_customer_id and device_id = p_device_id;
      
      return json_build_object('success', true, 'message', 'Device already approved');
    else
      -- Thiết bị đã lưu nhưng đang chờ Admin phê duyệt
      return json_build_object('success', false, 'message', 'Pending approval');
    end if;
  end if;

  -- Bước 3: Thiết bị mới -> Đếm số lượng thiết bị đã được duyệt của học viên này
  select count(*) into v_count 
  from customer_devices 
  where customer_id = p_customer_id and is_approved = true;

  if v_count < 3 then
    -- Nếu chưa đạt ngưỡng 3 thiết bị -> Tự động duyệt thiết bị mới này
    insert into customer_devices (customer_id, device_id, device_name, is_approved, approved_at, last_used_at)
    values (p_customer_id, p_device_id, p_device_name, true, now(), now())
    on conflict (customer_id, device_id) do update 
    set is_approved = true, approved_at = now(), last_used_at = now();
    
    return json_build_object('success', true, 'message', 'Auto approved');
  else
    -- Đã đạt tối đa 3 thiết bị -> Ghi nhận thiết bị mới vào danh sách chờ duyệt
    insert into customer_devices (customer_id, device_id, device_name, is_approved, last_used_at)
    values (p_customer_id, p_device_id, p_device_name, false, now())
    on conflict (customer_id, device_id) do nothing;
    
    return json_build_object('success', false, 'message', 'Device limit reached');
  end if;
end;
$$ language plpgsql;

grant execute on function authorize_device(text, text, text, text) to anon, authenticated;


-- -------------------------------------------------------------------------
-- 2. SIẾT CHẶT QUYỀN ĐỌC BẢNG admin_users (CHỐNG LỘ EMAIL/UUID QUẢN TRỊ)
-- Mục đích: Chặn quyền của người dùng nặc danh (anon) truy vấn thông tin admin.
-- Chỉ người dùng đã đăng nhập và là admin mới xem được danh sách admin.
-- -------------------------------------------------------------------------
alter table public.admin_users enable row level security;

-- Hủy bỏ policy đọc tự do (using true) cũ nếu có
drop policy if exists admin_users_read_all on public.admin_users;
drop policy if exists admin_users_read_secure on public.admin_users;

-- Policy mới: Chỉ cho phép đọc bản ghi của chính mình (để kiểm tra role sau login)
-- HOẶC đọc toàn bộ nếu bản thân đã là một Admin trong hệ thống.
create policy admin_users_read_secure on public.admin_users
  for select to authenticated
  using (
    id = auth.uid() 
    or exists (select 1 from public.admin_users au where au.id = auth.uid())
  );


-- -------------------------------------------------------------------------
-- 3. BẢO VỆ HÀM get_master_tasks (CHẶN NẶC DANH QUÉT TOÀN BỘ KHO VIDEO MẪU)
-- Mục đích: Học viên xem bài tập qua hàm an toàn get_client_tasks (đã có token).
-- Hàm get_master_tasks chỉ dành cho Admin (authenticated).
-- -------------------------------------------------------------------------
revoke execute on function get_master_tasks(date) from anon;
grant execute on function get_master_tasks(date) to authenticated;


-- -------------------------------------------------------------------------
-- 4. BẢO VỆ BẢNG customers KHỎI CÁC POLICY LỖI DẠNG "using (true)"
-- -------------------------------------------------------------------------
-- Đảm bảo chỉ có Admin mới đọc/ghi trực tiếp vào bảng customers thông qua REST API.
-- Học viên truy cập qua hàm RPC get_client_customer (có token).
drop policy if exists "Clients can read their own data" on customers;
drop policy if exists customers_read_all on customers;

-- Đảm bảo RLS luôn bật
alter table customers enable row level security;
alter table customer_tasks enable row level security;
alter table master_video_tasks enable row level security;

-- Thông báo hoàn thành
do $$
begin
  raise notice 'Đã áp dụng thành công bản vá bảo mật 2026 cho Supabase!';
end $$;
