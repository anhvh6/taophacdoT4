# KI (Knowledge Item): Mega Phương Facial Yoga Management System

Tài liệu này lưu trữ toàn bộ kiến thức, các luồng hoạt động (workflow) và các tính năng đã phát triển của dự án để đảm bảo Antigravity có một bộ nhớ đầy đủ phục vụ các session bảo trì, nâng cấp, và sửa lỗi trong tương lai.

## 1. Tổng quan dự án (Project Overview)
- **Mục đích:** Hệ thống quản lý phác đồ tập luyện và nâng cơ trẻ hóa học viên Mega Phương.
- **Kho lưu trữ/Stack:** React/Next (Vite), Supabase, Bunny Stream API, Vercel, TailwindCSS.
- **Domain Production:** `https://phacdo4.vercel.app` (Vercel deployment chính thức).

---

## 2. Các luồng (Workflows) chính

### 2.1. Quản trị học viên (Admin & Migration)
- **Supabase Migration:** Trước đó chuyển đổi từ cơ sở hạ tầng Google Apps Script / Sheets sang DB Supabase hiện đại (`master_video_tasks`, `custom_client_tasks`, `customers`, ...).
- **Phân quyền truy cập Admin:** Dựa vào bảng `admin_users` trên Supabase khớp với `auth.users.id`. Nếu Admin xem (onNavigate), một số rule bảo mật được bypass để dễ quản lý.
- **Tự động đồng bộ Lịch trình:** Đối với các ngày tập chia hết cho 3 (ngày 3, 6, 9...), hệ thống có trigger ngầm cập nhật (`background refresh`) đồng bộ hóa tự động trạng thái bài tập của học viên với Master Plan từ cơ sở dữ liệu để luôn có bài mới nhất.

### 2.2. Hệ thống xác thực và Bảo mật truy cập (Security & Self-Approval)
Hệ thống sử dụng bảo mật đa tầng để ngăn chặn chia sẻ tài khoản:
1. **Device Limit (Kiểm tra thiết bị):** Dùng `FingerprintJS` sinh `visitorId`. Lần đầu tiên truy cập, học viên được duyệt thiết bị trên phiên bản hiện tại.
2. **Email Verification qua Google OAuth:** Yêu cầu đăng nhập Google để định danh học viên. Hệ thống tự động so khớp email đã học với email đăng ký.
3. **Tính năng Tự Phê Duyệt Hệ Thống (Self-Approval):** 
   - Thay vì yêu cầu Admin thay thông tin cho trường hợp sai thiết bị/thiết bị mới hoặc đổi Email đăng nhập, học viên có thể nhấp vào **Nhập mã xác thực** (mã 4 số sinh theo công thức Date).
   - Nếu mã chính xác, Backend tự động cập nhật Database cập nhật lại thiết bị/email. Trải nghiệm học viên được liền mạch thay vì gián đoạn chờ duyệt.
4. **Anti-tamper (Chống DevTools):**
   - Trong view học viên (`pages/ClientView.tsx`), hệ thống đã Disable toàn bộ:
     - Chuột phải (Context menu).
     - F12 (Developer tools).
     - Ctrl+Shift+I / J / C.
     - Ctrl+U (Xem mã nguồn).
   - *Ghi chú:* Khi là tài khoản Admin (`onNavigate=true`), các rule Anti-tamper được tạm ngưng để có thể Debug tùy ý.

### 2.3. Trình phát Video chống tải lậu (BunnyCDN DRM Integration)
Đây là quy trình bảo mật lõi để bảo vệ các video độc quyền của Mega Phương (tránh IDM / Cốc Cốc tải lậu):
1. **Nguyên lý gốc:** Frontend không nhận và không tạo luồng Playlist `m3u8` hay file `mp4`.
2. **Quy trình hoạt động:** Frontend truyền `video_id` -> Function Edge Supabase (hoặc API của ứng dụng `api/get-bunny-video-token.ts`) sẽ sử dụng thư viện SHA-256 mã hóa bằng token bí mật (`BUNNY_STREAM_TOKEN_AUTH_KEY` + `LibraryId` + `Expires`).
3. **Kết quả hiển thị:** Backend trả về `signed_embed_url` dạng Iframe Player (`https://iframe.mediadelivery.net/embed...`). ClientView nhận và render qua thẻ `<iframe src="...">` an toàn.
4. **Cấu hình trên Dashboard BunnyCDN Core:**
   - MediaCage Basic DRM: **ON**
   - Token Authentication: **ON**
   - Direct Block Access: **ON**
   - MP4 Fallback / Early Play: **OFF** (Tuyệt đối không bật)

---

## 3. Kiến trúc Frontend - Điểm lưu ý (Frontend Architecture)

- **`ClientView.tsx`**: Đây là trái tim của giao diện hiển thị cho Học Viên. Chứa các quy tắc mở khóa bài tập (dựa theo End Date / allowed days), UI Phác đồ 30 ngày, Modal Đăng nhập / Nhập mã / Xem video...
  - **Phát Video (`handlePlayVideo`)**: Hàm này nhận diện xem Link lưu trên DB là dạng mới (Chỉ có ID) hay dạng cũ (`https://...`). Nếu mới, gọi API sinh iframe. Tránh dùng `window.open` mà chèn link thẳng vào bộ phát Modal của React.
- **Toasted Alerts:** Hệ thống tự động thông báo với các Link cũ (`mediadelivery`) rằng "video không được bảo vệ tối đa", báo hiệu quy trình nâng cấp file DB phía Admin chưa đổi hoàn tất.
- **CustomerService / PlanService**: Giữ vai trò xử lý logic lấy dữ liệu (Stale-while-revalidate UX với local storage cache giúp trang tải lên siêu tốc ngay khi F5 trước cả khi server phản hồi).

---

## 4. Nhật ký Triển Khai và Sửa Lỗi (Log & Fixes)
*Nhật ký này sẽ được Antigravity/Dev update thường xuyên:*
- **Tháng 4/2026:**
  - Build UI Quản trị viên và Migrate toàn bộ Database sang Supabase.
  - Fix bug: Email Mismatch & Thêm luồng Login Google cho Device Verification.
  - Implement mã Xác thực tự duyệt (Self-Approval) thay vì cần Admin click.
  - Phát hiện Cốc Cốc bắt link tải -> Fix lại trình phát video, loại bỏ toàn bộ direct mp4/m3u8, code lại `api/get-bunny-video-token` thay thế `video src` html truyền thống. Cấu hình Bunny Dashboard tắt MP4 Fallback.
  - Add Anti-tamper block F12/Right click vào `ClientView.tsx`.
  - Deploy lên Môi trường Vercel. Fix lỗi bật nhầm Popup sau khi tự duyệt Email thay vì Play Iframe trong View hiện tại.

## 5. Môi trường (Environment Variables Vercel / Supabase)
- `VITE_SUPABASE_URL`: Đường dẫn API Supabase.
- `VITE_SUPABASE_ANON_KEY`: Client access key.
- `SUPABASE_SERVICE_ROLE_KEY`: Admin bypass key (Cho backend API / Edge).
- `BUNNY_LIBRARY_ID` và `BUNNY_STREAM_TOKEN_AUTH_KEY`: Bí mật tạo token Bunny HLS bảo mật.

---
*(Tài liệu này được tạo và duy trì bởi Trợ lý Antigravity - có thể gọi file này lên để Review nếu cần reset Context)*
