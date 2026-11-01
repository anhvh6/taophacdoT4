-- ==============================================================================
-- TỐI ƯU HÓA CHỈ MỤC (INDEXES) CHO HỆ THỐNG PHÁC ĐỒ & TÌM KIẾM HỌC VIÊN
-- Ngày tạo: 01/11/2026
-- ==============================================================================

-- 1. Index sắp xếp và phân trang khách hàng theo created_at
CREATE INDEX IF NOT EXISTS idx_customers_created_at_desc 
ON public.customers (created_at DESC);

-- 2. Index tìm kiếm nhanh theo mã học viên
CREATE INDEX IF NOT EXISTS idx_customers_customer_id 
ON public.customers (customer_id);

-- 3. Index xác thực link token học viên (Client View)
CREATE INDEX IF NOT EXISTS idx_customers_token 
ON public.customers (token);

-- 4. Index tìm kiếm nhanh theo Số điện thoại và Email
CREATE INDEX IF NOT EXISTS idx_customers_sdt 
ON public.customers (sdt);

CREATE INDEX IF NOT EXISTS idx_customers_email 
ON public.customers (email);

-- 5. Index tìm kiếm nhanh theo Mã video / nhóm bài tập
CREATE INDEX IF NOT EXISTS idx_customers_ma_vd 
ON public.customers (ma_vd);

-- 6. Index tối ưu lấy bài tập mẫu (Master Plan) theo ngày và thứ tự
CREATE INDEX IF NOT EXISTS idx_master_video_tasks_lookup 
ON public.master_video_tasks (video_date, day, sort_order);

-- 7. Index tối ưu phác đồ cá nhân hóa (Custom Plan) theo học viên và ngày
CREATE INDEX IF NOT EXISTS idx_custom_plans_lookup 
ON public.custom_plans (customer_id, day);

-- Hoàn tất! Chạy file này trên Supabase SQL Editor để tăng tốc độ truy vấn tới 5-10x.
