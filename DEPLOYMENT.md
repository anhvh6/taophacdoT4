# Hướng dẫn triển khai (Vercel + Supabase)

Hệ thống quản lý Mega Phương đã được chuyển đổi từ Google Apps Script sang Supabase + Vercel.

## 1. Thiết lập Supabase

1. Truy cập [Supabase Dashboard](https://supabase.com) và tạo project mới.
2. Mở **SQL Editor** và chạy nội dung file `supabase_schema.sql` để tạo bảng và phân quyền.
3. Vào **Authentication > Users** để tạo tài khoản Admin đầu tiên.
4. Lấy `id` của user vừa tạo, vào bảng `admin_users` và thêm một dòng với `id` đó và `role = 'admin'`.

## 2. Di chuyển dữ liệu từ Google Sheets

Quy trình này giúp bạn chuyển toàn bộ dữ liệu từ hệ thống Google Sheets cũ sang Supabase.

### Bước 2.1: Xuất dữ liệu từ Google Sheets
1. Mở file Google Sheet quản lý hiện tại của bạn.
2. Trên thanh menu, chọn **Extensions > Apps Script**.
3. Một cửa sổ mới hiện ra, xóa hết code cũ (nếu có) và dán nội dung từ file `migration/export_script.gs` trong project này vào.
4. Nhấn nút **Save** (biểu tượng đĩa mềm) và đặt tên dự án là "Export Data".
5. Chọn hàm `exportDataToJSON` trong danh sách thả xuống và nhấn **Run**.
6. Nếu Google yêu cầu quyền truy cập, hãy nhấn **Review Permissions**, chọn tài khoản của bạn, nhấn **Advanced > Go to Export Data (unsafe)** và nhấn **Allow**.
7. Sau khi chạy xong, **quay lại tab Google Sheet**, bạn sẽ thấy một hộp thoại hiện lên chứa toàn bộ dữ liệu JSON.
8. Nhấn vào ô văn bản, nhấn `Ctrl + A` để chọn tất cả và copy toàn bộ nội dung này. (Không copy từ Nhật ký thực thi vì sẽ bị cắt bớt dữ liệu).

### Bước 2.2: Chuẩn bị file dữ liệu trong Project
1. Quay lại project này, tạo một file mới tại đường dẫn `migration/data_export.json`.
2. Dán nội dung JSON bạn vừa copy vào file này và lưu lại.

### Bước 2.3: Chạy lệnh Import vào Supabase
1. Đảm bảo bạn đã cài đặt đầy đủ các biến môi trường trong phần cấu hình của AI Studio:
   - `VITE_SUPABASE_URL`: URL của dự án Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: Key này nằm trong **Project Settings > API > service_role key** (đây là key có quyền cao nhất, dùng để bypass RLS khi migration).
2. Mở terminal và chạy lệnh sau để thực hiện migration:
   ```bash
   npx tsx migration/import_to_supabase.ts
   ```
3. Kiểm tra thông báo trong terminal. Nếu hiện "Migration completed successfully!" là bạn đã thành công.

## 3. Triển khai lên Vercel

1. Đẩy code lên GitHub.
2. Kết nối GitHub với Vercel.
3. Thiết lập các biến môi trường (Environment Variables) trên Vercel:
   - `VITE_SUPABASE_URL`: URL của project Supabase.
   - `VITE_SUPABASE_ANON_KEY`: Anon key của Supabase.
   - `VITE_APP_BASE_URL`: URL chính thức của app trên Vercel (ví dụ: `https://phacdo-megaphuong.vercel.app`).
4. Deploy!

## 4. Lưu ý quan trọng
- Link học viên cũ vẫn hoạt động nếu bạn giữ nguyên `customer_id` và `token` khi migrate.
- Link học viên mới sẽ được tạo dựa trên `VITE_APP_BASE_URL`.
