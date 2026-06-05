-- =========================================================================
-- SCRIPT CẬP NHẬT LOGIC NHẬN DIỆN THIẾT BỊ BỊ LỖI FINGERPRINTJS
-- Hướng dẫn:
-- 1. Vào Supabase Dashboard
-- 2. Chọn mục SQL Editor (Biểu tượng </> ở menu trái)
-- 3. Tạo một Query mới (New Query)
-- 4. Copy toàn bộ nội dung file này dán vào và nhấn RUN
-- =========================================================================

-- 1. Cập nhật hàm authorize_device
drop function if exists authorize_device(text, text, text, text);
create or replace function authorize_device(p_customer_id text, p_token text, p_device_id text, p_device_name text)
returns json security definer
set search_path = public
as $$
declare
  v_count integer;
  v_is_approved boolean;
  v_require_limit boolean;
begin
  -- Check customer
  select require_device_limit into v_require_limit
  from customers where customer_id = p_customer_id and token = p_token;
  
  if not found then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  if v_require_limit = false then
    return json_build_object('success', true, 'message', 'Limit disabled');
  end if;

  -- Check if device already exists either by device_id OR an approved device with the same name
  select is_approved into v_is_approved
  from customer_devices 
  where customer_id = p_customer_id 
    and (device_id = p_device_id or (device_name = p_device_name and is_approved = true))
  limit 1;

  if found then
    if v_is_approved then
        -- If it was found via device_name, we should ensure the new device_id is also inserted/approved silently
        -- to keep the device_id updated without bothering the user
        insert into customer_devices (customer_id, device_id, device_name, is_approved, approved_at, last_used_at)
        values (p_customer_id, p_device_id, p_device_name, true, now(), now())
        on conflict (customer_id, device_id) do update 
        set is_approved = true, last_used_at = now(), device_name = p_device_name;
        
        return json_build_object('success', true, 'message', 'Already approved or matched by device name');
    else
        -- If found but pending (matched by exact device_id), check if we can auto-approve now (if approved count < 3)
        select count(*) into v_count from customer_devices where customer_id = p_customer_id and is_approved = true;
        if v_count < 3 then
            update customer_devices 
            set is_approved = true, approved_at = now(), last_used_at = now()
            where customer_id = p_customer_id and device_id = p_device_id;
            return json_build_object('success', true, 'message', 'Auto approved');
        else
            return json_build_object('success', false, 'message', 'Pending approval');
        end if;
    end if;
  end if;

  -- New device, check approved count only
  select count(*) into v_count from customer_devices where customer_id = p_customer_id and is_approved = true;

  if v_count < 3 then
    -- Auto approve new device
    insert into customer_devices (customer_id, device_id, device_name, is_approved, approved_at, last_used_at)
    values (p_customer_id, p_device_id, p_device_name, true, now(), now())
    on conflict (customer_id, device_id) do update set is_approved = true, approved_at = now(), last_used_at = now();
    return json_build_object('success', true, 'message', 'Auto approved');
  else
    -- Block and wait for admin
    insert into customer_devices (customer_id, device_id, device_name, is_approved)
    values (p_customer_id, p_device_id, p_device_name, false)
    on conflict (customer_id, device_id) do update set device_name = p_device_name, last_used_at = now();
    return json_build_object('success', false, 'message', 'Pending approval');
  end if;
end;
$$ language plpgsql;

-- Cấp quyền thực thi lại (Đề phòng bị mất quyền)
grant execute on function authorize_device(text, text, text, text) to anon, authenticated;

-- =========================================================================
-- DỌN DẸP DỮ LIỆU RÁC CŨ:
-- Xóa các bản ghi thiết bị "chưa duyệt" nhưng trùng tên với thiết bị "đã duyệt"
-- của cùng 1 khách hàng. Điều này giúp giải phóng rác trong database.
-- =========================================================================
DELETE FROM customer_devices cd1
WHERE cd1.is_approved = false
  AND EXISTS (
    SELECT 1 
    FROM customer_devices cd2
    WHERE cd2.customer_id = cd1.customer_id 
      AND cd2.device_name = cd1.device_name 
      AND cd2.is_approved = true
  );
