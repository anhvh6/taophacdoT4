-- =========================================================================
-- SCRIPT THÊM TÍNH NĂNG HẸN TƯ VẤN CHO HỌC VIÊN
-- Hướng dẫn:
-- 1. Vào Supabase Dashboard
-- 2. Chọn mục SQL Editor (Biểu tượng </> ở menu trái)
-- 3. Tạo một Query mới (New Query)
-- 4. Copy toàn bộ nội dung file này dán vào và nhấn RUN
-- =========================================================================

-- Thêm cột is_consultation (Boolean) vào bảng customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS is_consultation BOOLEAN DEFAULT false;
