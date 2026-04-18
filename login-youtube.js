import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USER_DATA_DIR = path.join(__dirname, '.puppeteer_data');

console.log("==========================================");
console.log("CÔNG CỤ ĐĂNG NHẬP YOUTUBE CHO CHẠY NGẦM");
console.log("Đang mở trình duyệt...");
console.log("==========================================");

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // Mở UI để đăng nhập
    userDataDir: USER_DATA_DIR,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  await page.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded' });

  console.log(">>> Vui lòng đăng nhập vào tài khoản Google chứa các video Youtube của bạn.");
  console.log(">>> Sau khi đăng nhập thành công và thấy giao diện Youtube Studio, bạn có thể ĐÓNG trình duyệt này lại.");
  console.log(">>> Lần sau hệ thống sẽ tự động dùng session này để Chạy Ngầm (Headless) mà không cần đăng nhập lại!");
})();
