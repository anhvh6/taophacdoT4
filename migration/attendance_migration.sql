-- 1) Tạo bảng lưu trữ lịch sử chuyên cần chuyên biệt
CREATE TABLE IF NOT EXISTS attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    access_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Đảm bảo mỗi học viên chỉ có 1 dòng mỗi ngày để đếm chính xác số học viên
    UNIQUE(customer_id, access_date)
);

-- 2) Tạo index để biểu đồ thống kê chạy cực nhanh
CREATE INDEX IF NOT EXISTS idx_attendance_logs_date ON attendance_logs(access_date);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_customer ON attendance_logs(customer_id);

-- 3) Di chuyển dữ liệu cũ từ JSON sang bảng mới để không mất dữ liệu cũ
INSERT INTO attendance_logs (customer_id, access_date)
SELECT customer_id, (jsonb_array_elements_text(raw_backup->'video_open_dates'))::date
FROM customers
WHERE raw_backup ? 'video_open_dates'
ON CONFLICT (customer_id, access_date) DO NOTHING;
